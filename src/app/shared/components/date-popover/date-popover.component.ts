import { Component, HostListener, OnInit, computed, input, output, signal } from '@angular/core';

const PT_MONTHS = [
  'janeiro','fevereiro','março','abril','maio','junho',
  'julho','agosto','setembro','outubro','novembro','dezembro',
];
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Month-grid popover for picking a single future date, shown under a date
// field. The parent owns the field and whether the popover is open (render it
// inside an @if); this only handles month navigation and the day grid. Dates
// are "yyyy-MM-dd" keys in the browser's local calendar, and past days are
// disabled.
@Component({
  selector: 'app-date-popover',
  standalone: true,
  templateUrl: './date-popover.component.html',
  styleUrl: './date-popover.component.scss',
})
export class DatePopoverComponent implements OnInit {
  readonly selected = input('');
  readonly dateSelect = output<string>();

  readonly weekdays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  readonly viewDate = signal<Date>(new Date());

  readonly monthLabel = computed(() => {
    const d = this.viewDate();
    return `${capitalize(PT_MONTHS[d.getMonth()])} ${d.getFullYear()}`;
  });

  readonly days = computed(() => {
    const view = this.viewDate();
    const year = view.getFullYear();
    const month = view.getMonth();
    const offset = new Date(year, month, 1).getDay();
    const days: Array<{ date: Date; inMonth: boolean; key: string }> = [];
    for (let i = offset - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, inMonth: false, key: toKey(d) });
    }
    const total = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= total; i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, inMonth: true, key: toKey(d) });
    }
    while (days.length < 42) {
      const prev = days[days.length - 1].date;
      const d = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 1);
      days.push({ date: d, inMonth: false, key: toKey(d) });
    }
    return days;
  });

  // Opens on the selected date's month (or this month when nothing is picked).
  ngOnInit(): void {
    const selected = this.selected();
    if (selected) this.viewDate.set(new Date(selected + 'T00:00:00'));
  }

  // Clicks inside the popover must not reach the parent's field (which toggles
  // it) or a document-level listener (which closes it).
  @HostListener('click', ['$event'])
  onClick(event: MouseEvent): void { event.stopPropagation(); }

  prevMonth(): void {
    const d = this.viewDate();
    this.viewDate.set(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  nextMonth(): void {
    const d = this.viewDate();
    this.viewDate.set(new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  isPast(date: Date): boolean {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return date < t;
  }

  isToday(date: Date): boolean {
    const t = new Date();
    return date.getFullYear() === t.getFullYear() &&
      date.getMonth() === t.getMonth() &&
      date.getDate() === t.getDate();
  }
}
