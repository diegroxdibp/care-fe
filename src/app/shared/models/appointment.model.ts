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
  clientName?: string;
  clientEmail?: string;
  platform?: string;
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
}
