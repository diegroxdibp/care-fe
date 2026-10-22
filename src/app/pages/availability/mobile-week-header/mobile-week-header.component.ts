import { Component, input, output, signal } from '@angular/core';

const PT_DOW_SHORT = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];

// Top of the availability page's mobile layout: the month title, the week
// navigation popover, the avatar, and the Monday-to-Sunday day strip. The
// page owns the week and the selected day; this only shows them and reports
// clicks.
@Component({
  selector: 'app-mobile-week-header',
  standalone: true,
  templateUrl: './mobile-week-header.component.html',
  styleUrl: './mobile-week-header.component.scss',
})
export class MobileWeekHeaderComponent {
  readonly monthLabel = input.required<string>();
  readonly weekRangeLabel = input.required<string>();
  readonly weekLabel = input.required<string>();
  readonly initials = input.required<string>();
  readonly days = input.required<Date[]>();
  readonly daysWithBlocks = input.required<boolean[]>();
  readonly selectedIndex = input.required<number>();

  readonly prevWeek = output<void>();
  readonly nextWeek = output<void>();
  readonly today = output<void>();
  readonly daySelect = output<number>();

  readonly PT_DOW_SHORT = PT_DOW_SHORT;
  readonly weekNavOpen = signal<boolean>(false);

  goToToday(): void {
    this.today.emit();
    this.weekNavOpen.set(false);
  }
}
