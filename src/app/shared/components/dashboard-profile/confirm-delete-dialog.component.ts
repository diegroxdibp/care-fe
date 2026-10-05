import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-confirm-delete-dialog',
  imports: [ReactiveFormsModule, MatDialogModule],
  template: `
    <div class="dialog">
      <h3>Apagar sua conta?</h3>
      <p class="body">
        Esta ação é permanente. Seus agendamentos serão cancelados e seu histórico clínico ficará indisponível.
      </p>
      <p class="confirm-label">
        Digite <strong>APAGAR</strong> para confirmar:
      </p>
      <input
        class="confirm-input"
        type="text"
        [formControl]="confirmCtrl"
        placeholder="APAGAR"
        autocomplete="off"
      />
      <div class="btns">
        <button class="btn-ghost" (click)="cancel()">Cancelar</button>
        <button class="btn-danger" [disabled]="confirmCtrl.value !== 'APAGAR'" (click)="confirm()">
          Apagar conta
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
      margin: 0 0 10px;
      line-height: 1.2;
    }
    .body {
      font-size: 15px !important;
      line-height: 1.55 !important;
      color: var(--color-primary-blue) !important;
      margin: 0 0 20px !important;
      text-align: left !important;
    }
    .confirm-label {
      font-size: 14px !important;
      line-height: 1.5 !important;
      color: var(--color-primary-blue) !important;
      margin: 0 0 10px !important;
      text-align: left !important;
    }
    .confirm-input {
      font-family: var(--font-sans);
      font-size: 16px;
      color: var(--color-primary-blue);
      padding: 13px 16px;
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border);
      background: #fff;
      outline: none;
      width: 100%;
      box-sizing: border-box;
      margin-bottom: 20px;
      transition: border-color 0.2s ease;
      &:focus { border-color: var(--color-primary-blue); }
      &::placeholder { color: var(--color-muted); }
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
export class ConfirmDeleteDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ConfirmDeleteDialogComponent>);
  readonly confirmCtrl = new FormControl('');

  cancel(): void {
    this.dialogRef.close(false);
  }

  confirm(): void {
    if (this.confirmCtrl.value === 'APAGAR') {
      this.dialogRef.close(true);
    }
  }
}
