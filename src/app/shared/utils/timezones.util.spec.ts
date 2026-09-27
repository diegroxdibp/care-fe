import {
  isWallTimePast,
  timezoneCity,
  timezoneOffsetLabel,
  wallTimeInZone,
  zonedWallTimeToInstant,
} from './timezones.util';

/**
 * Brasil (São Paulo) e Portugal (Lisboa) são o par de fusos que este produto
 * mais precisa de acertar, e o par mais informativo para testar: São Paulo é
 * fixo o ano todo (Brasil aboliu o horário de verão em 2019), enquanto Lisboa
 * observa horário de verão (UTC+0 no inverno, UTC+1 no verão). Isso significa
 * que a MESMA hora de parede em São Paulo se traduz numa hora diferente em
 * Lisboa consoante a época do ano — exatamente o tipo de assimetria que um
 * bug de fuso hardcoded não sobrevive.
 */
const SAO_PAULO = 'America/Sao_Paulo';
const LISBON = 'Europe/Lisbon';

describe('zonedWallTimeToInstant + wallTimeInZone — Brasil ⇄ Portugal', () => {
  it('converte São Paulo → Lisboa no inverno europeu (Lisboa em UTC+0): diferença de 3h', () => {
    // 22:00 em São Paulo (UTC-3 o ano todo) = 01:00 UTC do dia seguinte.
    // Em janeiro, Lisboa está em UTC+0 → mesma hora que UTC.
    const instant = zonedWallTimeToInstant('2026-01-15', '22:00', SAO_PAULO);
    expect(instant).not.toBeNull();

    const wall = wallTimeInZone(instant!, LISBON);
    expect(wall).toEqual({ year: 2026, month: 1, day: 16, hour: 1, minute: 0 });
  });

  it('converte São Paulo → Lisboa no verão europeu (Lisboa em UTC+1): diferença de 4h', () => {
    // Mesmíssima hora de parede em São Paulo, seis meses depois — a conversão
    // dá uma hora diferente em Lisboa só por causa do horário de verão de lá,
    // já que São Paulo não muda.
    const instant = zonedWallTimeToInstant('2026-07-15', '22:00', SAO_PAULO);
    expect(instant).not.toBeNull();

    const wall = wallTimeInZone(instant!, LISBON);
    expect(wall).toEqual({ year: 2026, month: 7, day: 16, hour: 2, minute: 0 });
  });

  it('converte Lisboa → São Paulo no inverno europeu: sem troca de dia', () => {
    const instant = zonedWallTimeToInstant('2026-01-15', '14:00', LISBON);
    expect(instant).not.toBeNull();

    const wall = wallTimeInZone(instant!, SAO_PAULO);
    expect(wall).toEqual({ year: 2026, month: 1, day: 15, hour: 11, minute: 0 });
  });

  it('converte Lisboa → São Paulo no verão europeu: mesma hora de parede, resultado diferente', () => {
    const instant = zonedWallTimeToInstant('2026-07-15', '14:00', LISBON);
    expect(instant).not.toBeNull();

    const wall = wallTimeInZone(instant!, SAO_PAULO);
    expect(wall).toEqual({ year: 2026, month: 7, day: 15, hour: 10, minute: 0 });
  });

  it('resolve corretamente duas ocorrências da mesma vaga semanal atravessando a mudança de horário de verão de Lisboa (29 mar 2026)', () => {
    // Uma vaga semanal às quintas, 22:00 em São Paulo. A ocorrência de 26 de
    // março (antes da mudança) e a de 2 de abril (depois) têm de resolver
    // para horas diferentes em Lisboa, mesmo com o mesmo par (dia da
    // semana, hora de parede) — é isto que garante que a conversão é feita
    // por ocorrência, e não com um offset calculado uma vez e reutilizado.
    const before = zonedWallTimeToInstant('2026-03-26', '22:00', SAO_PAULO);
    const after = zonedWallTimeToInstant('2026-04-02', '22:00', SAO_PAULO);
    expect(before).not.toBeNull();
    expect(after).not.toBeNull();

    expect(wallTimeInZone(before!, LISBON)).toEqual({ year: 2026, month: 3, day: 27, hour: 1, minute: 0 });
    expect(wallTimeInZone(after!, LISBON)).toEqual({ year: 2026, month: 4, day: 3, hour: 2, minute: 0 });
  });

  it('idas e voltas (São Paulo → instante → São Paulo) devolvem a mesma hora de parede', () => {
    const dateKey = '2026-01-15';
    const time = '22:00';
    const instant = zonedWallTimeToInstant(dateKey, time, SAO_PAULO);
    expect(instant).not.toBeNull();

    const roundTrip = wallTimeInZone(instant!, SAO_PAULO);
    expect(roundTrip).toEqual({ year: 2026, month: 1, day: 15, hour: 22, minute: 0 });
  });

  it('idas e voltas atravessando a mudança de horário de verão de Lisboa também batem certo', () => {
    const dateKey = '2026-03-29'; // domingo da própria mudança
    const time = '10:00';
    const instant = zonedWallTimeToInstant(dateKey, time, LISBON);
    expect(instant).not.toBeNull();

    const roundTrip = wallTimeInZone(instant!, LISBON);
    expect(roundTrip).toEqual({ year: 2026, month: 3, day: 29, hour: 10, minute: 0 });
  });

  it('devolve null para uma hora de parede malformada', () => {
    expect(zonedWallTimeToInstant('2026-01-15', 'not-a-time', SAO_PAULO)).toBeNull();
    expect(zonedWallTimeToInstant('not-a-date', '22:00', SAO_PAULO)).toBeNull();
  });
});

describe('isWallTimePast — Brasil ⇄ Portugal', () => {
  it('uma vaga de São Paulo às 22:00 ainda não passou para quem a vê de Lisboa às 23:00 UTC do mesmo dia (~20:00 em São Paulo)', () => {
    // "agora" = 2026-01-15T23:00:00Z. Em São Paulo (UTC-3) são 20:00 — a vaga
    // das 22:00 ainda não aconteceu.
    const now = new Date('2026-01-15T23:00:00Z');
    expect(isWallTimePast('2026-01-15', '22:00', SAO_PAULO, now)).toBe(false);
  });

  it('a mesma vaga já passou uma vez que o instante ultrapassa as 22:00 de São Paulo', () => {
    // 2026-01-16T02:00:00Z = 2026-01-15 23:00 em São Paulo — depois das 22:00.
    const now = new Date('2026-01-16T02:00:00Z');
    expect(isWallTimePast('2026-01-15', '22:00', SAO_PAULO, now)).toBe(true);
  });

  it('sem fuso (vagas antigas), cai na hora local de quem está a ver em vez de rebentar', () => {
    const past = new Date('2000-01-01T00:00:00Z');
    const future = new Date('2999-01-01T00:00:00Z');
    expect(isWallTimePast('2026-01-15', '22:00', undefined, past)).toBe(false);
    expect(isWallTimePast('2026-01-15', '22:00', undefined, future)).toBe(true);
  });
});

describe('timezoneOffsetLabel — reflete o horário de verão na data indicada', () => {
  it('Lisboa mostra um offset diferente no inverno e no verão', () => {
    const winter = timezoneOffsetLabel(LISBON, new Date('2026-01-15T12:00:00Z'));
    const summer = timezoneOffsetLabel(LISBON, new Date('2026-07-15T12:00:00Z'));
    expect(winter).not.toEqual(summer);
  });

  it('São Paulo mostra o mesmo offset o ano todo (sem horário de verão desde 2019)', () => {
    const winter = timezoneOffsetLabel(SAO_PAULO, new Date('2026-01-15T12:00:00Z'));
    const summer = timezoneOffsetLabel(SAO_PAULO, new Date('2026-07-15T12:00:00Z'));
    expect(winter).toEqual(summer);
  });
});

describe('timezoneCity', () => {
  it('usa o nome fixo em português para os fusos que a CARE destaca', () => {
    expect(timezoneCity(SAO_PAULO)).toBe('São Paulo — Brasília');
    expect(timezoneCity(LISBON)).toBe('Lisboa');
  });

  it('cai no próprio identificador IANA para um fuso fora da lista fixa', () => {
    expect(timezoneCity('Asia/Tokyo')).toBe('Tokyo');
  });
});
