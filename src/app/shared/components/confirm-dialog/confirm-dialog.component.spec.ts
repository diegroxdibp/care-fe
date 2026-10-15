import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { ConfirmDialogComponent, ConfirmDialogData, foldWord } from './confirm-dialog.component';

describe('foldWord', () => {
  it('ignora acentos, maiúsculas e espaços nas pontas', () => {
    expect(foldWord(' Pública ')).toBe('publica');
    expect(foldWord('PUBLICA')).toBe(foldWord('pública'));
    expect(foldWord('privada')).toBe('privada');
  });
});

describe('ConfirmDialogComponent — escrever a palavra para confirmar', () => {
  let component: ConfirmDialogComponent;
  let close: jest.Mock;

  function setup(data: ConfirmDialogData) {
    close = jest.fn();
    TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    component = TestBed.createComponent(ConfirmDialogComponent).componentInstance;
  }

  const data: ConfirmDialogData = {
    message: 'Esta nota será pública: toda a equipe poderá vê-la.',
    typeToConfirm: 'pública',
  };

  it('só confirma depois de escrita a palavra, com ou sem acento', () => {
    setup(data);
    expect(component.canConfirm()).toBe(false);

    component.typedCtrl.setValue('privada');
    component.confirm();
    expect(close).not.toHaveBeenCalled();

    component.typedCtrl.setValue('Publica');
    expect(component.canConfirm()).toBe(true);
    component.confirm();
    expect(close).toHaveBeenCalledWith(true);
  });

  it('destaca a palavra dentro da mensagem', () => {
    setup(data);
    expect(component.messageParts).toEqual([
      'Esta nota será ',
      'pública',
      ': toda a equipe poderá vê-la.',
    ]);
  });
});
