import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { ApiService } from '../core/services/api.service';
import { RescheduleConfirmComponent } from './components/reschedule-confirm/reschedule-confirm.component';
import { Appointment } from './models/appointment.model';
import { AvailabilityModel } from './models/availability.model';
import { ProfessionalService } from './models/professional-service.model';
import { RescheduleRequest } from './models/reschedule-request.model';
import { DayOfWeek } from './enums/day-of-week.enum';
import { Modality } from './enums/modality.enum';
import { Currency } from './enums/currency.enum';
import { SessionService } from './services/session.service';
import { freeSlotsOn } from './utils/free-slots.util';
import { rescheduleRequestAsAppointment } from './utils/reschedule-request.util';
import { buildSessions, SessionViewerPerspective } from './utils/session-list.util';
import { zonedWallTimeToInstant } from './utils/timezones.util';

/**
 * A mesma sessão tem de ser o mesmo instante em todos os ecrãs, dos dois lados.
 *
 * Cada ecrã tinha o seu próprio teste de conversão, e todos passavam, mas
 * nenhum teste comparava os ecrãs entre si. Em out. 2026 a pessoa
 * profissional via 11:00 e a pessoa cliente 11:30 para "a mesma" sessão, e
 * nada no conjunto de testes dizia se isso podia ou não acontecer. Aqui cada
 * hora mostrada é lida de volta como instante, no fuso de quem a vê, e tem
 * de coincidir com a hora combinada. Pares São Paulo/Lisboa em janeiro e em
 * julho (ver o teste de timezones.util).
 */
export const SAO_PAULO = 'America/Sao_Paulo';
export const LISBON = 'Europe/Lisbon';
const ZONES = [LISBON, SAO_PAULO];

const MONTHS_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto',
  'setembro', 'outubro', 'novembro', 'dezembro'];

interface Scenario {
  name: string;
  /** Onde estão as vagas (o fuso em que a sessão e o destino foram combinados). */
  slotZone: string;
  /** A sessão como está, e o destino do pedido: o caso de out. 2026, 15:30 → 11:00 no mesmo dia. */
  date: string;
  current: [string, string];
  proposed: [string, string];
}

const SCENARIOS: Scenario[] = [
  { name: 'vagas em Lisboa, verão (GMT+1)', slotZone: LISBON, date: '2027-07-15',
    current: ['15:30', '16:30'], proposed: ['11:00', '12:00'] },
  { name: 'vagas em Lisboa, inverno (GMT)', slotZone: LISBON, date: '2027-01-21',
    current: ['15:30', '16:30'], proposed: ['11:00', '12:00'] },
  { name: 'vagas em São Paulo, a cair noutro dia em Lisboa', slotZone: SAO_PAULO, date: '2027-07-15',
    current: ['22:30', '23:30'], proposed: ['20:00', '21:00'] },
];

function instant(dateKey: string, time: string, zone: string): number {
  const at = zonedWallTimeToInstant(dateKey, time, zone);
  if (!at) throw new Error(`não converte: ${dateKey} ${time} ${zone}`);
  return at.getTime();
}

function dateKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "Quinta, 15 de julho · 11:00–12:00" → o instante do início, lido no fuso de quem vê. */
function instantOfLabel(label: string, year: string, zone: string): number {
  const m = label.match(/(\d{1,2}) de (\S+) · (\d{2}:\d{2})/);
  if (!m) throw new Error(`rótulo inesperado: ${label}`);
  const month = MONTHS_PT.indexOf(m[2]) + 1;
  return instant(`${year}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}`, m[3], zone);
}

function appointment(s: Scenario): Appointment {
  return {
    id: 400,
    professionalId: 10,
    professionalName: 'Luane Bastos',
    clientId: 20,
    clientName: 'Ricardo Rabello',
    availabilityId: 20,
    professionalServiceId: 1,
    modality: Modality.REMOTE,
    startDate: s.date,
    endDate: s.date,
    startTime: s.current[0],
    endTime: s.current[1],
    isRecurring: false,
    dayOfWeek: DayOfWeek.THURSDAY,
    timeZone: s.slotZone,
    status: 'CONFIRMED',
  };
}

function request(s: Scenario): RescheduleRequest {
  return {
    id: 1, appointmentId: 400, professionalId: 10, professionalName: 'Luane Bastos',
    clientId: 20, clientName: 'Ricardo Rabello', professionalServiceId: 1,
    occurrenceDate: s.date, currentStartTime: `${s.current[0]}:00`, currentEndTime: `${s.current[1]}:00`,
    currentTimeZone: s.slotZone, appointmentIsRecurring: false,
    proposedAvailabilityId: 21, proposedDate: s.date,
    proposedStartTime: `${s.proposed[0]}:00`, proposedEndTime: `${s.proposed[1]}:00`,
    proposedTimeZone: s.slotZone, proposedModality: 'REMOTE', reason: 'Conflito de agenda.',
    requestedById: 10, requestedByName: 'Luane Bastos', status: 'PENDING', createdAt: '2027-01-01T10:00:00Z',
  };
}

function listedInstant(
  service: ProfessionalService, s: Scenario, perspective: SessionViewerPerspective, viewerZone: string,
): number {
  const [session] = buildSessions([appointment(s)], [service], {
    perspective, currency: Currency.EUR, paymentsEnabled: false, viewerTimeZone: viewerZone,
  });
  const shown = instant(dateKeyOf(session.date), session.startTime, viewerZone);
  // O que a lista mostra e o instante que ela própria usa para entrar na chamada não podem divergir.
  expect(session.startInstant?.getTime()).toBe(shown);
  return shown;
}

async function confirmPageInstants(s: Scenario, viewerZone: string): Promise<{ current: number; proposed: number }> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [RescheduleConfirmComponent],
    providers: [
      {
        provide: ApiService,
        useValue: {
          getRescheduleRequest: jest.fn().mockReturnValue(of(request(s))),
          getServices: jest.fn().mockReturnValue(of([])),
        },
      },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '1' }) } } },
    ],
  }).compileComponents();
  TestBed.inject(SessionService).setUser({
    email: 'ricardo@example.com', roles: ['USER'], profileCompleted: true, timeZone: viewerZone,
  });
  const fixture = TestBed.createComponent(RescheduleConfirmComponent);
  fixture.detectChanges();
  const year = s.date.slice(0, 4);
  return {
    current: instantOfLabel(fixture.componentInstance.currentLabel(), year, viewerZone),
    proposed: instantOfLabel(fixture.componentInstance.proposedLabel(), year, viewerZone),
  };
}

/** Regista os testes; cada spec dá o serviço no formato do modelo do seu ramo. */
export function describeSessionConsistency(service: ProfessionalService): void {
describe('a mesma sessão é o mesmo instante em todos os ecrãs', () => {
  for (const s of SCENARIOS) {
    describe(s.name, () => {
      const currentAt = instant(s.date, s.current[0], s.slotZone);
      const proposedAt = instant(s.date, s.proposed[0], s.slotZone);

      for (const viewer of ZONES) {
        it(`a pessoa cliente em ${viewer}: painel e página do pedido dizem a mesma coisa`, async () => {
          const page = await confirmPageInstants(s, viewer);

          expect(listedInstant(service, s, 'CLIENT', viewer)).toBe(currentAt);
          expect(page.current).toBe(currentAt);
          expect(page.proposed).toBe(proposedAt);
        });

        it(`a pessoa profissional em ${viewer}: painel e diálogo de reagendamento no mesmo instante`, () => {
          expect(listedInstant(service, s, 'PROFESSIONAL', viewer)).toBe(currentAt);

          const slot = {
            id: 21, startDate: '2026-01-01', isRecurring: true, dayOfWeek: 'THURSDAY',
            recurrenceFrequency: 'WEEKLY', startTime: `${s.proposed[0]}:00`, endTime: `${s.proposed[1]}:00`,
            modality: 'REMOTE', timeZone: s.slotZone, services: [{ id: service.id }], bookedDates: [],
          } as unknown as AvailabilityModel;
          const [offered] = freeSlotsOn([slot], s.date, service.id, { viewerTimeZone: viewer });
          // O que segue para a API é a hora da vaga; o que se mostra, a mesma hora no fuso de quem escolhe.
          expect(instant(s.date, offered.startTime, s.slotZone)).toBe(proposedAt);
          const shownDay = new Date(proposedAt).toLocaleDateString('sv-SE', { timeZone: viewer });
          expect(instant(shownDay, offered.displayStartTime!, viewer)).toBe(proposedAt);
        });
      }

      it('o destino reservado na agenda é o instante que a pessoa cliente vê como proposta', async () => {
        const hold = rescheduleRequestAsAppointment(request(s));
        const heldAt = instant(hold.startDate, hold.startTime, hold.timeZone!);

        expect(heldAt).toBe(proposedAt);
        for (const viewer of ZONES) {
          expect((await confirmPageInstants(s, viewer)).proposed).toBe(heldAt);
        }
      });
    });
  }
});
}
