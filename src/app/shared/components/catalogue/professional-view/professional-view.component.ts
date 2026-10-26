import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, input, output, signal, TemplateRef } from '@angular/core';
import { RouterLink } from '@angular/router';

import { expandCollapse } from '../../../animations/expand-collapse';
import { Pages } from '../../../enums/pages.enum';
import { formatLabels, joinPt, modalityLabels } from '../../../utils/catalogue.util';
import { ProfessionalView } from '../../../utils/catalogue-views.util';

/**
 * O perfil profissional (handoff: "Pagina de Profissional"): Quem sou,
 * citação, Como trabalho, Formação e percurso, Outras informações, Serviços
 * na Care. Serve a página publicada e as pré-visualizações.
 */
@Component({
  selector: 'app-professional-view',
  standalone: true,
  imports: [RouterLink, NgTemplateOutlet],
  templateUrl: './professional-view.component.html',
  animations: [expandCollapse],
})
export class ProfessionalViewComponent {
  readonly professional = input.required<ProfessionalView>();
  readonly preview = input(false);
  /**
   * Posto por baixo de cada secção, com o nome dela ('quem-sou',
   * 'como-trabalho', 'formacao', 'outras-info') — a análise de um pedido põe
   * aqui a conversa sobre essa parte.
   */
  readonly sectionFooter = input<TemplateRef<{ $implicit: string }> | null>(null);
  readonly schedule = output<void>();

  readonly Pages = Pages;
  readonly open = signal<string | null>(null);

  readonly languages = computed(() => joinPt(this.professional().languages));
  readonly modalities = computed(() => modalityLabels(this.professional().modalities));
  readonly formats = computed(() => formatLabels(this.professional().formats));
  readonly audiences = computed(() => joinPt(this.professional().audiences));
  readonly hasOtherInfo = computed(() => {
    const p = this.professional();
    return !!(this.languages() || this.modalities() || this.audiences() || p.areas || p.otherInfo);
  });

  constructor() {
    effect(() => {
      const list = this.professional().services;
      this.open.set(list.length === 1 ? (list[0].slug ?? list[0].name) : null);
    });
  }

  toggle(key: string): void {
    this.open.update(k => (k === key ? null : key));
  }
}
