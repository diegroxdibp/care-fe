import { Component } from '@angular/core';
import { ScrollAnimateDirective } from '../../directives/scroll-animate.directive';

interface Pilar {
  name: string;
  description: string;
  icon: string;
  borderColor: string;
}

@Component({
  selector: 'app-pilares',
  standalone: true,
  imports: [ScrollAnimateDirective],
  templateUrl: './pilares.component.html',
  styleUrl: './pilares.component.scss',
})
export class PilaresComponent {
  readonly pilares: Pilar[] = [
    {
      name: 'Cuidado Centrado na Pessoa',
      description: 'Cada plano de cuidado é único e feito para a pessoa, não para um protocolo.',
      icon: 'assets/images/hands1.svg',
      borderColor: 'var(--color-secondary-indigo)',
    },
    {
      name: 'Abordagem Integral',
      description: 'Corpo, vivências e vínculos entram na mesma sala. Todos são protagonistas.',
      icon: 'assets/images/tree.svg',
      borderColor: 'var(--color-secondary-cyan)',
    },
    {
      name: 'Trabalho Transdisciplinar',
      description: 'Abordagem que supera a fragmentação dos saberes e os integra em diálogo.',
      icon: 'assets/images/trifecta.svg',
      borderColor: 'var(--color-secondary-pink)',
    },
    {
      name: 'Modelo Biopsicossocial',
      description: 'Saúde como estado de bem viver e não como ausência de doença.',
      icon: 'assets/images/thoughts.svg',
      borderColor: 'var(--color-secondary-green)',
    },
  ];
}
