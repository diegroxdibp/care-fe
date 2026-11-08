import { Component, computed, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { RichBlock, RichInline } from '../../../utils/rich-text.util';

/**
 * Mostra um texto de serviço ou perfil (rich-text.util): subtítulos,
 * parágrafos, listas, negrito e itálico. Tudo por template, nunca innerHTML,
 * por isso nada do que se escreve vira HTML. display: contents, para que os
 * blocos fiquem direto no .cat-block de quem o usa (e herdem o espaçamento).
 */
@Component({
  selector: 'app-rich-text',
  standalone: true,
  imports: [NgTemplateOutlet],
  host: { style: 'display: contents' },
  template: `
    @for (b of all(); track $index) {
      @switch (b.type) {
        @case ('heading') {
          <h3 class="cat-rt-heading"><ng-container *ngTemplateOutlet="marks; context: { $implicit: contentOf(b) }" /></h3>
        }
        @case ('paragraph') {
          <p><ng-container *ngTemplateOutlet="marks; context: { $implicit: contentOf(b) }" /></p>
        }
        @case ('bulletList') {
          <ul class="cat-list cat-rt-list">
            @for (item of itemsOf(b); track $index) {
              <li><ng-container *ngTemplateOutlet="marks; context: { $implicit: item }" /></li>
            }
          </ul>
        }
        @case ('orderedList') {
          <ol class="cat-list cat-rt-list cat-rt-numbered">
            @for (item of itemsOf(b); track $index) {
              <li><ng-container *ngTemplateOutlet="marks; context: { $implicit: item }" /></li>
            }
          </ol>
        }
      }
    }

    <!-- Sem espaços entre as partes: um espaço aqui apareceria antes de uma vírgula. -->
    <!-- prettier-ignore -->
    <ng-template #marks let-parts>@for (i of asInline(parts); track $index) {@if (i.bold && i.italic) {<strong><em>{{ i.text }}</em></strong>} @else if (i.bold) {<strong>{{ i.text }}</strong>} @else if (i.italic) {<em>{{ i.text }}</em>} @else {<span>{{ i.text }}</span>}}</ng-template>
  `,
})
export class RichTextComponent {
  readonly blocks = input<RichBlock[]>([]);
  /** Só um parágrafo (o resumo num cartão), em vez de blocos. */
  readonly inline = input<RichInline[] | null>(null);

  readonly all = computed<RichBlock[]>(() => {
    const inline = this.inline();
    return inline ? [{ type: 'paragraph', content: inline }] : this.blocks();
  });

  contentOf(b: RichBlock): RichInline[] {
    return b.type === 'heading' || b.type === 'paragraph' ? b.content : [];
  }

  itemsOf(b: RichBlock): RichInline[][] {
    return b.type === 'bulletList' || b.type === 'orderedList' ? b.items : [];
  }

  asInline(parts: unknown): RichInline[] {
    return parts as RichInline[];
  }
}
