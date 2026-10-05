import {
  Component, computed, DestroyRef, ElementRef, inject, OnInit, signal, viewChildren,
} from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { SessionService } from '../../services/session.service';
import { SnackbarService } from '../../services/snackbar.service';
import { FeatureFlagService } from '../../services/feature-flag.service';
import { Appointment } from '../../models/appointment.model';
import { ProfessionalService } from '../../models/professional-service.model';
import {
  ClientRecord,
  ClientRecordNote,
  ClientRecordNoteVisibility,
} from '../../models/client-record.model';
import { Currency } from '../../enums/currency.enum';
import { ProfessionalSessionService } from '../../enums/professional-session-service.enum';
import { Pages } from '../../enums/pages.enum';
import { buildSessions, isUpcomingOrOngoing, sessionBounds } from '../../utils/session-list.util';
import { detectBrowserTimezone } from '../../utils/timezones.util';
import { UserTimePipe } from '../../pipes/user-time.pipe';

/** Espelha ClientRecordService.MAX_TEXT_LENGTH no backend. */
const MAX_TEXT_LENGTH = 10_000;

/** Cores dos pontos da equipa de cuidado, por ordem (repetem-se depois da sexta pessoa). */
const CARE_TEAM_COLORS = [
  'var(--color-primary-blue)',
  'var(--color-secondary-green)',
  'var(--color-primary-purple)',
  'var(--color-secondary-cyan)',
  'var(--color-secondary-pink)',
  'var(--color-secondary-indigo)',
];

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/**
 * Distância (px) abaixo do topo da área com scroll a partir da qual um dia
 * da Evolução passa a ser o ativo na linha do tempo.
 */
const ACTIVE_DAY_OFFSET = 96;

/** Folga (px) entre o topo da área visível e o marcador de um dia que o acompanha. */
const MARKER_TOP_GAP = 12;

/** Notas de um mesmo dia (no fuso de quem vê), pela ordem da Evolução. */
export interface NoteDay {
  /** yyyy-MM-dd no fuso de quem vê. */
  key: string;
  /** "05 Out" */
  label: string;
  /** "Hoje", "Ontem", o ano se não for o corrente, ou null. */
  sublabel: string | null;
  notes: ClientRecordNote[];
}

@Component({
  selector: 'app-dashboard-client-record',
  imports: [UserTimePipe],
  templateUrl: './dashboard-client-record.component.html',
  styleUrl: './dashboard-client-record.component.scss',
})
export class DashboardClientRecordComponent implements OnInit {
  private readonly apiService = inject(ApiService);
  private readonly sessionService = inject(SessionService);
  private readonly snackbarService = inject(SnackbarService);
  private readonly featureFlagService = inject(FeatureFlagService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly destroyRef = inject(DestroyRef);

  /** Um bloco por dia da Evolução — a linha do tempo segue-os no scroll. */
  private readonly dayGroups = viewChildren<ElementRef<HTMLElement>>('dayGroup');

  /**
   * Se se chegou aqui a partir de outra página da app (a lista de Clientes ou
   * "Prontuário" em Meus atendimentos). Lido ao construir, antes de esta
   * navegação terminar: nesse momento lastSuccessfulNavigation ainda é a da
   * página anterior — null só quando o prontuário foi aberto diretamente
   * (link colado, refresh), e aí não há "para trás" dentro da app.
   */
  private readonly cameFromApp = this.router.lastSuccessfulNavigation != null;

  /** URL da lista — o destino do "Voltar" quando não há página anterior na app. */
  protected readonly clientsListUrl = '/' + Pages.DASHBOARD_CLIENTS;

  protected readonly Pages = Pages;
  protected readonly maxLength = MAX_TEXT_LENGTH;

  readonly record = signal<ClientRecord | null>(null);
  readonly loading = signal(true);
  /** 403/404 — o backend decide quem pode ver; aqui só se mostra a recusa. */
  readonly denied = signal(false);

  private clientId = 0;
  private readonly appointments = signal<Appointment[]>([]);
  private readonly services = signal<ProfessionalService[]>([]);

  // Nova nota
  readonly noteBody = signal('');
  readonly noteVisibility = signal<ClientRecordNoteVisibility>('SHARED');
  readonly reasonDraft = signal('');
  readonly clinicalHistoryDraft = signal('');
  readonly savingNote = signal(false);

  // Adenda em curso (uma de cada vez)
  readonly addendumFor = signal<number | null>(null);
  readonly addendumBody = signal('');
  readonly savingAddendum = signal(false);

  readonly client = computed(() => this.record()?.client ?? null);

  readonly initials = computed(() => initialsFor(this.client()?.name ?? ''));

  readonly age = computed(() => ageFrom(this.client()?.birthDate));

  readonly birthDateLabel = computed(() => {
    const raw = this.client()?.birthDate;
    if (!raw) return null;
    // Data sem fuso: formatar os componentes tal como vêm, sem passar por Date/UTC.
    const [y, m, d] = raw.split('-');
    return `${d}/${m}/${y}`;
  });

  private readonly viewerTimeZone = computed(() =>
    this.sessionService.user()?.timeZone || detectBrowserTimezone());

  /** Equipa de cuidado com a cor de cada pessoa e qual delas é quem está a ver. */
  readonly careTeam = computed(() => {
    const me = this.sessionService.user()?.id;
    return (this.record()?.careTeam ?? []).map((p, i) => ({
      ...p,
      color: CARE_TEAM_COLORS[i % CARE_TEAM_COLORS.length],
      isMe: p.id === me,
    }));
  });

  readonly careAreas = computed(() =>
    (this.record()?.careAreas ?? []).map(key =>
      ProfessionalSessionService[key as keyof typeof ProfessionalSessionService] ?? key));

  /**
   * Notas agrupadas por dia no fuso de quem vê — a mesma conta que o pipe
   * userTime faz para a data mostrada em cada nota.
   */
  readonly noteDays = computed<NoteDay[]>(() => {
    const timeZone = this.viewerTimeZone();
    const today = dayKey(new Date(), timeZone);
    const yesterday = dayKey(new Date(Date.now() - 86_400_000), timeZone);
    const days: NoteDay[] = [];
    for (const note of this.record()?.notes ?? []) {
      const key = dayKey(new Date(note.createdAt), timeZone);
      const last = days[days.length - 1];
      if (last?.key === key) {
        last.notes.push(note);
        continue;
      }
      const [y, m, d] = key.split('-');
      days.push({
        key,
        label: `${d} ${MONTHS_SHORT[Number(m) - 1]}`,
        sublabel: key === today ? 'Hoje'
          : key === yesterday ? 'Ontem'
          : y !== today.slice(0, 4) ? y
          : null,
        notes: [note],
      });
    }
    return days;
  });

  /** Dia em destaque na linha do tempo — o que está no topo da área visível. */
  private readonly scrolledDay = signal<string | null>(null);
  readonly activeDay = computed(() => this.scrolledDay() ?? this.noteDays()[0]?.key ?? null);

  /**
   * Dia escolhido com um clique na linha do tempo. Enquanto o scroll suave
   * corre (e se o último dia nem chega ao topo) é ele que fica em destaque;
   * larga-se no próximo scroll feito pela pessoa.
   */
  private pinnedDay: string | null = null;

  /** Sessões com quem está a ver — mesmo código de fusos que "Meus atendimentos". */
  private readonly sessions = computed(() =>
    buildSessions(
      this.appointments().filter(a => a.clientId === this.clientId),
      this.services(),
      {
        perspective: 'PROFESSIONAL',
        currency: this.sessionService.user()?.currency ?? Currency.EUR,
        paymentsEnabled: this.featureFlagService.paymentsEnabled(),
        viewerTimeZone: this.sessionService.user()?.timeZone || detectBrowserTimezone(),
      },
    ),
  );

  readonly sessionStats = computed(() => {
    const now = new Date();
    // Propostas por responder não são sessões feitas nem marcadas.
    const all = this.sessions().filter(s => !s.pending);
    const next = all.find(s => isUpcomingOrOngoing(s, now));
    const first = all[0];
    return {
      done: all.filter(s => !isUpcomingOrOngoing(s, now)).length,
      firstAt: first ? (sessionBounds(first)?.start ?? first.date) : null,
      nextAt: next ? (sessionBounds(next)?.start ?? next.date) : null,
    };
  });

  readonly pending = computed(() => this.record()?.pendingIntake ?? { reason: false, clinicalHistory: false });

  readonly isFirstNote = computed(() => !(this.record()?.notes.some(n => n.mine) ?? false));

  readonly canSaveNote = computed(() => this.noteBody().trim().length > 0 && !this.savingNote());

  /**
   * Volta para onde se estava. O href continua a ser a lista de Clientes
   * (para abrir num separador novo); sem página anterior na app o clique vai
   * para ela, com histórico faz o mesmo que o "para trás" do browser.
   */
  goBack(event: MouseEvent): void {
    // Ctrl/Cmd/Shift/botão do meio: deixar o browser abrir o href noutro separador.
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    if (this.cameFromApp) {
      this.location.back();
    } else {
      this.router.navigateByUrl(this.clientsListUrl);
    }
  }

  constructor() {
    // Em ecrã largo quem faz scroll é o painel (ou o <main> do dashboard); em
    // ecrã estreito é a janela. Em captura apanha-se o scroll de qualquer um.
    const onScroll = () => this.followScroll();
    const release = () => { this.pinnedDay = null; };
    const opts = { capture: true, passive: true };
    const releaseOn = ['wheel', 'touchstart', 'keydown'] as const;
    document.addEventListener('scroll', onScroll, opts);
    window.addEventListener('resize', onScroll, { passive: true });
    releaseOn.forEach(type => document.addEventListener(type, release, opts));
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('scroll', onScroll, opts);
      window.removeEventListener('resize', onScroll);
      releaseOn.forEach(type => document.removeEventListener(type, release, opts));
    });
  }

  ngOnInit(): void {
    this.clientId = Number(this.route.snapshot.paramMap.get('clientId'));
    if (!this.clientId) {
      this.denied.set(true);
      this.loading.set(false);
      return;
    }

    this.apiService.getClientRecord(this.clientId).subscribe({
      next: (record) => {
        this.record.set(record);
        this.loading.set(false);
      },
      error: (err) => {
        if (err?.status === 403 || err?.status === 404) this.denied.set(true);
        this.loading.set(false);
      },
    });

    const professionalId = this.sessionService.user()?.id;
    if (professionalId) {
      this.apiService.getProfessionalAppointments(professionalId).subscribe({
        next: (appts) => this.appointments.set(appts),
        error: () => {},
      });
      this.apiService.getServices().subscribe((svcs) => this.services.set(svcs));
    }
  }

  saveNote(): void {
    if (!this.canSaveNote()) return;
    const pending = this.pending();
    const reason = this.reasonDraft().trim();
    const clinicalHistory = this.clinicalHistoryDraft().trim();

    this.savingNote.set(true);
    this.apiService.addClientRecordNote(this.clientId, {
      body: this.noteBody(),
      visibility: this.noteVisibility(),
      // Só se envia o que ainda estava por preencher — o backend também o garante.
      reason: pending.reason && reason ? reason : undefined,
      clinicalHistory: pending.clinicalHistory && clinicalHistory ? clinicalHistory : undefined,
    }).subscribe({
      next: (record) => {
        this.record.set(record);
        this.noteBody.set('');
        this.reasonDraft.set('');
        this.clinicalHistoryDraft.set('');
        this.noteVisibility.set('SHARED');
        this.savingNote.set(false);
        this.snackbarService.openSnackBar({ message: 'Nota guardada no prontuário.' });
      },
      // O interceptor já mostra a recusa concreta do backend.
      error: () => this.savingNote.set(false),
    });
  }

  startAddendum(note: ClientRecordNote): void {
    this.addendumFor.set(note.id);
    this.addendumBody.set('');
  }

  cancelAddendum(): void {
    this.addendumFor.set(null);
    this.addendumBody.set('');
  }

  saveAddendum(note: ClientRecordNote): void {
    const body = this.addendumBody().trim();
    if (!body || this.savingAddendum()) return;

    this.savingAddendum.set(true);
    this.apiService.addClientRecordAddendum(this.clientId, note.id, body).subscribe({
      next: (record) => {
        this.record.set(record);
        this.cancelAddendum();
        this.savingAddendum.set(false);
        this.snackbarService.openSnackBar({ message: 'Adenda acrescentada.' });
      },
      error: () => this.savingAddendum.set(false),
    });
  }

  /** Clique numa data da linha do tempo: leva à primeira nota desse dia. */
  goToDay(day: NoteDay): void {
    const el = this.dayGroups().find(g => g.nativeElement.dataset['day'] === day.key)?.nativeElement;
    if (!el) return;
    this.pinnedDay = day.key;
    this.scrolledDay.set(day.key);
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  /**
   * A cada scroll: o marcador de cada dia desce com o scroll até ao fim das
   * notas desse dia, e o dia ativo é o último cujo bloco já passou a linha de
   * referência, um pouco abaixo do topo da área visível (o cabeçalho fixo ou
   * o topo da área com scroll). No fim do scroll é o último dia, que pode
   * nunca chegar ao topo.
   *
   * Não é position: sticky de propósito — o painel, o <main> e o .body do
   * dashboard têm overflow próprio mesmo quando quem faz scroll é a janela,
   * e isso prende o sticky a um elemento que nunca se mexe.
   */
  private followScroll(): void {
    const groups = this.dayGroups().map(g => g.nativeElement);
    if (groups.length === 0) return;

    const scroller = scrollParent(groups[0]);
    const headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 0;
    const rootTop = scroller ? scroller.getBoundingClientRect().top : 0;
    const visibleTop = Math.max(rootTop, headerH);

    for (const g of groups) {
      const marker = g.querySelector<HTMLElement>('.day-marker');
      if (!marker) continue;
      const rect = g.getBoundingClientRect();
      const room = rect.height - marker.offsetHeight;
      const offset = Math.min(Math.max(visibleTop + MARKER_TOP_GAP - rect.top, 0), Math.max(room, 0));
      marker.style.transform = offset ? `translateY(${offset}px)` : '';
    }

    if (this.pinnedDay) return;
    const line = visibleTop + ACTIVE_DAY_OFFSET;

    const root = scroller ?? document.scrollingElement;
    const atBottom = root != null && root.scrollTop > 0
      && root.scrollTop + root.clientHeight >= root.scrollHeight - 2;
    const last = groups[groups.length - 1];

    let active = groups[0];
    if (atBottom && last.getBoundingClientRect().top < window.innerHeight) {
      active = last;
    } else {
      for (const g of groups) {
        if (g.getBoundingClientRect().top > line) break;
        active = g;
      }
    }
    this.scrolledDay.set(active.dataset['day'] ?? null);
  }

  authorInitials(name: string): string {
    return initialsFor(name);
  }

  onInput(target: 'body' | 'reason' | 'history' | 'addendum', event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    switch (target) {
      case 'body': this.noteBody.set(value); break;
      case 'reason': this.reasonDraft.set(value); break;
      case 'history': this.clinicalHistoryDraft.set(value); break;
      case 'addendum': this.addendumBody.set(value); break;
    }
  }
}

/** yyyy-MM-dd do instante no fuso dado. */
function dayKey(date: Date, timeZone: string): string {
  // en-CA formata como yyyy-MM-dd.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(date);
}

/** Antepassado mais próximo com scroll vertical; null quando é a janela. */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const overflowY = getComputedStyle(p).overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/** Idade a partir de yyyy-MM-dd, comparando só componentes de data (sem fusos). */
export function ageFrom(birthDate: string | null | undefined, today: Date = new Date()): number | null {
  if (!birthDate) return null;
  const [y, m, d] = birthDate.split('-').map(Number);
  if (!y || !m || !d) return null;
  let age = today.getFullYear() - y;
  const beforeBirthday = today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d);
  if (beforeBirthday) age--;
  return age >= 0 ? age : null;
}
