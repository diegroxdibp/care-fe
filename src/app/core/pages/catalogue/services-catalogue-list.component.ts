import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { CatalogueApiService } from '../../services/catalogue-api.service';
import { CareService, FormatKey } from '../../../shared/models/catalogue.model';
import { Pages } from '../../../shared/enums/pages.enum';
import { paragraphs, serviceMeta } from '../../../shared/utils/catalogue.util';

const TITLES: Record<'ALL' | FormatKey, string> = {
  ALL: 'Serviços',
  INDIVIDUAL: 'Atendimento individual',
  GROUP: 'Atendimento em grupo',
};

/**
 * /atendimento, /atendimento/individual e /atendimento/grupo: os serviços da
 * lista que permitem esse formato. Os privados (só por convite) não entram.
 */
@Component({
  selector: 'app-services-catalogue-list',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="cat-page">
      <div class="cat-col">
        <div class="cat-block">
          <h1>{{ title() }}</h1>
          <nav class="cat-chips" aria-label="Formato">
            <a class="cat-chip" [routerLink]="['/', Pages.ATENDIMENTO]" [attr.aria-pressed]="format() === null">Todos</a>
            <a class="cat-chip" [routerLink]="['/', Pages.ATENDIMENTO_INDIVIDUAL]" [attr.aria-pressed]="format() === 'INDIVIDUAL'">Individual</a>
            <a class="cat-chip" [routerLink]="['/', Pages.ATENDIMENTO_GRUPO]" [attr.aria-pressed]="format() === 'GROUP'">Em grupo</a>
          </nav>
        </div>
        @if (loaded() && !services().length) {
          <p class="cat-empty">Ainda não há serviços neste formato.</p>
        }
        <ul class="cat-accordion">
          @for (s of services(); track s.id) {
            <li>
              <a class="cat-acc-head" [routerLink]="['/', Pages.SERVICOS, s.slug]">
                @if (s.imageUrl) {
                  <img class="cat-thumb-square" [src]="s.imageUrl" [alt]="s.imageAlt || ''" />
                }
                <span class="cat-acc-text">
                  <span class="cat-acc-name">{{ s.name }}</span>
                  <span class="cat-acc-meta">{{ meta(s) }}</span>
                  <span>{{ first(s) }}</span>
                </span>
              </a>
            </li>
          }
        </ul>
      </div>
    </div>
  `,
})
export class ServicesCatalogueListComponent implements OnInit {
  private readonly api = inject(CatalogueApiService);
  private readonly route = inject(ActivatedRoute);

  readonly Pages = Pages;
  readonly format = signal<FormatKey | null>(null);
  readonly services = signal<CareService[]>([]);
  readonly loaded = signal(false);
  readonly title = computed(() => TITLES[this.format() ?? 'ALL']);

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      const format = (data['format'] as FormatKey | undefined) ?? null;
      this.format.set(format);
      this.loaded.set(false);
      this.api.services(format ?? undefined).subscribe({
        next: list => {
          this.services.set(list);
          this.loaded.set(true);
        },
        error: () => this.loaded.set(true),
      });
    });
  }

  meta = serviceMeta;
  first(s: CareService): string {
    return paragraphs(s.intro)[0] ?? '';
  }
}
