import { Component, inject, OnInit, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { SessionService } from '../../shared/services/session.service';
import { VideoCallStageComponent } from '../../shared/components/video-call-stage/video-call-stage.component';

/** Casca fina: só resolve o id da marcação e o nome da contraparte - a chamada em si é o VideoCallStageComponent. */
@Component({
  selector: 'app-appointment-room',
  standalone: true,
  imports: [VideoCallStageComponent],
  template: `
    <app-video-call-stage
      [fetchSession]="fetchSession"
      [extendSession]="extendSession"
      [removeParticipant]="removeParticipant"
      [title]="title()"
      [leaveRoute]="['/dashboard']"
    />
  `,
})
export class AppointmentRoomComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly apiService = inject(ApiService);
  private readonly sessionService = inject(SessionService);

  private readonly appointmentId = Number(this.route.snapshot.paramMap.get('id'));

  readonly title = signal<string | null>(null);

  readonly fetchSession = () => this.apiService.getVideoSession(this.appointmentId);
  readonly extendSession = (minutes: number) => this.apiService.extendAppointmentCall(this.appointmentId, minutes);
  /**
   * Só num grupo o backend dá moderação (session.canModerate). Tirar alguém é
   * só da chamada em curso: ao contrário de uma sala avulsa, a pessoa continua
   * com o seu lugar e pode voltar a entrar.
   */
  readonly removeParticipant = (): Observable<void> => of(undefined);

  ngOnInit(): void {
    const me = this.sessionService.user();
    this.apiService.getAppointmentById(this.appointmentId).subscribe({
      next: (appt) => {
        const isProfessional = me?.id === appt.professionalId;
        const counterpartName = isProfessional ? appt.clientName : appt.professionalName;
        this.title.set(counterpartName ? 'Sessão com ' + counterpartName : null);
      },
      error: () => {},
    });
  }
}
