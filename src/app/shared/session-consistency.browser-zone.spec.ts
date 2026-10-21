import { ProfessionalService } from './models/professional-service.model';
import { ProfessionalServiceModality } from './enums/professional-service-modality.enum';
import { describeSessionConsistency } from './session-consistency.cases';

/**
 * A mesma verificação de session-consistency.spec.ts, com o próprio processo em
 * São Paulo, como o browser de uma pessoa no Brasil. Na suite normal (UTC/Lisboa)
 * um erro que use o fuso do computador em vez do do perfil passa despercebido.
 *
 * Corre com `npm run test:browser-zone`; na suite normal os testes correm uma
 * vez só, pelo próprio session-consistency.spec.ts.
 */
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

const runningInSaoPaulo = new Date('2027-07-15T12:00:00Z').getTimezoneOffset() === 180;

if (runningInSaoPaulo) {
  describeSessionConsistency(SERVICE);
} else {
  it.skip('só corre com o processo em São Paulo (npm run test:browser-zone)', () => undefined);
}
