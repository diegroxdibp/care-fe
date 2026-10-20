import { animate, state, style, transition, trigger } from '@angular/animations';

/** Abre e fecha um acordeão — o mesmo de services-list. Use [@expandCollapse]="open ? 'expanded' : 'collapsed'". */
export const expandCollapse = trigger('expandCollapse', [
  state('collapsed', style({ height: '0', opacity: 0, overflow: 'hidden' })),
  state('expanded', style({ height: '*', opacity: 1, overflow: 'hidden' })),
  transition('collapsed <=> expanded', [animate('300ms ease-in-out')]),
]);
