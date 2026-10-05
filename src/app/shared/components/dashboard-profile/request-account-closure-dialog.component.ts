import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-request-account-closure-dialog',
  imports: [ReactiveFormsModule, MatDialogModule],
  template: `
    <div class="dialog">
      <h3>Encerrar sua conta</h3>
      <p class="body">
        Você tem sessões agendadas com pacientes, por isso não podemos apagar sua conta de imediato.
        Explique o motivo abaixo — a equipe Care vai entrar em contato com você em breve para combinar sua saída.
      </p>
      <p class="confirm-label">Motivo:</p>
      <textarea
        class="reason-input"
        rows="4"
        [formControl]="reasonCtrl"
        placeholder="Por que você quer encerrar sua conta?"
      ></textarea>
      <div class="btns">
        <button class="btn-ghost" (click)="cancel()">Cancelar</button>
        <button class="btn-danger" [disabled]="reasonCtrl.invalid" (click)="proceed()">
          Prosseguir
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
    .reason-input {
      font-family: var(--font-sans);
      font-size: 15px;
      color: var(--color-primary-blue);
      padding: 13px 16px;
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border);
      background: #fff;
      outline: none;
      width: 100%;
      box-sizing: border-box;
      margin-bottom: 20px;
      resize: vertical;
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
export class RequestAccountClosureDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<RequestAccountClosureDialogComponent>);
  readonly reasonCtrl = new FormControl('', [Validators.required, Validators.minLength(1)]);

  cancel(): void {
    this.dialogRef.close(null);
  }

  proceed(): void {
    if (this.reasonCtrl.invalid) return;
    this.dialogRef.close(this.reasonCtrl.value);
  }
}
