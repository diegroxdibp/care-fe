import {
  Component,
  computed,
  Directive,
  ElementRef,
  HostListener,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import Daily, {
  DailyCall,
  DailyEventObjectAppMessage,
  DailyEventObjectParticipant,
  DailyEventObjectParticipantLeft,
  DailyParticipant,
} from '@daily-co/daily-js';
import { SessionService } from '../../services/session.service';
import { VideoSession } from '../../models/video-session.model';
import { detectBrowserTimezone } from '../../utils/timezones.util';

/** A partir de quando se avisa que a sala vai fechar. */
const CLOSING_WARNING_MS = 5 * 60_000;
/** Mesmo teto da criação de sala - ver RoomService.extendRoom no backend. */
const MAX_ROOM_DURATION_MS = 8 * 60 * 60_000;
const EXTEND_OPTIONS_MIN = [15, 30, 60];

/** Mensagem que quem estende manda às outras pessoas na chamada - ver onAppMessage. */
const ROOM_EXTENDED_KIND = 'room-extended';
/** Mensagem que quem modera manda a quem silenciou - ver onAppMessage. */
const MUTED_BY_HOST_KIND = 'muted-by-host';
/** Quanto tempo a pré-visualização de uma mensagem nova fica à vista. */
const CHAT_PREVIEW_MS = 5_000;

interface VideoTile {
  sessionId: string;
  name: string;
  isLocal: boolean;
  /** Id da pessoa no Care, vindo do token (RoomService.getVideoSession) - vazio num token antigo. */
  userId: string;
  /** Dona da sala ou admin, pelo token da Daily - não se modera entre si. */
  isOwner: boolean;
  micOn: boolean;
  camOn: boolean;
  stream: MediaStream;
}

interface ChatMessage {
  from: string;
  text: string;
  mine: boolean;
}

type RoomState = 'loading' | 'not-available' | 'in-call' | 'ended';

/**
 * Liga uma MediaStream a um <video> imperativamente - Angular não tem forma
 * declarativa de o fazer, e é preciso porque as tiles são dinâmicas (uma por
 * participante) e a stream de cada uma muda ao longo da chamada (câmara
 * ligada/desligada, entradas/saídas).
 */
@Directive({
  selector: 'video[appMediaStream]',
  standalone: true,
})
export class MediaStreamDirective implements OnChanges {
  @Input('appMediaStream') stream: MediaStream | null = null;

  private readonly el = inject(ElementRef<HTMLVideoElement>);

  ngOnChanges(): void {
    this.el.nativeElement.srcObject = this.stream;
  }
}

function syncTrack(stream: MediaStream, kind: 'audio' | 'video', track?: MediaStreamTrack | null): void {
  const existing = kind === 'video' ? stream.getVideoTracks() : stream.getAudioTracks();
  for (const t of existing) {
    if (t !== track) stream.removeTrack(t);
  }
  if (track && !stream.getTracks().includes(track)) {
    stream.addTrack(track);
  }
}

/**
 * Palco de uma videochamada Daily (tiles, chat, controlos) - não sabe de onde
 * vem a sessão. Quem a usa (AppointmentRoomComponent, RoomJoinComponent)
 * só tem de dizer como pedir o token (fetchSession) e para onde voltar ao
 * sair; a lógica da chamada em si vive toda aqui, uma única vez.
 */
@Component({
  selector: 'app-video-call-stage',
  standalone: true,
  imports: [MediaStreamDirective],
  templateUrl: './video-call-stage.component.html',
  styleUrl: './video-call-stage.component.scss',
})
export class VideoCallStageComponent implements OnInit, OnDestroy {
  @Input({ required: true }) fetchSession!: () => Observable<VideoSession>;
  @Input() title: string | null = null;
  @Input() leaveRoute: string[] = ['/dashboard'];
  /** Só as salas avulsas passam isto - a janela de uma marcação não se estende. */
  @Input() extendSession: ((minutes: number) => Observable<{ closesAt: string }>) | null = null;
  /** Também só as salas avulsas - tira o acesso no backend antes de tirar da chamada. */
  @Input() removeParticipant: ((userId: number) => Observable<void>) | null = null;

  private readonly router = inject(Router);
  private readonly sessionService = inject(SessionService);
  private readonly hostEl = inject(ElementRef<HTMLElement>);

  readonly state = signal<RoomState>('loading');
  readonly errorMessage = signal<string | null>(null);
  readonly endedMessage = signal('A sessão terminou.');

  // ── Horário de fim / fecho ──
  // endsAt é o fim combinado; closesAt é quando a chamada fecha sozinha.
  // Numa marcação, closesAt vem 5 min depois (margem para despedidas); numa
  // sala avulsa são o mesmo instante. O aviso conta a partir de endsAt (às
  // 17:55 para uma sessão até às 18:00), e o fecho fica sempre à vista em vez
  // de cortar a conversa sem pré-aviso.

  readonly extendOptions = EXTEND_OPTIONS_MIN;
  private readonly opensAt = signal<number | null>(null);
  readonly endsAt = signal<number | null>(null);
  readonly closesAt = signal<number | null>(null);
  readonly canExtend = signal(false);
  private readonly now = signal(Date.now());
  readonly extendMenuOpen = signal(false);
  readonly extending = signal(false);
  readonly extendError = signal<string | null>(null);

  /** Há margem entre o fim combinado e o fecho (marcações). */
  readonly hasGracePeriod = computed(() => {
    const ends = this.endsAt();
    const closes = this.closesAt();
    return ends !== null && closes !== null && closes > ends;
  });

  /** Minutos até ao fim combinado. */
  readonly minutesLeft = computed(() => {
    const ends = this.endsAt();
    if (ends === null) return null;
    return Math.max(0, Math.ceil((ends - this.now()) / 60_000));
  });

  /** Nos 5 minutos antes do fim combinado. */
  readonly endingSoon = computed(() => {
    const ends = this.endsAt();
    if (ends === null) return false;
    const now = this.now();
    return now >= ends - CLOSING_WARNING_MS && now < ends;
  });

  /** Já passou do fim combinado, mas a chamada ainda não fechou. */
  readonly inGracePeriod = computed(() => {
    const ends = this.endsAt();
    const closes = this.closesAt();
    if (ends === null || closes === null) return false;
    const now = this.now();
    return now >= ends && now < closes;
  });

  /** No fuso do perfil, como a lista de salas (DashboardSalasComponent.formatWindow). */
  readonly endsAtLabel = computed(() => this.formatTime(this.endsAt()));
  readonly closesAtLabel = computed(() => this.formatTime(this.closesAt()));

  private formatTime(instant: number | null): string {
    if (instant === null) return '';
    const timeZone = this.sessionService.user()?.timeZone || detectBrowserTimezone();
    return new Intl.DateTimeFormat('pt-PT', { hour: '2-digit', minute: '2-digit', timeZone }).format(instant);
  }

  // ── Moderação (silenciar / remover) ──
  readonly canModerate = signal(false);
  readonly peopleOpen = signal(false);
  /** Pessoa à espera de confirmação para ser removida. */
  readonly confirmingRemoval = signal<string | null>(null);
  readonly removing = signal(false);
  readonly moderationError = signal<string | null>(null);
  /** Para quem foi silenciado - o microfone volta a ligar-se pelo botão de sempre. */
  readonly mutedByHost = signal(false);

  readonly remoteTiles = computed(() => this.tiles().filter((t) => !t.isLocal));

  readonly tiles = signal<VideoTile[]>([]);
  readonly micOn = signal(true);
  readonly camOn = signal(true);
  readonly chatOpen = signal(false);
  readonly messages = signal<ChatMessage[]>([]);
  /** Mensagens que chegaram com a conversa fechada - o número no botão. */
  readonly unreadCount = signal(0);
  /** A última mensagem que chegou com a conversa fechada, por uns segundos. */
  readonly chatPreview = signal<ChatMessage | null>(null);
  private chatPreviewTimer: ReturnType<typeof setTimeout> | null = null;
  readonly isFullscreen = signal(false);

  /** Sessão escolhida para ocupar o palco principal - null usa o critério por omissão. */
  private readonly focusedSessionId = signal<string | null>(null);

  /**
   * Tile em destaque: a escolhida manualmente, ou por omissão a primeira
   * pessoa remota - é o próprio profissional a ficar a ocupar metade do
   * ecrã por omissão que se estava a queixar, não faz sentido a câmara
   * própria começar em destaque quando há outra pessoa na sala.
   */
  readonly mainTile = computed<VideoTile | null>(() => {
    const list = this.tiles();
    if (!list.length) return null;
    const focused = this.focusedSessionId();
    return (
      list.find((t) => t.sessionId === focused) ??
      list.find((t) => !t.isLocal) ??
      list[0]
    );
  });

  readonly thumbnailTiles = computed<VideoTile[]>(() => {
    const main = this.mainTile();
    return this.tiles().filter((t) => t !== main);
  });

  private call: DailyCall | null = null;
  private readonly streamsBySessionId = new Map<string, MediaStream>();
  private autoLeaveTimer: ReturnType<typeof setTimeout> | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.connect();
  }

  ngOnDestroy(): void {
    this.teardown();
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    this.isFullscreen.set(document.fullscreenElement === this.hostEl.nativeElement);
  }

  focusTile(sessionId: string): void {
    this.focusedSessionId.update((cur) => (cur === sessionId ? null : sessionId));
  }

  toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      this.hostEl.nativeElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  private connect(): void {
    this.state.set('loading');
    this.fetchSession().subscribe({
      next: (session) => this.joinCall(session),
      error: (err: HttpErrorResponse) => {
        this.state.set('not-available');
        this.errorMessage.set(this.messageFor(err));
      },
    });
  }

  private messageFor(err: HttpErrorResponse): string {
    const body = err.error as { error?: string } | string | null;
    if (typeof body === 'object' && body?.error) return body.error;
    if (err.status === 403) return 'Você não tem permissão para entrar nesta sala.';
    if (err.status === 404) return 'Sala não encontrada.';
    if (err.status === 400) return 'Esta sessão não é remota.';
    return 'Ainda não é possível entrar nesta sala.';
  }

  retry(): void {
    this.connect();
  }

  leave(): void {
    this.teardown();
    this.router.navigate(this.leaveRoute);
  }

  private async joinCall(session: VideoSession): Promise<void> {
    const call = Daily.createCallObject();
    this.call = call;

    call.on('participant-joined', (e) => this.onParticipantChange(e));
    call.on('participant-updated', (e) => this.onParticipantChange(e));
    call.on('participant-left', (e) => this.onParticipantLeft(e));
    call.on('left-meeting', () => this.onLeftMeeting());
    call.on('error', (e) => {
      if (e?.error?.type === 'ejected') {
        this.teardown();
        this.endedMessage.set('Você foi removido da sala por quem a organiza.');
        this.state.set('ended');
        return;
      }
      this.state.set('not-available');
      this.errorMessage.set('A conexão com a sala falhou. Tente novamente.');
    });
    call.on('app-message', (e) => this.onAppMessage(e));

    try {
      await call.join({
        url: session.roomUrl,
        token: session.token,
        userName: this.sessionService.user()?.name ?? 'Participante',
      });
      this.state.set('in-call');
      this.refreshTiles();
      this.opensAt.set(new Date(session.opensAt).getTime());
      this.canExtend.set(session.canExtend && !!this.extendSession);
      this.canModerate.set(!!session.canModerate && !!this.removeParticipant);
      this.setWindow(session.closesAt, session.endsAt);
      this.clockTimer = setInterval(() => this.now.set(Date.now()), 15_000);
    } catch {
      this.state.set('not-available');
      this.errorMessage.set('Não foi possível entrar na sala. Verifique a câmera/microfone e tente novamente.');
    }
  }

  /** Sem endsAt (sala avulsa, ou backend antigo), o fim combinado é o próprio fecho. */
  private setWindow(closesAt: string, endsAt?: string): void {
    const closes = new Date(closesAt).getTime();
    this.closesAt.set(closes);
    this.endsAt.set(endsAt ? new Date(endsAt).getTime() : closes);
    this.now.set(Date.now());

    if (this.autoLeaveTimer) clearTimeout(this.autoLeaveTimer);
    this.autoLeaveTimer = null;
    const msLeft = closes - Date.now();
    if (msLeft <= 0) return;
    this.autoLeaveTimer = setTimeout(() => this.endAtClosingTime(), msLeft);
  }

  // Antes isto voltava direto ao painel, e quem estava na chamada não tinha
  // como perceber que tinha sido o horário da sala a acabar.
  private endAtClosingTime(): void {
    this.teardown();
    this.endedMessage.set('O horário da sala terminou.');
    this.state.set('ended');
  }

  /** Verdadeiro quando estender estes minutos passaria das 8h no total. */
  exceedsMaxDuration(minutes: number): boolean {
    const opens = this.opensAt();
    const closes = this.closesAt();
    if (opens === null || closes === null) return true;
    return closes + minutes * 60_000 > opens + MAX_ROOM_DURATION_MS;
  }

  toggleExtendMenu(): void {
    this.extendError.set(null);
    this.extendMenuOpen.update((v) => !v);
  }

  extend(minutes: number): void {
    if (!this.extendSession || this.extending() || this.exceedsMaxDuration(minutes)) return;
    this.extending.set(true);
    this.extendError.set(null);

    this.extendSession(minutes).subscribe({
      next: (room) => {
        this.extending.set(false);
        this.extendMenuOpen.set(false);
        this.setWindow(room.closesAt);
        this.call?.sendAppMessage({ kind: ROOM_EXTENDED_KIND }, '*');
      },
      error: (err: HttpErrorResponse) => {
        this.extending.set(false);
        const body = err.error as { error?: string } | null;
        this.extendError.set(body?.error ?? 'Não foi possível estender a sala.');
      },
    });
  }

  // O novo fecho vem sempre do backend, nunca da mensagem - qualquer pessoa
  // na chamada pode mandar uma app-message.
  private refreshClosingTime(): void {
    this.fetchSession().subscribe({
      next: (session) => this.setWindow(session.closesAt, session.endsAt),
      error: () => {},
    });
  }

  togglePeople(): void {
    this.moderationError.set(null);
    this.confirmingRemoval.set(null);
    this.peopleOpen.update((v) => !v);
    if (this.peopleOpen()) this.chatOpen.set(false);
  }

  mute(tile: VideoTile): void {
    if (!this.canModerate() || !this.call || tile.isLocal || tile.isOwner) return;
    this.call.updateParticipant(tile.sessionId, { setAudio: false });
    this.call.sendAppMessage({ kind: MUTED_BY_HOST_KIND }, tile.sessionId);
  }

  askToRemove(tile: VideoTile): void {
    this.moderationError.set(null);
    this.confirmingRemoval.set(tile.sessionId);
  }

  cancelRemoval(): void {
    this.confirmingRemoval.set(null);
  }

  // Primeiro o backend, para a pessoa não voltar a entrar pelo link; só
  // depois tirá-la da chamada. Ao contrário, um erro no backend deixava-a
  // fora da chamada mas livre para voltar.
  remove(tile: VideoTile): void {
    if (!this.canModerate() || !this.removeParticipant || this.removing() || tile.isLocal || tile.isOwner) return;
    const userId = Number(tile.userId);
    if (!tile.userId || !Number.isInteger(userId)) {
      this.moderationError.set('Não foi possível identificar esta pessoa. Peça para ela sair e entrar de novo.');
      return;
    }
    this.removing.set(true);
    this.moderationError.set(null);

    this.removeParticipant(userId).subscribe({
      next: () => {
        this.removing.set(false);
        this.confirmingRemoval.set(null);
        this.call?.updateParticipant(tile.sessionId, { eject: true });
      },
      error: (err: HttpErrorResponse) => {
        this.removing.set(false);
        const body = err.error as { error?: string } | null;
        this.moderationError.set(body?.error ?? 'Não foi possível remover esta pessoa.');
      },
    });
  }

  dismissMutedNotice(): void {
    this.mutedByHost.set(false);
  }

  private onParticipantChange(_e: DailyEventObjectParticipant): void {
    this.refreshTiles();
  }

  private onParticipantLeft(_e: DailyEventObjectParticipantLeft): void {
    this.streamsBySessionId.delete(_e.participant.session_id);
    this.refreshTiles();
  }

  private onLeftMeeting(): void {
    this.state.set('ended');
  }

  private onAppMessage(e: DailyEventObjectAppMessage<{ text?: string; from?: string; kind?: string }>): void {
    if (e.data?.kind === ROOM_EXTENDED_KIND) {
      this.refreshClosingTime();
      return;
    }
    // Qualquer pessoa pode mandar uma app-message: só conta vinda de quem é
    // dona da sala (a Daily já só deixa uma dona silenciar outra pessoa).
    if (e.data?.kind === MUTED_BY_HOST_KIND) {
      if (this.call?.participants()[e.fromId]?.owner) {
        this.micOn.set(false);
        this.mutedByHost.set(true);
      }
      return;
    }
    if (!e.data?.text) return;
    const message: ChatMessage = { from: e.data.from ?? 'Participante', text: e.data.text, mine: false };
    this.messages.update((list) => [...list, message]);
    if (!this.chatOpen()) this.notifyUnread(message);
  }

  // Com a conversa fechada, uma mensagem nova passava despercebida - fica um
  // número no botão até a conversa abrir, e a mensagem à vista uns segundos.
  private notifyUnread(message: ChatMessage): void {
    this.unreadCount.update((n) => n + 1);
    this.chatPreview.set(message);
    this.clearChatPreviewTimer();
    this.chatPreviewTimer = setTimeout(() => this.chatPreview.set(null), CHAT_PREVIEW_MS);
  }

  private clearChatPreviewTimer(): void {
    if (this.chatPreviewTimer) {
      clearTimeout(this.chatPreviewTimer);
      this.chatPreviewTimer = null;
    }
  }

  dismissChatPreview(): void {
    this.clearChatPreviewTimer();
    this.chatPreview.set(null);
  }

  private refreshTiles(): void {
    if (!this.call) return;
    const participants = this.call.participants();
    const list: VideoTile[] = Object.values(participants).map((p: DailyParticipant) => ({
      sessionId: p.session_id,
      name: p.local ? 'Você' : (p.user_name || 'Participante'),
      isLocal: p.local,
      userId: p.user_id ?? '',
      isOwner: !!p.owner,
      micOn: p.tracks.audio.state === 'playable',
      camOn: p.tracks.video.state === 'playable',
      stream: this.streamFor(p.session_id, p.tracks.video.persistentTrack, p.tracks.audio.persistentTrack),
    }));
    list.sort((a, b) => (a.isLocal === b.isLocal ? 0 : a.isLocal ? -1 : 1));
    this.tiles.set(list);
  }

  private streamFor(sessionId: string, video?: MediaStreamTrack | null, audio?: MediaStreamTrack | null): MediaStream {
    let stream = this.streamsBySessionId.get(sessionId);
    if (!stream) {
      stream = new MediaStream();
      this.streamsBySessionId.set(sessionId, stream);
    }
    syncTrack(stream, 'video', video);
    syncTrack(stream, 'audio', audio);
    return stream;
  }

  toggleMic(): void {
    const next = !this.micOn();
    if (next) this.mutedByHost.set(false);
    this.call?.setLocalAudio(next);
    this.micOn.set(next);
  }

  toggleCam(): void {
    const next = !this.camOn();
    this.call?.setLocalVideo(next);
    this.camOn.set(next);
  }

  toggleChat(): void {
    this.chatOpen.update((v) => !v);
    if (this.chatOpen()) {
      this.peopleOpen.set(false);
      this.unreadCount.set(0);
      this.dismissChatPreview();
    }
  }

  sendChat(input: HTMLInputElement): void {
    const text = input.value.trim();
    if (!text || !this.call) return;
    const name = this.sessionService.user()?.name ?? 'Você';
    this.call.sendAppMessage({ text, from: name }, '*');
    this.messages.update((list) => [...list, { from: 'Você', text, mine: true }]);
    input.value = '';
  }

  private teardown(): void {
    if (document.fullscreenElement === this.hostEl.nativeElement) {
      document.exitFullscreen?.().catch(() => {});
    }
    if (this.autoLeaveTimer) {
      clearTimeout(this.autoLeaveTimer);
      this.autoLeaveTimer = null;
    }
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
    this.clearChatPreviewTimer();
    this.streamsBySessionId.clear();
    if (this.call) {
      this.call.leave().catch(() => {});
      this.call.destroy().catch(() => {});
      this.call = null;
    }
  }
}
