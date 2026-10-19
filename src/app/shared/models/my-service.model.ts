/**
 * Um serviço como a API o devolve (valores crus do backend, não os rótulos
 * de ProfessionalService): nome da lista da Care, formato e modalidade.
 */
export interface MyService {
  id: number;
  professionalId: number;
  /** Chave de ProfessionalSessionService, ex.: 'MINDFULNESS'. */
  name: string;
  format: 'INDIVIDUAL' | 'GROUP';
  modality: 'ANY' | 'LOCAL' | 'REMOTE';
  active: boolean;
}
