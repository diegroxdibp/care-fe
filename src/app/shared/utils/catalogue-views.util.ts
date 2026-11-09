import {
  Audience,
  CareService,
  CatalogueOptions,
  FormatKey,
  ModalityKey,
  ProfessionalCard,
  ProfessionalPage,
  ProfessionalProfile,
  ServiceContent,
} from '../models/catalogue.model';
import { formatsOf, modalitiesOf, serviceMeta } from './catalogue.util';
import { firstParagraph, parseRichText, RichBlock, RichInline } from './rich-text.util';

/**
 * O que as páginas de serviço e de perfil mostram, separado de onde vem: da
 * API (página publicada) ou de um formulário por gravar (pré-visualização).
 */

export interface SpecialtyView {
  name: string;
  description: string | null;
  audiences: string[];
}

export interface ServiceView {
  slug: string | null;
  name: string;
  /** O resumo da lista da home. A página publicada não o mostra; a pré-visualização sim. */
  summary: string | null;
  intro: RichBlock[];
  howItWorks: RichBlock[];
  quote: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  modalities: ModalityKey[];
  formats: FormatKey[];
  audiences: string[];
  forWhom: string[];
  specialties: SpecialtyView[];
  privateOnly: boolean;
}

export interface ServiceSummaryView {
  slug: string | null;
  name: string;
  firstParagraph: RichInline[];
  imageUrl: string | null;
  imageAlt: string | null;
  meta: string;
}

export interface ProfessionalView {
  slug: string | null;
  displayName: string;
  title: string | null;
  photoUrl: string | null;
  whoAmI: RichBlock[];
  quote: string | null;
  education: string[];
  experience: string[];
  howIWork: RichBlock[];
  languages: string[];
  modalities: ModalityKey[];
  formats: FormatKey[];
  audiences: string[];
  areas: string | null;
  otherInfo: string | null;
  services: ServiceSummaryView[];
}

/**
 * withPending: numa proposta em análise, os públicos ainda por aprovar
 * aparecem também, marcados "(em aprovação)". Nas páginas publicadas nunca.
 */
export function serviceViewFrom(s: CareService, withPending = false): ServiceView {
  const names = (list: Audience[]) =>
    list
      .filter(a => withPending || !a.pending)
      .map(a => (a.pending ? `${a.name} (em aprovação)` : a.name));
  return {
    slug: s.slug,
    name: s.name,
    summary: s.summary,
    intro: parseRichText(s.intro),
    howItWorks: parseRichText(s.howItWorks),
    quote: s.quote,
    imageUrl: s.imageUrl,
    imageAlt: s.imageAlt,
    modalities: modalitiesOf(s),
    formats: formatsOf(s),
    audiences: names(s.audiences),
    forWhom: s.forWhom,
    specialties: s.specialties.map(sp => ({
      name: sp.name,
      description: sp.description,
      audiences: names(sp.audiences),
    })),
    privateOnly: !s.allowsPublic,
  };
}

function audienceNames(ids: number[], proposed: string[], all: Audience[]): string[] {
  const byId = new Map(all.map(a => [a.id, a.name]));
  return [
    ...ids.map(id => byId.get(id)).filter((n): n is string => !!n),
    ...proposed.map(p => p.trim()).filter(Boolean),
  ];
}

/**
 * Um serviço ainda no formulário, como ficaria publicado. Os públicos
 * propostos aparecem pelo nome (na pré-visualização ainda não estão aprovados).
 * known = públicos que o formulário conhece além das opções (os do serviço em alteração).
 */
export function serviceViewFromContent(c: ServiceContent, options: CatalogueOptions | null, known: Audience[] = []): ServiceView {
  const all = [...(options?.audiences ?? []), ...known];
  return {
    slug: null,
    name: c.name.trim() || 'Nome do serviço',
    summary: c.summary.trim() || null,
    intro: parseRichText(c.intro),
    howItWorks: parseRichText(c.howItWorks),
    quote: c.quote?.trim() || null,
    imageUrl: c.imageUrl,
    imageAlt: c.imageAlt,
    modalities: modalitiesOf(c),
    formats: formatsOf(c),
    audiences: audienceNames(c.audienceIds, c.proposedAudiences, all),
    forWhom: c.forWhom.map(f => f.trim()).filter(Boolean),
    specialties: c.specialties
      .filter(s => s.name.trim() || (s.description ?? '').trim())
      .map(s => ({
        name: s.name.trim() || 'Especialidade',
        description: s.description?.trim() || null,
        audiences: audienceNames(s.audienceIds, s.proposedAudiences, all),
      })),
    privateOnly: !c.allowsPublic && c.allowsPrivate,
  };
}

export function summaryOf(s: CareService): ServiceSummaryView {
  return {
    slug: s.slug,
    name: s.name,
    firstParagraph: firstParagraph(s.intro),
    imageUrl: s.imageUrl,
    imageAlt: s.imageAlt,
    meta: serviceMeta(s),
  };
}

export function professionalViewFromPage(p: ProfessionalPage): ProfessionalView {
  return {
    slug: p.slug,
    displayName: p.displayName,
    title: p.title,
    photoUrl: p.photoUrl,
    whoAmI: parseRichText(p.whoAmI),
    quote: p.quote,
    education: p.education,
    experience: p.experience,
    howIWork: parseRichText(p.howIWork),
    languages: p.languages.map(l => l.name),
    modalities: p.modalities,
    formats: p.formats,
    audiences: p.audiences.map(a => a.name),
    areas: p.areas,
    otherInfo: p.otherInfo,
    services: p.services.map(summaryOf),
  };
}

/**
 * Um perfil ainda no formulário. Modalidades, formatos e públicos vêm dos
 * serviços escolhidos (como no perfil publicado, que os deriva das ofertas).
 */
export function professionalViewFromForm(
  p: ProfessionalProfile,
  services: CareService[],
  options: CatalogueOptions | null,
): ProfessionalView {
  const langs = new Map((options?.languages ?? []).map(l => [l.code, l.name]));
  const modalities = new Set<ModalityKey>();
  const formats = new Set<FormatKey>();
  const audiences = new Set<string>();
  for (const s of services) {
    modalitiesOf(s).forEach(m => modalities.add(m));
    formatsOf(s).forEach(f => formats.add(f));
    s.audiences.filter(a => !a.pending).forEach(a => audiences.add(a.name));
  }
  return {
    slug: p.slug,
    displayName: p.displayName.trim() || 'Nome',
    title: p.title?.trim() || null,
    photoUrl: p.photoUrl,
    whoAmI: parseRichText(p.whoAmI),
    quote: p.quote?.trim() || null,
    education: p.education.map(e => e.trim()).filter(Boolean),
    experience: p.experience.map(e => e.trim()).filter(Boolean),
    howIWork: parseRichText(p.howIWork),
    languages: p.languages.map(c => langs.get(c) ?? c),
    modalities: (['LOCAL', 'REMOTE'] as ModalityKey[]).filter(m => modalities.has(m)),
    formats: (['INDIVIDUAL', 'GROUP'] as FormatKey[]).filter(f => formats.has(f)),
    audiences: [...audiences],
    areas: p.areas?.trim() || null,
    otherInfo: p.otherInfo?.trim() || null,
    services: services.filter(s => s.allowsPublic).map(summaryOf),
  };
}

/** O cartão de uma pessoa profissional numa página de serviço. */
export interface ProfessionalCardView {
  key: string;
  slug: string | null;
  displayName: string;
  title: string | null;
  photoUrl: string | null;
  firstWhoAmI: RichInline[];
  firstHowIWork: RichInline[];
  languages: string[];
  modalities: ModalityKey[];
  formats: FormatKey[];
  audiences: string[];
}

export function cardViewFrom(c: ProfessionalCard): ProfessionalCardView {
  return {
    key: String(c.userId),
    slug: c.slug,
    displayName: c.displayName,
    title: c.title,
    photoUrl: c.photoUrl,
    firstWhoAmI: firstParagraph(c.whoAmI),
    firstHowIWork: firstParagraph(c.howIWork),
    languages: c.languages.map(l => l.name),
    modalities: c.modalities,
    formats: c.formats,
    audiences: c.audiences.map(a => a.name),
  };
}

export function cardViewFromProfessional(p: ProfessionalView): ProfessionalCardView {
  return {
    key: 'preview',
    slug: p.slug,
    displayName: p.displayName,
    title: p.title,
    photoUrl: p.photoUrl,
    firstWhoAmI: firstOf(p.whoAmI),
    firstHowIWork: firstOf(p.howIWork),
    languages: p.languages,
    modalities: p.modalities,
    formats: p.formats,
    audiences: p.audiences,
  };
}

/** O primeiro parágrafo de um texto já lido (sem subtítulos nem listas). */
function firstOf(blocks: RichBlock[]): RichInline[] {
  const p = blocks.find(b => b.type === 'paragraph');
  return p && p.type === 'paragraph' ? p.content : [];
}
