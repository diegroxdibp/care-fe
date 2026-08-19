import { SchedulingFormControls } from './../enums/scheduling-form-controls.enum';
import { Injectable, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AvailabilityModel } from '../models/availability.model';
import { AppointmentPayload } from '../models/appointment-payload.model';
import {
  dayName,
  isBetween,
  parseDate,
  sameDay,
} from '../utils/date-helper.util';
import {
  emptyProfessionalService,
  ProfessionalService,
} from '../models/professional-service.model';
import { ProfessionalSessionService } from '../enums/professional-session-service.enum';
import { Professional } from '../models/get-professional-by-service-response.model';
import { SchedulingFormModel } from '../models/input-configuration-objects/scheduling-form-controls.model';
import { SchedulingSteps } from '../enums/scheduling-steps.enum';
import { Modality } from '../enums/modality.enum';
import { Currency } from '../enums/currency.enum';
import { PaymentMethod } from '../enums/payment-method.enum';
import {
  AvailabilityConfigurationObject,
  emptyAvailabilityConfiguration,
} from '../models/input-configuration-objects/availability-configuration-object';
import { occursOnDate } from '../utils/recurrence.util';
import { isWallTimePast } from '../utils/timezones.util';

/**
 * Escolha feita no passo 1 e revista no passo 2.
 *
 * Guarda a moeda e o valor cobrados no momento: se a pessoa mudar a preferência
 * de moeda entretanto, a sessão em revisão continua a valer o que foi mostrado.
 */
export interface PendingBooking {
  availability: AvailabilityModel;
  modality: Modality.LOCAL | Modality.REMOTE;
  dayKey: string;
  currency: Currency;
  amount: number | null;
  paymentMethod: PaymentMethod | null;
}

const dayNumberToEnum: { [key: number]: string } = {
  0: 'SUNDAY',
  1: 'MONDAY',
  2: 'TUESDAY',
  3: 'WEDNESDAY',
  4: 'THURSDAY',
  5: 'FRIDAY',
  6: 'SATURDAY',
};
@Injectable({
  providedIn: 'root',
})
export class SchedulingService {
  schedulingForm: FormGroup<SchedulingFormModel>;
  availability = signal<AvailabilityModel[]>([]);
  timeSlots = new Map<string, string[]>();
  services: ProfessionalService[] = [];
  professionals: Professional[] = [];
  availabilityConfiguration = signal<AvailabilityConfigurationObject>(
    emptyAvailabilityConfiguration,
  );
  ProfessionalSessionService = ProfessionalSessionService;

  /**
   * Seleção pendente entre a lista de horários e a confirmação. A rota de
   * confirmação exige isto preenchido; sem ela volta-se à lista.
   */
  readonly pendingBooking = signal<PendingBooking | null>(null);

  clearPendingBooking(): void {
    this.pendingBooking.set(null);
  }

  constructor(private readonly fb: FormBuilder) {
    this.schedulingForm = this.fb.group<SchedulingFormModel>({
      [SchedulingFormControls.CLIENT_ID]: this.fb.control(
        null,
        Validators.required,
      ),

      [SchedulingFormControls.SELECTED_SERVICE]: this.fb.control(
        emptyProfessionalService,
        Validators.required,
      ),

      [SchedulingFormControls.SELECTED_DAY]: this.fb.control(
        null,
        Validators.required,
      ),

      [SchedulingFormControls.SELECTED_TIME_SLOT]: this.fb.control(
        null,
        Validators.required,
      ),

      [SchedulingFormControls.SELECTED_PROFESSIONAL]: this.fb.control(
        null,
        Validators.required,
      ),

      [SchedulingFormControls.SELECTED_MODALITY]: this.fb.control(
        null,
        Validators.required,
      ),

      [SchedulingFormControls.SELECTED_AVAILABILITY]: this.fb.control(
        null,
        Validators.required,
      ),
    });
  }

  getAppointmentPayload(): AppointmentPayload {
    const fc = this.schedulingForm.controls;
    const rawModality = fc[SchedulingFormControls.SELECTED_MODALITY].value as string;
    const MODALITY_MAP: Record<string, string> = {
      'Qualquer': 'ANY',
      'Presencial': 'LOCAL',
      'Remoto': 'REMOTE',
    };
    const payload = {
      availabilityId: fc[SchedulingFormControls.SELECTED_AVAILABILITY].value?.id,
      professionalServiceId: fc[SchedulingFormControls.SELECTED_SERVICE].value?.id,
      appointmentDate: fc[SchedulingFormControls.SELECTED_DAY].value,
      startTime: fc[SchedulingFormControls.SELECTED_AVAILABILITY].value?.startTime,
      endTime: fc[SchedulingFormControls.SELECTED_AVAILABILITY].value?.endTime,
      // Booking via Agendar is always a single session — the availability slot
      // itself may recur weekly, but that doesn't make this particular booking recurring.
      isRecurring: false,
      modality: MODALITY_MAP[rawModality] ?? rawModality,
    } as AppointmentPayload;
    return payload;
  }

  setAvailabilitites(availabilities: AvailabilityModel[]): void {
    this.availability.set(availabilities);
    this.timeSlots.clear(); // Clear existing timeSlots

    // Comparação por instante real (para não oferecer um horário de hoje que
    // já passou), separada de `now` abaixo, truncada à meia-noite para
    // comparação por dia.
    const nowInstant = new Date();
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const maxDate = new Date(new Date().setMonth(new Date().getMonth() + 2)); // Calendar limit
    maxDate.setHours(23, 59, 59, 999);

    for (const availability of availabilities) {
      // A ocupação é por data: uma vaga quinzenal ocupada numa semana continua
      // livre na seguinte. Saltar a série inteira escondia as semanas livres.
      const booked = new Set(availability.bookedDates ?? []);

      const timeSlot = `${availability.startTime} - ${availability.endTime}`;

      if (availability.isRecurring && availability.dayOfWeek) {
        // A âncora é sempre a startDate original. Avançar o cursor para hoje
        // (abaixo) não pode substituí-la: a paridade de uma vaga quinzenal
        // conta-se a partir da data em que a série começou, e usar o cursor
        // como âncora oferecia justamente a semana errada.
        const anchor = new Date(availability.startDate);
        anchor.setHours(0, 0, 0, 0);

        let current = new Date(anchor);

        // Start from today or availability start date, whichever is later
        if (current < now) {
          current = new Date(now);
        }

        const recurringEnd = new Date(availability.endDate);
        recurringEnd.setHours(23, 59, 59, 999);
        const end = recurringEnd < maxDate ? recurringEnd : maxDate;

        let datesAdded = 0;
        while (current <= end) {
          const currentDayName = dayNumberToEnum[current.getDay()];

          if (
            currentDayName === availability.dayOfWeek &&
            // Sem isto uma vaga quinzenal/mensal era oferecida em todas as
            // semanas com aquele dia — o cliente via semanas que a pessoa
            // profissional nunca abriu.
            occursOnDate(availability.recurrenceFrequency, anchor, current)
          ) {
            const key = this.formatDateKey(current);

            if (
              !booked.has(key) &&
              !isWallTimePast(key, availability.startTime, availability.timeZone, nowInstant)
            ) {
              if (!this.timeSlots.has(key)) {
                this.timeSlots.set(key, []);
              }
              this.timeSlots.get(key)!.push(timeSlot);
              datesAdded++;
            }
          }
          current.setDate(current.getDate() + 1);
        }
      } else if (!availability.isRecurring) {
        const start = new Date(availability.startDate);
        start.setHours(0, 0, 0, 0);

        if (start >= now && start <= maxDate) {
          const key = this.formatDateKey(start);

          if (
            !booked.has(key) &&
            !isWallTimePast(key, availability.startTime, availability.timeZone, nowInstant)
          ) {
            if (!this.timeSlots.has(key)) {
              this.timeSlots.set(key, []);
            }
            this.timeSlots.get(key)!.push(timeSlot);
          }
        }
      }
    }
  }

  private formatDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`; // yyyy-mm-dd
  }

  filterAvailabilityForDay(
    allAvailabilities: AvailabilityModel[],
    selectedDate: Date,
  ): AvailabilityModel[] {
    const selectedDayName = dayName(selectedDate);

    return allAvailabilities.filter((av) => {
      const start = parseDate(av.startDate);
      const end = parseDate(av.endDate);

      // 🔁 Recurring availability
      if (av.isRecurring && av.dayOfWeek) {
        return (
          av.dayOfWeek === selectedDayName &&
          isBetween(selectedDate, start, end)
        );
      }

      // 📅 One-time availability
      if (!av.isRecurring) {
        return sameDay(start, selectedDate);
      }

      return false;
    });
  }

  clearChainedRelatedFields(step: SchedulingSteps): void {
    const controls = this.schedulingForm.controls;

    switch (step) {
      case SchedulingSteps.SERVICE_SELECTION:
        controls[SchedulingFormControls.SELECTED_PROFESSIONAL].setValue(null);
        controls[SchedulingFormControls.SELECTED_DAY].setValue(null);
        controls[SchedulingFormControls.SELECTED_AVAILABILITY].setValue(null);
        controls[SchedulingFormControls.SELECTED_MODALITY].setValue(null);
        this.professionals = [];
        this.availability.set([]);
        this.timeSlots.clear();
        break;

      case SchedulingSteps.PROFESSIONAL_SELECTION:
        controls[SchedulingFormControls.SELECTED_DAY].setValue(null);
        controls[SchedulingFormControls.SELECTED_AVAILABILITY].setValue(null);
        controls[SchedulingFormControls.SELECTED_MODALITY].setValue(null);
        this.availability.set([]);
        this.timeSlots.clear();
        break;

      case SchedulingSteps.DATE_SELECTION:
        controls[SchedulingFormControls.SELECTED_AVAILABILITY].setValue(null);
        controls[SchedulingFormControls.SELECTED_MODALITY].setValue(null);
        break;

      case SchedulingSteps.AVAILABILITY_SELECTION:
        controls[SchedulingFormControls.SELECTED_MODALITY].setValue(null);
        break;
    }
  }

  clearAvailabilities() {
    this.availability.set([]);
  }

  clearTimeSlots() {
    this.timeSlots = new Map<string, string[]>();
  }

  clearServcies() {
    this.services = [];
  }

  clearProfessionals() {
    this.professionals = [];
  }
}
