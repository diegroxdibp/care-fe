import {
  firstParagraph,
  fromEditorDoc,
  parseInline,
  parseRichText,
  serializeRichText,
  toEditorDoc,
} from './rich-text.util';

const t = (text: string, bold = false, italic = false) => ({ text, bold, italic });

describe('rich-text — textos dos serviços e perfis', () => {
  it('um texto antigo continua a ser só parágrafos', () => {
    expect(parseRichText('Um.\n\nDois\ncontinua.')).toEqual([
      { type: 'paragraph', content: [t('Um.')] },
      { type: 'paragraph', content: [t('Dois continua.')] },
    ]);
  });

  it('subtítulo, negrito, itálico e listas', () => {
    const text = [
      '### O corpo tem uma história',
      'Há situações que **entendemos** e *continuamos*.',
      '',
      '- um',
      '- dois',
      '',
      '1. primeiro',
      '2. segundo',
    ].join('\n');
    expect(parseRichText(text)).toEqual([
      { type: 'heading', content: [t('O corpo tem uma história')] },
      { type: 'paragraph', content: [t('Há situações que '), t('entendemos', true), t(' e '), t('continuamos', false, true), t('.')] },
      { type: 'bulletList', items: [[t('um')], [t('dois')]] },
      { type: 'orderedList', items: [[t('primeiro')], [t('segundo')]] },
    ]);
  });

  it('negrito e itálico juntos e encostados', () => {
    expect(parseInline('***a*b**')).toEqual([t('a', true, true), t('b', true)]);
    expect(parseInline('*a***b**')).toEqual([t('a', false, true), t('b', true)]);
  });

  it('um asterisco sozinho fica como texto', () => {
    expect(parseInline('2 * 3 = 6')).toEqual([t('2 * 3 = 6')]);
    expect(parseInline('**a** e 5*')).toEqual([t('a', true), t(' e 5*')]);
  });

  it('o resumo é o primeiro parágrafo, sem o subtítulo', () => {
    expect(firstParagraph('### Título\n\nTexto **forte**.\n\nOutro.')).toEqual([t('Texto '), t('forte', true), t('.')]);
  });

  it('o que o editor escreve volta igual', () => {
    const blocks = [
      { type: 'heading' as const, content: [t('Sobre *mim*')] },
      { type: 'paragraph' as const, content: [t('- não é lista, 2 * 3 e '), t('fim', true, true)] },
      { type: 'paragraph' as const, content: [t('1. também não')] },
      { type: 'bulletList' as const, items: [[t('a', true)], [t('b')]] },
    ];
    const text = serializeRichText(blocks);
    expect(parseRichText(text)).toEqual(blocks);
  });

  it('parágrafos vazios do editor não ficam no texto', () => {
    expect(serializeRichText([{ type: 'paragraph', content: [] }, { type: 'paragraph', content: [t('Só este.')] }])).toBe(
      'Só este.',
    );
  });

  it('converte de e para o documento do editor', () => {
    const blocks = parseRichText('### T\n\nUm **dois**.\n\n- a\n- b');
    expect(fromEditorDoc(toEditorDoc(blocks))).toEqual(blocks);
  });

  it('listas dentro de listas ficam no mesmo nível', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'a' }] },
                {
                  type: 'bulletList',
                  content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'b' }] }] }],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(fromEditorDoc(doc)).toEqual([{ type: 'bulletList', items: [[t('a')], [t('b')]] }]);
  });
});
