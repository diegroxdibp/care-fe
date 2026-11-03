import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { POINT_STATUS, ReviewDraft } from '../../../models/review.model';

export interface ReviewSendDialogData {
  /** O botão de concluir, como está na página ("Concluir e recusar pedido"...). */
  actionLabel: string;
  /** O que acontece com a decisão (o texto de ajuda junto do botão), ou vazio. */
  decisionText: string;
  /** Recusar tudo: o botão de confirmar fica vermelho. */
  danger: boolean;
  draft: ReviewDraft;
}

/**
 * Antes de concluir a análise: concluir envia à pessoa a decisão e todo o
 * rascunho da equipa (comentários e estados ainda por enviar). Mostra o que
 * vai, para a equipa confirmar ou voltar e mudar alguma coisa.
 */
@Component({
  selector: 'app-review-send-dialog',
  standalone: true,
  imports: [MatDialogModule],
  template: `
    <div class="dialog">
      <h3>{{ data.actionLabel }}?</h3>
      <p class="body">
        A pessoa recebe a decisão agora, junto com tudo o que está escrito abaixo. Depois de enviado, não dá para
        mudar o que foi escrito.
      </p>
      @if (data.decisionText) {
        <p class="body">{{ data.decisionText }}</p>
      }

      @if (empty) {
        <p class="none">Não há comentários nem mudanças de status por enviar.</p>
      } @else {
        @if (data.draft.statuses.length) {
          <h4>Status dos pontos</h4>
          <ul class="list">
            @for (s of data.draft.statuses; track $index) {
              <li>
                <span class="point">{{ s.point }}</span>
                <span class="change">{{ label(s.from) }} → <strong>{{ label(s.to) }}</strong></span>
              </li>
            }
          </ul>
        }
        @if (data.draft.comments.length) {
          <h4>Comentários</h4>
          <ul class="list">
            @for (c of data.draft.comments; track $index) {
              <li>
                <span class="point">{{ c.point }}</span>
                <span class="text">{{ c.text }}</span>
              </li>
            }
          </ul>
        }
      }

      <div class="btns">
        <button type="button" class="btn-ghost" (click)="ref.close(false)">Voltar e revisar</button>
        <button type="button" class="btn-confirm" [class.btn-confirm--danger]="data.danger" (click)="ref.close(true)">
          Concluir e enviar
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog {
      display: flex;
      flex-direction: column;
      gap: 14px;
      font-family: var(--font-sans);
      color: var(--fg-1);
    }
    h3 {
      font-size: 22px;
      font-weight: var(--fw-bold);
      color: var(--color-primary-blue);
      margin: 0;
      line-height: 1.2;
    }
    h4 {
      font-size: 13px;
      font-weight: var(--fw-bold);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--fg-1);
      margin: 6px 0 0;
    }
    .body,
    .none {
      font-size: 15px;
      line-height: 1.55;
      margin: 0;
      text-align: left;
    }
    .none {
      font-style: italic;
      color: var(--color-hint);
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin: 0;
      padding: 0;

      // styles.scss põe todos os li em flex centrado.
      li {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: flex-start;
        gap: 2px;
        padding: 10px 12px;
        border: 1px dashed var(--color-primary-purple);
        border-radius: var(--radius-md);
        font-style: normal;
        font-weight: var(--fw-regular);
        font-size: 15px;
        text-align: left;
      }
    }
    .point {
      font-size: 13px;
      font-weight: var(--fw-semibold);
      color: var(--color-primary-purple);
    }
    .text {
      white-space: pre-line;
      overflow-wrap: anywhere;
    }
    .btns {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      justify-content: flex-end;
      margin-top: 4px;
    }
    .btn-ghost,
    .btn-confirm {
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
    .btn-confirm {
      background: var(--color-primary-blue);
      color: var(--fg-on-dark);
      &:hover { opacity: 0.88; }
      &.btn-confirm--danger { background: var(--color-error); }
    }
  `],
})
export class ReviewSendDialogComponent {
  readonly ref = inject(MatDialogRef<ReviewSendDialogComponent, boolean>);
  readonly data = inject<ReviewSendDialogData>(MAT_DIALOG_DATA);

  readonly empty = !this.data.draft.comments.length && !this.data.draft.statuses.length;

  label(status: keyof typeof POINT_STATUS): string {
    return POINT_STATUS[status].label;
  }
}
