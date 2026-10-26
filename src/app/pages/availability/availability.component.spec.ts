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
import { SchedulingFormControls } from '../../shared/enums/scheduling-form-controls.enum';
import { DayOfWeek } from '../../shared/enums/day-of-week.enum';
import { Modality } from '../../shared/enums/modality.enum';
import { RescheduleRequest } from '../../shared/models/reschedule-request.model';
import { rescheduleRequestAsAppointment } from '../../shared/utils/reschedule-request.util';

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
      getSentRescheduleRequests: jest.fn().mockReturnValue(of([])),
      withdrawRescheduleRequest: jest.fn().mockReturnValue(of(null)),
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

  /** Pedido para mover a sessão de 15/10 de outra vaga para as 17h desta (out. 2026). */
  function rescheduleRequest(overrides: Partial<RescheduleRequest> = {}): RescheduleRequest {
    return {
      id: 5, appointmentId: 300, professionalId: ME, professionalName: 'Dr. Teste',
      clientId: 20, clientName: 'Ash Barros', professionalServiceId: 1,
      occurrenceDate: '2026-10-15', currentStartTime: '15:30:00', currentEndTime: '16:30:00',
      currentTimeZone: LISBON, appointmentIsRecurring: false,
      proposedAvailabilityId: 478, proposedDate: '2026-10-15',
      proposedStartTime: '17:00:00', proposedEndTime: '18:00:00', proposedTimeZone: LISBON,
      proposedModality: 'REMOTE', reason: 'Conflito.', requestedById: ME, requestedByName: 'Dr. Teste',
      status: 'PENDING', createdAt: '2026-10-10T10:00:00Z',
      ...overrides,
    };
  }

  it('um pedido de reagendamento reserva o novo horário como pendente, e retirá-lo liberta-o', () => {
    const request = rescheduleRequest();
    const hold = rescheduleRequestAsAppointment(request);
    component.appointments.set([hold]);
    component.rescheduleRequests.set([request]);
    fixture.detectChanges();

    expect(component.hasPendingProposal(component.blocks()[0])).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('.b-band.pending')).not.toBeNull();
    component.selectSlot(new Event('click'), hold);
    fixture.detectChanges();
    expect(text()).toContain('Reagendamento proposto');
    expect(text()).toContain('Novo horário proposto para a sessão de 15/10/2026 às 15:30');
    expect(button('Reagendar sessão')).toBeUndefined();
    expect(button('Convidar para regime periódico')).toBeUndefined();

    component.cancelAppointment(hold);
    fixture.detectChanges();

    expect(apiService['withdrawRescheduleRequest']).toHaveBeenCalledWith(5);
    expect(component.hasPendingProposal(component.blocks()[0])).toBe(false);
    expect(component.rescheduleRequests()).toEqual([]);
  });

  it('a sessão com um pedido em aberto diz para onde vai e não deixa pedir outro', () => {
    component.rescheduleRequests.set([rescheduleRequest({
      appointmentId: 74, proposedAvailabilityId: 999, proposedDate: '2026-10-16', proposedStartTime: '11:00:00',
    })]);
    component.selectSlot(new Event('click'), series);
    fixture.detectChanges();

    expect(text()).toContain('Pedido enviado para mudar esta sessão para 16/10/2026 às 11:00');
    expect(button('Reagendar sessão')).toBeUndefined();
    button('Retirar pedido de reagendamento')!.click();
    fixture.detectChanges();

    expect(apiService['withdrawRescheduleRequest']).toHaveBeenCalledWith(5);
    expect(button('Reagendar sessão')).toBeDefined();
  });

});

/**
 * Antes de pedir para mudar uma sessão ou uma série, a pessoa profissional diz
 * o que acontece ao horário atual: fica livre já, ou reservado até haver
 * resposta. Nenhuma das duas vem escolhida.
 */
describe('AvailabilityComponent — o horário atual ao reagendar ou alterar a série', () => {
  let fixture: ComponentFixture<AvailabilityComponent>;
  let component: AvailabilityComponent;
  let apiService: Record<string, jest.Mock>;
  let dialogAnswers: unknown[];
  let dialogOpen: jest.Mock;

  const series = appointment({ id: 74 });
  const moveTo = {
    availabilityId: 478,
    date: '2026-10-29',
    startTime: '17:00',
    endTime: '18:00',
    modality: Modality.REMOTE,
    reason: 'Congresso.',
  };
  const request: RescheduleRequest = {
    id: 9,
    appointmentId: 74,
    professionalId: ME,
    professionalName: 'Dr. Teste',
    clientId: 20,
    clientName: 'Ash Barros',
    professionalServiceId: 1,
    occurrenceDate: '2026-10-22',
    currentStartTime: '17:00:00',
    currentEndTime: '18:00:00',
    appointmentIsRecurring: true,
    proposedAvailabilityId: 478,
    proposedDate: '2026-10-29',
    proposedStartTime: '17:00:00',
    proposedEndTime: '18:00:00',
    proposedModality: 'REMOTE',
    reason: 'Congresso.',
    requestedById: ME,
    requestedByName: 'Dr. Teste',
    status: 'PENDING',
    createdAt: '2026-10-16T12:00:00Z',
  };

  beforeEach(async () => {
    jest.useFakeTimers({
      now: new Date('2026-10-16T12:00:00Z'),
      doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval', 'queueMicrotask',
        'requestAnimationFrame', 'cancelAnimationFrame', 'clearTimeout', 'clearInterval'],
    });

    apiService = {
      getServices: jest.fn().mockReturnValue(of([])),
      getMyServices: jest.fn().mockReturnValue(of([])),
      getAvailabilitiesByProfessionalId: jest.fn().mockReturnValue(of([thursdaySlot])),
      getProfessionalAppointments: jest.fn().mockReturnValue(of([series])),
      getSentInvitations: jest.fn().mockReturnValue(of([])),
      getCommitments: jest.fn().mockReturnValue(of([])),
      getSentRescheduleRequests: jest.fn().mockReturnValue(of([])),
      requestReschedule: jest.fn().mockReturnValue(of(request)),
      proposeSeriesChange: jest.fn(),
    };
    // Cada diálogo aberto responde, por ordem, com a próxima resposta.
    dialogAnswers = [];
    dialogOpen = jest.fn().mockImplementation(() => {
      const answer = dialogAnswers.shift();
      return { afterClosed: () => of(answer) };
    });

    await TestBed.configureTestingModule({
      imports: [AvailabilityComponent, NoopAnimationsModule],
      providers: [
        { provide: ApiService, useValue: apiService },
        { provide: SessionService, useValue: { user: signal({ id: ME, timeZone: LISBON }) } },
        { provide: SnackbarService, useValue: { openSnackBar: jest.fn() } },
        { provide: SchedulingService, useValue: {} },
        { provide: MatDialog, useValue: { open: dialogOpen } },
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

  /** Os dados do diálogo da escolha (o segundo a abrir). */
  function choiceDialogData(): { choices: { value: string }[] } {
    return dialogOpen.mock.calls[1][1].data;
  }

  it('pergunta, sem nada escolhido, e envia "liberar já" quando é essa a escolha', () => {
    dialogAnswers = [moveTo, 'release'];

    component.openRescheduleDialog(new Event('click'), series);

    expect(choiceDialogData().choices.map(c => c.value)).toEqual(['release', 'keep']);
    expect(apiService['requestReschedule']).toHaveBeenCalledWith(74, expect.objectContaining({ releaseOriginal: true }));
  });

  it('liberado já, a ocorrência atual sai da agenda', () => {
    dialogAnswers = [moveTo, 'release'];

    component.openRescheduleDialog(new Event('click'), series);

    // A data movida é a da semana em vista, não a âncora da série.
    const moved = apiService['requestReschedule'].mock.calls[0][1].occurrenceDate;
    expect(moved).toBe('2026-10-15');
    expect(component.appointments().find(a => a.id === 74)!.excludedDates).toEqual([moved]);
  });

  it('envia "manter reservado" sem tocar na sessão atual', () => {
    dialogAnswers = [moveTo, 'keep'];

    component.openRescheduleDialog(new Event('click'), series);

    expect(apiService['requestReschedule']).toHaveBeenCalledWith(74, expect.objectContaining({ releaseOriginal: false }));
    expect(component.appointments().find(a => a.id === 74)!.excludedDates ?? []).toEqual([]);
  });

  it('voltar atrás na escolha não envia nada', () => {
    dialogAnswers = [moveTo, false];

    component.openRescheduleDialog(new Event('click'), series);

    expect(apiService['requestReschedule']).not.toHaveBeenCalled();
  });

  it('numa alteração de série liberada, a série atual termina na véspera', () => {
    const payload = {
      availabilityId: 478,
      professionalServiceId: 1,
      modality: 'REMOTE',
      recurrenceFrequency: 'BIWEEKLY' as const,
      effectiveFrom: '2026-10-29',
    };
    apiService['proposeSeriesChange'].mockReturnValue(of(appointment({
      id: 90, startDate: '2026-10-29', status: 'PENDING', replacesAppointmentId: 74, releasesOriginal: true,
    } as Partial<Appointment>)));
    dialogAnswers = [payload, 'release'];

    component.openEditSeriesDialog(new Event('click'), series);

    expect(apiService['proposeSeriesChange']).toHaveBeenCalledWith(74, { ...payload, releaseOriginal: true });
    expect(component.appointments().find(a => a.id === 74)!.endDate).toBe('2026-10-28');
  });
});

/**
 * A agenda mostra-se no fuso do perfil, mesmo para vagas escritas noutro fuso
 * (a pessoa mudou de fuso depois de as criar). Até aqui mostrava a hora da
 * própria vaga: uma vaga das 17:00 de Lisboa aparecia às 17:00 a quem tem o
 * perfil em São Paulo, onde é 13:00 ou 14:00 conforme a época.
 */
describe('AvailabilityComponent — a agenda no fuso do perfil (Brasil ⇄ Portugal)', () => {
  const SAO_PAULO = 'America/Sao_Paulo';
  let fixture: ComponentFixture<AvailabilityComponent>;
  let component: AvailabilityComponent;
  let apiService: Record<string, jest.Mock>;
  let dialogAnswers: unknown[];

  /** Terça às 22:00 em São Paulo, semanal. */
  const saoPauloTuesday: AvailabilityModel = {
    ...thursdaySlot,
    id: 479,
    startTime: '22:00:00',
    endTime: '23:00:00',
    dayOfWeek: 'TUESDAY' as unknown as DayOfWeek,
    startDate: '2026-09-01',
    timeZone: SAO_PAULO,
  } as AvailabilityModel;

  async function setup(profileZone: string, slots: AvailabilityModel[], now: string, appts: Appointment[] = []) {
    jest.useFakeTimers({
      now: new Date(now),
      doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval', 'queueMicrotask',
        'requestAnimationFrame', 'cancelAnimationFrame', 'clearTimeout', 'clearInterval'],
    });
    dialogAnswers = [];
    apiService = {
      getServices: jest.fn().mockReturnValue(of([])),
      getMyServices: jest.fn().mockReturnValue(of([])),
      getAvailabilitiesByProfessionalId: jest.fn().mockReturnValue(of(slots)),
      getProfessionalAppointments: jest.fn().mockReturnValue(of(appts)),
      getSentInvitations: jest.fn().mockReturnValue(of([])),
      getCommitments: jest.fn().mockReturnValue(of([])),
      getSentRescheduleRequests: jest.fn().mockReturnValue(of([])),
      closeAvailabilityDate: jest.fn().mockReturnValue(of(null)),
    };
    await TestBed.configureTestingModule({
      imports: [AvailabilityComponent, NoopAnimationsModule],
      providers: [
        { provide: ApiService, useValue: apiService },
        { provide: SessionService, useValue: { user: signal({ id: ME, timeZone: profileZone }) } },
        { provide: SnackbarService, useValue: { openSnackBar: jest.fn() } },
        {
          // Fechar um dia limpa o formulário do Agendar; com {} o erro rebentava
          // de forma assíncrona e caía no teste seguinte.
          provide: SchedulingService,
          useValue: {
            schedulingForm: { controls: { [SchedulingFormControls.SELECTED_SERVICE]: { setValue: jest.fn() } } },
            clearChainedRelatedFields: jest.fn(),
          },
        },
        {
          provide: MatDialog,
          useValue: { open: jest.fn().mockImplementation(() => ({ afterClosed: () => of(dialogAnswers.shift()) })) },
        },
        {
          provide: ScreenSizeService,
          useValue: { isMobile: signal(false), isTablet: signal(false), isDesktop: signal(true) },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AvailabilityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => {
    fixture?.destroy();
    jest.useRealTimers();
  });

  /** Os blocos de uma coluna (0 = segunda) como "início–fim". */
  function column(col: number): string[] {
    return component.blocksForColumn(col).map(b => `${b.startTime}–${b.endTime}`);
  }

  async function nextWeek() {
    component.nextWeek();
    await new Promise(r => setTimeout(r, 300));
  }

  it('uma vaga de Lisboa às 17:00 aparece às 13:00 a um perfil de São Paulo antes da mudança de hora…', async () => {
    await setup(SAO_PAULO, [thursdaySlot], '2026-10-21T12:00:00Z');
    expect(column(3)).toEqual(['13:00–14:00']);
  });

  it('…e às 14:00 depois dela (25/10), relida do servidor ao mudar de semana', async () => {
    await setup(SAO_PAULO, [thursdaySlot], '2026-10-21T12:00:00Z');
    await nextWeek();
    expect(apiService['getAvailabilitiesByProfessionalId']).toHaveBeenCalledTimes(2);
    expect(column(3)).toEqual(['14:00–15:00']);
  });

  it('a hora da sessão marcada também aparece no fuso do perfil', async () => {
    const series = appointment({ id: 74, timeZone: LISBON, startTime: '17:00', endTime: '18:00' } as Partial<Appointment>);
    await setup(SAO_PAULO, [thursdaySlot], '2026-10-21T12:00:00Z', [series]);
    expect(component.apptTimeRange(series)).toBe('13:00–14:00');
  });

  it('no mesmo fuso nada muda, e mudar de semana não relê nada', async () => {
    await setup(LISBON, [thursdaySlot], '2026-10-21T12:00:00Z');
    expect(column(3)).toEqual(['17:00–18:00']);
    await nextWeek();
    expect(apiService['getAvailabilitiesByProfessionalId']).toHaveBeenCalledTimes(1);
    expect(column(3)).toEqual(['17:00–18:00']);
  });

  it('terça 22:00 em São Paulo é quarta 01:00 em Lisboa, e fechar esse dia fecha a terça da vaga', async () => {
    await setup(LISBON, [saoPauloTuesday], '2026-10-28T12:00:00Z');
    expect(column(1)).toEqual([]);
    expect(column(2)).toEqual(['01:00–02:00']);

    dialogAnswers = ['day'];
    const block = component.blocksForColumn(2)[0];
    component.removeSlot(new Event('click'), block, 0);

    expect(apiService['closeAvailabilityDate']).toHaveBeenCalledWith(479, '2026-10-27');
  });
});

/**
 * Duas séries quinzenais intercaladas na mesma vaga (caso de out. 2026). O
 * painel da sessão fica aberto ao mudar de semana, e cancelar relia a data da
 * semana em vista: ia a marcação de uma série com a data da outra, e o backend
 * recusava ("A data 29/10/2026 não é uma sessão desta série").
 */
describe('AvailabilityComponent — a sessão aberta mantém a sua data ao mudar de semana', () => {
  const SAO_PAULO = 'America/Sao_Paulo';
  let fixture: ComponentFixture<AvailabilityComponent>;
  let component: AvailabilityComponent;
  let apiService: Record<string, jest.Mock>;
  let dialogAnswers: unknown[];

  // Quintas 22/10, 05/11… e 29/10, 12/11… às 17h em Lisboa.
  const seriesA = appointment({ id: 74, startDate: '2026-10-22', recurrenceFrequency: 'BIWEEKLY', timeZone: LISBON } as Partial<Appointment>);
  const seriesB = appointment({ id: 75, startDate: '2026-10-29', recurrenceFrequency: 'BIWEEKLY', timeZone: LISBON } as Partial<Appointment>);

  /** Terça às 22:00 em São Paulo — quarta 01:00 em Lisboa. */
  const saoPauloTuesday: AvailabilityModel = {
    ...thursdaySlot,
    id: 479,
    startTime: '22:00:00',
    endTime: '23:00:00',
    dayOfWeek: 'TUESDAY' as unknown as DayOfWeek,
    startDate: '2026-09-01',
    timeZone: SAO_PAULO,
  } as AvailabilityModel;
  const saoPauloSeries = appointment({
    id: 76,
    availabilityId: 479,
    startDate: '2026-10-27',
    startTime: '22:00:00',
    endTime: '23:00:00',
    dayOfWeek: 'TUESDAY' as unknown as DayOfWeek,
    recurrenceFrequency: 'BIWEEKLY',
    timeZone: SAO_PAULO,
  } as Partial<Appointment>);

  async function setup(profileZone: string, slots: AvailabilityModel[], now: string, appts: Appointment[]) {
    jest.useFakeTimers({
      now: new Date(now),
      doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval', 'queueMicrotask',
        'requestAnimationFrame', 'cancelAnimationFrame', 'clearTimeout', 'clearInterval'],
    });
    dialogAnswers = [];
    apiService = {
      getServices: jest.fn().mockReturnValue(of([])),
      getMyServices: jest.fn().mockReturnValue(of([])),
      getAvailabilitiesByProfessionalId: jest.fn().mockReturnValue(of(slots)),
      getProfessionalAppointments: jest.fn().mockReturnValue(of(appts)),
      getSentInvitations: jest.fn().mockReturnValue(of([])),
      getCommitments: jest.fn().mockReturnValue(of([])),
      getSentRescheduleRequests: jest.fn().mockReturnValue(of([])),
      deleteAppointment: jest.fn().mockReturnValue(of(null)),
    };
    await TestBed.configureTestingModule({
      imports: [AvailabilityComponent, NoopAnimationsModule],
      providers: [
        { provide: ApiService, useValue: apiService },
        { provide: SessionService, useValue: { user: signal({ id: ME, timeZone: profileZone }) } },
        { provide: SnackbarService, useValue: { openSnackBar: jest.fn() } },
        { provide: SchedulingService, useValue: {} },
        {
          provide: MatDialog,
          useValue: { open: jest.fn().mockImplementation(() => ({ afterClosed: () => of(dialogAnswers.shift()) })) },
        },
        {
          provide: ScreenSizeService,
          useValue: { isMobile: signal(false), isTablet: signal(false), isDesktop: signal(true) },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AvailabilityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => {
    fixture?.destroy();
    jest.useRealTimers();
  });

  async function nextWeek() {
    component.nextWeek();
    await new Promise(r => setTimeout(r, 300));
  }

  function cancelOnly(appt: Appointment) {
    dialogAnswers = [{ scope: 'SINGLE' }];
    component.cancelAppointment(appt);
  }

  it('cancelar depois de mudar de semana cancela a sessão que foi aberta', async () => {
    await setup(LISBON, [thursdaySlot], '2026-10-21T12:00:00Z', [seriesA, seriesB]);
    component.selectSlot(new Event('click'), seriesA);
    await nextWeek();

    cancelOnly(seriesA);

    expect(apiService['deleteAppointment']).toHaveBeenCalledWith(74, '', '2026-10-22', 'SINGLE');
  });

  it('o painel mostra a data da sessão aberta, não a da semana em vista', async () => {
    await setup(LISBON, [thursdaySlot], '2026-10-21T12:00:00Z', [seriesA, seriesB]);
    component.selectSlot(new Event('click'), seriesA);
    await nextWeek();

    expect(component.apptDateLabel(seriesA)).toMatch(/^Quinta-feira, 22 /);
  });

  it('a outra série, aberta na sua semana, cancela a sua própria data', async () => {
    await setup(LISBON, [thursdaySlot], '2026-10-21T12:00:00Z', [seriesA, seriesB]);
    component.selectSlot(new Event('click'), seriesA);
    await nextWeek();
    component.selectSlot(new Event('click'), seriesB);

    cancelOnly(seriesB);

    expect(apiService['deleteAppointment']).toHaveBeenCalledWith(75, '', '2026-10-29', 'SINGLE');
  });

  it('uma série de São Paulo vista de Lisboa cancela a terça da vaga, mesmo noutra semana', async () => {
    // Terça 27/10 22:00 em São Paulo aparece na quarta 28/10 01:00 em Lisboa.
    await setup(LISBON, [saoPauloTuesday], '2026-10-26T12:00:00Z', [saoPauloSeries]);
    component.selectSlot(new Event('click'), saoPauloSeries);
    await nextWeek();
    expect(component.apptDateLabel(saoPauloSeries)).toMatch(/^Quarta-feira, 28 /);

    cancelOnly(saoPauloSeries);

    expect(apiService['deleteAppointment']).toHaveBeenCalledWith(76, '', '2026-10-27', 'SINGLE');
  });
});
