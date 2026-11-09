import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { trigger, state, style, transition, animate } from '@angular/animations';

import { CatalogueApiService } from '../../../core/services/catalogue-api.service';
import { NavigationService } from '../../services/navigation.service';
import { Pages } from '../../enums/pages.enum';
import { CareService } from '../../models/catalogue.model';
import { serviceMeta } from '../../utils/catalogue.util';
import { firstParagraph, plainText } from '../../utils/rich-text.util';
import { ScrollAnimateDirective } from '../../directives/scroll-animate.directive';

/** Uma linha da lista: um serviço listado (GLOSSARY.md, "Listed service"). */
export interface ServiceRow {
  slug: string;
  name: string;
  meta: string;
  text: string;
  /** Sem resumo ainda: o texto é o início da apresentação, cortado a algumas linhas. */
  fromIntro: boolean;
}

export function serviceRowOf(s: CareService): ServiceRow {
  const summary = s.summary?.trim();
  return {
    slug: s.slug,
    name: s.name,
    meta: serviceMeta(s),
    text: summary || plainText(firstParagraph(s.intro)),
    fromIntro: !summary,
  };
}

/**
 * Os serviços da home: os que alguém com o perfil profissional publicado
 * oferece, pedidos de novo a cada visita (um serviço novo aparece na visita
 * seguinte).
 */
@Component({
  selector: 'app-services-list',
  standalone: true,
  imports: [ScrollAnimateDirective, RouterLink],
  templateUrl: './services-list.component.html',
  styleUrl: './services-list.component.scss',
  animations: [
    // Expand / Collapse for a service row's description + actions
    trigger('expandCollapse', [
      state(
        'collapsed',
        style({
          height: '0',
          opacity: 0,
          overflow: 'hidden',
        }),
      ),
      state(
        'expanded',
        style({
          height: '*',
          opacity: 1,
          overflow: 'hidden',
        }),
      ),
      transition('collapsed <=> expanded', [animate('300ms ease-in-out')]),
    ]),
  ],
})
export class ServicesListComponent implements OnInit {
  private readonly navigationService = inject(NavigationService);
  private readonly api = inject(CatalogueApiService);
  readonly Pages = Pages;

  readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  readonly rows = signal<ServiceRow[]>([]);
  /** Linhas de espera enquanto carrega. */
  readonly skeleton = [1, 2, 3];

  /** Only one row is ever open at a time — this is the currently open row's slug, or null. */
  private readonly openKey = signal<string | null>(null);

  ngOnInit(): void {
    this.api.services(undefined, true).subscribe({
      next: list => {
        this.rows.set(list.map(serviceRowOf));
        this.state.set('ready');
      },
      error: () => this.state.set('error'),
    });
  }

  isOpen(slug: string): boolean {
    return this.openKey() === slug;
  }

  toggleItem(slug: string): void {
    this.openKey.update(open => (open === slug ? null : slug));
  }

  openServicePage(slug: string): void {
    this.navigationService.router.navigate([Pages.SERVICOS, slug]);
  }

  navigateToScheduling(slug: string): void {
    this.navigationService.navigateToScheduling(slug);
  }
}
