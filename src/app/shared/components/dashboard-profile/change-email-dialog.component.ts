import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { UserService } from '../../services/user.service';
import { EmailChangeStatus } from '../../models/email-change-status.model';

export interface ChangeEmailDialogData {
  currentEmail: string;
}

/**
 * Pede o email novo e a senha atual. O email da conta não muda aqui: o
 * backend envia um link para o email novo, e a troca só acontece quando a
 * pessoa o abre (EmailChangeService). Fecha com o novo estado do pedido.
 */
@Component({
  selector: 'app-change-email-dialog',
  imports: [ReactiveFormsModule, MatDialogModule],
  template: `
    <form class="dialog" (submit)="submit($event)" novalidate>
      <h3>Alterar email</h3>
      <p class="body">
        Vamos enviar um link de confirmação para o novo email. Até você abrir o link, sua conta continua com
        <strong>{{ data.currentEmail }}</strong>.
      </p>

      <div class="field">
        <label for="ce-email">Novo email</label>
        <input
          id="ce-email"
          type="email"
          autocomplete="email"
          [formControl]="emailCtrl"
          [class.has-error]="emailCtrl.touched && emailCtrl.invalid"
        />
        @if (emailCtrl.touched && emailCtrl.invalid) {
          <span class="field-error">Informe um email válido.</span>
        }
      </div>

      <div class="field">
        <label for="ce-password">Senha atual</label>
        <input
          id="ce-password"
          type="password"
          autocomplete="current-password"
          [formControl]="passwordCtrl"
          [class.has-error]="passwordCtrl.touched && passwordCtrl.invalid"
        />
        @if (passwordCtrl.touched && passwordCtrl.invalid) {
          <span class="field-error">Informe sua senha atual.</span>
        }
      </div>

      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }

      <div class="btns">
        <button type="button" class="btn-ghost" (click)="ref.close()">Cancelar</button>
        <button type="submit" class="btn-primary" [disabled]="busy()">
          {{ busy() ? 'Enviando…' : 'Enviar link' }}
        </button>
      </div>
    </form>
  `,
  styles: [`
    .dialog {
      display: flex;
      flex-direction: column;
      gap: 16px;
      font-family: var(--font-sans);
    }
    h3 {
      font-size: 22px;
      font-weight: var(--fw-bold);
      color: var(--color-primary-blue);
      margin: 0;
      line-height: 1.2;
    }
    .body {
      font-size: 15px;
      line-height: 1.55;
      color: var(--fg-1);
      margin: 0;
      text-align: left;
      overflow-wrap: anywhere;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 8px;

      label {
        font-size: 15px;
        font-weight: var(--fw-medium);
        color: var(--fg-1);
      }

      input {
        font-family: var(--font-sans);
        font-size: 16px;
        color: var(--fg-1);
        padding: 13px 16px;
        border-radius: var(--radius-md);
        border: 1px solid var(--color-border);
        background: var(--color-white);
        outline: none;
        width: 100%;
        box-sizing: border-box;
        transition: border-color var(--dur-fast) ease;

        &:focus { border-color: var(--color-primary-blue); }
        &.has-error { border-color: var(--color-error); }
      }
    }
    .field-error,
    .error {
      font-size: 13.5px;
      color: var(--color-error);
      margin: 0;
    }
    .btns {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }
    .btn-ghost,
    .btn-primary {
      padding: 12px 22px;
      border-radius: var(--radius-md);
      border: 0;
      font-family: var(--font-sans);
      font-size: 14px;
      font-weight: var(--fw-bold);
      letter-spacing: 0.06em;
      text-transform: uppercase;
      cursor: pointer;
    }
    .btn-ghost {
      background: transparent;
      color: var(--color-primary-blue);
      &:hover { background: var(--color-surface-tint); }
    }
    .btn-primary {
      background: var(--color-primary-blue);
      color: var(--fg-on-dark);
      &:hover:not(:disabled) { opacity: 0.88; }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }
  `],
})
export class ChangeEmailDialogComponent {
  readonly ref = inject(MatDialogRef<ChangeEmailDialogComponent, EmailChangeStatus>);
  readonly data = inject<ChangeEmailDialogData>(MAT_DIALOG_DATA);
  private readonly userService = inject(UserService);

  readonly emailCtrl = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] });
  readonly passwordCtrl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  submit(event: Event): void {
    event.preventDefault();
    if (this.emailCtrl.invalid || this.passwordCtrl.invalid) {
      this.emailCtrl.markAsTouched();
      this.passwordCtrl.markAsTouched();
      return;
    }
    this.error.set(null);
    this.busy.set(true);
    this.userService.requestEmailChange(this.emailCtrl.value.trim(), this.passwordCtrl.value).subscribe({
      next: status => this.ref.close(status),
      error: err => {
        this.busy.set(false);
        this.error.set(err.error?.error ?? 'Não foi possível pedir a troca de email. Tente novamente.');
      },
    });
  }
}
