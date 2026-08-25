import { Component } from '@angular/core';

interface Testimonial {
  quote: string;
  initials: string;
  who: string;
}

@Component({
  selector: 'app-depoimentos',
  standalone: true,
  templateUrl: './depoimentos.component.html',
  styleUrl: './depoimentos.component.scss',
})
export class DepoimentosComponent {
  // ⚠️ Placeholder copy — do not ship without real, consented testimonials.
  readonly testimonials: Testimonial[] = [
    { quote: 'Encontrei um espaço onde o meu corpo também podia falar.', initials: 'M.S.', who: 'Análise Reichiana' },
    { quote: 'Saí de cada sessão com mais chão debaixo dos pés.', initials: 'A.R.', who: 'Somatic Experiencing®' },
    { quote: 'A supervisão mudou a forma como escuto os meus pacientes.', initials: 'J.L.', who: 'Supervisão' },
  ];
}
