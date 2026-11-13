import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { ApiService } from '../../../../core/services/api.service';
import { ReviewApiService } from '../../../../core/services/review-api.service';
import { Review } from '../../../models/review.model';
import { SessionService } from '../../../services/session.service';
import { InterviewSectionComponent } from './interview-section.component';

/** O pedido do João, com o perfil aprovado e um convite da equipe por responder. */
function review(overrides: Partial<Review> = {}): Review {
  return {
    kind: 'APPLICATION',
    id: 12,
    stage: 'INTERVIEW_TO_BOOK',
    interview: null,
    interviewInvitation: {
      token: 'tok-1',
      date: '2026-11-10',
      startTime: '10:00:00',
      endTime: '11:00:00',
      timeZone: 'Europe/Lisbon',
      host: 'Luane Bastos',
      modality: 'REMOTE',
    },
    ...overrides,
  } as Review;
}

describe('InterviewSectionComponent — o convite da equipe', () => {
  let reviewApi: Record<string, jest.Mock>;
  let api: Record<string, jest.Mock>;

  function render(r: Review, team = false) {
    TestBed.configureTestingModule({
      imports: [InterviewSectionComponent],
      providers: [
        { provide: ReviewApiService, useValue: reviewApi },
        { provide: ApiService, useValue: api },
        // São Paulo: o convite de Lisboa às 10:00 aparece às 07:00.
        { provide: SessionService, useValue: { user: signal({ timeZone: 'America/Sao_Paulo' }) } },
      ],
    });
    const fixture = TestBed.createComponent(InterviewSectionComponent);
    fixture.componentRef.setInput('review', r);
    fixture.componentRef.setInput('team', team);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-11-07T12:00:00Z'), doNotFake: ['setTimeout', 'queueMicrotask', 'nextTick'] });
    reviewApi = {
      interviewSlots: jest.fn().mockReturnValue(of([])),
      get: jest.fn().mockReturnValue(of(review({ stage: 'INTERVIEW_BOOKED', interviewInvitation: null }))),
    };
    api = {
      acceptInvitation: jest.fn().mockReturnValue(of({})),
      declineInvitation: jest.fn().mockReturnValue(of({})),
    };
  });
  afterEach(() => jest.useRealTimers());

  it('mostra o convite no fuso de quem lê, com aceitar e recusar', () => {
    const text = (render(review()).nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Convite da equipe');
    expect(text).toContain('07:00 – 08:00');
    expect(text).toContain('Com Luane Bastos');
    expect(text).toContain('Aceitar convite');
    expect(text).toContain('Recusar');
  });

  it('aceitar marca a entrevista e relê o pedido', () => {
    const fixture = render(review());
    const changed = jest.fn();
    fixture.componentInstance.changed.subscribe(changed);

    fixture.componentInstance.acceptInvitation();

    expect(api['acceptInvitation']).toHaveBeenCalledWith('tok-1');
    expect(reviewApi['get']).toHaveBeenCalledWith('APPLICATION', 12);
    expect(changed).toHaveBeenCalledWith(expect.objectContaining({ stage: 'INTERVIEW_BOOKED' }));
  });

  it('recusar responde pelo mesmo token', () => {
    render(review()).componentInstance.declineInvitation();
    expect(api['declineInvitation']).toHaveBeenCalledWith('tok-1');
  });

  it('a equipe não vê o convite como se fosse a pessoa', () => {
    const text = (render(review(), true).nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('Aceitar convite');
  });
});

describe('InterviewSectionComponent — dispensar a entrevista (equipe)', () => {
  let reviewApi: Record<string, jest.Mock>;
  let dialogOpen: jest.Mock;

  function render(r: Review, confirm = true) {
    dialogOpen = jest.fn().mockReturnValue({ afterClosed: () => of(confirm) });
    TestBed.configureTestingModule({
      imports: [InterviewSectionComponent],
      providers: [
        { provide: ReviewApiService, useValue: reviewApi },
        { provide: ApiService, useValue: {} },
        { provide: SessionService, useValue: { user: signal({ timeZone: 'America/Sao_Paulo' }) } },
        { provide: MatDialog, useValue: { open: dialogOpen } },
      ],
    });
    const fixture = TestBed.createComponent(InterviewSectionComponent);
    fixture.componentRef.setInput('review', r);
    fixture.componentRef.setInput('team', true);
    fixture.detectChanges();
    return fixture;
  }

  const booked = {
    appointmentId: 900,
    availabilityId: 77,
    date: '2026-11-20',
    startTime: '15:00:00',
    endTime: '16:00:00',
    timeZone: 'Europe/Lisbon',
    host: 'Luane Bastos',
    modality: 'REMOTE' as const,
    done: false,
  };

  beforeEach(() => {
    reviewApi = {
      interviewSlots: jest.fn().mockReturnValue(of([])),
      waiveInterview: jest.fn().mockReturnValue(of(review({ stage: 'PUBLISHED' }))),
    };
  });

  it('à espera do agendamento, dispensa depois de confirmar e publica', () => {
    const fixture = render(review({ interviewInvitation: null }));
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Dispensar entrevista · Publicar');
    const changed = jest.fn();
    fixture.componentInstance.changed.subscribe(changed);

    fixture.componentInstance.waive();

    expect(dialogOpen.mock.calls[0][1].data.message).not.toContain('cancelada');
    expect(reviewApi['waiveInterview']).toHaveBeenCalledWith(12);
    expect(changed).toHaveBeenCalled();
  });

  it('com a entrevista marcada, avisa que ela é cancelada', () => {
    const fixture = render(review({ stage: 'INTERVIEW_BOOKED', interview: booked, interviewInvitation: null }));
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Dispensar entrevista · Publicar');

    fixture.componentInstance.waive();

    expect(dialogOpen.mock.calls[0][1].data.message).toContain('A entrevista marcada é cancelada.');
    expect(reviewApi['waiveInterview']).toHaveBeenCalledWith(12);
  });

  it('sem confirmar, nada acontece', () => {
    render(review({ interviewInvitation: null }), false).componentInstance.waive();
    expect(reviewApi['waiveInterview']).not.toHaveBeenCalled();
  });

  it('dispensada, mostra quem dispensou e não procura horários', () => {
    const text = (render(review({
      stage: 'PUBLISHED',
      interviewInvitation: null,
      interviewWaiver: { at: '2026-11-13T10:00:00Z', by: 'Equipa' },
    })).nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Entrevista dispensada');
    expect(text).toContain('Por Equipa em 13 de novembro de 2026');
    expect(text).not.toContain('Aguardando agendamento');
    expect(reviewApi['interviewSlots']).not.toHaveBeenCalled();
  });
});
