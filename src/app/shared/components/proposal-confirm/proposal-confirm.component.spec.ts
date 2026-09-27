import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { ProposalConfirmComponent } from './proposal-confirm.component';
import { ApiService } from '../../../core/services/api.service';
import { SessionService } from '../../services/session.service';
import { Appointment } from '../../models/appointment.model';
import { DayOfWeek } from '../../enums/day-of-week.enum';
import { Modality } from '../../enums/modality.enum';

/**
 * A pessoa cliente decide aceitar/recusar uma proposta de sessão recorrente
 * vendo appt.startTime/endTime — combinados no relógio da pessoa
 * profissional (appt.timeZone) — no SEU próprio fuso. Sem isso, decide sobre
 * uma hora que não é a sua.
 */
const SAO_PAULO = 'America/Sao_Paulo';
const LISBON = 'Europe/Lisbon';

function makeProposal(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 99,
    professionalId: 10,
    professionalName: 'Luane Bastos',
    clientId: 20,
    availabilityId: 30,
    professionalServiceId: 1,
    modality: Modality.REMOTE,
    startDate: '2026-01-15', // quinta-feira
    endDate: '2026-12-31',
    startTime: '22:00:00',
    endTime: '23:00:00',
    isRecurring: true,
    dayOfWeek: DayOfWeek.THURSDAY,
    recurrenceFrequency: 'WEEKLY',
    timeZone: SAO_PAULO,
    status: 'PENDING',
    ...overrides,
  };
}

describe('ProposalConfirmComponent', () => {
  let fixture: ComponentFixture<ProposalConfirmComponent>;
  let component: ProposalConfirmComponent;
  let apiService: { getAppointmentById: jest.Mock; getServices: jest.Mock };

  async function setup(appt: Appointment, viewerTimeZone: string) {
    apiService = {
      getAppointmentById: jest.fn().mockReturnValue(of(appt)),
      getServices: jest.fn().mockReturnValue(of([])),
    };

    await TestBed.configureTestingModule({
      imports: [ProposalConfirmComponent],
      providers: [
        { provide: ApiService, useValue: apiService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: String(appt.id) }) } },
        },
      ],
    }).compileComponents();

    const sessionService = TestBed.inject(SessionService);
    sessionService.setUser({
      email: 'client@example.com',
      roles: ['USER'],
      profileCompleted: true,
      timeZone: viewerTimeZone,
    });

    fixture = TestBed.createComponent(ProposalConfirmComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('mostra o dia e a hora já convertidos para o fuso da pessoa cliente (Lisboa, inverno europeu)', async () => {
    await setup(makeProposal({ startDate: '2026-01-15', startTime: '22:00:00' }), LISBON);

    // 22:00 em São Paulo, em janeiro (Lisboa em UTC+0), cai às 01:00 do dia
    // seguinte em Lisboa — e o dia da semana muda com ela, de quinta para
    // sexta.
    expect(component.timeLabel()).toBe('01:00–02:00');
    expect(component.dayLabel()).toBe('Sexta-feira');
  });

  it('a mesma proposta em julho (verão europeu) converte para uma hora diferente', async () => {
    await setup(makeProposal({ startDate: '2026-07-16', startTime: '22:00:00' }), LISBON);

    expect(component.timeLabel()).toBe('02:00–03:00');
  });

  it('vista pela própria pessoa profissional (mesmo fuso), a hora não muda', async () => {
    await setup(makeProposal({ startDate: '2026-01-15', startTime: '22:00:00' }), SAO_PAULO);

    expect(component.timeLabel()).toBe('22:00–23:00');
    expect(component.dayLabel()).toBe('Quinta-feira');
  });

  it('sem timeZone na proposta (dados antigos), mostra a hora crua em vez de rebentar', async () => {
    await setup(makeProposal({ timeZone: undefined }), LISBON);

    expect(component.timeLabel()).toBe('22:00–23:00');
  });
});
