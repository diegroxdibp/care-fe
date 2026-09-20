import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { Pages } from '../../shared/enums/pages.enum';
import { NavigationService } from '../../shared/services/navigation.service';
import { clearStoredSchedulingNext, isValidSchedulingNext, readStoredSchedulingNext } from '../../shared/utils/scheduling-next.util';
import { FormService } from '../../core/services/form.service';
import { FormControlsNames } from '../../shared/enums/form-controls-names.enum';

/** Same channel name as RegisterComponent — see the comment there. */
const AUTH_BROADCAST_CHANNEL = 'care-auth';

@Component({
  selector: 'app-confirm-email',
  imports: [ReactiveFormsModule],
  templateUrl: './confirm-email.component.html',
  styleUrl: './confirm-email.component.scss',
})
export class ConfirmEmailComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formService = inject(FormService);
  readonly navigationService = inject(NavigationService);

  readonly Pages = Pages;
  readonly token = this.route.snapshot.queryParamMap.get('token');
  // Prefilled from the shared auth form when the person just came from
  // signup/login in this same session — landing on an expired link and
  // having to retype the email you just typed a minute ago is exactly the
  // "stuck" complaint this page exists to avoid.
  readonly resendEmailCtrl = new FormControl(
    this.formService.authForm.get(FormControlsNames.EMAIL)?.value ?? '',
    [Validators.required, Validators.email],
  );

  loading = true;
  success = false;
  error: string | null = null;

  resendLoading = false;
  resendSent = false;
  resendError: string | null = null;

  private authBroadcastChannel: BroadcastChannel | null = null;

  ngOnInit(): void {
    if (!this.token) {
      this.loading = false;
      return;
    }

    this.authService.confirmEmail({ token: this.token }).subscribe({
      next: (result) => {
        this.loading = false;
        this.success = true;

        // The backend confirms and signs in in the same call (sets the JWT
        // cookie) — refresh local session state so the app actually knows
        // it's authenticated before navigating anywhere protected.
        this.authService.refreshSession().subscribe();

        const next = isValidSchedulingNext(result.next) ? result.next : readStoredSchedulingNext();
        clearStoredSchedulingNext();

        // Wakes up a register/account-step tab left waiting in another tab
        // of the same browser — see RegisterComponent. The cookie just set
        // above is shared across tabs of the same browser, so that tab can
        // go straight to `next` too, no separate login step needed there.
        if (typeof BroadcastChannel !== 'undefined') {
          this.authBroadcastChannel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
          this.authBroadcastChannel.postMessage({ type: 'email-confirmed', next });
        }

        setTimeout(() => this.router.navigateByUrl(next ?? '/dashboard'), 2500);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error ?? 'Não foi possível confirmar a conta. Tente novamente.';
      },
    });
  }

  ngOnDestroy(): void {
    this.authBroadcastChannel?.close();
  }

  resend(event: Event): void {
    event.preventDefault();
    if (this.resendEmailCtrl.invalid) {
      this.resendEmailCtrl.markAsTouched();
      return;
    }

    this.resendError = null;
    this.resendLoading = true;
    this.authService.resendConfirmation({ email: this.resendEmailCtrl.value ?? '' }).subscribe({
      next: () => {
        this.resendLoading = false;
        this.resendSent = true;
      },
      error: (err) => {
        this.resendLoading = false;
        this.resendError = err.error?.error ?? 'Não foi possível enviar o email. Tente novamente.';
      },
    });
  }
}
