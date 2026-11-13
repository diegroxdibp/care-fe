import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { CatalogueApiService } from '../../../../core/services/catalogue-api.service';
import { ReviewApiService } from '../../../../core/services/review-api.service';
import { Review, ReviewComment, ReviewPoint } from '../../../models/review.model';
import { NavigationService } from '../../../services/navigation.service';
import { SessionService } from '../../../services/session.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { ReviewPageComponent } from './review-page.component';

function comment(fromTeam: boolean, draft: boolean): ReviewComment {
  return { fromTeam, author: fromTeam ? 'Equipe CARE' : 'Ana', text: 'Oi', at: '2026-11-08T10:00:00Z', draft };
}

function point(key: string, label: string, status: ReviewPoint['status'], comments: ReviewComment[] = []): ReviewPoint {
  return { key, itemKey: 'pro', section: 'Perfil', label, status, comments, publishedStatus: 'PENDING', changes: [] };
}

describe('ReviewPageComponent — devolver para alterações', () => {
  let component: ReviewPageComponent;
  let requestChanges: jest.Mock;
  let commentApi: jest.Mock;
  const calls: string[] = [];

  beforeEach(() => {
    calls.length = 0;
    requestChanges = jest.fn().mockImplementation(() => {
      calls.push('devolver');
      return of({ kind: 'APPLICATION', id: 5, stage: 'CHANGES', points: [] });
    });
    commentApi = jest.fn().mockImplementation((_k, _i, key: string, text: string) => {
      calls.push(`comentar ${key}: ${text}`);
      return of(component.review());
    });
    TestBed.configureTestingModule({
      imports: [ReviewPageComponent],
      providers: [
        { provide: ReviewApiService, useValue: { requestChanges, comment: commentApi } },
        { provide: CatalogueApiService, useValue: { options: () => of(null) } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { team: true }, paramMap: convertToParamMap({}), queryParamMap: convertToParamMap({}) } },
        },
        { provide: SnackbarService, useValue: { openSnackBar: jest.fn() } },
        { provide: SessionService, useValue: { user: signal(null) } },
        { provide: MatDialog, useValue: { open: jest.fn() } },
        { provide: NavigationService, useValue: { afterNavigationScroll: () => Promise.resolve() } },
      ],
    });
    component = TestBed.createComponent(ReviewPageComponent).componentInstance;
  });

  function load(points: ReviewPoint[]): void {
    component.review.set({ kind: 'APPLICATION', id: 5, stage: 'ANALYSIS', points } as unknown as Review);
  }

  it('cada ponto pendente precisa de um comentário novo da equipe', () => {
    load([
      point('pro:foto', 'Foto', 'APPROVED'),
      point('pro:bio', 'Apresentação', 'PENDING'),
      point('pro:formacao', 'Formação', 'PENDING', [comment(false, false), comment(true, false)]),
    ]);

    expect(component.canRequestChanges()).toBe(false);
    expect(component.requestChangesHint()).toBe(
      'Para devolver, escreva um comentário em cada ponto pendente: Apresentação, Formação.',
    );
    component.requestChanges();
    expect(requestChanges).not.toHaveBeenCalled();
  });

  it('com um comentário por enviar em cada pendente, devolve', () => {
    load([
      point('pro:foto', 'Foto', 'APPROVED'),
      point('pro:bio', 'Apresentação', 'PENDING', [comment(true, true)]),
    ]);

    expect(component.canRequestChanges()).toBe(true);
    expect(component.requestChangesHint()).toBe('');
    component.requestChanges();
    expect(requestChanges).toHaveBeenCalledWith('APPLICATION', 5);
  });

  it('o texto escrito e não salvo conta e vai salvo antes de devolver', () => {
    load([
      point('pro:foto', 'Foto', 'APPROVED'),
      point('pro:bio', 'Apresentação', 'PENDING'),
    ]);
    expect(component.canRequestChanges()).toBe(false);

    component.typeComment('pro:bio', '  Falta a formação.  ');
    expect(component.canRequestChanges()).toBe(true);
    // Foto: Pendente → Aprovado ainda por enviar; o texto por salvar conta como comentário.
    expect(component.draftSummary()).toBe('1 comentário e 1 mudança de status');

    component.requestChanges();
    expect(calls).toEqual(['comentar pro:bio: Falta a formação.', 'devolver']);
    expect(commentApi).toHaveBeenCalledWith('APPLICATION', 5, 'pro:bio', 'Falta a formação.', true);
    expect(component.unsavedText('pro:bio')).toBe('');
  });
  it('com um ponto negado não se devolve: recusa-se', () => {
    load([
      point('pro:bio', 'Apresentação', 'PENDING', [comment(true, true)]),
      point('pro:crp', 'Registro', 'REJECTED'),
    ]);

    expect(component.canRequestChanges()).toBe(false);
    expect(component.requestChangesHint()).toContain('não pode haver pontos negados (Registro)');
    component.requestChanges();
    expect(requestChanges).not.toHaveBeenCalled();
  });
});

describe('ReviewPageComponent — concluir dispensando a entrevista', () => {
  let component: ReviewPageComponent;
  let conclude: jest.Mock;

  beforeEach(() => {
    conclude = jest.fn().mockReturnValue(of({ kind: 'APPLICATION', id: 5, stage: 'PUBLISHED', points: [], items: [] }));
    TestBed.configureTestingModule({
      imports: [ReviewPageComponent],
      providers: [
        { provide: ReviewApiService, useValue: { conclude } },
        { provide: CatalogueApiService, useValue: { options: () => of(null) } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { team: true }, paramMap: convertToParamMap({}), queryParamMap: convertToParamMap({}) } },
        },
        { provide: SnackbarService, useValue: { openSnackBar: jest.fn() } },
        { provide: SessionService, useValue: { user: signal(null) } },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(true) }) } },
        { provide: NavigationService, useValue: { afterNavigationScroll: () => Promise.resolve() } },
      ],
    });
    component = TestBed.createComponent(ReviewPageComponent).componentInstance;
    component.team.set(true);
  });

  function load(proDecision: 'APPROVED' | 'REJECTED'): void {
    component.review.set({
      kind: 'APPLICATION', id: 5, stage: 'ANALYSIS', decision: null, proposals: [],
      points: [point('pro:quem-sou', 'Quem sou', proDecision === 'APPROVED' ? 'APPROVED' : 'REJECTED')],
      items: [{ key: 'pro', serviceId: null, name: 'Ana Souza', slug: 'ana-souza', decision: proDecision }],
    } as unknown as Review);
  }

  it('a opção só aparece com o perfil aprovado', () => {
    load('REJECTED');
    expect(component.canWaiveInterview()).toBe(false);
    load('APPROVED');
    expect(component.canWaiveInterview()).toBe(true);
  });

  it('marcada, o botão publica já e o pedido segue com a dispensa', () => {
    load('APPROVED');
    expect(component.concludeLabel()).toBe('Concluir e convidar para entrevista');

    component.waiveInterview.set(true);
    expect(component.concludeLabel()).toBe('Concluir e publicar');
    expect(component.concludeHint()).toContain('sem entrevista');

    component.conclude();
    expect(conclude).toHaveBeenCalledWith('APPLICATION', 5, true);
  });
});
