import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { VideoCallStageComponent } from '../../shared/components/video-call-stage/video-call-stage.component';

/**
 * Casca fina para entrar numa sala avulsa (Salas). Sem título específico -
 * quem entra por convite pode não ser dona da sala e não tem como listar os
 * detalhes que não criou, então fica só o genérico do VideoCallStageComponent.
 */
@Component({
  selector: 'app-room-join',
  standalone: true,
  imports: [VideoCallStageComponent],
  template: `
    <app-video-call-stage
      [fetchSession]="fetchSession"
      [leaveRoute]="['/dashboard']"
    />
  `,
})
export class RoomJoinComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly apiService = inject(ApiService);

  private readonly roomId = Number(this.route.snapshot.paramMap.get('id'));

  readonly fetchSession = () => this.apiService.getRoomVideoSession(this.roomId);
}
