import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';

import { SessionService } from '../../shared/services/session.service';
import { ReviewApiService } from './review-api.service';

/**
 * Se a pessoa tem pedidos (candidatura ou propostas de serviço), para mostrar
 * "Meus pedidos" nos menus só a quem tem algo para acompanhar — a maioria das
 * contas é de clientes, que nunca pedem nada. Carrega uma vez por login
 * (muda a conta, volta a perguntar), e MyRequestsComponent atualiza-o com a
 * lista que acabou de carregar.
 */
@Injectable({ providedIn: 'root' })
export class MyRequestsService {
  private readonly api = inject(ReviewApiService);
  private readonly session = inject(SessionService);

  private readonly count = signal(0);
  readonly hasRequests = computed(() => this.count() > 0);

  // Pelo id e não pelo utilizador: a sessão é substituída a cada gravação do
  // perfil, e isso não deve voltar a pedir a lista.
  private readonly userId = computed(() => this.session.user()?.id ?? null);

  constructor() {
    effect(() => {
      const id = this.userId();
      untracked(() => {
        this.count.set(0);
        this.load(id);
      });
    });
  }

  /** Depois de enviar um pedido que não leva a /meus-pedidos (ex.: uma proposta de serviço). */
  refresh(): void {
    this.load(this.userId());
  }

  private load(id: number | null): void {
    if (id == null) return;
    this.api.mine().subscribe({
      next: list => {
        // A conta pode ter mudado enquanto o pedido estava a caminho.
        if (this.userId() === id) this.count.set(list.length);
      },
      error: () => {},
    });
  }

  /** Com a lista acabada de carregar (ex.: em /meus-pedidos, depois de enviar um pedido). */
  setCount(count: number): void {
    this.count.set(count);
  }
}
