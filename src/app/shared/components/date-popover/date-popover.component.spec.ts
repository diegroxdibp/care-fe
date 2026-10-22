import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DatePopoverComponent } from './date-popover.component';

describe('DatePopoverComponent', () => {
  let fixture: ComponentFixture<DatePopoverComponent>;
  let component: DatePopoverComponent;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 22, 10, 0));
    await TestBed.configureTestingModule({
      imports: [DatePopoverComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DatePopoverComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => jest.useRealTimers());

  const dayButtons = (): HTMLButtonElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('.cal-day'));
  const button = (key: string): HTMLButtonElement =>
    dayButtons()[component.days().findIndex(c => c.key === key)];

  it('abre no mês de hoje quando não há data escolhida', () => {
    fixture.detectChanges();

    expect(component.monthLabel()).toBe('Outubro 2026');
    expect(dayButtons().length).toBe(42);
    // 1 de outubro de 2026 é uma quinta-feira: a grelha começa no domingo 27/09.
    expect(component.days()[0].key).toBe('2026-09-27');
  });

  it('abre no mês da data escolhida e marca-a', () => {
    fixture.componentRef.setInput('selected', '2026-12-03');
    fixture.detectChanges();

    expect(component.monthLabel()).toBe('Dezembro 2026');
    expect(button('2026-12-03').classList).toContain('selected');
  });

  it('desativa os dias passados e os de fora do mês, mas não hoje', () => {
    fixture.detectChanges();

    expect(button('2026-10-21').disabled).toBe(true);
    expect(button('2026-09-30').disabled).toBe(true);
    expect(button('2026-10-22').disabled).toBe(false);
    expect(button('2026-10-22').classList).toContain('today');
  });

  it('navega entre meses', () => {
    fixture.detectChanges();

    component.nextMonth();
    expect(component.monthLabel()).toBe('Novembro 2026');
    component.prevMonth();
    component.prevMonth();
    expect(component.monthLabel()).toBe('Setembro 2026');
  });

  it('emite a data clicada sem deixar o clique chegar ao campo', () => {
    fixture.detectChanges();
    const picked: string[] = [];
    component.dateSelect.subscribe(key => picked.push(key));
    const parentClick = jest.fn();
    fixture.nativeElement.parentElement.addEventListener('click', parentClick);

    button('2026-10-30').click();

    expect(picked).toEqual(['2026-10-30']);
    expect(parentClick).not.toHaveBeenCalled();
  });
});
