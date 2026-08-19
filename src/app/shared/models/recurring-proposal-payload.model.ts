export interface RecurringProposalPayload {
  availabilityId: number;
  professionalServiceId: number;
  clientId: number;
  modality: string;

  /*
   * Termos combinados só para esta proposta. Omitidos, valem os da vaga — a
   * vaga em si nunca é alterada por uma proposta, continua anunciada como está
   * para as outras pessoas.
   */

  /** Pode ser mais espaçada do que a da vaga (semanal → quinzenal), nunca o contrário. */
  recurrenceFrequency?: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  platform?: string;
  address?: string;
  price?: number;
  priceBRL?: number;
  /** yyyy-MM-dd. Omitida, o backend usa a próxima ocorrência livre da vaga. */
  startDate?: string;
}
