import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { DashboardPageComponent } from './dashboard.component';
import { ApiService } from '../../core/services/api.service';
import { SessionService } from '../../shared/services/session.service';
import { AuthService } from '../../auth/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { MessageService } from '../../core/services/message.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { FeatureFlagService } from '../../shared/services/feature-flag.service';
import { Appointment } from '../../shared/models/appointment.model';
import { DayOfWeek } from '../../shared/enums/day-of-week.enum';
import { Modality } from '../../shared/enums/modality.enum';

/**
 * A proposta, o pedido de reagendamento, "minhas sessões" e as mensagens abrem
 * dentro do painel: o componente do painel não é recriado ao voltar. Aceitar
 * uma proposta e voltar tem de mostrar a série como aceita, sem recarregar.
 */
@Component({ standalone: true, template: '' })
class ChildPageStub {}

function proposal(status: Appointment['status']): Appointment {
  return {
    id: 83,
    professionalId: 10,
    professionalName: 'Luane Bastos',
    clientId: 20,
    availabilityId: 30,
    professionalServiceId: 1,
    modality: Modality.REMOTE,
    startDate: '2099-01-15',
    endDate: '2099-12-31',
    startTime: '10:00:00',
    endTime: '11:00:00',
    isRecurring: true,
    dayOfWeek: DayOfWeek.THURSDAY,
    recurrenceFrequency: 'WEEKLY',
    timeZone: 'America/Sao_Paulo',
    status,
  };
}

describe('DashboardPageComponent — voltar de uma página do painel', () => {
  let api: { getUserAppointments: jest.Mock; getServices: jest.Mock };
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    api = {
      getUserAppointments: jest.fn().mockReturnValue(of([proposal('PENDING')])),
      getServices: jest.fn().mockReturnValue(of([])),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardPageComponent],
      providers: [
        provideRouter([
          {
            path: 'dashboard',
            component: DashboardPageComponent,
            children: [
              { path: 'proposals/:id', component: ChildPageStub },
              { path: 'messages', component: ChildPageStub },
            ],
          },
        ]),
        { provide: ApiService, useValue: api },
        {
          provide: SessionService,
          useValue: { user: () => ({ email: 'carolina@example.com', name: 'Carolina', timeZone: 'America/Sao_Paulo' }) },
        },
        { provide: AuthService, useValue: { logout: jest.fn() } },
        { provide: NotificationService, useValue: { unreadCount: () => 0, notifications: () => [] } },
        { provide: MessageService, useValue: { unreadCount: () => 0 } },
        { provide: SnackbarService, useValue: { openSnackBar: jest.fn() } },
        { provide: FeatureFlagService, useValue: { paymentsEnabled: () => false } },
        { provide: MatDialog, useValue: { open: jest.fn() } },
      ],
    })
      .overrideComponent(DashboardPageComponent, { set: { template: '<router-outlet />' } })
      .compileComponents();

    harness = await RouterTestingHarness.create();
  });

  async function open(url: string, state?: Record<string, unknown>) {
    // O harness não passa state; "Ver sessão" usa router.navigate com state.
    await TestBed.inject(Router).navigateByUrl(url, state ? { state } : undefined);
    harness.detectChanges();
  }

  /** O painel que o router montou — o mesmo que fica vivo entre as páginas. */
  function dashboard(): DashboardPageComponent {
    return harness.fixture.debugElement.query(By.directive(DashboardPageComponent)).componentInstance;
  }

  it('mostra a série como aceita ao voltar da proposta', async () => {
    await open('/dashboard/proposals/83');
    const component = dashboard();
    expect(component.appointments()[0].status).toBe('PENDING');

    // A página da proposta aceita e manda de volta para o painel.
    api.getUserAppointments.mockReturnValue(of([proposal('CONFIRMED')]));
    await open('/dashboard');

    expect(component.appointments()[0].status).toBe('CONFIRMED');
  });

  it('não lê a agenda duas vezes ao abrir o painel', async () => {
    await open('/dashboard');

    expect(api.getUserAppointments).toHaveBeenCalledTimes(1);
  });

  it('"Ver sessão" nas Mensagens abre a sessão pedida ao voltar', async () => {
    await open('/dashboard/messages');
    const component = dashboard();

    await open('/dashboard', { openAppointmentId: 83 });

    expect(component.openSessionId()).toBe(83);
  });
});
