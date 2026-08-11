import { AvailabilityModel } from '../models/availability.model';
import { DayOfWeek } from '../enums/day-of-week.enum';
import { Modality } from '../enums/modality.enum';
import { normalizeModality } from './modality-compatibility.util';
import { occursOnDate } from './recurrence.util';
import { fromApiEndTime, stripSec, timeToMin } from './session-time.util';

/** Uma vaga livre numa data concreta. */
export interface FreeSlot {
  availabilityId: number;
  startTime: string;
  endTime: string;
  modality: Modality;
}

/**
 * A ocorrência que está a ser movida, para não aparecer a ocupar-se a si
 * própria.
 *
 * Sem isto, o horário onde a sessão já está aparecia sempre ocupado e não dava
 * para trocar só de dia mantendo a hora. É por ocorrência e não pela marcação
 * inteira: numa série semanal, mover a semana 5 não liberta a semana 1.
 */
export interface MovingOccurrence {
  availabilityId: number;
  /** yyyy-MM-dd */
  date: string;
}

export interface FreeSlotsOptions {
  moving?: MovingOccurrence;
  /**
   * Modalidade a manter quando a vaga de destino aceita as duas.
   *
   * Uma vaga a "Qualquer" não decide nada, e a sessão tem de sair daqui com uma
   * modalidade concreta. Sem isto, mudar de dia uma sessão remota devolvia-a
   * como presencial — a pessoa mudava de hora e ficava com outra sessão.
   */
  preferredModality?: Modality;
}

// O backend serializa dayOfWeek como o nome cru do enum Java ('MONDAY'); o
// enum do frontend guarda o rótulo em português. Aceitar ambos evita depender
// de qual dos dois chegou.
const DOW_TO_JS: Record<string, number> = {
  SUNDAY: 0, [DayOfWeek.SUNDAY]: 0,
  MONDAY: 1, [DayOfWeek.MONDAY]: 1,
  TUESDAY: 2, [DayOfWeek.TUESDAY]: 2,
  WEDNESDAY: 3, [DayOfWeek.WEDNESDAY]: 3,
  THURSDAY: 4, [DayOfWeek.THURSDAY]: 4,
  FRIDAY: 5, [DayOfWeek.FRIDAY]: 5,
  SATURDAY: 6, [DayOfWeek.SATURDAY]: 6,
};

/** Se a vaga acontece mesmo nesta data — dia da semana, periodicidade e janela. */
export function availabilityOccursOn(av: AvailabilityModel, dateKey: string): boolean {
  if (!av.startDate) return false;
  if (dateKey < av.startDate) return false;
  if (av.endDate && dateKey > av.endDate) return false;

  if (!av.isRecurring) return av.startDate === dateKey;

  const date = new Date(dateKey + 'T00:00:00');
  const targetDay = DOW_TO_JS[av.dayOfWeek as unknown as string];
  if (targetDay === undefined || date.getDay() !== targetDay) return false;

  return occursOnDate(
    av.recurrenceFrequency,
    new Date(av.startDate + 'T00:00:00'),
    date,
  );
}

/**
 * Vagas livres numa data para um serviço — o que o diálogo de reagendamento
 * oferece como destino.
 *
 * Filtra pelo serviço porque uma sessão não pode mudar para uma vaga que não o
 * ofereça: o backend recusa-a ("Este serviço não é oferecido nesta vaga").
 *
 * A ocupação vem de `bookedDates`, que o backend deriva das marcações reais já
 * a contar com a recorrência de cada uma e com as ocorrências canceladas à
 * parte. É a única fonte que serve os dois lados: quem reagenda do lado da
 * pessoa cliente só conhece as marcações dela e não veria as das outras.
 *
 * Nota: essa lista é calculada numa janela de alguns meses a contar de hoje
 * (AvailabilityService.BOOKED_DATES_WINDOW_MONTHS), pelo que muito para lá
 * disso as vagas aparecem todas livres. O backend recusa na mesma a marcação
 * em cima de outra.
 */
export function freeSlotsOn(
  availabilities: AvailabilityModel[],
  dateKey: string,
  serviceId: number,
  options: FreeSlotsOptions = {},
): FreeSlot[] {
  const { moving, preferredModality } = options;
  const slots: FreeSlot[] = [];

  for (const av of availabilities) {
    if (!av.services?.some(s => s.id === serviceId)) continue;
    if (!availabilityOccursOn(av, dateKey)) continue;

    const isMovingItself = moving != null
      && moving.availabilityId === av.id
      && moving.date === dateKey;
    if (!isMovingItself && (av.bookedDates ?? []).includes(dateKey)) continue;

    slots.push({
      availabilityId: av.id,
      startTime: stripSec(av.startTime),
      endTime: fromApiEndTime(av.endTime),
      modality: resolveModality(av.modality, preferredModality),
    });
  }

  return slots.sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime));
}

/**
 * A modalidade concreta com que a sessão fica nesta vaga.
 *
 * ANY é uma propriedade da vaga ("tanto faz"), não um resultado possível: a
 * sessão resolve-se sempre para presencial ou remoto. Quando a vaga não decide,
 * quem decide é a sessão que já existe; só quando nem ela decide é que se
 * assume presencial.
 */
function resolveModality(slotModality: string, preferred?: Modality): Modality {
  const slot = normalizeModality(slotModality);
  if (slot !== Modality.ANY) return slot;
  if (preferred && preferred !== Modality.ANY) return preferred;
  return Modality.LOCAL;
}
