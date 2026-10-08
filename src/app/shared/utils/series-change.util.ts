import { Appointment } from '../models/appointment.model';
import { AvailabilityModel } from '../models/availability.model';
import { availabilityOccursOn } from './free-slots.util';
import { isWallTimePast } from './timezones.util';

/**
 * Regras de datas para alterar uma série recorrente a partir de um dia — o
 * espelho, do lado de quem escolhe no calendário, do que o backend confere em
 * AppointmentService.proposeSeriesChange.
 */

type SeriesShape = Pick<
  Appointment,
  'startDate' | 'endDate' | 'isRecurring' | 'dayOfWeek' | 'recurrenceFrequency' | 'excludedDates'
>;

function addDays(dateKey: string, days: number): string {
  const d = new Date(dateKey + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Uma alteração por responder: ainda não é uma sessão, é uma proposta sobre outra série. */
export function isPendingSeriesChange(appt: Pick<Appointment, 'status' | 'replacesAppointmentId'>): boolean {
  return appt.status === 'PENDING' && appt.replacesAppointmentId != null;
}

/** A alteração por responder que existe para esta série, se houver. */
export function pendingSeriesChangeFor(appointments: Appointment[], seriesId: number): Appointment | undefined {
  return appointments.find(a => isPendingSeriesChange(a) && a.replacesAppointmentId === seriesId);
}

/**
 * Se a série acontece mesmo nesta data (no fuso em que foi combinada):
 * janela, dia da semana, periodicidade e ocorrências canceladas à parte.
 * A regra de recorrência é a mesma das vagas, por isso reaproveita-a.
 */
export function seriesOccursOn(series: SeriesShape, dateKey: string): boolean {
  if ((series.excludedDates ?? []).includes(dateKey)) return false;
  return availabilityOccursOn(series as unknown as AvailabilityModel, dateKey);
}

/** Primeira ocorrência da série em `fromKey` ou depois, ou null se acabar antes. */
export function nextSeriesOccurrence(series: SeriesShape, fromKey: string, maxDays = 400): string | null {
  let key = fromKey;
  for (let i = 0; i < maxDays; i++) {
    if (series.endDate && key > series.endDate) return null;
    if (seriesOccursOn({ ...series, excludedDates: [] }, key)) return key;
    key = addDays(key, 1);
  }
  return null;
}

/**
 * Se `dateKey` pode ser a primeira sessão da série alterada, na vaga `slot`.
 *
 * Tem de ser uma ocorrência da vaga ainda por vir (à hora exata, no fuso da
 * vaga) e livre. A ocupação vem de `bookedDates`, que não diz de quem é: numa
 * mudança na mesma vaga, as datas que a própria série ocupa contam como livres
 * — a partir da data escolhida ela deixa de existir.
 */
export function isSeriesChangeStartAvailable(
  slot: AvailabilityModel,
  dateKey: string,
  series: Appointment,
  now: Date = new Date(),
): boolean {
  if (!availabilityOccursOn(slot, dateKey)) return false;
  if (isWallTimePast(dateKey, slot.startTime.slice(0, 5), slot.timeZone, now)) return false;
  if (!(slot.bookedDates ?? []).includes(dateKey)) return true;
  return slot.id === series.availabilityId && seriesOccursOn(series, dateKey);
}

/** Quantos meses à frente se confere — o mesmo que AppointmentService.SERIES_CONFLICT_WINDOW_MONTHS. */
export const SERIES_CONFLICT_WINDOW_MONTHS = 3;

/** `dateKey` + `months`, encostado ao fim do mês como o plusMonths do Java (31/01 + 1 → 28/02). */
function addMonths(dateKey: string, months: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const lastDay = new Date(y, m - 1 + months + 1, 0).getDate();
  const target = new Date(y, m - 1 + months, Math.min(d, lastDay));
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const dd = String(target.getDate()).padStart(2, '0');
  return `${target.getFullYear()}-${mm}-${dd}`;
}

/**
 * A primeira data em que uma série nesta vaga — a começar em `startKey`, com
 * esta periodicidade — cairia em cima de uma das `others`, ou null se não
 * pisar nenhuma nos próximos meses. Espelho de
 * AppointmentService.firstSeriesConflict: não basta o primeiro dia estar
 * livre, porque uma série semanal a começar numa semana livre pisa uma
 * quinzenal já marcada de duas em duas semanas. Duas quinzenais em semanas
 * alternadas não se pisam.
 */
export function firstSeriesConflict(
  slot: AvailabilityModel,
  frequency: NonNullable<Appointment['recurrenceFrequency']>,
  startKey: string,
  others: SeriesShape[],
): string | null {
  if (others.length === 0) return null;
  let horizon = addMonths(startKey, SERIES_CONFLICT_WINDOW_MONTHS);
  if (slot.endDate && slot.endDate < horizon) horizon = slot.endDate;

  const proposed: SeriesShape = {
    startDate: startKey,
    endDate: horizon,
    isRecurring: true,
    dayOfWeek: slot.dayOfWeek as unknown as Appointment['dayOfWeek'],
    recurrenceFrequency: frequency,
    excludedDates: [],
  };
  for (let key = startKey; key <= horizon; key = addDays(key, 1)) {
    if (!seriesOccursOn(proposed, key)) continue;
    if (others.some(o => seriesOccursOn(o, key))) return key;
  }
  return null;
}

/** A primeira data livre da vaga para começar — o valor inicial do calendário. */
export function firstSeriesChangeStart(
  slot: AvailabilityModel,
  series: Appointment,
  now: Date = new Date(),
  maxDays = 366,
): string {
  const today = new Date(now);
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  // Um dia antes de hoje no relógio de quem vê: a vaga pode estar num fuso
  // em que ainda é ontem. isWallTimePast trata do que já passou de facto.
  let key = addDays(`${y}-${m}-${d}`, -1);
  for (let i = 0; i < maxDays; i++) {
    if (isSeriesChangeStartAvailable(slot, key, series, now)) return key;
    key = addDays(key, 1);
  }
  return '';
}
