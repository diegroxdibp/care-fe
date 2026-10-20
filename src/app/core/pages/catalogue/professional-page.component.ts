import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { CatalogueApiService } from '../../services/catalogue-api.service';
import { ProfessionalPage } from '../../../shared/models/catalogue.model';
import { Pages } from '../../../shared/enums/pages.enum';
import { ProfessionalViewComponent } from '../../../shared/components/catalogue/professional-view/professional-view.component';
import { professionalViewFromPage } from '../../../shared/utils/catalogue-views.util';

/** /profissionais/:slug — o perfil profissional publicado. */
@Component({
  selector: 'app-professional-page',
  standalone: true,
  imports: [ProfessionalViewComponent, RouterLink],
  template: `
    <div class="cat-page">
      @if (view(); as v) {
        <app-professional-view [professional]="v" (schedule)="schedule()" />
      } @else if (notFound()) {
        <div class="cat-col">
          <h1>Perfil não encontrado</h1>
          <p>Este endereço não corresponde a nenhuma pessoa profissional da Care.</p>
          <a class="cat-link" [routerLink]="['/', Pages.PROFISSIONAIS]">Ver as pessoas profissionais →</a>
        </div>
      }
    </div>
  `,
})
export class ProfessionalPageComponent implements OnInit {
  private readonly api = inject(CatalogueApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly Pages = Pages;
  readonly page = signal<ProfessionalPage | null>(null);
  readonly notFound = signal(false);
  readonly view = computed(() => {
    const p = this.page();
    return p ? professionalViewFromPage(p) : null;
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug') ?? '';
      this.page.set(null);
      this.notFound.set(false);
      this.api.professionalPage(slug).subscribe({
        next: p => {
          if (p.slug !== slug) {
            this.router.navigate(['/', Pages.PROFISSIONAIS, p.slug], { replaceUrl: true });
          }
          this.page.set(p);
        },
        error: () => this.notFound.set(true),
      });
    });
  }

  /** Agendar com esta pessoa já escolhida (o Agendar mostra só os serviços dela). */
  schedule(): void {
    const p = this.page();
    if (!p) return;
    const only = p.services.length === 1 ? { service: p.services[0].slug } : {};
    this.router.navigate(['/', Pages.SCHEDULING], { queryParams: { professional: p.userId, ...only } });
  }
}
