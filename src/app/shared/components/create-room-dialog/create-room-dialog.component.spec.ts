import { createDialog, scheduleAndSubmit } from './create-room-dialog.testing';

/**
 * A hora escolhida no "Agendar" é lida no fuso do perfil - o mesmo em que a
 * lista de salas a mostra. Antes era lida no fuso do navegador, e com perfil
 * e computador em fusos diferentes a sala abria a uma hora que ninguém
 * escolheu (o caso de 06/10/2026: sala aberta 1h antes de as pessoas
 * entrarem, que fechou a meio da chamada).
 *
 * Esta suite corre com o processo em UTC/Lisboa, por isso testa perfis em
 * São Paulo; o caso inverso (navegador em São Paulo, perfil em Lisboa) está
 * em create-room-dialog.browser-zone.spec.ts.
 */
const SAO_PAULO = 'America/Sao_Paulo';
const LISBON = 'Europe/Lisbon';

describe('CreateRoomDialogComponent — hora agendada no fuso do perfil', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'queueMicrotask', 'nextTick'] });
    jest.setSystemTime(new Date('2026-01-01T12:00:00Z'));
  });

  afterEach(() => jest.useRealTimers());

  it('14:00 com perfil em São Paulo abre às 17:00 UTC, em janeiro', async () => {
    const { component, dialogRef } = await createDialog(SAO_PAULO);
    scheduleAndSubmit(component, '2026-01-15', '14:00');
    expect(dialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ opensAt: '2026-01-15T17:00:00.000Z' }));
  });

  it('14:00 com perfil em São Paulo abre às 17:00 UTC também em julho (São Paulo não tem horário de verão)', async () => {
    const { component, dialogRef } = await createDialog(SAO_PAULO);
    scheduleAndSubmit(component, '2026-07-15', '14:00');
    expect(dialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ opensAt: '2026-07-15T17:00:00.000Z' }));
  });

  it('14:00 com perfil em Lisboa abre às 13:00 UTC em julho (horário de verão)', async () => {
    const { component, dialogRef } = await createDialog(LISBON);
    scheduleAndSubmit(component, '2026-07-15', '14:00');
    expect(dialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ opensAt: '2026-07-15T13:00:00.000Z' }));
  });

  it('mostra o fuso do perfil ao lado da hora', async () => {
    const { component } = await createDialog(SAO_PAULO);
    expect(component.timeZoneLabel()).toContain('São Paulo');
  });

  it('não deixa agendar para um horário que já passou no fuso do perfil', async () => {
    // 12:00 UTC = 09:00 em São Paulo: 10:00 de hoje ainda vem, 08:00 já passou.
    const { component, dialogRef } = await createDialog(SAO_PAULO);
    scheduleAndSubmit(component, '2026-01-01', '08:00');
    expect(component.scheduledInPast()).toBe(true);
    expect(dialogRef.close).not.toHaveBeenCalled();

    scheduleAndSubmit(component, '2026-01-01', '10:00');
    expect(component.scheduledInPast()).toBe(false);
    expect(dialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ opensAt: '2026-01-01T13:00:00.000Z' }));
  });

  it('"hoje" no calendário é o dia do perfil, não o do navegador', async () => {
    // 01:00 UTC de 2 jan = ainda 1 jan, 22:00, em São Paulo.
    jest.setSystemTime(new Date('2026-01-02T01:00:00Z'));
    const { component } = await createDialog(SAO_PAULO);
    expect(component.isToday('2026-01-01')).toBe(true);
    expect(component.isPast('2026-01-01')).toBe(false);
  });
});
