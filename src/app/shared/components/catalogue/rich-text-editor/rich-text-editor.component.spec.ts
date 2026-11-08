import { TestBed } from '@angular/core/testing';
import { Editor } from '@tiptap/core';

import { RichTextEditorComponent } from './rich-text-editor.component';

function setup(value: string, disabled = false) {
  const fixture = TestBed.createComponent(RichTextEditorComponent);
  fixture.componentRef.setInput('label', 'Apresentação');
  fixture.componentRef.setInput('value', value);
  fixture.componentRef.setInput('disabled', disabled);
  const emitted: string[] = [];
  fixture.componentInstance.valueChange.subscribe(v => emitted.push(v));
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const editor = (fixture.componentInstance as unknown as { editor: Editor }).editor;
  return { fixture, el, editor, emitted };
}

const tool = (el: HTMLElement, label: string) => el.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;

describe('RichTextEditorComponent', () => {
  it('mostra o texto guardado já formatado', () => {
    const { el } = setup('### O corpo tem uma história\n\nHá situações que **entendemos**.');
    const content = el.querySelector('.cat-rt-content')!;
    expect(content.querySelector('h3')?.textContent).toBe('O corpo tem uma história');
    expect(content.querySelector('strong')?.textContent).toBe('entendemos');
    expect(content.getAttribute('aria-label')).toBe('Apresentação');
  });

  it('o botão Subtítulo transforma a linha num subtítulo e devolve o texto marcado', () => {
    const { el, editor, emitted, fixture } = setup('O corpo tem uma história\n\nHá situações.');
    editor.commands.setTextSelection(3);
    tool(el, 'Subtítulo').click();
    fixture.detectChanges();
    expect(emitted.at(-1)).toBe('### O corpo tem uma história\n\nHá situações.');
    expect(tool(el, 'Subtítulo').getAttribute('aria-pressed')).toBe('true');
  });

  it('negrito e lista', () => {
    const { el, editor, emitted } = setup('um\n\ndois');
    editor.commands.setTextSelection({ from: 1, to: 3 });
    tool(el, 'Negrito').click();
    expect(emitted.at(-1)).toBe('**um**\n\ndois');
    editor.commands.setTextSelection(7);
    tool(el, 'Lista com marcadores').click();
    expect(emitted.at(-1)).toBe('**um**\n\n- dois');
  });

  it('um valor que muda por fora aparece, sem emitir de volta', () => {
    const { fixture, el, emitted } = setup('antes');
    fixture.componentRef.setInput('value', 'depois');
    fixture.detectChanges();
    expect(el.querySelector('.cat-rt-content')?.textContent).toBe('depois');
    expect(emitted).toEqual([]);
  });

  it('parte bloqueada: nem texto nem botões', () => {
    const { el } = setup('texto', true);
    expect(el.querySelector('.cat-rt-content')?.getAttribute('contenteditable')).toBe('false');
    expect(tool(el, 'Negrito').disabled).toBe(true);
  });
});
