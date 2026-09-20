import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RegisterComponent } from '../../../../auth/register/register.component';
import { SchedulingStepperComponent } from '../../../../shared/components/scheduling-stepper/scheduling-stepper.component';
import { isValidSchedulingNext, storeSchedulingNext } from '../../../../shared/utils/scheduling-next.util';

/**
 * /scheduling/conta — step 1 of 5 of the scheduling flow. Where AccessGuard
 * sends a logged-out visitor instead of the old blocking snackbar + redirect
 * to /auth/signin: same signup form (RegisterComponent, embedded), reframed
 * as a necessary step with a promise that they return to where they were.
 */
@Component({
  selector: 'app-account-step',
  imports: [RegisterComponent, SchedulingStepperComponent],
  templateUrl: './account-step.component.html',
  styleUrl: './account-step.component.scss',
})
export class AccountStepComponent {
  private readonly route = inject(ActivatedRoute);

  readonly next: string | null = this.resolveNext();

  private resolveNext(): string | null {
    const fromQuery = this.route.snapshot.queryParamMap.get('next');
    if (isValidSchedulingNext(fromQuery)) {
      // Persisted immediately: survives a full-page Google OAuth round trip
      // and a confirmation link opened in a new tab, neither of which keep
      // the query param around on their own.
      storeSchedulingNext(fromQuery);
      return fromQuery;
    }
    return null;
  }
}
