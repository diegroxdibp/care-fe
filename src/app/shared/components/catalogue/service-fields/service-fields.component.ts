import { Component, computed, input, model, signal } from '@angular/core';

import { Audience, ServiceContent, SpecialtyContent } from '../../../models/catalogue.model';
import { AudiencePickerComponent } from '../audience-picker/audience-picker.component';
import { ImageFieldComponent } from '../image-field/image-field.component';

/**
 * Os campos de um serviço (handoff: "ServiceFields"): proposta nova, proposta
 * de alteração e edição pela equipa. Sem endereço (slug) nem campos de
 * agendamento — esses são da equipa.
 */
@Component({
  selector: 'app-service-fields',
  standalone: true,
  imports: [AudiencePickerComponent, ImageFieldComponent],
  templateUrl: './service-fields.component.html',
})
export class ServiceFieldsComponent {
  readonly value = model.required<ServiceContent>();
  /** Os erros só aparecem depois de tentar enviar. */
  readonly attempted = input(false);
  readonly audiences = input<Audience[]>([]);
  /** Prefixo dos ids dos campos, para haver vários formulários na mesma página. */
  readonly idPrefix = input('svc');

  readonly openSpecialties = signal<Set<number>>(new Set());

  readonly forWhomText = computed(() => this.value().forWhom.join('\n'));

  readonly errors = computed(() => {
    const c = this.value();
    return {
      name: !c.name.trim(),
      modality: !c.allowsInPerson && !c.allowsRemote,
      format: !c.allowsIndividual && !c.allowsGroup,
      visibility: !c.allowsPublic && !c.allowsPrivate,
      audience: c.audienceIds.length + c.proposedAudiences.length === 0,
      intro: !c.intro.trim(),
    };
  });

  patch(changes: Partial<ServiceContent>): void {
    this.value.update(v => ({ ...v, ...changes }));
  }

  text(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  setForWhom(text: string): void {
    // Guarda as linhas como estão (com vazias) para não comer o Enter a meio da escrita;
    // a página e o backend ignoram as vazias.
    this.patch({ forWhom: text.split('\n') });
  }

  // ─ Especialidades ─────────────────────────────────────────────────────────

  addSpecialty(): void {
    const index = this.value().specialties.length;
    this.patch({
      specialties: [
        ...this.value().specialties,
        { id: null, name: '', description: null, audienceIds: [], proposedAudiences: [] },
      ],
    });
    this.openSpecialties.update(s => new Set(s).add(index));
  }

  removeSpecialty(index: number): void {
    this.patch({ specialties: this.value().specialties.filter((_, i) => i !== index) });
    this.openSpecialties.set(new Set());
  }

  patchSpecialty(index: number, changes: Partial<SpecialtyContent>): void {
    this.patch({
      specialties: this.value().specialties.map((s, i) => (i === index ? { ...s, ...changes } : s)),
    });
  }

  toggleSpecialty(index: number): void {
    this.openSpecialties.update(s => {
      const next = new Set(s);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }
}
