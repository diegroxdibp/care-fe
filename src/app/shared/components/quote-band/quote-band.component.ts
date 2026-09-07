import { Component } from '@angular/core';
import { ScrollAnimateDirective } from '../../directives/scroll-animate.directive';

@Component({
  selector: 'app-quote-band',
  standalone: true,
  imports: [ScrollAnimateDirective],
  templateUrl: './quote-band.component.html',
  styleUrl: './quote-band.component.scss',
})
export class QuoteBandComponent {}
