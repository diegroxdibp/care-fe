import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { isObservable, Observable } from 'rxjs';

import { AppConstants } from '../app-constants';
import { SessionService } from '../shared/services/session.service';
import { SnackbarService } from '../shared/services/snackbar.service';
import { AUTH_INIT_WAIT_MS, AuthService } from './auth.service';
import { AccessGuard } from './auth.guard';
import { GuestOnlyGuard } from './guest-only.guard';
import { User } from './user.model';

/**
 * 2026-11-09: com a API de prod em baixo, /me só falhava ao fim de ~36 s e a
 * app ficava em branco até lá. Agora abre ao fim de uns segundos, e os guards
 * esperam pela sessão em vez de tratar quem tem sessão como visitante.
 */
describe('AuthService.init — a app não espera pela API para sempre', () => {
  let http: HttpTestingController;
  let session: SessionService;
  const user = { id: 1, email: 'ana@example.com', profileCompleted: true, roles: [] } as unknown as User;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: SnackbarService, useValue: { openSnackBar: jest.fn() } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionService);
  });

  it('opens as soon as /me answers', fakeAsync(() => {
    let opened = false;
    TestBed.inject(AuthService).init().subscribe(() => (opened = true));

    http.expectOne(AppConstants.apiEndpoints.me).flush(user);

    expect(opened).toBe(true);
    expect(session.user()).toEqual(user);
    expect(TestBed.inject(GuestOnlyGuard).canMatch()).not.toBe(true);
  }));

  it('opens after the wait when /me is slow, and sets the session when it answers', fakeAsync(() => {
    let opened = false;
    TestBed.inject(AuthService).init().subscribe(() => (opened = true));
    const req = http.expectOne(AppConstants.apiEndpoints.me);

    tick(AUTH_INIT_WAIT_MS - 1);
    expect(opened).toBe(false);
    tick(1);
    expect(opened).toBe(true);
    expect(session.user()).toBeNull();

    req.flush(user);
    expect(session.user()).toEqual(user);
    expect(TestBed.inject(AuthService).initialized()).toBe(true);
  }));

  it('makes a guard wait for the late answer instead of sending a signed-in person to the login', fakeAsync(() => {
    TestBed.inject(AuthService).init().subscribe();
    const req = http.expectOne(AppConstants.apiEndpoints.me);
    tick(AUTH_INIT_WAIT_MS);

    const router = TestBed.inject(Router);
    jest.spyOn(router, 'getCurrentNavigation').mockReturnValue({
      extractedUrl: router.parseUrl('/dashboard'),
    } as ReturnType<Router['getCurrentNavigation']>);
    const pending = TestBed.inject(AccessGuard).canMatch();
    expect(isObservable(pending)).toBe(true);

    let decision: boolean | UrlTree | undefined;
    (pending as Observable<boolean | UrlTree>).subscribe(d => (decision = d));
    expect(decision).toBeUndefined();

    req.flush(user);
    expect(decision).toBe(true);
  }));

  it('treats a failed /me as no session, after the wait', fakeAsync(() => {
    TestBed.inject(AuthService).init().subscribe();
    tick(AUTH_INIT_WAIT_MS);
    http.expectOne(AppConstants.apiEndpoints.me).flush(null, { status: 503, statusText: 'Service Unavailable' });

    expect(session.user()).toBeNull();
    expect(TestBed.inject(GuestOnlyGuard).canMatch()).toBe(true);
  }));
});
