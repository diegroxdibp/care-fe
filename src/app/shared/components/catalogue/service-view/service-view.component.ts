import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, input, output, signal, TemplateRef } from '@angular/core';
import { RouterLink } from '@angular/router';

import { expandCollapse } from '../../../animations/expand-collapse';
import { Pages } from '../../../enums/pages.enum';
import { formatLabels, joinPt, modalityLabels } from '../../../utils/catalogue.util';
import { ProfessionalCardView, ServiceView } from '../../../utils/catalogue-views.util';

/**
 * A página de um serviço (handoff: "Pagina de Servico"). Serve a página
 * publicada e as pré-visualizações dos formulários — com preview, nenhum link
 * sai da página e não há Agendar.
 */
@Component({
  selector: 'app-service-view',
  standalone: true,
  imports: [RouterLink, NgTemplateOutlet],
  templateUrl: './service-view.component.html',
  animations: [expandCollapse],
})
export class ServiceViewComponent {
  readonly service = input.required<ServiceView>();
  readonly professionals = input<ProfessionalCardView[]>([]);
  /** proposal = pré-visualização de uma proposta ainda não publicada. */
  readonly notice = input<'proposal' | null>(null);
  readonly preview = input(false);
  /**
   * Posto por baixo de cada secção, com o nome dela ('apresentacao',
   * 'caracteristicas', 'para-quem', 'especialidades') — a análise de um
   * pedido põe aqui a conversa sobre essa parte.
   */
  readonly sectionFooter = input<TemplateRef<{ $implicit: string }> | null>(null);
  readonly schedule = output<void>();

  readonly Pages = Pages;
  readonly open = signal<string | null>(null);

  readonly modalities = computed(() => modalityLabels(this.service().modalities));
  readonly formats = computed(() => formatLabels(this.service().formats));
  readonly audiences = computed(() => joinPt(this.service().audiences));
  readonly meetTitle = computed(() =>
    this.professionals().length > 1 ? 'Conheça as pessoas profissionais' : 'Conheça a pessoa profissional',
  );

  constructor() {
    // Com uma só pessoa, o acordeão começa aberto.
    effect(() => {
      const list = this.professionals();
      this.open.set(list.length === 1 ? list[0].key : null);
    });
  }

  toggle(key: string): void {
    this.open.update(k => (k === key ? null : key));
  }

  joinPt = joinPt;
  formatLabels = formatLabels;
  modalityLabels = modalityLabels;
}
