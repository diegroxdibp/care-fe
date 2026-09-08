import { Component } from '@angular/core';
import { ScrollAnimateDirective } from '../../directives/scroll-animate.directive';

interface TrustItem {
  icon: string;
  label: string;
  description: string;
  chipBackground: string;
  chipForeground: string;
}

@Component({
  selector: 'app-confianca',
  standalone: true,
  imports: [ScrollAnimateDirective],
  templateUrl: './confianca.component.html',
  styleUrl: './confianca.component.scss',
})
export class ConfiancaComponent {
  readonly items: TrustItem[] = [
    {
      icon: 'verified_user',
      label: 'Profissionais',
      description: 'Cada pessoa profissional com anos de experiência, formação continuada e ética no cuidado.',
      chipBackground: 'var(--color-secondary-indigo)',
      chipForeground: '#ffffff',
    },
    {
      icon: 'lock',
      label: 'Dados protegidos',
      description: 'Só a pessoa profissional do seu atendimento vê os seus dados de contato. Nunca terceiros.',
      chipBackground: 'var(--color-secondary-cyan)',
      chipForeground: 'var(--color-primary-blue)',
    },
    {
      icon: 'diversity_3',
      label: 'Intervisão e Suporte',
      description: 'Reuniões transdisciplinares regulares, com apoio à prática em cada território e país onde atendemos.',
      chipBackground: 'var(--color-secondary-pink)',
      chipForeground: 'var(--color-primary-blue)',
    },
    {
      icon: 'devices',
      label: 'Modalidades',
      description: 'Atendimento remoto ou presencial (Portugal e Brasil), conforme a modalidade do serviço escolhido.',
      chipBackground: 'var(--color-secondary-green)',
      chipForeground: 'var(--color-primary-blue)',
    },
  ];
}
