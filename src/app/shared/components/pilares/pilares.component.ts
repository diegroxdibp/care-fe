import { Component } from '@angular/core';

interface Pilar {
  name: string;
  description: string;
  icon: string;
  borderColor: string;
}

@Component({
  selector: 'app-pilares',
  standalone: true,
  templateUrl: './pilares.component.html',
  styleUrl: './pilares.component.scss',
})
export class PilaresComponent {
  readonly pilares: Pilar[] = [
    {
      name: 'Cuidado Centrado na Pessoa',
      description: 'A pessoa define o ritmo e a direção. O plano de cuidado é dela, não do protocolo.',
      icon: 'assets/images/hands1.svg',
      borderColor: 'var(--color-secondary-indigo)',
    },
    {
      name: 'Abordagem Integral',
      description: 'Corpo, história, vínculos e contexto entram na mesma sala — nenhum é acessório.',
      icon: 'assets/images/tree.svg',
      borderColor: 'var(--color-secondary-cyan)',
    },
    {
      name: 'Trabalho Transdisciplinar',
      description: 'Abordagens que conversam entre si, em vez de disputar a explicação do sofrimento.',
      icon: 'assets/images/trifecta.svg',
      borderColor: 'var(--color-secondary-pink)',
    },
    {
      name: 'Modelo Biopsicossocial',
      description: 'Saúde como estado de bem-estar — não como ausência de doença.',
      icon: 'assets/images/thoughts.svg',
      borderColor: 'var(--color-secondary-green)',
    },
  ];
}
