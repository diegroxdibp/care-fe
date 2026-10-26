import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ReviewApiService } from '../../services/review-api.service';
import { kindPath, plural, ReviewSummary, STAGE } from '../../../shared/models/review.model';
import { Pages } from '../../../shared/enums/pages.enum';
import { SessionService } from '../../../shared/services/session.service';
import { detectBrowserTimezone } from '../../../shared/utils/timezones.util';

/**
 * /meus-pedidos — os pedidos da pessoa (handoff: "Acompanhamento do Pedido",
 * lista): a candidatura e as propostas de serviço, cada uma com a etapa.
 */
@Component({
  selector: 'app-my-requests',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="cat-page">
      <section class="rv-col">
        <div class="rv-head">
          <h1>Meus pedidos</h1>
          <p class="rv-lead">O pedido para fazer parte da CARE e as propostas de serviço que você enviou, e em que etapa estão.</p>
        </div>
        @if (list(); as items) {
          @if (items.length) {
            <ul class="rv-list">
              @for (q of rows(); track q.key) {
                <li>
                  <a class="rv-list-row" [routerLink]="q.link">
                    <span class="rv-list-text">
                      <span class="cat-overline">{{ q.kind }}</span>
                      <span class="rv-list-title">{{ q.title }}</span>
                      @if (q.sub) {
                        <span class="rv-list-sub">{{ q.sub }}</span>
                      }
                    </span>
                    <span class="rv-badge" [class]="'rv-tone-' + q.tone"><span class="rv-dot"></span>{{ q.label }}</span>
                  </a>
                </li>
              }
            </ul>
          } @else {
            <p class="rv-empty">Você ainda não enviou nenhum pedido.</p>
            <a class="cat-link" [routerLink]="['/', Pages.JUNTE_SE]">Junte-se à CARE →</a>
          }
        } @else {
          <p class="rv-empty">Carregando…</p>
        }
      </section>
    </div>
  `,
})
export class MyRequestsComponent implements OnInit {
  private readonly api = inject(ReviewApiService);
  private readonly session = inject(SessionService);

  readonly Pages = Pages;
  readonly list = signal<ReviewSummary[] | null>(null);

  readonly rows = computed(() =>
    (this.list() ?? []).map(q => ({
      key: q.kind + q.id,
      link: ['/', Pages.MEUS_PEDIDOS, kindPath(q.kind), q.id],
      kind: (q.kind === 'APPLICATION' ? 'Candidatura' : 'Proposta de serviço')
        + (q.submittedAt ? ' · enviado a ' + this.day(q.submittedAt) : ''),
      title: q.title,
      sub: q.kind === 'APPLICATION' && q.proposals
        ? 'Com ' + plural(q.proposals, 'proposta de serviço', 'propostas de serviço')
        : '',
      ...STAGE[q.stage],
    })),
  );

  ngOnInit(): void {
    this.api.mine().subscribe({
      next: l => this.list.set(l),
      error: () => this.list.set([]),
    });
  }

  private day(at: string): string {
    return new Date(at).toLocaleDateString('pt-PT', {
      timeZone: this.session.user()?.timeZone || detectBrowserTimezone(),
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
}
