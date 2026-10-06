import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { VideoCallStageComponent } from './video-call-stage.component';
import { SessionService } from '../../services/session.service';
import { VideoSession } from '../../models/video-session.model';

type Handler = (e: unknown) => void;

const fakeCall = {
  handlers: new Map<string, Handler>(),
  on(event: string, handler: Handler) {
    this.handlers.set(event, handler);
    return this;
  },
  join: jest.fn(() => Promise.resolve()),
  leave: jest.fn(() => Promise.resolve()),
  destroy: jest.fn(() => Promise.resolve()),
  participants: () => ({}),
  sendAppMessage: jest.fn(),
  setLocalAudio: jest.fn(),
  setLocalVideo: jest.fn(),
};

jest.mock('@daily-co/daily-js', () => ({
  __esModule: true,
  default: { createCallObject: () => fakeCall },
}));

/**
 * O caso de 06/10/2026, em pequeno: sala de 2h aberta às 16:00 UTC, gente a
 * entrar às 17:08 e a chamada a fechar às 18:00 sem pré-aviso. O fecho tem
 * de estar à vista, avisar nos últimos 5 minutos, e quem criou a sala tem de
 * conseguir adiá-lo de dentro da chamada.
 */
const OPENS_AT = '2026-10-06T16:00:00Z';
const CLOSES_AT = '2026-10-06T18:00:00Z';
const JOINED_AT = '2026-10-06T17:08:00Z';

function session(overrides: Partial<VideoSession> = {}): VideoSession {
  return {
    roomUrl: 'https://careclinica.daily.co/room-3',
    token: 'tok',
    opensAt: OPENS_AT,
    closesAt: CLOSES_AT,
    canExtend: true,
    ...overrides,
  };
}

describe('VideoCallStageComponent — horário de fecho da sala', () => {
  let fixture: ComponentFixture<VideoCallStageComponent>;
  let component: VideoCallStageComponent;
  let router: { navigate: jest.Mock };

  async function join(opts: {
    session?: VideoSession;
    extendSession?: VideoCallStageComponent['extendSession'];
    profileTimeZone?: string;
  } = {}) {
    router = { navigate: jest.fn() };
    await TestBed.configureTestingModule({
      imports: [VideoCallStageComponent],
      providers: [{ provide: Router, useValue: router }],
    }).compileComponents();

    TestBed.inject(SessionService).setUser({
      email: 'luane@example.com',
      name: 'Luane Bastos',
      roles: ['PROFESSIONAL'],
      profileCompleted: true,
      timeZone: opts.profileTimeZone ?? 'America/Sao_Paulo',
    });

    fixture = TestBed.createComponent(VideoCallStageComponent);
    component = fixture.componentInstance;
    const fetchSession = jest.fn(() => of(opts.session ?? session()));
    component.fetchSession = fetchSession;
    component.extendSession = opts.extendSession ?? null;
    fixture.detectChanges();
    // joinCall espera pelo call.join() - deixa a promessa resolver.
    await Promise.resolve();
    await Promise.resolve();
    return fetchSession;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(JOINED_AT));
    fakeCall.handlers.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    fixture?.destroy();
    jest.useRealTimers();
  });

  it('mostra a hora de fecho no fuso do perfil', async () => {
    await join({ profileTimeZone: 'America/Sao_Paulo' });
    expect(component.state()).toBe('in-call');
    expect(component.closesAtLabel()).toBe('15:00');
  });

  it('a mesma sala mostra 19:00 para um perfil em Lisboa (horário de verão)', async () => {
    await join({ profileTimeZone: 'Europe/Lisbon' });
    expect(component.closesAtLabel()).toBe('19:00');
  });

  it('só avisa nos últimos 5 minutos', async () => {
    await join();
    expect(component.endingSoon()).toBe(false);

    jest.setSystemTime(new Date('2026-10-06T17:55:30Z'));
    jest.advanceTimersByTime(15_000);
    expect(component.endingSoon()).toBe(true);
    expect(component.minutesLeft()).toBe(5);
  });

  it('sala avulsa: termina e fecha ao mesmo tempo, sem margem', async () => {
    await join();
    expect(component.hasGracePeriod()).toBe(false);
  });

  describe('marcação: aviso às 17:55, fim às 18:00, fecho às 18:05', () => {
    const appointmentSession = () =>
      session({ canExtend: false, closesAt: '2026-10-06T18:05:00Z', endsAt: '2026-10-06T18:00:00Z' });

    function at(iso: string) {
      jest.setSystemTime(new Date(iso));
      jest.advanceTimersByTime(15_000);
    }

    it('mostra o fim combinado no cabeçalho, não o fecho', async () => {
      await join({ session: appointmentSession() });
      expect(component.hasGracePeriod()).toBe(true);
      expect(component.endsAtLabel()).toBe('15:00');
      expect(component.closesAtLabel()).toBe('15:05');
    });

    it('17:54 ainda sem aviso; 17:55 avisa que a sessão termina em 5 min', async () => {
      await join({ session: appointmentSession() });

      at('2026-10-06T17:54:00Z');
      expect(component.endingSoon()).toBe(false);

      at('2026-10-06T17:55:00Z');
      expect(component.endingSoon()).toBe(true);
      expect(component.minutesLeft()).toBe(5);
      expect(component.inGracePeriod()).toBe(false);
    });

    it('18:00 passa à margem: a sessão terminou, a sala ainda está aberta', async () => {
      await join({ session: appointmentSession() });

      at('2026-10-06T18:00:00Z');
      expect(component.endingSoon()).toBe(false);
      expect(component.inGracePeriod()).toBe(true);
      expect(component.state()).toBe('in-call');
    });

    it('18:05 a chamada fecha sozinha', async () => {
      await join({ session: appointmentSession() });

      jest.advanceTimersByTime(57 * 60_000 - 1_000); // 18:04:59
      expect(component.state()).toBe('in-call');
      jest.advanceTimersByTime(1_000); // 18:05
      expect(component.state()).toBe('ended');
    });
  });

  it('ao chegar ao fecho mostra que o horário terminou, em vez de voltar ao painel sem explicação', async () => {
    await join();
    jest.advanceTimersByTime(52 * 60_000);
    expect(component.state()).toBe('ended');
    expect(component.endedMessage()).toBe('O horário da sala terminou.');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('quem criou estende, o fecho é adiado e as outras pessoas são avisadas', async () => {
    const extendSession = jest.fn(() => of({ closesAt: '2026-10-06T18:30:00Z' }));
    await join({ extendSession });
    expect(component.canExtend()).toBe(true);

    component.extend(30);

    expect(extendSession).toHaveBeenCalledWith(30);
    expect(component.closesAtLabel()).toBe('15:30');
    expect(fakeCall.sendAppMessage).toHaveBeenCalledWith({ kind: 'room-extended' }, '*');

    // O fecho antigo já não corta a chamada.
    jest.advanceTimersByTime(52 * 60_000 + 1_000);
    expect(component.state()).toBe('in-call');
  });

  it('sem permissão (convidado) não há botão de estender, mesmo numa sala avulsa', async () => {
    await join({ session: session({ canExtend: false }), extendSession: jest.fn() });
    expect(component.canExtend()).toBe(false);
  });

  it('numa marcação (sem extendSession) não há botão de estender', async () => {
    await join({ session: session({ canExtend: true }) });
    expect(component.canExtend()).toBe(false);
  });

  it('não oferece passar das 8 horas no total', async () => {
    await join({ session: session({ closesAt: '2026-10-06T23:30:00Z' }), extendSession: jest.fn() });
    // Abre às 16:00, teto às 00:00: +30 cabe, +60 não.
    expect(component.exceedsMaxDuration(30)).toBe(false);
    expect(component.exceedsMaxDuration(60)).toBe(true);
  });

  it('quem recebe o aviso de extensão vai buscar o novo fecho ao backend, não à mensagem', async () => {
    const fetchSession = await join({ session: session({ canExtend: false }) });
    fetchSession.mockReturnValue(of(session({ closesAt: '2026-10-06T19:00:00Z', canExtend: false })));

    fakeCall.handlers.get('app-message')!({ data: { kind: 'room-extended', closesAt: '2026-10-07T03:00:00Z' } });

    expect(fetchSession).toHaveBeenCalledTimes(2);
    expect(component.closesAtLabel()).toBe('16:00');
  });
});
