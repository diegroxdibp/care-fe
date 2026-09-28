import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { SessionService } from '../../services/session.service';
import { SnackbarService } from '../../services/snackbar.service';
import { FeatureFlagService } from '../../services/feature-flag.service';
import { Appointment } from '../../models/appointment.model';
import { ProfessionalService } from '../../models/professional-service.model';
import {
  ClientRecord,
  ClientRecordNote,
  ClientRecordNoteVisibility,
} from '../../models/client-record.model';
import { Currency } from '../../enums/currency.enum';
import { Genders } from '../../enums/genders.enum';
import { Pages } from '../../enums/pages.enum';
import { buildSessions, isUpcomingOrOngoing, sessionBounds } from '../../utils/session-list.util';
import { detectBrowserTimezone, timezoneLabel } from '../../utils/timezones.util';
import { UserTimePipe } from '../../pipes/user-time.pipe';

/** Espelha ClientRecordService.MAX_TEXT_LENGTH no backend. */
const MAX_TEXT_LENGTH = 10_000;

@Component({
  selector: 'app-dashboard-client-record',
  imports: [RouterLink, UserTimePipe],
  templateUrl: './dashboard-client-record.component.html',
  styleUrl: './dashboard-client-record.component.scss',
})
export class DashboardClientRecordComponent implements OnInit {
  private readonly apiService = inject(ApiService);
  private readonly sessionService = inject(SessionService);
  private readonly snackbarService = inject(SnackbarService);
  private readonly featureFlagService = inject(FeatureFlagService);
  private readonly route = inject(ActivatedRoute);

  protected readonly Pages = Pages;
  protected readonly maxLength = MAX_TEXT_LENGTH;

  readonly record = signal<ClientRecord | null>(null);
  readonly loading = signal(true);
  /** 403/404 — o backend decide quem pode ver; aqui só se mostra a recusa. */
  readonly denied = signal(false);

  private clientId = 0;
  private readonly appointments = signal<Appointment[]>([]);
  private readonly services = signal<ProfessionalService[]>([]);

  // Nova nota
  readonly noteBody = signal('');
  readonly noteVisibility = signal<ClientRecordNoteVisibility>('SHARED');
  readonly reasonDraft = signal('');
  readonly clinicalHistoryDraft = signal('');
  readonly savingNote = signal(false);

  // Adenda em curso (uma de cada vez)
  readonly addendumFor = signal<number | null>(null);
  readonly addendumBody = signal('');
  readonly savingAddendum = signal(false);

  readonly client = computed(() => this.record()?.client ?? null);

  readonly initials = computed(() => initialsFor(this.client()?.name ?? ''));

  readonly age = computed(() => ageFrom(this.client()?.birthDate));

  readonly birthDateLabel = computed(() => {
    const raw = this.client()?.birthDate;
    if (!raw) return null;
    // Data sem fuso: formatar os componentes tal como vêm, sem passar por Date/UTC.
    const [y, m, d] = raw.split('-');
    return `${d}/${m}/${y}`;
  });

  readonly genderLabel = computed(() => {
    const g = this.client()?.gender;
    return g ? (Genders[g as keyof typeof Genders] ?? null) : null;
  });

  readonly timeZoneLabel = computed(() => {
    const tz = this.client()?.timeZone;
    return tz ? timezoneLabel(tz) : null;
  });

  /** Sessões com quem está a ver — mesmo código de fusos que "Meus atendimentos". */
  private readonly sessions = computed(() =>
    buildSessions(
      this.appointments().filter(a => a.clientId === this.clientId),
      this.services(),
      {
        perspective: 'PROFESSIONAL',
        currency: this.sessionService.user()?.currency ?? Currency.EUR,
        paymentsEnabled: this.featureFlagService.paymentsEnabled(),
        viewerTimeZone: this.sessionService.user()?.timeZone || detectBrowserTimezone(),
      },
    ),
  );

  readonly sessionStats = computed(() => {
    const now = new Date();
    const all = this.sessions();
    const next = all.find(s => isUpcomingOrOngoing(s, now));
    const first = all[0];
    return {
      done: all.filter(s => !isUpcomingOrOngoing(s, now)).length,
      firstAt: first ? (sessionBounds(first)?.start ?? first.date) : null,
      nextAt: next ? (sessionBounds(next)?.start ?? next.date) : null,
    };
  });

  readonly pending = computed(() => this.record()?.pendingIntake ?? { reason: false, clinicalHistory: false });

  readonly isFirstNote = computed(() => !(this.record()?.notes.some(n => n.mine) ?? false));

  readonly canSaveNote = computed(() => this.noteBody().trim().length > 0 && !this.savingNote());

  ngOnInit(): void {
    this.clientId = Number(this.route.snapshot.paramMap.get('clientId'));
    if (!this.clientId) {
      this.denied.set(true);
      this.loading.set(false);
      return;
    }

    this.apiService.getClientRecord(this.clientId).subscribe({
      next: (record) => {
        this.record.set(record);
        this.loading.set(false);
      },
      error: (err) => {
        if (err?.status === 403 || err?.status === 404) this.denied.set(true);
        this.loading.set(false);
      },
    });

    const professionalId = this.sessionService.user()?.id;
    if (professionalId) {
      this.apiService.getProfessionalAppointments(professionalId).subscribe({
        next: (appts) => this.appointments.set(appts),
        error: () => {},
      });
      this.apiService.getServices().subscribe((svcs) => this.services.set(svcs));
    }
  }

  saveNote(): void {
    if (!this.canSaveNote()) return;
    const pending = this.pending();
    const reason = this.reasonDraft().trim();
    const clinicalHistory = this.clinicalHistoryDraft().trim();

    this.savingNote.set(true);
    this.apiService.addClientRecordNote(this.clientId, {
      body: this.noteBody(),
      visibility: this.noteVisibility(),
      // Só se envia o que ainda estava por preencher — o backend também o garante.
      reason: pending.reason && reason ? reason : undefined,
      clinicalHistory: pending.clinicalHistory && clinicalHistory ? clinicalHistory : undefined,
    }).subscribe({
      next: (record) => {
        this.record.set(record);
        this.noteBody.set('');
        this.reasonDraft.set('');
        this.clinicalHistoryDraft.set('');
        this.noteVisibility.set('SHARED');
        this.savingNote.set(false);
        this.snackbarService.openSnackBar({ message: 'Nota guardada no prontuário.' });
      },
      // O interceptor já mostra a recusa concreta do backend.
      error: () => this.savingNote.set(false),
    });
  }

  startAddendum(note: ClientRecordNote): void {
    this.addendumFor.set(note.id);
    this.addendumBody.set('');
  }

  cancelAddendum(): void {
    this.addendumFor.set(null);
    this.addendumBody.set('');
  }

  saveAddendum(note: ClientRecordNote): void {
    const body = this.addendumBody().trim();
    if (!body || this.savingAddendum()) return;

    this.savingAddendum.set(true);
    this.apiService.addClientRecordAddendum(this.clientId, note.id, body).subscribe({
      next: (record) => {
        this.record.set(record);
        this.cancelAddendum();
        this.savingAddendum.set(false);
        this.snackbarService.openSnackBar({ message: 'Adenda acrescentada.' });
      },
      error: () => this.savingAddendum.set(false),
    });
  }

  authorInitials(name: string): string {
    return initialsFor(name);
  }

  onInput(target: 'body' | 'reason' | 'history' | 'addendum', event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    switch (target) {
      case 'body': this.noteBody.set(value); break;
      case 'reason': this.reasonDraft.set(value); break;
      case 'history': this.clinicalHistoryDraft.set(value); break;
      case 'addendum': this.addendumBody.set(value); break;
    }
  }
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/** Idade a partir de yyyy-MM-dd, comparando só componentes de data (sem fusos). */
export function ageFrom(birthDate: string | null | undefined, today: Date = new Date()): number | null {
  if (!birthDate) return null;
  const [y, m, d] = birthDate.split('-').map(Number);
  if (!y || !m || !d) return null;
  let age = today.getFullYear() - y;
  const beforeBirthday = today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d);
  if (beforeBirthday) age--;
  return age >= 0 ? age : null;
}
