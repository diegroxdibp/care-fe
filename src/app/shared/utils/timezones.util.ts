export interface TimezoneOption {
  /** Identificador IANA — o que é guardado no perfil. */
  value: string;
  /** Nome da cidade em português, para leitura e busca. */
  city: string;
}

const FALLBACK_TIMEZONE = 'Europe/Lisbon';

/**
 * Fusos que a CARE atende primeiro. Aparecem no topo da lista, na ordem abaixo;
 * os demais fusos do sistema entram depois, em ordem alfabética.
 */
export const PINNED_TIMEZONES: TimezoneOption[] = [
  { value: 'Europe/Lisbon', city: 'Lisboa' },
  { value: 'America/Sao_Paulo', city: 'São Paulo — Brasília' },
  { value: 'America/Recife', city: 'Recife' },
  { value: 'America/Manaus', city: 'Manaus' },
  { value: 'America/Rio_Branco', city: 'Rio Branco' },
  { value: 'Europe/Madrid', city: 'Madrid' },
  { value: 'Europe/London', city: 'Londres' },
  { value: 'Europe/Berlin', city: 'Berlim' },
  { value: 'America/New_York', city: 'Nova York' },
];

/** Fuso do navegador, com fallback quando a API não está disponível. */
export function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIMEZONE;
  } catch {
    return FALLBACK_TIMEZONE;
  }
}

/** Ex.: 'GMT-3' — calculado na data indicada, para respeitar horário de verão. */
export function timezoneOffsetLabel(timeZone: string, at: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      timeZoneName: 'shortOffset',
    }).formatToParts(at);
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
}

/** Nome legível da cidade — usa a lista fixa e cai no próprio id IANA. */
export function timezoneCity(timeZone: string): string {
  const pinned = PINNED_TIMEZONES.find((t) => t.value === timeZone);
  if (pinned) return pinned.city;
  const leaf = timeZone.split('/').pop() ?? timeZone;
  return leaf.replace(/_/g, ' ');
}

/** Ex.: 'Lisboa (GMT+1)' — rótulo do seletor no perfil. */
export function timezoneLabel(timeZone: string): string {
  const offset = timezoneOffsetLabel(timeZone);
  return offset ? `${timezoneCity(timeZone)} (${offset})` : timezoneCity(timeZone);
}

/** Offset do fuso, em ms, no instante indicado. */
function zoneOffsetMs(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second'),
  );
  return asUtc - at.getTime();
}

/**
 * Converte uma hora de parede num fuso ('2026-08-03' + '14:00' em
 * 'Europe/Lisbon') no instante correspondente.
 *
 * O JS não sabe fazer isto de forma direta, daí as duas passagens: a primeira
 * estima o offset, a segunda corrige-o para o instante já ajustado — necessário
 * junto às mudanças de horário de verão, onde o offset muda a meio do cálculo.
 */
export function zonedWallTimeToInstant(
  dateKey: string,
  time: string,
  timeZone: string,
): Date | null {
  const [y, m, d] = dateKey.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) return null;

  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const firstPass = guess - zoneOffsetMs(timeZone, new Date(guess));
  return new Date(guess - zoneOffsetMs(timeZone, new Date(firstPass)));
}

/**
 * Verdadeiro quando esta hora de parede (numa data e, se souber, fuso) já
 * passou em relação a `now`.
 *
 * Sem fuso, cai na hora local de quem está a ver — só acontece para vagas
 * antigas gravadas sem timeZone. É pior do que converter, mas ainda assim
 * distingue hoje-já-passou de hoje-ainda-vem, que é o que falta sem isto: uma
 * vaga de hoje às 09:00 continuava a aparecer disponível às 15:00.
 */
export function isWallTimePast(
  dateKey: string,
  time: string,
  timeZone?: string,
  now: Date = new Date(),
): boolean {
  const instant = timeZone ? zonedWallTimeToInstant(dateKey, time, timeZone) : null;
  if (instant) return instant.getTime() < now.getTime();

  const [y, m, d] = dateKey.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) return false;
  return new Date(y, m - 1, d, hh, mm).getTime() < now.getTime();
}

/** Lista completa: fixos primeiro, depois todos os fusos suportados pelo runtime. */
export function allTimezones(): TimezoneOption[] {
  const supported: string[] =
    (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
      .supportedValuesOf?.('timeZone') ?? [];

  const pinnedIds = new Set(PINNED_TIMEZONES.map((t) => t.value));
  const rest = supported
    .filter((id) => !pinnedIds.has(id))
    .map((id) => ({ value: id, city: timezoneCity(id) }))
    .sort((a, b) => a.city.localeCompare(b.city, 'pt-BR'));

  return [...PINNED_TIMEZONES, ...rest];
}
