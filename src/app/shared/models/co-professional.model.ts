import { Appointment } from './appointment.model';
import { AvailabilityModel } from './availability.model';

/** Outra pessoa profissional da Care — só nome e foto, nunca contactos. */
export interface ProfessionalSummary {
  id: number;
  name: string;
  picture?: string | null;
  bio?: string | null;
}

export type RequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN' | 'EXPIRED';

/** O pedido a outra pessoa profissional para tomar parte em sessões. Ver GLOSSARY.md. */
export interface CoProfessionalRequest {
  id: number;
  fromProfessionalId: number;
  fromProfessionalName: string;
  toProfessionalId: number;
  toProfessionalName: string;
  availabilityId?: number | null;
  appointmentId?: number | null;
  /** Numa marcação, de quem é a sessão. */
  clientName?: string | null;
  fromDate: string;
  untilDate?: string | null;
  message?: string | null;
  status: RequestStatus;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  timeZone: string;
  isRecurring: boolean;
  recurrenceFrequency?: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | null;
  format?: 'INDIVIDUAL' | 'GROUP';
  /** Início na primeira data do pedido, já resolvido no fuso da vaga. */
  fromAt: string;
}

export interface CoProfessionalRequestPayload {
  professionalId: number;
  availabilityId?: number;
  appointmentId?: number;
  fromDate?: string;
  /** Igual a fromDate para uma só data. */
  untilDate?: string;
  message?: string;
}

/** Onde tomo parte sem ser dona: a vaga e as sessões que lá há. */
export interface Commitment {
  coProfessionalId: number;
  ownerId: number;
  ownerName: string;
  availabilityId?: number | null;
  appointmentId?: number | null;
  fromDate: string;
  untilDate?: string | null;
  slot: AvailabilityModel;
  sessions: Appointment[];
}

export interface OwnershipTransfer {
  id: number;
  availabilityId: number;
  fromProfessionalId: number;
  fromProfessionalName: string;
  toProfessionalId: number;
  toProfessionalName: string;
  oldOwnerStays: boolean;
  status: RequestStatus;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  timeZone: string;
  isRecurring: boolean;
  recurrenceFrequency?: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | null;
  format?: 'INDIVIDUAL' | 'GROUP';
  createdAt: string;
}
