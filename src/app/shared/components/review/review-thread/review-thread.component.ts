import { Component, computed, inject, input, output, signal } from '@angular/core';

import { ReviewStatus } from '../../../models/catalogue.model';
import { POINT_STATUS, ReviewPoint } from '../../../models/review.model';
import { SessionService } from '../../../services/session.service';
import { detectBrowserTimezone } from '../../../utils/timezones.util';

/**
 * Um ponto de revisão (handoff: "ReviewThread"): a barra com o estado e o
 * número de comentários e, aberta, os estados (só a equipa os muda), a
 * conversa e a caixa para comentar. Sem estado nos comentários gerais.
 */
@Component({
  selector: 'app-review-thread',
  standalone: true,
  template: `
    <div class="rv-thread" [class]="'rv-tone-' + tone()" [class.rv-thread--tucked]="tucked()">
      <button type="button" class="rv-thread-head" [attr.aria-expanded]="isOpen()" (click)="toggle()">
        @if (showStatus()) {
          <span class="rv-badge"><span class="rv-dot"></span>{{ statusLabel() }}</span>
        }
        <span class="rv-thread-label">{{ point().label }}</span>
        <span class="rv-thread-count">{{ countLabel() }}</span>
        <span translate="no" aria-hidden="true" class="material-symbols-outlined" [class.invert]="isOpen()"
          >expand_more</span
        >
      </button>
      @if (isOpen()) {
        <div class="rv-thread-body">
          @if (showStatus() && team()) {
            <div class="rv-thread-status">
              <span class="rv-field-label">Status deste ponto</span>
              <div class="rv-choices">
                @for (s of statuses; track s.key) {
                  <button
                    type="button"
                    class="rv-choice"
                    [class]="'rv-tone-' + s.tone"
                    [attr.aria-pressed]="point().status === s.key"
                    [disabled]="busy() || locked()"
                    (click)="statusChange.emit(s.key)"
                  >
                    <span class="rv-dot"></span>{{ s.label }}
                  </button>
                }
              </div>
            </div>
          } @else if (showStatus()) {
            <p class="rv-intro">O status deste ponto é definido pela equipe da CARE.</p>
          }
          <div class="rv-comments">
            @for (c of point().comments; track $index) {
              <div class="rv-comment" [class.rv-comment--team]="c.fromTeam">
                <div class="rv-comment-meta">
                  <span class="rv-comment-author">{{ c.author }}</span>
                  <span class="rv-comment-when">{{ when(c.at) }}</span>
                </div>
                <p class="rv-comment-text">{{ c.text }}</p>
              </div>
            } @empty {
              <p class="rv-empty">
                {{ showStatus() ? 'Ainda não há comentários neste ponto.' : 'Ainda não há comentários gerais.' }}
              </p>
            }
          </div>
          <div class="rv-compose">
            <textarea
              class="cat-input"
              rows="3"
              aria-label="Escrever comentário"
              [placeholder]="team() ? 'Comentário para a pessoa profissional' : 'Responder à equipe da CARE'"
              [value]="draft()"
              (input)="draft.set($any($event.target).value)"
            ></textarea>
            <div class="rv-compose-actions">
              <button type="button" class="rv-btn" [disabled]="!draft().trim() || busy()" (click)="send()">
                Enviar comentário
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class ReviewThreadComponent {
  private readonly session = inject(SessionService);

  readonly point = input.required<ReviewPoint>();
  /** A equipa muda o estado; a pessoa só comenta. */
  readonly team = input(false);
  readonly defaultOpen = input(false);
  /** Junto da secção da página a que pertence (sobe para a encostar). */
  readonly tucked = input(false);
  readonly busy = input(false);
  /** Com o pedido fechado, o estado já não muda. */
  readonly locked = input(false);
  readonly statusChange = output<ReviewStatus>();
  readonly comment = output<string>();

  readonly statuses = (['PENDING', 'APPROVED', 'REJECTED'] as ReviewStatus[]).map(key => ({
    key,
    ...POINT_STATUS[key],
  }));

  readonly open = signal<boolean | null>(null);
  readonly draft = signal('');

  readonly showStatus = computed(() => this.point().status !== null);
  readonly isOpen = computed(() => this.open() ?? this.defaultOpen());
  readonly tone = computed(() => {
    const s = this.point().status;
    return s ? POINT_STATUS[s].tone : 'muted';
  });
  readonly statusLabel = computed(() => POINT_STATUS[this.point().status ?? 'PENDING'].label);
  readonly countLabel = computed(() => {
    const n = this.point().comments.length;
    return n === 0 ? 'Sem comentários' : n === 1 ? '1 comentário' : `${n} comentários`;
  });

  toggle(): void {
    this.open.set(!this.isOpen());
  }

  send(): void {
    const text = this.draft().trim();
    if (!text) return;
    this.comment.emit(text);
    this.draft.set('');
  }

  /** Data e hora no fuso do perfil de quem lê (não no do computador). */
  when(at: string): string {
    return new Date(at).toLocaleString('pt-PT', {
      timeZone: this.session.user()?.timeZone || detectBrowserTimezone(),
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
