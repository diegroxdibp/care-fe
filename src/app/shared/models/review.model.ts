/**
 * A análise de um pedido parte a parte — espelha os DTOs de care-be
 * (ReviewDTO e companhia, ver ReviewService). Plano em
 * docs/plans/application-review.md.
 */
import { CareService, Person, ProfessionalProfile, ReviewStatus } from './catalogue.model';

/** Uma candidatura (com as propostas que trouxe) ou uma proposta de serviço avulsa. */
export type ReviewKind = 'APPLICATION' | 'PROPOSAL';

export type ReviewStage =
  | 'ANALYSIS'
  | 'CHANGES'
  | 'INTERVIEW_TO_BOOK'
  | 'INTERVIEW_BOOKED'
  | 'PUBLISHED'
  | 'REJECTED';

export type RequestDecision = 'CONCLUDED' | 'CHANGES';

export interface ReviewComment {
  fromTeam: boolean;
  /** "Equipe CARE" ou o nome de quem fez o pedido. */
  author: string;
  text: string;
  at: string;
}

/**
 * Uma parte do pedido em revisão. itemKey = "pro" ou "svc:{id}"; nulo nos
 * comentários gerais (key "geral"), que também não têm estado.
 */
export interface ReviewPoint {
  key: string;
  itemKey: string | null;
  section: string;
  label: string;
  status: ReviewStatus | null;
  comments: ReviewComment[];
}

/** O perfil ("pro") ou uma proposta ("svc:{id}"), cada um com a sua decisão. */
export interface ReviewItem {
  key: string;
  serviceId: number | null;
  name: string;
  /** Só para a equipa: o endereço com que vai ser publicado. */
  slug: string | null;
  /** A pessoa só a vê depois de concluída a análise. */
  decision: ReviewStatus | null;
}

export interface ReviewAudience {
  id: number;
  name: string;
  where: string[];
  serviceIds: number[];
  decision: ReviewStatus | null;
}

/** A entrevista marcada, na hora de parede de quem a faz (timeZone). */
export interface Interview {
  appointmentId: number;
  availabilityId: number | null;
  date: string;
  startTime: string;
  endTime: string;
  timeZone: string | null;
  host: string;
  modality: 'LOCAL' | 'REMOTE' | 'ANY';
  done: boolean;
}

export interface Review {
  kind: ReviewKind;
  id: number;
  stage: ReviewStage;
  decision: RequestDecision | null;
  submittedAt: string | null;
  decidedAt: string | null;
  person: Person | null;
  profile: ProfessionalProfile | null;
  /** Os serviços da lista que a pessoa diz que já realiza (candidatura). */
  services: CareService[];
  proposals: CareService[];
  points: ReviewPoint[];
  items: ReviewItem[];
  /** Só para a equipa. */
  audiences: ReviewAudience[];
  interview: Interview | null;
}

export interface ReviewSummary {
  kind: ReviewKind;
  id: number;
  title: string;
  proposedBy: string | null;
  proposals: number;
  submittedAt: string | null;
  stage: ReviewStage;
  points: number;
  approved: number;
  denied: number;
}

export interface ReviewUpdate {
  status?: ReviewStatus | null;
  name?: string | null;
  slug?: string | null;
}

export interface InterviewBooking {
  availabilityId: number;
  date: string;
  startTime: string;
  endTime: string;
  modality: 'LOCAL' | 'REMOTE';
}

/** Como aparece cada etapa: rótulo e a classe de cor (rv-tone-*). */
export const STAGE: Record<ReviewStage, { label: string; tone: string }> = {
  ANALYSIS: { label: 'Em análise', tone: 'blue' },
  CHANGES: { label: 'Alterações pedidas', tone: 'lilac' },
  INTERVIEW_TO_BOOK: { label: 'Entrevista a agendar', tone: 'indigo' },
  INTERVIEW_BOOKED: { label: 'Entrevista agendada', tone: 'indigo' },
  PUBLISHED: { label: 'Publicado', tone: 'green' },
  REJECTED: { label: 'Recusado', tone: 'red' },
};

/** O estado de um ponto. */
export const POINT_STATUS: Record<ReviewStatus, { label: string; tone: string }> = {
  PENDING: { label: 'Pendente', tone: 'muted' },
  APPROVED: { label: 'Aprovado', tone: 'green' },
  REJECTED: { label: 'Negado', tone: 'red' },
};

/** A decisão sobre um item. */
export const ITEM_DECISION: Partial<Record<ReviewStatus, { label: string; tone: string }>> = {
  APPROVED: { label: 'Aprovado', tone: 'green' },
  REJECTED: { label: 'Recusado', tone: 'red' },
};

/** O segmento do endereço: /admin/pedidos/candidatura/12, /meus-pedidos/proposta/40. */
export function kindPath(kind: ReviewKind): 'candidatura' | 'proposta' {
  return kind === 'APPLICATION' ? 'candidatura' : 'proposta';
}

export function kindFromPath(path: string | null): ReviewKind | null {
  return path === 'candidatura' ? 'APPLICATION' : path === 'proposta' ? 'PROPOSAL' : null;
}

/** "2 propostas de serviço", "1 ponto aprovado"… */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
