import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { CatalogueApiService } from '../../../../core/services/catalogue-api.service';
import {
  CareService,
  ChangeProposal,
  Offering,
  OfferingModality,
  OfferingRequest,
  ReviewStatus,
} from '../../../models/catalogue.model';
import { Pages } from '../../../enums/pages.enum';
import { SnackbarService } from '../../../services/snackbar.service';
import { joinPt } from '../../../utils/catalogue.util';

const STATUS_LABELS: Record<ReviewStatus, string> = {
  PENDING: 'Em análise',
  APPROVED: 'Aprovada',
  REJECTED: 'Não aprovada',
};

/**
 * Painel → Os meus serviços: uma oferta por serviço da lista — ligar ou
 * desligar, que formatos, modalidade e especialidades oferece. Daqui também se
 * propõe um serviço novo ou alterações a um que se oferece. Substitui a
 * antiga secção "Serviços" do perfil (uma linha por formato).
 */
@Component({
  selector: 'app-offerings-editor',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './offerings-editor.component.html',
})
export class OfferingsEditorComponent implements OnInit {
  private readonly api = inject(CatalogueApiService);
  private readonly snackbar = inject(SnackbarService);

  readonly Pages = Pages;
  readonly services = signal<CareService[]>([]);
  readonly offerings = signal<Offering[]>([]);
  readonly proposals = signal<CareService[]>([]);
  readonly changes = signal<ChangeProposal[]>([]);
  readonly drafts = signal<Record<number, OfferingRequest>>({});
  readonly open = signal<number | null>(null);
  readonly busy = signal<number | null>(null);
  readonly errors = signal<Record<number, string>>({});
  readonly loaded = signal(false);

  readonly byService = computed(() => new Map(this.offerings().map(o => [o.service.id, o])));
  readonly sorted = computed(() => {
    const mine = this.byService();
    // As que já oferece primeiro.
    return [...this.services()].sort(
      (a, b) => Number(!!mine.get(b.id)?.active) - Number(!!mine.get(a.id)?.active) || a.name.localeCompare(b.name),
    );
  });

  readonly statusLabel = (s: ReviewStatus) => STATUS_LABELS[s];
  readonly joinPt = joinPt;

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    forkJoin({
      services: this.api.availableServices(),
      offerings: this.api.myOfferings(),
      proposals: this.api.myProposals(),
      changes: this.api.myChangeProposals(),
    }).subscribe(r => {
      this.services.set(r.services);
      this.offerings.set(r.offerings);
      this.proposals.set(r.proposals);
      this.changes.set(r.changes);
      const drafts: Record<number, OfferingRequest> = {};
      for (const s of r.services) drafts[s.id] = this.requestFor(s, r.offerings.find(o => o.service.id === s.id));
      this.drafts.set(drafts);
      this.loaded.set(true);
    });
  }

  /** O que o formulário de uma oferta mostra: a oferta, ou tudo o que o serviço permite. */
  private requestFor(s: CareService, o: Offering | undefined): OfferingRequest {
    if (o) {
      return {
        offersIndividual: o.offersIndividual,
        offersGroup: o.offersGroup,
        modality: o.modality,
        specialtyIds: [...o.specialtyIds],
        active: o.active,
      };
    }
    return {
      offersIndividual: s.allowsIndividual,
      offersGroup: s.allowsGroup && !s.allowsIndividual,
      modality: s.allowsInPerson && s.allowsRemote ? 'ANY' : s.allowsInPerson ? 'LOCAL' : 'REMOTE',
      specialtyIds: [],
      active: true,
    };
  }

  isOn(s: CareService): boolean {
    return !!this.byService().get(s.id)?.active;
  }

  draft(s: CareService): OfferingRequest {
    return this.drafts()[s.id];
  }

  patch(s: CareService, changes: Partial<OfferingRequest>): void {
    this.drafts.update(d => ({ ...d, [s.id]: { ...d[s.id], ...changes } }));
  }

  hasModality(s: CareService, m: 'LOCAL' | 'REMOTE'): boolean {
    const mod = this.draft(s).modality;
    return mod === 'ANY' || mod === m;
  }

  toggleModality(s: CareService, m: 'LOCAL' | 'REMOTE'): void {
    const local = this.hasModality(s, 'LOCAL') !== (m === 'LOCAL');
    const remote = this.hasModality(s, 'REMOTE') !== (m === 'REMOTE');
    if (!local && !remote) return; // pelo menos uma
    const modality: OfferingModality = local && remote ? 'ANY' : local ? 'LOCAL' : 'REMOTE';
    this.patch(s, { modality });
  }

  toggleSpecialty(s: CareService, id: number): void {
    const ids = this.draft(s).specialtyIds;
    this.patch(s, { specialtyIds: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id] });
  }

  names(list: { name: string }[]): string {
    return joinPt(list.map(a => a.name));
  }

  mandatory(s: CareService): string {
    return joinPt(s.audiences.map(a => a.name));
  }

  /** Liga/desliga: grava logo. Ligar pela primeira vez cria a oferta com o que o formulário tem. */
  setActive(s: CareService, active: boolean): void {
    this.patch(s, { active });
    this.save(s);
    if (active) this.open.set(s.id);
  }

  save(s: CareService): void {
    const body = this.draft(s);
    this.busy.set(s.id);
    this.errors.update(e => ({ ...e, [s.id]: '' }));
    this.api.saveOffering(s.id, body).subscribe({
      next: o => {
        this.offerings.update(list => [...list.filter(x => x.service.id !== s.id), o]);
        this.drafts.update(d => ({ ...d, [s.id]: this.requestFor(s, o) }));
        this.busy.set(null);
        this.snackbar.openSnackBar({ message: `${s.name}: gravado.`, action: true });
      },
      error: (err: HttpErrorResponse) => {
        const current = this.byService().get(s.id);
        this.drafts.update(d => ({ ...d, [s.id]: this.requestFor(s, current) }));
        this.errors.update(e => ({ ...e, [s.id]: err?.error?.error ?? 'Não foi possível gravar.' }));
        this.busy.set(null);
      },
    });
  }

  toggleOpen(id: number): void {
    this.open.update(o => (o === id ? null : id));
  }
}
