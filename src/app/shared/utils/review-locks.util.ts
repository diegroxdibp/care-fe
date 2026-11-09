import { ProfessionalProfile, ServiceContent } from '../models/catalogue.model';
import { ReviewPoint } from '../models/review.model';

/**
 * Ao rever um pedido devolvido, as partes que a equipe já aprovou ficam
 * bloqueadas: só as pendentes mudam (o backend confirma, ver RevisionGuard em
 * care-be). As partes são as da análise; aqui, os campos de cada uma.
 */
export const PROFILE_SECTION_FIELDS: Record<string, (keyof ProfessionalProfile)[]> = {
  'quem-sou': ['displayName', 'title', 'photoUrl', 'whoAmI', 'quote'],
  formacao: ['education', 'experience'],
  'como-trabalho': ['howIWork'],
  'outras-info': ['languages', 'areas', 'otherInfo'],
};

export const SERVICE_SECTION_FIELDS: Record<string, (keyof ServiceContent)[]> = {
  apresentacao: ['name', 'summary', 'intro', 'howItWorks', 'quote', 'imageUrl', 'imageAlt'],
  caracteristicas: [
    'allowsIndividual',
    'allowsGroup',
    'allowsInPerson',
    'allowsRemote',
    'allowsPublic',
    'allowsPrivate',
    'audienceIds',
    'proposedAudiences',
  ],
  'para-quem': ['forWhom'],
  especialidades: ['specialties'],
};

/** As partes aprovadas de um item ("pro", "svc:12", "chg:3"), pelo status que a pessoa vê. */
export function approvedSections(points: ReviewPoint[], itemKey: string): string[] {
  return points.filter(p => p.itemKey === itemKey && p.status === 'APPROVED').map(p => p.section);
}

/** target com os campos das partes bloqueadas tirados de source (o que foi enviado). */
export function keepSections<T extends object>(
  target: T,
  source: T,
  sections: string[],
  fields: Record<string, (keyof T)[]>,
): T {
  const out = { ...target };
  for (const s of sections) {
    for (const f of fields[s] ?? []) out[f] = source[f];
  }
  return out;
}
