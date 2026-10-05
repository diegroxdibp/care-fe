import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { Pages } from '../../shared/enums/pages.enum';
import { NavigationService } from '../../shared/services/navigation.service';

@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly navigationService = inject(NavigationService);

  readonly Pages = Pages;
  readonly token = this.route.snapshot.queryParamMap.get('token');

  readonly passwordCtrl = new FormControl('');
  readonly confirmPasswordCtrl = new FormControl('');

  showPassword = false;
  showConfirmPassword = false;
  error: string | null = null;
  loading = false;
  success = false;

  get pwd(): string {
    return this.passwordCtrl.value ?? '';
  }

  get passwordRules() {
    const p = this.pwd;
    return [
      { ok: p.length >= 8, label: 'Mínimo de 8 caracteres' },
      { ok: /[A-Z]/.test(p), label: 'Pelo menos 1 letra maiúscula' },
      { ok: /[0-9]/.test(p), label: 'Pelo menos 1 número' },
      { ok: /[^a-zA-Z0-9]/.test(p), label: 'Pelo menos 1 caractere especial' },
    ];
  }

  get passwordsMismatch(): boolean {
    const confirm = this.confirmPasswordCtrl.value ?? '';
    return confirm.length > 0 && confirm !== this.pwd;
  }

  get canSubmit(): boolean {
    return (
      !!this.token &&
      this.passwordRules.every(r => r.ok) &&
      this.confirmPasswordCtrl.value === this.pwd
    );
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  submit(event: Event): void {
    event.preventDefault();
    if (!this.canSubmit || !this.token) return;

    this.error = null;
    this.loading = true;
    this.authService.resetPassword({ token: this.token, newPassword: this.pwd }).subscribe({
      next: () => {
        this.loading = false;
        this.success = true;
        setTimeout(() => this.router.navigate(['/auth/signin']), 2500);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error ?? 'Não foi possível redefinir a senha. Tente novamente.';
      },
    });
  }
}
