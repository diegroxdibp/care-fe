import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';

import { CatalogueApiService } from '../../../../core/services/catalogue-api.service';
import {
  CareService,
  ChangeProposal,
  CatalogueOptions,
  contentOf,
  emptyServiceContent,
  proposalContentOf,
  ServiceContent,
} from '../../../models/catalogue.model';
import { Pages } from '../../../enums/pages.enum';
import { SnackbarService } from '../../../services/snackbar.service';
import { MyRequestsService } from '../../../../core/services/my-requests.service';
import { InUseFix, inUseFix, missingServiceFields } from '../../../utils/catalogue.util';
import { serviceViewFromContent } from '../../../utils/catalogue-views.util';
import { FormPreviewComponent } from '../form-preview/form-preview.component';
import { ServiceFieldsComponent } from '../service-fields/service-fields.component';

/**
 * Painel → Os meus serviços → Propor um serviço (sem :serviceId) ou Propor
 * alterações (com :serviceId, a um serviço que se oferece). Fica à espera da
 * equipa da CARE; a resposta chega por notificação e email. Com ?rever=:id,
 * revê um pedido que a equipa devolveu para alterações (e volta ao
 * acompanhamento dele): uma proposta (sem :serviceId) ou uma proposta de
 * alteração (com :serviceId).
 */
@Component({
  selector: 'app-service-proposal-page',
  standalone: true,
  imports: [ServiceFieldsComponent, FormPreviewComponent, RouterLink],
  template: `
    <div class="cat-form-page">
      <div class="cat-form-layout">
        <div class="cat-card">
          @if (trackingLink(); as back) {
            <a class="cat-link" [routerLink]="back">← Acompanhamento do pedido</a>
          } @else {
            <a class="cat-link" [routerLink]="['/', 'dashboard', 'servicos']">← Meus serviços</a>
          }
          <h1>
            {{ revising() ? 'Revisar a proposta'
              : revisingChange() ? 'Revisar as alterações em ' + current()?.name
              : current() ? 'Propor alterações em ' + current()!.name : 'Propor um serviço' }}
          </h1>
          <p class="cat-hint">
            @if (revising() || revisingChange()) {
              A equipe da CARE pediu alterações: veja os comentários no acompanhamento do pedido, revise e envie de novo.
              A análise continua a partir daí.
            } @else if (current()) {
              A equipe da CARE revisa as alterações antes de elas aparecerem na página. Formatos, modalidades, visibilidades ou
              especialidades que alguém já usa não podem ser removidos; públicos novos entram como especialidade.
              Se só você oferece este serviço, pode mudar tudo isso desde que nenhuma sessão já marcada deixe de caber.
            } @else {
              O serviço entra na lista da CARE quando a equipe aprová-lo — ele fica então ativo em Meus serviços, e outras
              pessoas profissionais também podem oferecê-lo.
            }
          </p>
          @if (ready()) {
            <app-service-fields
              [value]="content()"
              (valueChange)="content.set($event)"
              [attempted]="attempted()"
              [audiences]="options()?.audiences ?? []"
            />
            @if (attempted() && missing().length) {
              <p class="cat-error-box" role="alert">Faltam campos obrigatórios: {{ missing().join(', ') }}.</p>
            }
            @if (serverError()) {
              <p class="cat-error-box" role="alert">{{ serverError() }}
              @if (fix(); as f) {
                <a class="cat-link" [routerLink]="f.link">{{ f.label }}</a>
              }
              </p>
            }
            <div class="cat-actions">
              <button type="button" class="cat-btn-pill cat-btn-primary" [disabled]="sending()" (click)="send()">
                {{ sending() ? 'Enviando…' : 'Enviar para a equipe' }}
              </button>
            </div>
          }
        </div>
        @if (ready()) {
          <!-- Numa alteração o serviço já está publicado: sem o aviso de proposta nova. -->
          <app-form-preview [services]="[preview()]" [proposalNotice]="!current()" />
        }
      </div>
    </div>
  `,
})
export class ServiceProposalPageComponent implements OnInit {
  private readonly api = inject(CatalogueApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackbar = inject(SnackbarService);
  private readonly myRequests = inject(MyRequestsService);

  readonly Pages = Pages;
  readonly current = signal<CareService | null>(null);
  /** A proposta devolvida para alterações que se está a rever. */
  readonly revising = signal<CareService | null>(null);
  /** A proposta de alteração devolvida que se está a rever. */
  readonly revisingChange = signal<ChangeProposal | null>(null);
  /** Ao rever: o acompanhamento do pedido, para onde se volta. */
  readonly trackingLink = computed(() => {
    const r = this.revising();
    if (r) return ['/', Pages.MEUS_PEDIDOS, 'proposta', r.id];
    const c = this.revisingChange();
    return c ? ['/', Pages.MEUS_PEDIDOS, 'alteracao', c.id] : null;
  });
  readonly options = signal<CatalogueOptions | null>(null);
  readonly content = signal<ServiceContent>(emptyServiceContent());
  readonly ready = signal(false);
  readonly attempted = signal(false);
  readonly sending = signal(false);
  readonly serverError = signal<string | null>(null);
  /** O erro aponta vagas ou sessões: o atalho para onde se resolve. */
  readonly fix = signal<InUseFix | null>(null);

  readonly missing = computed(() => missingServiceFields(this.content()));
  readonly preview = computed(() =>
    serviceViewFromContent(this.content(), this.options(), this.current()?.audiences ?? []),
  );

  ngOnInit(): void {
    this.api.options().subscribe(o => this.options.set(o));
    const revise = Number(this.route.snapshot.queryParamMap.get('rever'));
    const id = Number(this.route.snapshot.paramMap.get('serviceId'));
    if (revise && id) {
      this.api.myChangeProposals().subscribe(list => {
        const c = list.find(x => x.id === revise) ?? null;
        this.revisingChange.set(c);
        if (c) {
          this.current.set(c.current);
          this.content.set(c.proposed);
        }
        this.ready.set(true);
      });
      return;
    }
    if (revise) {
      this.api.myProposals().subscribe(list => {
        const s = list.find(x => x.id === revise) ?? null;
        this.revising.set(s);
        if (s) this.content.set(proposalContentOf(s));
        this.ready.set(true);
      });
      return;
    }
    if (!id) {
      this.ready.set(true);
      return;
    }
    this.api.availableServices().subscribe(list => {
      const s = list.find(x => x.id === id) ?? null;
      this.current.set(s);
      if (s) this.content.set(contentOf(s));
      this.ready.set(true);
    });
  }

  send(): void {
    this.attempted.set(true);
    this.serverError.set(null);
    this.fix.set(null);
    if (this.missing().length) return;
    this.sending.set(true);
    const s = this.current();
    const r = this.revising();
    const c = this.revisingChange();
    const request: Observable<{ id: number }> = r
      ? this.api.reviseProposal(r.id, this.content())
      : c
        ? this.api.reviseChange(c.id, this.content())
        : s
          ? this.api.proposeChange(s.id, this.content())
          : this.api.propose(this.content());
    request.subscribe({
      next: sent => {
        this.snackbar.openSnackBar({ message: 'Enviado para a equipe da CARE.', action: true });
        // Uma primeira proposta faz aparecer "Meus pedidos" nos menus.
        this.myRequests.refresh();
        if (r) this.router.navigate(['/', Pages.MEUS_PEDIDOS, 'proposta', r.id]);
        // Uma alteração segue-se no acompanhamento, como os outros pedidos.
        else if (s) this.router.navigate(['/', Pages.MEUS_PEDIDOS, 'alteracao', sent.id]);
        else this.router.navigate(['/', 'dashboard', 'servicos']);
      },
      error: (err: HttpErrorResponse) => {
        this.sending.set(false);
        this.serverError.set(err?.error?.error ?? 'Não foi possível enviar. Tente novamente.');
        this.fix.set(inUseFix(err?.error?.code));
      },
    });
  }
}
