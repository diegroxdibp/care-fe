/**
 * Um pedido de reagendamento à espera de resposta.
 *
 * Quando é a pessoa profissional a querer mudar uma sessão de dia, a sessão não
 * se mexe: fica confirmada onde está e o destino proposto vive aqui até haver
 * resposta. Só a aceitação a move.
 */
export interface RescheduleRequest {
  id: number;
  appointmentId: number;
  professionalId: number;
  professionalName: string;
  clientId: number;
  clientName: string;
  professionalServiceId: number;
  /** Onde a sessão está hoje. */
  occurrenceDate: string;
  currentStartTime: string;
  currentEndTime: string;
  /** Numa série, só esta ocorrência muda. */
  appointmentIsRecurring: boolean;
  proposedAvailabilityId: number;
  proposedDate: string;
  proposedStartTime: string;
  proposedEndTime: string;
  proposedModality: string;
  reason: string;
  requestedById: number;
  requestedByName: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
  createdAt: string;
  respondedAt?: string | null;
}
