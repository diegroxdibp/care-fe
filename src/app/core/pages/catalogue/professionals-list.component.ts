import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CatalogueApiService } from '../../services/catalogue-api.service';
import { ProfessionalCard } from '../../../shared/models/catalogue.model';
import { Pages } from '../../../shared/enums/pages.enum';

/** /profissionais — as pessoas profissionais com perfil publicado. */
@Component({
  selector: 'app-professionals-list',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="cat-page">
      <div class="cat-col">
        <div class="cat-block">
          <h1>Pessoas profissionais</h1>
          <p>Conheça quem atende na Care: a formação, a forma de trabalhar e os serviços de cada pessoa.</p>
        </div>
        @if (loaded() && !list().length) {
          <p class="cat-empty">Ainda não há perfis publicados.</p>
        }
        <ul class="cat-cards">
          @for (p of list(); track p.userId) {
            <li>
              <a [routerLink]="['/', Pages.PROFISSIONAIS, p.slug]">
                @if (p.photoUrl) {
                  <img [src]="p.photoUrl" [alt]="'Foto de ' + p.displayName" />
                }
                <span class="cat-card-name">{{ p.displayName }}</span>
                @if (p.title) {
                  <span class="cat-card-sub">{{ p.title }}</span>
                }
              </a>
            </li>
          }
        </ul>
        <a class="cat-link" [routerLink]="['/', Pages.JUNTE_SE]">É profissional? Junte-se à Care →</a>
      </div>
    </div>
  `,
})
export class ProfessionalsListComponent implements OnInit {
  private readonly api = inject(CatalogueApiService);
  readonly Pages = Pages;
  readonly list = signal<ProfessionalCard[]>([]);
  readonly loaded = signal(false);

  ngOnInit(): void {
    this.api.professionals().subscribe({
      next: l => {
        this.list.set(l);
        this.loaded.set(true);
      },
      error: () => this.loaded.set(true),
    });
  }
}
