import { Component, computed, ElementRef, HostListener, inject, input, output, signal } from '@angular/core';

import { REMOTE_SESSION_INFO } from '../../../utils/remote-session.util';
import { dayKeyInZone, PickerSlot, timeInZone } from '../../../utils/picker-slots.util';

type Mod = 'LOCAL' | 'REMOTE';

const MOD: Record<Mod, { label: string; word: string; only: string; icon: string }> = {
  REMOTE: { label: 'Remoto', word: 'remoto', only: 'só remoto', icon: 'videocam' },
  LOCAL: { label: 'Presencial', word: 'presencial', only: 'só presencial', icon: 'place' },
};

const PT_MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export interface PickerChoice {
  slot: PickerSlot;
  modality: Mod;
}

/**
 * Escolher um horário entre disponibilidades (handoff: "AvailabilityPicker")
 * — o campo de data com o calendário e os cartões de horário do Agendar
 * (scheduling.component), sem o que é só do Agendar (preço, lugares, passo de
 * confirmação). Serve as entrevistas e o que vier a precisar do mesmo.
 *
 * Dias e horas no fuso de quem escolhe (timeZone = o do perfil), nunca no do
 * computador; o que segue para a API é a hora de parede da vaga, no slot.
 */
@Component({
  selector: 'app-availability-picker',
  standalone: true,
  templateUrl: './availability-picker.component.html',
  styleUrl: './availability-picker.component.scss',
})
export class AvailabilityPickerComponent {
  private readonly el = inject(ElementRef<HTMLElement>);

  readonly slots = input<PickerSlot[]>([]);
  readonly timeZone = input.required<string>();
  /** O horário já marcado (fica verde, com o botão "Marcada"). */
  readonly confirmedId = input<string | null>(null);
  readonly confirmedModality = input<Mod | null>(null);
  readonly busy = input(false);
  readonly fieldLabel = input('Escolha uma data');
  readonly modalityLabel = input('Como você prefere o atendimento');
  readonly confirmLabel = input('Confirmar');
  readonly confirmedLabel = input('Agendado');
  readonly footerLabel = input('Duração');
  readonly emptyText = input('Não há horários disponíveis no momento.');
  readonly choose = output<PickerChoice>();

  readonly weekdays = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
  readonly MOD = MOD;
  readonly remoteInfo = REMOTE_SESSION_INFO;

  readonly calOpen = signal(false);
  /** O mês à vista: [ano, mês 0-11]. */
  readonly month = signal<[number, number] | null>(null);
  readonly day = signal<string | null>(null);
  readonly expanded = signal<string | null>(null);
  readonly mods = signal<Record<string, Mod>>({});

  private readonly byDay = computed(() => {
    const map = new Map<string, PickerSlot[]>();
    for (const s of this.slots()) {
      const k = dayKeyInZone(s.start, this.timeZone());
      map.set(k, [...(map.get(k) ?? []), s]);
    }
    return map;
  });

  private readonly confirmed = computed(() => this.slots().find(s => s.id === this.confirmedId()) ?? null);

  /** O dia escolhido; sem escolha, o da marcação que já existe. */
  readonly selectedDay = computed(() => {
    const c = this.confirmed();
    return this.day() ?? (c ? dayKeyInZone(c.start, this.timeZone()) : null);
  });

  private readonly anchor = computed<[number, number]>(() => {
    const m = this.month();
    if (m) return m;
    const key = this.selectedDay() ?? (this.slots()[0] ? dayKeyInZone(this.slots()[0].start, this.timeZone()) : null);
    const [y, mo] = (key ?? dayKeyInZone(new Date(), this.timeZone())).split('-').map(Number);
    return [y, mo - 1];
  });

  readonly monthLabel = computed(() => {
    const [y, m] = this.anchor();
    return `${PT_MONTHS[m]} ${y}`;
  });

  /** As semanas do mês à vista, a começar à segunda. Só datas de calendário: sem fuso. */
  readonly cells = computed(() => {
    const [y, m] = this.anchor();
    const offset = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const weeks = Math.ceil((offset + daysInMonth) / 7);
    const today = dayKeyInZone(new Date(), this.timeZone());
    const out: { n: number; key: string; inMonth: boolean; has: boolean; disabled: boolean; today: boolean }[] = [];
    for (let i = 0; i < weeks * 7; i++) {
      const d = new Date(Date.UTC(y, m, 1 - offset + i));
      const key = d.toISOString().slice(0, 10);
      const inMonth = d.getUTCMonth() === m;
      const has = this.byDay().has(key);
      out.push({
        n: d.getUTCDate(),
        key,
        inMonth,
        has,
        disabled: key < today || !has || !inMonth,
        today: key === today,
      });
    }
    return out;
  });

  readonly dateValue = computed(() => {
    const d = this.selectedDay();
    if (!d) return null;
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  });

  readonly daySlots = computed(() => {
    const d = this.selectedDay();
    return d ? this.byDay().get(d) ?? [] : [];
  });

  @HostListener('document:mousedown', ['$event'])
  onDocDown(e: MouseEvent): void {
    if (this.calOpen() && !this.el.nativeElement.querySelector('.ap-date')?.contains(e.target as Node)) {
      this.calOpen.set(false);
    }
  }

  toggleCal(): void {
    if (!this.calOpen() && !this.month()) this.month.set(this.anchor());
    this.calOpen.update(v => !v);
  }

  shiftMonth(by: number): void {
    const [y, m] = this.anchor();
    const d = new Date(Date.UTC(y, m + by, 1));
    this.month.set([d.getUTCFullYear(), d.getUTCMonth()]);
  }

  pickDay(key: string): void {
    this.day.set(key);
    this.calOpen.set(false);
    this.expanded.set(null);
  }

  isConfirmed(s: PickerSlot): boolean {
    return s.id === this.confirmedId();
  }

  isOpen(s: PickerSlot): boolean {
    const e = this.expanded();
    return e === s.id || (e === null && this.isConfirmed(s));
  }

  toggle(s: PickerSlot): void {
    this.expanded.set(this.isOpen(s) ? '' : s.id);
  }

  chosen(s: PickerSlot): Mod {
    if (this.isConfirmed(s) && this.confirmedModality()) return this.confirmedModality()!;
    return this.mods()[s.id] ?? s.modalities[0];
  }

  setMod(s: PickerSlot, m: Mod): void {
    this.mods.update(all => ({ ...all, [s.id]: m }));
  }

  time(s: PickerSlot): string {
    return `${timeInZone(s.start, this.timeZone())} – ${timeInZone(s.end, this.timeZone())}`;
  }

  duration(s: PickerSlot): string {
    return `${Math.round((s.end.getTime() - s.start.getTime()) / 60000)} minutos`;
  }

  confirm(s: PickerSlot): void {
    if (this.isConfirmed(s) || this.busy()) return;
    this.choose.emit({ slot: s, modality: this.chosen(s) });
  }
}
