import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { RescheduleConfirmComponent } from './reschedule-confirm.component';
import { ApiService } from '../../../core/services/api.service';
import { SessionService } from '../../services/session.service';
import { RescheduleRequest } from '../../models/reschedule-request.model';

/**
 * A pessoa cliente decide aceitar/recusar um pedido de reagendamento vendo
 * duas ocorrências — a atual e a proposta — cada uma combinada no fuso de
 * quem a escreveu, e cada uma precisa de ser convertida para o fuso da
 * pessoa cliente antes de ela decidir.
 */
const SAO_PAULO = 'America/Sao_Paulo';
const LISBON = 'Europe/Lisbon';

function makeRequest(overrides: Partial<RescheduleRequest> = {}): RescheduleRequest {
  return {
    id: 5,
    appointmentId: 1,
    professionalId: 10,
    professionalName: 'Luane Bastos',
    clientId: 20,
    clientName: 'Diego Braga Ponte',
    professionalServiceId: 1,
    occurrenceDate: '2026-01-15', // quinta-feira, São Paulo 22:00
    currentStartTime: '22:00:00',
    currentEndTime: '23:00:00',
    currentTimeZone: SAO_PAULO,
    appointmentIsRecurring: false,
    proposedAvailabilityId: 2,
    proposedDate: '2026-01-22', // quinta-feira seguinte, já num horário de Lisboa
    proposedStartTime: '14:00:00',
    proposedEndTime: '15:00:00',
    proposedTimeZone: LISBON,
    proposedModality: 'REMOTE',
    reason: 'Imprevisto',
    requestedById: 10,
    requestedByName: 'Luane Bastos',
    status: 'PENDING',
    createdAt: '2026-01-10T12:00:00Z',
    ...overrides,
  };
}

describe('RescheduleConfirmComponent', () => {
  let fixture: ComponentFixture<RescheduleConfirmComponent>;
  let component: RescheduleConfirmComponent;

  async function setup(request: RescheduleRequest, viewerTimeZone: string) {
    const apiService = {
      getRescheduleRequest: jest.fn().mockReturnValue(of(request)),
      getServices: jest.fn().mockReturnValue(of([])),
    };

    await TestBed.configureTestingModule({
      imports: [RescheduleConfirmComponent],
      providers: [
        { provide: ApiService, useValue: apiService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: String(request.id) }) } },
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

    fixture = TestBed.createComponent(RescheduleConfirmComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('converte a ocorrência atual (São Paulo) e a proposta (Lisboa) cada uma no seu próprio fuso, ambas para quem vê de Lisboa', async () => {
    await setup(makeRequest(), LISBON);

    // Atual: 22:00 em São Paulo em janeiro → 01:00 do dia seguinte em Lisboa.
    expect(component.currentLabel()).toBe('Sexta, 16 de janeiro · 01:00–02:00');

    // Proposta: já está em Lisboa (14:00), então não muda ao ser vista de lá.
    expect(component.proposedLabel()).toBe('Quinta, 22 de janeiro · 14:00–15:00');
  });

  it('vista de São Paulo, é a proposta (em Lisboa) que agora precisa de conversão, não a atual', async () => {
    await setup(makeRequest(), SAO_PAULO);

    // Atual já está no fuso de quem vê — sem mudança.
    expect(component.currentLabel()).toBe('Quinta, 15 de janeiro · 22:00–23:00');

    // Proposta: 14:00 em Lisboa em janeiro (UTC+0) → 11:00 em São Paulo (UTC-3), mesmo dia.
    expect(component.proposedLabel()).toBe('Quinta, 22 de janeiro · 11:00–12:00');
  });

  it('sem fuso de origem numa das ocorrências (dados antigos), essa ocorrência cai na hora crua sem afetar a outra', async () => {
    await setup(makeRequest({ currentTimeZone: undefined }), LISBON);

    expect(component.currentLabel()).toBe('Quinta, 15 de janeiro · 22:00–23:00');
    expect(component.proposedLabel()).toBe('Quinta, 22 de janeiro · 14:00–15:00');
  });
});
