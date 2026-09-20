import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { FormService } from '../../core/services/form.service';
import { AuthService } from '../auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Pages } from '../../shared/enums/pages.enum';
import { NavigationService } from '../../shared/services/navigation.service';
import { FormControlsNames } from '../../shared/enums/form-controls-names.enum';
import { AppConstants } from '../../app-constants';
import { clearStoredSchedulingNext, isValidSchedulingNext, storeSchedulingNext } from '../../shared/utils/scheduling-next.util';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly formService = inject(FormService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly navigationService = inject(NavigationService);

  readonly Pages = Pages;
  error: string | null = null;
  unconfirmed = false;
  showPassword = false;

  /** Resuming a scheduling attempt made while logged out — see AccessGuard. */
  readonly next: string | null = this.resolveNext();

  private resolveNext(): string | null {
    const fromQuery = this.route.snapshot.queryParamMap.get('next');
    if (isValidSchedulingNext(fromQuery)) {
      storeSchedulingNext(fromQuery);
      return fromQuery;
    }
    return null;
  }

  get emailCtrl(): FormControl {
    return this.formService.authForm.get(FormControlsNames.EMAIL) as FormControl;
  }

  get passwordCtrl(): FormControl {
    return this.formService.authForm.get(FormControlsNames.PASSWORD) as FormControl;
  }

  /** Trava cliques repetidos enquanto o pedido está em curso. */
  submitting = false;

  signIn(event: Event): void {
    event.preventDefault();
    if (this.submitting) return;
    this.error = null;
    this.unconfirmed = false;
    this.submitting = true;
    this.authService.signIn(this.formService.signInPayload()).subscribe({
      next: () => {
        this.submitting = false;
        clearStoredSchedulingNext();
        this.router.navigateByUrl(this.next ?? '/dashboard');
      },
      error: (err) => {
        this.submitting = false;
        if (err.status === 403) {
          this.unconfirmed = true;
          this.error = err.error?.error ?? 'Confirme o seu email antes de iniciar sessão.';
        } else {
          this.error =
            err.status === 401
              ? (err.error?.error ?? 'Email ou senha incorretos.')
              : 'Ocorreu um erro. Tente novamente.';
        }
      },
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  signInWithGoogle(event: Event): void {
    event.preventDefault();
    window.location.href = AppConstants.apiEndpoints.loginWithGoogle;
  }
}
