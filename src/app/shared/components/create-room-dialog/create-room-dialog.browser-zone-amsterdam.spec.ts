import { createDialog, scheduleAndSubmit } from './create-room-dialog.testing';

/**
 * O caso real de 06/10/2026: perfil em Lisboa (UTC+1 em outubro), computador
 * nos Países Baixos (UTC+2). A pessoa escolheu 18:00 a pensar em Lisboa; o
 * código antigo leu 18:00 de Amesterdão = 16:00 UTC (o `nbf` do token no log
 * da Daily), e a sala de 2h fechou às 18:00 UTC, uma hora depois de a
 * chamada começar.
 *
 * Corre com `npm run test:browser-zone-amsterdam`.
 */
const LISBON = 'Europe/Lisbon';

const runningInAmsterdam = new Date('2026-01-15T12:00:00Z').getTimezoneOffset() === -60;

(runningInAmsterdam ? describe : describe.skip)('CreateRoomDialogComponent num computador em Amesterdão, perfil em Lisboa', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'queueMicrotask', 'nextTick'] });
    jest.setSystemTime(new Date('2026-10-06T12:00:00Z'));
  });

  afterEach(() => jest.useRealTimers());

  it('o processo está mesmo em Amesterdão: a leitura antiga dava 16:00 UTC', () => {
    // O que `new Date('yyyy-MM-ddTHH:mm')` fazia no código antigo - se isto
    // falhar, o teste abaixo deixa de provar alguma coisa.
    expect(new Date('2026-10-06T18:00').toISOString()).toBe('2026-10-06T16:00:00.000Z');
  });

  it('06/10, 18:00 abre às 17:00 UTC (18:00 em Lisboa), não às 16:00', async () => {
    const { component, dialogRef } = await createDialog(LISBON);
    scheduleAndSubmit(component, '2026-10-06', '18:00');
    expect(dialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ opensAt: '2026-10-06T17:00:00.000Z' }));
  });

  it('em janeiro (Lisboa UTC+0, Amesterdão UTC+1) a diferença mantém-se: 18:00 abre às 18:00 UTC', async () => {
    const { component, dialogRef } = await createDialog(LISBON);
    scheduleAndSubmit(component, '2027-01-15', '18:00');
    expect(dialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ opensAt: '2027-01-15T18:00:00.000Z' }));
  });

  it('o rótulo ao lado da hora mostra Lisboa, não o fuso do computador', async () => {
    const { component } = await createDialog(LISBON);
    expect(component.timeZoneLabel()).toContain('Lisboa');
  });
});
