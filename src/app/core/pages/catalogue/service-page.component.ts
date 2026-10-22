import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { CatalogueApiService } from '../../services/catalogue-api.service';
import { ServicePage } from '../../../shared/models/catalogue.model';
import { Pages } from '../../../shared/enums/pages.enum';
import { NavigationService } from '../../../shared/services/navigation.service';
import { ServiceViewComponent } from '../../../shared/components/catalogue/service-view/service-view.component';
import { cardViewFrom, serviceViewFrom } from '../../../shared/utils/catalogue-views.util';

/** /servicos/:slug — a página pública de um serviço da lista. */
@Component({
  selector: 'app-service-page',
  standalone: true,
  imports: [ServiceViewComponent, RouterLink],
  template: `
    <div class="cat-page">
      @if (page(); as p) {
        <app-service-view
          [service]="view()!"
          [professionals]="cards()"
          (schedule)="schedule(p)"
        />
      } @else if (notFound()) {
        <div class="cat-col">
          <h1>Serviço não encontrado</h1>
          <p>Este endereço não corresponde a nenhum serviço publicado.</p>
          <a class="cat-link" routerLink="/" [fragment]="Pages.SERVICES">Ver todos os serviços →</a>
        </div>
      }
    </div>
  `,
})
export class ServicePageComponent implements OnInit {
  private readonly api = inject(CatalogueApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly navigation = inject(NavigationService);

  readonly Pages = Pages;
  readonly page = signal<ServicePage | null>(null);
  readonly notFound = signal(false);
  readonly view = computed(() => {
    const p = this.page();
    return p ? serviceViewFrom(p.service) : null;
  });
  readonly cards = computed(() => (this.page()?.professionals ?? []).map(cardViewFrom));

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug') ?? '';
      this.page.set(null);
      this.notFound.set(false);
      this.api.servicePage(slug).subscribe({
        next: p => {
          // Um endereço antigo devolve a página com o endereço novo.
          if (p.service.slug !== slug) {
            this.router.navigate(['/', Pages.SERVICOS, p.service.slug], { replaceUrl: true });
          }
          this.page.set(p);
        },
        error: () => this.notFound.set(true),
      });
    });
  }

  schedule(p: ServicePage): void {
    this.navigation.navigateToScheduling(p.service.slug);
  }
}
