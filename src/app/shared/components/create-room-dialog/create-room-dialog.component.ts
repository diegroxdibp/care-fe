import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { UserSearchPickerComponent } from '../user-search-picker/user-search-picker.component';
import { StyledSelectComponent, StyledSelectOption } from '../styled-select/styled-select.component';
import { minToTime } from '../../utils/session-time.util';
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

const MAX_PARTICIPANTS_CAP = 10;

// Salas avulsas não têm o horário de expediente da Disponibilidade (8h-24h) -
// cobre o dia todo, de meia em meia hora, mesmo pattern do EDITOR_HOURS de lá.
const TIME_OPTIONS: StyledSelectOption[] = Array.from({ length: 48 }, (_, i) => {
  const t = minToTime(i * 30);
  return { value: t, label: t };
});

const PT_MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Formulário de criação de uma sala avulsa - ver DashboardSalasComponent, que chama a API depois de fechar. */
@Component({
  selector: 'app-create-room-dialog',
  standalone: true,
  imports: [MatDialogModule, UserSearchPickerComponent, StyledSelectComponent],
  templateUrl: './create-room-dialog.component.html',
  styleUrl: './create-room-dialog.component.scss',
})
export class CreateRoomDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<CreateRoomDialogComponent>);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  readonly presets = DURATION_PRESETS;
  readonly timeOptions = TIME_OPTIONS;
  readonly maxParticipantsCap = MAX_PARTICIPANTS_CAP;

  readonly name = signal('');
  readonly startsNow = signal(true);
  readonly scheduledDate = signal('');
  readonly scheduledTime = signal('');
  readonly durationMinutes = signal(60);

  readonly accessMode = signal<RoomAccessMode>('SPECIFIC_USERS');
  readonly allowedUsers = signal<RoomAllowedUser[]>([]);
  readonly limitParticipants = signal(false);
  readonly maxParticipants = signal(MAX_PARTICIPANTS_CAP);

  readonly canSubmit = computed(() => {
    if (this.durationMinutes() < 5) return false;
    if (!this.startsNow() && (!this.scheduledDate() || !this.scheduledTime())) return false;
    if (this.accessMode() === 'SPECIFIC_USERS' && this.allowedUsers().length === 0) return false;
    return true;
  });

  // ── Calendário (mesmo padrão do reschedule-dialog / editor de disponibilidade) ──

  readonly weekdays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  readonly calOpen = signal(false);
  readonly calendarViewDate = signal(new Date());

  readonly calendarDays = computed(() => {
    const view = this.calendarViewDate();
    const year = view.getFullYear();
    const month = view.getMonth();
    const offset = new Date(year, month, 1).getDay();
    const days: Array<{ date: Date; inMonth: boolean; key: string }> = [];

    for (let i = offset - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, inMonth: false, key: toKey(d) });
    }

    const total = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= total; i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, inMonth: true, key: toKey(d) });
    }

    while (days.length % 7 !== 0) {
      const last = days[days.length - 1].date;
      const d = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
      days.push({ date: d, inMonth: false, key: toKey(d) });
    }

    return days;
  });

  readonly monthLabel = computed(() => {
    const d = this.calendarViewDate();
    return `${PT_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  });

  @HostListener('document:mousedown')
  onDocMousedown(): void {
    this.calOpen.set(false);
  }

  // O botão fica dentro de um wrapper que para a propagação do seu próprio
  // mousedown (ver o template) - sem isso, o listener global abaixo fechava
  // o popover no mesmo instante em que este método o abria.
  toggleCalendar(): void {
    const opening = !this.calOpen();
    this.calOpen.set(opening);
    if (!opening) return;

    setTimeout(() => {
      this.elementRef.nativeElement
        .querySelector('.calendar-popover')
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  fmtDate(key: string): string {
    const [y, m, d] = key.split('-');
    return `${d}/${m}/${y}`;
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
    return date.getFullYear() === t.getFullYear()
      && date.getMonth() === t.getMonth()
      && date.getDate() === t.getDate();
  }

  selectDate(key: string): void {
    this.scheduledDate.set(key);
    this.calOpen.set(false);
  }

  // ── Resto do formulário ──

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
