import { Component, computed, inject, signal } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { UserSearchPickerComponent } from '../user-search-picker/user-search-picker.component';
import { CreateRoomPayload, RoomAccessMode, RoomAllowedUser } from '../../models/room.model';

interface DurationPreset {
  label: string;
  minutes: number;
}

const DURATION_PRESETS: DurationPreset[] = [
  { label: '30 min', minutes: 30 },
  { label: '1 h', minutes: 60 },
  { label: '2 h', minutes: 120 },
  { label: '4 h', minutes: 240 },
];

/** Formulário de criação de uma sala avulsa - ver DashboardSalasComponent, que chama a API depois de fechar. */
@Component({
  selector: 'app-create-room-dialog',
  standalone: true,
  imports: [MatDialogModule, UserSearchPickerComponent],
  templateUrl: './create-room-dialog.component.html',
  styleUrl: './create-room-dialog.component.scss',
})
export class CreateRoomDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<CreateRoomDialogComponent>);

  readonly presets = DURATION_PRESETS;

  readonly name = signal('');
  readonly startsNow = signal(true);
  readonly scheduledDate = signal('');
  readonly scheduledTime = signal('');
  readonly durationMinutes = signal(60);

  readonly accessMode = signal<RoomAccessMode>('SPECIFIC_USERS');
  readonly allowedUsers = signal<RoomAllowedUser[]>([]);
  readonly limitParticipants = signal(false);
  readonly maxParticipants = signal(10);

  readonly minDate = new Date().toISOString().slice(0, 10);

  readonly canSubmit = computed(() => {
    if (this.durationMinutes() < 5) return false;
    if (!this.startsNow() && (!this.scheduledDate() || !this.scheduledTime())) return false;
    if (this.accessMode() === 'SPECIFIC_USERS' && this.allowedUsers().length === 0) return false;
    return true;
  });

  setPreset(minutes: number): void {
    this.durationMinutes.set(minutes);
  }

  setAllowedUsers(users: RoomAllowedUser[]): void {
    this.allowedUsers.set(users);
  }

  cancel(): void {
    this.dialogRef.close(null);
  }

  submit(): void {
    if (!this.canSubmit()) return;

    const opensAt = this.startsNow()
      ? null
      : new Date(`${this.scheduledDate()}T${this.scheduledTime()}`).toISOString();

    this.dialogRef.close({
      name: this.name().trim() || undefined,
      accessMode: this.accessMode(),
      allowedUserIds: this.accessMode() === 'SPECIFIC_USERS' ? this.allowedUsers().map((u) => u.id) : [],
      maxParticipants: this.limitParticipants() ? this.maxParticipants() : undefined,
      opensAt,
      durationMinutes: this.durationMinutes(),
    } satisfies CreateRoomPayload);
  }
}
