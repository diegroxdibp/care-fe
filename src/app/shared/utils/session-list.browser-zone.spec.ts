import { Appointment } from '../models/appointment.model';
import { DayOfWeek } from '../enums/day-of-week.enum';
import { Modality } from '../enums/modality.enum';
import { Currency } from '../enums/currency.enum';
import { buildSessions } from './session-list.util';

/**
 * O resto da suite corre com o processo em UTC/Lisboa, que no inverno são o
 * mesmo relógio — e assim um `new Date('yyyy-MM-dd')` (meia-noite UTC) passa
 * despercebido. Aqui o próprio processo está em São Paulo, como o browser de
 * uma pessoa no Brasil: meia-noite UTC é ainda o dia anterior às 21:00.
 *
 * Corre com `npm run test:browser-zone`.
 */
const SAO_PAULO = 'America/Sao_Paulo';
const LISBON = 'Europe/Lisbon';

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 1,
    professionalId: 10,
    professionalName: 'Luane Bastos',
    clientId: 20,
    availabilityId: 30,
    professionalServiceId: 1,
    modality: Modality.REMOTE,
    startDate: '2026-10-06', // terça
    endDate: '2100-01-01',
    startTime: '10:00',
    endTime: '11:00',
    isRecurring: true,
    dayOfWeek: 'TUESDAY' as unknown as DayOfWeek,
    recurrenceFrequency: 'WEEKLY',
    timeZone: SAO_PAULO,
    status: 'CONFIRMED',
    ...overrides,
  };
}

const opts = {
  perspective: 'CLIENT' as const,
  currency: Currency.EUR,
  paymentsEnabled: false,
  viewerTimeZone: SAO_PAULO,
};

// Só faz sentido com o processo em São Paulo: `npm run test:browser-zone`
// (jest.browser-zone.config.ts). Na suite normal fica de fora, em vez de passar
// sem testar nada.
const runningInSaoPaulo = new Date('2026-01-15T12:00:00Z').getTimezoneOffset() === 180;

(runningInSaoPaulo ? describe : describe.skip)('buildSessions num browser em São Paulo', () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-01T15:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('uma sessão avulsa fica no seu próprio dia', () => {
    const sessions = buildSessions(
      [makeAppointment({ isRecurring: false, startDate: '2026-10-08', endDate: '2026-10-08', dayOfWeek: 'THURSDAY' as unknown as DayOfWeek })],
      [],
      opts,
    );
    expect(sessions.map(s => s.occurrenceKey)).toEqual(['2026-10-08']);
  });

  it('uma série encurtada mantém a sua última sessão (fim de série de uma alteração)', () => {
    // A alteração aceite termina a série antiga na véspera do novo horário.
    const sessions = buildSessions([makeAppointment({ endDate: '2026-10-20' })], [], opts);
    expect(sessions.map(s => s.occurrenceKey)).toEqual(['2026-10-06', '2026-10-13', '2026-10-20']);
  });

  it('uma série quinzenal fica nas suas semanas', () => {
    const sessions = buildSessions(
      [makeAppointment({ recurrenceFrequency: 'BIWEEKLY', endDate: '2026-11-03' })],
      [],
      opts,
    );
    expect(sessions.map(s => s.occurrenceKey)).toEqual(['2026-10-06', '2026-10-20', '2026-11-03']);
  });

  it('vista de Lisboa, a mesma série só muda a hora mostrada, não as ocorrências', () => {
    const sessions = buildSessions(
      [makeAppointment({ endDate: '2026-10-13' })],
      [],
      { ...opts, viewerTimeZone: LISBON },
    );
    expect(sessions.map(s => s.occurrenceKey)).toEqual(['2026-10-06', '2026-10-13']);
    expect(sessions[0].startTime).toBe('14:00');
  });

  it('não mostra uma alteração de série por responder', () => {
    const original = makeAppointment({ endDate: '2026-10-13' });
    const pendingChange = makeAppointment({
      id: 2, status: 'PENDING', replacesAppointmentId: 1, startDate: '2026-10-15', dayOfWeek: 'THURSDAY' as unknown as DayOfWeek,
    });
    const sessions = buildSessions([original, pendingChange], [], opts);
    expect(sessions.every(s => s.appointmentId === 1)).toBe(true);
  });
});
