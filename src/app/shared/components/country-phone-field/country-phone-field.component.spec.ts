import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';

import { CountryPhoneFieldComponent } from './country-phone-field.component';
import { Countries } from '../../../../assets/countries';

/** Como no StyledSelect: a barra de scroll da lista de países não a fecha. */
describe('CountryPhoneFieldComponent — barra de scroll da lista de países', () => {
  let fixture: ComponentFixture<CountryPhoneFieldComponent>;
  let host: HTMLElement;
  let outside: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CountryPhoneFieldComponent] }).compileComponents();

    outside = document.createElement('div');
    outside.tabIndex = -1;
    document.body.appendChild(outside);

    fixture = TestBed.createComponent(CountryPhoneFieldComponent);
    fixture.componentRef.setInput('country', Countries[0]);
    fixture.componentRef.setInput('phoneControl', new FormControl(''));
    host = fixture.nativeElement as HTMLElement;
    outside.appendChild(host);
    fixture.detectChanges();

    host.querySelector<HTMLButtonElement>('.dial-code')!.click();
    fixture.detectChanges();
    fixture.detectChanges();
  });

  afterEach(() => outside.remove());

  function search(): HTMLInputElement {
    return host.querySelector<HTMLInputElement>('.dropdown-search')!;
  }

  it('clicar na barra de scroll não fecha a lista e devolve o foco à pesquisa', () => {
    expect(document.activeElement).toBe(search());

    host.querySelector('.prefix-options')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    outside.focus();
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(fixture.componentInstance.dropdownOpen()).toBe(true);
    expect(document.activeElement).toBe(search());
  });

  it('o foco a sair sem clique dentro fecha a lista', () => {
    outside.focus();

    expect(fixture.componentInstance.dropdownOpen()).toBe(false);
  });
});
