/**
 * Uma oferta da própria pessoa profissional como a API a devolve (valores
 * crus do backend): o serviço da lista, os formatos e a modalidade.
 */
export interface MyService {
  id: number;
  professionalId: number;
  serviceId: number;
  serviceSlug: string;
  /** Chave antiga do serviço (ex.: 'MINDFULNESS') ou o nome, para os novos. */
  name: string;
  /** O nome do serviço na lista. */
  label: string;
  offersIndividual: boolean;
  offersGroup: boolean;
  modality: 'ANY' | 'LOCAL' | 'REMOTE';
  active: boolean;
}
