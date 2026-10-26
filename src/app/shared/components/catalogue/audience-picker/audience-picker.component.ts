import { Component, computed, input, model, signal } from '@angular/core';

import { Audience } from '../../../models/catalogue.model';

/**
 * Escolher públicos da lista, ou propor um novo (fica "em aprovação" até a
 * equipa aprovar). Se o que se escreve já existe (sem contar maiúsculas),
 * escolhe-se esse em vez de propor.
 */
@Component({
  selector: 'app-audience-picker',
  standalone: true,
  template: `
    <div class="cat-chips" [class.cat-invalid]="invalid()" role="group" [attr.aria-label]="label()">
      @for (a of options(); track a.id) {
        <button type="button" class="cat-chip" [attr.aria-pressed]="isOn(a.id)" (click)="toggle(a.id)">
          {{ a.name }}
        </button>
      }
      @for (p of proposed(); track p) {
        <span class="cat-chip cat-chip--pending">
          {{ p }} <small>(em aprovação)</small>
          <button type="button" class="cat-chip-x" [attr.aria-label]="'Remover ' + p" (click)="removeProposed(p)">×</button>
        </span>
      }
    </div>
    <div class="cat-inline">
      <input
        class="cat-input"
        type="text"
        [value]="draft()"
        (input)="draft.set($any($event.target).value)"
        (keydown.enter)="$event.preventDefault(); propose()"
        placeholder="Não encontrou o público? Escreva aqui."
        [attr.aria-label]="'Propor novo público para ' + label()"
      />
      <button type="button" class="cat-btn-pill" [disabled]="!draft().trim()" (click)="propose()">Propor novo público</button>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
  `],
})
export class AudiencePickerComponent {
  readonly options = input<Audience[]>([]);
  readonly label = input('Público');
  readonly invalid = input(false);
  readonly selectedIds = model<number[]>([]);
  readonly proposed = model<string[]>([]);

  readonly draft = signal('');
  private readonly selected = computed(() => new Set(this.selectedIds()));

  isOn(id: number): boolean {
    return this.selected().has(id);
  }

  toggle(id: number): void {
    this.selectedIds.update(ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]));
  }

  propose(): void {
    const text = this.draft().trim();
    if (!text) return;
    const existing = this.options().find(a => a.name.toLocaleLowerCase('pt-BR') === text.toLocaleLowerCase('pt-BR'));
    if (existing) {
      if (!this.isOn(existing.id)) this.toggle(existing.id);
    } else if (!this.proposed().some(p => p.toLocaleLowerCase('pt-BR') === text.toLocaleLowerCase('pt-BR'))) {
      this.proposed.update(list => [...list, text]);
    }
    this.draft.set('');
  }

  removeProposed(p: string): void {
    this.proposed.update(list => list.filter(x => x !== p));
  }
}
