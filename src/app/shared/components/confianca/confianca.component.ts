import { Component } from '@angular/core';

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
  templateUrl: './confianca.component.html',
  styleUrl: './confianca.component.scss',
})
export class ConfiancaComponent {
  readonly items: TrustItem[] = [
    {
      icon: 'verified_user',
      label: 'Profissionais registados',
      description: 'Cada pessoa profissional atua sob a sua respetiva ordem e código de ética.',
      chipBackground: 'var(--color-secondary-indigo)',
      chipForeground: '#ffffff',
    },
    {
      icon: 'lock',
      label: 'Dados protegidos',
      description: 'Só o profissional do seu atendimento vê os seus dados de contato. Nunca terceiros.',
      chipBackground: 'var(--color-secondary-cyan)',
      chipForeground: 'var(--color-primary-blue)',
    },
    {
      icon: 'diversity_3',
      label: 'Supervisão clínica',
      description: 'A prática é supervisionada — individual ou em pequenos grupos, com regularidade.',
      chipBackground: 'var(--color-secondary-pink)',
      chipForeground: 'var(--color-primary-blue)',
    },
    {
      icon: 'devices',
      label: 'Online e em Lisboa',
      description: 'Atendimento remoto ou presencial, conforme a modalidade do serviço escolhido.',
      chipBackground: 'var(--color-secondary-green)',
      chipForeground: 'var(--color-primary-blue)',
    },
  ];
}
