import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { HeroComponent } from '../../../shared/components/hero/hero.component';
import { PilaresComponent } from '../../../shared/components/pilares/pilares.component';
import { QuoteBandComponent } from '../../../shared/components/quote-band/quote-band.component';
import { ComoFuncionaComponent } from '../../../shared/components/como-funciona/como-funciona.component';
import { ConfiancaComponent } from '../../../shared/components/confianca/confianca.component';
import { Pages } from '../../../shared/enums/pages.enum';
import { AppConstants } from '../../../app-constants';
import { NavigationService } from '../../../shared/services/navigation.service';
import { FaqComponent } from '../../../shared/components/faq/faq.component';
import { ServicesListComponent } from '../../../shared/components/services-list/services-list.component';
import { smoothScrollToElement } from '../../../shared/utils/smooth-scroll-to-element';

const FIXED_HEADER_HEIGHT = 70;

@Component({
  selector: 'app-home',
  imports: [
    HeroComponent,
    PilaresComponent,
    QuoteBandComponent,
    ComoFuncionaComponent,
    ServicesListComponent,
    ConfiancaComponent,
    FaqComponent
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',

})
export class HomeComponent {
  readonly navigationService: NavigationService = inject(NavigationService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  AppConstants = AppConstants;

  ngAfterViewInit() {
    const url = this.navigationService.router.url;

    const routeSectionMap: { [key: string]: string } = {
      [`/${Pages.ATENDIMENTO}`]: 'atendimento',
      '/about': 'about',
      '/contact': 'contact',
    };

    // Arriving fresh from another route (e.g. footer FAQ link, or a direct
    // link to '/#faq').
    const sectionId =
      routeSectionMap[url] ??
      this.navigationService.consumePendingSection() ??
      this.route.snapshot.fragment;
    if (sectionId) {
      this.intelligentScroll(sectionId);
    }

    // A section link clicked while HomeComponent is already mounted (so the
    // block above doesn't re-run) — e.g. the URL is already '/#faq' and the
    // footer FAQ link is clicked again.
    this.navigationService.scrollToSectionRequested
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((sectionId) => this.intelligentScroll(sectionId));
  }

  private intelligentScroll(sectionId: string) {
    // First, wait for all content to load
    this.waitForPageLoad().then(() => {
      // Then wait for the specific element and scroll
      this.waitForElementAndScroll(sectionId);
    });
  }

  private waitForPageLoad(): Promise<void> {
    return new Promise((resolve) => {
      if (document.readyState === 'complete') {
        // Already loaded
        resolve();
      } else {
        // Wait for load event
        window.addEventListener('load', () => resolve(), { once: true });
      }
    });
  }

  private waitForElementAndScroll(sectionId: string, maxAttempts: number = 30) {
    let attempts = 0;

    const checkForElement = () => {
      const element = document.getElementById(sectionId);

      if (element) {
        // Element found - wait a bit more for layout to settle, then scroll
        setTimeout(() => {
          smoothScrollToElement(element, FIXED_HEADER_HEIGHT, 1000);
        }, 200);
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(checkForElement, 150); // Check every 150ms
      } else {
        console.warn(
          `Element with id '${sectionId}' not found after ${maxAttempts} attempts`,
        );
      }
    };

    checkForElement();
  }
}
