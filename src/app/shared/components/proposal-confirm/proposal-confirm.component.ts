import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ApiService } from '../../../core/services/api.service';
import { SessionService } from '../../services/session.service';
import { SnackbarService } from '../../services/snackbar.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { Appointment } from '../../models/appointment.model';
import { normalizeModality } from '../../utils/modality-compatibility.util';
import { normalizeRecurrenceFrequency } from '../../utils/recurrence.util';
import { DayOfWeek } from '../../enums/day-of-week.enum';
import { ProfessionalSessionService } from '../../enums/professional-session-service.enum';
import { detectBrowserTimezone, wallTimeInZone, zonedWallTimeToInstant } from '../../utils/timezones.util';
import { nextSeriesOccurrence } from '../../utils/series-change.util';
import { ProfessionalService } from '../../models/professional-service.model';

const DOW_ORDER: DayOfWeek[] = [
  DayOfWeek.SUNDAY, DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY,
];

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function addDaysKey(dateKey: string, days: number): string {
  const d = new Date(dateKey + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Dia da semana, data e hora de uma ocorrência no fuso de quem vê — a pessoa
 * profissional combinou-a no relógio dela (`timeZone`), e quem decide do outro
 * lado do mundo tem de decidir sobre a sua própria hora.
 */
function resolveOccurrence(
  a: Pick<Appointment, 'dayOfWeek' | 'startTime' | 'endTime' | 'timeZone'>,
  dateKey: string | undefined,
  viewerZone: string,
): { dow: string; time: string; date: string } {
  const rawDow = DayOfWeek[a.dayOfWeek as unknown as keyof typeof DayOfWeek] ?? String(a.dayOfWeek);
  const rawTime = `${a.startTime.slice(0, 5)}–${a.endTime.slice(0, 5)}`;
  const rawDate = dateKey ? dateKey.split('-').reverse().join('/') : '';

  if (!a.timeZone || !dateKey) {
    return { dow: rawDow, time: rawTime, date: rawDate };
  }

  const startInstant = zonedWallTimeToInstant(dateKey, a.startTime.slice(0, 5), a.timeZone);
  if (!startInstant) {
    return { dow: rawDow, time: rawTime, date: rawDate };
  }

  const startWall = wallTimeInZone(startInstant, viewerZone);
  const displayDate = new Date(startWall.year, startWall.month - 1, startWall.day);
  const dow = DOW_ORDER[displayDate.getDay()];
  const startLabel = `${pad2(startWall.hour)}:${pad2(startWall.minute)}`;

  // Sessão que atravessa a meia-noite: o fim cai no dia seguinte.
  const startMinutes = timeToMinutes(a.startTime.slice(0, 5));
  const endMinutes = timeToMinutes(a.endTime.slice(0, 5));
  const endDateKey = endMinutes <= startMinutes ? addDaysKey(dateKey, 1) : dateKey;
  const endInstant = zonedWallTimeToInstant(endDateKey, a.endTime.slice(0, 5), a.timeZone);
  const endLabel = endInstant
    ? (() => {
      const endWall = wallTimeInZone(endInstant, viewerZone);
      return `${pad2(endWall.hour)}:${pad2(endWall.minute)}`;
    })()
    : a.endTime.slice(0, 5);

  return {
    dow,
    time: `${startLabel}–${endLabel}`,
    date: `${pad2(startWall.day)}/${pad2(startWall.month)}/${startWall.year}`,
  };
}

@Component({
  selector: 'app-proposal-confirm',
  imports: [MatDialogModule],
  templateUrl: './proposal-confirm.component.html',
  styleUrl: './proposal-confirm.component.scss',
})
export class ProposalConfirmComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly apiService = inject(ApiService);
  private readonly snackbarService = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly sessionService = inject(SessionService);

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly respondError = signal<string | null>(null);
  readonly responding = signal(false);
  readonly appt = signal<Appointment | null>(null);
  /** Numa alteração de série: a série como está hoje, que esta substituiria. */
  readonly replaced = signal<Appointment | null>(null);
  private readonly services = signal<ProfessionalService[]>([]);

  readonly isSeriesChange = computed(() => this.appt()?.replacesAppointmentId != null);

  private readonly viewerZone = computed(() => this.sessionService.user()?.timeZone || detectBrowserTimezone());

  readonly serviceName = computed(() => this.serviceNameFor(this.appt()));

  /** Dia e hora no fuso de quem decide aceitar/recusar — ver resolveOccurrence. */
  private readonly resolvedOccurrence = computed(() => {
    const a = this.appt();
    return a ? resolveOccurrence(a, a.startDate, this.viewerZone()) : null;
  });

  /**
   * "Como está": a série atual lida na primeira ocorrência que a alteração
   * substituiria — não na âncora, que pode ser de há meses e de antes de uma
   * mudança de hora.
   */
  readonly replacedOccurrence = computed(() => {
    const change = this.appt();
    const original = this.replaced();
    if (!change || !original) return null;
    const reference = nextSeriesOccurrence(original, change.startDate) ?? original.startDate;
    return resolveOccurrence(original, reference, this.viewerZone());
  });

  readonly replacedFrequencyLabel = computed(() => normalizeRecurrenceFrequency(this.replaced()?.recurrenceFrequency));
  readonly replacedModalityLabel = computed(() => {
    const a = this.replaced();
    return a ? normalizeModality(String(a.modality)) : '';
  });
  readonly replacedServiceName = computed(() => this.serviceNameFor(this.replaced()));

  /** Data da primeira sessão com o novo horário, no fuso de quem vê. */
  readonly effectiveFromLabel = computed(() => this.resolvedOccurrence()?.date ?? '');

  readonly dayLabel = computed(() => this.resolvedOccurrence()?.dow ?? '');

  readonly modalityLabel = computed(() => {
    const a = this.appt();
    return a ? normalizeModality(String(a.modality)) : '';
  });

  readonly frequencyLabel = computed(() => {
    const a = this.appt();
    return normalizeRecurrenceFrequency(a?.recurrenceFrequency);
  });

  readonly timeLabel = computed(() => this.resolvedOccurrence()?.time ?? '');

  readonly alreadyResolved = computed(() => {
    const a = this.appt();
    return (a != null && a.status !== 'PENDING') || this.respondError() !== null;
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.loadError.set('Proposta inválida.');
      this.loading.set(false);
      return;
    }

    this.apiService.getAppointmentById(id).subscribe({
      next: (appt) => {
        this.appt.set(appt);
        this.apiService.getServices().subscribe({
          next: (services) => this.services.set(services),
        });
        if (appt.replacesAppointmentId == null) {
          this.loading.set(false);
          return;
        }
        // Sem a série atual não há "antes" para comparar — e decidir sobre uma
        // alteração sem ver o que muda não é decidir.
        this.apiService.getAppointmentById(appt.replacesAppointmentId).subscribe({
          next: (original) => {
            this.replaced.set(original);
            this.loading.set(false);
          },
          error: () => {
            this.loading.set(false);
            this.loadError.set('Não foi possível carregar a sua série atual. Tente novamente.');
          },
        });
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 403) {
          this.loadError.set('Esta proposta não pertence à sua conta.');
        } else if (err.status === 404) {
          this.loadError.set('Proposta não encontrada.');
        } else {
          this.loadError.set('Não foi possível carregar a proposta. Tente novamente.');
        }
      },
    });
  }

  private serviceNameFor(a: Appointment | null): string {
    if (!a) return '';
    const svc = this.services().find(s => s.id === a.professionalServiceId);
    return svc ? this.serviceDisplayName(svc.name) : '';
  }

  private serviceDisplayName(key: string): string {
    return ProfessionalSessionService[key as keyof typeof ProfessionalSessionService] ?? key;
  }

  accept(): void {
    this.respond(true);
  }

  decline(): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '440px',
      panelClass: 'care-dialog',
      data: this.isSeriesChange()
        ? {
          title: 'Recusar alteração',
          message: 'A sua série continua exatamente como está. Deseja recusar esta alteração?',
          confirmLabel: 'Recusar',
        }
        : {
          title: 'Recusar proposta',
          message: 'Deseja realmente recusar esta proposta de agendamento recorrente?',
          confirmLabel: 'Recusar',
        },
    });
    ref.afterClosed().subscribe(confirmed => {
      if (confirmed) this.respond(false);
    });
  }

  private respond(accept: boolean): void {
    const a = this.appt();
    if (!a || this.responding()) return;
    this.responding.set(true);
    this.respondError.set(null);

    this.apiService.respondToProposal(a.id, accept).subscribe({
      next: () => {
        const message = this.isSeriesChange()
          ? (accept ? 'Alteração aceite. Enviámos-lhe a confirmação por email.' : 'Alteração recusada. A série continua como estava.')
          : (accept ? 'Proposta aceite com sucesso.' : 'Proposta recusada.');
        this.snackbarService.openSnackBar({ message });
        this.router.navigateByUrl('/dashboard');
      },
      error: (err) => {
        this.responding.set(false);
        if (err.status === 409) {
          this.respondError.set('Esta proposta já foi respondida anteriormente.');
        } else if (err.status === 403) {
          this.respondError.set('Esta proposta não pertence à sua conta.');
        } else if (err.status === 400) {
          // Ex.: a data em que a alteração começava já passou. O interceptor já
          // mostrou a razão; fica também escrita no cartão, no lugar dos botões.
          this.respondError.set(err.error?.error ?? 'Não foi possível responder a esta proposta.');
        } else {
          this.snackbarService.openSnackBar({ message: 'Erro ao responder à proposta. Tente novamente.' });
        }
      },
    });
  }
}
