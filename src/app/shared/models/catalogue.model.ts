/**
 * A lista partilhada de serviços, ofertas, perfis profissionais e pedidos —
 * espelha os DTOs de care-be (dto/catalogue). Termos em GLOSSARY.md.
 */

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ProfileStatus = 'DRAFT' | 'PUBLISHED' | 'HIDDEN';
export type FormatKey = 'INDIVIDUAL' | 'GROUP';
export type ModalityKey = 'LOCAL' | 'REMOTE';
export type OfferingModality = 'ANY' | 'LOCAL' | 'REMOTE';

/** Um público. pending = ainda em aprovação. */
export interface Audience {
  id: number;
  name: string;
  pending: boolean;
}

export interface Language {
  code: string;
  name: string;
}

export interface CatalogueOptions {
  audiences: Audience[];
  languages: Language[];
}

export interface Specialty {
  id: number;
  name: string;
  description: string | null;
  audiences: Audience[];
}

export interface Person {
  id: number;
  name: string;
  email: string;
}

/** Um serviço da lista partilhada. */
export interface CareService {
  id: number;
  slug: string;
  name: string;
  status: ReviewStatus;
  allowsIndividual: boolean;
  allowsGroup: boolean;
  allowsInPerson: boolean;
  allowsRemote: boolean;
  allowsPublic: boolean;
  allowsPrivate: boolean;
  intro: string;
  quote: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  forWhom: string[];
  audiences: Audience[];
  specialties: Specialty[];
  createdAt: string | null;
  proposedBy: Person | null;
  reviewNote: string | null;
}

export interface SpecialtyContent {
  id: number | null;
  name: string;
  description: string | null;
  audienceIds: number[];
  proposedAudiences: string[];
}

/** Um serviço como sai de um formulário (proposta, alteração, edição da equipa). */
export interface ServiceContent {
  name: string;
  allowsIndividual: boolean;
  allowsGroup: boolean;
  allowsInPerson: boolean;
  allowsRemote: boolean;
  allowsPublic: boolean;
  allowsPrivate: boolean;
  intro: string;
  quote: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  forWhom: string[];
  audienceIds: number[];
  proposedAudiences: string[];
  specialties: SpecialtyContent[];
}

export interface ProfessionalCard {
  userId: number;
  slug: string | null;
  displayName: string;
  title: string | null;
  photoUrl: string | null;
  whoAmI: string | null;
  howIWork: string | null;
  languages: Language[];
  modalities: ModalityKey[];
  formats: FormatKey[];
  audiences: Audience[];
  offeringId: number | null;
}

export interface ServicePage {
  service: CareService;
  professionals: ProfessionalCard[];
}

/** O perfil profissional como se edita. */
export interface ProfessionalProfile {
  id: number | null;
  userId: number | null;
  slug: string | null;
  status: ProfileStatus | null;
  updatedAt: string | null;
  displayName: string;
  title: string | null;
  photoUrl: string | null;
  whoAmI: string;
  quote: string | null;
  education: string[];
  experience: string[];
  howIWork: string | null;
  languages: string[];
  areas: string | null;
  otherInfo: string | null;
}

export interface ProfessionalPage {
  userId: number;
  slug: string;
  displayName: string;
  title: string | null;
  photoUrl: string | null;
  whoAmI: string | null;
  quote: string | null;
  education: string[];
  experience: string[];
  howIWork: string | null;
  languages: Language[];
  areas: string | null;
  otherInfo: string | null;
  modalities: ModalityKey[];
  formats: FormatKey[];
  audiences: Audience[];
  services: CareService[];
}

export interface Offering {
  id: number;
  service: CareService;
  offersIndividual: boolean;
  offersGroup: boolean;
  modality: OfferingModality;
  specialtyIds: number[];
  active: boolean;
}

export interface OfferingRequest {
  offersIndividual: boolean;
  offersGroup: boolean;
  modality: OfferingModality;
  specialtyIds: number[];
  active: boolean;
}

export interface Application {
  id: number;
  status: ReviewStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  applicant: Person;
  profile: ProfessionalProfile | null;
  services: CareService[];
  proposals: CareService[];
}

export interface ApplicationRequest {
  profile: ProfessionalProfile;
  serviceIds: number[];
  proposals: ServiceContent[];
}

export interface ChangeProposal {
  id: number;
  status: ReviewStatus;
  createdAt: string;
  reviewNote: string | null;
  proposedBy: Person;
  current: CareService;
  proposed: ServiceContent;
}

export interface AdminRequests {
  applications: Application[];
  serviceProposals: CareService[];
  changeProposals: ChangeProposal[];
}

export interface ReviewDecision {
  note?: string | null;
  slug?: string | null;
  content?: ServiceContent | null;
}

/** Uma pessoa profissional no Agendar para um serviço, com a oferta dela. */
export interface BookableProfessional {
  id: number;
  name: string;
  picture: string | null;
  bio: string | null;
  slug: string | null;
  offeringId: number;
  offersIndividual: boolean;
  offersGroup: boolean;
  modality: OfferingModality;
  audiences: Audience[];
}

export interface AdminProfile {
  profile: ProfessionalProfile;
  account: Person | null;
}

export function emptyServiceContent(): ServiceContent {
  return {
    name: '',
    allowsIndividual: false,
    allowsGroup: false,
    allowsInPerson: false,
    allowsRemote: false,
    allowsPublic: true,
    allowsPrivate: false,
    intro: '',
    quote: null,
    imageUrl: null,
    imageAlt: null,
    forWhom: [],
    audienceIds: [],
    proposedAudiences: [],
    specialties: [],
  };
}

export function emptyProfile(displayName = ''): ProfessionalProfile {
  return {
    id: null,
    userId: null,
    slug: null,
    status: null,
    updatedAt: null,
    displayName,
    title: null,
    photoUrl: null,
    whoAmI: '',
    quote: null,
    education: [],
    experience: [],
    howIWork: null,
    languages: [],
    areas: null,
    otherInfo: null,
  };
}

/** Um perfil vindo da API com os textos obrigatórios nunca nulos, pronto para um formulário. */
export function profileForForm(p: ProfessionalProfile): ProfessionalProfile {
  return {
    ...p,
    displayName: p.displayName ?? '',
    whoAmI: p.whoAmI ?? '',
    education: p.education ?? [],
    experience: p.experience ?? [],
    languages: p.languages ?? [],
  };
}

/** O conteúdo de um serviço que já existe — ponto de partida de uma proposta de alteração. */
export function contentOf(s: CareService): ServiceContent {
  return {
    name: s.name,
    allowsIndividual: s.allowsIndividual,
    allowsGroup: s.allowsGroup,
    allowsInPerson: s.allowsInPerson,
    allowsRemote: s.allowsRemote,
    allowsPublic: s.allowsPublic,
    allowsPrivate: s.allowsPrivate,
    intro: s.intro,
    quote: s.quote,
    imageUrl: s.imageUrl,
    imageAlt: s.imageAlt,
    forWhom: [...s.forWhom],
    audienceIds: s.audiences.map(a => a.id),
    proposedAudiences: [],
    specialties: s.specialties.map(sp => ({
      id: sp.id,
      name: sp.name,
      description: sp.description,
      audienceIds: sp.audiences.map(a => a.id),
      proposedAudiences: [],
    })),
  };
}
