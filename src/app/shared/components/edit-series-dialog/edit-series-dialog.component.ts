import { Component, ElementRef, HostListener, LOCALE_ID, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Appointment } from '../../models/appointment.model';
import { AvailabilityModel } from '../../models/availability.model';
import { DayOfWeek } from '../../enums/day-of-week.enum';
import { Modality } from '../../enums/modality.enum';
import { RecurrenceFrequency } from '../../enums/recurrence-frequency.enum';
import { SeriesChangePayload } from '../../models/series-change-payload.model';
import { getBookableModalities, normalizeModality, toBackendModality } from '../../utils/modality-compatibility.util';
import { normalizeRecurrenceFrequency, toBackendRecurrenceFrequency } from '../../utils/recurrence.util';
import { REMOTE_SESSION_INFO } from '../../utils/remote-session.util';
import { firstSeriesChangeStart, isSeriesChangeStartAvailable } from '../../utils/series-change.util';
import { timezoneCity } from '../../utils/timezones.util';
import {
  decimalSeparatorFor,
  formatPriceForEditor,
  moneyLocaleFor,
  parsePriceInput,
  sanitizePriceInput,
  validatePriceInput,
} from '../../utils/price.util';
import { StyledSelectComponent, StyledSelectOption } from '../styled-select/styled-select.component';

const PT_MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const DOW_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 'TUESDAY' ou DayOfWeek.TUESDAY ('Terça-feira') → 'TUESDAY'. */
function backendDow(dow: DayOfWeek | string): string {
  const raw = String(dow);
  if (DOW_ORDER.includes(raw)) return raw;
  const entry = Object.entries(DayOfWeek).find(([, label]) => label === raw);
  return entry ? entry[0] : raw;
}

export interface EditSeriesDialogData {
  series: Appointment;
  counterpartName: string;
  /** Como a série está hoje, já pronto a mostrar ("Terça-feira · 10:00–11:00 · Semanal"). */
  currentLabel: string;
  /** As vagas periódicas da pessoa profissional, com as datas já ocupadas. */
  slots: AvailabilityModel[];
  /** Nome legível de um serviço a partir da chave do backend. */
  serviceName: (key: string) => string;
  /** Fuso de quem está a editar — para assinalar vagas escritas noutro fuso. */
  viewerTimeZone: string;
}

export type EditSeriesDialogResult = SeriesChangePayload;

@Component({
  selector: 'app-edit-series-dialog',
  imports: [MatDialogModule, StyledSelectComponent],
  template: `
    <div class="dialog">
      <h3>Alterar série</h3>
      <p class="sub">{{ data.counterpartName }} · {{ data.currentLabel }}</p>
      <p class="note">
        Escolha como a série passa a ser e a partir de quando. As sessões antes dessa data
        não mudam, e nada muda até {{ data.counterpartName }} aceitar — vamos enviar um email para essa pessoa confirmar.
      </p>

      <label class="field-label" for="series-slot-select">Dia e horário</label>
      @if (slotOptions().length === 0) {
        <p class="hint">Você não tem vagas periódicas. Crie uma na agenda para poder mudar a série para ela.</p>
      } @else {
        <div class="select-wrap">
          <app-styled-select
            inputId="series-slot-select"
            placeholder="Selecione uma vaga"
            searchPlaceholder="Pesquisar dia ou hora..."
            [options]="slotOptions()"
            [value]="selectedSlotId() !== null ? String(selectedSlotId()) : null"
            (valueChange)="selectSlot(+$event)"
          />
        </div>
      }

      @if (selectedSlot(); as slot) {
        @if (slotServices().length > 1) {
          <label class="field-label">Serviço</label>
          <div class="chips">
            @for (svc of slotServices(); track svc.id) {
              <button type="button" class="chip" [class.on]="selectedServiceId() === svc.id"
                (click)="selectedServiceId.set(svc.id)">
                {{ svc.name }}
              </button>
            }
          </div>
        }

        @if (bookableModalities().length > 1) {
          <label class="field-label">Modalidade</label>
          <div class="chips">
            @for (m of bookableModalities(); track m) {
              <button type="button" class="chip" [class.on]="selectedModality() === m"
                (click)="selectedModality.set(m)">
                {{ m }}
              </button>
            }
          </div>
        }

        <label class="field-label">Periodicidade</label>
        <div class="chips">
          @for (f of proposableFrequencies(); track f) {
            <button type="button" class="chip" [class.on]="selectedFrequency() === f"
              (click)="selectedFrequency.set(f)">
              {{ f }}
            </button>
          }
        </div>
        @if (proposableFrequencies().length === 1) {
          <p class="hint tight">
            Uma vaga {{ slotFrequency().toLowerCase() }} só abre nessas semanas,
            por isso a sessão segue a mesma periodicidade.
          </p>
        }

        <label class="field-label">A partir de</label>
        <div class="field-wrap" (mousedown)="$event.stopPropagation()">
          <button type="button" class="field" [class.open]="calOpen()" (mousedown)="toggleCalendar()">
            <div class="field-inner">
              <span class="field-label">Primeira sessão com o novo horário</span>
              <span class="field-value" [class.placeholder]="!effectiveFrom()">
                {{ effectiveFrom() ? fmtDate(effectiveFrom()) : 'dd/mm/aaaa' }}
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
                    [class.selected]="effectiveFrom() === cell.key"
                    [class.available]="isDateAvailable(cell.key)"
                    [disabled]="!cell.inMonth || !isDateAvailable(cell.key)"
                    (click)="effectiveFrom.set(cell.key); calOpen.set(false)"
                  >
                    {{ cell.date.getDate() }}
                  </button>
                }
              </div>
            </div>
          }
        </div>
        @if (effectiveFrom()) {
          <p class="hint tight">Até {{ fmtDate(dayBefore(effectiveFrom())) }}, as sessões continuam como estão.</p>
        } @else {
          <p class="hint tight">Esta vaga não tem datas livres nos próximos meses.</p>
        }

        @if (selectedModality() !== Modality.REMOTE) {
          <div class="field">
            <div class="field-inner">
              <span class="field-label">Local</span>
              <input class="field-value" type="text" [value]="address()"
                (input)="address.set($any($event.target).value)"
                placeholder="Consultório · R. da Misericórdia 53" />
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
                  <input class="field-value" type="text" inputmode="decimal" autocomplete="off"
                    [value]="price()" (keydown)="onPriceKeydown($event)"
                    (input)="price.set(sanitize($any($event.target).value))" [placeholder]="money.placeholder" />
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
                  <input class="field-value" type="text" inputmode="decimal" autocomplete="off"
                    [value]="priceBRL()" (keydown)="onPriceKeydown($event)"
                    (input)="priceBRL.set(sanitize($any($event.target).value))" [placeholder]="moneyBRL.placeholder" />
                  @if (!moneyBRL.isPrefix) { <span class="currency-affix">{{ moneyBRL.symbol }}</span> }
                </div>
              </div>
            </div>
            @if (priceBRLError(); as err) { <span class="field-error">{{ err }}</span> }
          </div>
        </div>
      }

      @if (!hasChanges() && selectedSlot()) {
        <p class="hint">Mude pelo menos um campo — do jeito que está, a série continua igual.</p>
      }

      <div class="btns">
        <button class="btn-ghost" (click)="cancel()">Cancelar</button>
        <button class="btn-primary" [disabled]="!canSubmit()" (click)="submit()">Enviar alteração</button>
      </div>
    </div>
  `,
  styleUrl: '../propose-recurring-dialog/recurring-dialog.scss',
})
export class EditSeriesDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<EditSeriesDialogComponent>);
  private readonly locale = inject(LOCALE_ID);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  readonly data = inject<EditSeriesDialogData>(MAT_DIALOG_DATA);

  readonly Modality = Modality;
  readonly String = String;
  readonly weekdays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  readonly remoteSessionInfo = REMOTE_SESSION_INFO;

  private readonly CURRENCY = 'EUR';
  private readonly CURRENCY_BRL = 'BRL';
  private readonly separator = decimalSeparatorFor(this.locale);
  readonly money = moneyLocaleFor(this.locale, this.CURRENCY);
  readonly moneyBRL = moneyLocaleFor(this.locale, this.CURRENCY_BRL);

  private readonly series = this.data.series;

  /** Por dia da semana e hora — é assim que se procura na agenda. */
  private readonly slots = [...this.data.slots]
    .filter(s => s.isRecurring)
    .sort((a, b) =>
      DOW_ORDER.indexOf(backendDow(a.dayOfWeek)) - DOW_ORDER.indexOf(backendDow(b.dayOfWeek))
      || a.startTime.localeCompare(b.startTime));

  readonly slotOptions = computed<StyledSelectOption[]>(() =>
    this.slots.map(s => ({ value: String(s.id), label: this.slotLabel(s) })),
  );

  readonly selectedSlotId = signal<number | null>(
    this.slots.find(s => s.id === this.series.availabilityId)?.id ?? this.slots[0]?.id ?? null,
  );
  readonly selectedSlot = computed(() => this.slots.find(s => s.id === this.selectedSlotId()) ?? null);

  readonly slotServices = computed(() =>
    (this.selectedSlot()?.services ?? []).map(s => ({ id: s.id, name: this.data.serviceName(s.name) })),
  );
  readonly bookableModalities = computed(() => getBookableModalities(this.selectedSlot()?.modality ?? 'ANY'));
  readonly slotFrequency = computed(() => normalizeRecurrenceFrequency(this.selectedSlot()?.recurrenceFrequency));

  /** Mesma regra da proposta: uma vaga semanal aguenta qualquer espaçamento, as outras só a sua. */
  readonly proposableFrequencies = computed<RecurrenceFrequency[]>(() =>
    this.slotFrequency() === RecurrenceFrequency.WEEKLY
      ? [RecurrenceFrequency.WEEKLY, RecurrenceFrequency.BIWEEKLY, RecurrenceFrequency.MONTHLY]
      : [this.slotFrequency()],
  );

  readonly selectedServiceId = signal<number | null>(null);
  readonly selectedModality = signal<Modality>(Modality.ANY);
  readonly selectedFrequency = signal<RecurrenceFrequency>(normalizeRecurrenceFrequency(this.series.recurrenceFrequency));
  readonly effectiveFrom = signal<string>('');

  readonly calOpen = signal(false);
  readonly calendarViewDate = signal<Date>(new Date());

  // Termos de partida: os que a série já tem — enviar só a mudar o dia não
  // pode alterar o valor combinado sem ninguém dar por isso.
  readonly address = signal<string>(this.series.address ?? '');
  readonly price = signal<string>(formatPriceForEditor(this.series.price, this.separator));
  readonly priceBRL = signal<string>(formatPriceForEditor(this.series.priceBRL, this.separator));

  private readonly attemptedSubmit = signal(false);
  private readonly priceValidity = computed(() => validatePriceInput(this.price(), {
    locale: this.locale, currency: this.CURRENCY, separator: this.separator, required: true,
  }));
  private readonly priceBRLValidity = computed(() => validatePriceInput(this.priceBRL(), {
    locale: this.locale, currency: this.CURRENCY_BRL, separator: this.separator, required: false,
  }));
  readonly priceError = computed(() => this.attemptedSubmit() ? this.priceValidity() : null);
  readonly priceBRLError = computed(() => this.attemptedSubmit() ? this.priceBRLValidity() : null);

  /**
   * Se a série pedida difere da atual. A data de início sozinha não conta: a
   * mesma série a partir de outro dia é a mesma série.
   */
  readonly hasChanges = computed(() => {
    const slot = this.selectedSlot();
    if (!slot) return false;
    const modality = this.selectedModality();
    const address = modality !== Modality.REMOTE ? this.address().trim() : '';
    return slot.id !== this.series.availabilityId
      || this.selectedServiceId() !== this.series.professionalServiceId
      || modality !== normalizeModality(String(this.series.modality))
      || this.selectedFrequency() !== normalizeRecurrenceFrequency(this.series.recurrenceFrequency)
      || address !== (modality !== Modality.REMOTE ? (this.series.address ?? '').trim() : '')
      || parsePriceInput(this.price(), this.separator) !== (this.series.price ?? undefined)
      || parsePriceInput(this.priceBRL(), this.separator) !== (this.series.priceBRL ?? undefined);
  });

  readonly canSubmit = computed(() =>
    this.selectedSlot() !== null
    && this.selectedServiceId() !== null
    && !!this.effectiveFrom()
    && this.hasChanges(),
  );

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

  constructor() {
    const initial = this.selectedSlotId();
    if (initial !== null) this.selectSlot(initial);
  }

  /**
   * Trocar de vaga recompõe o que depende dela — serviço, modalidade,
   * periodicidade e a primeira data livre —, mantendo o que a série já tinha
   * sempre que a vaga nova o permite.
   */
  selectSlot(id: number): void {
    this.selectedSlotId.set(id);
    const slot = this.selectedSlot();
    if (!slot) return;

    const services = this.slotServices();
    this.selectedServiceId.set(
      services.find(s => s.id === this.series.professionalServiceId)?.id ?? services[0]?.id ?? null,
    );

    const modalities = this.bookableModalities();
    const current = normalizeModality(String(this.series.modality));
    this.selectedModality.set(modalities.includes(current) ? current : modalities[0]);

    const frequencies = this.proposableFrequencies();
    const currentFrequency = normalizeRecurrenceFrequency(this.series.recurrenceFrequency);
    this.selectedFrequency.set(frequencies.includes(currentFrequency) ? currentFrequency : frequencies[0]);

    const start = firstSeriesChangeStart(slot, this.series);
    this.effectiveFrom.set(start);
    this.calendarViewDate.set(start ? new Date(start + 'T00:00:00') : new Date());
  }

  isDateAvailable(dateKey: string): boolean {
    const slot = this.selectedSlot();
    return !!slot && isSeriesChangeStartAvailable(slot, dateKey, this.series);
  }

  private slotLabel(slot: AvailabilityModel): string {
    const dow = DayOfWeek[backendDow(slot.dayOfWeek) as keyof typeof DayOfWeek] ?? String(slot.dayOfWeek);
    const time = `${slot.startTime.slice(0, 5)}–${slot.endTime.slice(0, 5)}`;
    const freq = normalizeRecurrenceFrequency(slot.recurrenceFrequency);
    // As horas de uma vaga estão no fuso em que foi escrita. Se não for o de
    // quem edita, diz-se qual — converter mudaria o dia da semana no rótulo.
    const zone = slot.timeZone && slot.timeZone !== this.data.viewerTimeZone
      ? ` (hora de ${timezoneCity(slot.timeZone)})`
      : '';
    const current = slot.id === this.series.availabilityId ? ' · atual' : '';
    return `${dow} · ${time}${zone} · ${freq}${current}`;
  }

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

  dayBefore(key: string): string {
    const d = new Date(key + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    return toKey(d);
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

  sanitize(raw: string): string {
    return sanitizePriceInput(raw, this.separator);
  }

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
    const slot = this.selectedSlot();
    const professionalServiceId = this.selectedServiceId();
    const effectiveFrom = this.effectiveFrom();
    if (!slot || professionalServiceId === null || !effectiveFrom || !this.hasChanges()) return;
    if (this.priceValidity() !== null || this.priceBRLValidity() !== null) return;

    const modality = this.selectedModality();
    const address = this.address().trim();
    const result: EditSeriesDialogResult = {
      availabilityId: slot.id,
      professionalServiceId,
      modality: toBackendModality(modality),
      recurrenceFrequency: toBackendRecurrenceFrequency(this.selectedFrequency()),
      address: modality !== Modality.REMOTE && address ? address : undefined,
      price: parsePriceInput(this.price(), this.separator),
      priceBRL: parsePriceInput(this.priceBRL(), this.separator),
      effectiveFrom,
    };
    this.dialogRef.close(result);
  }
}
