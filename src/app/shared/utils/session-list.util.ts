import { Appointment } from '../models/appointment.model';
import { ProfessionalService } from '../models/professional-service.model';
import { DayOfWeek } from '../enums/day-of-week.enum';
import { Modality } from '../enums/modality.enum';
import { ProfessionalSessionService } from '../enums/professional-session-service.enum';
import { RecurrenceFrequency } from '../enums/recurrence-frequency.enum';
import { Currency, formatPrice } from '../enums/currency.enum';
import { generateOccurrences } from './recurrence.util';
import { normalizeModality } from './modality-compatibility.util';
import { wallTimeInZone, zonedWallTimeToInstant } from './timezones.util';

/** 'A combinar' cobre ANY e qualquer modalidade não resolvível — nunca um palpite. */
export type SessionMode = 'Presencial' | 'Remoto' | 'A combinar';

export interface SessionCounterpart {
  id: number;
  name: string;
  role?: string;
  initials: string;
}

export interface BuiltSession {
  appointmentId: number;
  /**
   * Identidade da linha: a marcação e a ocorrência.
   *
   * Uma série recorrente é uma marcação só e várias linhas, pelo que o id
   * sozinho repete-se — e o @for que o usava como chave queixava-se de chaves
   * duplicadas e reaproveitava linhas erradas ao reordenar.
   */
  key: string;
  /** Quem atende — a agenda de onde saem as vagas para onde a sessão pode mudar. */
  professionalId: number;
  /** A sessão só pode mudar para uma vaga que ofereça este mesmo serviço. */
  professionalServiceId: number;
  /** A vaga onde a sessão está hoje. */
  availabilityId: number;
  /** Id do cliente da marcação — usado para filtrar a lista por pessoa cliente. */
  clientId: number;
  date: Date;
  /**
   * Chave (yyyy-MM-dd) da ocorrência no fuso em que a marcação foi
   * combinada — não no fuso de quem vê. `date` já vem ajustada para
   * exibição (pode cair no dia seguinte, ver `resolveOccurrenceDisplay`); é
   * esta chave, e não `date`, que identifica a ocorrência para o backend
   * (reagendar, cancelar) e para o `excludedDates` local — ambos combinados
   * e guardados em termos do fuso de origem.
   */
  occurrenceKey: string;
  dow: string;
  fullDow: string;
  day: number;
  month: string;
  who: string;
  service: string;
  startTime: string;
  endTime: string;
  mode: SessionMode;
  /** A modalidade crua — `mode` já é rótulo e não serve para voltar à API. */
  modality: Modality;
  address?: string;
  platform?: string;
  price?: string;
  recurrence: string;
  isRecurring: boolean;
  duration: string;
  payment: string;
  notes?: string;
  professionals: SessionCounterpart[];
}

/** Do ponto de vista de quem vê a lista: a pessoa cliente vê a(s) profissional(is); a profissional vê a pessoa cliente. */
export type SessionViewerPerspective = 'CLIENT' | 'PROFESSIONAL';

export interface BuildSessionsOptions {
  perspective: SessionViewerPerspective;
  currency: Currency;
  paymentsEnabled: boolean;
  /**
   * Fuso de quem está a ver a lista. startTime/endTime chegam na hora de
   * parede combinada na marcação (fuso de quem a autorou, em appt.timeZone)
   * — sem reler neste fuso, quem vê do outro lado do mundo via a hora de
   * quem marcou, não a sua.
   */
  viewerTimeZone: string;
}

/** Indexados por Date.getDay() — usados quando a data foi ajustada de fuso, e o dayOfWeek cru do backend já não serve. */
const DOW_ABR_BY_JS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DOW_FULL_BY_JS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const DOW_JS: Record<string, number> = {
  SUNDAY: 0,    [DayOfWeek.SUNDAY]: 0,
  MONDAY: 1,    [DayOfWeek.MONDAY]: 1,
  TUESDAY: 2,   [DayOfWeek.TUESDAY]: 2,
  WEDNESDAY: 3, [DayOfWeek.WEDNESDAY]: 3,
  THURSDAY: 4,  [DayOfWeek.THURSDAY]: 4,
  FRIDAY: 5,    [DayOfWeek.FRIDAY]: 5,
  SATURDAY: 6,  [DayOfWeek.SATURDAY]: 6,
};

const MONTHS = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

/** yyyy-MM-dd em hora local — as datas do backend não têm fuso. */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function initialsFor(name: string): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Minutos entre "HH:mm:ss" (ou "HH:mm"), sem arredondar. */
function durationLabel(startTime?: string, endTime?: string): string {
  if (!startTime || !endTime) return '';
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  // Uma sessão pode atravessar a meia-noite (ex.: 23:00–00:00) - nesse
  // caso o fim "parece" mais cedo que o início em minutos do dia, daí
  // envolver para o dia seguinte em vez de dar uma duração negativa.
  let minutes = toMinutes(endTime) - toMinutes(startTime);
  if (minutes <= 0) minutes += 24 * 60;
  return `${minutes} minutos`;
}

const JOIN_WINDOW_BEFORE_MIN = 5;
const JOIN_WINDOW_AFTER_MIN = 30;

/** Início/fim reais (data + hora) de uma ocorrência — null quando não há horas (não devia acontecer numa sessão marcada). */
export function sessionBounds(session: BuiltSession): { start: Date; end: Date } | null {
  if (!session.startTime || !session.endTime) return null;
  const [sh, sm] = session.startTime.split(':').map(Number);
  const [eh, em] = session.endTime.split(':').map(Number);
  const start = new Date(session.date);
  start.setHours(sh, sm, 0, 0);
  const end = new Date(session.date);
  end.setHours(eh, em, 0, 0);
  // Mesma regra da durationLabel: uma sessão pode atravessar a meia-noite.
  if (end <= start) end.setDate(end.getDate() + 1);
  return { start, end };
}

/**
 * Se a sessão remota está dentro da janela de entrada da videochamada (5 min
 * antes até 30 min depois do horário combinado). Só decide se o botão
 * "Entrar" aparece — quem manda de facto é o backend, que recusa fora da
 * janela mesmo que este cálculo do lado do cliente esteja desalinhado com o
 * relógio do servidor.
 */
export function canJoinSession(session: BuiltSession, now: Date = new Date()): boolean {
  if (session.mode !== 'Remoto') return false;
  const bounds = sessionBounds(session);
  if (!bounds) return false;
  const opensAt = new Date(bounds.start.getTime() - JOIN_WINDOW_BEFORE_MIN * 60_000);
  const closesAt = new Date(bounds.end.getTime() + JOIN_WINDOW_AFTER_MIN * 60_000);
  return now >= opensAt && now <= closesAt;
}

/**
 * Se a sessão ainda não acabou — a decorrer ou totalmente por vir. Usado
 * para escolher "a próxima sessão": comparar só a data (sem hora) fazia uma
 * sessão de hoje já terminada há horas continuar a "contar" como candidata,
 * e como a lista não desempatava por hora dentro do mesmo dia, a "próxima"
 * podia sair como a última do dia em vez da seguinte de facto.
 */
export function isUpcomingOrOngoing(session: BuiltSession, now: Date = new Date()): boolean {
  const bounds = sessionBounds(session);
  if (!bounds) {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    return session.date >= today;
  }
  return bounds.end > now;
}

/** Moeda de quem vê a lista apenas — nunca mostra as duas. undefined ⇒ "a combinar". */
function priceLabel(appt: Appointment, currency: Currency): string | undefined {
  const amount = currency === Currency.BRL ? appt.priceBRL : appt.price;
  return amount != null ? formatPrice(amount, currency) : undefined;
}

function paymentLabel(appt: Appointment, paymentsEnabled: boolean): string {
  if (!paymentsEnabled) {
    return 'Combinado com a profissional';
  }
  // Preparado para quando os pagamentos entrarem — hoje inatingível.
  switch (appt.status) {
    case 'CONFIRMED':
      return 'Pago';
    case 'PENDING':
    default:
      return 'Combinado com a profissional';
  }
}

function buildCounterparts(appt: Appointment): SessionCounterpart[] {
  if (appt.professionals?.length) {
    return appt.professionals.map(p => ({
      ...p,
      initials: initialsFor(p.name),
    }));
  }
  return [{
    id: appt.professionalId,
    name: appt.professionalName,
    initials: initialsFor(appt.professionalName),
  }];
}

function recurringDates(appt: Appointment, from: Date, limit: Date): Date[] {
  const targetDay = DOW_JS[appt.dayOfWeek];
  if (targetDay === undefined) return [];

  const start = appt.startDate ? new Date(appt.startDate) : new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = appt.endDate ? new Date(appt.endDate) : new Date(limit);
  end.setHours(23, 59, 59, 999);

  const base = from > start ? new Date(from) : new Date(start);
  const diff = (targetDay - base.getDay() + 7) % 7;
  base.setDate(base.getDate() + diff);

  const finalLimit = end < limit ? end : limit;
  return generateOccurrences(appt.recurrenceFrequency, start, base, finalLimit, 10);
}

function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function nextDateKey(dateKey: string): string {
  const d = new Date(dateKey + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return toDateKey(d);
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Recompõe (data, hora de início, hora de fim, dia da semana) de uma
 * ocorrência no fuso de quem a vê, a partir da hora de parede + fuso de
 * quem a combinou. Sem `timeZone` (marcações antigas, de antes desta coluna)
 * não há como converter — fica tal como veio, igual ao comportamento anterior.
 */
function resolveOccurrenceDisplay(
  date: Date,
  startTime: string,
  endTime: string,
  originTimeZone: string | undefined,
  viewerTimeZone: string,
): { date: Date; dow: string; fullDow: string; startTime: string; endTime: string } {
  if (!originTimeZone || !startTime) {
    return {
      date,
      dow: DOW_ABR_BY_JS[date.getDay()],
      fullDow: DOW_FULL_BY_JS[date.getDay()],
      startTime,
      endTime,
    };
  }

  const dateKey = toDateKey(date);
  const startInstant = zonedWallTimeToInstant(dateKey, startTime, originTimeZone);
  if (!startInstant) {
    return {
      date,
      dow: DOW_ABR_BY_JS[date.getDay()],
      fullDow: DOW_FULL_BY_JS[date.getDay()],
      startTime,
      endTime,
    };
  }

  // Uma sessão pode atravessar a meia-noite — mesma regra da durationLabel.
  const endDateKey = endTime && minutesOf(endTime) <= minutesOf(startTime)
    ? nextDateKey(dateKey)
    : dateKey;
  const endInstant = endTime ? zonedWallTimeToInstant(endDateKey, endTime, originTimeZone) : null;

  const startWall = wallTimeInZone(startInstant, viewerTimeZone);
  const displayDate = new Date(startWall.year, startWall.month - 1, startWall.day);

  return {
    date: displayDate,
    dow: DOW_ABR_BY_JS[displayDate.getDay()],
    fullDow: DOW_FULL_BY_JS[displayDate.getDay()],
    startTime: `${pad2(startWall.hour)}:${pad2(startWall.minute)}`,
    endTime: endInstant
      ? (() => {
        const endWall = wallTimeInZone(endInstant, viewerTimeZone);
        return `${pad2(endWall.hour)}:${pad2(endWall.minute)}`;
      })()
      : endTime,
  };
}

function oneTimeDates(appt: Appointment): Date[] {
  if (!appt.startDate) return [];
  const d = new Date(appt.startDate);
  d.setHours(0, 0, 0, 0);
  return [d];
}

/**
 * Expande marcações cruas em linhas por ocorrência (uma série recorrente
 * vira várias linhas), já com os rótulos prontos para o template.
 */
export function buildSessions(
  appointments: Appointment[],
  services: ProfessionalService[],
  options: BuildSessionsOptions,
): BuiltSession[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setMonth(limit.getMonth() + 12);

  const sessions: BuiltSession[] = [];

  for (const appt of appointments) {
    const excluded = new Set(appt.excludedDates ?? []);
    const dates = (appt.isRecurring
      ? recurringDates(appt, today, limit)
      : oneTimeDates(appt)
    ).filter(d => !excluded.has(toDateKey(d)));

    const rawServiceName = services.find(s => s.id === appt.professionalServiceId)?.name ?? '';
    const serviceName = ProfessionalSessionService[rawServiceName as keyof typeof ProfessionalSessionService] ?? rawServiceName;

    // appt.modality comes from the backend as the raw enum name
    // ('LOCAL'/'REMOTE'/'ANY'), not the Portuguese Modality label
    // ('Presencial'/'Remoto') — normalize before comparing. ANY (or
    // anything unresolvable) is a real value on availabilities and must
    // not be guessed as 'Presencial' — render 'A combinar' instead.
    const normalized = normalizeModality(appt.modality);
    const mode: SessionMode =
      normalized === Modality.LOCAL ? 'Presencial'
      : normalized === Modality.REMOTE ? 'Remoto'
      : 'A combinar';

    const professionals = buildCounterparts(appt);
    // Do lado da pessoa cliente "quem" é a(s) profissional(is); do lado da
    // profissional é a própria pessoa cliente da marcação.
    const who = options.perspective === 'PROFESSIONAL'
      ? (appt.clientName || 'Cliente')
      : professionals.length === 1
        ? professionals[0].name
        : `${professionals[0].name} e mais ${professionals.length - 1}`;

    const duration = durationLabel(appt.startTime, appt.endTime);
    const recurrence = appt.isRecurring && appt.recurrenceFrequency
      ? RecurrenceFrequency[appt.recurrenceFrequency]
      : 'Não recorrente';
    const price = priceLabel(appt, options.currency);
    const payment = paymentLabel(appt, options.paymentsEnabled);

    for (const date of dates) {
      const occurrenceKey = toDateKey(date);
      const key = `${appt.id}@${occurrenceKey}`;
      const resolved = resolveOccurrenceDisplay(
        date,
        appt.startTime?.slice(0, 5) ?? '',
        appt.endTime?.slice(0, 5) ?? '',
        appt.timeZone,
        options.viewerTimeZone,
      );

      sessions.push({
        appointmentId: appt.id,
        key,
        professionalId: appt.professionalId,
        professionalServiceId: appt.professionalServiceId,
        availabilityId: appt.availabilityId,
        clientId: appt.clientId,
        date: resolved.date,
        occurrenceKey,
        dow: resolved.dow,
        fullDow: resolved.fullDow,
        day: resolved.date.getDate(),
        month: MONTHS[resolved.date.getMonth()],
        who,
        service: serviceName,
        startTime: resolved.startTime,
        endTime: resolved.endTime,
        mode,
        modality: normalized,
        address: appt.address,
        platform: appt.platform,
        price,
        recurrence,
        isRecurring: !!appt.isRecurring,
        duration,
        payment,
        notes: appt.notes,
        professionals,
      });
    }
  }

  // Por instante real (data + hora), não só por dia — senão sessões do mesmo
  // dia ficavam na ordem em que calharam de entrar na lista, não pela hora.
  return sessions.sort((a, b) =>
    (sessionBounds(a)?.start.getTime() ?? a.date.getTime())
    - (sessionBounds(b)?.start.getTime() ?? b.date.getTime()));
}
