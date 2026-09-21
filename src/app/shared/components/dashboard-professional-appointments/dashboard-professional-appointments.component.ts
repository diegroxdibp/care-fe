import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { MessageService } from '../../../core/services/message.service';
import { SessionService } from '../../services/session.service';
import { SnackbarService } from '../../services/snackbar.service';
import { FeatureFlagService } from '../../services/feature-flag.service';
import { Appointment } from '../../models/appointment.model';
import { ProfessionalService } from '../../models/professional-service.model';
import { PatientSummary } from '../../models/patient.model';
import { Currency } from '../../enums/currency.enum';
import { BuiltSession, buildSessions, canJoinSession } from '../../utils/session-list.util';
import { StyledSelectComponent, StyledSelectOption } from '../styled-select/styled-select.component';

const ALL_CLIENTS_VALUE = '';

@Component({
  selector: 'app-dashboard-professional-appointments',
  imports: [StyledSelectComponent],
  templateUrl: './dashboard-professional-appointments.component.html',
  styleUrl: './dashboard-professional-appointments.component.scss',
})
export class DashboardProfessionalAppointmentsComponent implements OnInit {
  private readonly apiService = inject(ApiService);
  private readonly sessionService = inject(SessionService);
  private readonly messageService = inject(MessageService);
  private readonly snackbarService = inject(SnackbarService);
  private readonly featureFlagService = inject(FeatureFlagService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly appointments = signal<Appointment[]>([]);
  private readonly services = signal<ProfessionalService[]>([]);
  readonly patients = signal<PatientSummary[]>([]);
  readonly loading = signal(true);

  readonly selectedClientId = signal<string>(ALL_CLIENTS_VALUE);
  readonly hidePastSessions = signal<boolean>(true);
  readonly openSessionId = signal<number | null>(null);
  /** Marcação alvo de um link direto (ex.: do email de "sessão marcada") — realçada e o alvo do scroll inicial. */
  readonly highlightedAppointmentId = signal<number | null>(null);

  readonly clientOptions = computed<StyledSelectOption[]>(() => [
    { value: ALL_CLIENTS_VALUE, label: 'Todos os pacientes' },
    ...this.patients().map(p => ({ value: String(p.id), label: p.name })),
  ]);

  private readonly filteredAppointments = computed(() => {
    const clientId = this.selectedClientId();
    if (clientId === ALL_CLIENTS_VALUE) return this.appointments();
    return this.appointments().filter(a => String(a.clientId) === clientId);
  });

  /** Todas as sessões filtradas, incluindo a de destaque. */
  readonly sessions = computed(() =>
    buildSessions(this.filteredAppointments(), this.services(), {
      perspective: 'PROFESSIONAL',
      currency: this.sessionService.user()?.currency ?? Currency.EUR,
      paymentsEnabled: this.featureFlagService.paymentsEnabled(),
    }),
  );

  readonly nextSession = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.sessions().find(s => s.date >= today) ?? null;
  });

  readonly upcomingSessions = computed(() => {
    const next = this.nextSession();
    let list = this.sessions().filter(s => s !== next);
    if (this.hidePastSessions()) {
      list = list.filter(s => !this.isPast(s.date));
    }
    return list;
  });

  readonly hasOtherSessions = computed(() => {
    const next = this.nextSession();
    return this.sessions().some(s => s !== next);
  });

  /** Mensagem do estado vazio da lista de destaque — varia consoante haja ou não filtro por paciente. */
  readonly emptyStateMessage = computed(() =>
    this.selectedClientId() === ALL_CLIENTS_VALUE
      ? 'Não tem atendimentos agendados.'
      : 'Não tem atendimentos agendados com este paciente.',
  );

  ngOnInit(): void {
    const professionalId = this.sessionService.user()?.id;
    if (!professionalId) return;

    const rawId = this.route.snapshot.queryParamMap.get('appointmentId');
    const highlightId = rawId ? Number(rawId) : null;
    if (highlightId) {
      this.highlightedAppointmentId.set(highlightId);
      this.openSessionId.set(highlightId);
      // Um link de email pode apontar para uma sessão que já passou - sem
      // isto ficaria escondida atrás do filtro por omissão e pareceria ter sumido.
      this.hidePastSessions.set(false);
    }

    this.apiService.getProfessionalAppointments(professionalId).subscribe({
      next: (appts) => {
        this.appointments.set(appts);
        this.loading.set(false);
        if (highlightId) {
          setTimeout(() => this.scrollToHighlighted());
        }
      },
      error: () => this.loading.set(false),
    });

    this.apiService.getServices().subscribe((svcs) => this.services.set(svcs));

    this.apiService.getPatients(professionalId).subscribe({
      next: (patients) => this.patients.set(patients),
      error: () => {},
    });
  }

  private scrollToHighlighted(): void {
    const id = this.highlightedAppointmentId();
    if (id == null) return;
    const target = this.nextSession()?.appointmentId === id
      ? document.getElementById('pa-hero-card')
      : document.getElementById(`pa-row-${id}`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  onClientFilterChange(value: string): void {
    this.selectedClientId.set(value);
  }

  togglePastVisibility(): void {
    this.hidePastSessions.update((cur) => !cur);
  }

  toggleSession(id: number): void {
    this.openSessionId.update((cur) => (cur === id ? null : id));
  }

  isPast(date: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }

  canJoin(session: BuiltSession): boolean {
    return canJoinSession(session);
  }

  joinSession(session: BuiltSession): void {
    this.router.navigate(['/appointments', session.appointmentId, 'room']);
  }

  openThread(session: BuiltSession): void {
    this.messageService.createOrGetThread(session.appointmentId).subscribe({
      next: (thread) =>
        this.router.navigate(['/dashboard/messages'], { queryParams: { thread: thread.id } }),
      error: () =>
        this.snackbarService.openSnackBar({ message: 'Não foi possível abrir a conversa. Tente novamente.' }),
    });
  }
}
