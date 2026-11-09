import { inject, Injectable } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { SessionService } from '../shared/services/session.service';
@Injectable({ providedIn: 'root' })
export class AuthOnlyGuard {
  private sessionService = inject(SessionService);
  private router = inject(Router);

  canMatch(): boolean | UrlTree | Observable<boolean | UrlTree> {
    return this.sessionService.whenKnown(() => this.decide());
  }

  private decide(): boolean | UrlTree {
    const user = this.sessionService.user();

    if (!user) {
      return this.router.createUrlTree(['/auth/signin']);
    }

    return true;
  }
}
