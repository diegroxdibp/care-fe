import {
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { animate, style, transition, trigger } from '@angular/animations';
import { take, Subscription } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { SchedulingService } from '../../../shared/services/scheduling.service';
import { SchedulingFormControls } from '../../../shared/enums/scheduling-form-controls.enum';
import { SchedulingSteps } from '../../../shared/enums/scheduling-steps.enum';
import { Modality } from '../../../shared/enums/modality.enum';
import { ProfessionalSessionService } from '../../../shared/enums/professional-session-service.enum';
import { AvailabilityModel } from '../../../shared/models/availability.model';
import { Professional } from '../../../shared/models/get-professional-by-service-response.model';
import { ProfessionalService } from '../../../shared/models/professional-service.model';
import { emptyAvailabilityConfiguration } from '../../../shared/models/input-configuration-objects/availability-configuration-object';
import { parseDate, formatTime } from '../../../shared/utils/date-helper.util';
import { detectBrowserTimezone, isWallTimePast, zonedWallTimeToInstant } from '../../../shared/utils/timezones.util';
import { SessionService } from '../../../shared/services/session.service';
import { Router } from '@angular/router';
import { Currency, formatPrice } from '../../../shared/enums/currency.enum';
import { Pages } from '../../../shared/enums/pages.enum';
import { getBookableModalities } from '../../../shared/utils/modality-compatibility.util';

const PT_MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

@Component({
  selector: 'app-scheduling',
  imports: [],
  templateUrl: './scheduling.component.html',
  styleUrl: './scheduling.component.scss',
  animations: [
    // O bloco de Endereço/Plataforma aparece e troca de conteúdo conforme a
    // modalidade escolhida. Sem isto o texto mudava de repente, e como os dois
    // textos têm comprimentos diferentes a troca lia-se como um salto.
    //
    // Só opacidade: animar a altura entre uma morada e um parágrafo sobre a
    // plataforma faria a caixa esticar e encolher a cada clique.
    trigger('detailSwap', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-4px)' }),
        animate('200ms ease', style({ opacity: 1, transform: 'none' })),
      ]),
      // O elemento é reaproveitado quando se troca de modalidade, por isso a
      // transição é disparada pela mudança de estado e não por :enter.
      transition('* => *', [
        style({ opacity: 0 }),
        animate('200ms ease', style({ opacity: 1 })),
      ]),
    ]),
  ],
})
export class SchedulingComponent implements OnDestroy {
  private readonly apiService = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  readonly schedulingService = inject(SchedulingService);
  private readonly sessionService = inject(SessionService);
  private readonly router = inject(Router);
  private readonly elRef = inject(ElementRef);
  private readonly subs: Subscription[] = [];

  readonly Modality = Modality;
  readonly modalities = Object.values(Modality);
  readonly weekdays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  readonly openDropdown = signal<'service' | 'professional' | 'date' | null>(null);
  readonly calendarViewDate = signal<Date>(new Date());
  readonly expandedSlotId = signal<number | null>(null);
  readonly confirmedSlotId = signal<number | null>(null);
  readonly slotModality = signal<Modality | null>(null);
  readonly toast = signal<string | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  readonly calendarDays = computed(() => {
    const view = this.calendarViewDate();
    const year = view.getFullYear();
    const month = view.getMonth();
    const offset = new Date(year, month, 1).getDay();
    const days: Array<{ date: Date; inMonth: boolean; key: string }> = [];

    for (let i = offset - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, inMonth: false, key: this.toKey(d) });
    }

    const total = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= total; i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, inMonth: true, key: this.toKey(d) });
    }

    while (days.length < 42) {
      const prev = days[days.length - 1].date;
      const d = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 1);
      days.push({ date: d, inMonth: false, key: this.toKey(d) });
    }

    return days;
  });

  readonly monthLabel = computed(() => {
    const d = this.calendarViewDate();
    return `${PT_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  });

  constructor() {
    const svcCtrl = this.schedulingService.schedulingForm.controls[SchedulingFormControls.SELECTED_SERVICE];

    this.apiService.getServices().pipe(take(1)).subscribe((services: ProfessionalService[]) => {
      this.schedulingService.services = services;

      const wantedService = this.route.snapshot.queryParamMap.get('service');
      const preselected = wantedService
        ? services.find((s) => s.name === wantedService)
        : null;
      if (preselected) {
        svcCtrl.setValue(preselected);
      }
    });

    this.subs.push(svcCtrl.valueChanges.subscribe((svc: ProfessionalService | null) => {
      this.schedulingService.clearChainedRelatedFields(SchedulingSteps.SERVICE_SELECTION);
      this.confirmedSlotId.set(null);
      if (svc?.id) {
        this.apiService.getProfessionalByService(svc.id).pipe(take(1)).subscribe((p: Professional[]) => {
          this.schedulingService.professionals = p;
        });
      }
    }));

    const profCtrl = this.schedulingService.schedulingForm.controls[SchedulingFormControls.SELECTED_PROFESSIONAL];
    this.subs.push(profCtrl.valueChanges.subscribe((prof: Professional | null) => {
      this.schedulingService.clearChainedRelatedFields(SchedulingSteps.PROFESSIONAL_SELECTION);
      this.schedulingService.availabilityConfiguration.set(emptyAvailabilityConfiguration);
      this.confirmedSlotId.set(null);
      if (prof) {
        this.apiService.getAvailabilitiesByProfessionalId(prof.id).pipe(take(1)).subscribe((av: AvailabilityModel[]) => {
          const serviceId = this.selectedService?.id;
          const forService = serviceId
            ? av.filter(a => a.services?.some(s => s.id === serviceId))
            : av;
          this.schedulingService.setAvailabilitites(forService);
        });
      }
    }));

    const dayCtrl = this.schedulingService.schedulingForm.controls[SchedulingFormControls.SELECTED_DAY];
    this.subs.push(dayCtrl.valueChanges.subscribe(() => {
      this.schedulingService.clearChainedRelatedFields(SchedulingSteps.DATE_SELECTION);
      this.schedulingService.availabilityConfiguration.set(emptyAvailabilityConfiguration);
      this.expandedSlotId.set(null);
      this.confirmedSlotId.set(null);
      this.slotModality.set(null);
    }));
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  @HostListener('document:mousedown')
  onDocClick(): void {
    this.openDropdown.set(null);
  }

  get selectedService(): ProfessionalService | null {
    const v = this.schedulingService.schedulingForm.controls[SchedulingFormControls.SELECTED_SERVICE].value;
    return v?.id ? v : null;
  }

  get selectedProfessional(): Professional | null {
    return this.schedulingService.schedulingForm.controls[SchedulingFormControls.SELECTED_PROFESSIONAL].value;
  }

  get selectedDay(): string | null {
    return this.schedulingService.schedulingForm.controls[SchedulingFormControls.SELECTED_DAY].value;
  }

  allowedModalitiesFor(slot: AvailabilityModel): Modality[] {
    return getBookableModalities(slot.modality);
  }

  isModalityAllowed(m: Modality, slot: AvailabilityModel): boolean {
    return this.allowedModalitiesFor(slot).includes(m);
  }

  get filteredSlots(): AvailabilityModel[] {
    const day = this.selectedDay;
    if (!day) return [];
    const slots = this.schedulingService.filterAvailabilityForDay(
      this.schedulingService.availability(),
      parseDate(day),
    );
    return slots
      .filter(s => !(s.bookedDates ?? []).includes(day) || this.confirmedSlotId() === s.id)
      // Um horário de hoje cuja hora já passou não é mais uma opção — só a
      // data já era filtrada, e "hoje" ficava com manhãs oferecidas à tarde.
      .filter(s => this.confirmedSlotId() === s.id || !isWallTimePast(day, s.startTime, s.timeZone))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  serviceName(name: string): string {
    return ProfessionalSessionService[name as keyof typeof ProfessionalSessionService] || name;
  }

  /**
   * Hora do slot já no fuso do paciente, em 24h.
   *
   * A pessoa profissional escreve '14:00' no relógio dela; quem marca a partir
   * do Brasil tem de ver a hora dela, não o número cru — é essa confusão que
   * faz alguém aparecer com horas de diferença.
   */
  fmtTime(t: string, timeZone?: string): string {
    if (!timeZone || !this.selectedDay) return formatTime(t);

    const instant = zonedWallTimeToInstant(this.selectedDay, t, timeZone);
    if (!instant) return formatTime(t);

    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: this.sessionService.user()?.timeZone || detectBrowserTimezone(),
    }).format(instant);
  }

  fmtDate(key: string | null): string {
    if (!key) return '';
    const [y, m, d] = key.split('-');
    return `${d}/${m}/${y}`;
  }

  toggleDropdown(name: 'service' | 'professional' | 'date'): void {
    this.openDropdown.update(v => v === name ? null : name);
  }

  selectService(svc: ProfessionalService): void {
    this.schedulingService.schedulingForm.controls[SchedulingFormControls.SELECTED_SERVICE].setValue(svc);
    this.openDropdown.set(null);
  }

  selectProfessional(prof: Professional): void {
    this.schedulingService.schedulingForm.controls[SchedulingFormControls.SELECTED_PROFESSIONAL].setValue(prof);
    this.openDropdown.set(null);
  }

  selectDate(key: string): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = key.split('-').map(Number);
    if (new Date(y, m - 1, d) < today) return;
    if (!this.schedulingService.timeSlots.has(key)) return;
    this.schedulingService.schedulingForm.controls[SchedulingFormControls.SELECTED_DAY].setValue(key);
    this.openDropdown.set(null);
  }

  prevMonth(): void {
    const d = this.calendarViewDate();
    this.calendarViewDate.set(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  nextMonth(): void {
    const d = this.calendarViewDate();
    this.calendarViewDate.set(new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  isPast(date: Date): boolean {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return date < t;
  }

  isToday(date: Date): boolean {
    const t = new Date();
    return date.getFullYear() === t.getFullYear() &&
      date.getMonth() === t.getMonth() &&
      date.getDate() === t.getDate();
  }

  toggleSlot(id: number): void {
    if (this.expandedSlotId() === id) {
      this.expandedSlotId.set(null);
      return;
    }
    this.expandedSlotId.set(id);
    const slot = this.filteredSlots.find(s => s.id === id);
    const allowed = slot ? this.allowedModalitiesFor(slot) : [];
    // Numa vaga que aceita as duas, nada vem pré-escolhido: quem marca tem de
    // dizer como quer ser atendida antes de continuar.
    this.slotModality.set(allowed.length === 1 ? allowed[0] : null);
  }

  /** Moeda de cobrança do perfil. Não há seletor de moeda neste fluxo. */
  get displayCurrency(): Currency {
    return this.sessionService.user()?.currency ?? Currency.EUR;
  }

  /** Valor na moeda do usuário. O cliente nunca converte. */
  slotAmount(slot: AvailabilityModel): number | null {
    const raw = this.displayCurrency === Currency.BRL ? slot.priceBRL : slot.price;
    return raw && raw > 0 ? raw : null;
  }

  /**
   * Preço formatado, ou o texto combinável. Nunca mostramos '0 €' nem
   * escondemos a linha — a ausência de preço é uma informação, não um vazio.
   */
  slotPriceLabel(slot: AvailabilityModel, tight = false): string {
    const amount = this.slotAmount(slot);
    if (amount === null) return tight ? 'a combinar' : 'valor a combinar';
    return formatPrice(amount, this.displayCurrency);
  }

  hasPrice(slot: AvailabilityModel): boolean {
    return this.slotAmount(slot) !== null;
  }

  /** Texto de apoio da modalidade na linha fechada. */
  modalityWords(slot: AvailabilityModel): Modality[] {
    return this.allowedModalitiesFor(slot);
  }

  /** Endereço ou plataforma, conforme a modalidade escolhida. */
  detailFor(slot: AvailabilityModel): { icon: string; label: string; body: string } | null {
    const modality = this.slotModality();
    if (!modality) return null;
    if (modality === Modality.LOCAL) {
      return { icon: 'place', label: 'Endereço', body: slot.address?.trim() || 'a combinar' };
    }
    return { icon: 'videocam', label: 'Plataforma', body: slot.platform?.trim() || 'a combinar' };
  }

  canContinue(): boolean {
    return this.slotModality() !== null;
  }

  /**
   * Guarda a escolha e segue para a revisão. Deixou de marcar diretamente: a
   * confirmação passou a ser um passo próprio, que mais tarde recebe o
   * pagamento sem reestruturar nada.
   */
  continuar(slot: AvailabilityModel): void {
    const modality = this.slotModality();
    const day = this.selectedDay;
    if (!modality || modality === Modality.ANY || !day) return;

    this.schedulingService.pendingBooking.set({
      availability: slot,
      modality,
      dayKey: day,
      currency: this.displayCurrency,
      amount: this.slotAmount(slot),
      paymentMethod: null,
    });

    const fc = this.schedulingService.schedulingForm.controls;
    fc[SchedulingFormControls.SELECTED_MODALITY].setValue(modality);
    fc[SchedulingFormControls.SELECTED_AVAILABILITY].setValue(slot);

    this.router.navigate([Pages.SCHEDULING, 'confirmar']);
  }

  confirmSlot(slot: AvailabilityModel): void {
    const modality = this.slotModality();
    const fc = this.schedulingService.schedulingForm.controls;
    fc[SchedulingFormControls.SELECTED_MODALITY].setValue(modality);
    fc[SchedulingFormControls.SELECTED_AVAILABILITY].setValue(slot);
    this.apiService.setAppointment(this.schedulingService.getAppointmentPayload()).subscribe({
      next: () => {
        this.confirmedSlotId.set(slot.id);
        const bookedDay = this.selectedDay;
        this.schedulingService.availability.update(list =>
          list.map(a => a.id === slot.id && bookedDay
            ? { ...a, bookedDates: [...(a.bookedDates ?? []), bookedDay] }
            : a),
        );
        const date = this.fmtDate(this.selectedDay);
        this.showToast(
          `Sessão agendada · ${slot.professionalName} · ${date} · ${this.fmtTime(slot.startTime)} · ${modality}.`
        );
      },
      error: () => {},
    });
  }

  showToast(msg: string): void {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 2800);
  }

  private toKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
