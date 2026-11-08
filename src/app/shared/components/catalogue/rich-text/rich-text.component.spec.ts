import { TestBed } from '@angular/core/testing';

import { parseRichText } from '../../../utils/rich-text.util';
import { RichTextComponent } from './rich-text.component';

function render(text: string): HTMLElement {
  const fixture = TestBed.createComponent(RichTextComponent);
  fixture.componentRef.setInput('blocks', parseRichText(text));
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('RichTextComponent', () => {
  it('subtítulo, negrito e itálico, sem espaços a mais', () => {
    const el = render('### O corpo tem uma história\nHá **situações**, e *mesmo assim*.');
    expect(el.querySelector('h3')?.textContent).toBe('O corpo tem uma história');
    expect(el.querySelector('p')?.textContent).toBe('Há situações, e mesmo assim.');
    expect(el.querySelector('p strong')?.textContent).toBe('situações');
    expect(el.querySelector('p em')?.textContent).toBe('mesmo assim');
  });

  it('listas com marcadores e numeradas', () => {
    const el = render('- a\n- b\n\n1. um\n2. dois');
    expect(el.querySelectorAll('ul li').length).toBe(2);
    expect([...el.querySelectorAll('ol li')].map(li => li.textContent)).toEqual(['um', 'dois']);
  });

  it('o que se escreve nunca vira HTML', () => {
    const el = render('<img src=x onerror=alert(1)> **<b>oi</b>**');
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('b')).toBeNull();
    expect(el.textContent).toContain('<b>oi</b>');
  });
});
