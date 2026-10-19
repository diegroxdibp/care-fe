import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { CoProfessionalRequestPageComponent } from './co-professional-request-page.component';
import { ApiService } from '../../../core/services/api.service';
import { SessionService } from '../../services/session.service';
import { SnackbarService } from '../../services/snackbar.service';
import { CoProfessionalRequest } from '../../models/co-professional.model';

/** O pedido de outra pessoa profissional: hora no fuso de quem vê, e só a convidada responde. */
describe('CoProfessionalRequestPageComponent', () => {
  const REQUEST: CoProfessionalRequest = {
    id: 800, fromProfessionalId: 1, fromProfessionalName: 'Luane', toProfessionalId: 2, toProfessionalName: 'Marta',
    availabilityId: 20, fromDate: '2026-07-16', untilDate: '2026-07-16', status: 'PENDING',
    dayOfWeek: 'THURSDAY', startTime: '18:00:00', endTime: '19:30:00', timeZone: 'Europe/Lisbon',
    isRecurring: true, recurrenceFrequency: 'WEEKLY', format: 'GROUP',
    // 18:00 em Lisboa em julho (UTC+1) = 17:00 UTC = 14:00 em São Paulo.
    fromAt: '2026-07-16T17:00:00Z',
  };

  function open(userId: number, zone: string) {
    const api = {
      getCoProfessionalRequest: jest.fn().mockReturnValue(of(REQUEST)),
      respondToCoProfessionalRequest: jest.fn().mockReturnValue(of({ ...REQUEST, status: 'ACCEPTED' })),
    };
    const router = { navigate: jest.fn() };
    TestBed.configureTestingModule({
      imports: [CoProfessionalRequestPageComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: Router, useValue: router },
        { provide: SnackbarService, useValue: { openSnackBar: jest.fn() } },
        { provide: MatDialog, useValue: { open: jest.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '800' }) } } },
      ],
    });
    TestBed.inject(SessionService).setUser({
      id: userId, email: 'x@example.com', roles: ['PROFESSIONAL'], profileCompleted: true, timeZone: zone,
    });
    const fixture = TestBed.createComponent(CoProfessionalRequestPageComponent);
    fixture.detectChanges();
    return { fixture, api, router };
  }

  const text = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent ?? '';

  it('mostra a hora no fuso de quem vê (São Paulo, julho)', () => {
    const { fixture } = open(2, 'America/Sao_Paulo');
    expect(text(fixture)).toContain('14:00');
    expect(text(fixture)).toContain('Dia e horário');
  });

  it('a convidada aceita e vai para a Disponibilidade', () => {
    const { fixture, api, router } = open(2, 'Europe/Lisbon');
    const accept = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'))
      .find(b => b.textContent?.includes('Aceitar'))!;
    accept.click();
    expect(api.respondToCoProfessionalRequest).toHaveBeenCalledWith(800, true);
    expect(router.navigate).toHaveBeenCalledWith(['/availability']);
  });

  it('quem enviou vê o pedido mas não responde', () => {
    const { fixture } = open(1, 'Europe/Lisbon');
    expect(text(fixture)).toContain('Este pedido é para outra pessoa profissional.');
    expect(Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'))
      .some(b => b.textContent?.includes('Aceitar'))).toBe(false);
  });
});
