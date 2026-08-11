import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ApiService } from '../../../core/services/api.service';
import { SnackbarService } from '../../services/snackbar.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { RescheduleRequest } from '../../models/reschedule-request.model';
import { normalizeModality } from '../../utils/modality-compatibility.util';
import { ProfessionalSessionService } from '../../enums/professional-session-service.enum';

const PT_MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
const PT_DOW = [
  'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado',
];

/**
 * Onde a pessoa cliente responde a um pedido de reagendamento.
 *
 * A sessão está exatamente onde estava e continua a acontecer — é isto que
 * decide se muda. Recusar não desmarca nada.
 */
@Component({
  selector: 'app-reschedule-confirm',
  imports: [MatDialogModule],
  templateUrl: './reschedule-confirm.component.html',
  styleUrl: './reschedule-confirm.component.scss',
})
export class RescheduleConfirmComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly apiService = inject(ApiService);
  private readonly snackbarService = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly respondError = signal<string | null>(null);
  readonly responding = signal(false);
  readonly request = signal<RescheduleRequest | null>(null);
  readonly serviceName = signal<string>('');

  readonly currentLabel = computed(() => {
    const r = this.request();
    if (!r) return '';
    return `${this.fmtDate(r.occurrenceDate)} · ${this.fmtTime(r.currentStartTime)}–${this.fmtTime(r.currentEndTime)}`;
  });

  readonly proposedLabel = computed(() => {
    const r = this.request();
    if (!r) return '';
    return `${this.fmtDate(r.proposedDate)} · ${this.fmtTime(r.proposedStartTime)}–${this.fmtTime(r.proposedEndTime)}`;
  });

  readonly modalityLabel = computed(() => {
    const r = this.request();
    return r ? normalizeModality(r.proposedModality) : '';
  });

  readonly alreadyResolved = computed(() => {
    const r = this.request();
    return r != null && r.status !== 'PENDING';
  });

  readonly resolvedMessage = computed(() => {
    const r = this.request();
    if (r?.status === 'ACCEPTED') return 'Já aceitou este pedido — a sessão mudou de dia.';
    if (r?.status === 'DECLINED') return 'Já recusou este pedido — a sessão manteve-se como estava.';
    return 'Este pedido já foi respondido.';
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.loadError.set('Pedido inválido.');
      this.loading.set(false);
      return;
    }

    this.apiService.getRescheduleRequest(id).subscribe({
      next: (request) => {
        this.request.set(request);
        this.loading.set(false);
        this.apiService.getServices().subscribe({
          next: (services) => {
            const svc = services.find(s => s.id === request.professionalServiceId);
            this.serviceName.set(svc ? this.serviceDisplayName(svc.name) : '');
          },
        });
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 403) {
          this.loadError.set('Este pedido não lhe é dirigido.');
        } else if (err.status === 404) {
          this.loadError.set('Pedido não encontrado.');
        } else {
          this.loadError.set('Não foi possível carregar o pedido. Tente novamente.');
        }
      },
    });
  }

  private serviceDisplayName(key: string): string {
    return ProfessionalSessionService[key as keyof typeof ProfessionalSessionService] ?? key;
  }

  /** 'yyyy-MM-dd' → 'Terça, 12 de agosto'. */
  fmtDate(key: string): string {
    if (!key) return '';
    const d = new Date(key + 'T00:00:00');
    return `${PT_DOW[d.getDay()]}, ${d.getDate()} de ${PT_MONTHS[d.getMonth()]}`;
  }

  private fmtTime(t: string): string {
    return (t ?? '').slice(0, 5);
  }

  accept(): void {
    this.respond(true);
  }

  decline(): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '440px',
      panelClass: 'care-dialog',
      data: {
        title: 'Recusar pedido',
        message: 'Deseja recusar este pedido? A sessão mantém-se no dia e hora em que está.',
        confirmLabel: 'Recusar',
      },
    });
    ref.afterClosed().subscribe(confirmed => {
      if (confirmed) this.respond(false);
    });
  }

  private respond(accept: boolean): void {
    const r = this.request();
    if (!r || this.responding()) return;
    this.responding.set(true);
    this.respondError.set(null);

    this.apiService.respondToRescheduleRequest(r.id, accept).subscribe({
      next: () => {
        this.snackbarService.openSnackBar({
          message: accept
            ? 'Sessão reagendada com sucesso.'
            : 'Pedido recusado. A sessão mantém-se como estava.',
        });
        this.router.navigateByUrl('/dashboard');
      },
      error: (err) => {
        this.responding.set(false);
        // Um 409 tanto pode ser "já respondido" como a vaga ter sido ocupada
        // entretanto. No segundo caso o pedido continua por responder e nada se
        // mexeu — os botões ficam, para que tentar de novo (ou recusar) seja
        // possível, e mostra-se a recusa concreta do backend.
        if (err.status === 409) {
          this.respondError.set(
            err.error?.error ?? 'Não foi possível responder a este pedido.',
          );
        } else if (err.status === 403) {
          this.respondError.set('Este pedido não lhe é dirigido.');
        } else {
          this.snackbarService.openSnackBar({ message: 'Erro ao responder ao pedido. Tente novamente.' });
        }
      },
    });
  }
}
