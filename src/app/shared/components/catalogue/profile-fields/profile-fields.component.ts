import { Component, computed, input, model } from '@angular/core';

import { Language, ProfessionalProfile } from '../../../models/catalogue.model';
import { ImageFieldComponent } from '../image-field/image-field.component';

/**
 * Os campos do perfil profissional (handoff: "Formulario de Profissional"):
 * identificação, A. Quem sou, B. Formação, C. Como trabalho, D. Outras
 * informações. Modalidades, formatos e públicos não estão aqui — vêm dos
 * serviços que a pessoa oferece.
 */
@Component({
  selector: 'app-profile-fields',
  standalone: true,
  imports: [ImageFieldComponent],
  templateUrl: './profile-fields.component.html',
})
export class ProfileFieldsComponent {
  readonly value = model.required<ProfessionalProfile>();
  readonly attempted = input(false);
  readonly languages = input<Language[]>([]);
  /** O email da conta, só para mostrar (no pedido é com ele que a equipa fala). */
  readonly accountEmail = input<string | null>(null);

  readonly educationText = computed(() => this.value().education.join('\n'));
  readonly experienceText = computed(() => this.value().experience.join('\n'));

  readonly errors = computed(() => ({
    displayName: !this.value().displayName.trim(),
    whoAmI: !this.value().whoAmI.trim(),
  }));

  patch(changes: Partial<ProfessionalProfile>): void {
    this.value.update(v => ({ ...v, ...changes }));
  }

  text(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  toggleLanguage(code: string): void {
    const list = this.value().languages;
    this.patch({ languages: list.includes(code) ? list.filter(c => c !== code) : [...list, code] });
  }
}
