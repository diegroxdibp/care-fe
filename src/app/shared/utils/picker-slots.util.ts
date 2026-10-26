import { AvailabilityModel } from '../models/availability.model';
import { Modality } from '../enums/modality.enum';
import { availabilityOccursOn } from './free-slots.util';
import { getBookableModalities } from './modality-compatibility.util';
import { fromApiEndTime, stripSec } from './session-time.util';
import { sessionZone, wallTimeInZone, zonedWallTimeToInstant } from './timezones.util';

/**
 * Um horário concreto para escolher no seletor de disponibilidade (as
 * entrevistas, por agora): uma data de uma vaga, livre e por vir.
 *
 * Leva as duas formas da hora. start/end são instantes, para mostrar e
 * agrupar no fuso de quem escolhe; date/startTime/endTime são a hora de
 * parede no fuso da vaga, tal como segue para a API (como em FreeSlot).
 */
export interface PickerSlot {
  /** availabilityId:date */
  id: string;
  availabilityId: number;
  date: string;
  startTime: string;
  endTime: string;
  start: Date;
  end: Date;
  host: string;
  modalities: ('LOCAL' | 'REMOTE')[];
  address: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * As datas livres e por vir das vagas, nos próximos `days` dias, por ordem.
 * Uma data ocupada (bookedDates) ou fechada não aparece; a que já começou
 * também não, comparando instantes — nunca a hora crua contra o relógio do
 * computador.
 */
export function upcomingSlots(availabilities: AvailabilityModel[], now: Date = new Date(), days = 60): PickerSlot[] {
  const out: PickerSlot[] = [];
  // Um dia de folga para cada lado: uma vaga de hoje noutro fuso pode ser
  // "ontem" ou "amanhã" em UTC.
  const first = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - DAY_MS;
  for (let i = 0; i <= days + 2; i++) {
    const date = new Date(first + i * DAY_MS).toISOString().slice(0, 10);
    for (const av of availabilities) {
      if (!availabilityOccursOn(av, date)) continue;
      if ((av.bookedDates ?? []).includes(date) || (av.closedDates ?? []).includes(date)) continue;
      const zone = sessionZone(av.timeZone);
      const startTime = stripSec(av.startTime);
      const endTime = fromApiEndTime(av.endTime);
      const start = zonedWallTimeToInstant(date, startTime, zone);
      const end = zonedWallTimeToInstant(date, endTime, zone);
      if (!start || !end || start.getTime() <= now.getTime()) continue;
      out.push({
        id: `${av.id}:${date}`,
        availabilityId: av.id,
        date,
        startTime,
        endTime,
        start,
        end,
        host: av.professionalName,
        modalities: getBookableModalities(av.modality).map(m => (m === Modality.LOCAL ? 'LOCAL' : 'REMOTE')),
        address: av.address?.trim() || null,
      });
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** O dia (yyyy-MM-dd) em que um instante cai no fuso dado. */
export function dayKeyInZone(instant: Date, timeZone: string): string {
  const p = wallTimeInZone(instant, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** "10:00" no fuso dado. */
export function timeInZone(instant: Date, timeZone: string): string {
  const p = wallTimeInZone(instant, timeZone);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

/** Minutos entre o início e o fim. */
export function durationMinutes(slot: { start: Date; end: Date }): number {
  return Math.round((slot.end.getTime() - slot.start.getTime()) / 60000);
}
