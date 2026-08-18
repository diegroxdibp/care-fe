import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Modality } from '../../enums/modality.enum';
import { FreeSlot } from '../../utils/free-slots.util';

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

/** Uma vaga livre onde a sessão pode passar a acontecer. */
export type RescheduleSlotOption = FreeSlot;

export interface RescheduleDialogData {
  /** A outra pessoa da sessão — a cliente para quem reagenda, a profissional para quem pede. */
  counterpartName: string;
  serviceName: string;
  /** Onde a sessão está hoje, para quem reagenda se situar. */
  currentLabel: string;
  /** Só a ocorrência escolhida muda; a série fica de pé. */
  isRecurring: boolean;
  /**
   * Vagas livres numa data, resolvidas por quem abriu o diálogo.
   *
   * A ocupação de uma vaga depende da recorrência das sessões que já lá estão e
   * das ocorrências canceladas à parte — isso está resolvido em freeSlotsOn, e
   * uma segunda implementação aqui dentro divergiria da primeira.
   */
  slotsFor: (dateKey: string) => RescheduleSlotOption[];
  /**
   * Quem reagenda é a pessoa profissional: a mudança não acontece já, vai como
   * pedido à pessoa cliente e leva o motivo escrito por quem o faz.
   */
  asRequest?: boolean;
}

export interface RescheduleDialogResult {
  availabilityId: number;
  date: string;
  startTime: string;
  endTime: string;
  modality: Modality;
  /** Preenchido apenas quando o diálogo abriu em modo pedido. */
  reason?: string;
}

@Component({
  selector: 'app-reschedule-dialog',
  imports: [MatDialogModule],
  template: `
    <div class="dialog">
      <h3>{{ data.asRequest ? 'Pedir reagendamento' : 'Reagendar sessão' }}</h3>
      <p class="sub">{{ data.counterpartName }} · {{ data.serviceName }}</p>
      <p class="note">
        Atualmente: {{ data.currentLabel }}.
        @if (data.isRecurring) {
          Só esta sessão muda de dia — a recorrência continua como está.
        }
        @if (data.asRequest) {
          A sessão só muda depois de a pessoa cliente aceitar.
        }
      </p>

      <label class="field-label">Nova data</label>
      <div class="field-wrap" (mousedown)="$event.stopPropagation()">
        <button
          type="button"
          class="field"
          [class.open]="calOpen()"
          (mousedown)="toggleCalendar()"
        >
          <div class="field-inner">
            <span class="field-label">Escolha uma data</span>
            <span class="field-value" [class.placeholder]="!selectedDate()">
              {{ selectedDate() ? fmtDate(selectedDate()) : 'dd/mm/aaaa' }}
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
                  [class.selected]="selectedDate() === cell.key"
                  [class.available]="hasSlots(cell.key)"
                  [disabled]="isPast(cell.date) || !cell.inMonth || !hasSlots(cell.key)"
                  (click)="onDateChange(cell.key)"
                >
                  {{ cell.date.getDate() }}
                </button>
              }
            </div>
          </div>
        }
      </div>

      @if (selectedDate()) {
        <label class="field-label">Horários disponíveis</label>
        @if (slots().length === 0) {
          <p class="hint">
            Sem vagas livres neste dia para {{ data.serviceName }}. Escolha outra data.
          </p>
        } @else {
          <div class="slots">
            @for (slot of slots(); track slot.availabilityId + slot.startTime) {
              <button
                type="button"
                class="slot"
                [class.on]="isChosen(slot)"
                (click)="chosen.set(slot)"
              >
                {{ slot.startTime }}–{{ slot.endTime }}
              </button>
            }
          </div>
        }
      }

      @if (data.asRequest) {
        <label class="field-label" for="reschedule-reason">Motivo</label>
        <textarea
          id="reschedule-reason"
          class="reason"
          rows="3"
          maxlength="700"
          placeholder="Explique porque precisa de mudar esta sessão."
          [value]="reason()"
          (input)="reason.set($any($event.target).value)"
        ></textarea>
      }

      <div class="btns">
        <button class="btn-ghost" (click)="cancel()">Cancelar</button>
        <button class="btn-primary" [disabled]="!canSubmit()" (click)="submit()">
          {{ data.asRequest ? 'Enviar pedido' : 'Reagendar' }}
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
    .sub { font-size: 13px; color: var(--color-muted); margin: 0 0 6px; }
    .note { font-size: 12px; color: var(--color-muted); margin: 0 0 20px; line-height: 1.45; }
    .field-label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: var(--color-muted);
      letter-spacing: 0.3px;
      margin: 0 0 8px;
    }
    /* Mesma caixa do editor de disponibilidade — ver availability.component.scss */
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
      transition: border-color 0.2s var(--ease-care);

      &:hover { border-color: var(--color-border); }

      .field-inner { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
      .field-label { margin: 0; }
      .field-value {
        font-size: 16px;
        font-weight: 600;
        color: var(--color-primary-blue);
        background: none;
        border: none;
        outline: none;
        width: 100%;
        font-family: var(--font-sans);

        &::-webkit-calendar-picker-indicator { cursor: pointer; }
      }
      .field-icon { color: var(--color-secondary-indigo); font-size: 22px; flex-shrink: 0; }
      .field-value.placeholder { color: var(--color-muted); font-weight: 400; }
    }
    button.field {
      width: 100%;
      text-align: left;
      font-family: var(--font-sans);
      &.open { border-color: var(--color-primary-blue); }
    }
    /*
     * O calendário abre no fluxo, e não sobreposto.
     *
     * Um popover absoluto dentro de um diálogo que rola fica preso ao recorte
     * dele: nascia por baixo do fundo visível e, como é mais alto do que o
     * espaço que sobra, nem rolar o punha todo à vista. Em fluxo, é o diálogo
     * que cresce e rola, e a grelha aparece sempre inteira.
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

      &:hover:not(:disabled) { background: var(--color-surface-tint); }
      &.other-month { color: var(--color-muted); opacity: 0.5; }
      &.today { font-weight: 700; text-decoration: underline; }
      // Um dia com vagas para este serviço destaca-se do resto do mês.
      &.available:not(:disabled) { background: var(--color-border-soft); font-weight: 600; }
      &.selected {
        background: var(--color-primary-blue);
        color: #fff;
        font-weight: 700;
      }
      &:disabled { color: var(--color-muted); opacity: 0.35; cursor: not-allowed; }
    }
    .slots {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 18px;
    }
    .slot {
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
    .hint { font-size: 13px; color: var(--color-muted); margin: 0 0 18px; }
    .reason {
      width: 100%;
      box-sizing: border-box;
      background: var(--color-surface-tint);
      border: 1px solid transparent;
      border-radius: var(--radius-lg);
      padding: 12px 18px;
      margin-bottom: 18px;
      font-family: var(--font-sans);
      font-size: 14px;
      color: var(--color-primary-blue);
      resize: vertical;

      &::placeholder { color: var(--color-muted); }
      &:hover { border-color: var(--color-border); }
      &:focus { outline: none; border-color: var(--color-primary-blue); }
    }
    .btns { display: flex; gap: 10px; justify-content: flex-end; }
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
      &:hover { opacity: 0.88; }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }
  `],
})
export class RescheduleDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<RescheduleDialogComponent>);
  readonly data = inject<RescheduleDialogData>(MAT_DIALOG_DATA);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  readonly weekdays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  readonly selectedDate = signal<string>('');
  readonly chosen = signal<RescheduleSlotOption | null>(null);
  readonly calOpen = signal<boolean>(false);
  readonly calendarViewDate = signal<Date>(new Date());
  readonly reason = signal<string>('');

  /** Um pedido sem motivo não diz nada a quem o recebe — o backend recusa-o na mesma. */
  readonly canSubmit = computed(() =>
    this.chosen() !== null && (!this.data.asRequest || this.reason().trim().length > 0),
  );

  readonly slots = computed<RescheduleSlotOption[]>(() => {
    const date = this.selectedDate();
    return date ? this.data.slotsFor(date) : [];
  });

  /*
   * Mesmo calendário do Agendar (ver scheduling.component): campo com a data
   * escrita em dd/mm/aaaa e um popover com a grelha do mês. O input nativo que
   * estava aqui trazia o formato do locale do browser (mm/dd/yyyy) e o seu
   * próprio ícone, a somar ao nosso.
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

    // Completa a última semana para a grelha não ficar com buracos.
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
   * Fecha o calendário ao clicar fora dele.
   *
   * O botão do campo e o próprio popover já param a propagação do seu
   * mousedown (ver .field-wrap no template) — este listener só vê os
   * cliques que escaparam a essa área, ou seja, genuinamente de fora.
   */
  @HostListener('document:mousedown')
  onDocMousedown(): void {
    this.calOpen.set(false);
  }

  /**
   * Abre o calendário e traz a grelha para dentro do que se vê.
   *
   * O diálogo tem altura limitada e rola por dentro; o popover é absoluto e
   * fica preso a esse recorte, pelo que ao abrir nasce por baixo do fundo
   * visível — os dias só apareciam a quem se lembrasse de rolar o diálogo.
   */
  toggleCalendar(): void {
    const opening = !this.calOpen();
    this.calOpen.set(opening);
    if (!opening) return;

    // O popover só existe depois de o template correr.
    setTimeout(() => {
      this.elementRef.nativeElement
        .querySelector('.calendar-popover')
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  /** Um dia sem vagas para este serviço não é escolhível. */
  hasSlots(dateKey: string): boolean {
    return this.data.slotsFor(dateKey).length > 0;
  }

  fmtDate(key: string): string {
    const [y, m, d] = key.split('-');
    return `${d}/${m}/${y}`;
  }

  prevMonth(): void {
    const d = this.calendarViewDate();
    this.calendarViewDate.set(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  nextMonth(): void {
    const d = this.calendarViewDate();
    this.calendarViewDate.set(new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  isPast(date: Date): boolean {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return date < t;
  }

  isToday(date: Date): boolean {
    const t = new Date();
    return date.getFullYear() === t.getFullYear()
      && date.getMonth() === t.getMonth()
      && date.getDate() === t.getDate();
  }

  onDateChange(date: string): void {
    this.selectedDate.set(date);
    this.calOpen.set(false);
    // A vaga escolhida pertencia ao dia anterior; manter a seleção reagendaria
    // para um horário que já não está em vista.
    this.chosen.set(null);
  }

  isChosen(slot: RescheduleSlotOption): boolean {
    const c = this.chosen();
    return !!c && c.availabilityId === slot.availabilityId && c.startTime === slot.startTime;
  }

  cancel(): void {
    this.dialogRef.close(null);
  }

  submit(): void {
    const slot = this.chosen();
    const date = this.selectedDate();
    if (!slot || !date || !this.canSubmit()) return;

    this.dialogRef.close({
      availabilityId: slot.availabilityId,
      date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      modality: slot.modality,
      reason: this.data.asRequest ? this.reason().trim() : undefined,
    } satisfies RescheduleDialogResult);
  }
}
