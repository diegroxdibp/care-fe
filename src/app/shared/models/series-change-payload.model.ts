/**
 * Alteração de uma série recorrente a partir de `effectiveFrom`. Descreve a
 * série como fica — não só o que muda. As sessões antes dessa data não são
 * tocadas; ver AppointmentService.proposeSeriesChange no backend.
 */
export interface SeriesChangePayload {
  availabilityId: number;
  professionalServiceId: number;
  modality: string;
  recurrenceFrequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  address?: string;
  price?: number;
  priceBRL?: number;
  /** yyyy-MM-dd, no fuso da vaga — a primeira sessão do novo horário. */
  effectiveFrom: string;
}
