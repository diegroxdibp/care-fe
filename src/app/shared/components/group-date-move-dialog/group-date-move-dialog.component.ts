import { Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { AvailabilityModel } from '../../models/availability.model';
import { availabilityOccursOn } from '../../utils/free-slots.util';
import { isWallTimePast } from '../../utils/timezones.util';

export interface GroupDateMoveDialogData {
  /** "terça, 27/10 · 18:00" — a data que muda. */
  fromLabel: string;
  fromAvailabilityId: number;
  fromDate: string;
  /** Quantas pessoas têm lugar nessa data — todas têm de caber no destino. */
  people: number;
  /** As vagas de grupo desta pessoa profissional, frescas do servidor. */
  groupSlots: AvailabilityModel[];
}

export interface GroupDateMoveDialogResult {
  targetAvailabilityId: number;
  targetDate: string;
}

/**
 * Para onde muda uma data de um grupo: outra data e hora numa vaga de grupo
 * da própria pessoa profissional, com lugar para todas as pessoas. Cada uma é
 * reagendada e avisada como num reagendamento individual.
 */
@Component({
  selector: 'app-group-date-move-dialog',
  standalone: true,
  imports: [MatDialogModule],
  template: `
    <div class="dialog">
      <h3>Mudar a data do grupo</h3>
      <p class="sub">{{ data.fromLabel }} · {{ data.people }} {{ data.people === 1 ? 'pessoa' : 'pessoas' }}</p>
      <p class="note">
        Cada pessoa com lugar nessa data é reagendada e avisada, como num reagendamento individual.
      </p>

      <div class="field">
        <div class="field-inner">
          <span class="field-label">Nova data</span>
          <input class="field-value" type="date" [value]="date()" (input)="pickDate($any($event.target).value)" />
        </div>
      </div>

      @if (date()) {
        <label class="field-label">Horário</label>
        @if (options().length === 0) {
          <p class="hint">Nenhuma vaga de grupo sua nesse dia tem lugar para {{ data.people }}.</p>
        } @else {
          <div class="chips">
            @for (o of options(); track o.slot.id) {
              <button type="button" class="chip" [class.on]="targetId() === o.slot.id" (click)="targetId.set(o.slot.id)">
                {{ o.slot.startTime.slice(0, 5) }}–{{ o.slot.endTime.slice(0, 5) }} · {{ o.free }} livres
              </button>
            }
          </div>
        }
      }

      <div class="btns">
        <button class="btn-ghost" (click)="dialogRef.close(null)">Cancelar</button>
        <button class="btn-primary" [disabled]="!canSubmit()" (click)="submit()">Mudar data</button>
      </div>
    </div>
  `,
  styleUrl: '../propose-recurring-dialog/recurring-dialog.scss',
})
export class GroupDateMoveDialogComponent {
  readonly dialogRef = inject(MatDialogRef<GroupDateMoveDialogComponent>);
  readonly data = inject<GroupDateMoveDialogData>(MAT_DIALOG_DATA);

  readonly date = signal<string>('');
  readonly targetId = signal<number | null>(null);

  /** As vagas de grupo que abrem nesse dia, ainda por vir, com lugar para todas as pessoas. */
  readonly options = computed(() => {
    const key = this.date();
    if (!key) return [];
    return this.data.groupSlots
      .filter(slot => !(slot.id === this.data.fromAvailabilityId && key === this.data.fromDate))
      .filter(slot => availabilityOccursOn(slot, key))
      .filter(slot => !isWallTimePast(key, slot.startTime.slice(0, 5), slot.timeZone))
      .map(slot => ({ slot, free: (slot.capacity ?? 1) - (slot.seatsTaken?.[key] ?? 0) }))
      .filter(o => o.free >= this.data.people)
      .sort((a, b) => a.slot.startTime.localeCompare(b.slot.startTime));
  });

  readonly canSubmit = computed(() =>
    this.targetId() !== null && this.options().some(o => o.slot.id === this.targetId()),
  );

  pickDate(value: string): void {
    this.date.set(value);
    this.targetId.set(null);
    const only = this.options();
    if (only.length === 1) this.targetId.set(only[0].slot.id);
  }

  submit(): void {
    const targetAvailabilityId = this.targetId();
    if (targetAvailabilityId === null || !this.canSubmit()) return;
    this.dialogRef.close({ targetAvailabilityId, targetDate: this.date() } satisfies GroupDateMoveDialogResult);
  }
}
