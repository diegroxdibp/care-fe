import { Appointment } from '../models/appointment.model';
import { ProfessionalService } from '../models/professional-service.model';
import { DayOfWeek } from '../enums/day-of-week.enum';
import { Modality } from '../enums/modality.enum';
import { Currency } from '../enums/currency.enum';
import { ProfessionalServiceFormat } from '../enums/professional-service-format.enum';
import { ProfessionalServiceModality } from '../enums/professional-service-modality.enum';
import {
  BuildSessionsOptions,
  buildSessions,
  isUpcomingOrOngoing,
  sessionBounds,
} from './session-list.util';

/**
 * Este ficheiro existe por causa de um bug real: buildSessions mostrava a
 * hora crua (fuso de quem autorou a marcação) em vez de a converter para o
 * fuso de quem a vê — o painel "Agendamentos" mostrava 22:00 (São Paulo)
 * quando o cliente, em Lisboa, devia ver ~01:00/02:00. Todo cenário aqui
 * testa esse par de fusos, de propósito: São Paulo é fixo o ano todo, Lisboa
 * observa horário de verão, e é essa assimetria que expõe conversões
 * hardcoded.
 */
const SAO_PAULO = 'America/Sao_Paulo';
const LISBON = 'Europe/Lisbon';

const SERVICE: ProfessionalService = {
  id: 1,
  name: 'REICHIAN_BODY_ANALYSIS',
  format: ProfessionalServiceFormat.INDIVIDUAL,
  modality: ProfessionalServiceModality.LOCAL,
  price: '60',
  active: true,
};

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 1,
    professionalId: 10,
    professionalName: 'Luane Bastos',
    clientId: 20,
    availabilityId: 30,
    professionalServiceId: SERVICE.id,
    modality: Modality.REMOTE,
    startDate: '2026-01-15',
    endDate: '2026-01-15',
    startTime: '22:00',
    endTime: '23:00',
    isRecurring: false,
    dayOfWeek: DayOfWeek.THURSDAY, // 2026-01-15 é uma quinta
    timeZone: SAO_PAULO,
    status: 'CONFIRMED',
    ...overrides,
  };
}

function options(overrides: Partial<BuildSessionsOptions> = {}): BuildSessionsOptions {
  return {
    perspective: 'CLIENT',
    currency: Currency.EUR,
    paymentsEnabled: false,
    viewerTimeZone: LISBON,
    ...overrides,
  };
}

describe('buildSessions — hora exibida no fuso de quem vê, não de quem autorou', () => {
  it('sessão avulsa autorada em São Paulo aparece corretamente convertida para quem vê de Lisboa (inverno europeu: +3h e troca de dia)', () => {
    const appt = makeAppointment({ startDate: '2026-01-15', startTime: '22:00', endTime: '23:00' });
    const [session] = buildSessions([appt], [SERVICE], options({ viewerTimeZone: LISBON }));

    expect(session.startTime).toBe('01:00');
    expect(session.endTime).toBe('02:00');
    expect(session.date.getFullYear()).toBe(2026);
    expect(session.date.getMonth()).toBe(0); // janeiro
    expect(session.date.getDate()).toBe(16); // passou para o dia seguinte
  });

  it('a mesma sessão em julho (verão europeu) converte para uma hora diferente — Lisboa muda, São Paulo não', () => {
    const appt = makeAppointment({ startDate: '2026-07-16', startTime: '22:00', endTime: '23:00', dayOfWeek: DayOfWeek.THURSDAY });
    const [session] = buildSessions([appt], [SERVICE], options({ viewerTimeZone: LISBON }));

    expect(session.startTime).toBe('02:00');
    expect(session.endTime).toBe('03:00');
    expect(session.date.getMonth()).toBe(6); // julho
    expect(session.date.getDate()).toBe(17);
  });

  it('vendo do mesmo fuso em que foi autorada, a hora não muda', () => {
    const appt = makeAppointment({ startDate: '2026-01-15', startTime: '22:00', endTime: '23:00' });
    const [session] = buildSessions([appt], [SERVICE], options({ viewerTimeZone: SAO_PAULO }));

    expect(session.startTime).toBe('22:00');
    expect(session.endTime).toBe('23:00');
    expect(session.date.getDate()).toBe(15);
  });

  it('sem timeZone (marcação antiga), mostra a hora crua em vez de rebentar', () => {
    const appt = makeAppointment({ timeZone: undefined });
    const [session] = buildSessions([appt], [SERVICE], options({ viewerTimeZone: LISBON }));

    expect(session.startTime).toBe('22:00');
    expect(session.endTime).toBe('23:00');
    expect(session.date.getDate()).toBe(15);
  });

  it('direção inversa: autorada em Lisboa, vista de São Paulo, sem troca de dia', () => {
    const appt = makeAppointment({
      startDate: '2026-01-15',
      startTime: '14:00',
      endTime: '15:00',
      timeZone: LISBON,
    });
    const [session] = buildSessions([appt], [SERVICE], options({ viewerTimeZone: SAO_PAULO }));

    expect(session.startTime).toBe('11:00');
    expect(session.date.getDate()).toBe(15);
  });

  it('sessão que atravessa a meia-noite (23:30–00:30) resolve o fim no dia seguinte antes mesmo de mudar de fuso', () => {
    const appt = makeAppointment({
      startDate: '2026-01-15',
      startTime: '23:30',
      endTime: '00:30',
      timeZone: SAO_PAULO,
    });
    const [session] = buildSessions([appt], [SERVICE], options({ viewerTimeZone: SAO_PAULO }));

    // Mesma vista, sem conversão de fuso — só a regra de meia-noite.
    expect(session.startTime).toBe('23:30');
    expect(session.endTime).toBe('00:30');
    expect(session.duration).toBe('60 minutos');
  });
});

describe('buildSessions — occurrenceKey fica no fuso de origem mesmo quando date (exibição) muda', () => {
  it('occurrenceKey continua a ser a data em que a marcação foi combinada, não a data ajustada para exibição', () => {
    const appt = makeAppointment({ id: 42, startDate: '2026-01-15', startTime: '22:00' });
    const [session] = buildSessions([appt], [SERVICE], options({ viewerTimeZone: LISBON }));

    // A data de exibição avançou para o dia 16 (ver teste acima), mas
    // reagendar/cancelar têm de continuar a apontar para a ocorrência real,
    // 15 de janeiro — é o que o backend e excludedDates esperam.
    expect(session.date.getDate()).toBe(16);
    expect(session.occurrenceKey).toBe('2026-01-15');
    expect(session.key).toBe('42@2026-01-15');
  });

  it('excludedDates continua a filtrar pela data de origem, não pela data ajustada ao fuso de quem vê', () => {
    const appt = makeAppointment({
      startDate: '2026-01-15',
      startTime: '22:00',
      excludedDates: ['2026-01-15'],
    });
    const sessions = buildSessions([appt], [SERVICE], options({ viewerTimeZone: LISBON }));

    expect(sessions).toHaveLength(0);
  });
});

describe('buildSessions — série recorrente atravessando a mudança de horário de verão de Lisboa (29 mar 2026)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // "Hoje" fixo numa quinta-feira anterior às duas ocorrências em teste,
    // para que a janela de geração de ocorrências as inclua de forma
    // determinística (buildSessions ancora a série a partir de "agora").
    jest.setSystemTime(new Date(2026, 2, 19, 12, 0, 0)); // 19 de março de 2026, meio-dia local
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('duas ocorrências da mesma vaga semanal (São Paulo, 22:00) convertem para horas diferentes em Lisboa consoante o horário de verão', () => {
    const appt = makeAppointment({
      id: 7,
      startDate: '2025-06-05', // âncora antiga; a série já vem a decorrer
      endDate: '2026-12-31',
      startTime: '22:00',
      endTime: '23:00',
      isRecurring: true,
      dayOfWeek: DayOfWeek.THURSDAY,
      recurrenceFrequency: 'WEEKLY',
      timeZone: SAO_PAULO,
    });

    const sessions = buildSessions([appt], [SERVICE], options({ viewerTimeZone: LISBON }));

    const before = sessions.find((s) => s.occurrenceKey === '2026-03-26');
    const after = sessions.find((s) => s.occurrenceKey === '2026-04-02');

    expect(before).toBeDefined();
    expect(after).toBeDefined();

    // Antes da mudança (Lisboa ainda em UTC+0): 01:00, dia 27.
    expect(before!.startTime).toBe('01:00');
    expect(before!.date.getDate()).toBe(27);

    // Depois da mudança (Lisboa já em UTC+1): 02:00, dia 3 de abril.
    expect(after!.startTime).toBe('02:00');
    expect(after!.date.getMonth()).toBe(3); // abril
    expect(after!.date.getDate()).toBe(3);

    // As duas continuam identificáveis pela data real da ocorrência em São
    // Paulo, não pela data (já ajustada) em que aparecem para quem vê.
    expect(before!.occurrenceKey).toBe('2026-03-26');
    expect(after!.occurrenceKey).toBe('2026-04-02');
  });
});

describe('buildSessions — outros campos não se confundem com a conversão de fuso', () => {
  it('modalidade ANY (vaga "Qualquer") nunca aparece como resultado — mostra "A combinar"', () => {
    const appt = makeAppointment({ modality: 'ANY' as unknown as Modality });
    const [session] = buildSessions([appt], [SERVICE], options());
    expect(session.mode).toBe('A combinar');
  });

  it('perspetiva PROFESSIONAL também converte para o fuso de quem vê — a regra é do produto, não do papel de quem vê', () => {
    const appt = makeAppointment({
      startDate: '2026-01-15',
      startTime: '22:00',
      timeZone: SAO_PAULO,
      clientName: 'Diego Braga Ponte',
    });
    const [session] = buildSessions(
      [appt],
      [SERVICE],
      options({ perspective: 'PROFESSIONAL', viewerTimeZone: LISBON }),
    );

    expect(session.who).toBe('Diego Braga Ponte');
    expect(session.startTime).toBe('01:00');
  });

  it('ordena por instante real, não pela data já ajustada ao fuso de quem vê', () => {
    // A: São Paulo 23:00 de dia 15 → em Lisboa vira dia 16, madrugada.
    // B: São Paulo 08:00 de dia 16 → em Lisboa continua dia 16, de manhã, e
    // acontece DEPOIS de A em instante real, apesar de A "parecer" mais tarde
    // no relógio de origem.
    const early = makeAppointment({ id: 1, startDate: '2026-01-15', startTime: '23:00', endTime: '23:59' });
    const late = makeAppointment({ id: 2, startDate: '2026-01-16', startTime: '08:00', endTime: '09:00' });

    const sessions = buildSessions([late, early], [SERVICE], options({ viewerTimeZone: LISBON }));

    expect(sessions.map((s) => s.appointmentId)).toEqual([1, 2]);
  });
});

describe('isUpcomingOrOngoing / sessionBounds — coerentes com a hora já convertida', () => {
  it('uma sessão futura em instante real continua "por vir" mesmo depois de a hora exibida mudar de dia', () => {
    const appt = makeAppointment({ startDate: '2026-01-15', startTime: '22:00', endTime: '23:00' });
    const [session] = buildSessions([appt], [SERVICE], options({ viewerTimeZone: LISBON }));

    const bounds = sessionBounds(session);
    expect(bounds).not.toBeNull();
    // O instante real de início é 2026-01-16T01:00 hora de Lisboa.
    expect(bounds!.start.getDate()).toBe(session.date.getDate());

    const justBefore = new Date(bounds!.start.getTime() - 60_000);
    const justAfterEnd = new Date(bounds!.end.getTime() + 60_000);
    expect(isUpcomingOrOngoing(session, justBefore)).toBe(true);
    expect(isUpcomingOrOngoing(session, justAfterEnd)).toBe(false);
  });
});

/**
 * sessionBounds reconstruía o instante a partir dos rótulos (`date` +
 * `startTime`, já no fuso do perfil) com `setHours` — ou seja, no fuso do
 * navegador. Com o perfil em São Paulo e o navegador noutro fuso (aqui, o do
 * processo do Jest, que não é São Paulo), a "próxima sessão" e a janela do
 * botão "Entrar" ficavam deslocadas pela diferença entre os dois.
 */
describe('sessionBounds — instante real, independente do fuso do navegador', () => {
  it('sessão das 22:00 em São Paulo, vista por quem tem o perfil em São Paulo, começa às 01:00 UTC', () => {
    const appt = makeAppointment({ startDate: '2026-01-15', startTime: '22:00', endTime: '23:00' });
    const [session] = buildSessions([appt], [SERVICE], options({ viewerTimeZone: SAO_PAULO }));

    expect(session.startTime).toBe('22:00');
    expect(sessionBounds(session)?.start.toISOString()).toBe('2026-01-16T01:00:00.000Z');
    expect(sessionBounds(session)?.end.toISOString()).toBe('2026-01-16T02:00:00.000Z');
  });

  it('às 20:30 em São Paulo a sessão das 22:00 ainda está por vir', () => {
    const appt = makeAppointment({ startDate: '2026-01-15', startTime: '22:00', endTime: '23:00' });
    const [session] = buildSessions([appt], [SERVICE], options({ viewerTimeZone: SAO_PAULO }));

    expect(isUpcomingOrOngoing(session, new Date('2026-01-15T23:30:00Z'))).toBe(true);
  });

  it('em julho, a mesma sessão vista de Lisboa começa às 01:00 UTC (02:00 em Lisboa)', () => {
    const appt = makeAppointment({ startDate: '2026-07-16', endDate: '2026-07-16', startTime: '22:00', endTime: '23:00' });
    const [session] = buildSessions([appt], [SERVICE], options({ viewerTimeZone: LISBON }));

    expect(session.startTime).toBe('02:00');
    expect(sessionBounds(session)?.start.toISOString()).toBe('2026-07-17T01:00:00.000Z');
  });
});
