import { computed, inject, Injectable } from '@angular/core';
import { NavigationEnd, Params, Router } from '@angular/router';
import { Pages } from '../enums/pages.enum';
import { NavigationItem } from '../models/navigation-item.model';
import { ViewportScroller } from '@angular/common';
import { BehaviorSubject, filter, Subject } from 'rxjs';
import { SnackbarService } from './snackbar.service';
import { SessionService } from './session.service';
import { Roles } from '../enums/roles.enum';
import { environment } from '../../../environments/environment';

// Kept in sync with AvailabilityAccessGuard: production-only role gate for
// the Disponibilidade area, staging/dev stay open to any authenticated user.
const AVAILABILITY_ALLOWED_ROLES: string[] = [
  Roles.THERAPIST,
  Roles.PROFESSIONAL,
  Roles.ADMIN,
];

@Injectable({
  providedIn: 'root',
})
export class NavigationService {
  router = inject(Router);
  viewportScroller = inject(ViewportScroller);
  snackbarService = inject(SnackbarService);
  private sessionService = inject(SessionService);
  Pages = Pages;
  navigationItems: NavigationItem[] = [
    { name: 'Home',            destination: Pages.HOME,         icon: 'home' },
    { name: 'Sobre',           destination: Pages.ABOUT,        icon: 'info' },
    { name: 'Contato',         destination: Pages.CONTACT,      icon: 'mail' },
    { name: 'Disponibilidade', destination: Pages.AVAILABILITY, icon: 'calendar_month' },
    { name: 'Agendar',         destination: Pages.SCHEDULING,   icon: 'calendar_today' },
  ];

  readonly visibleNavigationItems = computed(() => {
    if (!environment.production) return this.navigationItems;

    const roles = this.sessionService.user()?.roles ?? [];
    const canSeeAvailability = roles.some((role) =>
      AVAILABILITY_ALLOWED_ROLES.includes(role),
    );
    if (canSeeAvailability) return this.navigationItems;

    return this.navigationItems.filter(
      (item) => item.destination !== Pages.AVAILABILITY,
    );
  });
  private routesWithAnchor = [`/${Pages.ATENDIMENTO}`, '/', '/contact'];
  readonly currentUrl: BehaviorSubject<string> = new BehaviorSubject('/');
  private previousBaseUrl: string | null = null;

  // Emits whenever a link to a section on Home is clicked, even if the
  // Router treats it as a same-URL no-op (e.g. already on '/#faq' and the
  // FAQ link is clicked again). HomeComponent listens for this directly
  // instead of relying on the Router's fragment navigation completing.
  readonly scrollToSectionRequested = new Subject<string>();
  private pendingSection: string | null = null;

  constructor() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        const cleanUrl = event.url.split(/[?#]/)[0];
        const isSamePageNavigation = cleanUrl === this.previousBaseUrl;
        this.previousBaseUrl = cleanUrl;
        this.currentUrl.next(event.url);

        // Only scroll to top if it's NOT a routesWithAnchor, and it's not
        // just a #fragment changing while already on that same page (e.g.
        // clicking the footer FAQ link while already on Home) — that case
        // should scroll smoothly from wherever the user already is instead.
        if (this.isRouteWithAnchor(event.url) && !isSamePageNavigation) {
          setTimeout(() => {
            this.viewportScroller.scrollToPosition([0, 0]);
          }, 50);
        }
      });
  }

  isRouteWithAnchor(url: string): boolean {
    const cleanUrl = url.split(/[?#]/)[0]; // remove ?query and #fragment
    return this.routesWithAnchor.some(
      (route) => cleanUrl === route || cleanUrl.startsWith(route)
    );
  }

  navigateTo(page: Pages, fragment?: string, queryParams?: Params): void {
    this.snackbarService.closeSnackbar();

    if (fragment && this.router.url.split(/[?#]/)[0] === `/${page}`) {
      // Already on the target page — scroll directly, without touching the
      // URL. Changing the hash here would make the browser natively (and
      // instantly) jump to the matching element itself, racing ahead of our
      // own smooth scroll animation.
      this.scrollToSectionRequested.next(fragment);
      return;
    }

    if (fragment) {
      // Read by HomeComponent on (re)creation, for navigation from another route.
      this.pendingSection = fragment;
    }
    this.router.navigate([page], {
      ...(fragment ? { fragment } : undefined),
      ...(queryParams ? { queryParams } : undefined),
    });
  }

  /** Navigates to Scheduling, pre-selecting a service. `serviceKey` must match ProfessionalService.name as returned by the backend (the ProfessionalSessionService enum key, e.g. 'MINDFULNESS') — read by SchedulingComponent via the `service` query param. */
  navigateToScheduling(serviceKey?: string): void {
    this.snackbarService.closeSnackbar();
    this.router.navigate(
      [Pages.SCHEDULING],
      serviceKey ? { queryParams: { service: serviceKey } } : undefined,
    );
  }

  /** Reads and clears the section requested via navigateTo(), if any. */
  consumePendingSection(): string | null {
    const section = this.pendingSection;
    this.pendingSection = null;
    return section;
  }
}
