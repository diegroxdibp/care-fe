import { computed, Injectable, signal } from '@angular/core';
import { map, Observable, ReplaySubject, take } from 'rxjs';
import { User } from '../../auth/user.model';

@Injectable({
  providedIn: 'root',
})
export class SessionService {
  private _user = signal<User | null>(null);
  readonly user = computed(() => this._user());
  readonly isAuthenticated = computed(() => !!this.user());

  private readonly _known = signal(false);
  private readonly known$ = new ReplaySubject<void>(1);

  /**
   * Já se sabe quem está na sessão: a primeira resposta de /api/auth/me
   * chegou (ou falhou). A app abre sem esperar por ela além de uns segundos
   * (AuthService.init), por isso pode haver um momento em que user() é null
   * só porque ainda não se sabe.
   */
  markKnown(): void {
    if (this._known()) return;
    this._known.set(true);
    this.known$.next();
  }

  /**
   * Para os guards: decide já se a sessão é conhecida; senão espera por ela,
   * para que uma API lenta não mande quem tem sessão para o login.
   */
  whenKnown<T>(decide: () => T): T | Observable<T> {
    return this._known() ? decide() : this.known$.pipe(take(1), map(decide));
  }

  setUser(user: User | null) {
    this._user.set(user);
  }

  updateUser(userPartial: Partial<User>) {
    const current = this.user();
    if (!current) return;

    this._user.set({
      ...current,
      ...userPartial,
    });
  }

  clear() {
    this._user.set(null);
  }
}
