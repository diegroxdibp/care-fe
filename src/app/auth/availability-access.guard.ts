import { inject, Injectable } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { SessionService } from '../shared/services/session.service';
import { SnackbarService } from '../shared/services/snackbar.service';
import { Roles } from '../shared/enums/roles.enum';
import { environment } from '../../environments/environment';

// Restricted to production only: staging/dev keep the area open to any
// authenticated user so it stays easy to test regardless of role.
const ALLOWED_ROLES: string[] = [
  Roles.THERAPIST,
  Roles.PROFESSIONAL,
  Roles.ADMIN,
];

@Injectable({ providedIn: 'root' })
export class AvailabilityAccessGuard {
  private sessionService = inject(SessionService);
  private router = inject(Router);
  private snackbarService = inject(SnackbarService);

  canMatch(): boolean | UrlTree | Observable<boolean | UrlTree> {
    return this.sessionService.whenKnown(() => this.decide());
  }

  private decide(): boolean | UrlTree {
    if (!environment.production) return true;

    const user = this.sessionService.user();
    const hasAccess = !!user?.roles?.some((role) => ALLOWED_ROLES.includes(role));
    if (hasAccess) return true;

    this.snackbarService.openSnackBar({
      message: 'Você não tem permissão para acessar esta área',
      action: true,
    });
    return this.router.createUrlTree(['/dashboard']);
  }
}
