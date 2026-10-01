import { Appointment } from '../models/appointment.model';
import { AvailabilityModel } from '../models/availability.model';
import { DayOfWeek } from '../enums/day-of-week.enum';
import { Modality } from '../enums/modality.enum';
import {
  firstSeriesChangeStart,
  isPendingSeriesChange,
  isSeriesChangeStartAvailable,
  nextSeriesOccurrence,
  pendingSeriesChangeFor,
} from './series-change.util';

const SAO_PAULO = 'America/Sao_Paulo';
const LISBON = 'Europe/Lisbon';

function slot(overrides: Partial<AvailabilityModel> = {}): AvailabilityModel {
  return {
    id: 30,
    professionalId: 10,
    professionalName: 'Luane Bastos',
    startDate: '2026-01-06', // terça
    endDate: '2100-01-01',
    startTime: '10:00',
    endTime: '11:00',
    isRecurring: true,
    dayOfWeek: 'TUESDAY' as unknown as DayOfWeek,
    recurrenceFrequency: 'WEEKLY',
    bookedDates: [],
    modality: 'ANY',
    timeZone: LISBON,
    services: [],
    ...overrides,
  };
}

function series(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 1,
    professionalId: 10,
    professionalName: 'Luane Bastos',
    clientId: 20,
    availabilityId: 30,
    professionalServiceId: 1,
    modality: Modality.REMOTE,
    startDate: '2026-01-06',
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

describe('isSeriesChangeStartAvailable', () => {
  const now = new Date('2026-10-01T12:00:00Z'); // quinta

  it('só aceita ocorrências da vaga', () => {
    expect(isSeriesChangeStartAvailable(slot(), '2026-10-06', series(), now)).toBe(true);
    expect(isSeriesChangeStartAvailable(slot(), '2026-10-07', series(), now)).toBe(false);
  });

  it('recusa uma data que outra pessoa já ocupa na vaga', () => {
    const other = slot({ id: 31, bookedDates: ['2026-10-13'] });
    expect(isSeriesChangeStartAvailable(other, '2026-10-13', series(), now)).toBe(false);
    expect(isSeriesChangeStartAvailable(other, '2026-10-20', series(), now)).toBe(true);
  });

  it('na mesma vaga, as datas ocupadas pela própria série contam como livres', () => {
    const same = slot({ bookedDates: ['2026-10-06', '2026-10-13'] });
    expect(isSeriesChangeStartAvailable(same, '2026-10-13', series(), now)).toBe(true);
  });

  it('mas não uma data que a série tinha desmarcado e outra pessoa ocupou', () => {
    const same = slot({ bookedDates: ['2026-10-13'] });
    const withCancellation = series({ excludedDates: ['2026-10-13'] });
    expect(isSeriesChangeStartAvailable(same, '2026-10-13', withCancellation, now)).toBe(false);
  });

  // A hora da vaga lê-se no fuso dela, não no de quem vê: o par Brasil/Portugal
  // muda de diferença entre inverno (3h) e verão europeu (4h).
  it('hoje às 10:00 em Lisboa já passou às 09:30 de São Paulo no inverno', () => {
    const tuesdayJan = slot({ startDate: '2027-01-05' });
    // 2027-01-05 09:30 em São Paulo = 12:30 UTC = 12:30 em Lisboa (passou as 10:00).
    const at = new Date('2027-01-05T12:30:00Z');
    expect(isSeriesChangeStartAvailable(tuesdayJan, '2027-01-05', series(), at)).toBe(false);
    // 06:30 em São Paulo = 09:30 em Lisboa — ainda vem.
    expect(isSeriesChangeStartAvailable(tuesdayJan, '2027-01-05', series(), new Date('2027-01-05T09:30:00Z')))
      .toBe(true);
  });

  it('vaga de São Paulo vista de Lisboa no verão: 20:00 em São Paulo ainda vem às 23:30 de Lisboa', () => {
    const spSlot = slot({ timeZone: SAO_PAULO, startTime: '20:00', endTime: '21:00' });
    // 2026-07-07 23:30 Lisboa (UTC+1) = 22:30 UTC = 19:30 São Paulo.
    expect(isSeriesChangeStartAvailable(spSlot, '2026-07-07', series(), new Date('2026-07-07T22:30:00Z')))
      .toBe(true);
    // 00:30 de quarta em Lisboa = 20:30 de terça em São Paulo — já começou.
    expect(isSeriesChangeStartAvailable(spSlot, '2026-07-07', series(), new Date('2026-07-07T23:30:00Z')))
      .toBe(false);
  });
});

describe('firstSeriesChangeStart', () => {
  it('salta as datas ocupadas por outras pessoas', () => {
    const now = new Date('2026-10-01T12:00:00Z');
    const other = slot({ id: 31, bookedDates: ['2026-10-06', '2026-10-13'] });
    expect(firstSeriesChangeStart(other, series(), now)).toBe('2026-10-20');
  });

  it('segue a periodicidade da vaga', () => {
    const now = new Date('2026-10-01T12:00:00Z');
    // Âncora 2026-01-06; 2026-10-06 é 39 semanas depois → semana ímpar.
    const biweekly = slot({ id: 31, recurrenceFrequency: 'BIWEEKLY' });
    expect(firstSeriesChangeStart(biweekly, series(), now)).toBe('2026-10-13');
  });
});

describe('nextSeriesOccurrence', () => {
  it('encontra a ocorrência da série a partir de uma data', () => {
    expect(nextSeriesOccurrence(series(), '2026-10-08')).toBe('2026-10-13');
  });

  it('devolve null quando a série termina antes', () => {
    expect(nextSeriesOccurrence(series({ endDate: '2026-10-10' }), '2026-10-08')).toBeNull();
  });
});

describe('pendingSeriesChangeFor', () => {
  it('distingue uma alteração por responder de uma proposta recorrente nova', () => {
    const change = series({ id: 2, status: 'PENDING', replacesAppointmentId: 1 });
    const proposal = series({ id: 3, status: 'PENDING' });
    expect(isPendingSeriesChange(change)).toBe(true);
    expect(isPendingSeriesChange(proposal)).toBe(false);
    expect(pendingSeriesChangeFor([proposal, change], 1)).toBe(change);
    expect(pendingSeriesChangeFor([proposal], 1)).toBeUndefined();
  });
});
