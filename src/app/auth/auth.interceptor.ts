import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { SessionService } from '../shared/services/session.service';

const AUTH_ENDPOINTS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/me',
  '/api/auth/confirm-email',
  '/api/auth/confirm-email-change',
  '/api/auth/resend-confirmation',
];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const sessionService = inject(SessionService);

  const authReq = req.clone({ withCredentials: true });

  return next(authReq).pipe(
    catchError((err) => {
      const isAuthEndpoint = AUTH_ENDPOINTS.some(e => req.url.includes(e));
      if (err.status === 401 && !isAuthEndpoint) {
        sessionService.clear();
        router.navigate(['/auth/signin']);
      }
      return throwError(() => err);
    }),
  );
};
