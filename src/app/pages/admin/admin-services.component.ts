import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { CatalogueApiService } from '../../core/services/catalogue-api.service';
import { CareService, CatalogueOptions, contentOf, ServiceContent } from '../../shared/models/catalogue.model';
import { Pages } from '../../shared/enums/pages.enum';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { ServiceFieldsComponent } from '../../shared/components/catalogue/service-fields/service-fields.component';
import { ServiceViewComponent } from '../../shared/components/catalogue/service-view/service-view.component';
import { missingServiceFields } from '../../shared/utils/catalogue.util';
import { serviceViewFromContent } from '../../shared/utils/catalogue-views.util';

const STATUS: Record<string, string> = { PENDING: 'Proposta', APPROVED: 'Na lista', REJECTED: 'Recusado' };

/**
 * /admin/servicos e /admin/servicos/:id — a lista inteira (propostas e
 * recusados incluídos) e a edição direta pela equipa, com as mesmas regras de
 * uma alteração aprovada (o backend recusa tirar o que está em uso).
 */
@Component({
  selector: 'app-admin-services',
  standalone: true,
  imports: [RouterLink, ServiceFieldsComponent, ServiceViewComponent],
  template: `
    @if (editing(); as s) {
      <a class="cat-link" routerLink="/admin/servicos">← Todos os serviços</a>
      <h2>{{ s.name }}</h2>
      <div class="cat-field">
        <label for="adm-slug">Endereço da página</label>
        <input class="cat-input" id="adm-slug" [value]="slug()" (input)="slug.set($any($event.target).value)" />
        <p class="cat-hint">/servicos/{{ slug() }} — ao mudar o endereço, o antigo continua levando à página.</p>
      </div>
      <app-service-fields
        [value]="content()!"
        (valueChange)="content.set($event)"
        [attempted]="attempted()"
        [audiences]="options()?.audiences ?? []"
        idPrefix="adm"
      />
      @if (attempted() && missing().length) {
        <p class="cat-error-box" role="alert">Faltam campos obrigatórios: {{ missing().join(', ') }}.</p>
      }
      @if (error()) {
        <p class="cat-error-box" role="alert">{{ error() }}</p>
      }
      <div class="cat-actions">
        <button type="button" class="cat-btn-pill cat-btn-primary" [disabled]="saving()" (click)="save(s)">
          {{ saving() ? 'Salvando…' : 'Salvar' }}
        </button>
        <a class="cat-btn-text" [routerLink]="['/', Pages.SERVICOS, s.slug]">Ver página publicada</a>
      </div>
      <h2>Pré-visualização</h2>
      <div class="cat-preview cat-admin-preview">
        <app-service-view [service]="preview()!" [preview]="true" />
      </div>
    } @else {
      <h2>Serviços</h2>
      @for (s of services(); track s.id) {
        <div class="cat-admin-item">
          <span class="cat-pill-status" [class.cat-pill-pending]="s.status === 'PENDING'"
            [class.cat-pill-rejected]="s.status === 'REJECTED'">{{ statusLabel(s.status) }}</span>
          <strong>{{ s.name }}</strong>
          <span class="cat-hint">/servicos/{{ s.slug }}@if (!s.allowsPublic) { · privado }</span>
          <a class="cat-btn-text" [routerLink]="['/admin/servicos', s.id]">Editar</a>
        </div>
      }
    }
  `,
})
export class AdminServicesComponent implements OnInit {
  private readonly api = inject(CatalogueApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackbar = inject(SnackbarService);

  readonly Pages = Pages;
  readonly services = signal<CareService[]>([]);
  readonly options = signal<CatalogueOptions | null>(null);
  readonly editing = signal<CareService | null>(null);
  readonly content = signal<ServiceContent | null>(null);
  readonly slug = signal('');
  readonly attempted = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly missing = computed(() => (this.content() ? missingServiceFields(this.content()!) : []));
  readonly preview = computed(() => {
    const c = this.content();
    return c ? serviceViewFromContent(c, this.options(), this.editing()?.audiences ?? []) : null;
  });

  statusLabel(s: string): string {
    return STATUS[s] ?? s;
  }

  ngOnInit(): void {
    this.api.options().subscribe(o => this.options.set(o));
    this.route.paramMap.subscribe(params => {
      const id = Number(params.get('id'));
      this.api.adminServices().subscribe(list => {
        this.services.set(list);
        const s = id ? (list.find(x => x.id === id) ?? null) : null;
        this.editing.set(s);
        this.content.set(s ? contentOf(s) : null);
        this.slug.set(s?.slug ?? '');
        this.attempted.set(false);
        this.error.set(null);
      });
    });
  }

  save(s: CareService): void {
    this.attempted.set(true);
    this.error.set(null);
    if (this.missing().length) return;
    this.saving.set(true);
    this.api.adminUpdateService(s.id, { content: this.content(), slug: this.slug().trim() || null }).subscribe({
      next: updated => {
        this.saving.set(false);
        this.snackbar.openSnackBar({ message: 'Serviço salvo.', action: true });
        this.editing.set(updated);
        this.content.set(contentOf(updated));
        this.slug.set(updated.slug);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(err?.error?.error ?? 'Não foi possível salvar.');
      },
    });
  }
}
