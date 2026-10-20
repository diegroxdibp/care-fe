import { inject, Injectable } from '@angular/core';
import { Router, UrlTree } from '@angular/router';

import { Roles } from '../shared/enums/roles.enum';
import { SessionService } from '../shared/services/session.service';
import { SnackbarService } from '../shared/services/snackbar.service';

/**
 * A área da equipa (/admin): só ADMIN, em todos os ambientes. O backend
 * recusa na mesma (CatalogueAdminController); isto só esconde a área.
 */
@Injectable({ providedIn: 'root' })
export class AdminGuard {
  private readonly sessionService = inject(SessionService);
  private readonly router = inject(Router);
  private readonly snackbarService = inject(SnackbarService);

  canMatch(): boolean | UrlTree {
    if (this.sessionService.user()?.roles?.includes(Roles.ADMIN)) return true;
    this.snackbarService.openSnackBar({ message: 'Você não tem permissão para acessar esta área', action: true });
    return this.router.createUrlTree(['/dashboard']);
  }
}
