import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';

import { ApiService } from '../../../core/services/api.service';
import { SessionService } from '../../services/session.service';
import { SnackbarService } from '../../services/snackbar.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { Invitation, InvitationPreview, InvitationStatus } from '../../models/invitation.model';
import { ProfessionalSessionService } from '../../enums/professional-session-service.enum';
import { normalizeRecurrenceFrequency } from '../../utils/recurrence.util';
import { normalizeModality } from '../../utils/modality-compatibility.util';
import { detectBrowserTimezone } from '../../utils/timezones.util';
import { storeReturnPath } from '../../utils/return-path.util';

type PageState = 'loading' | 'not-found' | 'logged-out' | 'other-account' | 'ready';

/**
 * A página do link do email de um convite. Pública: quem ainda não tem conta
 * (ou não entrou) vê de quem é e quando, e segue para criar a conta com o
 * email convidado ou para entrar — e volta aqui pelo return path. Com a
 * conta certa, responde.
 */
@Component({
  selector: 'app-invitation-page',
  standalone: true,
  templateUrl: './invitation-page.component.html',
  styleUrls: ['../proposal-confirm/proposal-confirm.component.scss', './invitation-page.component.scss'],
})
export class InvitationPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly apiService = inject(ApiService);
  private readonly sessionService = inject(SessionService);
  private readonly snackbarService = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);

  readonly token = this.route.snapshot.paramMap.get('token') ?? '';

  readonly state = signal<PageState>('loading');
  readonly preview = signal<InvitationPreview | null>(null);
  readonly invitation = signal<Invitation | null>(null);
  readonly responding = signal(false);
  /** Depois de responder aqui mesmo, sem voltar a carregar. */
  readonly answered = signal<InvitationStatus | null>(null);

  private readonly viewerZone = computed(() => this.sessionService.user()?.timeZone || detectBrowserTimezone());

  /** O que se mostra vem do convite completo quando já há, senão da pré-visualização. */
  private readonly shown = computed(() => this.invitation() ?? this.preview());

  readonly status = computed<InvitationStatus | null>(() => this.answered() ?? this.shown()?.status ?? null);
  readonly isSeries = computed(() => this.shown()?.kind === 'SERIES');
  readonly professionalName = computed(() => this.shown()?.professionalName ?? '');
  readonly invitedEmail = computed(() => this.preview()?.invitedEmail ?? this.invitation()?.invitedEmail ?? '');
  readonly signedInEmail = computed(() => this.sessionService.user()?.email ?? '');

  readonly serviceName = computed(() => {
    const raw = this.shown()?.serviceName ?? '';
    return ProfessionalSessionService[raw as keyof typeof ProfessionalSessionService] ?? raw;
  });
  readonly frequencyLabel = computed(() => normalizeRecurrenceFrequency(this.shown()?.recurrenceFrequency ?? undefined));
  readonly modalityLabel = computed(() => normalizeModality(String(this.shown()?.modality ?? '')));

  /** Data, dia e hora da (primeira) sessão no fuso de quem vê — o instante vem do backend. */
  readonly when = computed(() => {
    const s = this.shown();
    if (!s?.firstSessionAt) return null;
    const instant = new Date(s.firstSessionAt);
    const timeZone = this.viewerZone();
    const date = new Intl.DateTimeFormat('pt-BR', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' })
      .format(instant);
    const weekday = new Intl.DateTimeFormat('pt-BR', { timeZone, weekday: 'long' }).format(instant);
    const time = new Intl.DateTimeFormat('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .format(instant);
    return { date, weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1), time };
  });

  readonly message = computed(() => this.invitation()?.message ?? null);

  ngOnInit(): void {
    this.apiService.previewInvitation(this.token).subscribe({
      next: (preview) => {
        this.preview.set(preview);
        const user = this.sessionService.user();
        if (!user) {
          this.state.set('logged-out');
          return;
        }
        if (user.email?.toLowerCase() !== preview.invitedEmail.toLowerCase()) {
          this.state.set('other-account');
          return;
        }
        if (!user.profileCompleted) {
          // Conta nova ainda por completar: o onboarding volta aqui no fim.
          storeReturnPath(this.returnPath());
          this.router.navigate(['/onboarding']);
          return;
        }
        this.apiService.getInvitation(this.token).subscribe({
          next: (invitation) => {
            this.invitation.set(invitation);
            this.state.set('ready');
          },
          error: () => this.state.set('ready'),
        });
      },
      error: () => this.state.set('not-found'),
    });
  }

  private returnPath(): string {
    return `/invitations/${this.token}`;
  }

  signUp(): void {
    const next = this.returnPath();
    storeReturnPath(next);
    this.router.navigate(['/auth/signup'], {
      queryParams: { next, email: this.invitedEmail(), lockEmail: 1 },
    });
  }

  signIn(): void {
    const next = this.returnPath();
    storeReturnPath(next);
    this.router.navigate(['/auth/signin'], { queryParams: { next } });
  }

  accept(): void {
    if (this.responding()) return;
    this.responding.set(true);
    this.apiService.acceptInvitation(this.token).subscribe({
      next: () => {
        this.responding.set(false);
        this.answered.set('ACCEPTED');
        this.snackbarService.openSnackBar({ message: 'Convite aceito. A sessão já está na sua agenda.' });
        this.router.navigate(['/dashboard']);
      },
      // O interceptor já mostra o motivo (horário ocupado, convite expirado).
      error: (err: HttpErrorResponse) => {
        this.responding.set(false);
        if (err.status === 409) this.reload();
      },
    });
  }

  decline(): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '440px',
      panelClass: 'care-dialog',
      data: {
        title: 'Recusar convite',
        message: `${this.professionalName()} vai saber que você recusou.`,
        confirmLabel: 'Recusar',
      },
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.responding.set(true);
      this.apiService.declineInvitation(this.token).subscribe({
        next: () => {
          this.responding.set(false);
          this.answered.set('DECLINED');
        },
        error: () => this.responding.set(false),
      });
    });
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  private reload(): void {
    this.apiService.getInvitation(this.token).subscribe({
      next: (invitation) => this.invitation.set(invitation),
      error: () => {},
    });
  }
}
