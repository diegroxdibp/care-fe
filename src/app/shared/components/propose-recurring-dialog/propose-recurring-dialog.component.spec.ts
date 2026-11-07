import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';

import { ApiService } from '../../../core/services/api.service';
import { ReviewApiService } from '../../../core/services/review-api.service';
import { Modality } from '../../enums/modality.enum';
import { RecurrenceFrequency } from '../../enums/recurrence-frequency.enum';
import { AvailabilityModel } from '../../models/availability.model';
import { ProposeRecurringDialogComponent, ProposeRecurringDialogData } from './propose-recurring-dialog.component';

/** Uma vaga semanal às terças, com a Entrevista e a Psicoterapia. */
const slot = {
  id: 90,
  professionalId: 1,
  professionalName: 'Luane',
  startDate: '2026-11-10',
  endDate: '2100-01-01',
  startTime: '10:00:00',
  endTime: '11:00:00',
  isRecurring: true,
  dayOfWeek: 'TUESDAY',
  recurrenceFrequency: 'WEEKLY',
  bookedDates: [],
  modality: 'REMOTE',
  timeZone: 'Europe/Lisbon',
} as unknown as AvailabilityModel;

function open(services: ProposeRecurringDialogData['services']) {
  const close = jest.fn();
  const reviewApi = {
    interviewInvitees: jest.fn().mockReturnValue(of([{ userId: 7, name: 'João Lima' }])),
  };
  const api = { getPatients: jest.fn().mockReturnValue(of([{ id: 3, name: 'Ash Barros' }])) };
  TestBed.configureTestingModule({
    imports: [ProposeRecurringDialogComponent],
    providers: [
      { provide: MatDialogRef, useValue: { close } },
      { provide: ApiService, useValue: api },
      { provide: ReviewApiService, useValue: reviewApi },
      {
        provide: MAT_DIALOG_DATA,
        useValue: {
          professionalId: 1,
          services,
          slotModality: Modality.REMOTE,
          dayLabel: 'Terça-feira',
          timeLabel: '10:00–11:00',
          slotRecurrenceFrequency: RecurrenceFrequency.WEEKLY,
          slotIsRecurring: true,
          slotPrice: 60,
          slotAvailability: slot,
        } as ProposeRecurringDialogData,
      },
    ],
  });
  const fixture = TestBed.createComponent(ProposeRecurringDialogComponent);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, close, reviewApi };
}

describe('ProposeRecurringDialogComponent — convite para a entrevista', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-11-07T12:00:00Z'), doNotFake: ['setTimeout', 'queueMicrotask', 'nextTick'] });
  });
  afterEach(() => jest.useRealTimers());

  it('numa vaga só com a Entrevista, convida quem está à espera dela, para uma data, sem valor nem mensagem', () => {
    const { fixture, component, close } = open([{ id: 30, name: 'Entrevista', interview: true }]);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(component.isInterview()).toBe(true);
    expect(component.kind()).toBe('DATE');
    expect(text).toContain('Convidar para a entrevista');
    expect(text).not.toContain('Valor em Euro');
    expect(text).not.toContain('Mensagem');
    expect(text).not.toContain('Outro email');
    expect(component.inviteeOptions()).toEqual([{ value: '7', label: 'João Lima' }]);

    component.selectedClientId.set(7);
    component.submit();
    expect(close).toHaveBeenCalledWith({
      kind: 'DATE',
      professionalServiceId: 30,
      clientId: 7,
      modality: Modality.REMOTE,
      address: undefined,
      startDate: '2026-11-10',
    });
  });

  it('numa vaga com outros serviços, trocar para a Entrevista troca a lista e larga a escolha anterior', () => {
    const { component, reviewApi } = open([
      { id: 31, name: 'Psicoterapia' },
      { id: 30, name: 'Entrevista', interview: true },
    ]);
    expect(component.isInterview()).toBe(false);
    expect(reviewApi.interviewInvitees).not.toHaveBeenCalled();
    component.selectedClientId.set(3);

    component.selectService(30);
    expect(component.isInterview()).toBe(true);
    expect(component.kind()).toBe('DATE');
    expect(component.selectedClientId()).toBeNull();
    expect(reviewApi.interviewInvitees).toHaveBeenCalledTimes(1);
  });
});
