import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { Pages } from '../../shared/enums/pages.enum';

/**
 * A página que o link da troca de email abre. Pode ser aberta noutro
 * dispositivo, sem sessão, ou com uma sessão do email antigo (que a troca
 * invalida) - por isso não tem GuestOnlyGuard. O backend troca o email e põe
 * uma sessão nova no cookie; daqui segue-se para o perfil.
 */
@Component({
  selector: 'app-confirm-email-change',
  template: `
    <div class="page">
      <div class="card">
        @if (!token) {
          <h1>Link incompleto</h1>
          <p class="subtitle">Abra o link exatamente como chegou no email, ou peça a troca de novo no seu perfil.</p>
        } @else if (loading()) {
          <h1>Confirmando seu novo email...</h1>
          <p class="subtitle">Aguarde um momento.</p>
        } @else if (newEmail()) {
          <h1>Email alterado</h1>
          <p class="subtitle">
            Sua conta agora usa <strong>{{ newEmail() }}</strong>. Use este email para entrar daqui em diante.
          </p>
        } @else {
          <h1>Não foi possível alterar o email</h1>
          <div class="error-msg">{{ error() }}</div>
        }

        @if (!loading()) {
          <p class="switch-link">
            <a
              tabindex="0"
              (click)="goToProfile()"
              (keydown.enter)="goToProfile()"
              (keydown.space)="$event.preventDefault(); goToProfile()"
            >Ir para o seu perfil</a>
          </p>
        }
      </div>
    </div>
  `,
  styleUrl: '../confirm-email/confirm-email.component.scss',
})
export class ConfirmEmailChangeComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly token = this.route.snapshot.queryParamMap.get('token');
  readonly loading = signal(!!this.token);
  readonly newEmail = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    if (!this.token) return;

    this.authService.confirmEmailChange(this.token).subscribe({
      next: (result) => {
        // A sessão nova (com o email novo) já está no cookie; a sessão local
        // ainda tem o email antigo, ou nenhuma.
        this.authService.refreshSession().subscribe({
          next: () => {
            this.loading.set(false);
            this.newEmail.set(result.email);
          },
          error: () => {
            this.loading.set(false);
            this.newEmail.set(result.email);
          },
        });
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.error ?? 'Não foi possível alterar o email. Tente novamente.');
      },
    });
  }

  goToProfile(): void {
    void this.router.navigateByUrl('/' + Pages.DASHBOARD_PROFILE);
  }
}
