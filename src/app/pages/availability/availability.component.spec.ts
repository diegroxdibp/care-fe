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

  it('atualiza o painel e a grelha logo depois de retirar', () => {
    const block = component.blocks()[0];
    expect(component.hasPendingProposal(block)).toBe(true);

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
    // Nada foi pedido de novo ao servidor: é o estado local que se atualiza.
    expect(apiService['getProfessionalAppointments']).toHaveBeenCalledTimes(1);
  });
});
