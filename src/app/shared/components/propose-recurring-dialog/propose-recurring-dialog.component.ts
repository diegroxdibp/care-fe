import { Component, ElementRef, HostListener, LOCALE_ID, OnInit, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ApiService } from '../../../core/services/api.service';
import { Modality } from '../../enums/modality.enum';
import { RecurrenceFrequency } from '../../enums/recurrence-frequency.enum';
import { AvailabilityModel } from '../../models/availability.model';
import { availabilityOccursOn } from '../../utils/free-slots.util';
import { getBookableModalities } from '../../utils/modality-compatibility.util';
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
  /*
   * Termos a que a vaga está anunciada. Servem de valor inicial: propor sem
   * mexer em nada tem de dar exatamente a vaga.
   */
  slotPlatform?: string;
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
   * Quando o convite parte de uma sessão já existente, a pessoa cliente já
   * está definida — não faz sentido pedir para a escolher outra vez de uma
   * lista.
   */
  preselectedClientId?: number;
  preselectedClientName?: string;
}

export interface ProposeRecurringDialogResult {
  professionalServiceId: number;
  clientId: number;
  modality: Modality;
  recurrenceFrequency: RecurrenceFrequency;
  platform?: string;
  address?: string;
  price?: number;
  priceBRL?: number;
  /** yyyy-MM-dd — em que dia a série começa. */
  startDate: string;
}

@Component({
  selector: 'app-propose-recurring-dialog',
  imports: [MatDialogModule, StyledSelectComponent],
  template: `
    <div class="dialog">
      <h3>Propor agendamento recorrente</h3>
      <p class="sub">{{ data.dayLabel }} · {{ data.timeLabel }}</p>
      <p class="note">
        Os termos abaixo valem só para esta proposta. A vaga continua anunciada como está.
      </p>

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

      <label class="field-label">Periodicidade</label>
      <div class="chips">
        @for (f of proposableFrequencies(); track f) {
          <button
            type="button"
            class="chip"
            [class.on]="selectedFrequency() === f"
            (click)="selectedFrequency.set(f)"
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

      <label class="field-label">Início da série</label>
      <div class="field-wrap" (mousedown)="$event.stopPropagation()">
        <button
          type="button"
          class="field"
          [class.open]="calOpen()"
          (mousedown)="toggleCalendar()"
        >
          <div class="field-inner">
            <span class="field-label">Primeira sessão</span>
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
        <div class="field field-textarea">
          <div class="field-inner">
            <span class="field-label">Plataforma</span>
            <textarea
              class="field-value"
              rows="3"
              [value]="platform()"
              (input)="platform.set($any($event.target).value)"
              placeholder="Partilhe orientações sobre a plataforma a usar, o envio do link e outros procedimentos."
            ></textarea>
          </div>
          <span translate="no" class="material-symbols-outlined field-icon">videocam</span>
        </div>
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
        <label class="field-label">Paciente</label>
        <p class="preselected-client">{{ data.preselectedClientName }}</p>
      } @else {
        <label class="field-label" for="patient-select">Paciente</label>
        @if (loading()) {
          <p class="hint">A carregar pacientes...</p>
        } @else if (patients().length === 0) {
          <p class="hint">Ainda não tem pacientes com sessões consigo.</p>
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
      }

      @if (errorMessage()) {
        <p class="error">{{ errorMessage() }}</p>
      }

      <div class="btns">
        <button class="btn-ghost" (click)="cancel()">Cancelar</button>
        <button class="btn-primary" [disabled]="!canSubmit() || sending()" (click)="submit()">
          {{ sending() ? 'A enviar...' : 'Enviar Proposta' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog {
      width: 100%;
      max-width: 440px;
      padding: 8px 0 0;
      box-sizing: border-box;
      font-family: var(--font-sans);
    }
    h3 {
      font-size: 22px;
      font-weight: 700;
      color: var(--color-primary-blue);
      margin: 0 0 4px;
      line-height: 1.2;
    }
    .sub {
      font-size: 13px;
      color: var(--color-muted);
      margin: 0 0 6px;
    }
    .note {
      font-size: 12px;
      color: var(--color-muted);
      margin: 0 0 20px;
      line-height: 1.45;
    }
    .field-label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: var(--color-muted);
      letter-spacing: 0.3px;
      margin: 0 0 8px;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 18px;
    }
    .chip {
      border: 1px solid var(--color-border);
      background: #fff;
      color: var(--color-primary-blue);
      border-radius: var(--radius-pill);
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 600;
      font-family: var(--font-sans);
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;

      &.on {
        background: var(--color-primary-blue);
        color: #fff;
        border-color: var(--color-primary-blue);
      }
    }
    /*
     * Mesma caixa do editor de disponibilidade (ver availability.component.scss
     * .field): fundo tonal, sem contorno, rótulo pequeno por cima do valor. O
     * input é transparente e sem outline — era o anel de foco nativo do browser
     * que desenhava o retângulo preto dentro do campo do Valor.
     */
    .field {
      background: var(--color-surface-tint);
      border-radius: var(--radius-lg);
      border: 1px solid transparent;
      padding: 12px 18px;
      margin-bottom: 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      transition: border-color 0.2s var(--ease-care), background 0.2s var(--ease-care);

      // Só hover, tal como no editor: o campo focado não ganha contorno
      // nenhum. É o outline nativo (que aparecia como um retângulo preto
      // dentro do campo) que o "outline: none" abaixo desliga.
      &:hover { border-color: var(--color-border); }

      .field-inner {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
        flex: 1;
      }

      .field-label { margin: 0; }

      .field-value {
        font-size: 16px;
        font-weight: 600;
        color: var(--color-primary-blue);
        background: none;
        border: none;
        outline: none;
        flex: 1;
        width: 100%;
        font-family: var(--font-sans);

        &::placeholder { color: var(--color-muted); font-weight: 400; }
      }

      .field-icon {
        color: var(--color-secondary-indigo);
        font-size: 22px;
        flex-shrink: 0;
      }

      &.field-textarea {
        position: relative;
        align-items: stretch;
        cursor: default;

        .field-icon { position: absolute; top: 12px; right: 18px; }
      }

      &.field-money { cursor: text; }
      &.has-error { border-color: var(--color-error); }
    }
    .field-value.placeholder { color: var(--color-muted); font-weight: 400; }
    button.field {
      width: 100%;
      text-align: left;
      font-family: var(--font-sans);
      &.open { border-color: var(--color-primary-blue); }
    }
    /*
     * O calendário abre no fluxo, e não sobreposto — ver a mesma nota em
     * reschedule-dialog.component.ts. Um popover absoluto ficava preso ao
     * recorte deste diálogo, que também rola.
     */
    .calendar-popover {
      background: #fff;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: 0 8px 24px rgba(34, 50, 110, 0.18);
      padding: 14px;
      margin-bottom: 18px;
      margin-top: -8px;
    }
    .cal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .cal-month-label { font-size: 14px; font-weight: 700; color: var(--color-primary-blue); }
    .cal-nav {
      border: 0;
      background: transparent;
      color: var(--color-primary-blue);
      cursor: pointer;
      display: flex;
      padding: 4px;
      border-radius: var(--radius-sm);
      &:hover { background: var(--color-surface-tint); }
    }
    .cal-weekdays, .cal-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 2px;
    }
    .cal-wd {
      text-align: center;
      font-size: 11px;
      font-weight: 600;
      color: var(--color-muted);
      padding-bottom: 4px;
    }
    .cal-day {
      aspect-ratio: 1;
      border: 0;
      background: transparent;
      border-radius: var(--radius-sm);
      font-family: var(--font-sans);
      font-size: 13px;
      color: var(--color-primary-blue);
      cursor: pointer;

      &:hover:not(:disabled):not(.selected) { background: var(--color-surface-tint); }
      &.other-month { color: var(--color-muted); opacity: 0.5; }
      &.today { font-weight: 700; text-decoration: underline; }
      // Um dia em que a vaga abre destaca-se do resto do mês — mas não por
      // cima do estado selecionado: ".available:not(:disabled)" tem mais
      // especificidade do que ".selected" sozinho (duas classes + pseudo-
      // classe contra uma classe), por isso ganhava sempre que o dia
      // escolhido também era um dia disponível — ou seja, sempre. O
      // selecionado ficava cinzento como um dia qualquer, em vez de azul.
      &.available:not(.selected):not(:disabled) { background: var(--color-border-soft); font-weight: 600; }
      &.selected {
        background: var(--color-primary-blue);
        color: #fff;
        font-weight: 700;
      }
      &:disabled { color: var(--color-muted); opacity: 0.35; cursor: not-allowed; }
    }
    textarea.field-value {
      resize: none;
      line-height: 1.4;
      font-weight: 400;
      cursor: text;
      min-height: 78px;
      scrollbar-width: thin;
      scrollbar-color: var(--color-primary-blue) transparent;
    }
    .money-row {
      display: flex;
      gap: 12px;
    }
    .money-col { flex: 1; min-width: 0; }
    .money-input {
      display: flex;
      align-items: baseline;
      gap: 4px;
    }
    .currency-affix {
      font-size: 16px;
      font-weight: 600;
      color: var(--color-muted);
      font-family: var(--font-sans);
      flex-shrink: 0;
      user-select: none;
    }
    .select-wrap { margin-bottom: 18px; }
    .preselected-client {
      font-size: 16px;
      font-weight: 600;
      color: var(--color-primary-blue);
      margin: 0 0 18px;
    }
    .hint {
      font-size: 13px;
      color: var(--color-muted);
      margin: 0 0 18px;
    }
    .hint.tight { margin-top: -10px; }
    .field-error {
      display: block;
      font-size: 12px;
      color: var(--color-error);
      margin-top: 4px;
    }
    .error {
      font-size: 13px;
      color: var(--color-error);
      margin: -6px 0 14px;
    }
    .btns {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }
    .btn-ghost {
      padding: 12px 22px;
      border-radius: var(--radius-md);
      border: 0;
      background: transparent;
      color: var(--color-primary-blue);
      font-family: var(--font-sans);
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 0.2s ease;
      &:hover { background: var(--color-surface-tint); }
    }
    .btn-primary {
      padding: 12px 22px;
      border-radius: var(--radius-md);
      border: 0;
      background: var(--color-primary-blue);
      color: #fff;
      font-family: var(--font-sans);
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      cursor: pointer;
      transition: opacity 0.2s ease;
      &:hover { opacity: 0.88; }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }
  `],
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

  readonly calOpen = signal<boolean>(false);
  // A primeira data livre já vem pré-selecionada — enviar sem mexer no
  // calendário ainda tem de dar uma proposta válida.
  readonly selectedStartDate = signal<string>(this.computeDefaultStartDate());
  // Abre já no mês dessa data — um mês corrente sem nenhum dia livre deixaria
  // o calendário mudo até a pessoa navegar por conta própria.
  readonly calendarViewDate = signal<Date>(
    this.selectedStartDate() ? new Date(this.selectedStartDate() + 'T00:00:00') : new Date(),
  );

  readonly platform = signal<string>(this.data.slotPlatform ?? '');
  readonly address = signal<string>(this.data.slotAddress ?? '');
  readonly price = signal<string>(formatPriceForEditor(this.data.slotPrice, this.separator));
  readonly priceBRL = signal<string>(formatPriceForEditor(this.data.slotPriceBRL, this.separator));

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

  readonly canSubmit = computed(() =>
    this.selectedServiceId() !== null &&
    this.selectedClientId() !== null &&
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

  /** Verdadeiro só nas ocorrências reais desta vaga que ainda não têm sessão marcada. */
  isDateAvailable(dateKey: string): boolean {
    const av = this.data.slotAvailability;
    if (dateKey < toKey(new Date())) return false;
    if (!availabilityOccursOn(av, dateKey)) return false;
    return !(av.bookedDates ?? []).includes(dateKey);
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
    const clientId = this.selectedClientId();
    const startDate = this.selectedStartDate();
    if (professionalServiceId === null || clientId === null || !startDate) return;
    if (this.priceValidity() !== null || this.priceBRLValidity() !== null) return;

    const modality = this.selectedModality();
    const address = this.address().trim();
    const platform = this.platform().trim();

    const result: ProposeRecurringDialogResult = {
      professionalServiceId,
      clientId,
      modality,
      recurrenceFrequency: this.selectedFrequency(),
      // Um campo que a modalidade escolhida não usa não deve seguir: uma
      // sessão remota não tem morada, e uma presencial não tem plataforma.
      address: modality !== Modality.REMOTE && address ? address : undefined,
      platform: modality !== Modality.LOCAL && platform ? platform : undefined,
      price: parsePriceInput(this.price(), this.separator),
      priceBRL: parsePriceInput(this.priceBRL(), this.separator),
      startDate,
    };
    this.dialogRef.close(result);
  }
}
