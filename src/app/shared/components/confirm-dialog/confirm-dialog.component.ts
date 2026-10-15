import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

export interface ConfirmDialogData {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /**
   * When set, the dialog asks the person to pick one of these instead of
   * confirming: each renders as a full-width option and closes the dialog with
   * its `value`. `confirmLabel` is not used in this mode.
   */
  choices?: ConfirmDialogChoice[];
  /** When set, renders a required textarea and returns its value alongside the confirmation. */
  justificationLabel?: string;
  justificationPlaceholder?: string;
  /**
   * When set, the person has to type this word before the confirm button
   * unlocks. Case and accents don't matter ("publica" counts as "pública").
   * Its first occurrence in `message` is highlighted.
   */
  typeToConfirm?: string;
  /** Confirm button color: red for destructive actions (default), blue otherwise. */
  confirmTone?: 'danger' | 'primary';
}

/** "Pública " → "publica", so typing without accents still matches. */
export function foldWord(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

export interface ConfirmDialogChoice {
  value: string;
  label: string;
  /** One line under the label saying what this option does. */
  hint?: string;
  /** Material Symbols name. */
  icon?: string;
  /** Destructive option: tinted in the error color on hover. */
  danger?: boolean;
}

export interface ConfirmDialogResult {
  confirmed: true;
  justification: string;
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [ReactiveFormsModule, MatDialogModule],
  template: `
    <div class="dialog">
      <h3>{{ data.title ?? 'Confirmar exclusão' }}</h3>
      @if (messageParts; as parts) {
        <p class="body">{{ parts[0] }}<mark class="hl">{{ parts[1] }}</mark>{{ parts[2] }}</p>
      } @else {
        <p class="body">{{ data.message }}</p>
      }
      @if (data.typeToConfirm) {
        <label class="confirm-label" for="cd-type">
          Para confirmar, digite <mark class="hl">{{ data.typeToConfirm }}</mark>
        </label>
        <input
          id="cd-type"
          class="justification-input type-input"
          type="text"
          autocomplete="off"
          spellcheck="false"
          [formControl]="typedCtrl"
          (keydown.enter)="confirm()"
        />
      }
      @if (data.justificationLabel) {
        <p class="confirm-label">{{ data.justificationLabel }}</p>
        <textarea
          class="justification-input"
          rows="3"
          [formControl]="justificationCtrl"
          [placeholder]="data.justificationPlaceholder ?? ''"
        ></textarea>
      }
      @if (data.choices?.length) {
        <div class="choices">
          @for (choice of data.choices; track choice.value) {
            <button class="choice" [class.danger]="choice.danger" (click)="choose(choice.value)">
              @if (choice.icon) {
                <span translate="no" class="material-symbols-outlined ch-icon">{{ choice.icon }}</span>
              }
              <span class="ch-text">
                <span class="ch-label">{{ choice.label }}</span>
                @if (choice.hint) {
                  <span class="ch-hint">{{ choice.hint }}</span>
                }
              </span>
              <span translate="no" class="material-symbols-outlined ch-chev">chevron_right</span>
            </button>
          }
        </div>
        <div class="btns">
          <button class="btn-ghost" (click)="cancel()">{{ data.cancelLabel ?? 'Cancelar' }}</button>
        </div>
      } @else {
        <div class="btns">
          <button class="btn-ghost" (click)="cancel()">{{ data.cancelLabel ?? 'Cancelar' }}</button>
          <button
            class="btn-danger"
            [class.btn-primary]="data.confirmTone === 'primary'"
            [disabled]="!canConfirm()"
            (click)="confirm()"
          >{{ data.confirmLabel ?? 'Confirmar' }}</button>
        </div>
      }
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
      font-size: 15px;
      line-height: 1.55;
      color: var(--color-primary-blue);
      margin: 0 0 24px;
      text-align: left;
    }
    .confirm-label {
      font-size: 14px;
      line-height: 1.5;
      color: var(--color-primary-blue);
      margin: -14px 0 10px;
      text-align: left;
    }
    .justification-input {
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
      margin-bottom: 24px;
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
    .choices {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin: -8px 0 16px;
    }
    .choice {
      display: flex;
      align-items: center;
      gap: 14px;
      width: 100%;
      padding: 14px 16px;
      border-radius: var(--radius-lg);
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-primary-blue);
      font-family: var(--font-sans);
      text-align: left;
      cursor: pointer;
      transition: border-color 0.15s var(--ease-care), background 0.15s var(--ease-care);
      &:hover, &:focus-visible {
        border-color: var(--color-primary-blue);
        background: var(--color-surface-tint);
        outline: none;
      }
      &.danger:hover, &.danger:focus-visible {
        border-color: var(--color-error);
        background: color-mix(in srgb, var(--color-error) 6%, var(--color-surface));
        .ch-icon, .ch-label { color: var(--color-error); }
      }
    }
    .ch-icon {
      flex-shrink: 0;
      font-size: 22px;
      color: var(--color-primary-blue);
    }
    .ch-text {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .ch-label {
      font-size: 15px;
      font-weight: 700;
      line-height: 1.3;
    }
    .ch-hint {
      font-size: 13px;
      line-height: 1.4;
      color: var(--color-muted);
    }
    .ch-chev {
      flex-shrink: 0;
      font-size: 20px;
      color: var(--color-muted);
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
    .btn-primary { background: var(--color-primary-blue); }
    .confirm-label { display: block; }
    .type-input { resize: none; }
    .hl {
      padding: 1px 6px;
      border-radius: var(--radius-xs);
      background: color-mix(in srgb, var(--color-primary-purple) 22%, var(--color-surface));
      color: var(--color-primary-blue);
      font-weight: 700;
    }
  `],
})
export class ConfirmDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ConfirmDialogComponent>);
  readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
  readonly justificationCtrl = new FormControl('');
  readonly typedCtrl = new FormControl('');

  /** The message split around the word to type, so the template can highlight it. */
  readonly messageParts: [string, string, string] | null = this.splitMessage();

  private splitMessage(): [string, string, string] | null {
    const word = this.data.typeToConfirm;
    if (!word) return null;
    const at = this.data.message.toLowerCase().indexOf(word.toLowerCase());
    if (at < 0) return null;
    const end = at + word.length;
    return [this.data.message.slice(0, at), this.data.message.slice(at, end), this.data.message.slice(end)];
  }

  canConfirm(): boolean {
    if (this.data.justificationLabel && !this.justificationCtrl.value?.trim()) return false;
    if (this.data.typeToConfirm && foldWord(this.typedCtrl.value ?? '') !== foldWord(this.data.typeToConfirm)) {
      return false;
    }
    return true;
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  choose(value: string): void {
    this.dialogRef.close(value);
  }

  confirm(): void {
    if (!this.canConfirm()) return;
    if (!this.data.justificationLabel) {
      this.dialogRef.close(true);
      return;
    }

    const justification = this.justificationCtrl.value?.trim();
    if (!justification) return;

    this.dialogRef.close({ confirmed: true, justification } satisfies ConfirmDialogResult);
  }
}
