/**
 * Textos longos dos serviços e perfis (apresentação, como funciona, quem sou,
 * como trabalho). Guardam-se como texto com marcas simples, para que os
 * textos antigos continuem válidos e nada escrito por quem usa seja HTML:
 *
 *   ### Subtítulo
 *   Parágrafo com **negrito** e *itálico*.   (parágrafos: linha em branco)
 *   - item de lista
 *   1. item numerado
 *
 * O editor (rich-text-editor) escreve neste formato; a página
 * (rich-text) mostra-o. "\" antes de um caractere torna-o literal.
 */

export interface RichInline {
  text: string;
  bold: boolean;
  italic: boolean;
}

export type RichBlock =
  | { type: 'paragraph'; content: RichInline[] }
  | { type: 'heading'; content: RichInline[] }
  | { type: 'bulletList' | 'orderedList'; items: RichInline[][] };

type ListBlock = Extract<RichBlock, { items: RichInline[][] }>;
type TextBlock = Exclude<RichBlock, ListBlock>;

export function isList(b: RichBlock): b is ListBlock {
  return 'items' in b;
}

const HEADING = /^###\s+(.*)$/;
const BULLET = /^[-*]\s+(.*)$/;
const ORDERED = /^\d+[.)]\s+(.*)$/;

export function parseRichText(text: string | null | undefined): RichBlock[] {
  const blocks: RichBlock[] = [];
  let paragraph: string[] = [];
  let list: { type: 'bulletList' | 'orderedList'; items: RichInline[][] } | null = null;

  const flush = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', content: parseInline(paragraph.join(' ')) });
    paragraph = [];
    if (list) blocks.push(list);
    list = null;
  };

  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      blocks.push({ type: 'heading', content: parseInline(heading[1]) });
      continue;
    }
    const bullet = BULLET.exec(line);
    const ordered = bullet ? null : ORDERED.exec(line);
    const item = bullet ?? ordered;
    if (item) {
      const type = bullet ? 'bulletList' : 'orderedList';
      if (paragraph.length || (list && list.type !== type)) flush();
      list ??= { type, items: [] };
      list.items.push(parseInline(item[1]));
      continue;
    }
    if (list) flush();
    paragraph.push(line);
  }
  flush();
  return blocks.filter(b => (isList(b) ? b.items.length : b.content.length));
}

type Token = { kind: 'text'; text: string } | { kind: 'mark'; bold: boolean; italic: boolean };

/**
 * Negrito e itálico: "**" liga/desliga o negrito, "*" o itálico, "***" os
 * dois. Uma marca sem par fica como texto (ex.: "2 * 3").
 */
export function parseInline(text: string): RichInline[] {
  const tokens: Token[] = [];
  let buf = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\\' && i + 1 < text.length) {
      buf += text[++i];
      continue;
    }
    if (ch === '*') {
      let n = 1;
      while (text[i + n] === '*' && n < 3) n++;
      if (buf) tokens.push({ kind: 'text', text: buf });
      buf = '';
      tokens.push({ kind: 'mark', bold: n >= 2, italic: n !== 2 });
      i += n - 1;
      continue;
    }
    buf += ch;
  }
  if (buf) tokens.push({ kind: 'text', text: buf });

  // Marcas sem par: a última de cada tipo volta a ser texto.
  for (const kind of ['bold', 'italic'] as const) {
    const marks = tokens.filter((t): t is Extract<Token, { kind: 'mark' }> => t.kind === 'mark' && t[kind]);
    if (marks.length % 2) {
      const last = marks[marks.length - 1];
      last[kind] = false;
      const idx = tokens.indexOf(last);
      const literal: Token = { kind: 'text', text: kind === 'bold' ? '**' : '*' };
      tokens.splice(idx + 1, 0, literal);
    }
  }

  const out: RichInline[] = [];
  let bold = false;
  let italic = false;
  for (const t of tokens) {
    if (t.kind === 'mark') {
      if (t.bold) bold = !bold;
      if (t.italic) italic = !italic;
      continue;
    }
    const prev = out[out.length - 1];
    if (prev && prev.bold === bold && prev.italic === italic) prev.text += t.text;
    else out.push({ text: t.text, bold, italic });
  }
  return out;
}

/** O primeiro parágrafo (sem títulos nem listas): o resumo nos cartões. */
export function firstParagraph(text: string | null | undefined): RichInline[] {
  const p = parseRichText(text).find(b => b.type === 'paragraph');
  return p && p.type === 'paragraph' ? p.content : [];
}

export function plainText(inlines: RichInline[]): string {
  return inlines.map(i => i.text).join('');
}

// ---- Escrita (do editor para o texto guardado) ----

function escapeText(text: string): string {
  return text.replace(/[\\*]/g, m => '\\' + m);
}

export function serializeInline(inlines: RichInline[]): string {
  let out = '';
  let bold = false;
  let italic = false;
  for (const i of inlines) {
    if (!i.text) continue;
    const toggleBold = i.bold !== bold;
    const toggleItalic = i.italic !== italic;
    out += toggleBold && toggleItalic ? '***' : toggleBold ? '**' : toggleItalic ? '*' : '';
    bold = i.bold;
    italic = i.italic;
    out += escapeText(i.text);
  }
  out += bold && italic ? '***' : bold ? '**' : italic ? '*' : '';
  return out;
}

/** Uma linha que, sozinha, seria lida como título ou item de lista. */
function escapeLineStart(line: string): string {
  if (HEADING.test(line)) return '\\' + line;
  if (/^-\s/.test(line)) return '\\' + line;
  return line.replace(/^(\d+)([.)])(\s)/, '$1\\$2$3');
}

export function serializeRichText(blocks: RichBlock[]): string {
  const filled = (i: RichInline[]) => plainText(i).trim().length > 0;
  return blocks
    .map(b => (isList(b) ? { ...b, items: b.items.filter(filled) } : b))
    .filter(b => (isList(b) ? b.items.length : filled((b as TextBlock).content)))
    .map(b => {
      switch (b.type) {
        case 'heading':
          return '### ' + serializeInline(b.content).replace(/\s+/g, ' ').trim();
        case 'paragraph':
          return escapeLineStart(serializeInline(b.content).replace(/\s*\n\s*/g, ' ').trim());
        case 'bulletList':
          return b.items.map(i => '- ' + serializeInline(i).replace(/\s+/g, ' ').trim()).join('\n');
        case 'orderedList':
          return b.items.map((i, n) => `${n + 1}. ` + serializeInline(i).replace(/\s+/g, ' ').trim()).join('\n');
      }
    })
    .join('\n\n');
}

// ---- Documento do editor (TipTap/ProseMirror JSON) ----

export interface EditorNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string }[];
  content?: EditorNode[];
}

function inlineToNodes(inlines: RichInline[]): EditorNode[] {
  return inlines
    .filter(i => i.text)
    .map(i => {
      const marks = [...(i.bold ? [{ type: 'bold' }] : []), ...(i.italic ? [{ type: 'italic' }] : [])];
      return marks.length ? { type: 'text', text: i.text, marks } : { type: 'text', text: i.text };
    });
}

export function toEditorDoc(blocks: RichBlock[]): EditorNode {
  const content = blocks.map((b): EditorNode => {
    switch (b.type) {
      case 'heading':
        return { type: 'heading', attrs: { level: 3 }, content: inlineToNodes(b.content) };
      case 'paragraph':
        return { type: 'paragraph', content: inlineToNodes(b.content) };
      default:
        return {
          type: b.type,
          content: b.items.map(i => ({ type: 'listItem', content: [{ type: 'paragraph', content: inlineToNodes(i) }] })),
        };
    }
  });
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}

function nodesToInline(nodes: EditorNode[] | undefined): RichInline[] {
  const out: RichInline[] = [];
  for (const n of nodes ?? []) {
    if (n.type === 'hardBreak') {
      out.push({ text: ' ', bold: false, italic: false });
      continue;
    }
    if (n.type !== 'text' || !n.text) continue;
    const marks = (n.marks ?? []).map(m => m.type);
    out.push({ text: n.text, bold: marks.includes('bold'), italic: marks.includes('italic') });
  }
  return out;
}

/** Itens de uma lista; listas dentro de listas ficam no mesmo nível. */
function listItems(list: EditorNode): RichInline[][] {
  const items: RichInline[][] = [];
  for (const li of list.content ?? []) {
    const parts: RichInline[] = [];
    for (const child of li.content ?? []) {
      if (child.type === 'bulletList' || child.type === 'orderedList') {
        if (parts.length) items.push(parts.splice(0));
        items.push(...listItems(child));
      } else {
        if (parts.length) parts.push({ text: ' ', bold: false, italic: false });
        parts.push(...nodesToInline(child.content));
      }
    }
    if (parts.length) items.push(parts);
  }
  return items;
}

export function fromEditorDoc(doc: EditorNode): RichBlock[] {
  const blocks: RichBlock[] = [];
  for (const n of doc.content ?? []) {
    if (n.type === 'heading') blocks.push({ type: 'heading', content: nodesToInline(n.content) });
    else if (n.type === 'bulletList' || n.type === 'orderedList') blocks.push({ type: n.type, items: listItems(n) });
    else blocks.push({ type: 'paragraph', content: nodesToInline(n.content) });
  }
  return blocks;
}
