import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { ActivatedRoute, Navigation, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { ageFrom, DashboardClientRecordComponent } from './dashboard-client-record.component';
import { ApiService } from '../../../core/services/api.service';
import { SessionService } from '../../services/session.service';
import { ClientRecord } from '../../models/client-record.model';
import { Appointment } from '../../models/appointment.model';
import { DayOfWeek } from '../../enums/day-of-week.enum';
import { Modality } from '../../enums/modality.enum';

/**
 * O prontuário mostra instantes (datas das notas, próxima sessão) a quem
 * atende, que pode estar noutro fuso de quem marcou. Par São Paulo/Lisboa de
 * propósito — ver session-list.util.spec.ts para o porquê.
 */
const SAO_PAULO = 'America/Sao_Paulo';
const LISBON = 'Europe/Lisbon';
const CLIENT_ID = 20;
const ME = 10;

function makeRecord(overrides: Partial<ClientRecord> = {}): ClientRecord {
  return {
    client: {
      id: CLIENT_ID,
      name: 'Ana Souza',
      email: 'ana@example.com',
      birthDate: '1990-01-16',
      timeZone: SAO_PAULO,
    },
    intakes: [],
    pendingIntake: { reason: true, clinicalHistory: true },
    notes: [{
      id: 1,
      author: { id: ME, name: 'Luane Bastos' },
      visibility: 'SHARED',
      body: 'Primeira sessão.',
      // 01:30 UTC — 22:30 do dia anterior em São Paulo, 01:30 em Lisboa (inverno).
      createdAt: '2026-01-16T01:30:00Z',
      mine: true,
      addenda: [],
    }],
    ...overrides,
  };
}

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 1,
    professionalId: ME,
    professionalName: 'Luane Bastos',
    clientId: CLIENT_ID,
    availabilityId: 30,
    professionalServiceId: 1,
    modality: Modality.REMOTE,
    startDate: '2026-01-15',
    endDate: '2026-01-15',
    startTime: '22:00',
    endTime: '23:00',
    isRecurring: false,
    dayOfWeek: DayOfWeek.THURSDAY,
    timeZone: SAO_PAULO,
    status: 'CONFIRMED',
    ...overrides,
  };
}

describe('DashboardClientRecordComponent — instantes no fuso de quem vê', () => {
  let fixture: ComponentFixture<DashboardClientRecordComponent>;
  let component: DashboardClientRecordComponent;
  let apiService: Record<string, jest.Mock>;

  async function setup(viewerTimeZone: string, appointments: Appointment[], record = makeRecord()) {
    apiService = {
      getClientRecord: jest.fn().mockReturnValue(of(record)),
      getProfessionalAppointments: jest.fn().mockReturnValue(of(appointments)),
      getServices: jest.fn().mockReturnValue(of([])),
      addClientRecordNote: jest.fn().mockReturnValue(of(record)),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardClientRecordComponent],
      providers: [
        { provide: ApiService, useValue: apiService },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ clientId: String(CLIENT_ID) }) } } },
      ],
    }).compileComponents();

    TestBed.inject(SessionService).setUser({
      id: ME,
      email: 'luane@example.com',
      roles: ['PROFESSIONAL'],
      profileCompleted: true,
      timeZone: viewerTimeZone,
    });

    fixture = TestBed.createComponent(DashboardClientRecordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    // Só o relógio é falso — os timers reais continuam para o TestBed.
    jest.useFakeTimers({ doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'queueMicrotask', 'nextTick'] });
    jest.setSystemTime(new Date('2026-01-10T12:00:00Z'));
  });

  afterEach(() => jest.useRealTimers());

  it('próxima sessão marcada às 22:00 em São Paulo é o instante 01:00 UTC do dia seguinte (inverno)', async () => {
    await setup(LISBON, [makeAppointment()]);
    expect(component.sessionStats().nextAt?.toISOString()).toBe('2026-01-16T01:00:00.000Z');
    expect(component.sessionStats().done).toBe(0);
  });

  it('em julho a mesma hora de parede é outro instante — Lisboa muda de offset, São Paulo não', async () => {
    jest.setSystemTime(new Date('2026-07-01T12:00:00Z'));
    await setup(LISBON, [makeAppointment({ startDate: '2026-07-16', endDate: '2026-07-16' })]);
    // 22:00 em São Paulo (UTC-3) = 01:00 UTC = 02:00 em Lisboa (UTC+1).
    expect(component.sessionStats().nextAt?.toISOString()).toBe('2026-07-17T01:00:00.000Z');
    expect(fixture.nativeElement.textContent).toContain('02:00');
  });

  it('a próxima sessão aparece às 01:00 para quem vê de Lisboa', async () => {
    await setup(LISBON, [makeAppointment()]);
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('16 de janeiro');
    expect(text).toContain('01:00');
  });

  it('a mesma sessão aparece às 22:00 do dia 15 para quem vê de São Paulo', async () => {
    await setup(SAO_PAULO, [makeAppointment()]);
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('15 de janeiro');
    expect(text).toContain('22:00');
  });

  it('a data da nota segue o fuso de quem vê: 22:30 do dia 15 em São Paulo', async () => {
    await setup(SAO_PAULO, []);
    expect(fixture.nativeElement.querySelector('.note .when').textContent).toContain('22:30');
    expect(fixture.nativeElement.querySelector('.note .when').textContent).toContain('15 de janeiro');
  });

  it('e 01:30 do dia 16 em Lisboa', async () => {
    await setup(LISBON, []);
    expect(fixture.nativeElement.querySelector('.note .when').textContent).toContain('01:30');
    expect(fixture.nativeElement.querySelector('.note .when').textContent).toContain('16 de janeiro');
  });

  it('só conta marcações desta pessoa cliente', async () => {
    await setup(LISBON, [
      makeAppointment({ startDate: '2026-01-05', endDate: '2026-01-05' }),
      makeAppointment({ id: 2, clientId: 99, startDate: '2026-01-06', endDate: '2026-01-06' }),
    ]);
    expect(component.sessionStats().done).toBe(1);
  });

  it('data de nascimento é uma data sem fuso — nunca recua um dia em São Paulo', async () => {
    await setup(SAO_PAULO, []);
    expect(component.birthDateLabel()).toBe('16/01/1990');
  });

  it('só envia motivo/historial que ainda estavam pendentes', async () => {
    await setup(LISBON, [], makeRecord({ pendingIntake: { reason: false, clinicalHistory: true } }));
    component.noteBody.set('Sessão 2');
    component.reasonDraft.set('não devia ir');
    component.clinicalHistoryDraft.set('Asma');
    component.saveNote();
    expect(apiService['addClientRecordNote']).toHaveBeenCalledWith(CLIENT_ID, {
      body: 'Sessão 2',
      visibility: 'SHARED',
      reason: undefined,
      clinicalHistory: 'Asma',
    });
  });
});

describe('ageFrom', () => {
  it('ainda não fez anos este ano', () => {
    expect(ageFrom('1990-01-16', new Date(2026, 0, 15))).toBe(35);
  });

  it('faz anos hoje', () => {
    expect(ageFrom('1990-01-16', new Date(2026, 0, 16))).toBe(36);
  });

  it('sem data', () => {
    expect(ageFrom(null)).toBeNull();
  });
});

describe('DashboardClientRecordComponent — Voltar', () => {
  let fixture: ComponentFixture<DashboardClientRecordComponent>;

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [DashboardClientRecordComponent],
      providers: [
        {
          provide: ApiService,
          useValue: {
            getClientRecord: jest.fn().mockReturnValue(of(makeRecord())),
            getProfessionalAppointments: jest.fn().mockReturnValue(of([])),
            getServices: jest.fn().mockReturnValue(of([])),
          },
        },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ clientId: String(CLIENT_ID) }) } } },
      ],
    }).compileComponents();
    TestBed.inject(SessionService).setUser({
      id: ME, email: 'luane@example.com', roles: ['PROFESSIONAL'], profileCompleted: true, timeZone: LISBON,
    });
    fixture = TestBed.createComponent(DashboardClientRecordComponent);
    fixture.detectChanges();
  }

  const backLink = () => fixture.nativeElement.querySelector('.back-link') as HTMLAnchorElement;

  afterEach(() => jest.restoreAllMocks());

  it('aponta para a lista de Clientes — e não para dashboard%2Fclientes, que caía na página inicial', async () => {
    await setup();
    expect(backLink().getAttribute('href')).toBe('/dashboard/clientes');
  });

  it('aberto diretamente (sem página anterior na app), segue para a lista', async () => {
    await setup();
    const back = jest.spyOn(TestBed.inject(Location), 'back');
    const navigate = jest.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    backLink().click();

    expect(back).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalled();
    expect(String(navigate.mock.calls[0][0])).toBe('/dashboard/clientes');
  });

  it('vindo de outra página da app, volta para ela', async () => {
    jest.spyOn(Router.prototype, 'lastSuccessfulNavigation', 'get').mockReturnValue({} as Navigation);
    await setup();
    const back = jest.spyOn(TestBed.inject(Location), 'back').mockImplementation(() => {});
    const navigate = jest.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    backLink().click();

    expect(back).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});

