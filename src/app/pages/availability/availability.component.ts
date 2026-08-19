import { catchError, forkJoin, map, of, switchMap, throwError, type Observable } from 'rxjs';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  LOCALE_ID,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { MatDialog } from '@angular/material/dialog';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
  ConfirmDialogResult,
} from '../../shared/components/confirm-dialog/confirm-dialog.component';
import {
  ProposeRecurringDialogComponent,
  ProposeRecurringDialogData,
  ProposeRecurringDialogResult,
} from '../../shared/components/propose-recurring-dialog/propose-recurring-dialog.component';
import {
  RescheduleDialogComponent,
  RescheduleDialogData,
  RescheduleDialogResult,
} from '../../shared/components/reschedule-dialog/reschedule-dialog.component';
import { freeSlotsOn } from '../../shared/utils/free-slots.util';
import {
  fromApiEndTime,
  minToTime,
  stripSec,
  timeToMin,
  toApiTime,
} from '../../shared/utils/session-time.util';
import { Modality } from '../../shared/enums/modality.enum';
import { isModalityCompatible, normalizeModality, toBackendModality } from '../../shared/utils/modality-compatibility.util';
import { DayOfWeek } from '../../shared/enums/day-of-week.enum';
import { RecurrenceFrequency } from '../../shared/enums/recurrence-frequency.enum';
import { normalizeRecurrenceFrequency, occursOnDate, toBackendRecurrenceFrequency } from '../../shared/utils/recurrence.util';
import { ProfessionalService } from '../../shared/models/professional-service.model';
import { ApiService, AvailabilityPayload } from '../../core/services/api.service';
import { AvailabilityModel } from '../../shared/models/availability.model';
import { Appointment } from '../../shared/models/appointment.model';
import { ScreenSizeService } from '../../shared/services/screen-size.service';
import { SessionService } from '../../shared/services/session.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { SchedulingService } from '../../shared/services/scheduling.service';
import { SchedulingSteps } from '../../shared/enums/scheduling-steps.enum';
import { SchedulingFormControls } from '../../shared/enums/scheduling-form-controls.enum';
import { ProfessionalSessionService } from '../../shared/enums/professional-session-service.enum';
import { StyledSelectComponent, StyledSelectOption } from '../../shared/components/styled-select/styled-select.component';
import {
  PRICE_MAX,
  PRICE_MIN,
  decimalSeparatorFor,
  formatPriceForEditor,
  moneyLocaleFor,
  parsePriceInput,
  sanitizePriceInput,
  validatePriceInput,
} from '../../shared/utils/price.util';

// ─── Module-level constants ───────────────────────────────────────────────────

const PT_MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];
const PT_DOW_SHORT = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
const PT_DOW_LONG = [
  'segunda-feira','terça-feira','quarta-feira',
  'quinta-feira','sexta-feira','sábado','domingo',
];
const PT_DOW_PLURAL = [
  'Segundas-feiras','Terças-feiras','Quartas-feiras',
  'Quintas-feiras','Sextas-feiras','Sábados','Domingos',
];
/*
 * Limites do dia de atendimento.
 *
 * DAY_END_MIN é a hora a que a última sessão pode terminar, e era 20:00 repetido
 * numa dúzia de sítios ao longo do ficheiro — mexer no horário obrigava a
 * caçá-los todos.
 *
 * O dia fecha à meia-noite, escrita aqui como 24:00 para que a aritmética de
 * minutos continue monótona (00:00 daria zero e punha o fim antes do início).
 * Na fronteira da API troca-se por "00:00", que é o que um LocalTime aceita —
 * ver toApiTime/fromApiTime.
 */
const DAY_START_MIN = 8 * 60;
const DAY_END_MIN = 24 * 60;

/** Uma linha por hora; a última começa uma hora antes do fecho. */
const HOURS = Array.from(
  { length: (DAY_END_MIN - DAY_START_MIN) / 60 },
  (_, i) => minToTime(DAY_START_MIN + i * 60),
);

// O telemóvel mostra as mesmas horas — tinha uma lista própria que já ia até às
// 23:00, mas as linhas para lá do fecho do dia não recebiam blocos nenhuns.
const MOB_HOURS = HOURS;

/** Meias-horas: a última é a que ainda deixa caber a sessão mais curta (30 min). */
const EDITOR_HOURS = Array.from(
  { length: (DAY_END_MIN - DAY_START_MIN) / 30 },
  (_, i) => minToTime(DAY_START_MIN + i * 30),
);
const ROW_H = 52;
const MOB_ROW_H = 80;
const COL_TO_DOW: DayOfWeek[] = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
  DayOfWeek.SUNDAY,
];
const SESSION_DURATIONS = [30, 60, 90] as const;
const WEEKDAYS = COL_TO_DOW;

// ─── Module-level helpers ─────────────────────────────────────────────────────

function getWeekStart(d: Date): Date {
  const day = new Date(d);
  const dow = day.getDay(); // 0=Sun,1=Mon...
  const diff = (dow === 0 ? -6 : 1 - dow); // shift to Monday
  day.setDate(day.getDate() + diff);
  day.setHours(0, 0, 0, 0);
  return day;
}

function hourRowIdx(t: string): number {
  return timeToMin(t) / 60 - 8; // '08:00' → 0
}

function generateSlots(start: string, end: string, dur: number): string[] {
  const startMin = timeToMin(start);
  const endMin = timeToMin(end);
  const count = Math.floor((endMin - startMin) / dur);
  const slots: string[] = [];
  for (let i = 0; i < count; i++) {
    slots.push(minToTime(startMin + i * dur));
  }
  return slots;
}

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Desfecho de uma escrita dentro de um lote que não pode ser atómico. */
type SettledWrite<T> = { ok: true; value: T } | { ok: false };

/**
 * Corre todas as escritas até ao fim e devolve o desfecho de cada uma.
 *
 * Um bloco é gravado como N vagas independentes — não há endpoint que as
 * escreva em conjunto, logo não há transação. Com forkJoin, o primeiro erro
 * aborta e cancela os pedidos irmãos ainda em voo, mas os que já responderam
 * ficaram gravados: sobras invisíveis no servidor que o calendário não mostra
 * e que voltam depois como "já existe uma vaga sobreposta" numa célula que
 * aparenta estar livre. Este operador nunca falha, para que quem chama saiba
 * exatamente o que ficou escrito e o possa limpar.
 */
function settleAll<T>(ops: Observable<T>[]): Observable<SettledWrite<T>[]> {
  if (ops.length === 0) return of([]);
  return forkJoin(
    ops.map(op =>
      op.pipe(
        map((value): SettledWrite<T> => ({ ok: true, value })),
        catchError(() => of<SettledWrite<T>>({ ok: false })),
      ),
    ),
  );
}

// ─── Models ───────────────────────────────────────────────────────────────────

interface DragSelection {
  colIndex: number;
  startTime: string;
  endTime: string;
}

interface PreviewBlock {
  colIndex: number;
  startTime: string;
  endTime: string;
  hasConflict: boolean;
  modality: Modality;
}

interface SlotInfo {
  time: string;
  booked: boolean;
  appointment?: Appointment;
}

interface BackendSlot {
  slotTime: string;
  backendId: number;
}

interface TherapistBlock {
  id: number;
  backendSlots: BackendSlot[];
  services: ProfessionalService[];
  modality: Modality;
  isRecurring: boolean;
  recurrenceFrequency?: RecurrenceFrequency;
  weekdays: DayOfWeek[];
  // Anchor date. Populated for BOTH recurring blocks (needed to compute
  // biweekly/monthly occurrence per displayed week) and one-time blocks
  // (the actual calendar date).
  startDate?: string;
  startTime: string;
  endTime: string;
  sessionDuration: 30 | 60 | 90;
  local?: string;
  platform?: string;
  price?: number;
  priceBRL?: number;
}

// ─── Backend → frontend enum maps ─────────────────────────────────────────────

const BACKEND_DOW_MAP: Record<string, DayOfWeek> = {
  MONDAY: DayOfWeek.MONDAY,
  TUESDAY: DayOfWeek.TUESDAY,
  WEDNESDAY: DayOfWeek.WEDNESDAY,
  THURSDAY: DayOfWeek.THURSDAY,
  FRIDAY: DayOfWeek.FRIDAY,
  SATURDAY: DayOfWeek.SATURDAY,
  SUNDAY: DayOfWeek.SUNDAY,
};

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-availability',
  standalone: true,
  imports: [CommonModule, NgTemplateOutlet, StyledSelectComponent],
  templateUrl: './availability.component.html',
  styleUrl: './availability.component.scss',
  animations: [
    // Sections that only appear conditionally in the block editor (Repete-se,
    // Dias da semana, Local, Plataforma, Data) fade + grow in instead of
    // popping in abruptly, and reverse the same way when they disappear.
    trigger('revealSection', [
      transition(':enter', [
        style({ opacity: 0, height: 0, overflow: 'hidden' }),
        animate('220ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 1, height: '*' })),
      ]),
      transition(':leave', [
        style({ opacity: 1, height: '*', overflow: 'hidden' }),
        animate('180ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 0, height: 0 })),
      ]),
    ]),
  ],
})
export class AvailabilityComponent implements OnInit, AfterViewInit {
  // ─ Services
  private readonly apiService = inject(ApiService);
  private readonly snackbarService = inject(SnackbarService);
  private readonly schedulingService = inject(SchedulingService);
  readonly screenSize = inject(ScreenSizeService);
  private readonly sessionService = inject(SessionService);
  private readonly dialog = inject(MatDialog);
  private readonly locale = inject(LOCALE_ID);

  // ─ Expose to template
  readonly HOURS = HOURS;
  readonly MOB_HOURS = MOB_HOURS;
  readonly EDITOR_HOURS = EDITOR_HOURS;
  readonly ROW_H = ROW_H;
  readonly MOB_ROW_H = MOB_ROW_H;
  readonly Modality = Modality;
  readonly DayOfWeek = DayOfWeek;
  readonly RecurrenceFrequency = RecurrenceFrequency;
  readonly RECURRENCE_PATTERNS: RecurrenceFrequency[] = [
    RecurrenceFrequency.WEEKLY, RecurrenceFrequency.BIWEEKLY, RecurrenceFrequency.MONTHLY,
  ];
  readonly PT_DOW_SHORT = PT_DOW_SHORT;
  readonly SESSION_DURATIONS = SESSION_DURATIONS;
  readonly WEEKDAYS = WEEKDAYS;
  readonly PT_MONTHS = PT_MONTHS;
  readonly PT_DOW_LONG = PT_DOW_LONG;

  // ─ Week navigation
  weekStart = signal<Date>(getWeekStart(new Date()));

  readonly weekDays = computed<Date[]>(() => {
    const start = this.weekStart();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  });

  readonly weekLabel = computed<string>(() => {
    const days = this.weekDays();
    const first = days[0];
    const last = days[6];
    const firstDay = first.getDate();
    const lastDay = last.getDate();
    const month = PT_MONTHS[last.getMonth()];
    const year = last.getFullYear();
    return `${firstDay} – ${lastDay} ${month} · ${year}`;
  });

  readonly monthLabel = computed<string>(() => {
    const start = this.weekStart();
    return PT_MONTHS[start.getMonth()];
  });

  readonly weekRangeLabel = computed<string>(() => {
    const days = this.weekDays();
    const first = days[0];
    const last = days[6];
    return `semana ${first.getDate()}–${last.getDate()}`;
  });

  // ─ Data
  services = signal<ProfessionalService[]>([]);
  appointments = signal<Appointment[]>([]);

  private _nextId = 0;

  blocks = signal<TherapistBlock[]>([]);

  selectedBlockId = signal<number | null>(null);
  selectedAppointment = signal<Appointment | null>(null);

  // ─ Notas para a pessoa cliente, no painel de detalhe da sessão selecionada
  notesDraft = signal('');
  notesSaving = signal(false);

  // ─ Editor state
  selectedServiceIds = signal<Set<number>>(new Set());
  editorModality = signal<Modality>(Modality.ANY);
  editorFrequency = signal<'once' | 'weekly'>('weekly');
  editorRecurrencePattern = signal<RecurrenceFrequency>(RecurrenceFrequency.WEEKLY);
  selectedWeekdays = signal<Set<DayOfWeek>>(new Set());
  editorDate = signal<string>('');
  editorStartTime = signal<string>('09:00');
  editorEndTime = signal<string>('13:00');
  editorSessionDuration = signal<30 | 60 | 90>(60);
  editorLocal = signal<string>('');
  editorPlatform = signal<string>('');
  editorPrice = signal<string>('');
  editorPriceBRL = signal<string>('');

  // Required-field errors only surface after a save attempt, so a freshly opened
  // (empty) editor doesn't greet the user with a wall of red text.
  attemptedSave = signal<boolean>(false);

  readonly serviceErrorMessage = computed<string | null>(() => {
    if (!this.attemptedSave()) return null;
    return this.selectedServiceIds().size === 0 ? 'Selecione pelo menos um serviço.' : null;
  });

  readonly localErrorMessage = computed<string | null>(() => {
    if (!this.attemptedSave() || this.isEditingLockedBlock()) return null;
    if (this.editorModality() === Modality.REMOTE) return null;
    return this.editorLocal().trim() === '' ? 'Indique o local do atendimento.' : null;
  });

  readonly platformErrorMessage = computed<string | null>(() => {
    if (!this.attemptedSave() || this.isEditingLockedBlock()) return null;
    if (this.editorModality() === Modality.LOCAL) return null;
    return this.editorPlatform().trim() === '' ? 'Indique a plataforma a usar.' : null;
  });

  readonly weekdayErrorMessage = computed<string | null>(() => {
    if (!this.attemptedSave()) return null;
    if (this.editorFrequency() !== 'weekly') return null;
    return this.selectedWeekdays().size === 0 ? 'Selecione pelo menos um dia da semana.' : null;
  });

  readonly dateErrorMessage = computed<string | null>(() => {
    if (!this.attemptedSave()) return null;
    if (this.editorFrequency() !== 'once') return null;
    return this.editorDate().trim() === '' ? 'Selecione uma data.' : null;
  });

  // ─ Money fields (Valor): currency + locale-aware formatting/validation.
  // EUR is the primary, required price; BRL is a second, independently-set price
  // (not a conversion) for professionals who also charge clients in Brazil.
  private readonly CURRENCY = 'EUR';
  private readonly CURRENCY_BRL = 'BRL';
  private readonly PRICE_MIN = PRICE_MIN;
  private readonly PRICE_MAX = PRICE_MAX;
  private readonly decimalSeparator = decimalSeparatorFor(this.locale);

  private readonly money = moneyLocaleFor(this.locale, this.CURRENCY);
  readonly currencySymbol = this.money.symbol;
  readonly currencyIsPrefix = this.money.isPrefix;
  readonly pricePlaceholder = this.money.placeholder;

  private readonly moneyBRL = moneyLocaleFor(this.locale, this.CURRENCY_BRL);
  readonly currencySymbolBRL = this.moneyBRL.symbol;
  readonly currencyIsPrefixBRL = this.moneyBRL.isPrefix;
  readonly pricePlaceholderBRL = this.moneyBRL.placeholder;

  readonly priceErrorMessage = computed<string | null>(() => {
    if (!this.attemptedSave() || this.isEditingLockedBlock()) return null;
    return validatePriceInput(this.editorPrice(), {
      locale: this.locale, currency: this.CURRENCY, separator: this.decimalSeparator, required: true,
    });
  });

  // BRL is optional — a professional who doesn't bill in Reais just leaves it blank.
  readonly priceBRLErrorMessage = computed<string | null>(() => {
    if (!this.attemptedSave() || this.isEditingLockedBlock()) return null;
    return validatePriceInput(this.editorPriceBRL(), {
      locale: this.locale, currency: this.CURRENCY_BRL, separator: this.decimalSeparator, required: false,
    });
  });

  // ─ Date picker calendar (editor)
  readonly edCalWeekdays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  edCalOpen = signal<boolean>(false);
  edCalViewDate = signal<Date>(new Date());
  readonly edCalMonthLabel = computed(() => {
    const d = this.edCalViewDate();
    return `${PT_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  });
  readonly edCalDays = computed(() => {
    const view = this.edCalViewDate();
    const year = view.getFullYear();
    const month = view.getMonth();
    const offset = new Date(year, month, 1).getDay();
    const days: Array<{ date: Date; inMonth: boolean; key: string }> = [];
    for (let i = offset - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, inMonth: false, key: toKey(d) });
    }
    const total = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= total; i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, inMonth: true, key: toKey(d) });
    }
    while (days.length < 42) {
      const prev = days[days.length - 1].date;
      const d = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 1);
      days.push({ date: d, inMonth: false, key: toKey(d) });
    }
    return days;
  });

  // ─ Mobile
  selectedDayIndex = signal<number>(this._todayColumnIndex());
  sheetOpen = signal<boolean>(false);
  mobileWeekNavOpen = signal<boolean>(false);

  // ─ Mobile FAB (floating "+" over the day grid)
  //
  // position:sticky can't do this here: it needs an ancestor that actually
  // scrolls internally, but this app scrolls the whole window (see
  // header-scroll.directive.ts, which listens to window:scroll the same
  // way) - .m-agenda's overflow-y:auto never gets a bounded height from its
  // ancestors to make that overflow real, so nothing ever sticks. This
  // reimplements the same "clamped to the grid, tracks the viewport
  // otherwise" behaviour by hand, against the scroll that's actually
  // happening.
  @ViewChild('mobTl') private readonly mobTlRef?: ElementRef<HTMLElement>;
  private readonly FAB_SIZE = 58;
  private readonly FAB_MARGIN = 16;
  fabTop = signal<number>(0);

  @HostListener('window:scroll')
  @HostListener('window:resize')
  updateFabPosition(): void {
    const grid = this.mobTlRef?.nativeElement;
    if (!grid) return;
    const rect = grid.getBoundingClientRect();
    const natural = window.innerHeight - this.FAB_SIZE - this.FAB_MARGIN;
    // A mesma margem do "chão" viewport também se aplica ao chão da grelha -
    // sem isto o botão, ao assentar, ficava com a base encostada mesmo ao
    // fim de .m-tl em vez de guardar a mesma folga que tem em qualquer
    // outro ponto do scroll.
    const floor = rect.bottom - this.FAB_SIZE - this.FAB_MARGIN;
    const clamped = Math.min(Math.max(natural, rect.top), floor);
    this.fabTop.set(clamped);
  }

  // ─ Drag-select
  dragSelection = signal<DragSelection | null>(null);

  // ─ Block move
  movingBlockId = signal<number | null>(null);
  isDraggingMove = signal<boolean>(false);
  moveLiveStart = signal<string>('');
  moveLiveEnd = signal<string>('');
  moveLiveCol = signal<number>(0);
  moveLiveConflict = signal<boolean>(false);

  readonly movingBlock = computed(() => {
    const id = this.movingBlockId();
    return id !== null ? (this.blocks().find(b => b.id === id) ?? null) : null;
  });

  readonly ghostSlotTimes = computed(() => {
    const block = this.movingBlock();
    if (!block) return [];
    return generateSlots(this.moveLiveStart(), this.moveLiveEnd(), block.sessionDuration);
  });

  // ─ Resize (bottom)
  resizingBlockId = signal<number | null>(null);
  resizeLiveEndTime = signal<string>('');
  private _resizeBlock: TherapistBlock | null = null;
  private _resizeColEl: HTMLElement | null = null;
  private _resizeRowH = ROW_H;
  private _resizeDragged = false;

  // ─ Resize (top)
  resizingTopBlockId = signal<number | null>(null);
  resizeLiveStartTime = signal<string>('');
  private _resizeTopBlock: TherapistBlock | null = null;
  private _resizeTopColEl: HTMLElement | null = null;
  private _resizeTopRowH = ROW_H;
  private _resizeTopDragged = false;

  // ─ Preview move
  isMovingPreview = signal<boolean>(false);
  previewMoveLiveStart = signal<string>('');
  previewMoveLiveEnd = signal<string>('');
  previewMoveLiveCol = signal<number>(0);

  // ─ Computed
  readonly selectedBlock = computed(() =>
    this.blocks().find(b => b.id === this.selectedBlockId()) ?? null,
  );

  // Once a block has bookings, Local/Plataforma/Valor are locked and disabled - their
  // validation must not fire (or show as errors) since the user has no way to fix them.
  readonly isEditingLockedBlock = computed<boolean>(() => {
    const block = this.selectedBlock();
    return !!block && this.hasBookings(block);
  });

  readonly generatedSlots = computed(() =>
    generateSlots(
      this.editorStartTime(),
      this.editorEndTime(),
      this.editorSessionDuration(),
    ),
  );

  readonly editorStartTimeOptions = computed<string[]>(() => {
    const dur = this.editorSessionDuration();
    return EDITOR_HOURS.filter(h => timeToMin(h) + dur <= DAY_END_MIN);
  });

  readonly editorEndTimeOptions = computed<string[]>(() => {
    const startMin = timeToMin(this.editorStartTime());
    const dur = this.editorSessionDuration();
    const opts: string[] = [];
    for (let n = 1; startMin + n * dur <= DAY_END_MIN; n++) {
      opts.push(minToTime(startMin + n * dur));
    }
    return opts;
  });

  readonly editorStartTimeSelectOptions = computed<StyledSelectOption[]>(() =>
    this.editorStartTimeOptions().map(h => ({ value: h, label: h })),
  );

  readonly editorEndTimeSelectOptions = computed<StyledSelectOption[]>(() =>
    this.editorEndTimeOptions().map(h => ({ value: h, label: h })),
  );

  readonly editorTitle = computed<string>(() => {
    if (this.editorFrequency() === 'weekly') {
      const wds = [...this.selectedWeekdays()];
      if (wds.length === 0) return 'Novo bloco';
      const idx = COL_TO_DOW.indexOf(wds[0]);
      const name = idx >= 0 ? PT_DOW_LONG[idx] : wds[0].toLowerCase();
      return wds.length === 1
        ? `Disponibilidade de ${name}`
        : `Disponibilidade de ${wds.length} dias`;
    } else {
      if (!this.editorDate()) return 'Nova disponibilidade';
      const d = new Date(this.editorDate() + 'T00:00:00');
      const dow = PT_DOW_LONG[(d.getDay() + 6) % 7];
      return `Disponibilidade de ${dow}`;
    }
  });

  readonly editorSubtitle = computed<string>(() => {
    const start = this.editorStartTime();
    const end = this.editorEndTime();
    const timeRange = start && end ? ` · das ${start} às ${end}` : '';

    if (this.editorFrequency() === 'weekly') {
      const wds = [...this.selectedWeekdays()];
      if (wds.length === 0) return this.editorRecurrencePattern();
      const days = wds.map(wd => {
        const idx = COL_TO_DOW.indexOf(wd);
        return idx >= 0 ? PT_DOW_PLURAL[idx] : wd;
      });
      const label = wds.length === 1 ? days[0] : days.join(', ');
      return label + timeRange;
    } else {
      if (!this.editorDate()) return 'Data única';
      const d = new Date(this.editorDate() + 'T00:00:00');
      const day = d.getDate();
      const month = PT_MONTHS[d.getMonth()];
      const year = d.getFullYear();
      return `${day} de ${month} · ${year}${timeRange}`;
    }
  });

  readonly previewBlocks = computed<PreviewBlock[]>(() => {
    const startTime = this.editorStartTime();
    const endTime = this.editorEndTime();
    if (timeToMin(endTime) <= timeToMin(startTime)) return [];

    const frequency = this.editorFrequency();
    const modality = this.editorModality();
    const colIndices: number[] = [];

    if (frequency === 'weekly') {
      for (const wd of this.selectedWeekdays()) {
        const idx = COL_TO_DOW.indexOf(wd);
        if (idx >= 0) colIndices.push(idx);
      }
    } else {
      const dateStr = this.editorDate();
      if (!dateStr) return [];
      const idx = this.weekDays().findIndex(d => toKey(d) === dateStr);
      if (idx >= 0) colIndices.push(idx);
    }

    if (colIndices.length === 0) return [];

    const startMin = timeToMin(startTime);
    const endMin = timeToMin(endTime);
    const editingId = this.selectedBlockId();

    return colIndices.map(colIdx => {
      const hasConflict = this.blocksForColumn(colIdx)
        // Um bloco que não ocorre nesta semana não ocupa nada nesta semana:
        // aquele horário está livre e tem de poder receber outra vaga.
        .filter(b => b.id !== editingId && this.isBlockOccurring(b, colIdx))
        .some(b => startMin < timeToMin(b.endTime) && timeToMin(b.startTime) < endMin);
      return { colIndex: colIdx, startTime, endTime, hasConflict, modality };
    });
  });

  readonly conflictedBlockIds = computed<Set<number>>(() => {
    const previews = this.previewBlocks();
    if (previews.length === 0) return new Set<number>();
    const editingId = this.selectedBlockId();
    const ids = new Set<number>();
    for (const p of previews) {
      const pStart = timeToMin(p.startTime);
      const pEnd = timeToMin(p.endTime);
      for (const b of this.blocksForColumn(p.colIndex)) {
        if (!this.isBlockOccurring(b, p.colIndex)) continue;
        if (b.id !== editingId && pStart < timeToMin(b.endTime) && timeToMin(b.startTime) < pEnd) {
          ids.add(b.id);
        }
      }
    }
    return ids;
  });

  // ─ Lifecycle ────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.apiService.getServices().subscribe({
      next: (svcs) => { if (svcs?.length) this.services.set(svcs); },
      error: () => {},
    });

    const userId = this.sessionService.user()?.id;
    if (userId) {
      this.apiService.getAvailabilitiesByProfessionalId(userId).subscribe({
        next: (avails) => this.blocks.set(this.groupAvailabilitiesIntoBlocks(avails)),
        error: () => {},
      });
      this.apiService.getProfessionalAppointments(userId).subscribe({
        next: (appts) => {
          this.appointments.set(appts.map(a => ({
            ...a,
            startTime: stripSec(a.startTime),
            endTime: fromApiEndTime(a.endTime),
          })));
        },
        error: () => {},
      });
    }
  }

  ngAfterViewInit(): void {
    // #mobTl only exists once the mobile branch has actually rendered -
    // harmless no-op (see the guard in updateFabPosition) on desktop.
    this.updateFabPosition();
  }

  // ─ Week navigation ──────────────────────────────────────────────────────────

  calSlideClass = signal<string>('');

  goToToday(): void {
    const today = getWeekStart(new Date());
    const cur = this.weekStart();
    if (today.getTime() === cur.getTime()) return;
    this.animateToWeek(today, today > cur ? 'left' : 'right');
  }

  prevWeek(): void {
    const d = new Date(this.weekStart());
    d.setDate(d.getDate() - 7);
    this.animateToWeek(d, 'right');
  }

  nextWeek(): void {
    const d = new Date(this.weekStart());
    d.setDate(d.getDate() + 7);
    this.animateToWeek(d, 'left');
  }

  onEditorDateChange(dateStr: string): void {
    this.editorDate.set(dateStr);
    if (!dateStr) return;
    const isInCurrentWeek = this.weekDays().some(d => toKey(d) === dateStr);
    if (isInCurrentWeek) return;
    const target = new Date(dateStr + 'T00:00:00');
    const newStart = getWeekStart(target);
    this.animateToWeek(newStart, newStart > this.weekStart() ? 'left' : 'right');
  }

  @HostListener('document:click')
  onDocClick(): void { this.edCalOpen.set(false); }

  edCalToggle(event: MouseEvent): void {
    event.stopPropagation();
    const sel = this.selectedBlock();
    if (sel && this.hasBookings(sel)) return;
    const wasOpen = this.edCalOpen();
    if (!wasOpen) {
      const selected = this.editorDate();
      if (selected) this.edCalViewDate.set(new Date(selected + 'T00:00:00'));
    }
    this.edCalOpen.set(!wasOpen);
  }

  edCalPrevMonth(): void {
    const d = this.edCalViewDate();
    this.edCalViewDate.set(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  edCalNextMonth(): void {
    const d = this.edCalViewDate();
    this.edCalViewDate.set(new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  edCalSelectDate(key: string): void {
    const sel = this.selectedBlock();
    if (sel && this.hasBookings(sel)) return;
    this.edCalOpen.set(false);
    this.onEditorDateChange(key);
  }

  edCalIsPast(date: Date): boolean {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return date < t;
  }

  edCalIsToday(date: Date): boolean {
    const t = new Date();
    return date.getFullYear() === t.getFullYear() &&
      date.getMonth() === t.getMonth() &&
      date.getDate() === t.getDate();
  }

  edCalFmtDate(key: string): string {
    if (!key) return '';
    const [y, m, d] = key.split('-');
    return `${d}/${m}/${y}`;
  }

  private animateToWeek(newStart: Date, dir: 'left' | 'right'): void {
    const exitCls = dir === 'left' ? 'cal-exit-left' : 'cal-exit-right';
    const enterCls = dir === 'left' ? 'cal-enter-right' : 'cal-enter-left';
    this.calSlideClass.set(exitCls);
    setTimeout(() => {
      this.weekStart.set(newStart);
      this.calSlideClass.set(enterCls);
      setTimeout(() => this.calSlideClass.set(''), 280);
    }, 220);
  }

  // ─ Calendar helpers ─────────────────────────────────────────────────────────

  blocksForColumn(colIndex: number): TherapistBlock[] {
    const dow = COL_TO_DOW[colIndex];
    const dayDate = this.weekDays()[colIndex];
    const dayKey = toKey(dayDate);
    return this.blocks().filter(b => {
      if (b.isRecurring) {
        return b.weekdays.includes(dow);
      } else {
        return b.startDate === dayKey;
      }
    });
  }

  // Weekly blocks occur on their weekday every week; biweekly/monthly blocks
  // only occur some weeks - this decides whether the currently displayed week
  // is one of them, so the template can render a dimmed "ghost" otherwise.
  isBlockOccurring(block: TherapistBlock, colIndex: number): boolean {
    if (!block.isRecurring || !block.startDate) return true;
    const anchor = new Date(block.startDate + 'T00:00:00');
    const candidate = this.weekDays()[colIndex];
    return occursOnDate(block.recurrenceFrequency, anchor, candidate);
  }

  blockTopPx(block: TherapistBlock, rowH: number = ROW_H): number {
    return hourRowIdx(block.startTime) * rowH + 3;
  }

  blockHeightPx(block: TherapistBlock, rowH: number = ROW_H): number {
    return (hourRowIdx(block.endTime) - hourRowIdx(block.startTime)) * rowH - 6;
  }

  blockResizeHeightPx(block: TherapistBlock, liveEndTime: string, rowH = ROW_H): number {
    return (hourRowIdx(liveEndTime) - hourRowIdx(block.startTime)) * rowH - 6;
  }

  previewBlocksForColumn(colIndex: number): PreviewBlock[] {
    return this.previewBlocks().filter(p => p.colIndex === colIndex);
  }

  mobileDayPreview(): PreviewBlock[] {
    return this.previewBlocks().filter(p => p.colIndex === this.selectedDayIndex());
  }

  previewTopPx(startTime: string, rowH = ROW_H): number {
    return hourRowIdx(startTime) * rowH + 3;
  }

  previewHeightPx(startTime: string, endTime: string, rowH = ROW_H): number {
    return (hourRowIdx(endTime) - hourRowIdx(startTime)) * rowH - 6;
  }

  blockSlotCount(block: TherapistBlock): number {
    return Math.floor(
      (timeToMin(block.endTime) - timeToMin(block.startTime)) / block.sessionDuration,
    );
  }

  serviceDisplayName(key: string): string {
    return ProfessionalSessionService[key as keyof typeof ProfessionalSessionService] ?? key;
  }

  blockServiceLabel(block: TherapistBlock): string {
    if (block.services.length === 0) return '';
    const first = this.serviceDisplayName(block.services[0].name);
    if (block.services.length === 1) return first;
    return `${first} +${block.services.length - 1}`;
  }

  // ─ Selection / editor ───────────────────────────────────────────────────────

  selectBlock(event: Event, block: TherapistBlock): void {
    event.stopPropagation();
    this.selectedBlockId.set(block.id);
    this.selectedAppointment.set(null);
    this.attemptedSave.set(false);
    this.loadBlockIntoEditor(block);
    // No desktop this abre-se sempre no mesmo sítio (a coluna à direita);
    // no telemóvel esse conteúdo só existe dentro da folha inferior.
    this.sheetOpen.set(true);
  }

  loadBlockIntoEditor(block: TherapistBlock): void {
    this.selectedServiceIds.set(new Set(block.services.map(s => s.id)));
    this.editorModality.set(block.modality);
    this.editorFrequency.set(block.isRecurring ? 'weekly' : 'once');
    this.editorRecurrencePattern.set(block.recurrenceFrequency ?? RecurrenceFrequency.WEEKLY);
    this.selectedWeekdays.set(new Set(block.weekdays));
    this.editorDate.set(block.isRecurring ? '' : (block.startDate ?? ''));
    this.editorStartTime.set(block.startTime);
    this.editorEndTime.set(block.endTime);
    this.editorSessionDuration.set(block.sessionDuration);
    this.editorLocal.set(block.local ?? '');
    this.editorPlatform.set(block.platform ?? '');
    this.editorPrice.set(formatPriceForEditor(block.price, this.decimalSeparator));
    this.editorPriceBRL.set(formatPriceForEditor(block.priceBRL, this.decimalSeparator));
  }

  startMove(event: PointerEvent, block: TherapistBlock, colIndex: number): void {
    if ((event.target as HTMLElement).closest('.b-resize-handle')) return;
    if ((event.target as HTMLElement).closest('.b-resize-handle-top')) return;
    if (this.hasBookings(block)) { this.selectBlock(event, block); return; }

    const blockEl = event.currentTarget as HTMLElement;
    const daycol = blockEl.parentElement as HTMLElement;
    const weekGrid = daycol.parentElement as HTMLElement;

    const colEls = Array.from(weekGrid.querySelectorAll<HTMLElement>('.daycol'));
    const colRects = colEls.map(el => el.getBoundingClientRect());
    const colTopY = colRects[colIndex].top;

    const blockRect = blockEl.getBoundingClientRect();
    const grabOffsetMin = Math.max(0, (event.clientY - blockRect.top) / ROW_H * 60);
    const durationMin = timeToMin(block.endTime) - timeToMin(block.startTime);

    let moved = false;

    this.movingBlockId.set(block.id);
    this.moveLiveStart.set(block.startTime);
    this.moveLiveEnd.set(block.endTime);
    this.moveLiveCol.set(colIndex);

    blockEl.setPointerCapture(event.pointerId);

    const onMove = (e: PointerEvent) => {
      if (!moved) {
        moved = true;
        this.isDraggingMove.set(true);
      }

      let newCol = colIndex;
      for (let i = 0; i < colRects.length; i++) {
        if (e.clientX >= colRects[i].left && e.clientX < colRects[i].right) { newCol = i; break; }
      }
      if (e.clientX < colRects[0].left) newCol = 0;
      if (e.clientX >= colRects[colRects.length - 1].right) newCol = colRects.length - 1;

      const anchoredStart = (e.clientY - colTopY) / ROW_H * 60 + DAY_START_MIN - grabOffsetMin;
      const snapped = Math.round(anchoredStart / 30) * 30;
      const clampedStart = Math.max(DAY_START_MIN, Math.min(DAY_END_MIN - durationMin, snapped));

      this.moveLiveCol.set(newCol);
      this.moveLiveStart.set(minToTime(clampedStart));
      this.moveLiveEnd.set(minToTime(clampedStart + durationMin));
      this.moveLiveConflict.set(
        this._hasMoveConflict(block.id, newCol, minToTime(clampedStart), minToTime(clampedStart + durationMin))
      );
    };

    const onUp = () => {
      blockEl.removeEventListener('pointermove', onMove);
      blockEl.removeEventListener('pointerup', onUp);
      blockEl.removeEventListener('pointercancel', onUp);

      const newCol = this.moveLiveCol();
      const newStart = this.moveLiveStart();
      const newEnd = this.moveLiveEnd();
      const hasConflict = this.moveLiveConflict();

      this.movingBlockId.set(null);
      this.isDraggingMove.set(false);
      this.moveLiveConflict.set(false);

      if (!moved) return;

      document.addEventListener('click', e => e.stopPropagation(), { once: true, capture: true });

      if (hasConflict) return;

      if (newStart === block.startTime && newEnd === block.endTime && newCol === colIndex) return;

      const newWeekday = COL_TO_DOW[newCol];
      // Uma vaga pontual muda para a data real da coluna de destino. Uma
      // recorrente reancora dentro da semana da própria âncora - a data que
      // for enviada passa a mandar no dia da semana da série no backend, e
      // usar a semana em vista trocaria as semanas em que ela ocorre.
      const newDate = block.isRecurring
        ? this.reanchorRecurring(block, newWeekday)
        : this.dateForWeekday(newWeekday);
      const updated: TherapistBlock = {
        ...block,
        startTime: newStart,
        endTime: newEnd,
        weekdays: block.isRecurring ? [newWeekday] : [],
        // Tem de ser a mesma data que segue no payload: guardar a antiga aqui
        // deixava o ecrã a discordar do backend até ao próximo carregamento.
        startDate: newDate,
      };
      this.blocks.update(bs => bs.map(b => b.id === block.id ? updated : b));
      this._invalidateSchedulingCache();

      if (block.backendSlots.length > 0) {
        const dur = block.sessionDuration;
        const slotTimes = generateSlots(newStart, newEnd, dur);
        // UPDATE each existing slot record in place (duration is preserved during a move,
        // so slot count never changes). Avoids delete+create race conditions.
        const updateOps = block.backendSlots.map((s, i) => {
          const slotStart = slotTimes[i] ?? s.slotTime;
          const slotEnd = minToTime(timeToMin(slotStart) + dur);
          return this.apiService.updateAvailability(s.backendId,
            this.buildSlotPayload(block.services, block.modality, block.isRecurring, newDate, slotStart, slotEnd, block.platform, block.local, block.price, block.priceBRL, block.recurrenceFrequency),
          );
        });
        forkJoin(updateOps).subscribe({
          next: (results) => {
            const newSlots: BackendSlot[] = block.backendSlots.map((s, i) => ({
              ...s,
              slotTime: slotTimes[i] ?? s.slotTime,
            }));
            this.blocks.update(bs => bs.map(b =>
              b.id === block.id ? { ...b, backendSlots: newSlots } : b,
            ));
          },
          error: () => this._resyncBlocksFromServer(
            'Não foi possível mover a disponibilidade. Confirme a agenda.',
          ),
        });
      }
    };

    blockEl.addEventListener('pointermove', onMove);
    blockEl.addEventListener('pointerup', onUp);
    blockEl.addEventListener('pointercancel', onUp);
  }

  private _hasMoveConflict(excludeId: number, colIndex: number, startTime: string, endTime: string): boolean {
    const startMin = timeToMin(startTime);
    const endMin = timeToMin(endTime);
    return this.blocksForColumn(colIndex).some(b =>
      b.id !== excludeId &&
      this.isBlockOccurring(b, colIndex) &&
      startMin < timeToMin(b.endTime) &&
      timeToMin(b.startTime) < endMin,
    );
  }

  startDragSelect(event: PointerEvent, colIndex: number): void {
    if ((event.target as HTMLElement).closest('.block, .b-resize-handle')) return;
    event.preventDefault();

    const hcell = event.currentTarget as HTMLElement;
    const daycol = hcell.parentElement as HTMLElement;
    const colRect = daycol.getBoundingClientRect();

    const anchorMin = this._yToSnappedMin(event.clientY - colRect.top, ROW_H);
    const minDuration = this.editorSessionDuration();
    let dragMoved = false;

    this.dragSelection.set({
      colIndex,
      startTime: minToTime(anchorMin),
      endTime: minToTime(Math.min(anchorMin + 60, DAY_END_MIN)),
    });

    hcell.setPointerCapture(event.pointerId);

    const onMove = (e: PointerEvent) => {
      const currentMin = this._yToSnappedMin(e.clientY - colRect.top, ROW_H);
      if (currentMin !== anchorMin) dragMoved = true;
      const lo = Math.max(DAY_START_MIN, Math.min(anchorMin, currentMin));
      const rawHi = Math.min(DAY_END_MIN, Math.max(lo + minDuration, currentMin));
      const sessions = Math.max(1, Math.round((rawHi - lo) / minDuration));
      const hi = Math.min(DAY_END_MIN, lo + sessions * minDuration);
      this.dragSelection.set({ colIndex, startTime: minToTime(lo), endTime: minToTime(hi) });
    };

    const onUp = () => {
      hcell.removeEventListener('pointermove', onMove);
      hcell.removeEventListener('pointerup', onUp);
      hcell.removeEventListener('pointercancel', onUp);

      const sel = this.dragSelection();
      this.dragSelection.set(null);
      if (!sel) return;

      if (dragMoved) {
        document.addEventListener('click', e => e.stopPropagation(), { once: true, capture: true });
      }

      this.resetEditor();
      this.selectedServiceIds.set(new Set(this.services().map(s => s.id)));
      this.selectedWeekdays.set(new Set([COL_TO_DOW[colIndex]]));
      this.editorFrequency.set('weekly');
      this.editorStartTime.set(sel.startTime);
      this.editorEndTime.set(sel.endTime);
      this._snapTimeRange(this.editorSessionDuration());
    };

    hcell.addEventListener('pointermove', onMove);
    hcell.addEventListener('pointerup', onUp);
    hcell.addEventListener('pointercancel', onUp);
  }

  setEditorFrequency(freq: 'once' | 'weekly'): void {
    if (freq === this.editorFrequency()) return;
    const sel = this.selectedBlock();
    if (sel && this.hasBookings(sel)) return;

    if (freq === 'once') {
      // Carry the day over: map first selected weekday → its actual date in the visible week
      const wds = [...this.selectedWeekdays()];
      const colIdx = wds.length > 0 ? COL_TO_DOW.indexOf(wds[0]) : -1;
      if (colIdx >= 0) {
        this.editorDate.set(toKey(this.weekDays()[colIdx]));
      }
    } else {
      // Carry the day over: map editorDate → weekday column
      const dateStr = this.editorDate();
      if (dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        const dow = COL_TO_DOW[(d.getDay() + 6) % 7];
        if (dow) this.selectedWeekdays.set(new Set([dow]));
        // Navigate to that week if it's not the one currently shown
        const newStart = getWeekStart(d);
        if (newStart.getTime() !== this.weekStart().getTime()) {
          this.animateToWeek(newStart, newStart > this.weekStart() ? 'left' : 'right');
        }
      }
    }

    this.editorFrequency.set(freq);
  }

  private _yToSnappedMin(y: number, rowH: number): number {
    const raw = (y / rowH + 8) * 60;
    const snapped = Math.round(raw / 30) * 30;
    return Math.max(DAY_START_MIN, Math.min(DAY_END_MIN, snapped));
  }

  resetEditor(): void {
    this.selectedBlockId.set(null);
    this.selectedAppointment.set(null);
    this.selectedServiceIds.set(new Set());
    this.editorModality.set(Modality.ANY);
    this.editorFrequency.set('weekly');
    this.selectedWeekdays.set(new Set());
    this.editorDate.set('');
    this.editorStartTime.set('09:00');
    this.editorEndTime.set('13:00');
    this.editorSessionDuration.set(60);
    this.editorLocal.set('');
    this.editorPlatform.set('');
    this.editorPrice.set('');
    this.editorPriceBRL.set('');
    this.attemptedSave.set(false);
  }

  // Blocks invalid keystrokes outright (letters, extra dots/commas, a 3rd decimal digit).
  // onPriceInput below is kept as a fallback sanitizer for paste/autofill/drag-drop.
  onPriceKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const navigationKeys = [
      'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End',
    ];
    if (navigationKeys.includes(event.key)) return;

    const input = event.target as HTMLInputElement;
    const value = input.value;
    const selStart = input.selectionStart ?? value.length;
    const selEnd = input.selectionEnd ?? value.length;
    const hasSelection = selEnd > selStart;

    if (event.key === this.decimalSeparator) {
      if (value.includes(this.decimalSeparator) && !hasSelection) event.preventDefault();
      return;
    }

    if (!/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      return;
    }

    const sepIdx = value.indexOf(this.decimalSeparator);
    if (!hasSelection && sepIdx !== -1 && selStart > sepIdx) {
      const decimals = value.slice(sepIdx + 1);
      if (decimals.length >= 2) event.preventDefault();
    }
  }

  onPriceInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.editorPrice.set(sanitizePriceInput(raw, this.decimalSeparator));
  }

  onPriceBRLInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.editorPriceBRL.set(sanitizePriceInput(raw, this.decimalSeparator));
  }

  toggleService(id: number): void {
    const sel = this.selectedBlock();
    if (sel && this.hasBookings(sel)) return;
    const set = new Set(this.selectedServiceIds());
    if (set.has(id)) {
      set.delete(id);
    } else {
      set.add(id);
    }
    this.selectedServiceIds.set(set);
  }

  isServiceEligible(svc: ProfessionalService): boolean {
    return isModalityCompatible(svc.modality, this.editorModality());
  }

  setEditorModality(m: Modality): void {
    const sel = this.selectedBlock();
    if (sel && this.hasBookings(sel)) return;
    this.editorModality.set(m);
    const eligibleIds = new Set(
      this.services().filter(s => isModalityCompatible(s.modality, m)).map(s => s.id),
    );
    this.selectedServiceIds.update(ids => new Set([...ids].filter(id => eligibleIds.has(id))));
  }

  setEditorSessionDuration(dur: 30 | 60 | 90): void {
    const sel = this.selectedBlock();
    if (sel && this.hasBookings(sel)) return;
    this.editorSessionDuration.set(dur);
    this._snapTimeRange(dur);
  }

  setEditorStartTime(time: string): void {
    this.editorStartTime.set(time);
    this._snapTimeRange(this.editorSessionDuration());
  }

  private _snapTimeRange(dur: number): void {
    const startMin = timeToMin(this.editorStartTime());
    const endMin   = timeToMin(this.editorEndTime());
    const sessions = Math.max(1, Math.floor((endMin - startMin) / dur));
    const snappedEnd = Math.min(startMin + sessions * dur, DAY_END_MIN);
    if (snappedEnd !== endMin) {
      this.editorEndTime.set(minToTime(snappedEnd));
    }
  }

  toggleWeekday(wd: DayOfWeek): void {
    const sel = this.selectedBlock();
    if (sel && this.hasBookings(sel)) return;
    const set = new Set(this.selectedWeekdays());
    if (set.has(wd)) {
      set.delete(wd);
    } else {
      set.add(wd);
    }
    this.selectedWeekdays.set(set);
  }

  saveBlock(): void {
    this.attemptedSave.set(true);

    const existingId = this.selectedBlockId();
    const existing = existingId !== null ? this.blocks().find(b => b.id === existingId) : undefined;
    const isLockedByBookings = this.isEditingLockedBlock();

    const formError = this.serviceErrorMessage() || this.localErrorMessage()
      || this.platformErrorMessage() || this.priceErrorMessage() || this.priceBRLErrorMessage()
      || this.weekdayErrorMessage() || this.dateErrorMessage();
    if (formError) {
      this.snackbarService.openSnackBar({ message: formError });
      return;
    }

    const selectedSvcs = this.services().filter(s => this.selectedServiceIds().has(s.id));
    const isRecurring = this.editorFrequency() === 'weekly';

    if (existingId !== null) {
      if (!existing || existing.backendSlots.length === 0) return;

      const effectiveStartDate = !isRecurring
        ? (existing.startDate ?? this.editorDate())
        : existing.startDate;

      const updated: TherapistBlock = {
        ...existing,
        services: selectedSvcs,
        modality: this.editorModality(),
        isRecurring,
        recurrenceFrequency: isRecurring ? this.editorRecurrencePattern() : undefined,
        weekdays: isRecurring ? existing.weekdays : [],
        startDate: effectiveStartDate,
        startTime: this.editorStartTime(),
        endTime: this.editorEndTime(),
        sessionDuration: this.editorSessionDuration(),
        local: isLockedByBookings
          ? existing.local
          : (this.editorModality() !== Modality.REMOTE ? this.editorLocal() : undefined),
        platform: isLockedByBookings
          ? existing.platform
          : (this.editorModality() !== Modality.LOCAL ? this.editorPlatform() : undefined),
        price: isLockedByBookings ? existing.price : parsePriceInput(this.editorPrice(), this.decimalSeparator),
        priceBRL: isLockedByBookings ? existing.priceBRL : parsePriceInput(this.editorPriceBRL(), this.decimalSeparator),
      };

      if (!this.validateHonorsBookings(updated)) {
        this.snackbarService.openSnackBar({
          message: 'Esta alteração deixaria sessão(ões) reservada(s) sem disponibilidade. Ajuste mantendo as sessões marcadas.',
        });
        return;
      }

      if (this.previewBlocks().some(p => p.hasConflict)) {
        this.snackbarService.openSnackBar({
          message: 'Existe um conflito de horário. Resolva os conflitos antes de guardar.',
        });
        return;
      }

      this.blocks.update(bs => bs.map(b => b.id === existingId ? updated : b));
      this._invalidateSchedulingCache();

      if (this.hasBookings(existing)) {
        this._syncBookedBlock(existing, updated, existingId);
      } else {
        this._deleteAndRecreateBlock(existing, updated, existingId);
      }

      this.closeSheet();
      return;
    }

    if (this.previewBlocks().some(p => p.hasConflict)) {
      this.snackbarService.openSnackBar({
        message: 'Existe um conflito de horário. Resolva os conflitos antes de guardar.',
      });
      return;
    }

    this._invalidateSchedulingCache();

    const saveOps = isRecurring
      ? [...this.selectedWeekdays()].map(wd => this.createSingleBlock(selectedSvcs, true, wd))
      : [this.createSingleBlock(selectedSvcs, false, undefined, this.editorDate())];

    // Only clear the form and close the panel once the save actually succeeds —
    // resetting eagerly meant a failed request silently wiped whatever the user had typed.
    // The global error interceptor already surfaces a toast for the failed request itself.
    forkJoin(saveOps).subscribe({
      next: () => {
        this.resetEditor();
        this.closeSheet();
      },
      error: (e) => console.error('saveBlock error', e),
    });
  }

  removeBlock(): void {
    const id = this.selectedBlockId();
    if (id === null) return;
    const block = this.blocks().find(b => b.id === id);
    if (block && this.hasBookings(block)) return;

    this.confirmDelete(() => {
      this.blocks.update(bs => bs.filter(b => b.id !== id));
      this._invalidateSchedulingCache();
      this.resetEditor();
      this.closeSheet();

      if (block && block.backendSlots.length > 0) {
        const deleteOps = block.backendSlots.map(s => this.apiService.deleteAvailability(s.backendId));
        forkJoin(deleteOps).subscribe({
          error: (e) => {
            console.error('deleteAvailability error', e);
            if (block) this.blocks.update(bs => [...bs, block]);
          },
        });
      }
    });
  }

  private confirmDelete(onConfirm: () => void): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '440px',
      panelClass: 'care-dialog',
      data: {
        message: 'Deseja realmente excluir este(s) horário(s)? Essa ação não poderá ser desfeita.',
      },
    });
    ref.afterClosed().subscribe(confirmed => {
      if (confirmed) onConfirm();
    });
  }

  // ─ Private helpers ──────────────────────────────────────────────────────────

  startResize(event: PointerEvent, block: TherapistBlock, rowH = ROW_H): void {
    event.preventDefault();
    event.stopPropagation();

    const handle = event.currentTarget as HTMLElement;
    const colEl = (handle.closest('.daycol') ?? handle.closest('.m-tl')) as HTMLElement | null;
    if (!colEl) return;

    this._resizeBlock = block;
    this._resizeColEl = colEl;
    this._resizeRowH = rowH;
    this._resizeDragged = false;
    this.resizingBlockId.set(block.id);
    this.resizeLiveEndTime.set(block.endTime);

    handle.setPointerCapture(event.pointerId);

    const onMove = (e: PointerEvent) => {
      if (!this._resizeBlock || !this._resizeColEl) return;
      const rect = this._resizeColEl.getBoundingClientRect();
      const endMinRaw = ((e.clientY - rect.top + 3) / this._resizeRowH + 8) * 60;
      const dur = this._resizeBlock.sessionDuration;
      const startMin = timeToMin(this._resizeBlock.startTime);
      const sessions = Math.max(1, Math.round((endMinRaw - startMin) / dur));
      const snapped = startMin + sessions * dur;
      const floorMin = this.lastBookedEndMin(this._resizeBlock) ?? (startMin + dur);
      const clamped = Math.max(floorMin, Math.min(DAY_END_MIN, snapped));
      const next = minToTime(clamped);
      if (next !== this.resizeLiveEndTime()) {
        this._resizeDragged = true;
        this.resizeLiveEndTime.set(next);
      }
    };

    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);

      const b = this._resizeBlock;
      const newEnd = this.resizeLiveEndTime();
      const dragged = this._resizeDragged;

      this.resizingBlockId.set(null);
      this._resizeBlock = null;
      this._resizeColEl = null;
      this._resizeDragged = false;

      if (!b || !dragged || newEnd === b.endTime) return;

      // Swallow the synthetic click the browser fires after pointerup
      document.addEventListener('click', e => e.stopPropagation(), { once: true, capture: true });

      const updated = { ...b, endTime: newEnd };
      this.blocks.update(bs => bs.map(bl => bl.id === b.id ? updated : bl));
      if (this.selectedBlockId() === b.id) this.editorEndTime.set(newEnd);

      if (b.backendSlots.length > 0) {
        const dur = b.sessionDuration;
        const oldEndMin = timeToMin(b.endTime);
        const newEndMin = timeToMin(newEnd);
        const date = b.isRecurring && b.weekdays[0]
          ? this.dateForWeekday(b.weekdays[0])
          : (b.startDate ?? '');

        if (newEndMin > oldEndMin) {
          const newSlotTimes = generateSlots(b.endTime, newEnd, dur);
          const createOps = newSlotTimes.map(t =>
            this.apiService.createAvailability(this.buildSlotPayload(
              b.services, b.modality, b.isRecurring, date, t, minToTime(timeToMin(t) + dur), b.platform, b.local, b.price, b.priceBRL, b.recurrenceFrequency,
            ))
          );
          forkJoin(createOps).subscribe({
            next: (results) => {
              const newSlots: BackendSlot[] = results.map((res, i) => ({
                slotTime: newSlotTimes[i], backendId: res.id,
              }));
              this.blocks.update(bs => bs.map(bl =>
                bl.id === b.id ? { ...bl, backendSlots: [...bl.backendSlots, ...newSlots] } : bl,
              ));
              this._invalidateSchedulingCache();
            },
            error: () => this._resyncBlocksFromServer(
              'Não foi possível ajustar a disponibilidade. Confirme a agenda.',
            ),
          });
        } else if (newEndMin < oldEndMin) {
          const targetCount = generateSlots(b.startTime, newEnd, dur).length;
          const slotsToRemove = b.backendSlots.slice(targetCount);
          if (slotsToRemove.length > 0) {
            const deleteOps = slotsToRemove.map(s => this.apiService.deleteAvailability(s.backendId));
            forkJoin(deleteOps).subscribe({
              next: () => {
                this.blocks.update(bs => bs.map(bl =>
                  bl.id === b.id ? { ...bl, backendSlots: bl.backendSlots.slice(0, targetCount) } : bl,
                ));
                this._invalidateSchedulingCache();
              },
              error: () => this._resyncBlocksFromServer(
              'Não foi possível ajustar a disponibilidade. Confirme a agenda.',
            ),
            });
          }
        }
      }
    };

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  }

  startResizeTop(event: PointerEvent, block: TherapistBlock, rowH = ROW_H): void {
    event.preventDefault();
    event.stopPropagation();

    const handle = event.currentTarget as HTMLElement;
    const colEl = (handle.closest('.daycol') ?? handle.closest('.m-tl')) as HTMLElement | null;
    if (!colEl) return;

    this._resizeTopBlock = block;
    this._resizeTopColEl = colEl;
    this._resizeTopRowH = rowH;
    this._resizeTopDragged = false;
    this.resizingTopBlockId.set(block.id);
    this.resizeLiveStartTime.set(block.startTime);

    handle.setPointerCapture(event.pointerId);

    const onMove = (e: PointerEvent) => {
      if (!this._resizeTopBlock || !this._resizeTopColEl) return;
      const rect = this._resizeTopColEl.getBoundingClientRect();
      const startMinRaw = ((e.clientY - rect.top) / this._resizeTopRowH + 8) * 60;
      const dur = this._resizeTopBlock.sessionDuration;
      const endMin = timeToMin(this._resizeTopBlock.endTime);
      const sessions = Math.max(1, Math.round((endMin - startMinRaw) / dur));
      const snapped = endMin - sessions * dur;
      const ceilMin = this.firstBookedStartMin(this._resizeTopBlock)
        ?? (timeToMin(this._resizeTopBlock.endTime) - dur);
      const clamped = Math.max(DAY_START_MIN, Math.min(ceilMin, snapped));
      const next = minToTime(clamped);
      if (next !== this.resizeLiveStartTime()) {
        this._resizeTopDragged = true;
        this.resizeLiveStartTime.set(next);
      }
    };

    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);

      const b = this._resizeTopBlock;
      const newStart = this.resizeLiveStartTime();
      const dragged = this._resizeTopDragged;

      this.resizingTopBlockId.set(null);
      this._resizeTopBlock = null;
      this._resizeTopColEl = null;
      this._resizeTopDragged = false;

      if (!b || !dragged || newStart === b.startTime) return;

      document.addEventListener('click', e => e.stopPropagation(), { once: true, capture: true });

      const updated = { ...b, startTime: newStart };
      this.blocks.update(bs => bs.map(bl => bl.id === b.id ? updated : bl));
      if (this.selectedBlockId() === b.id) this.editorStartTime.set(newStart);

      if (b.backendSlots.length > 0) {
        const dur = b.sessionDuration;
        const oldStartMin = timeToMin(b.startTime);
        const newStartMin = timeToMin(newStart);
        const date = b.isRecurring && b.weekdays[0]
          ? this.dateForWeekday(b.weekdays[0])
          : (b.startDate ?? '');

        if (newStartMin < oldStartMin) {
          // Expanding upward: prepend new free slots
          const newSlotTimes = generateSlots(newStart, b.startTime, dur);
          const createOps = newSlotTimes.map(t =>
            this.apiService.createAvailability(this.buildSlotPayload(
              b.services, b.modality, b.isRecurring, date, t, minToTime(timeToMin(t) + dur), b.platform, b.local, b.price, b.priceBRL, b.recurrenceFrequency,
            ))
          );
          forkJoin(createOps).subscribe({
            next: (results) => {
              const newSlots: BackendSlot[] = results.map((res, i) => ({
                slotTime: newSlotTimes[i], backendId: res.id,
              }));
              this.blocks.update(bs => bs.map(bl =>
                bl.id === b.id ? { ...bl, backendSlots: [...newSlots, ...bl.backendSlots] } : bl,
              ));
              this._invalidateSchedulingCache();
            },
            error: () => this._resyncBlocksFromServer(
              'Não foi possível ajustar a disponibilidade. Confirme a agenda.',
            ),
          });
        } else if (newStartMin > oldStartMin) {
          // Shrinking from top: delete leading free slots
          const removeCount = generateSlots(b.startTime, newStart, dur).length;
          const leading = b.backendSlots.slice(0, removeCount);
          if (leading.length > 0) {
            const deleteOps = leading.map(s => this.apiService.deleteAvailability(s.backendId));
            forkJoin(deleteOps).subscribe({
              next: () => {
                this.blocks.update(bs => bs.map(bl =>
                  bl.id === b.id ? { ...bl, backendSlots: bl.backendSlots.slice(removeCount) } : bl,
                ));
                this._invalidateSchedulingCache();
              },
              error: () => this._resyncBlocksFromServer(
              'Não foi possível ajustar a disponibilidade. Confirme a agenda.',
            ),
            });
          }
        }
      }
    };

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  }

  startPreviewMove(event: PointerEvent, preview: PreviewBlock, colIndex: number): void {
    if ((event.target as HTMLElement).closest('.b-resize-handle')) return;

    const blockEl = event.currentTarget as HTMLElement;
    const daycol = blockEl.parentElement as HTMLElement;
    const weekGrid = daycol.parentElement as HTMLElement;

    const colEls = Array.from(weekGrid.querySelectorAll<HTMLElement>('.daycol'));
    const colRects = colEls.map(el => el.getBoundingClientRect());
    const colTopY = colRects[colIndex].top;

    const blockRect = blockEl.getBoundingClientRect();
    const grabOffsetMin = Math.max(0, (event.clientY - blockRect.top) / ROW_H * 60);
    const durationMin = timeToMin(preview.endTime) - timeToMin(preview.startTime);

    this.isMovingPreview.set(true);
    this.previewMoveLiveStart.set(preview.startTime);
    this.previewMoveLiveEnd.set(preview.endTime);
    this.previewMoveLiveCol.set(colIndex);

    let moved = false;

    blockEl.setPointerCapture(event.pointerId);

    const onMove = (e: PointerEvent) => {
      moved = true;

      let newCol = colIndex;
      for (let i = 0; i < colRects.length; i++) {
        if (e.clientX >= colRects[i].left && e.clientX < colRects[i].right) { newCol = i; break; }
      }
      if (e.clientX < colRects[0].left) newCol = 0;
      if (e.clientX >= colRects[colRects.length - 1].right) newCol = colRects.length - 1;

      const anchoredStart = (e.clientY - colTopY) / ROW_H * 60 + DAY_START_MIN - grabOffsetMin;
      const snapped = Math.round(anchoredStart / 30) * 30;
      const clampedStart = Math.max(DAY_START_MIN, Math.min(DAY_END_MIN - durationMin, snapped));

      this.previewMoveLiveCol.set(newCol);
      this.previewMoveLiveStart.set(minToTime(clampedStart));
      this.previewMoveLiveEnd.set(minToTime(clampedStart + durationMin));
    };

    const onUp = () => {
      blockEl.removeEventListener('pointermove', onMove);
      blockEl.removeEventListener('pointerup', onUp);
      blockEl.removeEventListener('pointercancel', onUp);

      const newStart = this.previewMoveLiveStart();
      const newEnd = this.previewMoveLiveEnd();
      const newCol = this.previewMoveLiveCol();

      this.isMovingPreview.set(false);

      if (!moved) return;

      document.addEventListener('click', e => e.stopPropagation(), { once: true, capture: true });

      this.editorStartTime.set(newStart);
      this.editorEndTime.set(newEnd);

      const newDow = COL_TO_DOW[newCol];
      if (this.editorFrequency() === 'weekly') {
        this.selectedWeekdays.set(new Set([newDow]));
      } else {
        this.editorDate.set(toKey(this.weekDays()[newCol]));
      }
    };

    blockEl.addEventListener('pointermove', onMove);
    blockEl.addEventListener('pointerup', onUp);
    blockEl.addEventListener('pointercancel', onUp);
  }

  startPreviewResize(event: PointerEvent, preview: PreviewBlock, rowH = ROW_H): void {
    event.preventDefault();
    event.stopPropagation();

    const handle = event.currentTarget as HTMLElement;
    const colEl = (handle.closest('.daycol') ?? handle.closest('.m-tl')) as HTMLElement | null;
    if (!colEl) return;

    let dragged = false;

    handle.setPointerCapture(event.pointerId);

    const onMove = (e: PointerEvent) => {
      const rect = colEl.getBoundingClientRect();
      const endMinRaw = ((e.clientY - rect.top + 3) / rowH + 8) * 60;
      const dur = this.editorSessionDuration();
      const startMin = timeToMin(preview.startTime);
      const sessions = Math.max(1, Math.round((endMinRaw - startMin) / dur));
      const snapped = startMin + sessions * dur;
      const clamped = Math.max(startMin + dur, Math.min(DAY_END_MIN, snapped));
      const next = minToTime(clamped);
      if (next !== this.editorEndTime()) {
        dragged = true;
        this.editorEndTime.set(next);
      }
    };

    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      if (dragged) {
        document.addEventListener('click', e => e.stopPropagation(), { once: true, capture: true });
      }
    };

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  }

  private createSingleBlock(
    services: ProfessionalService[],
    isRecurring: boolean,
    weekday?: DayOfWeek,
    startDate?: string,
  ): Observable<unknown> {
    const tempId = ++this._nextId;
    const date = isRecurring && weekday ? this.dateForWeekday(weekday) : (startDate ?? '');
    const dur = this.editorSessionDuration();
    const slotTimes = generateSlots(this.editorStartTime(), this.editorEndTime(), dur);

    const tempBlock: TherapistBlock = {
      id: tempId,
      backendSlots: slotTimes.map(t => ({ slotTime: t, backendId: -1 })),
      services,
      modality: this.editorModality(),
      isRecurring,
      recurrenceFrequency: isRecurring ? this.editorRecurrencePattern() : undefined,
      weekdays: isRecurring && weekday ? [weekday] : [],
      startDate: date,
      startTime: this.editorStartTime(),
      endTime: this.editorEndTime(),
      sessionDuration: dur,
      local: this.editorModality() !== Modality.REMOTE ? this.editorLocal() : undefined,
      platform: this.editorModality() !== Modality.LOCAL ? this.editorPlatform() : undefined,
      price: parsePriceInput(this.editorPrice(), this.decimalSeparator),
      priceBRL: parsePriceInput(this.editorPriceBRL(), this.decimalSeparator),
    };

    this.blocks.update(bs => [...bs, tempBlock]);
    this.selectedBlockId.set(tempId);

    const createOps = slotTimes.map(t =>
      this.apiService.createAvailability(
        this.buildSlotPayload(
          services, this.editorModality(), isRecurring, date, t, minToTime(timeToMin(t) + dur),
          this.editorModality() !== Modality.LOCAL ? this.editorPlatform() : undefined,
          this.editorModality() !== Modality.REMOTE ? this.editorLocal() : undefined,
          parsePriceInput(this.editorPrice(), this.decimalSeparator),
          parsePriceInput(this.editorPriceBRL(), this.decimalSeparator),
          isRecurring ? this.editorRecurrencePattern() : undefined,
        ),
      )
    );

    return settleAll(createOps).pipe(
      switchMap(created => {
        const written = created.flatMap(r => r.ok ? [r.value] : []);

        if (written.length === created.length) {
          const newSlots: BackendSlot[] = written.map((res, i) => ({
            slotTime: slotTimes[i], backendId: res.id,
          }));
          this.blocks.update(bs => bs.map(b =>
            b.id === tempId ? { ...b, backendSlots: newSlots } : b,
          ));
          return of(written);
        }

        // Um bloco meio gravado não é um bloco: as vagas que passaram ficariam
        // no servidor sem nada no calendário a representá-las, e a tentativa
        // seguinte na mesma célula seria recusada por sobreposição com elas.
        this.blocks.update(bs => bs.filter(b => b.id !== tempId));
        if (this.selectedBlockId() === tempId) this.selectedBlockId.set(null);

        return settleAll(written.map(v => this.apiService.deleteAvailability(v.id))).pipe(
          // Continuar a falhar para quem chamou: é isso que mantém o editor
          // aberto com o que a pessoa escreveu (ver saveBlock).
          switchMap(() => throwError(() => new Error('createAvailability: lote incompleto'))),
        );
      }),
    );
  }

  private buildSlotPayload(
    services: ProfessionalService[],
    modality: Modality,
    isRecurring: boolean,
    date: string,
    slotStart: string,
    slotEnd: string,
    platform?: string,
    address?: string,
    price?: number,
    priceBRL?: number,
    recurrenceFrequency?: RecurrenceFrequency,
  ): AvailabilityPayload {
    return {
      professionalServiceIds: services.map(s => s.id),
      startDate: date,
      startTime: slotStart,
      platform: modality !== Modality.LOCAL ? platform : undefined,
      // O campo 'Local' do editor era recolhido e validado, mas nunca chegava a
      // ser enviado — a morada perdia-se ao guardar. Agora vai como 'address'.
      address: modality !== Modality.REMOTE ? address : undefined,
      price,
      priceBRL,
      endTime: toApiTime(slotEnd),
      isRecurring,
      recurrenceFrequency: isRecurring
        ? toBackendRecurrenceFrequency(recurrenceFrequency ?? RecurrenceFrequency.WEEKLY)
        : undefined,
      modality: toBackendModality(modality),
    };
  }

  /**
   * Nova âncora de uma série recorrente que mudou de dia da semana.
   *
   * Mantém a semana da âncora original: trocar de dia (ou só de hora) não
   * deve alterar em que semanas a série acontece. Se a data resultante já
   * passou, avança períodos inteiros para preservar a paridade.
   */
  private reanchorRecurring(block: TherapistBlock, newWeekday: DayOfWeek): string {
    if (!block.startDate) {
      return this.dateForWeekday(newWeekday);
    }

    const anchor = new Date(block.startDate + 'T00:00:00');
    if (Number.isNaN(anchor.getTime())) {
      return this.dateForWeekday(newWeekday);
    }

    const colIdx = COL_TO_DOW.indexOf(newWeekday);
    const d = getWeekStart(anchor);
    d.setDate(d.getDate() + colIdx);

    const freq = normalizeRecurrenceFrequency(block.recurrenceFrequency);
    // Passo em dias que preserva a paridade. MONTHLY usa 4 semanas: mantém o
    // dia da semana e, na esmagadora maioria dos meses, a mesma posição.
    const stepDays = freq === RecurrenceFrequency.BIWEEKLY ? 14
      : freq === RecurrenceFrequency.MONTHLY ? 28
      : 7;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    while (d < today) {
      d.setDate(d.getDate() + stepDays);
    }
    return toKey(d);
  }

  /**
   * Data daquele dia da semana na semana em vista.
   *
   * É exatamente a célula que a pessoa profissional escolheu, e é essa data
   * que ancora a recorrência: se ela abriu a vaga nesta semana, é nesta
   * semana que a vaga ocorre. Não empurrar para a semana seguinte mesmo que
   * o dia já tenha passado — isso invertia as semanas de uma vaga quinzenal.
   */
  private dateForWeekday(wd: DayOfWeek): string {
    const colIdx = COL_TO_DOW.indexOf(wd);
    const d = new Date(this.weekStart());
    d.setDate(d.getDate() + colIdx);
    return toKey(d);
  }

  private groupAvailabilitiesIntoBlocks(avails: AvailabilityModel[]): TherapistBlock[] {
    if (avails.length === 0) return [];

    const sorted = [...avails].sort((a, b) => {
      const gA = a.isRecurring ? `R-${a.dayOfWeek}` : `S-${a.startDate}`;
      const gB = b.isRecurring ? `R-${b.dayOfWeek}` : `S-${b.startDate}`;
      const gc = gA.localeCompare(gB);
      return gc !== 0 ? gc : a.startTime.localeCompare(b.startTime);
    });

    const blocks: TherapistBlock[] = [];
    let group: AvailabilityModel[] = [];

    const flush = () => {
      if (group.length > 0) { blocks.push(this._avGroupToBlock(group)); group = []; }
    };

    for (const av of sorted) {
      if (group.length === 0) {
        group.push(av);
      } else {
        const last = group[group.length - 1];
        const avFreq = normalizeRecurrenceFrequency(av.recurrenceFrequency);
        const lastFreq = normalizeRecurrenceFrequency(last.recurrenceFrequency);
        // Weekly recurrence only cares about the weekday - two weekly slots created
        // on different calendar dates (but the same weekday) are still "the same day".
        // Biweekly/monthly semantically depend on the anchor date (parity/week-of-month),
        // so those must also share the same anchor to be considered the same block.
        const sameDay = av.isRecurring === last.isRecurring &&
          (av.isRecurring
            ? av.dayOfWeek === last.dayOfWeek
              && avFreq === lastFreq
              && (avFreq === RecurrenceFrequency.WEEKLY || av.startDate === last.startDate)
            : av.startDate === last.startDate);
        const sameModality = normalizeModality(av.modality) === normalizeModality(last.modality);
        if (sameDay && sameModality && av.startTime === last.endTime && this._sameServiceSet(av.services, last.services)) {
          group.push(av);
        } else {
          flush();
          group.push(av);
        }
      }
    }
    flush();
    return blocks;
  }

  private _avGroupToBlock(avails: AvailabilityModel[]): TherapistBlock {
    const first = avails[0];
    const last = avails[avails.length - 1];
    const firstStart = stripSec(first.startTime);
    const firstEnd = fromApiEndTime(first.endTime);
    const slotDurMin = timeToMin(firstEnd) - timeToMin(firstStart);
    const sessionDuration = (slotDurMin === 30 ? 30 : slotDurMin === 90 ? 90 : 60) as 30 | 60 | 90;
    const dow = BACKEND_DOW_MAP[first.dayOfWeek as unknown as string] ?? DayOfWeek.MONDAY;
    return {
      id: ++this._nextId,
      backendSlots: avails.map(a => ({ slotTime: stripSec(a.startTime), backendId: a.id })),
      services: first.services,
      modality: first.modality ? normalizeModality(first.modality) : this.deriveModality(first.services),
      isRecurring: first.isRecurring,
      recurrenceFrequency: first.isRecurring ? normalizeRecurrenceFrequency(first.recurrenceFrequency) : undefined,
      weekdays: first.isRecurring ? [dow] : [],
      startDate: first.startDate,
      startTime: firstStart,
      endTime: fromApiEndTime(last.endTime),
      sessionDuration,
      platform: first.platform,
      local: first.address,
      price: first.price,
      priceBRL: first.priceBRL,
    };
  }

  private _invalidateSchedulingCache(): void {
    this.schedulingService.schedulingForm.controls[SchedulingFormControls.SELECTED_SERVICE].setValue(null);
    this.schedulingService.clearChainedRelatedFields(SchedulingSteps.SERVICE_SELECTION);
  }

  private _sameServiceSet(a: ProfessionalService[], b: ProfessionalService[]): boolean {
    if (a.length !== b.length) return false;
    const ids = new Set(a.map(s => s.id));
    return b.every(s => ids.has(s.id));
  }

  /**
   * Relê a agenda do servidor e substitui por ela o estado local.
   *
   * Quando um lote de escritas falha a meio, o que ficou gravado deixa de ser
   * dedutível aqui. Repor em memória o bloco anterior — o que estes caminhos
   * de erro faziam — desenhava vagas já apagadas e escondia as que sobraram,
   * com backendIds que já não apontavam a nada; a edição seguinte partia
   * desse retrato falso. Depois de um erro, a única fonte fiável é o backend.
   */
  private _resyncBlocksFromServer(message?: string): void {
    if (message) this.snackbarService.openSnackBar({ message });

    const userId = this.sessionService.user()?.id;
    if (!userId) return;

    this.apiService.getAvailabilitiesByProfessionalId(userId).subscribe({
      next: (avails) => {
        this.blocks.set(this.groupAvailabilitiesIntoBlocks(avails));
        // O reagrupamento gera ids locais novos: manter a seleção anterior
        // deixaria o editor preso a um bloco que já não existe.
        this.selectedBlockId.set(null);
        this._invalidateSchedulingCache();
      },
      error: () => {},
    });
  }

  /**
   * Recria as vagas de `block` tal como estavam, uma por cada slot conhecido.
   */
  private _recreateSlotsOf(block: TherapistBlock, slotTimes: string[]): Observable<SettledWrite<AvailabilityModel>[]> {
    const dur = block.sessionDuration;
    const date = block.isRecurring && block.weekdays[0]
      ? this.dateForWeekday(block.weekdays[0])
      : (block.startDate ?? '');

    return settleAll(slotTimes.map(t =>
      this.apiService.createAvailability(this.buildSlotPayload(
        block.services, block.modality, block.isRecurring, date, t, minToTime(timeToMin(t) + dur),
        block.platform, block.local, block.price, block.priceBRL, block.recurrenceFrequency,
      )),
    ));
  }

  // Once a block has bookings, every field except Início/Fim (Intervalo de horas) is
  // locked in the editor - so `existing` and `updated` only ever differ in start/end time
  // here. Diffing the regenerated slot grid against the current slots (rather than only
  // ever appending at the end) correctly handles growing/shrinking from either edge, and
  // even both at once. validateHonorsBookings() has already rejected any change that would
  // strand a booked slot outside the new grid, so every slot in `toRemove` is guaranteed free.
  private _syncBookedBlock(existing: TherapistBlock, updated: TherapistBlock, blockId: number): void {
    const dur = existing.sessionDuration;
    const date = existing.isRecurring && existing.weekdays[0]
      ? this.dateForWeekday(existing.weekdays[0])
      : (existing.startDate ?? '');

    const newSlotTimes = generateSlots(updated.startTime, updated.endTime, dur);
    const newSlotSet = new Set(newSlotTimes);
    const existingTimes = new Set(existing.backendSlots.map(s => s.slotTime));

    const toRemove = existing.backendSlots.filter(s => !newSlotSet.has(s.slotTime));
    const toAddTimes = newSlotTimes.filter(t => !existingTimes.has(t));

    if (toRemove.length > 0) {
      const deleteOps = toRemove.map(s => this.apiService.deleteAvailability(s.backendId));
      forkJoin(deleteOps).subscribe({
        next: () => this.blocks.update(bs => bs.map(b => b.id === blockId
          ? { ...b, backendSlots: b.backendSlots.filter(s => newSlotSet.has(s.slotTime)) } : b)),
        error: () => this._resyncBlocksFromServer(
          'Não foi possível ajustar a disponibilidade. Confirme a agenda.',
        ),
      });
    }

    if (toAddTimes.length > 0) {
      const createOps = toAddTimes.map(t =>
        this.apiService.createAvailability(this.buildSlotPayload(
          existing.services, existing.modality, existing.isRecurring, date, t, minToTime(timeToMin(t) + dur), existing.platform, existing.local, existing.price, existing.priceBRL, existing.recurrenceFrequency,
        ))
      );
      forkJoin(createOps).subscribe({
        next: (results) => {
          const newSlots: BackendSlot[] = results.map((res, i) => ({
            slotTime: toAddTimes[i], backendId: res.id,
          }));
          this.blocks.update(bs => bs.map(b => b.id === blockId
            ? { ...b, backendSlots: [...b.backendSlots.filter(s => newSlotSet.has(s.slotTime)), ...newSlots] } : b));
        },
        error: () => this._resyncBlocksFromServer(
          'Não foi possível ajustar a disponibilidade. Confirme a agenda.',
        ),
      });
    }
  }

  /**
   * Substitui as vagas de um bloco: apaga as antigas e escreve a grelha nova.
   *
   * A ordem tem de ser esta — as vagas novas cobrem quase sempre as mesmas
   * horas que as antigas, e criá-las primeiro esbarraria na deteção de
   * sobreposição do backend. O que isso obriga é a tratar a janela entre as
   * duas metades: se a criação falhar depois de as antigas já terem sido
   * apagadas, a pessoa profissional fica sem disponibilidade nenhuma. Antes
   * este caminho limitava-se a repor o bloco no ecrã, pelo que a perda ficava
   * invisível até alguém recarregar a página.
   */
  private _deleteAndRecreateBlock(existing: TherapistBlock, updated: TherapistBlock, blockId: number): void {
    const dur = updated.sessionDuration;
    const date = updated.isRecurring && updated.weekdays[0]
      ? this.dateForWeekday(updated.weekdays[0])
      : (updated.startDate ?? '');
    const slotTimes = generateSlots(updated.startTime, updated.endTime, dur);

    const deleteOps = existing.backendSlots.map(s => this.apiService.deleteAvailability(s.backendId));

    settleAll(deleteOps).subscribe(deleted => {
      if (deleted.some(r => !r.ok)) {
        // Sobrou pelo menos uma vaga antiga: escrever a grelha nova por cima
        // colidiria com ela. Parar e mostrar o que está mesmo gravado.
        this._resyncBlocksFromServer(
          'Não foi possível substituir a disponibilidade. Confirme a agenda antes de tentar de novo.',
        );
        return;
      }

      if (slotTimes.length === 0) return;

      const createOps = slotTimes.map(t =>
        this.apiService.createAvailability(this.buildSlotPayload(
          updated.services, updated.modality, updated.isRecurring, date, t, minToTime(timeToMin(t) + dur),
          updated.platform, updated.local, updated.price, updated.priceBRL, updated.recurrenceFrequency,
        )),
      );

      settleAll(createOps).subscribe(created => {
        const written = created.flatMap(r => r.ok ? [r.value] : []);

        if (written.length === created.length) {
          const newSlots: BackendSlot[] = written.map((res, i) => ({
            slotTime: slotTimes[i], backendId: res.id,
          }));
          this.blocks.update(bs => bs.map(b =>
            b.id === blockId ? { ...b, backendSlots: newSlots } : b,
          ));
          return;
        }

        // Meia grelha gravada e as vagas antigas já apagadas. Limpar primeiro
        // o que se conseguiu escrever — senão a reposição do bloco anterior
        // choca com as próprias sobras — e só depois repor o que lá estava.
        settleAll(written.map(v => this.apiService.deleteAvailability(v.id))).subscribe(() => {
          this._recreateSlotsOf(existing, existing.backendSlots.map(s => s.slotTime))
            .subscribe(restored => {
              this._resyncBlocksFromServer(
                restored.some(r => !r.ok)
                  ? 'Não foi possível guardar a alteração e parte da disponibilidade anterior não pôde ser reposta. Verifique a agenda.'
                  : 'Não foi possível guardar a alteração. A disponibilidade anterior foi reposta.',
              );
            });
        });
      });
    });
  }

  private deriveModality(services: ProfessionalService[]): Modality {
    if (!services?.length) return Modality.ANY;
    const mods = services.map(s => String(s.modality));
    const hasLocal = mods.some(m => m === 'LOCAL' || m === 'Presencial');
    const hasRemote = mods.some(m => m === 'REMOTE' || m === 'Remoto');
    if (hasLocal && !hasRemote) return Modality.LOCAL;
    if (!hasLocal && hasRemote) return Modality.REMOTE;
    return Modality.ANY;
  }

  // ─ Appointment / slot helpers ────────────────────────────────────────────────

  /** A data concreta que este bloco representa na semana em vista. */
  private blockDateInView(block: TherapistBlock): string | null {
    if (!block.isRecurring) {
      return block.startDate ?? null;
    }
    if (!block.weekdays[0]) {
      return null;
    }
    return toKey(this.weekDays()[COL_TO_DOW.indexOf(block.weekdays[0])]);
  }

  appointmentsForBlock(block: TherapistBlock): Appointment[] {
    const backendIds = new Set(block.backendSlots.filter(s => s.backendId > 0).map(s => s.backendId));
    const dateKey = this.blockDateInView(block);

    return this.appointments().filter(a => {
      const matches = backendIds.size > 0 && backendIds.has(a.availabilityId)
        ? true
        : (
          // Legacy fallback: match by day/time range
          (block.isRecurring
            ? (a.isRecurring && BACKEND_DOW_MAP[a.dayOfWeek as unknown as string] === block.weekdays[0])
            : (a.startDate === block.startDate))
          && a.startTime >= block.startTime && a.startTime < block.endTime
        );
      if (!matches) return false;
      if (!dateKey) return true;

      // Uma ocorrência cancelada à parte deixou de existir: a vaga daquela
      // semana volta a estar livre e tem de poder ser reutilizada.
      if ((a.excludedDates ?? []).includes(dateKey)) return false;

      // Uma marcação pontual só ocupa a sua própria data. Sem isto, uma única
      // sessão numa vaga semanal aparecia ocupada em todas as semanas.
      if (!a.isRecurring || !a.startDate) return a.startDate === dateKey;

      return occursOnDate(
        a.recurrenceFrequency,
        new Date(a.startDate + 'T00:00:00'),
        new Date(dateKey + 'T00:00:00'),
      );
    });
  }

  bookedSlotsForBlock(block: TherapistBlock): SlotInfo[] {
    const slots = generateSlots(block.startTime, block.endTime, block.sessionDuration);
    // Per-slot mode: one backendSlot per generated slot
    // appointmentsForBlock já resolve a recorrência para a data em causa, por
    // isso uma sessão quinzenal deixa de marcar o bloco como ocupado nas
    // semanas em que não acontece.
    const appts = this.appointmentsForBlock(block);
    if (block.backendSlots.length === slots.length && block.backendSlots.every(s => s.backendId > 0)) {
      return block.backendSlots.map((s) => {
        const appointment = appts.find(a => a.availabilityId === s.backendId);
        return { time: s.slotTime, booked: !!appointment, appointment };
      });
    }
    // Legacy/transition mode: match appointments by slot start time
    return slots.map(time => {
      const appointment = appts.find(a => a.startTime === time);
      return { time, booked: !!appointment, appointment };
    });
  }

  /** Ocupação de uma vaga concreta, resolvida a partir das sessões da semana. */
  private isSlotBooked(block: TherapistBlock, slot: BackendSlot): boolean {
    return this.appointmentsForBlock(block).some(a => a.availabilityId === slot.backendId);
  }

  bookedCount(block: TherapistBlock): number {
    return this.bookedSlotsForBlock(block).filter(s => s.booked).length;
  }

  hasBookings(block: TherapistBlock): boolean {
    return this.bookedCount(block) > 0;
  }

  hasPendingProposal(block: TherapistBlock): boolean {
    return this.appointmentsForBlock(block).some(a => a.status === 'PENDING');
  }

  lastBookedEndMin(block: TherapistBlock): number | null {
    const booked = this.bookedSlotsForBlock(block).filter(s => s.booked);
    if (booked.length === 0) return null;
    const lastStart = Math.max(...booked.map(s => timeToMin(s.time)));
    return lastStart + block.sessionDuration;
  }

  firstBookedStartMin(block: TherapistBlock): number | null {
    const booked = this.bookedSlotsForBlock(block).filter(s => s.booked);
    if (booked.length === 0) return null;
    return Math.min(...booked.map(s => timeToMin(s.time)));
  }

  canResizeTop(block: TherapistBlock): boolean {
    const slots = this.bookedSlotsForBlock(block);
    return slots.length > 0 && !slots[0].booked;
  }

  blockResizeTopPx(block: TherapistBlock, liveStartTime: string, rowH = ROW_H): number {
    return hourRowIdx(liveStartTime) * rowH + 3;
  }

  blockResizeTopHeightPx(block: TherapistBlock, liveStartTime: string, rowH = ROW_H): number {
    return (hourRowIdx(block.endTime) - hourRowIdx(liveStartTime)) * rowH - 6;
  }

  blockIsDense(block: TherapistBlock, rowH = ROW_H): boolean {
    const height = this.blockHeightPx(block, rowH);
    const slotCount = this.blockSlotCount(block);
    return slotCount > 0 && (height / slotCount) < 30;
  }

  resizeFloorHeightPx(block: TherapistBlock, liveEndTime: string, rowH = ROW_H): number {
    const floor = this.lastBookedEndMin(block);
    if (floor === null) return 0;
    const liveEndMin = timeToMin(liveEndTime);
    return Math.max(0, (liveEndMin - floor)) / 60 * rowH;
  }

  slotServiceName(appt: Appointment): string {
    const svc = this.services().find(s => s.id === appt.professionalServiceId);
    return svc ? this.serviceDisplayName(svc.name) : '';
  }

  slotPatientName(appt: Appointment): string {
    return appt.clientName ?? `Paciente #${appt.clientId}`;
  }

  slotPatientFirstName(appt: Appointment): string {
    return this.slotPatientName(appt).split(' ')[0];
  }

  slotPatientInitials(appt: Appointment): string {
    return this.slotPatientName(appt)
      .split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('');
  }

  patientAvatarClass(idx: number): string {
    return `c${idx % 4}`;
  }

  bookedSvcIds(block: TherapistBlock): Set<number> {
    return new Set(this.appointmentsForBlock(block).map(a => a.professionalServiceId));
  }

  apptModalityLabel(appt: Appointment): string {
    const m = String(appt.modality);
    if (m === 'LOCAL' || m === 'Presencial') return 'presencial';
    if (m === 'REMOTE' || m === 'Remoto') return 'remoto';
    return '';
  }

  apptModalityDisplay(appt: Appointment): string {
    const m = String(appt.modality);
    if (m === 'LOCAL' || m === 'Presencial') return 'Presencial';
    if (m === 'REMOTE' || m === 'Remoto') return 'Remoto';
    return 'Qualquer';
  }

  recurrenceLabel(isRecurring: boolean, frequency?: string): string {
    if (!isRecurring) return 'Data única';
    return normalizeRecurrenceFrequency(frequency);
  }

  // Compact single-word form for the small "rec" tag next to a slot row.
  recurrenceTagLabel(isRecurring: boolean, frequency?: string): string {
    if (!isRecurring) return 'única';
    return normalizeRecurrenceFrequency(frequency).toLowerCase();
  }

  apptPriceDisplay(appt: Appointment): string {
    if (appt.price == null) return '';
    return new Intl.NumberFormat(this.locale, { style: 'currency', currency: this.CURRENCY }).format(appt.price);
  }

  apptPriceBRLDisplay(appt: Appointment): string {
    if (appt.priceBRL == null) return '';
    return new Intl.NumberFormat(this.locale, { style: 'currency', currency: this.CURRENCY_BRL }).format(appt.priceBRL);
  }

  apptDateLabel(appt: Appointment): string {
    if (appt.isRecurring) {
      const dow = BACKEND_DOW_MAP[appt.dayOfWeek as unknown as string];
      const idx = COL_TO_DOW.indexOf(dow);
      const day = idx >= 0 ? PT_DOW_LONG[idx] : '';
      return day.charAt(0).toUpperCase() + day.slice(1);
    }
    if (appt.startDate) {
      const d = new Date(appt.startDate + 'T00:00:00');
      const dow = PT_DOW_LONG[(d.getDay() + 6) % 7];
      return `${dow.charAt(0).toUpperCase() + dow.slice(1)}, ${d.getDate()} ${PT_MONTHS[d.getMonth()]}`;
    }
    return '';
  }

  selectSlot(event: Event, appt: Appointment): void {
    event.stopPropagation();
    this.selectedAppointment.set(appt);
    this.notesDraft.set(appt.notes ?? '');
    this.sheetOpen.set(true);
  }

  clearSelectedAppointment(): void {
    this.selectedAppointment.set(null);
    this.notesDraft.set('');
  }

  saveNotes(appt: Appointment): void {
    this.notesSaving.set(true);
    this.apiService.updateAppointmentNotes(appt.id, this.notesDraft()).subscribe({
      next: (updated) => {
        this.appointments.update(list =>
          list.map(a => (a.id === appt.id ? { ...a, notes: updated.notes } : a)),
        );
        this.selectedAppointment.update(cur =>
          cur && cur.id === appt.id ? { ...cur, notes: updated.notes } : cur,
        );
        this.notesSaving.set(false);
        this.snackbarService.openSnackBar({ message: 'Notas guardadas.' });
      },
      error: () => {
        this.notesSaving.set(false);
        this.snackbarService.openSnackBar({ message: 'Erro ao guardar as notas. Tente novamente.' });
      },
    });
  }

  cancelAppointment(appt: Appointment): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '440px',
      panelClass: 'care-dialog',
      data: {
        title: 'Confirmar cancelamento',
        message: 'Deseja realmente cancelar este agendamento? Essa ação não poderá ser desfeita.',
        justificationLabel: 'Justificativa do cancelamento:',
        justificationPlaceholder: 'Explique o motivo do cancelamento para a pessoa cliente.',
      } satisfies ConfirmDialogData,
    });
    ref.afterClosed().subscribe((result: ConfirmDialogResult | false) => {
      if (result) this._doCancelAppointment(appt, result.justification);
    });
  }

  private _doCancelAppointment(appt: Appointment, justification: string): void {
    this.apiService.deleteAppointment(appt.id, justification).subscribe({
      next: () => {
        this.appointments.update(list => list.filter(a => a.id !== appt.id));
        this.selectedAppointment.set(null);
        this.snackbarService.openSnackBar({ message: 'Sessão cancelada com sucesso.' });
      },
      error: () => {
        this.snackbarService.openSnackBar({ message: 'Erro ao cancelar a sessão. Tente novamente.' });
      },
    });
  }

  removeSlot(event: Event, block: TherapistBlock, slotIndex: number): void {
    event.stopPropagation();
    const slot = block.backendSlots[slotIndex];
    if (!slot || this.isSlotBooked(block, slot)) return;

    this.confirmDelete(() => this._doRemoveSlot(block, slotIndex, slot));
  }

  private _doRemoveSlot(block: TherapistBlock, slotIndex: number, slot: BackendSlot): void {
    this.apiService.deleteAvailability(slot.backendId).subscribe({
      next: () => {
        this._invalidateSchedulingCache();
        const remaining = block.backendSlots.filter((_, i) => i !== slotIndex);

        if (remaining.length === 0) {
          this.blocks.update(bs => bs.filter(b => b.id !== block.id));
          if (this.selectedBlockId() === block.id) this.resetEditor();
          return;
        }

        // Group remaining slots into contiguous runs (gap = not consecutive by duration)
        const dur = block.sessionDuration;
        const groups: BackendSlot[][] = [];
        let current: BackendSlot[] = [remaining[0]];
        for (let i = 1; i < remaining.length; i++) {
          const gap = timeToMin(remaining[i].slotTime) - timeToMin(remaining[i - 1].slotTime);
          if (gap === dur) {
            current.push(remaining[i]);
          } else {
            groups.push(current);
            current = [remaining[i]];
          }
        }
        groups.push(current);

        if (groups.length === 1) {
          // Slot was at start or end — just shrink the block
          const newSlots = groups[0];
          const newStart = newSlots[0].slotTime;
          const newEnd = minToTime(timeToMin(newSlots[newSlots.length - 1].slotTime) + dur);
          this.blocks.update(bs => bs.map(b => b.id === block.id
            ? { ...b, startTime: newStart, endTime: newEnd, backendSlots: newSlots }
            : b,
          ));
          if (this.selectedBlockId() === block.id) {
            this.editorStartTime.set(newStart);
            this.editorEndTime.set(newEnd);
          }
        } else {
          // Slot was in the middle — split into multiple blocks
          const newBlocks: TherapistBlock[] = groups.map(group => ({
            ...block,
            id: ++this._nextId,
            startTime: group[0].slotTime,
            endTime: minToTime(timeToMin(group[group.length - 1].slotTime) + dur),
            backendSlots: group,
          }));
          this.blocks.update(bs => [
            ...bs.filter(b => b.id !== block.id),
            ...newBlocks,
          ]);
          // Close editor so both resulting blocks are visible on the calendar
          if (this.selectedBlockId() === block.id) {
            this.resetEditor();
          }
        }
        this.snackbarService.openSnackBar({ message: 'Horário removido.' });
      },
      error: () => {
        this.snackbarService.openSnackBar({ message: 'Erro ao remover o horário. Tente novamente.' });
      },
    });
  }

  // ─ Recurring appointment proposals ──────────────────────────────────────────

  openProposeDialog(event: Event, block: TherapistBlock, slotIndex: number): void {
    event.stopPropagation();
    const backendSlot = block.backendSlots[slotIndex];
    if (!backendSlot || this.isSlotBooked(block, backendSlot)) return;

    const professionalId = this.sessionService.user()?.id;
    if (!professionalId) return;

    const dowIdx = COL_TO_DOW.indexOf(block.weekdays[0]);
    const dayLabelRaw = dowIdx >= 0 ? PT_DOW_LONG[dowIdx] : '';
    const dayLabel = dayLabelRaw.charAt(0).toUpperCase() + dayLabelRaw.slice(1);
    const slotEnd = minToTime(timeToMin(backendSlot.slotTime) + block.sessionDuration);

    // As datas já ocupadas desta vaga vêm do servidor no momento de abrir — os
    // blocos em memória não as trazem, e é isso que decide o que o calendário
    // do diálogo consegue oferecer como início da série.
    this.apiService.getAvailabilitiesByProfessionalId(professionalId).subscribe({
      next: (avails) => {
        const slotAvailability = avails.find(a => a.id === backendSlot.backendId);
        if (!slotAvailability) return;

        const ref = this.dialog.open(ProposeRecurringDialogComponent, {
          width: '460px',
          panelClass: 'care-dialog',
          data: {
            professionalId,
            services: block.services.map(s => ({ id: s.id, name: this.serviceDisplayName(s.name) })),
            slotModality: block.modality,
            dayLabel,
            timeLabel: `${backendSlot.slotTime}–${slotEnd}`,
            slotRecurrenceFrequency: normalizeRecurrenceFrequency(block.recurrenceFrequency),
            // Termos a que a vaga está anunciada: são o ponto de partida do
            // diálogo, para que enviar sem mexer em nada proponha a vaga tal como está.
            slotPlatform: block.platform,
            slotAddress: block.local,
            slotPrice: block.price,
            slotPriceBRL: block.priceBRL,
            slotAvailability,
          } as ProposeRecurringDialogData,
        });

        ref.afterClosed().subscribe((result: ProposeRecurringDialogResult | null) => {
          if (!result) return;
          this._sendRecurringProposal(backendSlot.backendId, result);
        });
      },
      error: () => {},
    });
  }

  private _sendRecurringProposal(availabilityId: number, result: ProposeRecurringDialogResult): void {
    this.apiService.proposeRecurringAppointment({
      availabilityId,
      professionalServiceId: result.professionalServiceId,
      clientId: result.clientId,
      modality: toBackendModality(result.modality),
      recurrenceFrequency: toBackendRecurrenceFrequency(result.recurrenceFrequency),
      platform: result.platform,
      address: result.address,
      price: result.price,
      priceBRL: result.priceBRL,
      startDate: result.startDate,
    }).subscribe({
      next: (appt) => {
        this.appointments.update(list => [...list, appt]);
        this.snackbarService.openSnackBar({ message: 'Proposta enviada com sucesso.' });
      },
      // O interceptor já mostra a recusa concreta do backend (valor fora dos
      // limites, periodicidade que a vaga não sustenta); repetir aqui uma
      // mensagem genérica só a taparia.
      error: () => {},
    });
  }

  /**
   * Verdadeiro quando a vaga por trás desta sessão é uma vaga periódica e a
   * sessão em si ainda não é recorrente — o caso de convidar para um regime
   * periódico depois da primeira sessão avulsa.
   */
  canInviteRecurring(appt: Appointment): boolean {
    if (appt.isRecurring) return false;
    const block = this.blocks().find(b => b.backendSlots.some(s => s.backendId === appt.availabilityId));
    return !!block?.isRecurring;
  }

  /**
   * Verdadeiro quando a ocorrência em vista já aconteceu. Reagendar/Cancelar
   * deixam de fazer sentido para o passado, mas convidar para o regime
   * periódico continua a valer — a próxima ocorrência ainda está para vir.
   */
  isApptPast(appt: Appointment): boolean {
    const block = this.blocks().find(b => b.backendSlots.some(s => s.backendId === appt.availabilityId));
    const occurrenceDate = (block && this.blockDateInView(block)) || appt.startDate;
    if (!occurrenceDate) return false;

    const dt = new Date(occurrenceDate + 'T00:00:00');
    const [h, m] = appt.startTime.split(':').map(Number);
    dt.setHours(h || 0, m || 0, 0, 0);
    return dt.getTime() < Date.now();
  }

  openInviteRecurringDialog(event: Event, appt: Appointment): void {
    event.stopPropagation();
    const block = this.blocks().find(b => b.backendSlots.some(s => s.backendId === appt.availabilityId));
    if (!block) return;

    const professionalId = this.sessionService.user()?.id;
    if (!professionalId) return;

    const dowIdx = COL_TO_DOW.indexOf(block.weekdays[0]);
    const dayLabelRaw = dowIdx >= 0 ? PT_DOW_LONG[dowIdx] : '';
    const dayLabel = dayLabelRaw.charAt(0).toUpperCase() + dayLabelRaw.slice(1);

    this.apiService.getAvailabilitiesByProfessionalId(professionalId).subscribe({
      next: (avails) => {
        const slotAvailability = avails.find(a => a.id === appt.availabilityId);
        if (!slotAvailability) return;

        const ref = this.dialog.open(ProposeRecurringDialogComponent, {
          width: '460px',
          panelClass: 'care-dialog',
          data: {
            professionalId,
            services: block.services.map(s => ({ id: s.id, name: this.serviceDisplayName(s.name) })),
            slotModality: block.modality,
            dayLabel,
            timeLabel: `${appt.startTime}–${appt.endTime}`,
            slotRecurrenceFrequency: normalizeRecurrenceFrequency(block.recurrenceFrequency),
            slotPlatform: appt.platform ?? block.platform,
            slotAddress: appt.address ?? block.local,
            slotPrice: appt.price ?? block.price,
            slotPriceBRL: appt.priceBRL ?? block.priceBRL,
            slotAvailability,
            preselectedClientId: appt.clientId,
            preselectedClientName: this.slotPatientName(appt),
          } as ProposeRecurringDialogData,
        });

        ref.afterClosed().subscribe((result: ProposeRecurringDialogResult | null) => {
          if (!result) return;
          this._sendRecurringProposal(appt.availabilityId, result);
        });
      },
      error: () => {},
    });
  }

  openRescheduleDialog(event: Event, appt: Appointment): void {
    event.stopPropagation();

    // A data que está a ser movida é a ocorrência em vista, não a âncora da
    // série: numa sessão semanal a âncora pode ser de há meses.
    const block = this.blocks().find(b => b.backendSlots.some(s => s.backendId === appt.availabilityId));
    const occurrenceDate = (block && this.blockDateInView(block)) || appt.startDate;

    // As vagas vêm do servidor no momento de abrir, e não dos blocos em
    // memória: estes são editados localmente entre gravações e não trazem as
    // datas já ocupadas, que é o que decide o que se pode oferecer.
    const professionalId = this.sessionService.user()?.id;
    if (!professionalId) return;

    this.apiService.getAvailabilitiesByProfessionalId(professionalId).subscribe({
      next: (avails) => {
        const ref = this.dialog.open(RescheduleDialogComponent, {
          width: '460px',
          panelClass: 'care-dialog',
          data: {
            counterpartName: this.slotPatientName(appt),
            serviceName: this.slotServiceName(appt),
            currentLabel: `${this.apptDateLabel(appt)} · ${appt.startTime}–${appt.endTime}`,
            isRecurring: !!appt.isRecurring,
            slotsFor: (dateKey: string) => freeSlotsOn(
              avails,
              dateKey,
              appt.professionalServiceId,
              {
                moving: { availabilityId: appt.availabilityId, date: occurrenceDate },
                preferredModality: normalizeModality(String(appt.modality)),
              },
            ),
            // Do lado de quem atende, mudar o dia de uma sessão combinada não é
            // uma decisão só sua: sai daqui como pedido, com motivo.
            asRequest: true,
          } as RescheduleDialogData,
        });

        ref.afterClosed().subscribe((result: RescheduleDialogResult | null) => {
          if (!result) return;
          this._sendRescheduleRequest(appt, occurrenceDate, result);
        });
      },
      error: () => {},
    });
  }

  /**
   * Envia o pedido. A agenda não muda nada — a sessão continua onde está até a
   * pessoa cliente responder, e por isso não há aqui nada para recarregar.
   */
  private _sendRescheduleRequest(
    appt: Appointment,
    occurrenceDate: string,
    result: RescheduleDialogResult,
  ): void {
    this.apiService.requestReschedule(appt.id, {
      availabilityId: result.availabilityId,
      professionalServiceId: appt.professionalServiceId,
      appointmentDate: result.date,
      startTime: result.startTime,
      endTime: toApiTime(result.endTime),
      modality: toBackendModality(result.modality),
      occurrenceDate,
      reason: result.reason,
    }).subscribe({
      next: () => {
        this.snackbarService.openSnackBar({
          message: 'Pedido enviado. A sessão só muda depois de a pessoa cliente aceitar.',
        });
        this.clearSelectedAppointment();
      },
      // O interceptor já mostra a recusa concreta do backend.
      error: () => {},
    });
  }

  private validateHonorsBookings(updated: TherapistBlock): boolean {
    const appts = this.appointmentsForBlock(updated);
    if (appts.length === 0) return true;
    const slots = new Set(generateSlots(updated.startTime, updated.endTime, updated.sessionDuration));
    const svcIds = new Set(updated.services.map(s => s.id));
    return appts.every(a =>
      slots.has(a.startTime) &&
      (a.professionalServiceId == null || svcIds.has(a.professionalServiceId)),
    );
  }

  // ─ Mobile sheet ─────────────────────────────────────────────────────────────

  openSheet(): void {
    this.resetEditor();
    this.selectedServiceIds.set(new Set(this.services().map(s => s.id)));
    const dow = COL_TO_DOW[this.selectedDayIndex()];
    this.selectedWeekdays.set(new Set([dow]));
    this.sheetOpen.set(true);
  }

  /**
   * Igual ao FAB, mas a tocar numa hora vazia da agenda — abre já com essa
   * hora como início. setEditorStartTime trata do fim: sem um par (endMin >
   * startMin) explícito, o cálculo em _snapTimeRange cai no mínimo de uma
   * sessão a partir do início escolhido.
   */
  openSheetAtHour(hour: string): void {
    this.openSheet();
    this.setEditorStartTime(hour);
  }

  closeSheet(): void {
    this.sheetOpen.set(false);
  }

  selectDay(index: number): void {
    this.selectedDayIndex.set(index);
  }

  // ─ Utilities ────────────────────────────────────────────────────────────────

  isToday(date: Date): boolean {
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }

  hasBlocks(colIndex: number): boolean {
    return this.blocksForColumn(colIndex).length > 0;
  }

  userInitials(): string {
    const user = this.sessionService.user();
    if (!user?.name) return 'LB';
    return user.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(n => n[0].toUpperCase())
      .join('');
  }

  mobileDayLabel(): string {
    const days = this.weekDays();
    const idx = this.selectedDayIndex();
    const d = days[idx];
    if (!d) return '';
    const dow = PT_DOW_LONG[idx];
    const day = d.getDate();
    const month = PT_MONTHS[d.getMonth()];
    return `${dow.charAt(0).toUpperCase() + dow.slice(1)}, ${day} de ${month}`;
  }

  mobileDayBlocks(): TherapistBlock[] {
    return this.blocksForColumn(this.selectedDayIndex());
  }

  private _todayColumnIndex(): number {
    const today = new Date();
    const dow = today.getDay(); // 0=Sun
    return dow === 0 ? 6 : dow - 1; // Mon=0…Sun=6
  }
}
