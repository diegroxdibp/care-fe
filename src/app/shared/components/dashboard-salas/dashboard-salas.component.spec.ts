import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
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

/** Entrar direto da lista, sem copiar o link e colar na barra de endereço. */
describe('DashboardSalasComponent — botão Entrar', () => {
  let fixture: ComponentFixture<DashboardSalasComponent>;

  const open = makeRoom({ id: 1, name: 'Reunião Jéssica', opensAt: '2026-10-07T16:00:00Z', closesAt: '2026-10-07T18:00:00Z' });
  const scheduled = makeRoom({ id: 2, name: 'Reunião Carolina', opensAt: '2026-10-07T17:00:00Z', closesAt: '2026-10-07T19:00:00Z' });
  const expired = makeRoom({ id: 3, name: 'Antiga', opensAt: '2026-10-06T16:00:00Z', closesAt: '2026-10-06T18:00:00Z' });

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [DashboardSalasComponent],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: { getMyRooms: jest.fn().mockReturnValue(of([open, scheduled, expired])) } },
      ],
    }).compileComponents();
    TestBed.inject(SessionService).setUser({
      email: 'user@example.com',
      roles: ['PROFESSIONAL'],
      profileCompleted: true,
      timeZone: LISBON,
    });
    fixture = TestBed.createComponent(DashboardSalasComponent);
    fixture.detectChanges();
  }

  const joinLinks = () =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('.btn-join')).map((a) =>
      a.getAttribute('href'),
    );

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-07T16:30:00Z'));
  });

  afterEach(() => {
    fixture?.destroy();
    jest.useRealTimers();
  });

  it('só a sala aberta agora tem Entrar, e leva à página da sala', async () => {
    await setup();
    expect(joinLinks()).toEqual(['/rooms/1/room']);
  });

  it('uma sala agendada ganha o Entrar quando abre, sem recarregar a página', async () => {
    await setup();

    jest.setSystemTime(new Date('2026-10-07T17:00:30Z'));
    jest.advanceTimersByTime(30_000);
    fixture.detectChanges();

    expect(joinLinks()).toEqual(['/rooms/1/room', '/rooms/2/room']);
  });
});

describe('DashboardSalasComponent — sala criada para agora', () => {
  let fixture: ComponentFixture<DashboardSalasComponent>;
  let component: DashboardSalasComponent;

  const joinLinks = () =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('.btn-join')).map((a) =>
      a.getAttribute('href'),
    );

  /** Abre a página à hora atual e cria a sala `createdAfterMs` depois. */
  async function createNow(serverOpensAt: string, createdAfterMs = 0) {
    const created = makeRoom({ id: 9, name: 'Agora', opensAt: serverOpensAt, closesAt: '2026-10-07T17:30:00Z' });
    await TestBed.configureTestingModule({
      imports: [DashboardSalasComponent],
      providers: [
        provideRouter([]),
        {
          provide: ApiService,
          useValue: {
            getMyRooms: jest.fn().mockReturnValue(of([])),
            createRoom: jest.fn().mockReturnValue(of(created)),
          },
        },
      ],
    });
    // O diálogo devolve o pedido de uma sala "agora" (sem opensAt). Com
    // overrideProvider, e não em providers, porque o componente traz o
    // MatDialogModule nos seus próprios imports.
    TestBed.overrideProvider(MatDialog, {
      useValue: { open: () => ({ afterClosed: () => of({ name: 'Agora', opensAt: null, durationMinutes: 60 }) }) },
    });
    await TestBed.compileComponents();
    TestBed.inject(SessionService).setUser({
      email: 'user@example.com',
      roles: ['PROFESSIONAL'],
      profileCompleted: true,
      timeZone: LISBON,
    });
    fixture = TestBed.createComponent(DashboardSalasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    jest.setSystemTime(Date.now() + createdAfterMs);
    component.openCreateDialog();
    fixture.detectChanges();
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-07T16:30:00Z'));
  });

  afterEach(() => {
    fixture?.destroy();
    jest.useRealTimers();
  });

  it('aparece já disponível, mesmo criada entre dois tiques do relógio da lista', async () => {
    // A página abriu às 16:30:00; a sala é criada 20 s depois, antes do próximo tique.
    await createNow('2026-10-07T16:30:20Z', 20_000);

    expect(component.statusOf(component.rooms()[0])).toBe('agora');
    expect(joinLinks()).toEqual(['/rooms/9/room']);
  });

  it('aparece já disponível mesmo com o relógio do computador uns segundos atrasado', async () => {
    // O servidor abriu a sala às 16:30:08; este computador ainda marca 16:30:00.
    await createNow('2026-10-07T16:30:08Z');

    expect(component.statusOf(component.rooms()[0])).toBe('agora');
    expect(joinLinks()).toEqual(['/rooms/9/room']);
  });
});
