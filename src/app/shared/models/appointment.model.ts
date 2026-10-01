import { DayOfWeek } from '../enums/day-of-week.enum';
import { Modality } from '../enums/modality.enum';

export interface Appointment {
  id: number;
  professionalId: number;
  professionalName: string;
  clientId: number;
  availabilityId: number;
  professionalServiceId: number;
  modality: Modality;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  dayOfWeek: DayOfWeek;
  recurrenceFrequency?: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  /**
   * Fuso IANA em que startTime/endTime foram combinados, congelado na
   * marcação. Sem ele a hora de parede não é convertível para quem a vê —
   * ver session-list.util.ts.
   */
  timeZone?: string;
  clientName?: string;
  clientEmail?: string;
  price?: number;
  priceBRL?: number;
  status: 'PENDING' | 'CONFIRMED';
  address?: string;
  notes?: string;
  /**
   * Ocorrências desta série canceladas à parte (yyyy-MM-dd). Quem expande a
   * recorrência tem de as saltar.
   */
  excludedDates?: string[];
  /** Hoje sempre um elemento — a única pessoa profissional da marcação. */
  professionals?: { id: number; name: string; role?: string }[];
  /**
   * Série que esta substitui a partir do seu startDate. PENDING + preenchido
   * é uma alteração de série por responder — ainda não é uma sessão, e por isso
   * não entra nas listas de sessões (ver series-change.util.ts).
   */
  replacesAppointmentId?: number | null;
}
