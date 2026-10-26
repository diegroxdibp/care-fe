import { Component, computed, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';

import { CatalogueApiService } from '../../../../core/services/catalogue-api.service';
import { ReviewApiService } from '../../../../core/services/review-api.service';
import { CareService, CatalogueOptions, ReviewStatus } from '../../../models/catalogue.model';
import {
  ITEM_DECISION,
  kindFromPath,
  kindPath,
  plural,
  POINT_STATUS,
  Review,
  ReviewAudience,
  ReviewItem,
  ReviewPoint,
  ReviewStage,
  STAGE,
} from '../../../models/review.model';
import { SessionService } from '../../../services/session.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { slugify } from '../../../utils/catalogue.util';
import { professionalViewFromForm, serviceViewFrom } from '../../../utils/catalogue-views.util';
import { detectBrowserTimezone } from '../../../utils/timezones.util';
import { ProfessionalViewComponent } from '../../catalogue/professional-view/professional-view.component';
import { ServiceViewComponent } from '../../catalogue/service-view/service-view.component';
import { InterviewSectionComponent } from '../interview-section/interview-section.component';
import { ReviewThreadComponent } from '../review-thread/review-thread.component';

interface ItemRow {
  item: ReviewItem;
  kind: string;
  progress: string;
  hint: string;
  canApprove: boolean;
  canReject: boolean;
}

/**
 * Um pedido em análise (handoff: "Aprovação de Propostas"), para a equipa
 * (/admin/pedidos/:tipo/:id) e para a pessoa que o fez
 * (/meus-pedidos/:tipo/:id/pedido). A página proposta — perfil e cada
 * proposta, com os links bloqueados — leva a conversa sob cada parte. Por
 * baixo: só para a equipa, a configuração da publicação e os públicos
 * propostos; para os dois, o parecer final (a equipa decide) e a entrevista.
 */
@Component({
  selector: 'app-review-page',
  standalone: true,
  imports: [
    RouterLink,
    ProfessionalViewComponent,
    ServiceViewComponent,
    ReviewThreadComponent,
    InterviewSectionComponent,
  ],
  templateUrl: './review-page.component.html',
})
export class ReviewPageComponent implements OnInit {
  private readonly api = inject(ReviewApiService);
  private readonly catalogue = inject(CatalogueApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly snackbar = inject(SnackbarService);
  private readonly session = inject(SessionService);

  readonly finalRef = viewChild<ElementRef<HTMLElement>>('final');
  readonly interviewRef = viewChild<ElementRef<HTMLElement>>('interview');

  readonly review = signal<Review | null>(null);
  readonly options = signal<CatalogueOptions | null>(null);
  readonly notFound = signal(false);
  readonly busy = signal(false);
  readonly team = signal(false);

  readonly STAGE = STAGE;
  readonly POINT_STATUS = POINT_STATUS;
  readonly kindPath = kindPath;

  private readonly zone = computed(() => this.session.user()?.timeZone || detectBrowserTimezone());

  readonly isApplication = computed(() => this.review()?.kind === 'APPLICATION');
  readonly stage = computed(() => STAGE[this.review()?.stage ?? 'ANALYSIS']);
  readonly closed = computed(() => {
    const s = this.review()?.stage;
    return s === 'PUBLISHED' || s === 'REJECTED';
  });

  readonly title = computed(() => {
    const r = this.review();
    if (!r) return '';
    return r.kind === 'APPLICATION'
      ? r.profile?.displayName || r.person?.name || ''
      : r.proposals[0]?.name ?? '';
  });

  readonly subtitle = computed(() => {
    const r = this.review();
    if (!r) return '';
    const head = r.kind === 'APPLICATION'
      ? 'Candidatura' + (r.proposals.length ? ' com ' + plural(r.proposals.length, 'proposta de serviço', 'propostas de serviço') : '')
      : 'Proposta de serviço' + (r.person ? ' de ' + r.person.name : '');
    return head + (r.submittedAt ? ' · ' + this.day(r.submittedAt) : '');
  });

  /** Os pontos com estado (os comentários gerais não contam). */
  private readonly statePoints = computed(() => (this.review()?.points ?? []).filter(p => p.itemKey !== null));

  readonly counts = computed(() => {
    const pts = this.statePoints();
    return (['PENDING', 'APPROVED', 'REJECTED'] as ReviewStatus[]).map(k => {
      const n = pts.filter(p => p.status === k).length;
      const label = POINT_STATUS[k].label.toLowerCase();
      return { tone: POINT_STATUS[k].tone, text: plural(n, label, label + 's') };
    });
  });

  readonly profileView = computed(() => {
    const r = this.review();
    return r?.profile ? professionalViewFromForm(r.profile, r.services, this.options()) : null;
  });

  readonly general = computed(() => this.review()?.points.find(p => p.itemKey === null) ?? null);

  readonly roleNote = computed(() =>
    this.team()
      ? 'Abra a discussão sob cada parte da página para comentar e definir o status do ponto. A pessoa profissional vê os comentários e pode responder.'
      : 'A equipe da CARE está analisando seu pedido. Você pode responder aos comentários em cada ponto. O status de cada ponto é definido pela equipe.',
  );

  // ─ Decisão por item ───────────────────────────────────────────────────────

  private summary(itemKey: string): { total: number; approved: number; denied: number } {
    const pts = this.statePoints().filter(p => p.itemKey === itemKey);
    return {
      total: pts.length,
      approved: pts.filter(p => p.status === 'APPROVED').length,
      denied: pts.filter(p => p.status === 'REJECTED').length,
    };
  }

  progress(itemKey: string): string {
    const s = this.summary(itemKey);
    return `${s.approved} de ${plural(s.total, 'ponto aprovado', 'pontos aprovados')}`
      + (s.denied ? ' · ' + plural(s.denied, 'negado', 'negados') : '');
  }

  private readonly proRejected = computed(
    () => this.review()?.items.find(i => i.key === 'pro')?.decision === 'REJECTED',
  );

  private audiencesFor(serviceId: number): ReviewAudience[] {
    return (this.review()?.audiences ?? []).filter(a => a.serviceIds.includes(serviceId));
  }

  private ready(item: ReviewItem): { ok: boolean; points: boolean; audiences: boolean; blockedByPro: boolean } {
    const s = this.summary(item.key);
    const points = s.total > 0 && s.approved === s.total;
    const audiences = item.serviceId === null || this.audiencesFor(item.serviceId).every(a => a.decision !== null);
    const blockedByPro = item.serviceId !== null && this.proRejected();
    return { ok: points && audiences && !blockedByPro, points, audiences, blockedByPro };
  }

  /** Decidir itens, públicos e endereços só com o pedido em análise. */
  readonly editable = computed(() => this.team() && this.review()?.stage === 'ANALYSIS');

  readonly items = computed<ItemRow[]>(() => {
    const r = this.review();
    if (!r) return [];
    return r.items.map(item => {
      const rd = this.ready(item);
      let hint = '';
      if (this.editable() && item.decision !== 'REJECTED') {
        if (rd.blockedByPro) hint = 'Com o perfil recusado, esta proposta também é recusada.';
        else if (!rd.points) hint = 'Para aprovar, todos os pontos deste item devem estar aprovados.';
        else if (!rd.audiences) hint = 'Para aprovar, decida os públicos propostos neste serviço.';
      }
      return {
        item,
        kind: item.key === 'pro' ? 'Perfil profissional' : 'Proposta de serviço',
        progress: this.progress(item.key),
        hint,
        canApprove: rd.ok || item.decision === 'APPROVED',
        canReject: !rd.blockedByPro || item.decision === 'REJECTED',
      };
    });
  });

  itemStatus(item: ReviewItem): { label: string; tone: string } {
    const d = item.decision ? ITEM_DECISION[item.decision] : null;
    if (d) return d;
    return this.review()?.stage === 'CHANGES'
      ? { label: 'Alterações pedidas', tone: 'lilac' }
      : { label: 'Em análise', tone: 'blue' };
  }

  private readonly allDecided = computed(() => {
    const items = this.review()?.items ?? [];
    return items.length > 0 && items.every(i => i.decision !== null);
  });
  private readonly anyApproved = computed(() => (this.review()?.items ?? []).some(i => i.decision === 'APPROVED'));
  private readonly proApproved = computed(
    () => this.isApplication() && this.review()?.items.find(i => i.key === 'pro')?.decision === 'APPROVED',
  );
  readonly canConclude = computed(
    () => this.allDecided() && (this.review()?.items ?? []).filter(i => i.decision === 'APPROVED').every(i => this.ready(i).ok),
  );
  readonly concludeLabel = computed(() =>
    !this.allDecided()
      ? 'Concluir análise'
      : !this.anyApproved()
        ? 'Concluir e recusar pedido'
        : this.proApproved()
          ? 'Concluir e convidar para entrevista'
          : 'Concluir e publicar',
  );
  readonly concludeDanger = computed(() => this.canConclude() && !this.anyApproved());
  readonly concludeHint = computed(() =>
    this.canConclude()
      ? this.proApproved()
        ? 'A pessoa profissional é convidada a agendar a entrevista. A publicação acontece depois da entrevista.'
        : ''
      : 'Decida cada item para concluir a análise.',
  );

  readonly summaryText = computed(() => {
    const pts = this.statePoints();
    const n = (k: ReviewStatus) => pts.filter(p => p.status === k).length;
    const many = (this.review()?.proposals.length ?? 0) > 1 || this.isApplication();
    return `${n('APPROVED')} de ${plural(pts.length, 'ponto aprovado', 'pontos aprovados')}, `
      + `${plural(n('REJECTED'), 'negado', 'negados')} e ${plural(n('PENDING'), 'pendente', 'pendentes')}.`
      + (many ? ' O perfil e cada proposta de serviço têm decisão própria.' : '');
  });

  // ─ Caixa da decisão ───────────────────────────────────────────────────────

  readonly hasDecision = computed(() => {
    const r = this.review();
    return !!r && (r.decision !== null || r.stage === 'PUBLISHED' || r.stage === 'REJECTED');
  });

  readonly canReopen = computed(() => {
    const s = this.review()?.stage;
    return this.team() && (s === 'CHANGES' || s === 'INTERVIEW_TO_BOOK');
  });

  private readonly itemsText = computed(() =>
    (this.review()?.items ?? [])
      .map(i => `${i.name}: ${i.decision === 'APPROVED' ? 'aprovado' : 'recusado'}`)
      .join('; '),
  );

  private readonly refusedNote = computed(() => {
    const r = this.review();
    if (!r || !this.proApproved()) return '';
    const refused = r.items.filter(i => i.serviceId !== null && i.decision === 'REJECTED').map(i => `“${i.name}”`);
    if (!refused.length) return '';
    return ' ' + (refused.length === 1
      ? `A proposta ${refused[0]} não foi aprovada`
      : `As propostas ${refused.join(', ')} não foram aprovadas`) + '; os comentários da equipe estão nos respectivos pontos.';
  });

  readonly decisionText = computed(() => {
    const r = this.review();
    if (!r) return '';
    const when = r.decidedAt ? this.day(r.decidedAt) : '';
    const app = r.kind === 'APPLICATION';
    const texts: Record<ReviewStage, string> = this.team()
      ? {
          ANALYSIS: '',
          CHANGES: `Devolvido para alterações em ${when}. A pessoa profissional foi avisada para revisar os pontos negados.`,
          REJECTED: `Pedido recusado em ${when}.`,
          INTERVIEW_TO_BOOK: `Análise concluída em ${when} (${this.itemsText()}). A pessoa profissional foi convidada a agendar a entrevista.`,
          INTERVIEW_BOOKED: `Análise concluída em ${when} (${this.itemsText()}). Entrevista agendada; veja abaixo.`,
          PUBLISHED: app
            ? `Entrevista realizada. O perfil e os serviços aprovados foram publicados (${this.itemsText()}).`
            : `Aprovado e publicado em ${when}.`,
        }
      : {
          ANALYSIS: '',
          CHANGES: 'A equipe da CARE pediu alterações nos pontos marcados como negados. Depois que você revisar o pedido, a análise continua.',
          REJECTED: 'O pedido não foi aprovado. Os comentários da equipe estão nesta página.',
          INTERVIEW_TO_BOOK: 'Seu perfil foi aprovado. O próximo passo é uma entrevista com a equipe da CARE.' + this.refusedNote(),
          INTERVIEW_BOOKED: 'Seu perfil foi aprovado e a entrevista está agendada.' + this.refusedNote(),
          PUBLISHED: app
            ? 'Seu perfil e os serviços aprovados estão publicados na plataforma.' + this.refusedNote()
            : 'A proposta foi aprovada e o serviço está publicado.',
        };
    return texts[r.stage];
  });

  readonly showInterview = computed(() => {
    const r = this.review();
    return !!r && r.kind === 'APPLICATION' && this.proApproved() && r.decision === 'CONCLUDED';
  });

  // ─ Configuração da publicação e públicos (equipa) ─────────────────────────

  readonly slugs = signal<Record<string, string>>({});

  slugOf(item: ReviewItem): string {
    return this.slugs()[item.key] ?? item.slug ?? '';
  }

  /** O endereço como se escreve: sem acentos, minúsculas, hífenes. */
  typeSlug(item: ReviewItem, e: Event): void {
    const raw = (e.target as HTMLInputElement).value;
    const clean = raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    (e.target as HTMLInputElement).value = clean;
    this.slugs.update(s => ({ ...s, [item.key]: clean }));
  }

  saveSlug(item: ReviewItem): void {
    const r = this.review();
    const slug = this.slugOf(item) || slugify(item.name);
    if (!r || slug === item.slug) return;
    this.act(this.api.setSlug(r.kind, r.id, item.key, slug), () =>
      this.slugs.update(s => {
        const { [item.key]: _, ...rest } = s;
        return rest;
      }),
    );
  }

  readonly audienceNames = signal<Record<number, string>>({});

  audienceName(a: ReviewAudience): string {
    return this.audienceNames()[a.id] ?? a.name;
  }

  typeAudienceName(a: ReviewAudience, e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    this.audienceNames.update(n => ({ ...n, [a.id]: v }));
  }

  saveAudienceName(a: ReviewAudience): void {
    const r = this.review();
    const name = this.audienceName(a).trim();
    if (!r || !name || name === a.name) return;
    this.act(this.api.setAudience(r.kind, r.id, a.id, { name }));
  }

  decideAudience(a: ReviewAudience, decision: ReviewStatus): void {
    const r = this.review();
    if (!r) return;
    this.act(this.api.setAudience(r.kind, r.id, a.id, { status: a.decision === decision ? null : decision }));
  }

  // ─ Ações ──────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.team.set(!!this.route.snapshot.data['team']);
    this.catalogue.options().subscribe(o => this.options.set(o));
    const kind = kindFromPath(this.route.snapshot.paramMap.get('kind'));
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!kind || !id) {
      this.notFound.set(true);
      return;
    }
    this.api.get(kind, id, this.team()).subscribe({
      next: r => this.review.set(r),
      error: () => this.notFound.set(true),
    });
  }

  private act(call: Observable<Review>, after?: () => void): void {
    this.busy.set(true);
    call.subscribe({
      next: r => {
        this.busy.set(false);
        this.review.set(r);
        after?.();
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        this.snackbar.openSnackBar({ message: err?.error?.error ?? 'Não foi possível salvar. Tente novamente.', action: true });
      },
    });
  }

  point(key: string): ReviewPoint | null {
    return this.review()?.points.find(p => p.key === key) ?? null;
  }

  setStatus(p: ReviewPoint, status: ReviewStatus): void {
    const r = this.review();
    if (r) this.act(this.api.setPointStatus(r.kind, r.id, p.key, { status }));
  }

  comment(p: ReviewPoint, text: string): void {
    const r = this.review();
    if (r) this.act(this.api.comment(r.kind, r.id, p.key, text, this.team()));
  }

  decideItem(item: ReviewItem, decision: ReviewStatus): void {
    const r = this.review();
    if (!r) return;
    this.act(this.api.setItemDecision(r.kind, r.id, item.key, { status: item.decision === decision ? null : decision }));
  }

  conclude(): void {
    const r = this.review();
    if (r && this.canConclude()) this.act(this.api.conclude(r.kind, r.id));
  }

  requestChanges(): void {
    const r = this.review();
    if (r) this.act(this.api.requestChanges(r.kind, r.id));
  }

  reopen(): void {
    const r = this.review();
    if (r) this.act(this.api.reopen(r.kind, r.id));
  }

  goFinal(): void {
    const el = (this.showInterview() ? this.interviewRef() : this.finalRef())?.nativeElement;
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 160, behavior: 'smooth' });
  }

  proposalView(s: CareService) {
    return serviceViewFrom(s, true);
  }

  proposalBand(i: number): string {
    return 'Proposta de serviço' + ((this.review()?.proposals.length ?? 0) > 1 ? ` ${i + 1}` : '');
  }

  /** "21 de outubro de 2026", no fuso do perfil. */
  day(at: string): string {
    return new Date(at).toLocaleDateString('pt-PT', {
      timeZone: this.zone(),
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
}
