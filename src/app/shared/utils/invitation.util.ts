import { Appointment } from '../models/appointment.model';
import { Invitation } from '../models/invitation.model';
import { DayOfWeek } from '../enums/day-of-week.enum';
import { Modality } from '../enums/modality.enum';
import { fromApiEndTime, stripSec } from './session-time.util';

/** O fim de uma série sem fim — o mesmo do backend (Constant.FAR_FUTURE_END_DATE). */
const FAR_FUTURE_END_DATE = '2100-01-01';

/**
 * Um convite por responder visto na agenda da pessoa profissional: reserva a
 * vaga como uma marcação pendente (no backend, Invitation.asHold), por isso
 * mostra-se como uma. O id negativo nunca coincide com o de uma marcação real.
 */
export function invitationAsAppointment(invitation: Invitation): Appointment {
  const series = invitation.kind === 'SERIES';
  return {
    id: -invitation.id,
    invitationId: invitation.id,
    professionalId: invitation.professionalId,
    professionalName: invitation.professionalName,
    clientId: invitation.clientId ?? 0,
    clientName: invitation.clientName ?? invitation.invitedEmail,
    clientEmail: invitation.invitedEmail,
    availabilityId: invitation.availabilityId,
    professionalServiceId: invitation.professionalServiceId,
    modality: invitation.modality as unknown as Modality,
    startDate: invitation.startDate,
    endDate: series ? FAR_FUTURE_END_DATE : invitation.startDate,
    startTime: stripSec(invitation.startTime),
    endTime: fromApiEndTime(invitation.endTime),
    isRecurring: series,
    dayOfWeek: invitation.dayOfWeek as unknown as DayOfWeek,
    recurrenceFrequency: series ? (invitation.recurrenceFrequency ?? undefined) : undefined,
    timeZone: invitation.timeZone,
    address: invitation.address ?? undefined,
    price: invitation.price ?? undefined,
    priceBRL: invitation.priceBRL ?? undefined,
    status: 'PENDING',
  };
}
