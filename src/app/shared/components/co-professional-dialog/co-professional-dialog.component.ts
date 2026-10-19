import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { ApiService } from '../../../core/services/api.service';
import { ProfessionalSummary } from '../../models/co-professional.model';
import { StyledSelectComponent, StyledSelectOption } from '../styled-select/styled-select.component';

export interface CoProfessionalScope {
  value: string;
  label: string;
}

export interface CoProfessionalDialogData {
  /** O que se partilha: "Quinta · 18:00–19:30 · grupo". */
  contextLabel: string;
  /** Uma ou mais opções (a vaga inteira, esta série, só esta data…). */
  scopes: CoProfessionalScope[];
  /** Passar a vaga em vez de convidar — muda o texto e pede "fico como co-profissional". */
  transfer?: boolean;
}

export interface CoProfessionalDialogResult {
  professionalId: number;
  scope: string;
  message?: string;
  /** Só ao passar a vaga. */
  oldOwnerStays?: boolean;
}

/**
 * Escolher outra pessoa profissional: para tomar parte nas sessões
 * (co-profissional) ou para ficar com a vaga. A lista só mostra nomes.
 */
@Component({
  selector: 'app-co-professional-dialog',
  standalone: true,
  imports: [MatDialogModule, StyledSelectComponent],
  template: `
    <div class="dialog">
      <h3>{{ data.transfer ? 'Passar a vaga' : 'Adicionar co-profissional' }}</h3>
      <p class="sub">{{ data.contextLabel }}</p>
      <p class="note">
        @if (data.transfer) {
          A outra pessoa tem de aceitar. A vaga, as sessões e os convites em aberto passam para ela, e as pessoas clientes são avisadas.
        } @else {
          A outra pessoa tem de aceitar. Fica ocupada a essas horas, entra nas sessões como quem conduz e acompanha o prontuário dessas pessoas clientes. Só você muda ou cancela as sessões.
        }
      </p>

      <label class="field-label" for="co-pro-select">Pessoa profissional</label>
      @if (loading()) {
        <p class="hint">Carregando...</p>
      } @else if (options().length === 0) {
        <p class="hint">Ainda não há outras pessoas profissionais na Care.</p>
      } @else {
        <div class="select-wrap">
          <app-styled-select
            inputId="co-pro-select"
            placeholder="Selecione"
            searchPlaceholder="Pesquisar..."
            [options]="options()"
            [value]="professionalId() !== null ? String(professionalId()) : null"
            (valueChange)="professionalId.set(+$event)"
          />
        </div>
      }

      @if (data.scopes.length > 1) {
        <label class="field-label">Em quê</label>
        <div class="chips">
          @for (s of data.scopes; track s.value) {
            <button type="button" class="chip" [class.on]="scope() === s.value" (click)="scope.set(s.value)">{{ s.label }}</button>
          }
        </div>
      }

      @if (data.transfer) {
        <label class="check">
          <input type="checkbox" [checked]="stays()" (change)="stays.set($any($event.target).checked)" />
          Continuar como co-profissional
        </label>
      } @else {
        <div class="field field-textarea">
          <div class="field-inner">
            <span class="field-label">Mensagem (opcional)</span>
            <textarea class="field-value" maxlength="2000" [value]="message()"
                      (input)="message.set($any($event.target).value)"></textarea>
          </div>
        </div>
      }

      <div class="btns">
        <button class="btn-ghost" (click)="dialogRef.close(null)">Cancelar</button>
        <button class="btn-primary" [disabled]="professionalId() === null" (click)="submit()">Enviar pedido</button>
      </div>
    </div>
  `,
  styleUrl: '../propose-recurring-dialog/recurring-dialog.scss',
})
export class CoProfessionalDialogComponent implements OnInit {
  readonly dialogRef = inject(MatDialogRef<CoProfessionalDialogComponent>);
  readonly data = inject<CoProfessionalDialogData>(MAT_DIALOG_DATA);
  private readonly apiService = inject(ApiService);

  readonly String = String;
  readonly professionals = signal<ProfessionalSummary[]>([]);
  readonly loading = signal(true);
  readonly professionalId = signal<number | null>(null);
  readonly scope = signal<string>(this.data.scopes[0]?.value ?? '');
  readonly message = signal('');
  readonly stays = signal(false);

  readonly options = computed<StyledSelectOption[]>(() =>
    this.professionals().map(p => ({ value: String(p.id), label: p.name })),
  );

  ngOnInit(): void {
    this.apiService.getCoProfessionalCandidates().subscribe({
      next: (list) => {
        this.professionals.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  submit(): void {
    const professionalId = this.professionalId();
    if (professionalId === null) return;
    this.dialogRef.close({
      professionalId,
      scope: this.scope(),
      message: this.message().trim() || undefined,
      oldOwnerStays: this.data.transfer ? this.stays() : undefined,
    } satisfies CoProfessionalDialogResult);
  }
}
