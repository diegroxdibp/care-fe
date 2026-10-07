import { Appointment } from '../models/appointment.model';
import { DayOfWeek } from '../enums/day-of-week.enum';
import { Modality } from '../enums/modality.enum';
import { applyCancellation } from './cancellation.util';

/**
 * Com o processo em São Paulo, como o browser de uma pessoa no Brasil. A
 * véspera da sessão é aritmética de datas; se escorregasse para o relógio do
 * browser (meia-noite UTC = 21:00 do dia anterior aqui), a série encurtada
 * terminava dois dias antes em vez de um.
 *
 * Corre com `npm run test:browser-zone`.
 */
const LISBON = 'Europe/Lisbon';

function series(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 1,
    professionalId: 10,
    professionalName: 'Luane Bastos',
    clientId: 20,
    availabilityId: 30,
    professionalServiceId: 1,
    modality: Modality.REMOTE,
    startDate: '2026-01-06', // terça
    endDate: '2100-01-01',
    startTime: '10:00',
    endTime: '11:00',
    isRecurring: true,
    dayOfWeek: 'TUESDAY' as unknown as DayOfWeek,
    recurrenceFrequency: 'WEEKLY',
    timeZone: LISBON,
    status: 'CONFIRMED',
    ...overrides,
  };
}

// Ver o mesmo comentário em session-list.browser-zone.spec.ts.
const runningInSaoPaulo = new Date('2026-01-15T12:00:00Z').getTimezoneOffset() === 180;

(runningInSaoPaulo ? describe : describe.skip)('applyCancellation num browser em São Paulo', () => {
  it.each([
    ['inverno de Lisboa', '2026-01-13', '2026-01-12'],
    ['verão de Lisboa', '2026-07-07', '2026-07-06'],
    ['virada de mês', '2026-09-01', '2026-08-31'],
  ])('esta e as seguintes termina na véspera (%s)', (_label, tuesday, monday) => {
    expect(applyCancellation([series()], 1, tuesday, 'THIS_AND_FOLLOWING')[0].endDate).toBe(monday);
  });

  it('só esta sessão guarda a data tal como veio', () => {
    expect(applyCancellation([series()], 1, '2026-10-06', 'SINGLE')[0].excludedDates).toEqual(['2026-10-06']);
  });
});
