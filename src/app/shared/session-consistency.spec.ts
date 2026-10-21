import { ProfessionalService } from './models/professional-service.model';
import { ProfessionalServiceModality } from './enums/professional-service-modality.enum';
import { describeSessionConsistency } from './session-consistency.cases';

/** Ver session-consistency.cases.ts: a mesma sessão, o mesmo instante, em todos os ecrãs. */
const SERVICE: ProfessionalService = {
  id: 1,
  serviceId: 1,
  serviceSlug: 'reichian-body-analysis',
  name: 'REICHIAN_BODY_ANALYSIS',
  label: 'Análise Corporal Reichiana',
  offersIndividual: true,
  offersGroup: false,
  modality: ProfessionalServiceModality.LOCAL,
  price: '60',
  active: true,
};

describeSessionConsistency(SERVICE);
