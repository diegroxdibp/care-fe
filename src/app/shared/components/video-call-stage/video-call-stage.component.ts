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

interface VideoTile {
  sessionId: string;
  name: string;
  isLocal: boolean;
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

  private readonly router = inject(Router);
  private readonly sessionService = inject(SessionService);
  private readonly hostEl = inject(ElementRef<HTMLElement>);

  readonly state = signal<RoomState>('loading');
  readonly errorMessage = signal<string | null>(null);

  readonly tiles = signal<VideoTile[]>([]);
  readonly micOn = signal(true);
  readonly camOn = signal(true);
  readonly chatOpen = signal(false);
  readonly messages = signal<ChatMessage[]>([]);
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
    if (err.status === 403) return 'Não tem permissão para entrar nesta sala.';
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
    call.on('error', () => {
      this.state.set('not-available');
      this.errorMessage.set('A ligação à sala falhou. Tente novamente.');
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
      this.scheduleAutoLeave(session.closesAt);
    } catch {
      this.state.set('not-available');
      this.errorMessage.set('Não foi possível entrar na sala. Verifique a câmara/microfone e tente novamente.');
    }
  }

  private scheduleAutoLeave(closesAt: string): void {
    const msLeft = new Date(closesAt).getTime() - Date.now();
    if (msLeft <= 0) return;
    this.autoLeaveTimer = setTimeout(() => this.leave(), msLeft);
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

  private onAppMessage(e: DailyEventObjectAppMessage<{ text?: string; from?: string }>): void {
    if (!e.data?.text) return;
    this.messages.update((list) => [...list, { from: e.data.from ?? 'Participante', text: e.data.text!, mine: false }]);
  }

  private refreshTiles(): void {
    if (!this.call) return;
    const participants = this.call.participants();
    const list: VideoTile[] = Object.values(participants).map((p: DailyParticipant) => ({
      sessionId: p.session_id,
      name: p.local ? 'Você' : (p.user_name || 'Participante'),
      isLocal: p.local,
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
    this.streamsBySessionId.clear();
    if (this.call) {
      this.call.leave().catch(() => {});
      this.call.destroy().catch(() => {});
      this.call = null;
    }
  }
}
