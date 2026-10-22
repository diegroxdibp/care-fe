import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MobileSheetComponent } from './mobile-sheet.component';

@Component({
  standalone: true,
  imports: [MobileSheetComponent],
  template: `
    <app-mobile-sheet (closed)="closes = closes + 1">
      <h3 sheetHead>Título</h3>
      <p class="body-text">Corpo</p>
      <ng-container ngProjectAs="[sheetFoot]">
        <button class="foot-a">A</button>
        @if (showB) {
          <button class="foot-b">B</button>
        }
      </ng-container>
    </app-mobile-sheet>
  `,
})
class HostComponent {
  closes = 0;
  showB = true;
}

describe('MobileSheetComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  const el = (): HTMLElement => fixture.nativeElement;

  it('põe cada parte no seu lugar', () => {
    expect(el().querySelector('.sh-head h3')?.textContent).toBe('Título');
    expect(el().querySelector('.sh-body .body-text')).not.toBeNull();
    // Os botões do rodapé ficam filhos diretos do .sh-foot, para o gap os separar.
    const foot = el().querySelector('.sh-foot')!;
    expect(Array.from(foot.children).map(c => c.className)).toEqual(['foot-a', 'foot-b']);
    expect(el().querySelector('.sh-body h3')).toBeNull();
  });

  it('fecha pelo fundo escurecido e pelo botão de fechar', () => {
    el().querySelector<HTMLElement>('.m-scrim')!.click();
    el().querySelector<HTMLButtonElement>('.sh-close')!.click();

    expect(fixture.componentInstance.closes).toBe(2);
  });

  it('volta o corpo ao topo', () => {
    const body = el().querySelector<HTMLElement>('.sh-body')!;
    body.scrollTop = 120;
    const sheet = fixture.debugElement.children[0].componentInstance as MobileSheetComponent;

    sheet.scrollToTop();

    expect(body.scrollTop).toBe(0);
  });
});
