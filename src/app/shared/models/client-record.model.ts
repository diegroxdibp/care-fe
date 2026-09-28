/** Prontuário partilhado da pessoa cliente — ver ClientRecordService no backend. */

export type ClientRecordNoteVisibility = 'SHARED' | 'PRIVATE';

export interface ClientRecordAuthor {
  id: number;
  name: string;
  picture?: string | null;
}

export interface ClientRecordNote {
  id: number;
  author: ClientRecordAuthor;
  visibility: ClientRecordNoteVisibility;
  body: string;
  /** Instante ISO em UTC — mostrar sempre com o pipe userTime. */
  createdAt: string;
  /** Só a pessoa autora pode acrescentar adendas. */
  mine: boolean;
  /** Por ordem cronológica; sempre vazio nas próprias adendas. */
  addenda: ClientRecordNote[];
}

/** Motivo da consulta e historial clínico registados por uma pessoa profissional. */
export interface ClientRecordIntake {
  professional: ClientRecordAuthor;
  reason?: string | null;
  reasonFilledAt?: string | null;
  clinicalHistory?: string | null;
  clinicalHistoryFilledAt?: string | null;
}

export interface ClientRecordClientInfo {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  /** yyyy-MM-dd — data sem fuso, não passar pelo userTime. */
  birthDate?: string | null;
  gender?: string | null;
  picture?: string | null;
  timeZone?: string | null;
}

export interface ClientRecord {
  client: ClientRecordClientInfo;
  intakes: ClientRecordIntake[];
  /** O que quem está a ver ainda não preencheu — pedido na próxima nota. */
  pendingIntake: { reason: boolean; clinicalHistory: boolean };
  notes: ClientRecordNote[];
}

export interface ClientRecordSummary {
  id: number;
  name: string;
  email: string;
  picture?: string | null;
}

export interface CreateClientRecordNotePayload {
  body: string;
  visibility: ClientRecordNoteVisibility;
  reason?: string;
  clinicalHistory?: string;
}
