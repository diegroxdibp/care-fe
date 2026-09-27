import { AvailabilityModel } from '../models/availability.model';
import { DayOfWeek } from '../enums/day-of-week.enum';
import { Modality } from '../enums/modality.enum';
import { normalizeModality } from './modality-compatibility.util';
import { occursOnDate } from './recurrence.util';
import { fromApiEndTime, stripSec, timeToMin } from './session-time.util';
import { wallTimeInZone, zonedWallTimeToInstant } from './timezones.util';

/** Uma vaga livre numa data concreta. */
export interface FreeSlot {
  availabilityId: number;
  /** Hora de parede no fuso de origem da vaga — é isto que segue para a API ao reagendar. */
  startTime: string;
  endTime: string;
  modality: Modality;
  /**
   * Mesma hora, já convertida para o fuso de quem escolhe (quando um
   * `viewerTimeZone` foi indicado) — só para mostrar. `startTime`/`endTime`
   * continuam crus de propósito: reagendar envia-os tal como estão, no fuso
   * da vaga de destino, não no de quem os vê.
   */
  displayStartTime?: string;
  displayEndTime?: string;
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
  /**
   * Fuso de quem está a escolher a vaga nova. Sem isto, o diálogo de
   * reagendamento mostra a hora crua da vaga (fuso de quem a criou) — o
   * mesmo erro que a lista de sessões tinha antes de reler no fuso de quem
   * vê. Só afeta `displayStartTime`/`displayEndTime`; o que segue para a API
   * continua a ser `startTime`/`endTime`, no fuso da vaga.
   */
  viewerTimeZone?: string;
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
  const { moving, preferredModality, viewerTimeZone } = options;
  const slots: FreeSlot[] = [];

  for (const av of availabilities) {
    if (!av.services?.some(s => s.id === serviceId)) continue;
    if (!availabilityOccursOn(av, dateKey)) continue;

    const isMovingItself = moving != null
      && moving.availabilityId === av.id
      && moving.date === dateKey;
    if (!isMovingItself && (av.bookedDates ?? []).includes(dateKey)) continue;

    const startTime = stripSec(av.startTime);
    const endTime = fromApiEndTime(av.endTime);
    const display = displayTimeFor(dateKey, startTime, endTime, av.timeZone, viewerTimeZone);

    slots.push({
      availabilityId: av.id,
      startTime,
      endTime,
      modality: resolveModality(av.modality, preferredModality),
      displayStartTime: display.start,
      displayEndTime: display.end,
    });
  }

  return slots.sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime));
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function addDaysKey(dateKey: string, days: number): string {
  const d = new Date(dateKey + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Hora de início/fim da vaga já no fuso de quem escolhe — só para exibição.
 * Sem `viewerTimeZone` ou sem o fuso de origem da vaga (marcações antigas)
 * não há como converter, e o diálogo cai na hora crua, como sempre mostrou.
 */
function displayTimeFor(
  dateKey: string,
  startTime: string,
  endTime: string,
  originTimeZone: string | undefined,
  viewerTimeZone: string | undefined,
): { start?: string; end?: string } {
  if (!viewerTimeZone || !originTimeZone) return {};

  const startInstant = zonedWallTimeToInstant(dateKey, startTime, originTimeZone);
  if (!startInstant) return {};
  const startWall = wallTimeInZone(startInstant, viewerTimeZone);
  const start = `${pad2(startWall.hour)}:${pad2(startWall.minute)}`;

  // Vaga que atravessa a meia-noite: o fim cai no dia seguinte.
  const endDateKey = timeToMin(endTime) <= timeToMin(startTime) ? addDaysKey(dateKey, 1) : dateKey;
  const endInstant = zonedWallTimeToInstant(endDateKey, endTime, originTimeZone);
  const end = endInstant
    ? (() => {
      const endWall = wallTimeInZone(endInstant, viewerTimeZone);
      return `${pad2(endWall.hour)}:${pad2(endWall.minute)}`;
    })()
    : undefined;

  return { start, end };
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
