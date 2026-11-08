import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { concatMap, from, Observable, tap, toArray } from 'rxjs';

import { CatalogueApiService } from '../../../../core/services/catalogue-api.service';
import { ReviewApiService } from '../../../../core/services/review-api.service';
import { CareService, CatalogueOptions, ReviewStatus } from '../../../models/catalogue.model';
import {
  ITEM_DECISION,
  kindFromPath,
  kindPath,
  plural,
  KIND_LABEL,
  POINT_STATUS,
  Review,
  reviewDraft,
  ReviewAudience,
  ReviewItem,
  ReviewPoint,
  ReviewStage,
  STAGE,
} from '../../../models/review.model';
import { NavigationService } from '../../../services/navigation.service';
import { SessionService } from '../../../services/session.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { slugify } from '../../../utils/catalogue.util';
import { professionalViewFromForm, serviceViewFrom, serviceViewFromContent } from '../../../utils/catalogue-views.util';
import { detectBrowserTimezone } from '../../../utils/timezones.util';
import { ProfessionalViewComponent } from '../../catalogue/professional-view/professional-view.component';
import { ServiceViewComponent } from '../../catalogue/service-view/service-view.component';
import { InterviewSectionComponent } from '../interview-section/interview-section.component';
import { ReviewThreadComponent } from '../review-thread/review-thread.component';
import {
  ReviewSendDialogComponent,
  ReviewSendDialogData,
} from '../review-send-dialog/review-send-dialog.component';

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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly dialog = inject(MatDialog);

  /**
   * ?ponto=<chave>: o ponto escolhido em "O que precisa de resposta" no
   * acompanhamento. Abre-se, fica destacado e a página rola até ele.
   */
  readonly focusKey = signal<string | null>(this.route.snapshot.queryParamMap.get('ponto'));

  /**
   * NavigationService volta ao topo 50 ms depois de cada navegação. Rolar até
   * ao ponto antes disso era desfeito quando o pedido chegava depressa (a
   * navegação dentro da app, com o pedido já em cache): espera-se pelo
   * pedido carregado e por esse scroll, e rola-se no frame seguinte, com a
   * página já desenhada.
   */
  private readonly navigation = inject(NavigationService);
  private focusDone = false;
  private readonly focusWhenReady = effect(() => {
    if (this.focusDone || !this.focusKey() || !this.review()) return;
    this.focusDone = true;
    void this.navigation.afterNavigationScroll().then(() => requestAnimationFrame(() => this.scrollToFocus()));
  });

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
    if (r.kind === 'CHANGE') return 'Alterações em ' + (r.change?.current.name ?? '');
    return r.kind === 'APPLICATION'
      ? r.profile?.displayName || r.person?.name || ''
      : r.proposals[0]?.name ?? '';
  });

  readonly subtitle = computed(() => {
    const r = this.review();
    if (!r) return '';
    const head = r.kind === 'APPLICATION'
      ? 'Candidatura' + (r.proposals.length ? ' com ' + plural(r.proposals.length, 'proposta de serviço', 'propostas de serviço') : '')
      : KIND_LABEL[r.kind] + (r.person ? ' de ' + r.person.name : '');
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

  /**
   * O que está escrito nas caixas de comentário e ainda não foi salvo, por
   * ponto. Vai junto ao devolver ou concluir, como se tivesse sido salvo.
   */
  private readonly unsaved = signal<Record<string, string>>({});

  unsavedText(key: string): string {
    return this.unsaved()[key] ?? '';
  }

  typeComment(key: string, text: string): void {
    this.unsaved.update(u => {
      const { [key]: _, ...rest } = u;
      return text ? { ...rest, [key]: text } : rest;
    });
  }

  /** O rascunho da equipe: comentários e estados ainda por enviar à pessoa, com o texto por salvar. */
  readonly draft = computed(() => {
    const points = this.review()?.points ?? [];
    const d = reviewDraft(points);
    const typed = points
      .filter(p => this.unsavedText(p.key).trim())
      .map(p => ({ point: p.label, text: this.unsavedText(p.key).trim() }));
    return { ...d, comments: [...d.comments, ...typed] };
  });

  /**
   * Salva no rascunho o que está escrito e não foi salvo, um ponto de cada
   * vez, e só depois devolve ou conclui - que enviam o rascunho todo.
   */
  private withUnsaved(r: Review, send: () => Observable<Review>): Observable<Review> {
    const typed = Object.entries(this.unsaved())
      .filter(([key, text]) => text.trim() && r.points.some(p => p.key === key));
    return from(typed).pipe(
      concatMap(([key, text]) =>
        this.api.comment(r.kind, r.id, key, text.trim(), true).pipe(
          tap(saved => {
            this.review.set(saved);
            this.typeComment(key, '');
          }),
        ),
      ),
      toArray(),
      concatMap(() => send()),
    );
  }
  readonly draftSummary = computed(() => {
    const d = this.draft();
    const parts = [
      d.comments.length ? plural(d.comments.length, 'comentário', 'comentários') : '',
      d.statuses.length ? plural(d.statuses.length, 'mudança de status', 'mudanças de status') : '',
    ].filter(Boolean);
    return parts.join(' e ');
  });

  /**
   * Recusar um item pede pelo menos uma das suas partes negada (o backend
   * confirma ao decidir e ao concluir). As propostas recusadas com o perfil
   * não precisam da sua.
   */
  private rejectionHolds(item: ReviewItem): boolean {
    if (item.decision !== 'REJECTED') return true;
    const withTheProfile = item.key !== 'pro' && this.review()?.kind === 'APPLICATION' && this.proRejected();
    return withTheProfile || this.summary(item.key).denied > 0;
  }

  readonly items = computed<ItemRow[]>(() => {
    const r = this.review();
    if (!r) return [];
    return r.items.map(item => {
      const rd = this.ready(item);
      const denied = this.summary(item.key).denied > 0;
      let hint = '';
      if (this.editable() && item.decision === 'REJECTED' && !this.rejectionHolds(item)) {
        hint = 'A recusa precisa de pelo menos uma parte negada: negue uma parte ou desfaça a recusa.';
      } else if (this.editable() && item.decision !== 'REJECTED') {
        if (rd.blockedByPro) hint = 'Com o perfil recusado, esta proposta também é recusada.';
        else if (!rd.points) {
          hint = denied
            ? 'Para aprovar, todos os pontos deste item devem estar aprovados.'
            : 'Para aprovar, todos os pontos deste item devem estar aprovados. Para recusar, negue pelo menos um.';
        } else if (!rd.audiences) hint = 'Para aprovar, decida os públicos propostos neste serviço.';
      }
      return {
        item,
        kind: item.key === 'pro' ? 'Perfil profissional' : item.key.startsWith('chg:') ? KIND_LABEL.CHANGE : KIND_LABEL.PROPOSAL,
        progress: this.progress(item.key),
        hint,
        canApprove: rd.ok || item.decision === 'APPROVED',
        canReject: (!rd.blockedByPro && denied) || item.decision === 'REJECTED',
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
    () => this.allDecided()
      && (this.review()?.items ?? []).filter(i => i.decision === 'APPROVED').every(i => this.ready(i).ok)
      && (this.review()?.items ?? []).every(i => this.rejectionHolds(i)),
  );

  /**
   * Devolver pede, em cada ponto ainda pendente, um comentário novo da equipe
   * (por enviar) - o backend confirma ao devolver.
   */
  readonly uncommentedPending = computed(() =>
    this.statePoints()
      .filter(p => p.status === 'PENDING' && !p.comments.some(c => c.fromTeam && c.draft) && !this.unsavedText(p.key).trim())
      .map(p => p.label),
  );
  /** Devolve-se para mudar o que está pendente; com um ponto negado, recusa-se o pedido. */
  readonly deniedPoints = computed(() => this.statePoints().filter(p => p.status === 'REJECTED').map(p => p.label));
  readonly canRequestChanges = computed(() => this.uncommentedPending().length === 0 && this.deniedPoints().length === 0);
  readonly requestChangesHint = computed(() => {
    const denied = this.deniedPoints();
    if (denied.length) {
      return `Para devolver, não pode haver pontos negados (${denied.join(', ')}). Com um ponto negado, recuse o pedido.`;
    }
    const missing = this.uncommentedPending();
    return missing.length ? `Para devolver, escreva um comentário em cada ponto pendente: ${missing.join(', ')}.` : '';
  });

  /** Recusado e concluído: nada mais muda, nem a conversa (o backend recusa comentários). */
  readonly rejected = computed(() => this.review()?.stage === 'REJECTED');
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
      : this.allDecided()
        ? 'Um item recusado precisa de pelo menos uma parte negada.'
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

  /** Rola até ao ponto de ?ponto= (já aberto e destacado pelo ReviewThread). */
  private scrollToFocus(): void {
    const key = this.focusKey();
    if (!key) return;
    const thread = [...this.host.nativeElement.querySelectorAll<HTMLElement>('[data-point-key]')]
      .find(el => el.dataset['pointKey'] === key);
    if (!thread) return;
    // Por cima da página ficam a barra do site e a barra do pedido (.rv-bar,
    // fixa por baixo dela), cuja altura muda com a largura: mede-se o fundo
    // dela quando presa, para o ponto (e a faixa "Aguardando sua resposta")
    // não ficar escondido por trás.
    const bar = this.host.nativeElement.querySelector<HTMLElement>('.rv-bar');
    const covered = bar ? (parseFloat(getComputedStyle(bar).top) || 0) + bar.offsetHeight : 94;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({
      top: thread.getBoundingClientRect().top + window.scrollY - covered - 16,
      behavior: reduce ? 'auto' : 'smooth',
    });
    // Para leitores de ecrã e teclado: o foco vai para a barra do ponto,
    // sem segundo salto (o scroll já está a ser feito acima).
    thread.querySelector<HTMLElement>('.rv-thread-head')?.focus({ preventScroll: true });
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

  /**
   * Concluir envia à pessoa a decisão e todo o rascunho da equipa: mostra-se
   * antes o que vai, para confirmar ou voltar e mudar alguma coisa.
   */
  conclude(): void {
    const r = this.review();
    if (!r || !this.canConclude()) return;
    this.dialog
      .open<ReviewSendDialogComponent, ReviewSendDialogData, boolean>(ReviewSendDialogComponent, {
        width: '560px',
        maxWidth: 'calc(100vw - 32px)',
        panelClass: 'care-dialog',
        autoFocus: false,
        data: {
          actionLabel: this.concludeLabel(),
          decisionText: this.concludeHint(),
          danger: this.concludeDanger(),
          draft: this.draft(),
        },
      })
      .afterClosed()
      .subscribe(ok => {
        if (ok) this.act(this.withUnsaved(r, () => this.api.conclude(r.kind, r.id)));
      });
  }

  requestChanges(): void {
    const r = this.review();
    if (r && this.canRequestChanges()) this.act(this.withUnsaved(r, () => this.api.requestChanges(r.kind, r.id)));
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

  /** Numa alteração: o serviço como ficaria (a página mostra-o com os pontos sob as partes mudadas). */
  readonly changeView = computed(() => {
    const ch = this.review()?.change;
    return ch ? serviceViewFromContent(ch.proposed, this.options(), ch.current.audiences) : null;
  });

  /** A chave do item de uma alteração ("chg:{id}"), prefixo dos seus pontos. */
  readonly changeItem = computed(() => 'chg:' + (this.review()?.id ?? ''));

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
