import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/** /admin — a área da equipa da CARE (só ADMIN, ver AdminGuard). */
@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="cat-form-page">
      <div class="cat-form-layout">
        <div class="cat-card cat-admin-card">
          <h1>Equipa da CARE</h1>
          <nav class="cat-admin-nav" aria-label="Área da equipa">
            <a class="cat-chip" routerLink="pedidos" routerLinkActive #a="routerLinkActive" [attr.aria-pressed]="a.isActive">Pedidos</a>
            <a class="cat-chip" routerLink="servicos" routerLinkActive #b="routerLinkActive" [attr.aria-pressed]="b.isActive">Serviços</a>
            <a class="cat-chip" routerLink="profissionais" routerLinkActive #c="routerLinkActive" [attr.aria-pressed]="c.isActive">Profissionais</a>
          </nav>
          <router-outlet />
        </div>
      </div>
    </div>
  `,
  styles: `
    .cat-admin-card {
      max-width: 1100px;
    }
  `,
})
export class AdminShellComponent {}
