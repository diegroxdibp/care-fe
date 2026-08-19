import { Component, computed, ElementRef, HostListener, inject, OnInit, signal, ViewChild } from '@angular/core';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { CommonModule } from '@angular/common';
import { animate, style, transition, trigger } from '@angular/animations';
import { MatDialog } from '@angular/material/dialog';
import { SessionService } from '../../shared/services/session.service';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../auth/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { MessageService } from '../../core/services/message.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { FeatureFlagService } from '../../shared/services/feature-flag.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import {
  CancelSessionDialogComponent,
  CancelSessionScope,
} from './cancel-session-dialog.component';
import {
  RescheduleDialogComponent,
  RescheduleDialogData,
  RescheduleDialogResult,
} from '../../shared/components/reschedule-dialog/reschedule-dialog.component';
import { Appointment } from '../../shared/models/appointment.model';
import { DayOfWeek } from '../../shared/enums/day-of-week.enum';
import { Modality } from '../../shared/enums/modality.enum';
import { Pages } from '../../shared/enums/pages.enum';
import { ProfessionalService } from '../../shared/models/professional-service.model';
import { ProfessionalSessionService } from '../../shared/enums/professional-session-service.enum';
import { RecurrenceFrequency } from '../../shared/enums/recurrence-frequency.enum';
import { Currency, formatPrice } from '../../shared/enums/currency.enum';
import { generateOccurrences } from '../../shared/utils/recurrence.util';
import { freeSlotsOn } from '../../shared/utils/free-slots.util';
import { toApiTime } from '../../shared/utils/session-time.util';
import { normalizeModality, toBackendModality } from '../../shared/utils/modality-compatibility.util';
import { filter } from 'rxjs';

/** 'A combinar' cobre ANY e qualquer modalidade não resolvível — nunca um palpite. */
export type SessionMode = 'Presencial' | 'Remoto' | 'A combinar';

export interface DashSessionProfessional {
  id: number;
  name: string;
  role?: string;
  initials: string;
}

export interface DashSession {
  appointmentId: number;
  /**
   * Identidade da linha: a marcação e a ocorrência.
   *
   * Uma série recorrente é uma marcação só e várias linhas, pelo que o id
   * sozinho repete-se — e o @for que o usava como chave queixava-se de chaves
   * duplicadas e reaproveitava linhas erradas ao reordenar.
   */
  key: string;
  /** Quem atende — a agenda de onde saem as vagas para onde a sessão pode mudar. */
  professionalId: number;
  /** A sessão só pode mudar para uma vaga que ofereça este mesmo serviço. */
  professionalServiceId: number;
  /** A vaga onde a sessão está hoje. */
  availabilityId: number;
  date: Date;
  dow: string;
  fullDow: string;
  day: number;
  month: string;
  who: string;
  service: string;
  startTime: string;
  endTime: string;
  mode: SessionMode;
  /** A modalidade crua — `mode` já é rótulo e não serve para voltar à API. */
  modality: Modality;
  address?: string;
  platform?: string;
  price?: string;
  recurrence: string;
  isRecurring: boolean;
  duration: string;
  payment: string;
  notes?: string;
  professionals: DashSessionProfessional[];
}

const ACTIVE_VIEW_STORAGE_KEY = 'dashboard.activeView';
const HIDE_PAST_STORAGE_KEY = 'dashboard.hidePastSessions';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  animations: [
    // Altura real (via '*') em vez de opacidade isolada — o painel desliza
    // a abrir/fechar em vez de simplesmente aparecer/desaparecer, e o
    // :leave (antes inexistente) evita o corte abrupto ao fechar.
    trigger('detailEnter', [
      transition(':enter', [
        style({ height: 0, opacity: 0, overflow: 'hidden' }),
        animate('260ms cubic-bezier(0.4,0,0.2,1)', style({ height: '*', opacity: 1 })),
      ]),
      transition(':leave', [
        style({ overflow: 'hidden' }),
        animate('200ms cubic-bezier(0.4,0,0.2,1)', style({ height: 0, opacity: 0 })),
      ]),
    ]),
  ],
})
export class DashboardPageComponent implements OnInit {
  private readonly sessionService = inject(SessionService);
  private readonly apiService = inject(ApiService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackbarService = inject(SnackbarService);
  private readonly featureFlagService = inject(FeatureFlagService);
  readonly notificationService = inject(NotificationService);
  readonly messageService = inject(MessageService);

  readonly Pages = Pages;

  readonly appointments = signal<Appointment[]>([]);
  private readonly services = signal<ProfessionalService[]>([]);
  readonly activeView = signal<'list' | 'calendar'>(this.readStoredView());
  readonly currentUrl = signal(this.router.url);

  /** Acordeão de "Próximas sessões" — um painel aberto de cada vez. */
  readonly openSessionId = signal<number | null>(null);

  /** Segunda-feira da semana mostrada no calendário. */
  readonly weekStart = signal<Date>(this.startOfWeek(new Date()));
  /** 'YYYY-MM-DD' do dia selecionado no calendário, ou null. */
  readonly selectedDay = signal<string | null>(null);

  /** Oculta sessões já passadas na lista "Próximas sessões" — por omissão ficam visíveis, esbatidas. */
  readonly hidePastSessions = signal<boolean>(this.readStoredHidePast());

  readonly showSchedule = computed(() => {
    const url = this.currentUrl();
    return url === '/dashboard' || url === '/dashboard/';
  });

  readonly user = this.sessionService.user;

  readonly userInitials = computed(() => {
    const parts = (this.user()?.name ?? '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return parts.length === 1
      ? parts[0][0].toUpperCase()
      : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  });

  readonly firstName = computed(() => this.user()?.name?.split(' ')[0] ?? '');

  readonly greeting = computed(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  });

  readonly todayFormatted = computed(() =>
    new Intl.DateTimeFormat('pt-PT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date()),
  );

  /** Todas as sessões, incluindo a de destaque — usado pelo calendário. */
  readonly sessions = computed(() =>
    this.buildSessions(this.appointments(), this.services()),
  );

  readonly nextSession = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const all = this.sessions();
    return all.find(s => s.date >= today) ?? all[all.length - 1] ?? null;
  });

  /** Verdadeiro quando existe alguma sessão além da de destaque. */
  readonly hasOtherSessions = computed(() => this.sessions().length > 1);

  readonly upcomingSessions = computed(() => {
    const next = this.nextSession();
    if (!next) return [];
    let list = this.sessions().filter(s => s !== next);
    if (this.hidePastSessions()) {
      list = list.filter(s => !this.isPast(s.date));
    }
    if (this.activeView() === 'calendar' && this.selectedDay()) {
      list = list.filter(s => this.dateKey(s.date) === this.selectedDay());
    }
    return list;
  });

  /** Mensagem do estado vazio da lista — varia consoante o motivo de estar vazia. */
  readonly emptyStateMessage = computed(() => {
    if (this.activeView() === 'calendar' && this.selectedDay()) {
      return 'Não tem outras sessões neste dia.';
    }
    if (this.hidePastSessions()) {
      return 'Não tem mais sessões futuras agendadas.';
    }
    return 'Não tem outras sessões.';
  });

  /** Sessões de um dia específico no calendário — inclui a de destaque. */
  sessionsForDay(dateKey: string): DashSession[] {
    return this.sessions().filter(s => this.dateKey(s.date) === dateKey);
  }

  readonly weekDays = computed(() =>
    Array.from({ length: 7 }, (_, i) => this.addDays(this.weekStart(), i)),
  );

  readonly weekLabel = computed(() => {
    const start = this.weekStart();
    const end = this.addDays(start, 6);
    const fmt = new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'long' });
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    return `${capitalize(fmt.format(start))} – ${capitalize(fmt.format(end))} de ${end.getFullYear()}`;
  });

  private static readonly WEEK_DOW_ABR = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  dowAbr(date: Date): string {
    return DashboardPageComponent.WEEK_DOW_ABR[(date.getDay() + 6) % 7];
  }

  private static readonly DOW_ABR: Record<string, string> = {
    SUNDAY: 'Dom',    [DayOfWeek.SUNDAY]: 'Dom',
    MONDAY: 'Seg',    [DayOfWeek.MONDAY]: 'Seg',
    TUESDAY: 'Ter',   [DayOfWeek.TUESDAY]: 'Ter',
    WEDNESDAY: 'Qua', [DayOfWeek.WEDNESDAY]: 'Qua',
    THURSDAY: 'Qui',  [DayOfWeek.THURSDAY]: 'Qui',
    FRIDAY: 'Sex',    [DayOfWeek.FRIDAY]: 'Sex',
    SATURDAY: 'Sáb',  [DayOfWeek.SATURDAY]: 'Sáb',
  };

  private static readonly DOW_FULL: Record<string, string> = {
    SUNDAY: 'Domingo',    [DayOfWeek.SUNDAY]: 'Domingo',
    MONDAY: 'Segunda',    [DayOfWeek.MONDAY]: 'Segunda',
    TUESDAY: 'Terça',     [DayOfWeek.TUESDAY]: 'Terça',
    WEDNESDAY: 'Quarta',  [DayOfWeek.WEDNESDAY]: 'Quarta',
    THURSDAY: 'Quinta',   [DayOfWeek.THURSDAY]: 'Quinta',
    FRIDAY: 'Sexta',      [DayOfWeek.FRIDAY]: 'Sexta',
    SATURDAY: 'Sábado',   [DayOfWeek.SATURDAY]: 'Sábado',
  };

  private static readonly DOW_JS: Record<string, number> = {
    SUNDAY: 0,    [DayOfWeek.SUNDAY]: 0,
    MONDAY: 1,    [DayOfWeek.MONDAY]: 1,
    TUESDAY: 2,   [DayOfWeek.TUESDAY]: 2,
    WEDNESDAY: 3, [DayOfWeek.WEDNESDAY]: 3,
    THURSDAY: 4,  [DayOfWeek.THURSDAY]: 4,
    FRIDAY: 5,    [DayOfWeek.FRIDAY]: 5,
    SATURDAY: 6,  [DayOfWeek.SATURDAY]: 6,
  };

  private static readonly MONTHS = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ];

  ngOnInit(): void {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) => this.currentUrl.set(e.urlAfterRedirects));

    // "Ver sessão" nas Mensagens volta para cá pedindo para abrir uma linha específica.
    const openAppointmentId = (history.state as { openAppointmentId?: number } | null)?.openAppointmentId;
    if (openAppointmentId) {
      this.openSessionId.set(openAppointmentId);
    }

    const user = this.sessionService.user();

    if (user?.email) {
      this.apiService.getUserAppointments(user.email).subscribe((appts) => {
        this.appointments.set(appts);
        // Semana inicial é a da próxima sessão, não necessariamente a atual.
        this.weekStart.set(this.startOfWeek(this.nextSession()?.date ?? new Date()));
      });
    }

    this.apiService.getServices().subscribe((svcs) => this.services.set(svcs));
  }

  setView(v: 'list' | 'calendar'): void {
    this.activeView.set(v);
    try {
      localStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, v);
    } catch {
      // localStorage indisponível (modo privado etc.) — a escolha só não sobrevive ao reload.
    }
  }

  private readStoredView(): 'list' | 'calendar' {
    try {
      const stored = localStorage.getItem(ACTIVE_VIEW_STORAGE_KEY);
      return stored === 'calendar' ? 'calendar' : 'list';
    } catch {
      return 'list';
    }
  }

  togglePastVisibility(): void {
    this.hidePastSessions.update((cur) => {
      const next = !cur;
      try {
        localStorage.setItem(HIDE_PAST_STORAGE_KEY, String(next));
      } catch {
        // localStorage indisponível — a escolha só não sobrevive ao reload.
      }
      return next;
    });
  }

  private readStoredHidePast(): boolean {
    try {
      return localStorage.getItem(HIDE_PAST_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  /** Verdadeiro quando a data da ocorrência já passou (comparação por dia, não por hora). */
  isPast(date: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }

  /** Data/hora real de início da sessão — s.date fica à meia-noite, a hora vem de startTime. */
  private sessionDateTime(s: DashSession): Date {
    const dt = new Date(s.date);
    const [h, m] = s.startTime.split(':').map(Number);
    dt.setHours(h || 0, m || 0, 0, 0);
    return dt;
  }

  /** Cancelar/reagendar só é permitido até 24 h antes do início da sessão. */
  canModifySession(s: DashSession): boolean {
    return this.sessionDateTime(s).getTime() - Date.now() >= 24 * 60 * 60 * 1000;
  }

  /**
   * Uma única bolha/seta partilhada por todos os botões desativados, montada
   * uma vez junto da raiz de .dash (ver o HTML) em vez de uma por cada .tt.
   *
   * Porquê: um cartão (.hero-card, .row, .panel...) usa `filter:
   * var(--shadow-card)` para a sombra, e `filter` num antepassado cria um
   * novo containing block para os descendentes `position:fixed` - a bolha
   * deixava de facto de ser posicionada contra o viewport e passava a ser
   * contra esse cartão, continuando presa ao `overflow:hidden` dele. Ao
   * viver fora de qualquer cartão (sem filter/transform entre ela e
   * <html>), o fixed volta a ser mesmo contra o viewport.
   */
  @ViewChild('ttBubble') private readonly ttBubbleRef?: ElementRef<HTMLElement>;
  @ViewChild('ttArrow') private readonly ttArrowRef?: ElementRef<HTMLElement>;

  private static readonly TT_MARGIN = 8;
  private static readonly TT_GAP = 9;
  private static readonly TT_ARROW = 5;

  onTooltipReveal(event: Event, message: string): void {
    const wrapper = event.currentTarget as HTMLElement;
    const trigger = wrapper.querySelector<HTMLElement>('button');
    const bubble = this.ttBubbleRef?.nativeElement;
    const arrow = this.ttArrowRef?.nativeElement;
    if (!trigger || !bubble || !arrow) return;

    const { TT_MARGIN: margin, TT_GAP: gap, TT_ARROW: arrowSize } = DashboardPageComponent;

    bubble.textContent = message;
    bubble.classList.add('visible');
    arrow.classList.add('visible');

    const btnRect = trigger.getBoundingClientRect();
    const bubbleRect = bubble.getBoundingClientRect();

    let left = btnRect.right - bubbleRect.width;
    left = Math.min(Math.max(left, margin), window.innerWidth - margin - bubbleRect.width);

    // Por omissão a bolha fica acima do botão; se não houver espaço para a
    // conter inteira aí, cai para baixo - nunca fica encostada/cortada no
    // topo do ecrã.
    const spaceAbove = btnRect.top - gap - margin;
    const below = spaceAbove < bubbleRect.height;
    const rawTop = below ? btnRect.bottom + gap : btnRect.top - gap - bubbleRect.height;
    const top = Math.min(Math.max(rawTop, margin), window.innerHeight - margin - bubbleRect.height);

    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;
    bubble.classList.toggle('below', below);

    const btnCenter = btnRect.left + btnRect.width / 2;
    const arrowLeft = Math.min(
      Math.max(btnCenter, left + 12),
      left + bubbleRect.width - 12,
    );
    arrow.style.left = `${arrowLeft - arrowSize}px`;
    arrow.style.top = below
      ? `${btnRect.bottom + gap - arrowSize * 2}px`
      : `${btnRect.top - gap}px`;
    arrow.classList.toggle('below', below);
  }

  onTooltipHide(): void {
    this.ttBubbleRef?.nativeElement.classList.remove('visible');
    this.ttArrowRef?.nativeElement.classList.remove('visible');
  }

  // A bolha é fixed contra o viewport, não contra o botão - ao rolar a
  // página o botão foge por baixo dela e ficava "presa" no sítio antigo até
  // o rato se mexer. Mais simples fechar logo ao rolar do que reposicionar
  // a acompanhar o scroll.
  @HostListener('window:scroll')
  @HostListener('window:resize')
  private onWindowScrollOrResize(): void {
    this.onTooltipHide();
  }

  toggleSession(id: number): void {
    this.openSessionId.update((cur) => (cur === id ? null : id));
  }

  prevWeek(): void {
    this.weekStart.update((d) => this.addDays(d, -7));
  }

  nextWeek(): void {
    this.weekStart.update((d) => this.addDays(d, 7));
  }

  selectDay(dateKey: string): void {
    this.selectedDay.set(dateKey);
  }

  private startOfWeek(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const offset = (d.getDay() + 6) % 7; // segunda-feira primeiro
    d.setDate(d.getDate() - offset);
    return d;
  }

  private addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  dateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  isToday(date: Date): boolean {
    const t = new Date();
    return (
      date.getFullYear() === t.getFullYear() &&
      date.getMonth() === t.getMonth() &&
      date.getDate() === t.getDate()
    );
  }

  logout(): void {
    this.authService.logout();
  }

  /**
   * Move uma sessão para outra vaga da mesma pessoa profissional.
   *
   * As vagas não vêm com o painel: este constrói-se só a partir das marcações.
   * São pedidas aqui, ao abrir, para que as datas já ocupadas sejam as do
   * momento e não as de quando a página carregou.
   */
  rescheduleSession(session: DashSession): void {
    // A ocorrência a mover é a desta linha, não a âncora da série: numa sessão
    // semanal a âncora pode ser de há meses, e mandá-la libertaria a semana errada.
    const occurrenceDate = DashboardPageComponent.toDateKey(session.date);

    this.apiService.getAvailabilitiesByProfessionalId(session.professionalId).subscribe({
      next: (avails) => {
        const ref = this.dialog.open(RescheduleDialogComponent, {
          width: '460px',
          panelClass: 'care-dialog',
          data: {
            counterpartName: session.who,
            serviceName: session.service,
            currentLabel: `${session.fullDow}, ${session.day} de ${session.month} · ${session.startTime}–${session.endTime}`,
            isRecurring: session.isRecurring,
            slotsFor: (dateKey: string) => freeSlotsOn(
              avails,
              dateKey,
              session.professionalServiceId,
              {
                moving: { availabilityId: session.availabilityId, date: occurrenceDate },
                preferredModality: session.modality,
              },
            ),
          } satisfies RescheduleDialogData,
        });

        ref.afterClosed().subscribe((result: RescheduleDialogResult | null) => {
          if (!result) return;
          this.sendReschedule(session, occurrenceDate, result);
        });
      },
      error: () => {
        this.snackbarService.openSnackBar({
          message: 'Não foi possível carregar os horários disponíveis. Tente novamente.',
        });
      },
    });
  }

  private sendReschedule(
    session: DashSession,
    occurrenceDate: string,
    result: RescheduleDialogResult,
  ): void {
    this.apiService.rescheduleAppointment(session.appointmentId, {
      availabilityId: result.availabilityId,
      professionalServiceId: session.professionalServiceId,
      appointmentDate: result.date,
      startTime: result.startTime,
      endTime: toApiTime(result.endTime),
      modality: toBackendModality(result.modality),
      occurrenceDate,
    }).subscribe({
      next: () => {
        this.snackbarService.openSnackBar({ message: 'Sessão reagendada.' });
        // A série ganhou uma exceção e nasceu uma marcação nova; o estado
        // local não consegue deduzir isso sozinho.
        this.reloadAppointments();
      },
      // O interceptor já mostra a recusa concreta do backend.
      error: () => {},
    });
  }

  private reloadAppointments(): void {
    const email = this.sessionService.user()?.email;
    if (!email) return;
    this.apiService.getUserAppointments(email).subscribe({
      next: (appts) => this.appointments.set(appts),
      error: () => {},
    });
  }

  openThread(session: DashSession): void {
    this.messageService.createOrGetThread(session.appointmentId).subscribe({
      next: (thread) =>
        this.router.navigate(['/dashboard/messages'], { queryParams: { thread: thread.id } }),
      error: () =>
        this.snackbarService.openSnackBar({ message: 'Não foi possível abrir a conversa. Tente novamente.' }),
    });
  }

  cancelSession(session: DashSession): void {
    const occurrenceDate = DashboardPageComponent.toDateKey(session.date);

    // Numa série recorrente há duas coisas diferentes que "cancelar" pode
    // querer dizer, e só a pessoa sabe qual - perguntar. Numa sessão única
    // não há ambiguidade nenhuma a resolver.
    const ref = session.isRecurring
      ? this.dialog.open(CancelSessionDialogComponent, {
          width: '460px',
          panelClass: 'care-dialog',
          data: { occurrenceLabel: `${session.fullDow}, ${session.day} de ${session.month}` },
        })
      : this.dialog.open(ConfirmDialogComponent, {
          width: '440px',
          panelClass: 'care-dialog',
          data: {
            title: 'Cancelar sessão',
            message: 'Deseja realmente cancelar esta sessão? Essa ação não poderá ser desfeita.',
            confirmLabel: 'Cancelar sessão',
            cancelLabel: 'Voltar',
          },
        });

    ref.afterClosed().subscribe((result) => {
      if (!result) return;

      const scope: CancelSessionScope = session.isRecurring
        ? (result as CancelSessionScope)
        : 'SINGLE';

      this.apiService
        .deleteAppointment(session.appointmentId, undefined, occurrenceDate, scope)
        .subscribe({
          next: () => {
            this.applyCancellation(session, occurrenceDate, scope);
            this.snackbarService.openSnackBar({ message: 'Sessão cancelada com sucesso.' });
          },
          error: () => {
            this.snackbarService.openSnackBar({ message: 'Erro ao cancelar a sessão. Tente novamente.' });
          },
        });
    });
  }

  /**
   * Reflete localmente o que o backend acabou de fazer, sem recarregar: uma
   * ocorrência vira exceção, uma série encurta, e uma sessão única desaparece.
   */
  private applyCancellation(
    session: DashSession,
    occurrenceDate: string,
    scope: CancelSessionScope,
  ): void {
    if (!session.isRecurring) {
      this.appointments.update((list) => list.filter((a) => a.id !== session.appointmentId));
      return;
    }

    if (scope === 'SINGLE') {
      this.appointments.update((list) =>
        list.map((a) =>
          a.id === session.appointmentId
            ? { ...a, excludedDates: [...(a.excludedDates ?? []), occurrenceDate] }
            : a,
        ),
      );
      return;
    }

    const newEnd = new Date(session.date);
    newEnd.setDate(newEnd.getDate() - 1);
    const newEndKey = DashboardPageComponent.toDateKey(newEnd);
    this.appointments.update((list) =>
      list.flatMap((a) => {
        if (a.id !== session.appointmentId) return [a];
        // A série deixou de ter ocorrências - sai da lista por completo.
        if (a.startDate && newEndKey < a.startDate) return [];
        return [{ ...a, endDate: newEndKey }];
      }),
    );
  }

  private buildSessions(appointments: Appointment[], services: ProfessionalService[]): DashSession[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limit = new Date(today);
    limit.setMonth(limit.getMonth() + 12);

    const sessions: DashSession[] = [];

    for (const appt of appointments) {
      const excluded = new Set(appt.excludedDates ?? []);
      const dates = (appt.isRecurring
        ? this.recurringDates(appt, today, limit)
        : this.oneTimeDates(appt)
      ).filter(d => !excluded.has(DashboardPageComponent.toDateKey(d)));

      const rawServiceName = services.find(s => s.id === appt.professionalServiceId)?.name ?? '';
      const serviceName = ProfessionalSessionService[rawServiceName as keyof typeof ProfessionalSessionService] ?? rawServiceName;

      // appt.modality comes from the backend as the raw enum name
      // ('LOCAL'/'REMOTE'/'ANY'), not the Portuguese Modality label
      // ('Presencial'/'Remoto') — normalize before comparing. ANY (or
      // anything unresolvable) is a real value on availabilities and must
      // not be guessed as 'Presencial' — render 'A combinar' instead.
      const normalized = normalizeModality(appt.modality);
      const mode: SessionMode =
        normalized === Modality.LOCAL ? 'Presencial'
        : normalized === Modality.REMOTE ? 'Remoto'
        : 'A combinar';

      const professionals = this.buildProfessionals(appt);
      const who = professionals.length === 1
        ? professionals[0].name
        : `${professionals[0].name} e mais ${professionals.length - 1}`;

      const duration = this.durationLabel(appt.startTime, appt.endTime);
      const recurrence = appt.isRecurring && appt.recurrenceFrequency
        ? RecurrenceFrequency[appt.recurrenceFrequency]
        : 'Não recorrente';
      const price = this.priceLabel(appt);
      const payment = this.paymentLabel(appt);

      for (const date of dates) {
        sessions.push({
          appointmentId: appt.id,
          key: `${appt.id}@${DashboardPageComponent.toDateKey(date)}`,
          professionalId: appt.professionalId,
          professionalServiceId: appt.professionalServiceId,
          availabilityId: appt.availabilityId,
          date,
          dow: DashboardPageComponent.DOW_ABR[appt.dayOfWeek] ?? '?',
          fullDow: DashboardPageComponent.DOW_FULL[appt.dayOfWeek] ?? '?',
          day: date.getDate(),
          month: DashboardPageComponent.MONTHS[date.getMonth()],
          who,
          service: serviceName,
          startTime: appt.startTime?.slice(0, 5) ?? '',
          endTime: appt.endTime?.slice(0, 5) ?? '',
          mode,
          modality: normalized,
          address: appt.address,
          platform: appt.platform,
          price,
          recurrence,
          isRecurring: !!appt.isRecurring,
          duration,
          payment,
          notes: appt.notes,
          professionals,
        });
      }
    }

    return sessions.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private buildProfessionals(appt: Appointment): DashSessionProfessional[] {
    if (appt.professionals?.length) {
      return appt.professionals.map(p => ({
        ...p,
        initials: this.initialsFor(p.name),
      }));
    }
    return [{
      id: appt.professionalId,
      name: appt.professionalName,
      initials: this.initialsFor(appt.professionalName),
    }];
  }

  private initialsFor(name: string): string {
    const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return parts.length === 1
      ? parts[0][0].toUpperCase()
      : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /** Minutos entre "HH:mm:ss" (ou "HH:mm"), sem arredondar. */
  private durationLabel(startTime?: string, endTime?: string): string {
    if (!startTime || !endTime) return '';
    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    // Uma sessão pode atravessar a meia-noite (ex.: 23:00–00:00) - nesse
    // caso o fim "parece" mais cedo que o início em minutos do dia, daí
    // envolver para o dia seguinte em vez de dar uma duração negativa.
    let minutes = toMinutes(endTime) - toMinutes(startTime);
    if (minutes <= 0) minutes += 24 * 60;
    return `${minutes} minutos`;
  }

  /** Moeda do utilizador apenas — nunca mostra as duas. undefined ⇒ "a combinar". */
  private priceLabel(appt: Appointment): string | undefined {
    const currency = this.sessionService.user()?.currency ?? Currency.EUR;
    const amount = currency === Currency.BRL ? appt.priceBRL : appt.price;
    return amount != null ? formatPrice(amount, currency) : undefined;
  }

  private paymentLabel(appt: Appointment): string {
    if (!this.featureFlagService.paymentsEnabled()) {
      return 'Combinado com a profissional';
    }
    // Preparado para quando os pagamentos entrarem — hoje inatingível.
    switch (appt.status) {
      case 'CONFIRMED':
        return 'Pago';
      case 'PENDING':
      default:
        return 'Combinado com a profissional';
    }
  }

  /** yyyy-MM-dd em hora local — as datas do backend não têm fuso. */
  private static toDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private recurringDates(appt: Appointment, from: Date, limit: Date): Date[] {
    const targetDay = DashboardPageComponent.DOW_JS[appt.dayOfWeek];
    if (targetDay === undefined) return [];

    const start = appt.startDate ? new Date(appt.startDate) : new Date(from);
    start.setHours(0, 0, 0, 0);
    const end = appt.endDate ? new Date(appt.endDate) : new Date(limit);
    end.setHours(23, 59, 59, 999);

    const base = from > start ? new Date(from) : new Date(start);
    const diff = (targetDay - base.getDay() + 7) % 7;
    base.setDate(base.getDate() + diff);

    const finalLimit = end < limit ? end : limit;
    return generateOccurrences(appt.recurrenceFrequency, start, base, finalLimit, 10);
  }

  private oneTimeDates(appt: Appointment): Date[] {
    if (!appt.startDate) return [];
    const d = new Date(appt.startDate);
    d.setHours(0, 0, 0, 0);
    return [d];
  }
}
