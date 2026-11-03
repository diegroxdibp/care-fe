import { Component, input } from '@angular/core';

import { ProfileStatus } from '../../../models/catalogue.model';
import { ProfessionalView, ServiceView } from '../../../utils/catalogue-views.util';
import { ProfessionalViewComponent } from '../professional-view/professional-view.component';
import { ServiceViewComponent } from '../service-view/service-view.component';

/**
 * A pré-visualização ao lado dos formulários (handoff: "Pre-visualizacao"):
 * o perfil e, por baixo, cada serviço proposto, separados por uma faixa.
 * Nenhum link sai daqui na mesma aba — não se perde o que se está a
 * escrever. O link para a página pública (publicPage) abre noutra aba.
 */
@Component({
  selector: 'app-form-preview',
  standalone: true,
  imports: [ProfessionalViewComponent, ServiceViewComponent],
  template: `
    <aside class="cat-preview" aria-label="Pré-visualização">
      @if (publicPage(); as page) {
        <div class="cat-preview-band cat-preview-public">
          <span class="cat-overline">Pré-visualização</span>
          <span class="cat-preview-public-text">
            @if (page.status === 'PUBLISHED' && page.url) {
              O que você ainda não salvou só aparece aqui.
              <a
                class="cat-link"
                [href]="page.url"
                target="_blank"
                rel="noopener"
                aria-label="Ver perfil público (abre em outra aba)"
              >
                Ver perfil público
                <span class="material-symbols-outlined" translate="no" aria-hidden="true">open_in_new</span>
              </a>
            } @else if (page.status === 'HIDDEN') {
              A equipe da CARE ocultou este perfil, por isso a página pública não está visível. Fale com a equipe
              para voltar a mostrá-la.
            } @else {
              Seu perfil ainda não tem página pública. Ela é criada quando você salva com nome e apresentação.
            }
          </span>
        </div>
      }
      @if (professional(); as p) {
        @if (services().length) {
          <div class="cat-preview-band">
            <span class="cat-overline">Perfil profissional</span>
            <span class="cat-preview-name">{{ p.displayName }}</span>
          </div>
        }
        <app-professional-view [professional]="p" [preview]="true" />
      }
      @for (s of services(); track $index; let i = $index) {
        @if (professional() || services().length > 1) {
          <div class="cat-preview-band">
            <span class="cat-overline">Proposta de serviço {{ i + 1 }}</span>
            <span class="cat-preview-name">{{ s.name }}</span>
          </div>
        }
        <app-service-view [service]="s" [notice]="proposalNotice() ? 'proposal' : null" [preview]="true" />
      }
    </aside>
  `,
})
export class FormPreviewComponent {
  readonly professional = input<ProfessionalView | null>(null);
  readonly services = input<ServiceView[]>([]);
  readonly proposalNotice = input(true);
  /**
   * Só no editor do perfil profissional: a faixa do topo diz sempre se há
   * página pública. Publicada, leva a ela (noutra aba); em rascunho ou
   * oculta, explica porque não há link, em vez de não mostrar nada.
   */
  readonly publicPage = input<PublicPageState | null>(null);
}

export interface PublicPageState {
  status: ProfileStatus | null;
  /** O endereço da página pública, quando já há um. */
  url: string | null;
}
