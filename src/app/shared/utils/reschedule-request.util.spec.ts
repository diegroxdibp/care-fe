import { RescheduleRequest } from '../models/reschedule-request.model';
import { freeSlotsOn } from './free-slots.util';
import { rescheduleRequestAsAppointment } from './reschedule-request.util';
import { AvailabilityModel } from '../models/availability.model';

/**
 * O caso de out. 2026: sessão de quinta às 15:30 em Lisboa, pedido para as
 * 11:00 do mesmo dia. O pedido existia, mas a agenda não mostrava nada nas
 * 11:00 — a vaga parecia livre.
 */
function request(overrides: Partial<RescheduleRequest> = {}): RescheduleRequest {
  return {
    id: 1,
    appointmentId: 400,
    professionalId: 7,
    professionalName: 'Luane Bastos',
    clientId: 9,
    clientName: 'Ricardo Rabello',
    professionalServiceId: 10,
    occurrenceDate: '2026-10-22',
    currentStartTime: '15:30:00',
    currentEndTime: '16:30:00',
    currentTimeZone: 'Europe/Lisbon',
    appointmentIsRecurring: false,
    proposedAvailabilityId: 21,
    proposedDate: '2026-10-22',
    proposedStartTime: '11:00:00',
    proposedEndTime: '12:00:00',
    proposedTimeZone: 'Europe/Lisbon',
    proposedModality: 'REMOTE',
    reason: 'Conflito de agenda.',
    requestedById: 7,
    requestedByName: 'Luane Bastos',
    status: 'PENDING',
    createdAt: '2026-10-19T10:50:00Z',
    ...overrides,
  };
}

describe('rescheduleRequestAsAppointment', () => {
  it('shows the proposed slot, on the proposed date only, as pending', () => {
    const hold = rescheduleRequestAsAppointment(request());

    expect(hold.availabilityId).toBe(21);
    expect(hold.startDate).toBe('2026-10-22');
    expect(hold.endDate).toBe('2026-10-22');
    expect(hold.startTime).toBe('11:00');
    expect(hold.endTime).toBe('12:00');
    expect(hold.isRecurring).toBe(false);
    expect(hold.status).toBe('PENDING');
    expect(hold.rescheduleRequestId).toBe(1);
    expect(hold.clientName).toBe('Ricardo Rabello');
    expect(hold.dayOfWeek as unknown as string).toBe('THURSDAY');
  });

  it('keeps the slot’s own wall time and zone — the professional’s calendar shows their own clock', () => {
    const hold = rescheduleRequestAsAppointment(request({ proposedTimeZone: 'America/Sao_Paulo' }));

    expect(hold.startTime).toBe('11:00');
    expect(hold.timeZone).toBe('America/Sao_Paulo');
  });

  it('uses a negative id that never matches a real appointment', () => {
    expect(rescheduleRequestAsAppointment(request({ id: 1 })).id).toBe(-1_000_000_001);
  });

  it('a slot the backend marks as booked on that date is not offered again', () => {
    // O backend conta a reserva em bookedDates; o diálogo de reagendamento lê só isso.
    const morning = {
      id: 21,
      startDate: '2026-01-01',
      isRecurring: true,
      dayOfWeek: 'THURSDAY',
      recurrenceFrequency: 'WEEKLY',
      startTime: '11:00:00',
      endTime: '12:00:00',
      modality: 'REMOTE',
      timeZone: 'Europe/Lisbon',
      services: [{ id: 10 }],
      bookedDates: ['2026-10-22'],
    } as unknown as AvailabilityModel;

    expect(freeSlotsOn([morning], '2026-10-22', 10)).toEqual([]);
    expect(freeSlotsOn([morning], '2026-10-29', 10).map(s => s.startTime)).toEqual(['11:00']);
  });
});
