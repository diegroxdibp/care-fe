import { AvailabilityModel } from '../models/availability.model';
import { ProfessionalService } from '../models/professional-service.model';
import { DayOfWeek } from '../enums/day-of-week.enum';
import { ProfessionalServiceFormat } from '../enums/professional-service-format.enum';
import { ProfessionalServiceModality } from '../enums/professional-service-modality.enum';
import { availabilityOccursOn, freeSlotsOn } from './free-slots.util';

/**
 * Cobre o diálogo de reagendamento: quem escolhe uma vaga nova tem de ver a
 * hora no SEU fuso (displayStartTime/displayEndTime), mas o que segue para a
 * API continua a ser a hora crua da vaga (startTime/endTime) — reagendar
 * envia a hora no fuso da vaga de destino, não no de quem escolheu.
 */
const SAO_PAULO = 'America/Sao_Paulo';
const LISBON = 'Europe/Lisbon';

const SERVICE: ProfessionalService = {
  id: 1,
  name: 'REICHIAN_BODY_ANALYSIS',
  format: ProfessionalServiceFormat.INDIVIDUAL,
  modality: ProfessionalServiceModality.LOCAL,
  price: '60',
  active: true,
};

function makeAvailability(overrides: Partial<AvailabilityModel> = {}): AvailabilityModel {
  return {
    id: 1,
    professionalId: 10,
    professionalName: 'Luane Bastos',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    startTime: '22:00:00',
    endTime: '23:00:00',
    isRecurring: true,
    dayOfWeek: DayOfWeek.THURSDAY,
    recurrenceFrequency: 'WEEKLY',
    bookedDates: [],
    modality: 'REMOTE',
    timeZone: SAO_PAULO,
    services: [SERVICE],
    ...overrides,
  };
}

describe('freeSlotsOn — hora de exibição convertida, hora submetida intacta', () => {
  it('sem viewerTimeZone (uso da própria pessoa profissional), não converte — comportamento de sempre', () => {
    const [slot] = freeSlotsOn([makeAvailability()], '2026-01-15', SERVICE.id);

    expect(slot.startTime).toBe('22:00');
    expect(slot.endTime).toBe('23:00');
    expect(slot.displayStartTime).toBeUndefined();
    expect(slot.displayEndTime).toBeUndefined();
  });

  it('com viewerTimeZone, mostra a hora convertida sem tocar em startTime/endTime', () => {
    const [slot] = freeSlotsOn([makeAvailability()], '2026-01-15', SERVICE.id, {
      viewerTimeZone: LISBON,
    });

    // startTime/endTime continuam no fuso da vaga (São Paulo) — é o que
    // reagendar envia à API, para a vaga de destino interpretar.
    expect(slot.startTime).toBe('22:00');
    expect(slot.endTime).toBe('23:00');

    // displayStartTime/displayEndTime são só para mostrar, já em Lisboa.
    expect(slot.displayStartTime).toBe('01:00');
    expect(slot.displayEndTime).toBe('02:00');
  });

  it('a mesma vaga em julho (verão europeu) mostra uma hora de exibição diferente, sem mexer em startTime/endTime', () => {
    const [slot] = freeSlotsOn([makeAvailability()], '2026-07-16', SERVICE.id, {
      viewerTimeZone: LISBON,
    });

    expect(slot.startTime).toBe('22:00');
    expect(slot.displayStartTime).toBe('02:00');
    expect(slot.displayEndTime).toBe('03:00');
  });

  it('vaga que atravessa a meia-noite: o fim de exibição cai no dia certo', () => {
    const [slot] = freeSlotsOn(
      [makeAvailability({ startTime: '23:30:00', endTime: '00:30:00' })],
      '2026-01-15',
      SERVICE.id,
      { viewerTimeZone: SAO_PAULO }, // mesmo fuso: isola a regra da meia-noite da conversão de fuso
    );

    expect(slot.displayStartTime).toBe('23:30');
    expect(slot.displayEndTime).toBe('00:30');
  });

  it('sem o fuso de origem da vaga (dados antigos), não converte — cai no comportamento anterior', () => {
    const [slot] = freeSlotsOn(
      [makeAvailability({ timeZone: undefined })],
      '2026-01-15',
      SERVICE.id,
      { viewerTimeZone: LISBON },
    );

    expect(slot.displayStartTime).toBeUndefined();
    expect(slot.displayEndTime).toBeUndefined();
  });
});

describe('freeSlotsOn — ocupação e filtros continuam corretos independentemente do fuso de quem vê', () => {
  it('uma data já ocupada (bookedDates) fica de fora mesmo com viewerTimeZone definido', () => {
    const slots = freeSlotsOn(
      [makeAvailability({ bookedDates: ['2026-01-15'] })],
      '2026-01-15',
      SERVICE.id,
      { viewerTimeZone: LISBON },
    );

    expect(slots).toHaveLength(0);
  });

  it('a ocorrência que está a ser movida aparece mesmo estando "ocupada" por si própria', () => {
    const slots = freeSlotsOn(
      [makeAvailability({ id: 5, bookedDates: ['2026-01-15'] })],
      '2026-01-15',
      SERVICE.id,
      { moving: { availabilityId: 5, date: '2026-01-15' }, viewerTimeZone: LISBON },
    );

    expect(slots).toHaveLength(1);
  });
});

/**
 * "Remover horário → Só neste dia" fecha uma única ocorrência de uma vaga
 * recorrente. A data fechada é a do fuso da vaga (como startDate), por isso
 * quem vê de outro fuso perde exatamente essa ocorrência — mesmo quando, no
 * seu relógio, ela cai noutro dia — e continua a ver as semanas seguintes.
 */
describe('closedDates — um dia fechado sai, o resto da série fica', () => {
  it('vaga em São Paulo vista de Lisboa, em janeiro: a quinta fechada sai, a seguinte continua', () => {
    const av = makeAvailability({ closedDates: ['2026-01-15'] });

    expect(availabilityOccursOn(av, '2026-01-15')).toBe(false);
    expect(freeSlotsOn([av], '2026-01-15', SERVICE.id, { viewerTimeZone: LISBON })).toEqual([]);

    const [next] = freeSlotsOn([av], '2026-01-22', SERVICE.id, { viewerTimeZone: LISBON });
    expect(next.startTime).toBe('22:00');
    expect(next.displayStartTime).toBe('01:00');
  });

  it('vaga em São Paulo vista de Lisboa, em julho: o mesmo, com a hora de verão europeia', () => {
    const av = makeAvailability({ closedDates: ['2026-07-16'] });

    expect(freeSlotsOn([av], '2026-07-16', SERVICE.id, { viewerTimeZone: LISBON })).toEqual([]);

    const [next] = freeSlotsOn([av], '2026-07-23', SERVICE.id, { viewerTimeZone: LISBON });
    expect(next.displayStartTime).toBe('02:00');
  });

  it('vaga em Lisboa vista de São Paulo, em janeiro e em julho', () => {
    const av = makeAvailability({
      timeZone: LISBON,
      startTime: '01:00:00',
      endTime: '02:00:00',
      closedDates: ['2026-01-15', '2026-07-16'],
    });

    expect(freeSlotsOn([av], '2026-01-15', SERVICE.id, { viewerTimeZone: SAO_PAULO })).toEqual([]);
    expect(freeSlotsOn([av], '2026-07-16', SERVICE.id, { viewerTimeZone: SAO_PAULO })).toEqual([]);

    const [jan] = freeSlotsOn([av], '2026-01-22', SERVICE.id, { viewerTimeZone: SAO_PAULO });
    expect(jan.displayStartTime).toBe('22:00');
    const [jul] = freeSlotsOn([av], '2026-07-23', SERVICE.id, { viewerTimeZone: SAO_PAULO });
    expect(jul.displayStartTime).toBe('21:00');
  });

  it('nem a ocorrência a ser movida reabre um dia fechado', () => {
    const av = makeAvailability({ closedDates: ['2026-01-15'] });

    expect(freeSlotsOn([av], '2026-01-15', SERVICE.id, {
      moving: { availabilityId: av.id, date: '2026-01-15' },
    })).toEqual([]);
  });
});
