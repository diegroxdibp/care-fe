import { Audience, CareService, FormatKey, ModalityKey, ServiceContent } from '../models/catalogue.model';

/** Parágrafos de um texto: separados por uma linha em branco. */
export function paragraphs(text: string | null | undefined): string[] {
  return String(text ?? '')
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);
}

/** Itens escritos um por linha. */
export function lines(text: string | null | undefined): string[] {
  return String(text ?? '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);
}

/** "a, b e c" — como se junta uma lista em português. */
export function joinPt(items: string[]): string {
  if (items.length < 2) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

/** Endereço a partir de um nome: sem acentos, minúsculas, o resto vira "-". Igual a care-be ServiceEditor.slugify. */
export function slugify(text: string): string {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Chaves de serviço de antes da lista partilhada (V38), que ainda aparecem em
 * dados antigos guardados (contexto de threads, histórico). O resto já vem da
 * API com o nome do serviço na lista.
 */
const LEGACY_SERVICE_NAMES: Record<string, string> = {
  REICHIAN_BODY_ANALYSIS: 'Análise Corporal Reichiana',
  MINDFULNESS: 'Mindfulness',
  SOMATIC_EXPERIENCE: 'Somatic Experiencing®',
  SUPERVISION: 'Supervisão',
  // Rótulos em inglês gravados no contextLabel das threads antigas.
  'Reichian Body Analysis': 'Análise Corporal Reichiana',
  Supervision: 'Supervisão',
};

/** O nome de um serviço para mostrar: o da lista, ou o de uma chave antiga guardada. */
export function serviceLabel(raw: string | null | undefined): string {
  if (!raw) return '';
  return LEGACY_SERVICE_NAMES[raw] ?? raw;
}

export const FORMAT_LABELS: Record<FormatKey, string> = { INDIVIDUAL: 'Individual', GROUP: 'Em grupo' };
export const MODALITY_LABELS: Record<ModalityKey, string> = { LOCAL: 'Presencial', REMOTE: 'Remoto' };

export function formatsOf(s: { allowsIndividual: boolean; allowsGroup: boolean }): FormatKey[] {
  return [...(s.allowsIndividual ? (['INDIVIDUAL'] as const) : []), ...(s.allowsGroup ? (['GROUP'] as const) : [])];
}

export function modalitiesOf(s: { allowsInPerson: boolean; allowsRemote: boolean }): ModalityKey[] {
  return [...(s.allowsInPerson ? (['LOCAL'] as const) : []), ...(s.allowsRemote ? (['REMOTE'] as const) : [])];
}

export function formatLabels(keys: FormatKey[]): string {
  return joinPt(keys.map(k => FORMAT_LABELS[k]));
}

export function modalityLabels(keys: ModalityKey[]): string {
  return joinPt(keys.map(k => MODALITY_LABELS[k]));
}

export function audienceLabels(list: Audience[]): string {
  return joinPt(list.map(a => a.name));
}

/** "Presencial e Remoto · Individual · Adultos" — o resumo de um serviço numa linha. */
export function serviceMeta(s: CareService): string {
  return [modalityLabels(modalitiesOf(s)), formatLabels(formatsOf(s)), audienceLabels(s.audiences)]
    .filter(Boolean)
    .join(' · ');
}

/** Só por convite: não aparece em listas nem tem botão Agendar. */
export function isPrivateOnly(s: { allowsPublic: boolean }): boolean {
  return !s.allowsPublic;
}

/**
 * Campos obrigatórios em falta num serviço vindo de um formulário — o mesmo
 * que care-be ServiceEditor.missing, para mostrar antes de enviar.
 */
export function missingServiceFields(c: ServiceContent): string[] {
  const m: string[] = [];
  if (!c.name.trim()) m.push('nome do serviço');
  if (!c.allowsInPerson && !c.allowsRemote) m.push('modalidade');
  if (!c.allowsIndividual && !c.allowsGroup) m.push('formato');
  if (!c.allowsPublic && !c.allowsPrivate) m.push('visibilidade');
  if (c.audienceIds.length + c.proposedAudiences.filter(p => p.trim()).length === 0) m.push('público');
  if (!c.intro.trim()) m.push('texto de apresentação');
  c.specialties.forEach((s, i) => {
    if (!s.name.trim()) m.push(`especialidade ${i + 1}: nome`);
  });
  return m;
}

export const IMAGE_MAX_BYTES = 15 * 1024 * 1024;
export const IMAGE_MAX_SIDE = 1200;

/**
 * Reduz uma imagem no navegador (no máximo 1200 px no lado maior, JPEG
 * ~0.82) antes de enviar. O servidor volta a reduzir — isto só poupa o envio.
 * Rejeita com a mensagem a mostrar.
 */
export function shrinkImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) {
      reject('O ficheiro escolhido não é uma imagem.');
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      reject('A imagem tem mais de 15 MB. Escolha uma versão mais leve.');
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, IMAGE_MAX_SIDE / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * k);
      canvas.height = Math.round(img.height * k);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject('Não foi possível ler esta imagem.');
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(b => (b ? resolve(b) : reject('Não foi possível ler esta imagem.')), 'image/jpeg', 0.82);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject('Não foi possível ler esta imagem.');
    };
    img.src = url;
  });
}
