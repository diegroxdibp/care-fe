import { CommonModule, DatePipe } from '@angular/common';
import { Component, Injectable, Input, OnInit } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
  DateAdapter,
  MAT_DATE_FORMATS,
  NativeDateAdapter,
} from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MaskitoDirective } from '@maskito/angular';
import { AppConstants } from '../../../app-constants';
import { MaskitoOptions } from '@maskito/core';
import pastDateMask from '../../masks/past-date.mask';
import { AvailabilityModel } from '../../models/availability.model';
import { MatSelectModule } from '@angular/material/select';
import {
  CalendarConfigurationObject,
  emptyCalendarConfiguration,
} from '../../models/input-configuration-objects/calendar-configuration-object';
import { CalendarType } from '../../enums/calendar-type.enum';
import { DayOfWeek } from '../../enums/day-of-week.enum';

export const DD_MM_YYYY_FORMAT = {
  parse: {
    dateInput: 'DD/MM/YYYY',
  },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

@Injectable()
export class CustomDateAdapter extends NativeDateAdapter {
  override parse(value: any): Date | null {
    if (typeof value === 'string') {
      const parts = value.split('/');
      if (parts.length === 3) {
        const day = Number(parts[0]);
        const month = Number(parts[1]) - 1;
        const year = Number(parts[2]);
        return new Date(year, month, day);
      }
    }
    return super.parse(value);
  }

  override format(date: Date, displayFormat: Object): string {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${this.to2digit(day)}/${this.to2digit(month)}/${year}`;
  }

  private to2digit(n: number): string {
    return ('00' + n).slice(-2);
  }
}

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MaskitoDirective,
    FormsModule,
    MatSelectModule,
  ],
  providers: [
    DatePipe,
    { provide: DateAdapter, useClass: CustomDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: DD_MM_YYYY_FORMAT },
  ],
})
export class CalendarComponent implements OnInit {
  @Input({ required: true })
  calendarConfiguration: CalendarConfigurationObject =
    emptyCalendarConfiguration;
  @Input({ required: false }) availability: AvailabilityModel[] = [];

  readonly options: MaskitoOptions = pastDateMask;
  allowedRecurringDays: Set<number> = new Set();
  allowedSpecificDates: Set<string> = new Set(); // Changed to Set<string> for better comparison
  dateControl = new FormControl<Date | null>(null);

  constructor(private datePipe: DatePipe) {}

  ngOnInit() {
    console.log('=== AVAILABILITIES ===');
    console.log(JSON.stringify(this.availability, null, 2));

    for (const availability of this.availability) {
      const booked = new Set(availability.bookedDates ?? []);

      // Uma vaga recorrente não se salta inteira por estar ocupada nalgumas
      // datas — o dia da semana continua disponível e a ocupação é resolvida
      // por data mais à frente. Só a vaga pontual desaparece quando é ocupada.
      if (availability.isRecurring && availability.dayOfWeek) {
        const dayOfWeek = this.getDayNumber(availability.dayOfWeek);
        console.log(
          `Adding recurring day: ${availability.dayOfWeek} (${dayOfWeek})`,
        );
        this.allowedRecurringDays.add(dayOfWeek);
      } else if (!availability.isRecurring && availability.startDate) {
        if (booked.has(availability.startDate)) {
          continue;
        }
        // Store as YYYY-MM-DD string for easier comparison
        this.allowedSpecificDates.add(availability.startDate);
      }
    }

    console.log(
      'Allowed recurring days:',
      Array.from(this.allowedRecurringDays),
    );
    console.log(
      'Allowed specific dates:',
      Array.from(this.allowedSpecificDates),
    );

    this.dateControl.valueChanges.subscribe((value) => {
      if (value) {
        const isoDate = this.datePipe.transform(value, 'yyyy-MM-dd');
        this.calendarConfiguration.control.setValue(isoDate);
      }
    });
  }

  isDateAllowed = (date: Date | null): boolean => {
    if (!date) {
      console.log('Date is null');
      return false;
    }

    // For non-scheduling calendars, allow all dates
    if (this.calendarConfiguration.calendarType !== CalendarType.SCHEDULING) {
      return true;
    }

    const dayOfWeek = date.getDay();
    const dateString = this.datePipe.transform(date, 'yyyy-MM-dd');

    // Check recurring days
    if (this.allowedRecurringDays.has(dayOfWeek)) {
      console.log(`Date ${dateString} allowed (recurring ${dayOfWeek})`);
      return true;
    }

    // Check specific dates
    if (dateString && this.allowedSpecificDates.has(dateString)) {
      console.log(`Date ${dateString} allowed (specific date)`);
      return true;
    }

    return false;
  };

  getDayNumber(day: DayOfWeek | string): number {
    // Map string keys to day numbers
    const dayMap: { [key: string]: number } = {
      SUNDAY: 0,
      MONDAY: 1,
      TUESDAY: 2,
      WEDNESDAY: 3,
      THURSDAY: 4,
      FRIDAY: 5,
      SATURDAY: 6,
    };

    return dayMap[day] ?? -1;
  }

  get minDate(): Date {
    if (this.calendarConfiguration.calendarType === CalendarType.SCHEDULING) {
      return AppConstants.scheduling.minDate;
    }
    if (this.calendarConfiguration.calendarType === CalendarType.BIRTHDATE) {
      return AppConstants.birthdate.maxDate;
    }
    return new Date();
  }

  get maxDate(): Date {
    if (this.calendarConfiguration.calendarType === CalendarType.SCHEDULING) {
      return AppConstants.scheduling.maxDate;
    }
    if (this.calendarConfiguration.calendarType === CalendarType.BIRTHDATE) {
      return AppConstants.birthdate.minDate;
    }
    return new Date();
  }
}
