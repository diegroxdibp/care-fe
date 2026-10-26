import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';

import { CatalogueApiService } from '../../core/services/catalogue-api.service';
import { ReviewApiService } from '../../core/services/review-api.service';
import { CareService, CatalogueOptions, ChangeProposal } from '../../shared/models/catalogue.model';
import { kindPath, plural, ReviewSummary, STAGE } from '../../shared/models/review.model';
import { Pages } from '../../shared/enums/pages.enum';
import { SessionService } from '../../shared/services/session.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { ServiceViewComponent } from '../../shared/components/catalogue/service-view/service-view.component';
import { ServiceView, serviceViewFrom, serviceViewFromContent } from '../../shared/utils/catalogue-views.util';
import { detectBrowserTimezone } from '../../shared/utils/timezones.util';

/**
 * /admin/pedidos — a fila de aprovação (handoff: "Aprovação de Propostas",
 * fila): candidaturas e propostas de serviço por fechar ou fechadas há pouco,
 * cada uma com a etapa e quantos pontos estão aprovados. A análise de cada
 * uma abre em /admin/pedidos/:tipo/:id. Por baixo, as propostas de alteração
 * a serviços que já existem, que se decidem aqui (aprovar / recusar com nota).
 */
@Component({
  selector: 'app-admin-requests',
  standalone: true,
  imports: [RouterLink, ServiceViewComponent],
  templateUrl: './admin-requests.component.html',
})
export class AdminRequestsComponent implements OnInit {
  private readonly api = inject(CatalogueApiService);
  private readonly reviews = inject(ReviewApiService);
  private readonly snackbar = inject(SnackbarService);
  private readonly session = inject(SessionService);

  readonly queue = signal<ReviewSummary[] | null>(null);
  readonly changes = signal<ChangeProposal[]>([]);
  readonly options = signal<CatalogueOptions | null>(null);
  readonly notes = signal<Record<string, string>>({});
  readonly expanded = signal<string | null>(null);
  readonly busy = signal<string | null>(null);
  readonly errors = signal<Record<string, string>>({});

  readonly rows = computed(() =>
    (this.queue() ?? []).map(q => ({
      key: q.kind + q.id,
      link: ['/', ...Pages.ADMIN_PEDIDOS.split('/'), kindPath(q.kind), q.id],
      kindLine: (q.kind === 'APPLICATION' ? 'Candidatura' : 'Proposta de serviço')
        + (q.submittedAt ? ' · ' + this.day(q.submittedAt) : ''),
      title: q.title,
      sub: this.sub(q),
      progress: `${q.approved} de ${plural(q.points, 'ponto aprovado', 'pontos aprovados')}`
        + (q.denied ? ' · ' + plural(q.denied, 'negado', 'negados') : ''),
      ...STAGE[q.stage],
    })),
  );

  ngOnInit(): void {
    this.api.options().subscribe(o => this.options.set(o));
    this.load();
  }

  load(): void {
    this.reviews.queue().subscribe({
      next: q => this.queue.set(q),
      error: () => this.queue.set([]),
    });
    this.api.adminRequests().subscribe(r => this.changes.set(r.changeProposals));
  }

  private sub(q: ReviewSummary): string {
    if (q.kind === 'PROPOSAL') return q.proposedBy ? 'Proposto por ' + q.proposedBy : '';
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

  note(key: string): string {
    return this.notes()[key] ?? '';
  }

  setNote(key: string, value: string): void {
    this.notes.update(n => ({ ...n, [key]: value }));
  }

  toggle(key: string): void {
    this.expanded.update(k => (k === key ? null : key));
  }

  text(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  serviceView(s: CareService): ServiceView {
    return serviceViewFrom(s);
  }

  changeView(c: ChangeProposal): ServiceView {
    return serviceViewFromContent(c.proposed, this.options(), c.current.audiences);
  }

  private decide(key: string, approve: boolean, call: () => Observable<unknown>, done: string): void {
    if (!approve && !this.note(key).trim()) {
      this.errors.update(e => ({ ...e, [key]: 'Escreva uma nota para a pessoa saber o motivo.' }));
      return;
    }
    this.busy.set(key);
    this.errors.update(e => ({ ...e, [key]: '' }));
    call().subscribe({
      next: () => {
        this.busy.set(null);
        this.snackbar.openSnackBar({ message: done, action: true });
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(null);
        this.errors.update(e => ({ ...e, [key]: err?.error?.error ?? 'Não foi possível decidir.' }));
      },
    });
  }

  change(c: ChangeProposal, approve: boolean): void {
    const key = 'chg' + c.id;
    this.decide(key, approve, () => this.api.decideChange(c.id, approve, { note: this.note(key) || null }),
      approve ? 'Alterações aprovadas.' : 'Alterações recusadas.');
  }
}
