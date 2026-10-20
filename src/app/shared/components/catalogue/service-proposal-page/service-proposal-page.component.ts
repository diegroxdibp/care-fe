import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';

import { CatalogueApiService } from '../../../../core/services/catalogue-api.service';
import {
  CareService,
  CatalogueOptions,
  contentOf,
  emptyServiceContent,
  ServiceContent,
} from '../../../models/catalogue.model';
import { Pages } from '../../../enums/pages.enum';
import { SnackbarService } from '../../../services/snackbar.service';
import { missingServiceFields } from '../../../utils/catalogue.util';
import { serviceViewFromContent } from '../../../utils/catalogue-views.util';
import { FormPreviewComponent } from '../form-preview/form-preview.component';
import { ServiceFieldsComponent } from '../service-fields/service-fields.component';

/**
 * Painel → Os meus serviços → Propor um serviço (sem :serviceId) ou Propor
 * alterações (com :serviceId, a um serviço que se oferece). Fica à espera da
 * equipa da CARE; a resposta chega por notificação e email.
 */
@Component({
  selector: 'app-service-proposal-page',
  standalone: true,
  imports: [ServiceFieldsComponent, FormPreviewComponent, RouterLink],
  template: `
    <div class="cat-form-page">
      <div class="cat-form-layout">
        <div class="cat-card">
          <a class="cat-link" [routerLink]="['/', 'dashboard', 'servicos']">← Os meus serviços</a>
          <h1>{{ current() ? 'Propor alterações a ' + current()!.name : 'Propor um serviço' }}</h1>
          <p class="cat-hint">
            @if (current()) {
              A equipa da CARE revê as alterações antes de aparecerem na página. Formatos, modalidades, visibilidades ou
              especialidades que alguém já usa não podem ser retirados; públicos novos entram como especialidade.
            } @else {
              O serviço entra na lista da CARE quando a equipa o aprovar — fica então ligado nos seus serviços, e outras
              pessoas profissionais também o podem oferecer.
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
              <p class="cat-error-box" role="alert">Campos obrigatórios em falta: {{ missing().join(', ') }}.</p>
            }
            @if (serverError()) {
              <p class="cat-error-box" role="alert">{{ serverError() }}</p>
            }
            <div class="cat-actions">
              <button type="button" class="cat-btn-pill cat-btn-primary" [disabled]="sending()" (click)="send()">
                {{ sending() ? 'A enviar…' : 'Enviar para a equipa' }}
              </button>
            </div>
          }
        </div>
        @if (ready()) {
          <app-form-preview [services]="[preview()]" />
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

  readonly Pages = Pages;
  readonly current = signal<CareService | null>(null);
  readonly options = signal<CatalogueOptions | null>(null);
  readonly content = signal<ServiceContent>(emptyServiceContent());
  readonly ready = signal(false);
  readonly attempted = signal(false);
  readonly sending = signal(false);
  readonly serverError = signal<string | null>(null);

  readonly missing = computed(() => missingServiceFields(this.content()));
  readonly preview = computed(() =>
    serviceViewFromContent(this.content(), this.options(), this.current()?.audiences ?? []),
  );

  ngOnInit(): void {
    this.api.options().subscribe(o => this.options.set(o));
    const id = Number(this.route.snapshot.paramMap.get('serviceId'));
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
    if (this.missing().length) return;
    this.sending.set(true);
    const s = this.current();
    const request: Observable<unknown> = s
      ? this.api.proposeChange(s.id, this.content())
      : this.api.propose(this.content());
    request.subscribe({
      next: () => {
        this.snackbar.openSnackBar({ message: 'Enviado para a equipa da CARE.', action: true });
        this.router.navigate(['/', 'dashboard', 'servicos']);
      },
      error: (err: HttpErrorResponse) => {
        this.sending.set(false);
        this.serverError.set(err?.error?.error ?? 'Não foi possível enviar. Tente novamente.');
      },
    });
  }
}
