import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { ReviewApiService } from '../../../../core/services/review-api.service';
import { Review } from '../../../models/review.model';
import { SessionService } from '../../../services/session.service';
import { PickerSlot, timeInZone, upcomingSlots } from '../../../utils/picker-slots.util';
import { detectBrowserTimezone, sessionZone, zonedWallTimeToInstant } from '../../../utils/timezones.util';
import { AvailabilityPickerComponent, PickerChoice } from '../availability-picker/availability-picker.component';

const MOD_WORD: Record<string, string> = { REMOTE: 'Remoto (videochamada)', LOCAL: 'Presencial' };

/**
 * A entrevista de uma candidatura com o perfil aprovado. A pessoa escolhe um
 * dos horários do serviço "Entrevista" (ou muda-o, até ser realizada); a
 * equipa vê se já foi marcada, quantos horários livres há, e dá-a como
 * realizada (publica) ou cancela-a.
 */
@Component({
  selector: 'app-interview-section',
  standalone: true,
  imports: [AvailabilityPickerComponent],
  template: `
    <div class="rv-section">
      <div class="rv-section-head">
        @if (team() || overline()) {
          <span class="cat-overline">Etapa seguinte</span>
        }
        <h2>{{ title() }}</h2>
        <p class="rv-lead">{{ intro() }}</p>
      </div>

      @if (interview(); as iv) {
        <div class="rv-box" [class]="iv.done ? 'rv-tone-green' : 'rv-tone-indigo'" [class.rv-box--done]="iv.done && !team()">
          <span class="rv-status-line"><span class="rv-dot"></span>{{ iv.done ? 'Entrevista realizada' : 'Entrevista agendada' }}</span>
          <span class="rv-box-when">{{ when() }}</span>
          <span class="rv-box-who">Com {{ iv.host }} · {{ modWord(iv.modality) }}</span>
          @if (team() && !iv.done) {
            <div class="rv-actions">
              <button type="button" class="rv-btn rv-btn--small" [disabled]="busy()" (click)="done()">
                Entrevista realizada · Publicar
              </button>
              <button type="button" class="rv-btn-outline rv-btn--small" [disabled]="busy()" (click)="cancel()">
                Cancelar agendamento
              </button>
            </div>
          }
          @if (!team() && !iv.done) {
            <button type="button" class="rv-text-btn" (click)="rescheduling.set(!rescheduling())">
              {{ rescheduling() ? 'Manter este horário' : 'Alterar horário' }}
            </button>
          }
        </div>
      } @else if (team()) {
        <div class="rv-box rv-tone-indigo">
          <span class="rv-status-line"><span class="rv-dot"></span>Aguardando agendamento</span>
          <span class="rv-box-text">{{ waitingText() }}</span>
        </div>
      }

      @if (error()) {
        <p class="cat-error-box" role="alert">{{ error() }}</p>
      }

      @if (showPicker()) {
        <div class="rv-picker-wrap">
          <app-availability-picker
            [slots]="pickerSlots()"
            [timeZone]="zone()"
            [confirmedId]="confirmedId()"
            [confirmedModality]="confirmedModality()"
            [busy]="busy()"
            fieldLabel="Escolha uma data para a entrevista"
            modalityLabel="Como você prefere fazer a entrevista"
            confirmLabel="Agendar entrevista"
            confirmedLabel="Agendada"
            emptyText="Não há horários de entrevista disponíveis no momento. A equipe da CARE vai entrar em contato."
            (choose)="book($event)"
          />
        </div>
      }
    </div>
  `,
})
export class InterviewSectionComponent {
  private readonly api = inject(ReviewApiService);
  private readonly session = inject(SessionService);

  readonly review = input.required<Review>();
  readonly team = input(false);
  /** No acompanhamento o título vem sem a linha "Etapa seguinte". */
  readonly overline = input(true);
  readonly changed = output<Review>();

  readonly slots = signal<PickerSlot[] | null>(null);
  readonly rescheduling = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly zone = computed(() => this.session.user()?.timeZone || detectBrowserTimezone());
  readonly interview = computed(() => this.review().interview);

  private readonly start = computed(() => {
    const iv = this.interview();
    return iv ? zonedWallTimeToInstant(iv.date, iv.startTime, sessionZone(iv.timeZone)) : null;
  });
  private readonly end = computed(() => {
    const iv = this.interview();
    return iv ? zonedWallTimeToInstant(iv.date, iv.endTime, sessionZone(iv.timeZone)) : null;
  });

  readonly title = computed(() =>
    this.team() ? 'Entrevista' : this.interview() ? 'Sua entrevista' : 'Agende sua entrevista',
  );
  readonly intro = computed(() =>
    this.team()
      ? 'Com o perfil aprovado, a pessoa profissional escolhe um dos horários de entrevista disponibilizados pela equipe. Depois da entrevista, marque como realizada para publicar o perfil e os serviços aprovados.'
      : 'A entrevista serve para conhecer sua prática e esclarecer, dos dois lados, o que significa trabalhar na clínica ampliada. Escolha o dia e o horário mais convenientes para você. Depois da entrevista, o perfil e os serviços aprovados são publicados.',
  );

  readonly showPicker = computed(() => {
    const iv = this.interview();
    return !this.team() && !iv?.done && (!iv || this.rescheduling());
  });

  /** Os horários livres e, a mudar de horário, o que já está marcado (verde). */
  readonly pickerSlots = computed(() => {
    const list = this.slots() ?? [];
    const iv = this.interview();
    const start = this.start();
    const end = this.end();
    if (!iv || !start || !end || iv.availabilityId === null) return list;
    const id = this.confirmedId()!;
    if (list.some(s => s.id === id)) return list;
    const booked: PickerSlot = {
      id,
      availabilityId: iv.availabilityId,
      date: iv.date,
      startTime: iv.startTime,
      endTime: iv.endTime,
      start,
      end,
      host: iv.host,
      modalities: [iv.modality === 'LOCAL' ? 'LOCAL' : 'REMOTE'],
      address: null,
    };
    return [...list, booked].sort((a, b) => a.start.getTime() - b.start.getTime());
  });

  readonly confirmedId = computed(() => {
    const iv = this.interview();
    return iv && iv.availabilityId !== null ? `${iv.availabilityId}:${iv.date}` : null;
  });
  readonly confirmedModality = computed(() => {
    const m = this.interview()?.modality;
    return m === 'LOCAL' || m === 'REMOTE' ? m : null;
  });

  readonly waitingText = computed(() => {
    const n = this.slots()?.length;
    const head = 'A pessoa profissional ainda não escolheu um horário. ';
    if (n === undefined) return head;
    return head + (n
      ? `${n === 1 ? '1 horário disponível' : n + ' horários disponíveis'} nas próximas semanas.`
      : 'Não há horários de entrevista disponíveis: crie novas disponibilidades com o serviço "Entrevista".');
  });

  /** "Terça-feira, 10 de novembro · 10:00 – 10:45", no fuso de quem lê. */
  readonly when = computed(() => {
    const start = this.start();
    const end = this.end();
    if (!start || !end) return '';
    const day = start.toLocaleDateString('pt-PT', {
      timeZone: this.zone(),
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${timeInZone(start, this.zone())} – ${timeInZone(end, this.zone())}`;
  });

  constructor() {
    // Os horários só fazem falta a quem escolhe, ou à equipa enquanto espera.
    effect(() => {
      const r = this.review();
      const needs = this.team() ? !r.interview : !r.interview?.done;
      if (needs && this.slots() === null) {
        this.api.interviewSlots(r.id).subscribe({
          next: list => this.slots.set(upcomingSlots(list)),
          error: () => this.slots.set([]),
        });
      }
    });
  }

  modWord(m: string): string {
    return MOD_WORD[m] ?? m;
  }

  private run(call: ReturnType<ReviewApiService['interviewDone']>, after?: () => void): void {
    this.busy.set(true);
    this.error.set(null);
    call.subscribe({
      next: r => {
        this.busy.set(false);
        this.slots.set(null);
        after?.();
        this.changed.emit(r);
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        this.error.set(err?.error?.error ?? 'Não foi possível concluir. Tente novamente.');
      },
    });
  }

  book(choice: PickerChoice): void {
    const s = choice.slot;
    this.run(
      this.api.bookInterview(this.review().id, {
        availabilityId: s.availabilityId,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        modality: choice.modality,
      }),
      () => this.rescheduling.set(false),
    );
  }

  done(): void {
    this.run(this.api.interviewDone(this.review().id));
  }

  cancel(): void {
    this.run(this.api.cancelInterview(this.review().id));
  }
}
