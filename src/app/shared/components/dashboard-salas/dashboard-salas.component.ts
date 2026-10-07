import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { SessionService } from '../../services/session.service';
import { SnackbarService } from '../../services/snackbar.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { CreateRoomDialogComponent } from '../create-room-dialog/create-room-dialog.component';
import { CreateRoomPayload, Room } from '../../models/room.model';
import { detectBrowserTimezone } from '../../utils/timezones.util';

type RoomStatus = 'agora' | 'agendada' | 'expirada';

@Component({
  selector: 'app-dashboard-salas',
  imports: [RouterLink],
  templateUrl: './dashboard-salas.component.html',
  styleUrl: './dashboard-salas.component.scss',
})
export class DashboardSalasComponent implements OnInit, OnDestroy {
  private readonly apiService = inject(ApiService);
  private readonly sessionService = inject(SessionService);
  private readonly snackbarService = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);

  readonly rooms = signal<Room[]>([]);
  readonly loading = signal(true);

  // O estado de cada sala (e o botão Entrar) muda com o relógio, não só ao
  // carregar - uma sala agendada passa a "Disponível agora" sem recarregar.
  private readonly now = signal(Date.now());
  private clockTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Quanto o relógio deste computador está atrasado em relação ao do
   * servidor, em ms. Uma sala criada para "agora" abre no instante do
   * servidor; com o relógio local uns segundos atrás, ela ficava como
   * "Agendada" até o relógio local chegar lá. Só avança o relógio da lista,
   * nunca o atrasa, então uma sala agendada nunca parece aberta antes de o
   * servidor deixar entrar.
   */
  private readonly clockLag = signal(0);

  ngOnInit(): void {
    this.load();
    this.clockTimer = setInterval(() => this.now.set(Date.now()), 30_000);
  }

  ngOnDestroy(): void {
    if (this.clockTimer) clearInterval(this.clockTimer);
  }

  private load(): void {
    this.loading.set(true);
    this.apiService.getMyRooms().subscribe({
      next: (rooms) => {
        this.rooms.set(rooms);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreateDialog(): void {
    const ref = this.dialog.open(CreateRoomDialogComponent, {
      width: '520px',
      panelClass: 'care-dialog',
    });

    ref.afterClosed().subscribe((payload: CreateRoomPayload | null) => {
      if (!payload) return;

      this.apiService.createRoom(payload).subscribe({
        next: (room) => {
          // Sem esperar pelo próximo tique de 30 s: a sala nova já tem o
          // estado certo ao aparecer.
          this.now.set(Date.now());
          if (!payload.opensAt) {
            const lag = new Date(room.opensAt).getTime() - this.now();
            this.clockLag.update((current) => Math.max(current, lag));
          }
          this.rooms.update((list) => [room, ...list]);
          this.snackbarService.openSnackBar({ message: 'Sala criada. O link já está pronto para compartilhar.' });
        },
        // O interceptor já mostra a recusa concreta do backend.
        error: () => {},
      });
    });
  }

  deleteRoom(room: Room): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '440px',
      panelClass: 'care-dialog',
      data: {
        title: 'Apagar sala',
        message: 'Deseja realmente apagar esta sala? Quem tiver o link não vai mais conseguir entrar.',
        confirmLabel: 'Apagar sala',
        cancelLabel: 'Voltar',
      },
    });

    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;

      this.apiService.deleteRoom(room.id).subscribe({
        next: () => {
          this.rooms.update((list) => list.filter((r) => r.id !== room.id));
          this.snackbarService.openSnackBar({ message: 'Sala apagada.' });
        },
        error: () => {},
      });
    });
  }

  copyLink(room: Room): void {
    navigator.clipboard
      ?.writeText(room.joinLink)
      .then(() => this.snackbarService.openSnackBar({ message: 'Link copiado.' }))
      .catch(() => {});
  }

  statusOf(room: Room): RoomStatus {
    const now = this.now() + this.clockLag();
    const opens = new Date(room.opensAt).getTime();
    const closes = new Date(room.closesAt).getTime();
    if (now > closes) return 'expirada';
    if (now >= opens) return 'agora';
    return 'agendada';
  }

  statusLabel(status: RoomStatus): string {
    return status === 'agora' ? 'Disponível agora' : status === 'agendada' ? 'Agendada' : 'Expirada';
  }

  accessLabel(room: Room): string {
    return room.accessMode === 'ANYONE_WITH_LINK' ? 'Qualquer pessoa com o link' : 'Só convidados';
  }

  formatWindow(room: Room): string {
    const timeZone = this.sessionService.user()?.timeZone || detectBrowserTimezone();
    const fmt = new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone,
    });
    return `${fmt.format(new Date(room.opensAt))} – ${fmt.format(new Date(room.closesAt))}`;
  }
}
