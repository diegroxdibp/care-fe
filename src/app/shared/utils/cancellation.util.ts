import { Appointment } from '../models/appointment.model';

/**
 * O que a lista de marcações passa a ser depois de um cancelamento — o
 * espelho, do lado de quem vê, do que AppointmentService.cancelAppointment
 * faz no backend, para não ser preciso recarregar.
 */

export type CancellationScope = 'SINGLE' | 'THIS_AND_FOLLOWING';

/** Um dia antes, em aritmética UTC: o fuso do navegador não pode mudar a data. */
function dayBefore(dateKey: string): string {
  const d = new Date(dateKey + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * `occurrenceDate` é a sessão escolhida, no fuso em que a série foi combinada
 * (a mesma chave de `excludedDates` e `startDate`).
 */
export function applyCancellation(
  appointments: Appointment[],
  appointmentId: number,
  occurrenceDate: string,
  scope: CancellationScope,
): Appointment[] {
  const target = appointments.find(a => a.id === appointmentId);
  if (!target) return appointments;

  // Sai a marcação e a alteração por responder que houver sobre ela — o
  // backend apaga as duas juntas.
  const withoutSeries = () =>
    appointments.filter(a => a.id !== appointmentId && a.replacesAppointmentId !== appointmentId);

  // Sessão única ou proposta por aceitar: não há ocorrências a preservar.
  if (!target.isRecurring || target.status === 'PENDING') return withoutSeries();

  if (scope === 'SINGLE') {
    const excluded = target.excludedDates ?? [];
    if (excluded.includes(occurrenceDate)) return appointments;
    return appointments.map(a =>
      a.id === appointmentId ? { ...a, excludedDates: [...excluded, occurrenceDate] } : a,
    );
  }

  const newEnd = dayBefore(occurrenceDate);
  // A série deixou de ter ocorrências - sai da lista por completo.
  if (target.startDate && newEnd < target.startDate) return withoutSeries();
  return appointments.map(a => (a.id === appointmentId ? { ...a, endDate: newEnd } : a));
}
