import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { CatalogueApiService } from '../../core/services/catalogue-api.service';
import { AdminProfile, CatalogueOptions, ProfessionalProfile, profileForForm } from '../../shared/models/catalogue.model';
import { Pages } from '../../shared/enums/pages.enum';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { ProfileFieldsComponent } from '../../shared/components/catalogue/profile-fields/profile-fields.component';

const STATUS: Record<string, string> = { DRAFT: 'Por publicar', PUBLISHED: 'Publicado', HIDDEN: 'Oculto' };

/**
 * /admin/profissionais e /admin/profissionais/:id — os perfis profissionais:
 * editar (incluindo o endereço), ocultar / mostrar, e ligar a uma conta o
 * perfil importado da página antiga.
 */
@Component({
  selector: 'app-admin-professionals',
  standalone: true,
  imports: [RouterLink, ProfileFieldsComponent],
  template: `
    @if (editing(); as e) {
      <a class="cat-link" routerLink="/admin/profissionais">← Todos os perfis</a>
      <h2>{{ e.profile.displayName || 'Sem nome' }}</h2>
      <span class="cat-hint">
        {{ statusLabel(e.profile.status) }} · conta: {{ e.account ? e.account.name + ' (' + e.account.email + ')' : 'nenhuma' }}
      </span>
      @if (!e.account) {
        <div class="cat-field">
          <label for="adm-attach">Ligar a uma conta profissional (email da conta)</label>
          <div class="cat-inline">
            <input class="cat-input" id="adm-attach" type="email" [value]="attachEmail()" (input)="attachEmail.set($any($event.target).value)" />
            <button type="button" class="cat-btn-pill" (click)="attach(e)">Ligar</button>
          </div>
        </div>
      }
      <div class="cat-field">
        <label for="adm-pslug">Endereço da página</label>
        <input class="cat-input" id="adm-pslug" [value]="form()!.slug ?? ''" (input)="setSlug($any($event.target).value)" />
        <p class="cat-hint">/profissionais/{{ form()!.slug }} — mudar o endereço mantém o antigo a levar à página.</p>
      </div>
      <app-profile-fields
        [value]="form()!"
        (valueChange)="form.set($event)"
        [attempted]="attempted()"
        [languages]="options()?.languages ?? []"
      />
      @if (error()) {
        <p class="cat-error-box" role="alert">{{ error() }}</p>
      }
      <div class="cat-actions">
        <button type="button" class="cat-btn-pill cat-btn-primary" [disabled]="saving()" (click)="save(e)">Gravar</button>
        @if (e.profile.status === 'HIDDEN' || e.profile.status === 'DRAFT') {
          <button type="button" class="cat-btn-pill" (click)="setVisible(e, true)">Publicar</button>
        } @else {
          <button type="button" class="cat-btn-pill" (click)="setVisible(e, false)">Ocultar perfil</button>
        }
        @if (e.profile.slug && e.profile.status === 'PUBLISHED') {
          <a class="cat-btn-text" [routerLink]="['/', Pages.PROFISSIONAIS, e.profile.slug]">Ver página</a>
        }
      </div>
    } @else {
      <h2>Profissionais</h2>
      @for (p of profiles(); track p.profile.id) {
        <div class="cat-admin-item">
          <span class="cat-pill-status" [class.cat-pill-muted]="p.profile.status !== 'PUBLISHED'"
            [class.cat-pill-rejected]="p.profile.status === 'HIDDEN'">{{ statusLabel(p.profile.status) }}</span>
          <strong>{{ p.profile.displayName || p.account?.name || 'Sem nome' }}</strong>
          <span class="cat-hint">{{ p.account?.email ?? 'sem conta ligada' }}@if (p.profile.slug) { · /profissionais/{{ p.profile.slug }} }</span>
          <a class="cat-btn-text" [routerLink]="['/admin/profissionais', p.profile.id]">Editar</a>
        </div>
      }
    }
  `,
})
export class AdminProfessionalsComponent implements OnInit {
  private readonly api = inject(CatalogueApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly snackbar = inject(SnackbarService);

  readonly Pages = Pages;
  readonly profiles = signal<AdminProfile[]>([]);
  readonly options = signal<CatalogueOptions | null>(null);
  readonly editing = signal<AdminProfile | null>(null);
  readonly form = signal<ProfessionalProfile | null>(null);
  readonly attachEmail = signal('');
  readonly attempted = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly missing = computed(() => {
    const f = this.form();
    return f && (!f.displayName.trim() || !f.whoAmI.trim());
  });

  statusLabel(s: string | null): string {
    return s ? (STATUS[s] ?? s) : '';
  }

  ngOnInit(): void {
    this.api.options().subscribe(o => this.options.set(o));
    this.route.paramMap.subscribe(params => this.load(Number(params.get('id'))));
  }

  private load(id: number): void {
    this.api.adminProfiles().subscribe(list => {
      this.profiles.set(list);
      this.select(id ? (list.find(p => p.profile.id === id) ?? null) : null);
    });
  }

  private select(p: AdminProfile | null): void {
    this.editing.set(p);
    this.form.set(p ? profileForForm(p.profile) : null);
    this.error.set(null);
    this.attempted.set(false);
  }

  setSlug(slug: string): void {
    this.form.update(f => (f ? { ...f, slug } : f));
  }

  private run(call: ReturnType<CatalogueApiService['adminUpdateProfile']>, done: string): void {
    this.saving.set(true);
    this.error.set(null);
    call.subscribe({
      next: updated => {
        this.saving.set(false);
        this.snackbar.openSnackBar({ message: done, action: true });
        this.profiles.update(list => list.map(p => (p.profile.id === updated.profile.id ? updated : p)));
        this.select(updated);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(err?.error?.error ?? 'Não foi possível gravar.');
      },
    });
  }

  save(e: AdminProfile): void {
    this.attempted.set(true);
    if (this.missing()) return;
    this.run(this.api.adminUpdateProfile(e.profile.id!, this.form()!), 'Perfil gravado.');
  }

  setVisible(e: AdminProfile, visible: boolean): void {
    this.run(this.api.adminSetProfileVisible(e.profile.id!, visible), visible ? 'Perfil publicado.' : 'Perfil ocultado.');
  }

  attach(e: AdminProfile): void {
    const email = this.attachEmail().trim();
    if (!email) return;
    this.run(this.api.adminAttachProfile(e.profile.id!, email), 'Perfil ligado à conta.');
  }
}
