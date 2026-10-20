import { Appointment } from '../models/appointment.model';
import { RescheduleRequest } from '../models/reschedule-request.model';
import { DayOfWeek } from '../enums/day-of-week.enum';
import { Modality } from '../enums/modality.enum';
import { fromApiEndTime, stripSec } from './session-time.util';

/**
 * O mesmo desvio do backend (RescheduleRequest.HOLD_ID_OFFSET): o id negativo
 * da reserva nunca coincide com o de um convite (-invitation.id) nem com o de
 * uma marcação real.
 */
const HOLD_ID_OFFSET = 1_000_000_000;

// O backend serializa o dia como o nome do enum Java ('THURSDAY').
const JS_TO_DOW = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

/**
 * O destino de um pedido de reagendamento por responder, visto na agenda da
 * pessoa profissional: reserva a vaga nessa data como uma marcação pendente
 * (no backend, RescheduleRequest.asHold), por isso mostra-se como uma — a
 * amarelo, na vaga proposta. A sessão original continua onde está.
 */
export function rescheduleRequestAsAppointment(request: RescheduleRequest): Appointment {
  const day = new Date(request.proposedDate + 'T00:00:00').getDay();
  return {
    id: -(HOLD_ID_OFFSET + request.id),
    rescheduleRequestId: request.id,
    professionalId: request.professionalId,
    professionalName: request.professionalName,
    clientId: request.clientId,
    clientName: request.clientName,
    availabilityId: request.proposedAvailabilityId,
    professionalServiceId: request.professionalServiceId,
    modality: request.proposedModality as unknown as Modality,
    startDate: request.proposedDate,
    endDate: request.proposedDate,
    startTime: stripSec(request.proposedStartTime),
    endTime: fromApiEndTime(request.proposedEndTime),
    isRecurring: false,
    dayOfWeek: JS_TO_DOW[day] as unknown as DayOfWeek,
    timeZone: request.proposedTimeZone,
    status: 'PENDING',
  };
}
