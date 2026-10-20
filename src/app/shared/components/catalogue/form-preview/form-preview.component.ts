import { Component, input } from '@angular/core';

import { ProfessionalView, ServiceView } from '../../../utils/catalogue-views.util';
import { ProfessionalViewComponent } from '../professional-view/professional-view.component';
import { ServiceViewComponent } from '../service-view/service-view.component';

/**
 * A pré-visualização ao lado dos formulários (handoff: "Pre-visualizacao"):
 * o perfil e, por baixo, cada serviço proposto, separados por uma faixa.
 * Nenhum link sai daqui — não se perde o que se está a escrever.
 */
@Component({
  selector: 'app-form-preview',
  standalone: true,
  imports: [ProfessionalViewComponent, ServiceViewComponent],
  template: `
    <aside class="cat-preview" aria-label="Pré-visualização">
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
}
