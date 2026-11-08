import { emptyServiceContent } from '../models/catalogue.model';
import { ReviewPoint } from '../models/review.model';
import { approvedSections, keepSections, SERVICE_SECTION_FIELDS } from './review-locks.util';

function point(itemKey: string, section: string, status: ReviewPoint['status']): ReviewPoint {
  return {
    key: `${itemKey}:${section}`,
    itemKey,
    section,
    label: section,
    status,
    comments: [],
    publishedStatus: status,
    changes: [],
  };
}

describe('review-locks — partes aprovadas bloqueadas ao rever', () => {
  it('lista só as partes aprovadas do item pedido', () => {
    const points = [
      point('pro', 'quem-sou', 'APPROVED'),
      point('pro', 'formacao', 'PENDING'),
      point('svc:7', 'apresentacao', 'APPROVED'),
    ];
    expect(approvedSections(points, 'pro')).toEqual(['quem-sou']);
    expect(approvedSections(points, 'svc:7')).toEqual(['apresentacao']);
    expect(approvedSections(points, 'svc:8')).toEqual([]);
  });

  it('repõe o que foi enviado nas partes bloqueadas e deixa o resto', () => {
    const sent = { ...emptyServiceContent(), name: 'Terapia de Casal', intro: 'Enviado.', forWhom: ['Conflitos'] };
    const typed = { ...sent, name: 'Mudado', intro: 'Mudado.', forWhom: ['Novo'] };

    const kept = keepSections(typed, sent, ['apresentacao'], SERVICE_SECTION_FIELDS);

    expect(kept.name).toBe('Terapia de Casal');
    expect(kept.intro).toBe('Enviado.');
    expect(kept.forWhom).toEqual(['Novo']);
  });
});
