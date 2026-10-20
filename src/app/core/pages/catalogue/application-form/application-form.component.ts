import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';

import { CatalogueApiService } from '../../../services/catalogue-api.service';
import {
  Application,
  CareService,
  CatalogueOptions,
  emptyProfile,
  emptyServiceContent,
  ProfessionalProfile,
  profileForForm,
  ServiceContent,
} from '../../../../shared/models/catalogue.model';
import { Pages } from '../../../../shared/enums/pages.enum';
import { Roles } from '../../../../shared/enums/roles.enum';
import { SessionService } from '../../../../shared/services/session.service';
import { ProfileFieldsComponent } from '../../../../shared/components/catalogue/profile-fields/profile-fields.component';
import { ServiceFieldsComponent } from '../../../../shared/components/catalogue/service-fields/service-fields.component';
import { FormPreviewComponent } from '../../../../shared/components/catalogue/form-preview/form-preview.component';
import { missingServiceFields } from '../../../../shared/utils/catalogue.util';
import { professionalViewFromForm, serviceViewFromContent } from '../../../../shared/utils/catalogue-views.util';

interface ProposalDraft {
  key: string;
  open: boolean;
  content: ServiceContent;
}

interface Draft {
  profile: ProfessionalProfile;
  serviceIds: number[];
  proposals: ServiceContent[];
}

const DRAFT_KEY = 'care-application-draft-v1';

type State = 'loading' | 'form' | 'pending' | 'approved' | 'professional' | 'sent';

/**
 * /junte-se/pedido — o pedido para fazer parte da Care (handoff: formulário
 * de profissional em modo candidatura). Pede sessão (onboarding já recolheu
 * fuso horário, moeda e idioma). O rascunho fica no navegador até ser enviado.
 */
@Component({
  selector: 'app-application-form',
  standalone: true,
  imports: [ProfileFieldsComponent, ServiceFieldsComponent, FormPreviewComponent, RouterLink],
  templateUrl: './application-form.component.html',
})
export class ApplicationFormComponent implements OnInit {
  private readonly api = inject(CatalogueApiService);
  private readonly session = inject(SessionService);

  readonly Pages = Pages;
  readonly state = signal<State>('loading');
  readonly application = signal<Application | null>(null);
  readonly options = signal<CatalogueOptions | null>(null);
  readonly services = signal<CareService[]>([]);

  readonly profile = signal<ProfessionalProfile>(emptyProfile());
  readonly serviceIds = signal<number[]>([]);
  readonly proposals = signal<ProposalDraft[]>([]);
  readonly attempted = signal(false);
  readonly sending = signal(false);
  readonly serverError = signal<string | null>(null);

  readonly accountEmail = computed(() => this.session.user()?.email ?? null);
  readonly chosenServices = computed(() => this.services().filter(s => this.serviceIds().includes(s.id)));

  readonly missing = computed(() => {
    const m: string[] = [];
    if (!this.profile().displayName.trim()) m.push('nome');
    if (!this.profile().whoAmI.trim()) m.push('apresentação');
    if (!this.serviceIds().length && !this.proposals().length) m.push('pelo menos um serviço (existente ou proposto)');
    this.proposals().forEach((p, i) =>
      missingServiceFields(p.content).forEach(f => m.push(`proposta ${i + 1}: ${f}`)),
    );
    return m;
  });

  readonly profileView = computed(() =>
    professionalViewFromForm(this.profile(), this.chosenServices(), this.options()),
  );
  readonly proposalViews = computed(() =>
    this.proposals().map(p => serviceViewFromContent(p.content, this.options())),
  );

  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private seq = 0;

  constructor() {
    // Rascunho no navegador (como no protótipo: 450 ms depois da última tecla).
    effect(() => {
      const draft: Draft = {
        profile: this.profile(),
        serviceIds: this.serviceIds(),
        proposals: this.proposals().map(p => p.content),
      };
      if (this.state() !== 'form') return;
      if (this.saveTimer) clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => {
        try {
          localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        } catch {
          /* sem armazenamento: o formulário funciona na mesma */
        }
      }, 450);
    });
  }

  ngOnInit(): void {
    const user = this.session.user();
    this.api.options().subscribe(o => this.options.set(o));
    this.api.services().subscribe(list => this.services.set(list));

    if (user?.roles?.some(r => r === Roles.PROFESSIONAL || r === Roles.THERAPIST)) {
      this.state.set('professional');
      return;
    }
    this.api.myApplication().subscribe({
      next: app => {
        this.application.set(app);
        if (app.status === 'PENDING') this.state.set('pending');
        else if (app.status === 'APPROVED') this.state.set('approved');
        else this.startForm(app);
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 404) this.startForm(null);
        else this.state.set('form');
      },
    });
  }

  /** Começa do rascunho guardado; senão do pedido recusado; senão em branco com o nome da conta. */
  private startForm(rejected: Application | null): void {
    const draft = this.readDraft();
    if (draft) {
      this.profile.set(profileForForm(draft.profile));
      this.serviceIds.set(draft.serviceIds ?? []);
      this.proposals.set((draft.proposals ?? []).map(c => this.wrap(c, false)));
    } else if (rejected?.profile) {
      this.profile.set(profileForForm(rejected.profile));
      this.serviceIds.set(rejected.services.map(s => s.id));
    } else {
      this.profile.set(emptyProfile(this.session.user()?.name ?? ''));
    }
    this.state.set('form');
  }

  private readDraft(): Draft | null {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? (JSON.parse(raw) as Draft) : null;
    } catch {
      return null;
    }
  }

  private wrap(content: ServiceContent, open: boolean): ProposalDraft {
    return { key: `p${++this.seq}`, open, content };
  }

  toggleService(id: number): void {
    this.serviceIds.update(ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]));
  }

  addProposal(): void {
    this.proposals.update(list => [...list.map(p => ({ ...p, open: false })), this.wrap(emptyServiceContent(), true)]);
  }

  removeProposal(key: string): void {
    this.proposals.update(list => list.filter(p => p.key !== key));
  }

  toggleProposal(key: string): void {
    this.proposals.update(list => list.map(p => (p.key === key ? { ...p, open: !p.open } : p)));
  }

  setProposal(key: string, content: ServiceContent): void {
    this.proposals.update(list => list.map(p => (p.key === key ? { ...p, content } : p)));
  }

  submit(): void {
    this.attempted.set(true);
    this.serverError.set(null);
    if (this.missing().length) return;
    this.sending.set(true);
    this.api
      .submitApplication({
        profile: this.profile(),
        serviceIds: this.serviceIds(),
        proposals: this.proposals().map(p => p.content),
      })
      .subscribe({
        next: app => {
          this.application.set(app);
          this.sending.set(false);
          this.state.set('sent');
          try {
            localStorage.removeItem(DRAFT_KEY);
          } catch {
            /* nada a limpar */
          }
        },
        error: (err: HttpErrorResponse) => {
          this.sending.set(false);
          this.serverError.set(err?.error?.error ?? 'Não foi possível enviar o pedido. Tente novamente.');
        },
      });
  }
}
