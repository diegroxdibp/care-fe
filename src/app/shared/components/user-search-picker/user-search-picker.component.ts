import { Component, EventEmitter, HostListener, inject, Input, OnDestroy, Output, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { RoomAllowedUser } from '../../models/room.model';

/**
 * Pesquisa por nome/email (com debounce, via ApiService.searchUsers) e chips
 * das pessoas já escolhidas. Usado pelo formulário de "Nova sala" para
 * escolher quem pode entrar - ver create-room-dialog.component.ts.
 */
@Component({
  selector: 'app-user-search-picker',
  standalone: true,
  templateUrl: './user-search-picker.component.html',
  styleUrl: './user-search-picker.component.scss',
})
export class UserSearchPickerComponent implements OnDestroy {
  @Input() selected: RoomAllowedUser[] = [];
  @Output() selectedChange = new EventEmitter<RoomAllowedUser[]>();

  private readonly apiService = inject(ApiService);

  readonly query = signal('');
  readonly results = signal<RoomAllowedUser[]>([]);
  readonly open = signal(false);
  readonly loading = signal(false);

  private readonly query$ = new Subject<string>();
  private readonly subscription = this.query$
    .pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap((q) => {
        if (q.trim().length < 2) {
          this.loading.set(false);
          return [];
        }
        this.loading.set(true);
        return this.apiService.searchUsers(q);
      }),
    )
    .subscribe({
      next: (results) => {
        this.loading.set(false);
        this.results.set(results.filter((r) => !this.selected.some((s) => s.id === r.id)));
      },
      error: () => this.loading.set(false),
    });

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  onInput(value: string): void {
    this.query.set(value);
    this.open.set(true);
    this.query$.next(value);
  }

  pick(user: RoomAllowedUser): void {
    this.selectedChange.emit([...this.selected, user]);
    this.results.update((list) => list.filter((r) => r.id !== user.id));
    this.query.set('');
    this.open.set(false);
  }

  remove(user: RoomAllowedUser): void {
    this.selectedChange.emit(this.selected.filter((u) => u.id !== user.id));
  }

  initials(name: string): string {
    const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return parts.length === 1
      ? parts[0][0].toUpperCase()
      : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // O input/dropdown param a propagação do seu próprio mousedown (ver o
  // template) - o que chega aqui é sempre um clique genuinamente de fora.
  @HostListener('document:mousedown')
  onDocMousedown(): void {
    this.open.set(false);
  }
}
