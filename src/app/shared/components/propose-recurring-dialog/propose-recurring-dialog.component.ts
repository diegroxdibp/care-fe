import { Component, ElementRef, HostListener, LOCALE_ID, OnInit, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ApiService } from '../../../core/services/api.service';
import { Modality } from '../../enums/modality.enum';
import { RecurrenceFrequency } from '../../enums/recurrence-frequency.enum';
import { Appointment } from '../../models/appointment.model';
import { AvailabilityModel } from '../../models/availability.model';
import { availabilityOccursOn } from '../../utils/free-slots.util';
import { normalizeRecurrenceFrequency, toBackendRecurrenceFrequency } from '../../utils/recurrence.util';
import { firstSeriesConflict } from '../../utils/series-change.util';
import { getBookableModalities } from '../../utils/modality-compatibility.util';
import { REMOTE_SESSION_INFO } from '../../utils/remote-session.util';
import {
  decimalSeparatorFor,
  formatPriceForEditor,
  moneyLocaleFor,
  parsePriceInput,
  sanitizePriceInput,
  validatePriceInput,
} from '../../utils/price.util';
import { PatientSummary } from '../../models/patient.model';
import { StyledSelectComponent, StyledSelectOption } from '../styled-select/styled-select.component';
import { InvitationKind } from '../../models/invitation.model';

const PT_MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface ProposeDialogService {
  id: number;
  /** Already display-ready (e.g. via serviceDisplayName()), not the raw enum key. */
  name: string;
}

export interface ProposeRecurringDialogData {
  professionalId: number;
  /** The services this specific availability slot offers. */
  services: ProposeDialogService[];
  /** The slot's own configured modality (Qualquer/Presencial/Remoto). */
  slotModality: Modality;
  dayLabel: string;
  timeLabel: string;
  /** A periodicidade da vaga — o ponto de partida, e o teto do que é proponível. */
  slotRecurrenceFrequency: RecurrenceFrequency;
  /**
   * Uma vaga de data única só se oferece nessa data; uma recorrente pode
   * oferecer uma data só ou uma série.
   */
  slotIsRecurring: boolean;
  /*
   * Termos a que a vaga está anunciada. Servem de valor inicial: propor sem
   * mexer em nada tem de dar exatamente a vaga.
   */
  slotAddress?: string;
  slotPrice?: number;
  slotPriceBRL?: number;
  /**
   * A vaga em si, para calcular em que datas a série pode começar — só
   * ocorrências dela (dia da semana, periodicidade, janela) que ainda não
   * tenham outra sessão marcada.
   */
  slotAvailability: AvailabilityModel;
  /**
   * As sessões já marcadas nesta vaga (confirmadas ou por responder). Servem
   * para não oferecer um início cuja série pisaria uma delas mais à frente, e
   * para avisar quando a pessoa cliente já tem uma série aqui.
   */
  slotAppointments?: Appointment[];
  /**
   * Quando o convite parte de uma sessão já existente, a pessoa cliente já
   * está definida — não faz sentido pedir para a escolher outra vez de uma
   * lista.
   */
  preselectedClientId?: number;
  preselectedClientName?: string;
}

export interface ProposeRecurringDialogResult {
  /** Uma data só, ou uma série a partir de startDate. */
  kind: InvitationKind;
  professionalServiceId: number;
  /** Alguém da lista de pacientes… */
  clientId?: number;
  /** …ou qualquer email, com ou sem conta Care. */
  email?: string;
  modality: Modality;
  /** Só numa série. */
  recurrenceFrequency?: RecurrenceFrequency;
  address?: string;
  price?: number;
  priceBRL?: number;
  /** yyyy-MM-dd — a data oferecida, ou o dia em que a série começa. */
  startDate: string;
  /** Texto livre que segue no email do convite. */
  message?: string;
}

/** Quem recebe o convite: alguém da lista, ou um email escrito à mão. */
type RecipientMode = 'list' | 'email';

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

@Component({
  selector: 'app-propose-recurring-dialog',
  imports: [MatDialogModule, StyledSelectComponent],
  template: `
    <div class="dialog">
      <h3>Enviar convite</h3>
      <p class="sub">{{ data.dayLabel }} · {{ data.timeLabel }}</p>
      <p class="note">
        Os termos abaixo valem só para este convite. A vaga continua anunciada como está.
      </p>

      @if (data.slotIsRecurring) {
        <label class="field-label">O que oferecer</label>
        <div class="chips">
          <button type="button" class="chip" [class.on]="kind() === 'SERIES'" (click)="selectKind('SERIES')">
            Acompanhamento recorrente
          </button>
          <button type="button" class="chip" [class.on]="kind() === 'DATE'" (click)="selectKind('DATE')">
            Só uma data
          </button>
        </div>
      }

      @if (data.services.length > 1) {
        <label class="field-label">Serviço</label>
        <div class="chips">
          @for (svc of data.services; track svc.id) {
            <button
              type="button"
              class="chip"
              [class.on]="selectedServiceId() === svc.id"
              (click)="selectedServiceId.set(svc.id)"
            >
              {{ svc.name }}
            </button>
          }
        </div>
      }

      @if (bookableModalities().length > 1) {
        <label class="field-label">Modalidade</label>
        <div class="chips">
          @for (m of bookableModalities(); track m) {
            <button
              type="button"
              class="chip"
              [class.on]="selectedModality() === m"
              (click)="selectedModality.set(m)"
            >
              {{ m }}
            </button>
          }
        </div>
      }

      @if (kind() === 'SERIES') {
      <label class="field-label">Periodicidade</label>
      <div class="chips">
        @for (f of proposableFrequencies(); track f) {
          <button
            type="button"
            class="chip"
            [class.on]="selectedFrequency() === f"
            (click)="selectFrequency(f)"
          >
            {{ f }}
          </button>
        }
      </div>
      @if (proposableFrequencies().length === 1) {
        <p class="hint tight">
          Uma vaga {{ data.slotRecurrenceFrequency.toLowerCase() }} só abre nessas semanas,
          por isso a sessão segue a mesma periodicidade.
        </p>
      }
      }

      <label class="field-label">{{ kind() === 'SERIES' ? 'Início da série' : 'Data da sessão' }}</label>
      <div class="field-wrap" (mousedown)="$event.stopPropagation()">
        <button
          type="button"
          class="field"
          [class.open]="calOpen()"
          (mousedown)="toggleCalendar()"
        >
          <div class="field-inner">
            <span class="field-label">{{ kind() === 'SERIES' ? 'Primeira sessão' : 'Sessão' }}</span>
            <span class="field-value" [class.placeholder]="!selectedStartDate()">
              {{ selectedStartDate() ? fmtDate(selectedStartDate()) : 'dd/mm/aaaa' }}
            </span>
          </div>
          <span translate="no" class="material-symbols-outlined field-icon">calendar_today</span>
        </button>

        @if (calOpen()) {
          <div class="calendar-popover">
            <div class="cal-header">
              <button type="button" class="cal-nav" (click)="prevMonth()">
                <span translate="no" class="material-symbols-outlined">chevron_left</span>
              </button>
              <span class="cal-month-label">{{ monthLabel() }}</span>
              <button type="button" class="cal-nav" (click)="nextMonth()">
                <span translate="no" class="material-symbols-outlined">chevron_right</span>
              </button>
            </div>

            <div class="cal-weekdays">
              @for (wd of weekdays; track $index) {
                <span class="cal-wd">{{ wd }}</span>
              }
            </div>

            <div class="cal-grid">
              @for (cell of calendarDays(); track cell.key) {
                <button
                  type="button"
                  class="cal-day"
                  [class.other-month]="!cell.inMonth"
                  [class.today]="isToday(cell.date)"
                  [class.selected]="selectedStartDate() === cell.key"
                  [class.available]="isDateAvailable(cell.key)"
                  [disabled]="!cell.inMonth || !isDateAvailable(cell.key)"
                  (click)="selectedStartDate.set(cell.key); calOpen.set(false)"
                >
                  {{ cell.date.getDate() }}
                </button>
              }
            </div>
          </div>
        }
      </div>
      @if (!hasAnyAvailableDate()) {
        <p class="hint tight">Esta vaga não tem datas livres nos próximos meses.</p>
      }

      @if (selectedModality() !== Modality.REMOTE) {
        <div class="field">
          <div class="field-inner">
            <span class="field-label">Local</span>
            <input
              class="field-value"
              type="text"
              [value]="address()"
              (input)="address.set($any($event.target).value)"
              placeholder="Consultório · R. da Misericórdia 53"
            />
          </div>
          <span translate="no" class="material-symbols-outlined field-icon">location_on</span>
        </div>
      }

      @if (selectedModality() !== Modality.LOCAL) {
        <p class="hint">{{ remoteSessionInfo }}</p>
      }

      <label class="field-label">Valor</label>
      <div class="money-row">
        <div class="money-col">
          <div class="field field-money" [class.has-error]="priceError()">
            <div class="field-inner">
              <span class="field-label">Valor em Euro</span>
              <div class="money-input">
                @if (money.isPrefix) { <span class="currency-affix">{{ money.symbol }}</span> }
                <input
                  class="field-value"
                  type="text"
                  inputmode="decimal"
                  autocomplete="off"
                  [value]="price()"
                  (keydown)="onPriceKeydown($event)"
                  (input)="price.set(sanitize($any($event.target).value))"
                  [placeholder]="money.placeholder"
                />
                @if (!money.isPrefix) { <span class="currency-affix">{{ money.symbol }}</span> }
              </div>
            </div>
          </div>
          @if (priceError(); as err) { <span class="field-error">{{ err }}</span> }
        </div>
        <div class="money-col">
          <div class="field field-money" [class.has-error]="priceBRLError()">
            <div class="field-inner">
              <span class="field-label">Valor em Reais</span>
              <div class="money-input">
                @if (moneyBRL.isPrefix) { <span class="currency-affix">{{ moneyBRL.symbol }}</span> }
                <input
                  class="field-value"
                  type="text"
                  inputmode="decimal"
                  autocomplete="off"
                  [value]="priceBRL()"
                  (keydown)="onPriceKeydown($event)"
                  (input)="priceBRL.set(sanitize($any($event.target).value))"
                  [placeholder]="moneyBRL.placeholder"
                />
                @if (!moneyBRL.isPrefix) { <span class="currency-affix">{{ moneyBRL.symbol }}</span> }
              </div>
            </div>
          </div>
          @if (priceBRLError(); as err) { <span class="field-error">{{ err }}</span> }
        </div>
      </div>

      @if (data.preselectedClientId) {
        <label class="field-label">Para</label>
        <p class="preselected-client">{{ data.preselectedClientName }}</p>
      } @else {
        <label class="field-label">Para</label>
        <div class="chips">
          <button type="button" class="chip" [class.on]="recipientMode() === 'list'" (click)="recipientMode.set('list')">
            Um paciente seu
          </button>
          <button type="button" class="chip" [class.on]="recipientMode() === 'email'" (click)="recipientMode.set('email')">
            Outro email
          </button>
        </div>
        @if (recipientMode() === 'list') {
          @if (loading()) {
            <p class="hint">Carregando pacientes...</p>
          } @else if (patients().length === 0) {
            <p class="hint">Ainda não há pacientes com sessões com você. Convide por email.</p>
          } @else {
            <div class="select-wrap">
              <app-styled-select
                inputId="patient-select"
                placeholder="Selecione um paciente"
                searchPlaceholder="Pesquisar paciente..."
                [options]="patientOptions()"
                [value]="selectedClientId() !== null ? String(selectedClientId()) : null"
                (valueChange)="selectedClientId.set(+$event)"
              />
            </div>
          }
        } @else {
          <div class="field" [class.has-error]="emailError()">
            <div class="field-inner">
              <span class="field-label">Email</span>
              <input
                class="field-value"
                type="email"
                autocomplete="off"
                [value]="email()"
                (input)="email.set($any($event.target).value)"
                placeholder="nome@exemplo.com"
              />
            </div>
            <span translate="no" class="material-symbols-outlined field-icon">mail</span>
          </div>
          @if (emailError(); as err) { <span class="field-error">{{ err }}</span> }
          <p class="hint tight">Quem ainda não tem conta na Care recebe um link para criar a conta com este email.</p>
        }
      }

      <div class="field field-textarea">
        <div class="field-inner">
          <span class="field-label">Mensagem (opcional)</span>
          <textarea
            class="field-value"
            maxlength="2000"
            [value]="message()"
            (input)="message.set($any($event.target).value)"
            placeholder="Segue no email do convite."
          ></textarea>
        </div>
      </div>

      @if (kind() === 'SERIES' && existingClientSeries(); as existing) {
        <p class="warn">
          @if (existing.status === 'PENDING') {
            <strong>{{ selectedClientName() }} já tem um convite pendente neste horário</strong>
            ({{ frequencyLabel(existing) }}, a partir de {{ fmtDate(existing.startDate) }}).
            Um novo convite não substitui esse — os dois ficam na agenda.
          } @else {
            <strong>{{ selectedClientName() }} já tem uma série neste horário</strong>
            ({{ frequencyLabel(existing) }}, a partir de {{ fmtDate(existing.startDate) }}).
            Se a ideia é mudar o dia, o horário ou a periodicidade dessa série, use "Alterar série" nela.
            Um novo convite cria uma segunda série, que se soma à primeira.
          }
        </p>
      }

      @if (errorMessage()) {
        <p class="error">{{ errorMessage() }}</p>
      }

      <div class="btns">
        <button class="btn-ghost" (click)="cancel()">Cancelar</button>
        <button class="btn-primary" [disabled]="!canSubmit() || sending()" (click)="submit()">
          {{ sending() ? 'Enviando...' : 'Enviar convite' }}
        </button>
      </div>
    </div>
  `,
  styleUrl: './recurring-dialog.scss',
})
export class ProposeRecurringDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<ProposeRecurringDialogComponent>);
  private readonly apiService = inject(ApiService);
  private readonly locale = inject(LOCALE_ID);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  readonly data = inject<ProposeRecurringDialogData>(MAT_DIALOG_DATA);

  readonly Modality = Modality;
  readonly String = String;
  readonly weekdays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  private readonly CURRENCY = 'EUR';
  private readonly CURRENCY_BRL = 'BRL';
  private readonly separator = decimalSeparatorFor(this.locale);
  readonly money = moneyLocaleFor(this.locale, this.CURRENCY);
  readonly moneyBRL = moneyLocaleFor(this.locale, this.CURRENCY_BRL);

  readonly bookableModalities = computed(() => getBookableModalities(this.data.slotModality));

  /**
   * Só periodicidades que a vaga consegue sustentar.
   *
   * Uma vaga semanal abre todas as semanas, logo aguenta qualquer espaçamento.
   * Uma quinzenal ou mensal só abre nas suas — propor mais denso reclamaria
   * semanas em que não há vaga, e o backend recusa (assertProposalFrequencyFits).
   */
  readonly proposableFrequencies = computed<RecurrenceFrequency[]>(() =>
    this.data.slotRecurrenceFrequency === RecurrenceFrequency.WEEKLY
      ? [RecurrenceFrequency.WEEKLY, RecurrenceFrequency.BIWEEKLY, RecurrenceFrequency.MONTHLY]
      : [this.data.slotRecurrenceFrequency],
  );

  readonly patients = signal<PatientSummary[]>([]);
  readonly loading = signal<boolean>(true);
  readonly sending = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  // Tal como os restantes campos, começa no que a vaga já diz. Com vários
  // serviços a vaga não escolhe por si, mas deixar tudo por marcar obrigava a
  // uma escolha só para repetir o que já estava — o primeiro é o arranque, e
  // trocar é um toque.
  readonly selectedServiceId = signal<number | null>(this.data.services[0]?.id ?? null);
  readonly selectedClientId = signal<number | null>(this.data.preselectedClientId ?? null);
  readonly selectedModality = signal<Modality>(this.bookableModalities()[0]);
  readonly selectedFrequency = signal<RecurrenceFrequency>(this.data.slotRecurrenceFrequency);
  // Numa vaga recorrente o habitual é um acompanhamento; numa de data única só há essa data.
  readonly kind = signal<InvitationKind>(this.data.slotIsRecurring ? 'SERIES' : 'DATE');

  readonly recipientMode = signal<RecipientMode>('list');
  readonly email = signal<string>('');
  readonly message = signal<string>('');

  readonly calOpen = signal<boolean>(false);
  // A primeira data livre já vem pré-selecionada — enviar sem mexer no
  // calendário ainda tem de dar uma proposta válida.
  readonly selectedStartDate = signal<string>(this.computeDefaultStartDate());
  // Abre já no mês dessa data — um mês corrente sem nenhum dia livre deixaria
  // o calendário mudo até a pessoa navegar por conta própria.
  readonly calendarViewDate = signal<Date>(
    this.selectedStartDate() ? new Date(this.selectedStartDate() + 'T00:00:00') : new Date(),
  );

  readonly address = signal<string>(this.data.slotAddress ?? '');
  readonly remoteSessionInfo = REMOTE_SESSION_INFO;
  readonly price = signal<string>(formatPriceForEditor(this.data.slotPrice, this.separator));
  readonly priceBRL = signal<string>(formatPriceForEditor(this.data.slotPriceBRL, this.separator));

  /**
   * Uma série (ou proposta) que a pessoa cliente escolhida já tem nesta vaga e
   * que ainda não acabou. Não impede nada — duas séries quinzenais em semanas
   * alternadas são possíveis —, mas quase sempre o que se queria era mudar a
   * que já existe, e criar outra deixava a pessoa com sessões todas as semanas.
   */
  readonly existingClientSeries = computed<Appointment | null>(() => {
    const clientId = this.selectedClientId();
    if (clientId === null) return null;
    const today = toKey(new Date());
    return (this.data.slotAppointments ?? []).find(a =>
      a.clientId === clientId && a.isRecurring && (!a.endDate || a.endDate >= today),
    ) ?? null;
  });

  readonly selectedClientName = computed(() =>
    this.data.preselectedClientName
      ?? this.patients().find(p => p.id === this.selectedClientId())?.name
      ?? 'Esta pessoa',
  );

  readonly patientOptions = computed<StyledSelectOption[]>(() =>
    this.patients().map(p => ({ value: String(p.id), label: p.name })),
  );

  /*
   * Validade dos campos de valor, separada de quando ela se mostra.
   *
   * Uma vaga sem valor anunciado abre este diálogo com o campo vazio — que é
   * inválido, mas ainda não é erro de ninguém. O editor de disponibilidade só
   * pinta os campos depois de se tentar guardar (attemptedSave); aqui vale o
   * mesmo, senão o diálogo nasce a vermelho.
   */
  private readonly attemptedSubmit = signal<boolean>(false);

  private readonly priceValidity = computed(() => validatePriceInput(this.price(), {
    locale: this.locale, currency: this.CURRENCY, separator: this.separator, required: true,
  }));

  // Reais é opcional, tal como no editor de disponibilidade.
  private readonly priceBRLValidity = computed(() => validatePriceInput(this.priceBRL(), {
    locale: this.locale, currency: this.CURRENCY_BRL, separator: this.separator, required: false,
  }));

  readonly priceError = computed(() => this.attemptedSubmit() ? this.priceValidity() : null);
  readonly priceBRLError = computed(() => this.attemptedSubmit() ? this.priceBRLValidity() : null);

  private readonly hasRecipient = computed(() =>
    this.data.preselectedClientId != null
      || (this.recipientMode() === 'list' ? this.selectedClientId() !== null : this.email().trim() !== ''),
  );

  readonly emailError = computed(() => {
    if (!this.attemptedSubmit() || this.recipientMode() !== 'email' || this.data.preselectedClientId != null) {
      return null;
    }
    return EMAIL_PATTERN.test(this.email().trim()) ? null : 'Indique um email válido.';
  });

  readonly canSubmit = computed(() =>
    this.selectedServiceId() !== null &&
    this.hasRecipient() &&
    !!this.selectedStartDate(),
  );

  /*
   * Mesmo calendário do Reagendar (ver reschedule-dialog.component): campo
   * com a data em dd/mm/aaaa e um popover com a grelha do mês, em vez do
   * input nativo (formato do locale do browser, ícone próprio a somar ao
   * nosso).
   */
  readonly calendarDays = computed(() => {
    const view = this.calendarViewDate();
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

    while (days.length % 7 !== 0) {
      const last = days[days.length - 1].date;
      const d = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
      days.push({ date: d, inMonth: false, key: toKey(d) });
    }

    return days;
  });

  readonly monthLabel = computed(() => {
    const d = this.calendarViewDate();
    return `${PT_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  });

  /**
   * Verdadeiro só nas ocorrências reais desta vaga que ainda não têm sessão
   * marcada, e a partir das quais a série, com a periodicidade escolhida, não
   * pisa outra sessão nos próximos meses — o backend recusa-a (firstSeriesConflict).
   */
  isDateAvailable(dateKey: string): boolean {
    const av = this.data.slotAvailability;
    if (dateKey < toKey(new Date())) return false;
    if (!availabilityOccursOn(av, dateKey)) return false;
    if ((av.bookedDates ?? []).includes(dateKey)) return false;
    // Uma data só não tem semanas seguintes para pisar.
    if (this.kind() === 'DATE') return true;
    return firstSeriesConflict(
      av, toBackendRecurrenceFrequency(this.selectedFrequency()), dateKey, this.data.slotAppointments ?? [],
    ) === null;
  }

  /**
   * Mudar a periodicidade muda que inícios servem: uma série semanal não cabe
   * onde uma quinzenal cabia. Se o início escolhido deixar de servir, passa-se
   * para o primeiro que sirva.
   */
  selectFrequency(frequency: RecurrenceFrequency): void {
    this.selectedFrequency.set(frequency);
    const current = this.selectedStartDate();
    if (current && this.isDateAvailable(current)) return;
    const next = this.computeDefaultStartDate();
    this.selectedStartDate.set(next);
    if (next) this.calendarViewDate.set(new Date(next + 'T00:00:00'));
  }

  /** Trocar entre data e série muda que datas servem — ver selectFrequency. */
  selectKind(kind: InvitationKind): void {
    this.kind.set(kind);
    const current = this.selectedStartDate();
    if (current && this.isDateAvailable(current)) return;
    const next = this.computeDefaultStartDate();
    this.selectedStartDate.set(next);
    if (next) this.calendarViewDate.set(new Date(next + 'T00:00:00'));
  }

  frequencyLabel(appt: Appointment): string {
    return normalizeRecurrenceFrequency(appt.recurrenceFrequency).toLowerCase();
  }

  /** Sem isto o calendário abriria mudo — sem nenhum dia disponível e sem dizer porquê. */
  hasAnyAvailableDate(): boolean {
    return !!this.selectedStartDate();
  }

  private computeDefaultStartDate(): string {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    // Um ano de folga cobre até uma vaga mensal sem data livre no curto prazo;
    // para lá disso a vaga não tem mesmo onde começar.
    for (let i = 0; i < 366; i++) {
      const key = toKey(d);
      if (this.isDateAvailable(key)) return key;
      d.setDate(d.getDate() + 1);
    }
    return '';
  }

  /** Fecha o calendário ao clicar fora — ver a mesma nota em reschedule-dialog. */
  @HostListener('document:mousedown')
  onDocMousedown(): void {
    this.calOpen.set(false);
  }

  toggleCalendar(): void {
    const opening = !this.calOpen();
    this.calOpen.set(opening);
    if (!opening) return;

    setTimeout(() => {
      this.elementRef.nativeElement
        .querySelector('.calendar-popover')
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  fmtDate(key: string): string {
    const [y, m, d] = key.split('-');
    return `${d}/${m}/${y}`;
  }

  isToday(date: Date): boolean {
    const t = new Date();
    return date.getFullYear() === t.getFullYear()
      && date.getMonth() === t.getMonth()
      && date.getDate() === t.getDate();
  }

  prevMonth(): void {
    const d = this.calendarViewDate();
    this.calendarViewDate.set(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  nextMonth(): void {
    const d = this.calendarViewDate();
    this.calendarViewDate.set(new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  ngOnInit(): void {
    if (this.data.preselectedClientId) {
      this.loading.set(false);
      return;
    }
    this.apiService.getPatients(this.data.professionalId).subscribe({
      next: (patients) => {
        this.patients.set(patients);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Não foi possível carregar os pacientes. Tente novamente.');
        this.loading.set(false);
      },
    });
  }

  sanitize(raw: string): string {
    return sanitizePriceInput(raw, this.separator);
  }

  // Sem isto, o separador decimal do locale podia ser escrito duas vezes antes
  // de a sanitização o apanhar, e o cursor saltava.
  onPriceKeydown(event: KeyboardEvent): void {
    if (event.key.length === 1 && !/[0-9]/.test(event.key) && event.key !== this.separator) {
      event.preventDefault();
    }
  }

  cancel(): void {
    this.dialogRef.close(null);
  }

  submit(): void {
    this.attemptedSubmit.set(true);

    const professionalServiceId = this.selectedServiceId();
    const startDate = this.selectedStartDate();
    if (professionalServiceId === null || !startDate || !this.hasRecipient()) return;
    if (this.priceValidity() !== null || this.priceBRLValidity() !== null) return;
    if (this.emailError() !== null) return;

    const byEmail = this.data.preselectedClientId == null && this.recipientMode() === 'email';
    const modality = this.selectedModality();
    const address = this.address().trim();
    const message = this.message().trim();
    const kind = this.kind();

    const result: ProposeRecurringDialogResult = {
      kind,
      professionalServiceId,
      clientId: byEmail ? undefined : (this.selectedClientId() ?? undefined),
      email: byEmail ? this.email().trim() : undefined,
      modality,
      recurrenceFrequency: kind === 'SERIES' ? this.selectedFrequency() : undefined,
      // Uma sessão remota não tem morada.
      address: modality !== Modality.REMOTE && address ? address : undefined,
      price: parsePriceInput(this.price(), this.separator),
      priceBRL: parsePriceInput(this.priceBRL(), this.separator),
      startDate,
      message: message || undefined,
    };
    this.dialogRef.close(result);
  }
}
