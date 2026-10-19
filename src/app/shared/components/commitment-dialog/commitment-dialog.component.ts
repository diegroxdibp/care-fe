import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';

import { Appointment } from '../../models/appointment.model';

export interface CommitmentDialogData {
  ownerName: string;
  /** "Quinta, 22/10 · 14:00–15:30" — já no fuso de quem vê. */
  whenLabel: string;
  isGroup: boolean;
  /** As sessões dessa data (pessoas com lugar). */
  sessions: Appointment[];
  /** Data da ocorrência no fuso da vaga — a partir dela sai-se. */
  originDate: string;
}

/** 'leave' — deixar de participar a partir desta data. */
export type CommitmentDialogResult = 'leave' | null;

/**
 * Uma sessão de outra pessoa profissional em que tomo parte: quem é a dona,
 * quem lá está, entrar na chamada, ou deixar de participar a partir daqui.
 */
@Component({
  selector: 'app-commitment-dialog',
  standalone: true,
  imports: [MatDialogModule],
  template: `
    <div class="dialog">
      <h3>Com {{ data.ownerName }}</h3>
      <p class="sub">{{ data.whenLabel }}{{ data.isGroup ? ' · grupo' : '' }}</p>
      <p class="note">
        Você participa como co-profissional. Só {{ data.ownerName }} muda ou cancela estas sessões.
      </p>

      <label class="field-label">Nesta data</label>
      @if (data.sessions.length === 0) {
        <p class="hint">Ninguém marcado ainda.</p>
      } @else {
        <div class="chips">
          @for (s of data.sessions; track s.id) {
            @if ($any(s.modality) === 'REMOTE' || $any(s.modality) === 'Remoto') {
              <button type="button" class="chip" (click)="join(s)" title="Entrar na chamada">
                <span translate="no" class="material-symbols-outlined">videocam</span>
                {{ s.clientName }}
              </button>
            } @else {
              <span class="chip">{{ s.clientName }}</span>
            }
          }
        </div>
        <p class="hint tight">Toque numa sessão remota para entrar na chamada (abre 5 minutos antes).</p>
      }

      <div class="btns">
        <button class="btn-ghost" (click)="dialogRef.close('leave')">Deixar de participar a partir daqui</button>
        <button class="btn-primary" (click)="dialogRef.close(null)">Fechar</button>
      </div>
    </div>
  `,
  styleUrl: '../propose-recurring-dialog/recurring-dialog.scss',
})
export class CommitmentDialogComponent {
  readonly dialogRef = inject(MatDialogRef<CommitmentDialogComponent>);
  readonly data = inject<CommitmentDialogData>(MAT_DIALOG_DATA);
  private readonly router = inject(Router);

  join(session: Appointment): void {
    this.dialogRef.close(null);
    this.router.navigate(['/appointments', session.id, 'room']);
  }
}
