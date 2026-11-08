import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { ReviewPoint } from '../../../models/review.model';
import { SessionService } from '../../../services/session.service';
import { ReviewThreadComponent } from './review-thread.component';

function point(status: ReviewPoint['status'], publishedStatus: ReviewPoint['status']): ReviewPoint {
  return { key: 'pro:quem-sou', itemKey: 'pro', section: 'quem-sou', label: 'Quem sou', status, comments: [], publishedStatus, changes: [] };
}

describe('ReviewThreadComponent — status de um ponto aprovado', () => {
  function render(p: ReviewPoint, team = true): HTMLElement {
    TestBed.configureTestingModule({
      imports: [ReviewThreadComponent],
      providers: [{ provide: SessionService, useValue: { user: signal(null) } }],
    });
    const fixture = TestBed.createComponent(ReviewThreadComponent);
    fixture.componentRef.setInput('point', p);
    fixture.componentRef.setInput('team', team);
    fixture.componentRef.setInput('defaultOpen', true);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const choice = (el: HTMLElement, label: string) =>
    [...el.querySelectorAll<HTMLButtonElement>('.rv-choice')].find(b => b.textContent?.includes(label))!;

  it('aprovado e enviado: só fica Aprovado', () => {
    const el = render(point('APPROVED', 'APPROVED'));
    expect(choice(el, 'Pendente').disabled).toBe(true);
    expect(choice(el, 'Negado').disabled).toBe(true);
    expect(choice(el, 'Aprovado').disabled).toBe(false);
    expect(el.textContent).toContain('Aprovado e enviado');
  });

  it('aprovado ainda em rascunho: a equipe pode voltar atrás', () => {
    const el = render(point('APPROVED', 'PENDING'));
    expect(choice(el, 'Pendente').disabled).toBe(false);
    expect(el.textContent).not.toContain('Aprovado e enviado');
  });

  it('o botão da equipe diz "Salvar rascunho" e explica-se ao passar o rato', () => {
    const el = render(point('PENDING', 'PENDING'));
    const tip = el.querySelector('[role="tooltip"]');
    expect(el.textContent).toContain('Salvar rascunho');
    expect(tip?.textContent).toContain('o texto fica guardado para uma sessão futura');
  });
});
