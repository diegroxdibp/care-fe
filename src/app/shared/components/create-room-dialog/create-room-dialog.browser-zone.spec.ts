import { createDialog, scheduleAndSubmit } from './create-room-dialog.testing';

/**
 * O inverso de create-room-dialog.component.spec.ts: aqui é o próprio
 * navegador que está em São Paulo, com o perfil em Lisboa. O código antigo
 * (`new Date('yyyy-MM-ddTHH:mm')`) lia a hora em São Paulo e passava a suite
 * normal sem problema - só se nota com o processo noutro fuso.
 *
 * Corre com `npm run test:browser-zone`.
 */
const LISBON = 'Europe/Lisbon';

const runningInSaoPaulo = new Date('2026-01-15T12:00:00Z').getTimezoneOffset() === 180;

(runningInSaoPaulo ? describe : describe.skip)('CreateRoomDialogComponent num browser em São Paulo', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'queueMicrotask', 'nextTick'] });
    jest.setSystemTime(new Date('2026-01-01T12:00:00Z'));
  });

  afterEach(() => jest.useRealTimers());

  it('14:00 com perfil em Lisboa abre às 13:00 UTC em julho, não às 17:00 (hora de São Paulo)', async () => {
    const { component, dialogRef } = await createDialog(LISBON);
    scheduleAndSubmit(component, '2026-07-15', '14:00');
    expect(dialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ opensAt: '2026-07-15T13:00:00.000Z' }));
  });

  it('14:00 com perfil em Lisboa abre às 14:00 UTC em janeiro', async () => {
    const { component, dialogRef } = await createDialog(LISBON);
    scheduleAndSubmit(component, '2026-01-15', '14:00');
    expect(dialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ opensAt: '2026-01-15T14:00:00.000Z' }));
  });
});
