import { AvailabilityModel } from '../models/availability.model';
import { DayOfWeek } from '../enums/day-of-week.enum';
import { dayKeyInZone, timeInZone, upcomingSlots } from './picker-slots.util';

/**
 * Os horários de entrevista: a equipa abre a vaga num fuso, quem escolhe vê o
 * dia e a hora no fuso do seu perfil, e o que segue para a API é a hora de
 * parede da vaga. São Paulo (UTC-3 sempre) contra Lisboa (UTC+0 no inverno,
 * UTC+1 no verão) — ver docs da regra de fusos.
 */
const SAO_PAULO = 'America/Sao_Paulo';
const LISBON = 'Europe/Lisbon';

function slot(overrides: Partial<AvailabilityModel> = {}): AvailabilityModel {
  return {
    id: 7,
    professionalId: 2,
    professionalName: 'Luane Bastos',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    startTime: '10:00:00',
    endTime: '10:45:00',
    isRecurring: true,
    dayOfWeek: DayOfWeek.TUESDAY,
    recurrenceFrequency: 'WEEKLY',
    bookedDates: [],
    modality: 'ANY',
    timeZone: LISBON,
    services: [],
    ...overrides,
  };
}

describe('upcomingSlots — horários de entrevista', () => {
  it('uma vaga de Lisboa às 10:00 em janeiro aparece às 07:00 a quem está em São Paulo', () => {
    const [first] = upcomingSlots([slot()], new Date('2026-01-12T12:00:00Z'), 14);

    expect(first.date).toBe('2026-01-13');
    expect(first.startTime).toBe('10:00');
    expect(first.endTime).toBe('10:45');
    expect(first.start.toISOString()).toBe('2026-01-13T10:00:00.000Z');
    expect(timeInZone(first.start, SAO_PAULO)).toBe('07:00');
    expect(timeInZone(first.start, LISBON)).toBe('10:00');
    expect(first.modalities).toEqual(['LOCAL', 'REMOTE']);
    expect(first.id).toBe('7:2026-01-13');
  });

  it('em julho, com Lisboa no horário de verão, a mesma vaga aparece às 06:00 em São Paulo', () => {
    const [first] = upcomingSlots([slot()], new Date('2026-07-06T12:00:00Z'), 14);

    expect(first.date).toBe('2026-07-07');
    expect(first.start.toISOString()).toBe('2026-07-07T09:00:00.000Z');
    expect(timeInZone(first.start, SAO_PAULO)).toBe('06:00');
  });

  it('uma vaga de São Paulo às 22:00 cai no dia seguinte para quem está em Lisboa', () => {
    const [first] = upcomingSlots(
      [slot({ timeZone: SAO_PAULO, startTime: '22:00:00', endTime: '22:45:00' })],
      new Date('2026-01-12T12:00:00Z'),
      14,
    );

    expect(first.date).toBe('2026-01-13');
    expect(dayKeyInZone(first.start, SAO_PAULO)).toBe('2026-01-13');
    expect(dayKeyInZone(first.start, LISBON)).toBe('2026-01-14');
    expect(timeInZone(first.start, LISBON)).toBe('01:00');
  });

  it('deixa de fora as datas ocupadas, as fechadas e as que já começaram', () => {
    const list = upcomingSlots(
      [slot({ bookedDates: ['2026-01-20'], closedDates: ['2026-01-27'] })],
      // Terça 13 às 10:30 em Lisboa: a dessa manhã já começou.
      new Date('2026-01-13T10:30:00Z'),
      21,
    );

    expect(list.map(s => s.date)).toEqual(['2026-02-03']);
  });

  it('ordena por instante, de várias vagas', () => {
    const list = upcomingSlots(
      [slot({ id: 1, startTime: '15:00:00', endTime: '15:45:00' }), slot({ id: 2 })],
      new Date('2026-01-12T12:00:00Z'),
      2,
    );

    expect(list.map(s => s.id)).toEqual(['2:2026-01-13', '1:2026-01-13']);
  });
});
