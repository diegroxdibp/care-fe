import { TestBed } from '@angular/core/testing';

import { DayOfWeek } from '../enums/day-of-week.enum';
import { AvailabilityModel } from '../models/availability.model';
import { SchedulingService } from './scheduling.service';

/**
 * Datas que o cliente pode escolher para uma vaga que só começa mais à frente,
 * com o processo em São Paulo como o browser de uma pessoa no Brasil. Ali
 * `new Date('2026-11-01')` é meia-noite UTC — ainda 31/10 às 21:00 — e uma
 * vaga mensal ancorada no dia 1 passava a contar a partir do mês anterior.
 *
 * Corre com `npm run test:browser-zone`.
 */
const runningInSaoPaulo = new Date('2026-01-15T12:00:00Z').getTimezoneOffset() === 180;

function makeAvailability(overrides: Partial<AvailabilityModel> = {}): AvailabilityModel {
  return {
    id: 1,
    professionalId: 10,
    professionalName: 'Luane Bastos',
    startDate: '2026-11-05',
    endDate: '2100-01-01',
    startTime: '10:00',
    endTime: '11:00',
    isRecurring: true,
    dayOfWeek: 'THURSDAY' as unknown as DayOfWeek,
    recurrenceFrequency: 'WEEKLY',
    bookedDates: [],
    modality: 'REMOTE',
    timeZone: 'America/Sao_Paulo',
    services: [],
    ...overrides,
  };
}

(runningInSaoPaulo ? describe : describe.skip)('SchedulingService num browser em São Paulo — data de início', () => {
  let service: SchedulingService;

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-15T12:00:00Z') });
    TestBed.configureTestingModule({});
    service = TestBed.inject(SchedulingService);
  });

  afterEach(() => jest.useRealTimers());

  it('vaga semanal que começa em novembro não aparece em outubro', () => {
    service.setAvailabilitites([makeAvailability()]);

    const dates = [...service.timeSlots.keys()].sort();
    expect(dates[0]).toBe('2026-11-05');
    expect(dates).not.toContain('2026-10-29');
  });

  it('vaga mensal ancorada no dia 1 conta a partir de novembro, não do 31 de outubro', () => {
    service.setAvailabilitites([makeAvailability({
      startDate: '2026-11-01',
      dayOfWeek: 'SUNDAY' as unknown as DayOfWeek,
      recurrenceFrequency: 'MONTHLY',
    })]);

    // 1º domingo de cada mês — e não o último, que é o que a âncora deslocada para 31/10 dava.
    expect([...service.timeSlots.keys()].sort()).toEqual(['2026-11-01', '2026-12-06']);
  });
});
