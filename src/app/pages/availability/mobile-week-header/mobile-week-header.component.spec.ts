import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MobileWeekHeaderComponent } from './mobile-week-header.component';

describe('MobileWeekHeaderComponent', () => {
  let fixture: ComponentFixture<MobileWeekHeaderComponent>;
  let component: MobileWeekHeaderComponent;

  // Segunda 19 a domingo 25 de outubro de 2026.
  const week = Array.from({ length: 7 }, (_, i) => new Date(2026, 9, 19 + i));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MobileWeekHeaderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MobileWeekHeaderComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('monthLabel', 'Outubro');
    fixture.componentRef.setInput('weekRangeLabel', '19 – 25 out');
    fixture.componentRef.setInput('weekLabel', '19 – 25 de outubro');
    fixture.componentRef.setInput('initials', 'DP');
    fixture.componentRef.setInput('days', week);
    fixture.componentRef.setInput('daysWithBlocks', [true, false, false, true, false, false, false]);
    fixture.componentRef.setInput('selectedIndex', 3);
    fixture.detectChanges();
  });

  const el = (): HTMLElement => fixture.nativeElement;
  const dayButtons = (): HTMLButtonElement[] => Array.from(el().querySelectorAll('.m-day'));

  it('mostra a semana, o dia escolhido e os dias com blocos', () => {
    expect(el().querySelector('.m-title')?.textContent).toContain('Outubro');
    expect(el().querySelector('.m-avatar')?.textContent?.trim()).toBe('DP');
    expect(dayButtons().map(b => b.querySelector('.dn')?.textContent?.trim()))
      .toEqual(['19', '20', '21', '22', '23', '24', '25']);
    expect(dayButtons().map(b => b.querySelector('.wd')?.textContent?.trim()).join(''))
      .toBe('STQQSSD');
    expect(dayButtons()[3].classList).toContain('sel');
    expect(dayButtons().map(b => !b.querySelector('.dot')?.classList.contains('hidden')))
      .toEqual([true, false, false, true, false, false, false]);
  });

  it('emite o dia tocado', () => {
    const picked: number[] = [];
    component.daySelect.subscribe(i => picked.push(i));

    dayButtons()[5].click();

    expect(picked).toEqual([5]);
  });

  it('abre a navegação semanal e emite as setas', () => {
    const events: string[] = [];
    component.prevWeek.subscribe(() => events.push('prev'));
    component.nextWeek.subscribe(() => events.push('next'));
    const toggle = el().querySelector<HTMLButtonElement>('.m-icon')!;

    expect(el().querySelector('.m-week-pop')).toBeNull();
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    const arrows = el().querySelectorAll<HTMLButtonElement>('.wp-arrow');
    arrows[0].click();
    arrows[1].click();
    expect(events).toEqual(['prev', 'next']);
    expect(el().querySelector('.m-week-pop')).not.toBeNull();
  });

  it('"Hoje" emite e fecha a navegação semanal', () => {
    let today = 0;
    component.today.subscribe(() => today++);
    el().querySelector<HTMLButtonElement>('.m-icon')!.click();
    fixture.detectChanges();

    el().querySelector<HTMLButtonElement>('.wp-today')!.click();
    fixture.detectChanges();

    expect(today).toBe(1);
    expect(el().querySelector('.m-week-pop')).toBeNull();
  });
});
