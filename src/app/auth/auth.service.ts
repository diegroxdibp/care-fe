import { SessionService } from '../shared/services/session.service';
import { signal, computed, inject, Injectable } from '@angular/core';
import {
  catchError,
  finalize,
  map,
  Observable,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { SignInPayload } from '../shared/models/sign-in-payload';
import { SignInResponse } from '../shared/models/sign-in-response';
import { SignUpPayload } from '../shared/models/sign-up-payload';
import { SignUpResponse } from '../shared/models/sign-up-response';
import { ForgotPasswordPayload } from '../shared/models/forgot-password-payload';
import { ResetPasswordPayload } from '../shared/models/reset-password-payload';
import { ConfirmEmailPayload } from '../shared/models/confirm-email-payload';
import { ConfirmEmailResponse } from '../shared/models/confirm-email-response';
import { ResendConfirmationPayload } from '../shared/models/resend-confirmation-payload';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AppConstants } from '../app-constants';
import { User } from './user.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly sessionService = inject(SessionService);

  private _initialized = signal(false);
  readonly initialized = computed(() => this._initialized());

  init(): Observable<void> {
    return this.http
      .get<User>(AppConstants.apiEndpoints.me, { withCredentials: true })
      .pipe(
        tap((user: User) => this.sessionService.setUser(user)),
        catchError(() => {
          this.sessionService.setUser(null);
          return of(null);
        }),
        finalize(() => this._initialized.set(true)),
        map(() => void 0)
      );
  }
  signUp(payload: SignUpPayload): Observable<SignUpResponse> {
    return this.http.post<SignUpResponse>(AppConstants.apiEndpoints.register, payload);
  }

  signIn(payload: SignInPayload): Observable<User> {
    return this.http
      .post<SignInResponse>(AppConstants.apiEndpoints.login, payload, {
        withCredentials: true,
      })
      .pipe(switchMap(() => this.refreshSession()));
  }

  forgotPassword(payload: ForgotPasswordPayload): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      AppConstants.apiEndpoints.forgotPassword,
      payload,
    );
  }

  resetPassword(payload: ResetPasswordPayload): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      AppConstants.apiEndpoints.resetPassword,
      payload,
    );
  }

  // withCredentials: confirming now also signs in (the backend sets the JWT
  // cookie in the same call) — without it the browser would drop the
  // Set-Cookie header from this cross-origin response.
  confirmEmail(payload: ConfirmEmailPayload): Observable<ConfirmEmailResponse> {
    return this.http.post<ConfirmEmailResponse>(
      AppConstants.apiEndpoints.confirmEmail,
      payload,
      { withCredentials: true },
    );
  }

  resendConfirmation(payload: ResendConfirmationPayload): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      AppConstants.apiEndpoints.resendConfirmation,
      payload,
    );
  }

  logout() {
    this.http
      .post(AppConstants.apiEndpoints.logout, {}, { withCredentials: true })
      .subscribe(() => {
        this.sessionService.setUser(null);
        this.router.navigate(['/auth/login']);
      });
  }

  refreshSession(): Observable<User> {
    return this.http
      .get<User>(AppConstants.apiEndpoints.me, { withCredentials: true })
      .pipe(tap((user) => this.sessionService.setUser(user)));
  }
}
