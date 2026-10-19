import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';

import { ApiService } from '../../../core/services/api.service';
import { SessionService } from '../../services/session.service';
import { SnackbarService } from '../../services/snackbar.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { CoProfessionalRequest } from '../../models/co-professional.model';
import { normalizeRecurrenceFrequency } from '../../utils/recurrence.util';
import { detectBrowserTimezone } from '../../utils/timezones.util';
import { formatInZone } from '../../utils/zoned-format.util';

/**
 * O pedido de outra pessoa profissional para tomar parte nas sessões dela.
 * Aceitar é um compromisso: fica ocupada a essas horas e entra nas sessões
 * como quem conduz (docs/adr/0002).
 */
@Component({
  selector: 'app-co-professional-request-page',
  standalone: true,
  template: `
    <div class="panel">
      <div class="panel-header"><h2>Pedido para participar</h2></div>
      <div class="body">
        @if (loading()) {
          <div class="state"><p>Carregando pedido...</p></div>
        } @else if (loadError()) {
          <div class="state error">
            <span translate="no" class="material-symbols-outlined">error</span>
            <p>{{ loadError() }}</p>
          </div>
        } @else if (request(); as r) {
          <div class="card">
            <p class="lead">
              <strong>{{ r.fromProfessionalName }}</strong>
              @if (isOnce()) {
                pediu que você participe numa sessão{{ r.format === 'GROUP' ? ' de grupo' : '' }}.
              } @else {
                pediu que você participe nas sessões dela{{ r.format === 'GROUP' ? ' de grupo' : '' }}.
              }
            </p>
            <div class="rows">
              <div class="row">
                <span translate="no" class="material-symbols-outlined">{{ isOnce() ? 'event' : 'event_repeat' }}</span>
                <div>
                  <div class="k">{{ isOnce() ? 'Dia e horário' : 'A partir de' }}</div>
                  <div class="v">{{ when() }}</div>
                </div>
              </div>
              @if (!isOnce()) {
                <div class="row">
                  <span translate="no" class="material-symbols-outlined">update</span>
                  <div><div class="k">Periodicidade</div><div class="v">{{ frequency() }}</div></div>
                </div>
              }
              @if (r.clientName) {
                <div class="row">
                  <span translate="no" class="material-symbols-outlined">person</span>
                  <div><div class="k">Pessoa cliente</div><div class="v">{{ r.clientName }}</div></div>
                </div>
              }
            </div>
            @if (r.message) {
              <p class="already">"{{ r.message }}"</p>
            }
            @if (r.status !== 'PENDING' || !isForMe()) {
              <p class="already">{{ resolvedMessage() }}</p>
            } @else {
              <p class="already">
                Aceitar deixa você ocupada a essas horas e dá acesso ao prontuário das pessoas clientes dessas sessões.
              </p>
              <div class="actions">
                <button class="btn-decline" [disabled]="responding()" (click)="decline()">Recusar</button>
                <button class="btn-accept" [disabled]="responding()" (click)="respond(true)">
                  {{ responding() ? 'Processando...' : 'Aceitar' }}
                </button>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styleUrl: '../proposal-confirm/proposal-confirm.component.scss',
})
export class CoProfessionalRequestPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly apiService = inject(ApiService);
  private readonly sessionService = inject(SessionService);
  private readonly snackbarService = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly responding = signal(false);
  readonly request = signal<CoProfessionalRequest | null>(null);

  readonly isOnce = computed(() => {
    const r = this.request();
    return !!r && !!r.untilDate && r.untilDate === r.fromDate;
  });
  readonly isForMe = computed(() => this.request()?.toProfessionalId === this.sessionService.user()?.id);
  readonly frequency = computed(() => normalizeRecurrenceFrequency(this.request()?.recurrenceFrequency ?? undefined));
  /** No fuso de quem vê — a dona pode estar noutro. */
  readonly when = computed(() => {
    const r = this.request();
    return r ? formatInZone(r.fromAt, this.sessionService.user()?.timeZone || detectBrowserTimezone()) : '';
  });
  readonly resolvedMessage = computed(() => {
    switch (this.request()?.status) {
      case 'ACCEPTED': return 'Este pedido foi aceito.';
      case 'DECLINED': return 'Este pedido foi recusado.';
      case 'WITHDRAWN': return 'Este pedido foi retirado.';
      case 'EXPIRED': return 'A data deste pedido já passou.';
      default: return 'Este pedido é para outra pessoa profissional.';
    }
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.apiService.getCoProfessionalRequest(id).subscribe({
      next: (r) => {
        this.request.set(r);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.loadError.set(err.status === 403 ? 'Este pedido não é para você.' : 'Pedido não encontrado.');
      },
    });
  }

  decline(): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '440px',
      panelClass: 'care-dialog',
      data: { title: 'Recusar pedido', message: 'A pessoa profissional vai saber que você recusou.', confirmLabel: 'Recusar' },
    });
    ref.afterClosed().subscribe(confirmed => { if (confirmed) this.respond(false); });
  }

  respond(accept: boolean): void {
    const r = this.request();
    if (!r || this.responding()) return;
    this.responding.set(true);
    this.apiService.respondToCoProfessionalRequest(r.id, accept).subscribe({
      next: (updated) => {
        this.responding.set(false);
        this.request.set(updated);
        this.snackbarService.openSnackBar({
          message: accept ? 'Pedido aceito. As sessões já aparecem na sua disponibilidade.' : 'Pedido recusado.',
        });
        if (accept) this.router.navigate(['/availability']);
      },
      // O interceptor já mostra o choque concreto ("Você já tem um compromisso no dia…").
      error: () => this.responding.set(false),
    });
  }
}
