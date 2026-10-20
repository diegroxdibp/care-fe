import { ProfessionalServiceModality } from '../enums/professional-service-modality.enum';

/**
 * Uma oferta (a versão de uma pessoa profissional de um serviço da lista),
 * na forma curta que vagas, marcações e o Agendar usam — care-be
 * ProfessionalServiceDTO. name = chave antiga do serviço (ex.: 'MINDFULNESS')
 * ou o nome, para os novos; label = o nome do serviço na lista.
 */
export interface ProfessionalService {
  id: number;
  professionalId?: number;
  serviceId: number;
  serviceSlug: string;
  name: string;
  label: string;
  offersIndividual: boolean;
  offersGroup: boolean;
  /** O serviço permite vagas públicas / privadas (um serviço privado só em vagas privadas). */
  serviceAllowsPublic?: boolean;
  serviceAllowsPrivate?: boolean;
  modality: ProfessionalServiceModality;
  price: string;
  active: boolean;
}

export const emptyProfessionalService: ProfessionalService = {
  id: 0,
  serviceId: 0,
  serviceSlug: '',
  name: '',
  label: '',
  offersIndividual: true,
  offersGroup: false,
  modality: ProfessionalServiceModality.LOCAL,
  price: '',
  active: false,
};

/** A oferta inclui este formato? */
export function offersFormat(s: { offersIndividual?: boolean; offersGroup?: boolean }, format: 'INDIVIDUAL' | 'GROUP'): boolean {
  return format === 'GROUP' ? !!s.offersGroup : !!s.offersIndividual;
}
