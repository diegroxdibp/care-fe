/**
 * Um convite de uma pessoa profissional a uma pessoa cliente — um lugar numa
 * data, ou uma série a partir de uma data, numa das suas vagas. Vai para um
 * email, que pode ainda não ter conta. Ver GLOSSARY.md (Invitation).
 */
export type InvitationKind = 'DATE' | 'SERIES';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN' | 'EXPIRED';
export type SlotVisibility = 'PUBLIC' | 'PRIVATE';

export interface Invitation {
  id: number;
  token: string;
  availabilityId: number;
  professionalId: number;
  professionalName: string;
  clientId?: number | null;
  clientName?: string | null;
  invitedEmail: string;
  kind: InvitationKind;
  /** yyyy-MM-dd, no fuso da vaga — a data oferecida ou a primeira da série. */
  startDate: string;
  recurrenceFrequency?: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | null;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  timeZone: string;
  /** Instante ISO da (primeira) sessão — já resolvido no fuso da vaga. */
  firstSessionAt: string;
  professionalServiceId: number;
  serviceName: string;
  modality: string;
  address?: string | null;
  price?: number | null;
  priceBRL?: number | null;
  message?: string | null;
  status: InvitationStatus;
  createdAt: string;
  appointmentId?: number | null;
}

/** O que a página do convite mostra antes de entrar — sem a mensagem nem os valores. */
export interface InvitationPreview {
  token: string;
  professionalName: string;
  serviceName: string;
  kind: InvitationKind;
  startDate: string;
  recurrenceFrequency?: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | null;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  timeZone: string;
  firstSessionAt: string;
  modality: string;
  status: InvitationStatus;
  invitedEmail: string;
  accountExists: boolean;
}

export interface InvitationPayload {
  availabilityId: number;
  /** Alguém da lista de pacientes… */
  clientId?: number;
  /** …ou qualquer email, com ou sem conta Care. */
  email?: string;
  kind: InvitationKind;
  startDate: string;
  recurrenceFrequency?: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  professionalServiceId: number;
  modality: string;
  address?: string;
  price?: number;
  priceBRL?: number;
  message?: string;
}
