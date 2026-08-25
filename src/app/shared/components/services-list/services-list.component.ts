import { Component, inject } from '@angular/core';
import { AppConstants } from '../../../app-constants';
import { NavigationService } from '../../services/navigation.service';
import { Pages } from '../../enums/pages.enum';
import { ServiceType } from '../../models/service.model';
import { trigger, state, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'app-services-list',
  standalone: true,
  templateUrl: './services-list.component.html',
  styleUrl: './services-list.component.scss',
  animations: [
    // Expand / Collapse for a service row's description + actions
    trigger('expandCollapse', [
      state(
        'collapsed',
        style({
          height: '0',
          opacity: 0,
          overflow: 'hidden',
        }),
      ),
      state(
        'expanded',
        style({
          height: '*',
          opacity: 1,
          overflow: 'hidden',
        }),
      ),
      transition('collapsed <=> expanded', [animate('300ms ease-in-out')]),
    ]),
  ],
})
export class ServicesListComponent {
  readonly navigationService: NavigationService = inject(NavigationService);
  AppConstants = AppConstants;
  Pages = Pages;

  /** Only one row is ever open at a time — this is the currently open row's key, or null. */
  private openKey: string | null = null;

  isOpen(itemId: string): boolean {
    return this.openKey === itemId;
  }

  toggleItem(itemId: string): void {
    this.openKey = this.openKey === itemId ? null : itemId;
  }

  navigateTo(page: Pages): void {
    this.navigationService.navigateTo(page);
  }

  navigateToScheduling(serviceType: ServiceType): void {
    this.navigationService.navigateToScheduling(serviceType.sessionService);
  }
}
