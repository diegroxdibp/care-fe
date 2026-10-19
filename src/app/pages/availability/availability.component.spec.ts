import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { AvailabilityComponent } from './availability.component';
import { ApiService } from '../../core/services/api.service';
import { AvailabilityModel } from '../../shared/models/availability.model';
import { Appointment } from '../../shared/models/appointment.model';
import { ScreenSizeService } from '../../shared/services/screen-size.service';
import { SessionService } from '../../shared/services/session.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { SchedulingService } from '../../shared/services/scheduling.service';
import { DayOfWeek } from '../../shared/enums/day-of-week.enum';
import { Modality } from '../../shared/enums/modality.enum';
import { invitationAsAppointment } from '../../shared/utils/invitation.util';
import { Invitation } from '../../shared/models/invitation.model';

const LISBON = 'Europe/Lisbon';
const ME = 2;

/** A vaga de quinta às 17h, como em produção (vaga 478). */
const thursdaySlot: AvailabilityModel = {
  id: 478,
  professionalId: ME,
  professionalName: 'Dr. Teste',
  startDate: '2026-09-03',
  endDate: '2100-01-01',
  startTime: '17:00:00',
  endTime: '18:00:00',
  isRecurring: true,
  dayOfWeek: 'THURSDAY' as unknown as DayOfWeek,
  recurrenceFrequency: 'WEEKLY',
  bookedDates: [],
  modality: 'ANY',
  timeZone: LISBON,
} as AvailabilityModel;

function appointment(overrides: Partial<Appointment>): Appointment {
  return {
    id: 74,
    professionalId: ME,
    professionalName: 'Dr. Teste',
    clientId: 20,
    clientName: 'Ash Barros',
    availabilityId: 478,
    professionalServiceId: 1,
    modality: Modality.REMOTE,
    startDate: '2026-09-17',
    endDate: '2100-01-01',
    startTime: '17:00:00',
    endTime: '18:00:00',
    isRecurring: true,
    recurrenceFrequency: 'WEEKLY',
    dayOfWeek: 'THURSDAY' as unknown as DayOfWeek,
    status: 'CONFIRMED',
    ...overrides,
  } as Appointment;
}

/**
 * Retirar uma alteração de série a partir do painel da série tem de se ver
 * logo — no painel e na grelha — sem recarregar a página.
 */
describe('AvailabilityComponent — retirar uma alteração de série', () => {
  let fixture: ComponentFixture<AvailabilityComponent>;
  let component: AvailabilityComponent;
  let apiService: Record<string, jest.Mock>;

  const series = appointment({ id: 74 });
  // Quinzenal a partir de 15/10 às 17h, sem resposta - já expirou no dia 16.
  const expiredChange = appointment({
    id: 83,
    startDate: '2026-10-15',
    recurrenceFrequency: 'BIWEEKLY',
    status: 'PENDING',
    replacesAppointmentId: 74,
    timeZone: LISBON,
  } as Partial<Appointment>);

  beforeEach(async () => {
    jest.useFakeTimers({
      now: new Date('2026-10-16T12:00:00Z'),
      doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval', 'queueMicrotask',
        'requestAnimationFrame', 'cancelAnimationFrame', 'clearTimeout', 'clearInterval'],
    });

    apiService = {
      getServices: jest.fn().mockReturnValue(of([])),
      getAvailabilitiesByProfessionalId: jest.fn().mockReturnValue(of([thursdaySlot])),
      getProfessionalAppointments: jest.fn().mockReturnValue(of([series, expiredChange])),
      deleteAppointment: jest.fn().mockReturnValue(of(null)),
      getSentInvitations: jest.fn().mockReturnValue(of([])),
      withdrawInvitation: jest.fn().mockReturnValue(of(null)),
    };

    await TestBed.configureTestingModule({
      imports: [AvailabilityComponent, NoopAnimationsModule],
      providers: [
        { provide: ApiService, useValue: apiService },
        { provide: SessionService, useValue: { user: signal({ id: ME, timeZone: LISBON }) } },
        { provide: SnackbarService, useValue: { openSnackBar: jest.fn() } },
        { provide: SchedulingService, useValue: {} },
        { provide: MatDialog, useValue: { open: jest.fn().mockReturnValue({ afterClosed: () => of(true) }) } },
        {
          provide: ScreenSizeService,
          useValue: { isMobile: signal(false), isTablet: signal(false), isDesktop: signal(true) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AvailabilityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => jest.useRealTimers());

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function button(label: string): HTMLButtonElement | undefined {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'))
      .find(b => b.textContent?.includes(label));
  }

  it('marca a série com uma alteração ainda por responder', () => {
    component.appointments.update(list =>
      list.map(a => (a.id === 83 ? { ...a, startDate: '2026-10-29' } : a)));
    fixture.detectChanges();

    expect(component.seriesChangeState(series)).toBe('pending');
    expect((fixture.nativeElement as HTMLElement).querySelector('.b-band.pending')).not.toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.change-expired')).toBeNull();
  });

  it('atualiza o painel e a grelha logo depois de retirar', () => {
    const block = component.blocks()[0];
    expect(component.hasPendingProposal(block)).toBe(true);
    // A célula mostra a série; a borda diz que a alteração expirou sem resposta.
    expect(component.seriesChangeState(series)).toBe('expired');
    expect((fixture.nativeElement as HTMLElement).querySelector('.b-band.change-expired')).not.toBeNull();

    component.selectSlot(new Event('click'), series);
    fixture.detectChanges();
    expect(text()).toContain('expirou sem resposta');
    expect(button('Alterar série')).toBeUndefined();

    button('Retirar alteração')!.click();
    fixture.detectChanges();

    expect(apiService['deleteAppointment']).toHaveBeenCalledWith(83);
    expect(component.selectedAppointment()?.id).toBe(74);
    expect(text()).not.toContain('expirou sem resposta');
    expect(button('Retirar alteração')).toBeUndefined();
    expect(button('Alterar série')).toBeDefined();
    expect(component.hasPendingProposal(component.blocks()[0])).toBe(false);
    expect((fixture.nativeElement as HTMLElement).querySelector('.pending')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.change-expired')).toBeNull();
    // Nada foi pedido de novo ao servidor: é o estado local que se atualiza.
    expect(apiService['getProfessionalAppointments']).toHaveBeenCalledTimes(1);
  });

  it('um convite enviado reserva a data como pendente, e retirá-lo liberta-a', () => {
    const invitation = {
      id: 900, token: 't', availabilityId: 478, professionalId: ME, professionalName: 'Dr. Teste',
      clientId: null, clientName: null, invitedEmail: 'nova.pessoa@example.com', kind: 'DATE',
      startDate: '2026-10-15', recurrenceFrequency: null, dayOfWeek: 'THURSDAY',
      startTime: '17:00:00', endTime: '18:00:00', timeZone: LISBON, firstSessionAt: '2026-10-15T16:00:00Z',
      professionalServiceId: 1, serviceName: 'MINDFULNESS', modality: 'REMOTE', status: 'PENDING',
      createdAt: '2026-10-10T10:00:00Z',
    } as Invitation;
    const hold = invitationAsAppointment(invitation);
    component.appointments.set([hold]);
    fixture.detectChanges();

    expect(component.hasPendingProposal(component.blocks()[0])).toBe(true);
    component.selectSlot(new Event('click'), hold);
    fixture.detectChanges();
    expect(text()).toContain('Convite enviado');

    expect(button('Retirar convite')).toBeDefined();
    // Nesta semana de teste a data já passou e o botão fica desativado; a ação é a mesma.
    component.cancelAppointment(hold);
    fixture.detectChanges();

    expect(apiService['withdrawInvitation']).toHaveBeenCalledWith(900);
    expect(component.hasPendingProposal(component.blocks()[0])).toBe(false);
  });
});
