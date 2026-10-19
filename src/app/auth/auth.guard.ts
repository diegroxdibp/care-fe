import { SnackbarService } from './../shared/services/snackbar.service';
import { inject, Injectable } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { User } from './user.model';
import { SessionService } from '../shared/services/session.service';
import { isSchedulingPath, isValidReturnPath, storeReturnPath } from '../shared/utils/return-path.util';
import { Pages } from '../shared/enums/pages.enum';

@Injectable({ providedIn: 'root' })
export class AccessGuard {
  private sessionService = inject(SessionService);
  private router = inject(Router);
  private snackbarService = inject(SnackbarService);

  canMatch(): boolean | UrlTree {
    const user: User | null = this.sessionService.user();
    // Full attempted URL (path + query params) as the navigation actually
    // resolved it — segments alone would drop the query string.
    const attemptedUrl = this.router.getCurrentNavigation()?.extractedUrl.toString() ?? null;

    if (!user) {
      // The scheduling flow gets the "account is step 1" treatment.
      if (isSchedulingPath(attemptedUrl)) {
        storeReturnPath(attemptedUrl);
        return this.router.createUrlTree([`${Pages.SCHEDULING}/conta`], {
          queryParams: { next: attemptedUrl },
        });
      }

      // Any other link (a proposal, a session, a call from an email) goes to
      // login and comes back to where it was pointing.
      this.snackbarService.openSnackBar({
        message: 'Faça login para acessar esta área',
        action: true,
      });
      if (isValidReturnPath(attemptedUrl)) {
        storeReturnPath(attemptedUrl);
        return this.router.createUrlTree(['/auth/signin'], { queryParams: { next: attemptedUrl } });
      }
      return this.router.createUrlTree(['/auth/signin']);
    }

    if (user && !user.profileCompleted) {
      // Onboarding reads this back when it finishes — a new account opening
      // an invitation link goes sign-up → confirm → onboarding → the link.
      if (isValidReturnPath(attemptedUrl)) {
        storeReturnPath(attemptedUrl);
      }
      this.snackbarService.openSnackBar({
        message: 'Complete o cadastro para acessar esta área',
        action: true,
      });
      return this.router.createUrlTree(['/onboarding']);
    }

    return true;
  }
}
