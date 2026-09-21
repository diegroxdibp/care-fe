import { Appointment } from '../models/appointment.model';
import { ProfessionalService } from '../models/professional-service.model';
import { DayOfWeek } from '../enums/day-of-week.enum';
import { Modality } from '../enums/modality.enum';
import { ProfessionalSessionService } from '../enums/professional-session-service.enum';
import { RecurrenceFrequency } from '../enums/recurrence-frequency.enum';
import { Currency, formatPrice } from '../enums/currency.enum';
import { generateOccurrences } from './recurrence.util';
import { normalizeModality } from './modality-compatibility.util';

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
}

const DOW_ABR: Record<string, string> = {
  SUNDAY: 'Dom',    [DayOfWeek.SUNDAY]: 'Dom',
  MONDAY: 'Seg',    [DayOfWeek.MONDAY]: 'Seg',
  TUESDAY: 'Ter',   [DayOfWeek.TUESDAY]: 'Ter',
  WEDNESDAY: 'Qua', [DayOfWeek.WEDNESDAY]: 'Qua',
  THURSDAY: 'Qui',  [DayOfWeek.THURSDAY]: 'Qui',
  FRIDAY: 'Sex',    [DayOfWeek.FRIDAY]: 'Sex',
  SATURDAY: 'Sáb',  [DayOfWeek.SATURDAY]: 'Sáb',
};

const DOW_FULL: Record<string, string> = {
  SUNDAY: 'Domingo',    [DayOfWeek.SUNDAY]: 'Domingo',
  MONDAY: 'Segunda',    [DayOfWeek.MONDAY]: 'Segunda',
  TUESDAY: 'Terça',     [DayOfWeek.TUESDAY]: 'Terça',
  WEDNESDAY: 'Quarta',  [DayOfWeek.WEDNESDAY]: 'Quarta',
  THURSDAY: 'Quinta',   [DayOfWeek.THURSDAY]: 'Quinta',
  FRIDAY: 'Sexta',      [DayOfWeek.FRIDAY]: 'Sexta',
  SATURDAY: 'Sábado',   [DayOfWeek.SATURDAY]: 'Sábado',
};

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

function sessionBounds(session: BuiltSession): { start: Date; end: Date } | null {
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
      sessions.push({
        appointmentId: appt.id,
        key: `${appt.id}@${toDateKey(date)}`,
        professionalId: appt.professionalId,
        professionalServiceId: appt.professionalServiceId,
        availabilityId: appt.availabilityId,
        clientId: appt.clientId,
        date,
        dow: DOW_ABR[appt.dayOfWeek] ?? '?',
        fullDow: DOW_FULL[appt.dayOfWeek] ?? '?',
        day: date.getDate(),
        month: MONTHS[date.getMonth()],
        who,
        service: serviceName,
        startTime: appt.startTime?.slice(0, 5) ?? '',
        endTime: appt.endTime?.slice(0, 5) ?? '',
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

  return sessions.sort((a, b) => a.date.getTime() - b.date.getTime());
}
