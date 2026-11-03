import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ReviewApiService } from '../../core/services/review-api.service';
import { KIND_LABEL, kindPath, plural, ReviewSummary, STAGE } from '../../shared/models/review.model';
import { Pages } from '../../shared/enums/pages.enum';
import { SessionService } from '../../shared/services/session.service';
import { detectBrowserTimezone } from '../../shared/utils/timezones.util';

/**
 * /admin/pedidos — a fila de aprovação (handoff: "Aprovação de Propostas",
 * fila): candidaturas e propostas de serviço por fechar ou fechadas há pouco,
 * cada uma com a etapa e quantos pontos estão aprovados. A análise de cada
 * uma abre em /admin/pedidos/:tipo/:id. As propostas de alteração a serviços
 * publicados entram na mesma fila e analisam-se da mesma forma.
 */
@Component({
  selector: 'app-admin-requests',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-requests.component.html',
})
export class AdminRequestsComponent implements OnInit {
  private readonly reviews = inject(ReviewApiService);
  private readonly session = inject(SessionService);

  readonly queue = signal<ReviewSummary[] | null>(null);

  readonly rows = computed(() =>
    (this.queue() ?? []).map(q => ({
      key: q.kind + q.id,
      link: ['/', ...Pages.ADMIN_PEDIDOS.split('/'), kindPath(q.kind), q.id],
      kindLine: KIND_LABEL[q.kind] + (q.submittedAt ? ' · ' + this.day(q.submittedAt) : ''),
      title: q.title,
      sub: this.sub(q),
      progress: `${q.approved} de ${plural(q.points, 'ponto aprovado', 'pontos aprovados')}`
        + (q.denied ? ' · ' + plural(q.denied, 'negado', 'negados') : ''),
      ...STAGE[q.stage],
    })),
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.reviews.queue().subscribe({
      next: q => this.queue.set(q),
      error: () => this.queue.set([]),
    });
  }

  private sub(q: ReviewSummary): string {
    if (q.kind !== 'APPLICATION') return q.proposedBy ? 'Proposto por ' + q.proposedBy : '';
    return q.proposals ? 'Com ' + plural(q.proposals, 'proposta de serviço', 'propostas de serviço') : 'Sem propostas de serviço';
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
