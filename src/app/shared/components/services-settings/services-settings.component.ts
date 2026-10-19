import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { forkJoin, Observable } from 'rxjs';

import { ApiService } from '../../../core/services/api.service';
import { ProfessionalSessionService } from '../../enums/professional-session-service.enum';
import { MyService } from '../../models/my-service.model';

type Format = 'INDIVIDUAL' | 'GROUP';

/**
 * Que serviços da lista da Care a pessoa profissional oferece, e em que
 * formato (individual, grupo). Ligar cria o serviço (ou volta a ativar um que
 * já existiu); desligar não mexe nas vagas que já o oferecem, só deixa de
 * aparecer ao criar vagas novas.
 */
@Component({
  selector: 'app-services-settings',
  standalone: true,
  template: `
    <div class="services">
      <span class="services-label">Serviços</span>
      <p class="muted">
        O que você oferece, e em que formato. Desligar não mexe nas vagas que já existem:
        o serviço só deixa de aparecer ao criar vagas novas.
      </p>

      @if (loading()) {
        <p class="muted">Carregando serviços...</p>
      } @else {
        <div class="services-list">
          @for (row of rows(); track row.name) {
            <div class="service-row">
              <span class="service-name">{{ row.label }}</span>
              <div class="formats">
                @for (f of formats; track f.value) {
                  <button
                    type="button"
                    class="format-toggle"
                    [class.on]="row.on[f.value]"
                    [disabled]="busy() === row.name + f.value"
                    [attr.aria-pressed]="row.on[f.value]"
                    (click)="toggle(row.name, f.value, !row.on[f.value])"
                  >
                    <span translate="no" class="material-symbols-outlined">
                      {{ row.on[f.value] ? 'check_circle' : 'radio_button_unchecked' }}
                    </span>
                    {{ f.label }}
                  </button>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './services-settings.component.scss',
})
export class ServicesSettingsComponent implements OnInit {
  private readonly apiService = inject(ApiService);

  readonly formats: { value: Format; label: string }[] = [
    { value: 'INDIVIDUAL', label: 'Individual' },
    { value: 'GROUP', label: 'Grupo' },
  ];

  readonly mine = signal<MyService[]>([]);
  readonly loading = signal(true);
  /** O par serviço+formato a ser gravado — trava cliques repetidos nesse botão. */
  readonly busy = signal<string | null>(null);

  readonly rows = computed(() =>
    (Object.keys(ProfessionalSessionService) as (keyof typeof ProfessionalSessionService)[]).map(name => ({
      name,
      label: ProfessionalSessionService[name],
      on: {
        INDIVIDUAL: this.isOn(name, 'INDIVIDUAL'),
        GROUP: this.isOn(name, 'GROUP'),
      } as Record<Format, boolean>,
    })),
  );

  ngOnInit(): void {
    this.apiService.getMyServices().subscribe({
      next: (services) => {
        this.mine.set(services);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private isOn(name: string, format: Format): boolean {
    return this.mine().some(s => s.name === name && s.format === format && s.active);
  }

  toggle(name: string, format: Format, on: boolean): void {
    const same = this.mine().filter(s => s.name === name && s.format === format);
    let ops: Observable<unknown>[];
    if (on) {
      // Voltar a ligar reativa o que já existiu (as vagas antigas apontam para ele).
      const existing = same.find(s => s.modality === 'ANY') ?? same[0];
      ops = existing
        ? [this.apiService.setServiceActive(existing.id, true)]
        : [this.apiService.createService({ name, modality: 'ANY', format })];
    } else {
      ops = same.filter(s => s.active).map(s => this.apiService.setServiceActive(s.id, false));
    }
    if (ops.length === 0) return;

    this.busy.set(name + format);
    forkJoin(ops).subscribe({
      next: () => {
        this.busy.set(null);
        this.apiService.getMyServices().subscribe(services => this.mine.set(services));
      },
      error: () => this.busy.set(null),
    });
  }
}
