import { SnackbarService } from './../shared/services/snackbar.service';
import { inject, Injectable } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { User } from './user.model';
import { SessionService } from '../shared/services/session.service';
import { isValidSchedulingNext, storeSchedulingNext } from '../shared/utils/scheduling-next.util';
import { Pages } from '../shared/enums/pages.enum';

@Injectable({ providedIn: 'root' })
export class AccessGuard {
  private sessionService = inject(SessionService);
  private router = inject(Router);
  private snackbarService = inject(SnackbarService);

  canMatch(): boolean | UrlTree {
    const user: User | null = this.sessionService.user();
    if (!user) {
      // Full attempted URL (path + query params) as the navigation actually
      // resolved it — segments alone would drop the query string.
      const attemptedUrl = this.router.getCurrentNavigation()?.extractedUrl.toString() ?? null;

      // Only the scheduling flow gets the "account is step 1" treatment —
      // other protected areas (dashboard, availability...) keep the old
      // blocking-snackbar behavior, unchanged.
      if (isValidSchedulingNext(attemptedUrl)) {
        storeSchedulingNext(attemptedUrl);
        return this.router.createUrlTree([`${Pages.SCHEDULING}/conta`], {
          queryParams: { next: attemptedUrl },
        });
      }

      this.snackbarService.openSnackBar({
        message: 'Faça login para acessar esta área',
        action: true,
      });
      return this.router.createUrlTree(['/auth/signin']);
    }

    if (user && !user.profileCompleted) {
      this.snackbarService.openSnackBar({
        message: 'Complete o cadastro para acessar esta área',
        action: true,
      });
      return this.router.createUrlTree(['/onboarding']);
    }

    return true;
  }
}
