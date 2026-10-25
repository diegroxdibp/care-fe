export interface ReschedulePayload {
  /** Vaga de destino. */
  availabilityId: number;
  professionalServiceId: number;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  modality: string;
  /**
   * Ocorrência a mover.
   *
   * Numa sessão recorrente é esta data que fica livre — a série mantém-se e só
   * este dia passa a ter uma exceção. Numa sessão de data única não há série a
   * preservar e a marcação muda por inteiro.
   */
  occurrenceDate: string;
  /**
   * Motivo do pedido, escrito pela pessoa profissional.
   *
   * Só é lido no caminho do pedido (requestReschedule); a mudança imediata
   * ignora-o.
   */
  reason?: string;
  /**
   * Só no pedido: liberar já o horário atual em vez de o manter reservado até
   * haver resposta. Liberado, se a mudança não acontecer a sessão é cancelada.
   */
  releaseOriginal?: boolean;
}
