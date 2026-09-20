import { Component, HostBinding, inject, Input, OnDestroy, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormService } from '../../core/services/form.service';
import { AuthService } from '../auth.service';
import { Pages } from '../../shared/enums/pages.enum';
import { NavigationService } from '../../shared/services/navigation.service';
import { FormControlsNames } from '../../shared/enums/form-controls-names.enum';
import { AppConstants } from '../../app-constants';
import { isValidSchedulingNext, storeSchedulingNext } from '../../shared/utils/scheduling-next.util';

/** Cross-tab signal: the confirm-email tab posts here so a waiting
 * register/account-step tab can react instead of sitting dead. Nothing else
 * listens on this channel name. */
const AUTH_BROADCAST_CHANNEL = 'care-auth';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly formService = inject(FormService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly navigationService = inject(NavigationService);

  readonly Pages = Pages;
  error: string | null = null;
  showPassword = false;
  showConfirmPassword = false;
  registered = false;

  /** True when embedded inside /scheduling/conta as step 1 of 5, instead of
   * the standalone /auth/signup page — swaps the h1 for an h2 (the page
   * around it already has its own h1) and drops this component's own page
   * shell so it can sit inside the parent's two-column grid. */
  @Input() embedded = false;
  @HostBinding('class.embedded') get embeddedHostClass(): boolean {
    return this.embedded;
  }

  /** Overrides the submit button label ("Criar conta e continuar" when
   * embedded); the busy label ("A criar...") is unaffected. */
  @Input() ctaLabel: string | null = null;

  /** Validated /scheduling path to resume after auth. Persisted so it
   * survives a full-page navigation (Google OAuth) or a confirmation link
   * opened in a new tab. */
  @Input() next: string | null = null;

  private authBroadcastChannel: BroadcastChannel | null = null;
  emailConfirmedElsewhere = false;

  get buttonLabel(): string {
    if (this.submitting) return 'A criar...';
    return this.ctaLabel ?? 'Cadastrar';
  }

  readonly confirmPasswordCtrl = new FormControl('');
  readonly agreeTermsCtrl = new FormControl(false);

  get emailCtrl(): FormControl {
    return this.formService.authForm.get(FormControlsNames.EMAIL) as FormControl;
  }

  get passwordCtrl(): FormControl {
    return this.formService.authForm.get(FormControlsNames.PASSWORD) as FormControl;
  }

  get pwd(): string {
    return this.passwordCtrl?.value ?? '';
  }

  get passwordRules() {
    const p = this.pwd;
    return [
      { ok: p.length >= 8, label: 'Mínimo de 8 caracteres' },
      { ok: /[A-Z]/.test(p), label: 'Pelo menos 1 letra maiúscula' },
      { ok: /[0-9]/.test(p), label: 'Pelo menos 1 número' },
      { ok: /[^a-zA-Z0-9]/.test(p), label: 'Pelo menos 1 carácter especial' },
    ];
  }

  get passwordsMismatch(): boolean {
    const confirm = this.confirmPasswordCtrl.value ?? '';
    return confirm.length > 0 && confirm !== this.pwd;
  }

  get canSubmit(): boolean {
    return (
      this.emailCtrl?.valid &&
      this.passwordRules.every(r => r.ok) &&
      this.confirmPasswordCtrl.value === this.pwd &&
      !!this.agreeTermsCtrl.value
    );
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  /** Trava cliques repetidos: o segundo criava a conta duas vezes e voltava com
   * "já existe uma conta com este email" para uma conta acabada de criar. */
  submitting = false;

  ngOnInit(): void {
    // On the standalone /auth/signup route (unlike the embedded use inside
    // /scheduling/conta, which passes it explicitly) `next` only arrives as
    // a query param — this app doesn't have withComponentInputBinding().
    if (!this.next) {
      const fromQuery = this.route.snapshot.queryParamMap.get('next');
      if (isValidSchedulingNext(fromQuery)) {
        this.next = fromQuery;
        storeSchedulingNext(fromQuery);
      }
    }
  }

  signUp(event: Event): void {
    event.preventDefault();
    if (!this.canSubmit || this.submitting) return;
    this.error = null;
    this.submitting = true;
    if (this.next) {
      storeSchedulingNext(this.next);
    }
    this.authService.signUp({ ...this.formService.signUpPayload(), next: this.next }).subscribe({
      next: () => {
        this.submitting = false;
        this.registered = true;
        if (this.next) {
          this.listenForEmailConfirmedElsewhere();
        }
      },
      error: (err) => {
        this.submitting = false;
        this.error = err.error?.error ?? 'Erro ao criar conta. Tente novamente.';
      },
    });
  }

  signUpWithGoogle(event: Event): void {
    event.preventDefault();
    if (this.next) {
      storeSchedulingNext(this.next);
    }
    window.location.href = AppConstants.apiEndpoints.loginWithGoogle;
  }

  /**
   * "A conta é confirmada por email... se confirmar noutro aparelho, esta
   * página avança sozinha." The confirm-email tab signs in (sets the JWT
   * cookie) as part of confirming, and that cookie is shared with this tab
   * (same browser) — so once notified, this tab just has to pick it up and
   * go, no separate login step.
   */
  private listenForEmailConfirmedElsewhere(): void {
    if (typeof BroadcastChannel === 'undefined') return;
    this.authBroadcastChannel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
    this.authBroadcastChannel.onmessage = (message) => {
      if (message.data?.type !== 'email-confirmed') return;
      this.emailConfirmedElsewhere = true;
      this.authService.refreshSession().subscribe(() => {
        this.router.navigateByUrl(message.data.next ?? this.next ?? '/dashboard');
      });
    };
  }

  ngOnDestroy(): void {
    this.authBroadcastChannel?.close();
  }
}
