import { DayOfWeek } from '../enums/day-of-week.enum';
import {
  emptyProfessionalService,
  ProfessionalService,
} from './professional-service.model';
export interface AvailabilityModel {
  id: number;
  professionalId: number;
  professionalName: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  dayOfWeek: DayOfWeek;
  recurrenceFrequency?: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  /**
   * Datas (yyyy-MM-dd) em que esta vaga já está ocupada.
   *
   * Substitui o antigo isBooked: uma vaga semanal pode estar ocupada numa
   * semana e livre na seguinte, e um booleano por série escondia-a em todas.
   */
  bookedDates: string[];
  modality: string;
  platform?: string;
  /** Morada em texto livre para sessões presenciais. */
  address?: string;
  /**
   * Fuso IANA em que startTime/endTime foram escritos pela pessoa profissional.
   * Sem ele a hora de parede não é convertível.
   */
  timeZone?: string;
  price?: number;
  priceBRL?: number;
  services: ProfessionalService[];
}

export const emptyAvailability: AvailabilityModel = {
  id: 1,
  professionalId: 1,
  professionalName: 'Terapeuta da Silva',
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
  isRecurring: false,
  dayOfWeek: DayOfWeek.MONDAY,
  bookedDates: [],
  modality: 'ANY',
  services: [emptyProfessionalService],
};
