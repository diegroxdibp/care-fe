import { Appointment } from '../models/appointment.model';
import { DayOfWeek } from '../enums/day-of-week.enum';
import { Modality } from '../enums/modality.enum';
import { applyCancellation } from './cancellation.util';

const SAO_PAULO = 'America/Sao_Paulo';
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

describe('applyCancellation', () => {
  it('só esta sessão: desmarca a data escolhida, não a primeira da série', () => {
    // 07/10/2026: Disponibilidade tirava a série inteira da lista, e o
    // backend desmarcava a primeira sessão - a de hoje voltava ao recarregar.
    const [after] = applyCancellation([series()], 1, '2026-10-06', 'SINGLE');
    expect(after.excludedDates).toEqual(['2026-10-06']);
    expect(after.endDate).toBe('2100-01-01');
  });

  it('só esta sessão, de novo: não duplica a data', () => {
    const list = [series({ excludedDates: ['2026-10-06'] })];
    expect(applyCancellation(list, 1, '2026-10-06', 'SINGLE')).toBe(list);
  });

  it('esta e as seguintes: a série termina na véspera', () => {
    const [after] = applyCancellation([series()], 1, '2026-10-06', 'THIS_AND_FOLLOWING');
    expect(after.endDate).toBe('2026-10-05');
  });

  it('esta e as seguintes a partir da primeira: a série e a alteração pendente saem', () => {
    const change = series({ id: 2, status: 'PENDING', replacesAppointmentId: 1 });
    const other = series({ id: 3 });
    const after = applyCancellation([series(), change, other], 1, '2026-01-06', 'THIS_AND_FOLLOWING');
    expect(after.map(a => a.id)).toEqual([3]);
  });

  it('uma sessão única sai da lista, seja qual for o âmbito', () => {
    const single = series({ isRecurring: false, endDate: '2026-10-06', startDate: '2026-10-06' });
    expect(applyCancellation([single], 1, '2026-10-06', 'SINGLE')).toEqual([]);
  });

  it('uma proposta por aceitar sai por inteiro', () => {
    expect(applyCancellation([series({ status: 'PENDING' })], 1, '2026-10-06', 'SINGLE')).toEqual([]);
  });

  it('id desconhecido: a lista fica igual', () => {
    const list = [series()];
    expect(applyCancellation(list, 99, '2026-10-06', 'SINGLE')).toBe(list);
  });

  // A data é a da série, no fuso em que foi combinada, e é tratada como chave:
  // nada aqui depende do fuso de quem vê. Uma série de São Paulo às 20:00 de
  // terça (já quarta em Lisboa no verão) desmarca-se pela terça.
  describe.each([
    ['série de São Paulo, julho', SAO_PAULO, '2026-07-07', '2026-07-06'],
    ['série de São Paulo, janeiro', SAO_PAULO, '2026-01-13', '2026-01-12'],
    ['série de Lisboa, julho', LISBON, '2026-07-07', '2026-07-06'],
    ['série de Lisboa, janeiro', LISBON, '2026-01-13', '2026-01-12'],
  ])('%s', (_label, timeZone, tuesday, monday) => {
    const s = series({ timeZone, startTime: '20:00', endTime: '21:00' });

    it('só esta sessão marca exatamente essa terça', () => {
      expect(applyCancellation([s], 1, tuesday, 'SINGLE')[0].excludedDates).toEqual([tuesday]);
    });

    it('esta e as seguintes termina na segunda anterior', () => {
    });
  });

  it('a véspera atravessa mês e ano', () => {
    const s = series({ startDate: '2025-01-07' });
    expect(applyCancellation([s], 1, '2026-01-01', 'THIS_AND_FOLLOWING')[0].endDate).toBe('2025-12-31');
    expect(applyCancellation([s], 1, '2026-03-01', 'THIS_AND_FOLLOWING')[0].endDate).toBe('2026-02-28');
  });
});
