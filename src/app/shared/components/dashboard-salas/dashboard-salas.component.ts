import { Component, inject, OnInit, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ApiService } from '../../../core/services/api.service';
import { SnackbarService } from '../../services/snackbar.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { CreateRoomDialogComponent } from '../create-room-dialog/create-room-dialog.component';
import { CreateRoomPayload, Room } from '../../models/room.model';

type RoomStatus = 'agora' | 'agendada' | 'expirada';

@Component({
  selector: 'app-dashboard-salas',
  imports: [],
  templateUrl: './dashboard-salas.component.html',
  styleUrl: './dashboard-salas.component.scss',
})
export class DashboardSalasComponent implements OnInit {
  private readonly apiService = inject(ApiService);
  private readonly snackbarService = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);

  readonly rooms = signal<Room[]>([]);
  readonly loading = signal(true);

  ngOnInit(): void {
    this.load();
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
          this.rooms.update((list) => [room, ...list]);
          this.snackbarService.openSnackBar({ message: 'Sala criada. O link já está pronto a partilhar.' });
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
        message: 'Deseja realmente apagar esta sala? Quem tiver o link deixa de conseguir entrar.',
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
    const now = Date.now();
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
    const fmt = new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    return `${fmt.format(new Date(room.opensAt))} – ${fmt.format(new Date(room.closesAt))}`;
  }
}
