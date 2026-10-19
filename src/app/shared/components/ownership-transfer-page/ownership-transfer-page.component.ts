import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';

import { ApiService } from '../../../core/services/api.service';
import { SessionService } from '../../services/session.service';
import { SnackbarService } from '../../services/snackbar.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { OwnershipTransfer } from '../../models/co-professional.model';
import { normalizeRecurrenceFrequency } from '../../utils/recurrence.util';

const PT_DOW: Record<string, string> = {
  MONDAY: 'Segunda-feira', TUESDAY: 'Terça-feira', WEDNESDAY: 'Quarta-feira', THURSDAY: 'Quinta-feira',
  FRIDAY: 'Sexta-feira', SATURDAY: 'Sábado', SUNDAY: 'Domingo',
};

/**
 * Outra pessoa profissional quer passar uma vaga para você. Aceitar faz da
 * vaga, das suas sessões e dos convites em aberto seus; as pessoas clientes
 * são avisadas.
 */
@Component({
  selector: 'app-ownership-transfer-page',
  standalone: true,
  template: `
    <div class="panel">
      <div class="panel-header"><h2>Passagem de vaga</h2></div>
      <div class="body">
        @if (loading()) {
          <div class="state"><p>Carregando pedido...</p></div>
        } @else if (loadError()) {
          <div class="state error">
            <span translate="no" class="material-symbols-outlined">error</span>
            <p>{{ loadError() }}</p>
          </div>
        } @else if (transfer(); as t) {
          <div class="card">
            <p class="lead">
              <strong>{{ t.fromProfessionalName }}</strong> quer passar uma vaga{{ t.format === 'GROUP' ? ' de grupo' : '' }} para você.
            </p>
            <div class="rows">
              <div class="row">
                <span translate="no" class="material-symbols-outlined">event_repeat</span>
                <!-- O horário é o da vaga, no fuso em que foi escrito (o da dona atual). -->
                <div><div class="k">Vaga</div><div class="v">{{ slotLabel() }}</div></div>
              </div>
              @if (t.oldOwnerStays) {
                <div class="row">
                  <span translate="no" class="material-symbols-outlined">group</span>
                  <div><div class="k">Depois</div><div class="v">{{ t.fromProfessionalName }} continua como co-profissional</div></div>
                </div>
              }
            </div>
            @if (t.status !== 'PENDING' || !isForMe()) {
              <p class="already">{{ resolvedMessage() }}</p>
            } @else {
              <p class="already">
                Aceitar faz da vaga e das suas sessões suas, com os seus serviços equivalentes. As pessoas clientes são avisadas.
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
export class OwnershipTransferPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly apiService = inject(ApiService);
  private readonly sessionService = inject(SessionService);
  private readonly snackbarService = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly responding = signal(false);
  readonly transfer = signal<OwnershipTransfer | null>(null);

  readonly isForMe = computed(() => this.transfer()?.toProfessionalId === this.sessionService.user()?.id);
  readonly slotLabel = computed(() => {
    const t = this.transfer();
    if (!t) return '';
    const freq = t.isRecurring ? ` · ${normalizeRecurrenceFrequency(t.recurrenceFrequency ?? undefined)}` : '';
    return `${PT_DOW[t.dayOfWeek] ?? t.dayOfWeek} · ${t.startTime.slice(0, 5)}–${t.endTime.slice(0, 5)} (${t.timeZone})${freq}`;
  });
  readonly resolvedMessage = computed(() => {
    switch (this.transfer()?.status) {
      case 'ACCEPTED': return 'A vaga já foi passada.';
      case 'DECLINED': return 'Este pedido foi recusado.';
      case 'WITHDRAWN': return 'Este pedido foi retirado.';
      case 'EXPIRED': return 'Este pedido já não vale: a vaga mudou de mãos.';
      default: return 'Este pedido é para outra pessoa profissional.';
    }
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.apiService.getOwnershipTransfer(id).subscribe({
      next: (t) => {
        this.transfer.set(t);
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
      data: { title: 'Recusar a vaga', message: 'A vaga continua com quem a tem.', confirmLabel: 'Recusar' },
    });
    ref.afterClosed().subscribe(confirmed => { if (confirmed) this.respond(false); });
  }

  respond(accept: boolean): void {
    const t = this.transfer();
    if (!t || this.responding()) return;
    this.responding.set(true);
    this.apiService.respondToOwnershipTransfer(t.id, accept).subscribe({
      next: (updated) => {
        this.responding.set(false);
        this.transfer.set(updated);
        this.snackbarService.openSnackBar({ message: accept ? 'A vaga agora é sua.' : 'Pedido recusado.' });
        if (accept) this.router.navigate(['/availability']);
      },
      error: () => this.responding.set(false),
    });
  }
}
