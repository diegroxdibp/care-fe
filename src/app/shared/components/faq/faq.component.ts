import { Component, signal, computed, HostListener } from '@angular/core';
import { RouterLink } from '@angular/router';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { AppConstants } from '../../../app-constants';
import { ScrollAnimateDirective } from '../../directives/scroll-animate.directive';

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [RouterLink, ScrollAnimateDirective],
  templateUrl: './faq.component.html',
  styleUrl: './faq.component.scss',
  animations: [
    trigger('expand', [
      state('collapsed', style({ height: '0px', opacity: 0 })),
      state('expanded', style({ height: '*', opacity: 1 })),
      transition('collapsed <=> expanded', animate('400ms cubic-bezier(0.4, 0, 0.2, 1)')),
    ]),
  ],
})
export class FaqComponent {
  readonly faq = AppConstants.faq;

  readonly selectedTopic = signal<string>(this.faq[0].topicName);
  readonly openTopic = signal<string | null>(null);
  readonly openQuestion = signal<string | null>(null);

  readonly isMobile = signal<boolean>(
    typeof window !== 'undefined' && window.innerWidth < 768
  );

  readonly selected = computed<typeof this.faq[0]>(
    () => this.faq.find(t => t.topicName === this.selectedTopic()) ?? this.faq[0]
  );

  @HostListener('window:resize')
  onResize(): void {
    this.isMobile.set(window.innerWidth < 768);
  }

  qKey(topic: string, i: number): string {
    return `${topic}::${i}`;
  }

  selectTopic(name: string): void {
    if (this.selectedTopic() === name) return;
    this.selectedTopic.set(name);
    this.openQuestion.set(null);
  }

  toggleTopic(name: string): void {
    this.openTopic.set(this.openTopic() === name ? null : name);
    this.openQuestion.set(null);
  }

  toggleQuestion(key: string): void {
    this.openQuestion.set(this.openQuestion() === key ? null : key);
  }
}
