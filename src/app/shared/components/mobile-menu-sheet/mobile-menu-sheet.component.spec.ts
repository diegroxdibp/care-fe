import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { MobileMenuSheetComponent } from './mobile-menu-sheet.component';
import { MyRequestsService } from '../../../core/services/my-requests.service';
import { SessionService } from '../../services/session.service';
import { Roles } from '../../enums/roles.enum';

/**
 * No telemóvel a barra lateral do painel não aparece: "Meus pedidos" tem de
 * estar neste menu, para quem tem pedidos.
 */
describe('MobileMenuSheetComponent account rows', () => {
  const count = signal(0);

  function rows(roles: string[] = []): string[] {
    TestBed.overrideProvider(MyRequestsService, {
      useValue: { hasRequests: computed(() => count() > 0) },
    });
    TestBed.inject(SessionService).setUser({ id: 1, email: 'p@example.com', roles, profileCompleted: true });
    const component = TestBed.createComponent(MobileMenuSheetComponent).componentInstance;
    return component.userRows().map(r => r.label);
  }

  beforeEach(() => count.set(0));

  it('has no "Meus pedidos" for someone without requests', () => {
    expect(rows()).toEqual(['Mensagens', 'Notificações', 'Conta']);
  });

  it('puts "Meus pedidos" before Conta for someone with requests', () => {
    count.set(1);
    expect(rows()).toEqual(['Mensagens', 'Notificações', 'Meus pedidos', 'Conta']);
  });

  it('keeps the team area last for an admin', () => {
    count.set(2);
    expect(rows([Roles.ADMIN])).toEqual(['Mensagens', 'Notificações', 'Meus pedidos', 'Conta', 'Área da equipe']);
  });
});
