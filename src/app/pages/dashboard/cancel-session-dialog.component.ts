import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CancellationScope } from '../../shared/utils/cancellation.util';

export interface CancelSessionDialogData {
  /** Ex.: "segunda-feira, 10 de agosto". Ancora a escolha numa data concreta. */
  occurrenceLabel: string;
  /** Quando definido, pede (obrigatória) a mensagem que segue para a pessoa cliente. */
  justificationLabel?: string;
  justificationPlaceholder?: string;
}

export type CancelSessionScope = CancellationScope;

export interface CancelSessionDialogResult {
  scope: CancelSessionScope;
  justification?: string;
}

/**
 * Cancelamento de uma sessão que faz parte de uma série recorrente: é preciso
 * dizer se cai só esta ocorrência ou também as seguintes. O predefinido é só
 * esta - é o menos destrutivo dos dois.
 */
@Component({
  selector: 'app-cancel-session-dialog',
  imports: [ReactiveFormsModule, MatDialogModule],
  template: `
    <div class="dialog">
      <h3>Cancelar sessão</h3>
      <p class="body">
        Esta sessão faz parte de uma série recorrente. O que deseja cancelar?
      </p>

      <label class="opt">
        <input type="radio" value="SINGLE" [formControl]="scopeCtrl" />
        <span>
          <strong>Apenas esta sessão</strong>
          <small>{{ data.occurrenceLabel }}. As demais se mantêm.</small>
        </span>
      </label>

      <label class="opt">
        <input type="radio" value="THIS_AND_FOLLOWING" [formControl]="scopeCtrl" />
        <span>
          <strong>Esta e todas as seguintes</strong>
          <small>Encerra a série a partir desta data. As sessões passadas se mantêm.</small>
        </span>
      </label>

      @if (data.justificationLabel) {
        <p class="confirm-label">{{ data.justificationLabel }}</p>
        <textarea
          class="justification-input"
          rows="3"
          [formControl]="justificationCtrl"
          [placeholder]="data.justificationPlaceholder ?? ''"
        ></textarea>
      }

      <div class="btns">
        <button class="btn-ghost" (click)="cancel()">Voltar</button>
        <button
          class="btn-danger"
          [disabled]="data.justificationLabel && !justificationCtrl.value.trim()"
          (click)="confirm()"
        >Cancelar sessão</button>
      </div>
    </div>
  `,
  styles: [`
    .dialog {
      width: 100%;
      max-width: 460px;
      padding: 8px 0 0;
      box-sizing: border-box;
      font-family: var(--font-sans);
    }
    h3 {
      font-size: 22px;
      font-weight: 700;
      color: var(--color-primary-blue);
      margin: 0 0 10px;
      line-height: 1.2;
    }
    .body {
      font-size: 15px !important;
      line-height: 1.55 !important;
      color: var(--color-primary-blue) !important;
      margin: 0 0 18px !important;
      text-align: left !important;
    }
    .opt {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 14px;
      margin-bottom: 10px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: border-color 0.2s ease, background 0.2s ease;
    }
    .opt:hover { background: var(--color-surface-tint); }
    .opt:has(input:checked) { border-color: var(--color-primary-blue); }
    .opt input { margin-top: 3px; flex-shrink: 0; }
    .opt span { display: flex; flex-direction: column; gap: 3px; }
    .opt strong {
      font-size: 15px;
      font-weight: 600;
      color: var(--color-primary-blue);
    }
    .opt small {
      font-size: 13px;
      line-height: 1.45;
      color: var(--color-muted);
    }
    .confirm-label {
      font-size: 14px;
      line-height: 1.5;
      color: var(--color-primary-blue);
      margin: 8px 0 10px;
      text-align: left;
    }
    .justification-input {
      font-family: var(--font-sans);
      font-size: 15px;
      color: var(--color-primary-blue);
      padding: 13px 16px;
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      outline: none;
      width: 100%;
      box-sizing: border-box;
      resize: vertical;
      transition: border-color 0.2s ease;
      &:focus { border-color: var(--color-primary-blue); }
      &::placeholder { color: var(--color-muted); }
    }
    .btns {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      margin-top: 18px;
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
    .btn-danger {
      padding: 12px 22px;
      border-radius: var(--radius-md);
      border: 0;
      background: #c0392b;
      color: #fff;
      font-family: var(--font-sans);
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      cursor: pointer;
      transition: opacity 0.2s ease;
      &:hover:not(:disabled) { opacity: 0.88; }
      &:disabled { opacity: 0.4; cursor: not-allowed; }
    }
  `],
})
export class CancelSessionDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<CancelSessionDialogComponent>);
  readonly data = inject<CancelSessionDialogData>(MAT_DIALOG_DATA);

  readonly scopeCtrl = new FormControl<CancelSessionScope>('SINGLE', { nonNullable: true });
  readonly justificationCtrl = new FormControl('', { nonNullable: true });

  cancel(): void {
    this.dialogRef.close(null);
  }

  confirm(): void {
    const result: CancelSessionDialogResult = { scope: this.scopeCtrl.value };
    if (this.data.justificationLabel) {
      const justification = this.justificationCtrl.value.trim();
      if (!justification) return;
      result.justification = justification;
    }
    this.dialogRef.close(result);
  }
}
