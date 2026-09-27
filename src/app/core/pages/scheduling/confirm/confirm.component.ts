import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { animate, style, transition, trigger } from '@angular/animations';
import { ApiService } from '../../../services/api.service';
import { SchedulingService } from '../../../../shared/services/scheduling.service';
import { SchedulingFormControls } from '../../../../shared/enums/scheduling-form-controls.enum';
import { FeatureFlagService } from '../../../../shared/services/feature-flag.service';
import { SessionService } from '../../../../shared/services/session.service';
import { Modality } from '../../../../shared/enums/modality.enum';
import { Currency, formatPrice } from '../../../../shared/enums/currency.enum';
import { PaymentMethod } from '../../../../shared/enums/payment-method.enum';
import { Pages } from '../../../../shared/enums/pages.enum';
import { PaymentMethodPickerComponent } from '../../../../shared/components/payment-method-picker/payment-method-picker.component';
import {
  detectBrowserTimezone,
  zonedWallTimeToInstant,
} from '../../../../shared/utils/timezones.util';
import { ProfessionalSessionService } from '../../../../shared/enums/professional-session-service.enum';
import { REMOTE_SESSION_INFO } from '../../../../shared/utils/remote-session.util';

/**
 * Textos que mudam quando o pagamento entrar. Ficam todos aqui para que ligar
 * a flag não implique caçar strings pelo template.
 */
const COPY = {
  withoutPayments: {
    heading: 'Rever antes de confirmar',
    totalLabel: 'Valor da sessão',
    action: 'Confirmar agendamento',
    finePrint: 'Pode cancelar até 24 h antes.',
  },
  withPayments: {
    heading: 'Rever e pagar',
    totalLabel: 'Total',
    action: 'Pagar e confirmar',
    finePrint: 'Reembolso integral até 24 h antes.',
  },
} as const;

@Component({
  selector: 'app-scheduling-confirm',
  imports: [PaymentMethodPickerComponent, FormsModule],
  templateUrl: './confirm.component.html',
  styleUrl: './confirm.component.scss',
  animations: [
    // Aqui a modalidade já está fixa, então só há entrada — mas mantém-se o
    // mesmo tempo e curva do bloco equivalente em Agendar, para que passar de
    // um passo ao outro não pareça outra interface.
    trigger('detailEnter', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-4px)' }),
        animate('200ms ease', style({ opacity: 1, transform: 'none' })),
      ]),
    ]),
  ],
})
export class SchedulingConfirmComponent {
  private readonly apiService = inject(ApiService);
  private readonly router = inject(Router);
  private readonly sessionService = inject(SessionService);
  readonly schedulingService = inject(SchedulingService);
  readonly featureFlags = inject(FeatureFlagService);

  readonly Modality = Modality;
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly paymentMethod = signal<PaymentMethod | null>(null);

  readonly booking = this.schedulingService.pendingBooking;

  readonly copy = computed(() =>
    this.featureFlags.paymentsEnabled() ? COPY.withPayments : COPY.withoutPayments,
  );

  readonly actionLabel = computed(() => {
    const base = this.copy().action;
    return this.featureFlags.paymentsEnabled() ? `${base} · ${this.priceLabel()}` : base;
  });

  readonly serviceName = computed(() => {
    const raw = this.schedulingService.schedulingForm.controls[
      SchedulingFormControls.SELECTED_SERVICE
    ].value?.name;
    if (!raw) return '';
    return ProfessionalSessionService[raw as keyof typeof ProfessionalSessionService] ?? raw;
  });

  readonly professionalName = computed(
    () => this.booking()?.availability.professionalName ?? '',
  );

  readonly priceLabel = computed(() => {
    const b = this.booking();
    if (!b || b.amount === null) return 'a combinar';
    return formatPrice(b.amount, b.currency);
  });

  readonly hasPrice = computed(() => this.booking()?.amount !== null);

  readonly currency = computed(() => this.booking()?.currency ?? Currency.EUR);

  /** Data e hora já no fuso de quem está a marcar. */
  readonly whenLabel = computed(() => {
    const b = this.booking();
    if (!b) return '';
    const zone = this.sessionService.user()?.timeZone || detectBrowserTimezone();
    const start = zonedWallTimeToInstant(b.dayKey, b.availability.startTime, b.availability.timeZone ?? zone);
    const end = zonedWallTimeToInstant(b.dayKey, b.availability.endTime, b.availability.timeZone ?? zone);
    if (!start || !end) return '';

    const date = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: zone,
    }).format(start);
    const time = (at: Date) =>
      new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: zone,
      }).format(at);

    return `${date} · ${time(start)} – ${time(end)}`;
  });

  readonly detail = computed(() => {
    const b = this.booking();
    if (!b) return null;
    if (b.modality === Modality.LOCAL) {
      return {
        icon: 'place',
        label: 'Endereço',
        body: b.availability.address?.trim() || 'a combinar',
      };
    }
    return {
      icon: 'videocam',
      label: 'Plataforma',
      body: REMOTE_SESSION_INFO,
    };
  });

  back(): void {
    this.router.navigate([Pages.SCHEDULING]);
  }

  confirm(): void {
    const b = this.booking();
    if (!b || this.submitting()) return;

    this.submitting.set(true);
    this.error.set(null);

    this.apiService.setAppointment(this.schedulingService.getAppointmentPayload()).subscribe({
      next: () => {
        this.schedulingService.clearPendingBooking();
        this.router.navigate([Pages.DASHBOARD]);
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(
          err?.error?.error ?? 'Não foi possível confirmar. Tente novamente.',
        );
      },
    });
  }
}
