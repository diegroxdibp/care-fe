import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { CatalogueApiService } from '../../../../core/services/catalogue-api.service';
import {
  CatalogueOptions,
  emptyProfile,
  Offering,
  ProfessionalProfile,
  profileForForm,
} from '../../../models/catalogue.model';
import { Pages } from '../../../enums/pages.enum';
import { SnackbarService } from '../../../services/snackbar.service';
import { professionalViewFromForm } from '../../../utils/catalogue-views.util';
import { FormPreviewComponent } from '../form-preview/form-preview.component';
import { ProfileFieldsComponent } from '../profile-fields/profile-fields.component';

/**
 * Painel → Perfil profissional. Depois de aprovada, a pessoa muda-o sem
 * revisão (a equipa recebe um email com o que mudou). Separado do perfil
 * pessoal (Painel → Perfil): nome de exibição e foto próprios.
 */
@Component({
  selector: 'app-professional-profile-editor',
  standalone: true,
  imports: [ProfileFieldsComponent, FormPreviewComponent, RouterLink],
  template: `
    <div class="cat-form-page">
      <div class="cat-form-layout">
        <div class="cat-card">
          <h1>Perfil profissional</h1>
          <p class="cat-hint">
            É a sua página pública@if (profile().slug) {
              (<a class="cat-link" [routerLink]="['/', Pages.PROFISSIONAIS, profile().slug]">ver página</a>)
            }. O seu perfil pessoal (nome da conta, foto, contactos) continua em Perfil. Cada alteração é comunicada à
            equipa da CARE.
          </p>
          @if (profile().status === 'DRAFT') {
            <p class="cat-notice">Ainda não publicado: fica visível assim que gravar com nome e apresentação.</p>
          } @else if (profile().status === 'HIDDEN') {
            <p class="cat-notice">A equipa da CARE ocultou este perfil. Fale com a equipa para o voltar a mostrar.</p>
          }
          @if (loaded()) {
            <app-profile-fields
              [value]="profile()"
              (valueChange)="profile.set($event)"
              [attempted]="attempted()"
              [languages]="options()?.languages ?? []"
            />
            @if (attempted() && missing().length) {
              <p class="cat-error-box" role="alert">Campos obrigatórios em falta: {{ missing().join(', ') }}.</p>
            }
            @if (serverError()) {
              <p class="cat-error-box" role="alert">{{ serverError() }}</p>
            }
            <div class="cat-actions">
              <button type="button" class="cat-btn-pill cat-btn-primary" [disabled]="saving()" (click)="save()">
                {{ saving() ? 'A gravar…' : 'Gravar' }}
              </button>
              <a class="cat-btn-text" [routerLink]="'/' + Pages.DASHBOARD_SERVICES">Os meus serviços</a>
            </div>
          }
        </div>
        @if (loaded()) {
          <app-form-preview [professional]="view()" [proposalNotice]="false" />
        }
      </div>
    </div>
  `,
})
export class ProfessionalProfileEditorComponent implements OnInit {
  private readonly api = inject(CatalogueApiService);
  private readonly snackbar = inject(SnackbarService);

  readonly Pages = Pages;
  readonly profile = signal<ProfessionalProfile>(emptyProfile());
  readonly offerings = signal<Offering[]>([]);
  readonly options = signal<CatalogueOptions | null>(null);
  readonly loaded = signal(false);
  readonly attempted = signal(false);
  readonly saving = signal(false);
  readonly serverError = signal<string | null>(null);

  readonly missing = computed(() => {
    const m: string[] = [];
    if (!this.profile().displayName.trim()) m.push('nome');
    if (!this.profile().whoAmI.trim()) m.push('apresentação');
    return m;
  });

  readonly view = computed(() =>
    professionalViewFromForm(
      this.profile(),
      this.offerings().filter(o => o.active).map(o => o.service),
      this.options(),
    ),
  );

  ngOnInit(): void {
    forkJoin({ profile: this.api.myProfile(), offerings: this.api.myOfferings(), options: this.api.options() })
      .subscribe(({ profile, offerings, options }) => {
        this.profile.set(profileForForm(profile));
        this.offerings.set(offerings);
        this.options.set(options);
        this.loaded.set(true);
      });
  }

  save(): void {
    this.attempted.set(true);
    if (this.missing().length) return;
    this.saving.set(true);
    this.serverError.set(null);
    this.api.saveMyProfile(this.profile()).subscribe({
      next: p => {
        this.profile.set(profileForForm(p));
        this.saving.set(false);
        this.snackbar.openSnackBar({ message: 'Perfil profissional gravado.', action: true });
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.serverError.set(err?.error?.error ?? 'Não foi possível gravar. Tente novamente.');
      },
    });
  }
}
