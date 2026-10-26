import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StyledSelectComponent } from './styled-select.component';

/**
 * Clicar na barra de scroll da lista não pode fechá-la. Num diálogo o foco
 * vai para o contentor (tabindex="-1"), não para lado nenhum — era aí que a
 * lista de pacientes de "Propor agendamento recorrente" ainda fechava.
 */
describe('StyledSelectComponent — barra de scroll da lista', () => {
  let fixture: ComponentFixture<StyledSelectComponent>;
  let host: HTMLElement;
  let dialogContainer: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [StyledSelectComponent] }).compileComponents();

    // Como o mat-dialog-container: focável, e o select lá dentro.
    dialogContainer = document.createElement('div');
    dialogContainer.tabIndex = -1;
    document.body.appendChild(dialogContainer);

    fixture = TestBed.createComponent(StyledSelectComponent);
    fixture.componentRef.setInput('options', [
      { value: '1', label: 'Ana' },
      { value: '2', label: 'Bruno' },
    ]);
    host = fixture.nativeElement as HTMLElement;
    dialogContainer.appendChild(host);
    fixture.detectChanges();

    host.querySelector<HTMLButtonElement>('.select-trigger')!.click();
    fixture.detectChanges();
    fixture.detectChanges();
  });

  afterEach(() => dialogContainer.remove());

  function search(): HTMLInputElement {
    return host.querySelector<HTMLInputElement>('.dropdown-search')!;
  }

  it('abre com o foco na pesquisa', () => {
    expect(fixture.componentInstance.dropdownOpen()).toBe(true);
    expect(document.activeElement).toBe(search());
  });

  it('clicar na barra de scroll dentro de um diálogo não fecha a lista e devolve o foco à pesquisa', () => {
    host.querySelector('.select-options')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    dialogContainer.focus();
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(fixture.componentInstance.dropdownOpen()).toBe(true);
    expect(document.activeElement).toBe(search());
  });

  it('o foco a sair para o diálogo sem clique dentro fecha a lista', () => {
    dialogContainer.focus();

    expect(fixture.componentInstance.dropdownOpen()).toBe(false);
  });
});
