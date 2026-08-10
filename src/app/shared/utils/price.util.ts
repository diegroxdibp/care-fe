/**
 * Regras dos campos de valor (Valor em Euro / Valor em Reais).
 *
 * Vivem aqui porque são as mesmas em dois sítios que têm de concordar: o editor
 * de disponibilidade, onde a vaga é anunciada, e o diálogo de proposta
 * recorrente, onde o valor pode ser combinado à parte para uma pessoa. Duas
 * cópias das mesmas regras acabariam a divergir precisamente no limite que o
 * backend valida (@DecimalMin/@DecimalMax em AvailabilityDTO e
 * RecurringProposalRequestDTO), e a discordância só apareceria como um 400.
 */

/** Espelham os limites validados no backend. */
export const PRICE_MIN = 0;
export const PRICE_MAX = 10000;

/** Separador decimal do locale — o que a pessoa escreve, não o que a API quer. */
export function decimalSeparatorFor(locale: string): string {
  return new Intl.NumberFormat(locale).formatToParts(1.1).find(p => p.type === 'decimal')?.value ?? '.';
}

export interface MoneyLocale {
  symbol: string;
  /** Se o símbolo vem antes do número neste locale ("€ 10" vs "10 €"). */
  isPrefix: boolean;
  placeholder: string;
}

export function moneyLocaleFor(locale: string, currency: string): MoneyLocale {
  const parts = new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(0);
  return {
    symbol: parts.find(p => p.type === 'currency')?.value ?? currency,
    isPrefix: parts.findIndex(p => p.type === 'currency') < parts.findIndex(p => p.type === 'integer'),
    placeholder: (0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  };
}

// O campo aceita o separador do locale; a API quer sempre um número simples.
export function parsePriceInput(raw: string, separator: string): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw.split(separator).join('.'));
  return Number.isFinite(n) ? n : undefined;
}

export function formatPriceForEditor(price: number | undefined, separator: string): string {
  return price != null ? price.toFixed(2).replace('.', separator) : '';
}

// Normaliza o que vai sendo escrito para "dígitos<sep>dígitos(0-2)".
export function sanitizePriceInput(raw: string, separator: string): string {
  let value = [...raw].filter(ch => (ch >= '0' && ch <= '9') || ch === separator).join('');
  const firstSep = value.indexOf(separator);
  if (firstSep !== -1) {
    value = value.slice(0, firstSep + 1) + [...value.slice(firstSep + 1)].filter(ch => ch !== separator).join('');
  }
  const [intPart, decPart] = value.split(separator);
  return decPart !== undefined ? `${intPart}${separator}${decPart.slice(0, 2)}` : value;
}

function formatCurrencyWhole(n: number, locale: string, currency: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}

export interface PriceValidationOptions {
  locale: string;
  currency: string;
  separator: string;
  /** A false, um campo vazio é válido (o valor em Reais é opcional). */
  required: boolean;
}

/** Mensagem de erro do campo, ou null se o que lá está serve. */
export function validatePriceInput(raw: string, options: PriceValidationOptions): string | null {
  const { locale, currency, separator, required } = options;
  const isEmpty = raw.trim() === '';

  if (isEmpty) return required ? 'Indique o valor da sessão.' : null;

  const value = parsePriceInput(raw, separator);
  if (value === undefined) return required ? 'Indique o valor da sessão.' : 'Indique um valor válido.';
  if (value <= PRICE_MIN) return `O valor deve ser superior a ${formatCurrencyWhole(PRICE_MIN, locale, currency)}`;
  if (value > PRICE_MAX) return `O valor máximo permitido é ${formatCurrencyWhole(PRICE_MAX, locale, currency)}`;
  return null;
}
