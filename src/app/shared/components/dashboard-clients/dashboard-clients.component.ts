import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { ClientRecordSummary } from '../../models/client-record.model';

/** Lista das pessoas clientes de quem atende — porta de entrada para o prontuário. */
@Component({
  selector: 'app-dashboard-clients',
  imports: [RouterLink],
  templateUrl: './dashboard-clients.component.html',
  styleUrl: './dashboard-clients.component.scss',
})
export class DashboardClientsComponent implements OnInit {
  private readonly apiService = inject(ApiService);

  readonly clients = signal<ClientRecordSummary[]>([]);
  readonly loading = signal(true);
  readonly query = signal('');

  readonly filtered = computed(() => {
    const q = normalize(this.query());
    if (!q) return this.clients();
    return this.clients().filter(c => normalize(c.name).includes(q) || normalize(c.email).includes(q));
  });

  ngOnInit(): void {
    this.apiService.getMyClientRecords().subscribe({
      next: (clients) => {
        this.clients.set(clients);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  initials(name: string): string {
    const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }
}

/** Sem acentos nem maiúsculas: "joao" encontra "João". */
function normalize(value: string | null | undefined): string {
  return (value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
