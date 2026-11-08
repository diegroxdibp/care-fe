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

  beforeEach(() => {
    requestChanges = jest.fn().mockReturnValue(of({}));
    TestBed.configureTestingModule({
      imports: [ReviewPageComponent],
      providers: [
        { provide: ReviewApiService, useValue: { requestChanges } },
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
      point('pro:crp', 'Registro', 'REJECTED'),
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
      point('pro:crp', 'Registro', 'REJECTED'),
    ]);

    expect(component.canRequestChanges()).toBe(true);
    expect(component.requestChangesHint()).toBe('');
    component.requestChanges();
    expect(requestChanges).toHaveBeenCalledWith('APPLICATION', 5);
  });
});
