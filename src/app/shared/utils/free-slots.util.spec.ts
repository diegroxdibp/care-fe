import { AvailabilityModel } from '../models/availability.model';
import { ProfessionalService } from '../models/professional-service.model';
import { DayOfWeek } from '../enums/day-of-week.enum';
import { ProfessionalServiceFormat } from '../enums/professional-service-format.enum';
import { ProfessionalServiceModality } from '../enums/professional-service-modality.enum';
import { freeSlotsOn } from './free-slots.util';

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
