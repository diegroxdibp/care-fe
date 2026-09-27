import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { DashboardSalasComponent } from './dashboard-salas.component';
import { ApiService } from '../../../core/services/api.service';
import { SessionService } from '../../services/session.service';
import { Room } from '../../models/room.model';

/**
 * Room.opensAt/closesAt já são instantes absolutos — o bug aqui não era de
 * conversão de fuso, era mais simples e mais grave: formatWindow nem sequer
 * olhava para o fuso do perfil, caía sempre no fuso do sistema do navegador.
 * Estes testes fixam o "navegador" num fuso diferente do perfil para provar
 * que é o perfil que manda.
 */
const SAO_PAULO = 'America/Sao_Paulo';
const LISBON = 'Europe/Lisbon';

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: 1,
    accessMode: 'ANYONE_WITH_LINK',
    allowedUsers: [],
    // 2026-01-15T20:00:00Z — não coincide com meia-noite em nenhum dos dois
    // fusos, para que o teste realmente distinga um do outro.
    opensAt: '2026-01-15T20:00:00Z',
    closesAt: '2026-01-15T21:00:00Z',
    joinLink: 'https://example.com/join/1',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('DashboardSalasComponent — formatWindow usa o fuso do perfil, não o do navegador', () => {
  let fixture: ComponentFixture<DashboardSalasComponent>;
  let component: DashboardSalasComponent;

  async function setup(profileTimeZone: string | undefined) {
    const apiService = { getMyRooms: jest.fn().mockReturnValue(of([])) };

    await TestBed.configureTestingModule({
      imports: [DashboardSalasComponent],
      providers: [{ provide: ApiService, useValue: apiService }],
    }).compileComponents();

    const sessionService = TestBed.inject(SessionService);
    sessionService.setUser({
      email: 'user@example.com',
      roles: ['USER'],
      profileCompleted: true,
      timeZone: profileTimeZone,
    });

    fixture = TestBed.createComponent(DashboardSalasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('mostra a janela da sala em São Paulo quando é essa a preferência do perfil', async () => {
    await setup(SAO_PAULO);
    // 20:00 UTC = 17:00 em São Paulo (UTC-3), mesmo dia.
    expect(component.formatWindow(makeRoom())).toBe('15/01, 17:00 – 15/01, 18:00');
  });

  it('a MESMA sala mostra uma janela diferente quando o perfil está em Lisboa', async () => {
    await setup(LISBON);
    // 20:00 UTC = 20:00 em Lisboa (UTC+0 em janeiro), mesmo dia.
    expect(component.formatWindow(makeRoom())).toBe('15/01, 20:00 – 15/01, 21:00');
  });
});
