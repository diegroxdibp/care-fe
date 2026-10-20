import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';

import { CatalogueApiService } from '../../core/services/catalogue-api.service';
import { AdminRequests, Application, CareService, CatalogueOptions, ChangeProposal } from '../../shared/models/catalogue.model';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { ProfessionalViewComponent } from '../../shared/components/catalogue/professional-view/professional-view.component';
import { ServiceViewComponent } from '../../shared/components/catalogue/service-view/service-view.component';
import { slugify } from '../../shared/utils/catalogue.util';
import {
  professionalViewFromForm,
  ProfessionalView,
  ServiceView,
  serviceViewFrom,
  serviceViewFromContent,
} from '../../shared/utils/catalogue-views.util';

/**
 * /admin/pedidos — o que espera pela equipa: pedidos para fazer parte da
 * Care, propostas de serviço e propostas de alteração. Cada coisa decide-se à
 * parte; recusar pede sempre uma nota (é o que a pessoa lê).
 */
@Component({
  selector: 'app-admin-requests',
  standalone: true,
  imports: [ProfessionalViewComponent, ServiceViewComponent],
  templateUrl: './admin-requests.component.html',
})
export class AdminRequestsComponent implements OnInit {
  private readonly api = inject(CatalogueApiService);
  private readonly snackbar = inject(SnackbarService);

  readonly requests = signal<AdminRequests | null>(null);
  readonly options = signal<CatalogueOptions | null>(null);
  readonly notes = signal<Record<string, string>>({});
  readonly slugs = signal<Record<string, string>>({});
  readonly expanded = signal<string | null>(null);
  readonly busy = signal<string | null>(null);
  readonly errors = signal<Record<string, string>>({});

  ngOnInit(): void {
    this.api.options().subscribe(o => this.options.set(o));
    this.load();
  }

  load(): void {
    this.api.adminRequests().subscribe(r => {
      this.requests.set(r);
      const slugs: Record<string, string> = {};
      r.applications.forEach(a => (slugs['app' + a.id] = slugify(a.profile?.displayName ?? a.applicant.name)));
      r.serviceProposals.forEach(s => (slugs['svc' + s.id] = s.slug));
      this.slugs.set(slugs);
    });
  }

  note(key: string): string {
    return this.notes()[key] ?? '';
  }

  setNote(key: string, value: string): void {
    this.notes.update(n => ({ ...n, [key]: value }));
  }

  slug(key: string): string {
    return this.slugs()[key] ?? '';
  }

  setSlug(key: string, value: string): void {
    this.slugs.update(s => ({ ...s, [key]: value }));
  }

  toggle(key: string): void {
    this.expanded.update(k => (k === key ? null : key));
  }

  text(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  profileView(a: Application): ProfessionalView | null {
    return a.profile ? professionalViewFromForm(a.profile, a.services, this.options()) : null;
  }

  serviceView(s: CareService): ServiceView {
    return serviceViewFrom({ ...s, audiences: s.audiences.map(a => ({ ...a, pending: false })), specialties: s.specialties.map(sp => ({ ...sp, audiences: sp.audiences.map(a => ({ ...a, pending: false })) })) });
  }

  changeView(c: ChangeProposal): ServiceView {
    return serviceViewFromContent(c.proposed, this.options(), c.current.audiences);
  }

  names(list: { name: string }[]): string {
    return list.map(x => x.name).join(', ');
  }

  pendingAudiences(s: CareService): string[] {
    const names = new Set<string>();
    s.audiences.filter(a => a.pending).forEach(a => names.add(a.name));
    s.specialties.forEach(sp => sp.audiences.filter(a => a.pending).forEach(a => names.add(a.name)));
    return [...names];
  }

  private decide(key: string, approve: boolean, call: () => Observable<unknown>, done: string): void {
    if (!approve && !this.note(key).trim()) {
      this.errors.update(e => ({ ...e, [key]: 'Escreva uma nota para a pessoa saber porquê.' }));
      return;
    }
    this.busy.set(key);
    this.errors.update(e => ({ ...e, [key]: '' }));
    call().subscribe({
      next: () => {
        this.busy.set(null);
        this.snackbar.openSnackBar({ message: done, action: true });
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(null);
        this.errors.update(e => ({ ...e, [key]: err?.error?.error ?? 'Não foi possível decidir.' }));
      },
    });
  }

  application(a: Application, approve: boolean): void {
    const key = 'app' + a.id;
    this.decide(key, approve,
      () => this.api.decideApplication(a.id, approve, { note: this.note(key) || null, slug: approve ? this.slug(key) : null }),
      approve ? 'Pedido aprovado.' : 'Pedido recusado.');
  }

  service(s: CareService, approve: boolean): void {
    const key = 'svc' + s.id;
    this.decide(key, approve,
      () => this.api.decideService(s.id, approve, { note: this.note(key) || null, slug: approve ? this.slug(key) : null }),
      approve ? 'Serviço aprovado.' : 'Proposta recusada.');
  }

  change(c: ChangeProposal, approve: boolean): void {
    const key = 'chg' + c.id;
    this.decide(key, approve, () => this.api.decideChange(c.id, approve, { note: this.note(key) || null }),
      approve ? 'Alterações aprovadas.' : 'Alterações recusadas.');
  }
}
