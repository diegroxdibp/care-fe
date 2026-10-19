import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';

import { AccessGuard } from './auth.guard';
import { SessionService } from '../shared/services/session.service';
import { SnackbarService } from '../shared/services/snackbar.service';
import {
  RETURN_PATH_STORAGE_KEY,
  isValidReturnPath,
  readStoredReturnPath,
} from '../shared/utils/return-path.util';

/**
 * Um link de um email (uma proposta, uma sessão, um convite) aberto sem sessão
 * iniciada tem de voltar a esse link depois do login - e, numa conta nova,
 * depois da confirmação e do onboarding. Antes só os passos do Agendar
 * voltavam; tudo o resto caía no painel.
 */
describe('isValidReturnPath', () => {
  it('aceita as áreas da app', () => {
    for (const path of [
      '/scheduling', '/scheduling/confirmar?x=1', '/dashboard', '/dashboard/proposals/83',
      '/appointments/7/room', '/rooms/3/room', '/availability',
    ]) {
      expect(isValidReturnPath(path)).toBe(true);
    }
  });

  it('recusa URLs absolutas, relativas ao protocolo e páginas fora da lista', () => {
    for (const path of [
      'https://evil.example.com', '//evil.example.com', '/auth/signin', '/onboarding',
      '/dashboardx', 'dashboard', '', null, undefined,
    ]) {
      expect(isValidReturnPath(path)).toBe(false);
    }
  });
});

describe('AccessGuard — volta ao link depois de entrar', () => {
  let guard: AccessGuard;
  let session: SessionService;
  let attemptedUrl: string;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [{ provide: SnackbarService, useValue: { openSnackBar: jest.fn() } }],
    });
    const router = TestBed.inject(Router);
    jest.spyOn(router, 'getCurrentNavigation').mockImplementation(
      () => ({ extractedUrl: router.parseUrl(attemptedUrl) }) as ReturnType<Router['getCurrentNavigation']>,
    );
    session = TestBed.inject(SessionService);
    guard = TestBed.inject(AccessGuard);
  });

  function result(): string {
    return TestBed.inject(Router).serializeUrl(guard.canMatch() as UrlTree);
  }

  it('sem sessão, um link do painel vai ao login com next e fica guardado', () => {
    attemptedUrl = '/dashboard/proposals/83';
    expect(result()).toBe('/auth/signin?next=%2Fdashboard%2Fproposals%2F83');
    expect(readStoredReturnPath()).toBe('/dashboard/proposals/83');
  });

  it('sem sessão, o Agendar continua a ir para a conta como passo 1', () => {
    attemptedUrl = '/scheduling/confirmar';
    expect(result()).toBe('/scheduling/conta?next=%2Fscheduling%2Fconfirmar');
  });

  it('com a conta por completar, guarda o link para o onboarding voltar a ele', () => {
    session.setUser({ email: 'ash@example.com', roles: ['USER'], profileCompleted: false });
    attemptedUrl = '/appointments/7/room';
    expect(result()).toBe('/onboarding');
    expect(localStorage.getItem(RETURN_PATH_STORAGE_KEY)).toBe('/appointments/7/room');
  });

  it('com sessão e perfil completo, deixa passar', () => {
    session.setUser({ email: 'ash@example.com', roles: ['USER'], profileCompleted: true });
    attemptedUrl = '/dashboard';
    expect(guard.canMatch()).toBe(true);
  });
});
