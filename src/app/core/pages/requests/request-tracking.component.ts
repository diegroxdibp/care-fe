import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ReviewApiService } from '../../services/review-api.service';
import {
  ITEM_DECISION,
  kindFromPath,
  kindPath,
  plural,
  POINT_STATUS,
  Review,
  ReviewStage,
  STAGE,
} from '../../../shared/models/review.model';
import { Pages } from '../../../shared/enums/pages.enum';
import { SessionService } from '../../../shared/services/session.service';
import { detectBrowserTimezone, sessionZone, zonedWallTimeToInstant } from '../../../shared/utils/timezones.util';
import { timeInZone } from '../../../shared/utils/picker-slots.util';
import { InterviewSectionComponent } from '../../../shared/components/review/interview-section/interview-section.component';

/**
 * /meus-pedidos/:tipo/:id — acompanhar um pedido (handoff: "Acompanhamento
 * do Pedido"): as etapas, o que acontece a seguir, a entrevista, o que
 * precisa de resposta e a decisão por item.
 */
@Component({
  selector: 'app-request-tracking',
  standalone: true,
  imports: [RouterLink, InterviewSectionComponent],
  template: `
    <div class="cat-page">
      @if (review(); as r) {
        <section class="rv-col rv-col--tracking">
          <div class="rv-head">
            <a class="rv-back" [routerLink]="['/', Pages.MEUS_PEDIDOS]">← Meus pedidos</a>
            <span class="cat-overline">{{ r.kind === 'APPLICATION' ? 'Candidatura' : 'Proposta de serviço' }}</span>
            <h1>{{ title() }}</h1>
            @if (subtitle()) {
              <span class="rv-subtitle">{{ subtitle() }}</span>
            }
          </div>

          <ol class="rv-steps" aria-label="Etapas do pedido" [style.--rv-steps]="steps().length">
            @for (s of steps(); track s.n) {
              <li
                [class.rv-step--done]="s.done"
                [class.rv-step--current]="s.current"
                [class]="s.current ? 'rv-tone-' + s.tone : ''"
                [attr.aria-current]="s.current ? 'step' : null"
              >
                <div class="rv-step-line">
                  <span class="rv-step-circle">
                    @if (s.done) {
                      <span translate="no" aria-hidden="true" class="material-symbols-outlined">check</span>
                    } @else {
                      {{ s.n }}
                    }
                  </span>
                  @if (!$last) {
                    <span class="rv-step-connector"></span>
                  }
                </div>
                <span class="rv-step-label">{{ s.label }}</span>
              </li>
            }
          </ol>

          <div class="rv-box" [class]="'rv-tone-' + stage().tone">
            <span class="rv-status-line"><span class="rv-dot"></span>{{ stage().label }}</span>
            <span class="rv-box-text rv-box-text--lg">{{ stageText() }}</span>
            @if (r.stage === 'CHANGES') {
              <a class="rv-text-btn" [routerLink]="reviseLink()" [queryParams]="reviseQuery()">Rever o pedido →</a>
            }
          </div>

          @if (showInterview()) {
            <app-interview-section [review]="r" [overline]="false" (changed)="review.set($event)" />
          }

          @if (attention().length) {
            <div class="rv-section">
              <div class="rv-section-head">
                <h2>{{ inAnalysis() ? 'O que precisa de resposta' : 'Comentários da equipe' }}</h2>
                <p class="rv-intro">
                  {{ inAnalysis() ? 'Pontos negados ou com uma mensagem da equipe aguardando resposta.' : 'Mensagens da equipe sobre a decisão.' }}
                </p>
              </div>
              <div class="rv-rows">
                @for (p of attention(); track p.key) {
                  <div class="rv-row rv-row--tight">
                    <div class="rv-choices">
                      @if (p.status) {
                        <span class="rv-badge" [class]="'rv-tone-' + p.status.tone"><span class="rv-dot"></span>{{ p.status.label }}</span>
                      }
                      <span class="rv-row-name rv-row-name--sm">{{ p.label }}</span>
                    </div>
                    @if (p.last) {
                      <div class="rv-attention-last">
                        <span class="rv-attention-who">Equipe CARE · {{ p.when }}</span>
                        <span class="rv-attention-text">{{ p.last }}</span>
                      </div>
                    }
                    <a class="rv-text-btn" [routerLink]="reviewLink()">{{ inAnalysis() ? 'Ver e responder →' : 'Ver no pedido →' }}</a>
                  </div>
                }
              </div>
            </div>
          }

          <div class="rv-section">
            <h2>Status do pedido</h2>
            <div class="rv-rows">
              @for (it of items(); track it.key) {
                <div class="rv-row rv-row--inline">
                  <div class="rv-row-text">
                    <span class="cat-overline">{{ it.kind }}</span>
                    <span class="rv-row-name">{{ it.name }}</span>
                    <span class="rv-row-detail">{{ it.progress }}</span>
                  </div>
                  <span class="rv-badge" [class]="'rv-tone-' + it.tone"><span class="rv-dot"></span>{{ it.label }}</span>
                </div>
              }
            </div>
            <a class="rv-btn-outline" [routerLink]="reviewLink()">Ver o pedido completo e os comentários</a>
          </div>
        </section>
      } @else if (notFound()) {
        <section class="rv-col">
          <p class="rv-empty">Pedido não encontrado.</p>
          <a class="rv-back" [routerLink]="['/', Pages.MEUS_PEDIDOS]">← Meus pedidos</a>
        </section>
      } @else {
        <section class="rv-col"><p class="rv-empty">Carregando…</p></section>
      }
    </div>
  `,
})
export class RequestTrackingComponent implements OnInit {
  private readonly api = inject(ReviewApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(SessionService);

  readonly Pages = Pages;
  readonly review = signal<Review | null>(null);
  readonly notFound = signal(false);

  private readonly zone = computed(() => this.session.user()?.timeZone || detectBrowserTimezone());

  readonly stage = computed(() => STAGE[this.review()?.stage ?? 'ANALYSIS']);
  readonly inAnalysis = computed(() => ['ANALYSIS', 'CHANGES'].includes(this.review()?.stage ?? ''));

  readonly title = computed(() => {
    const r = this.review();
    if (!r) return '';
    return r.kind === 'APPLICATION' ? r.profile?.displayName || r.person?.name || '' : r.proposals[0]?.name ?? '';
  });

  readonly subtitle = computed(() => {
    const r = this.review();
    if (!r) return '';
    const n = r.kind === 'APPLICATION' && r.proposals.length
      ? 'Com ' + plural(r.proposals.length, 'proposta de serviço', 'propostas de serviço') + ' · '
      : '';
    return n + (r.submittedAt ? 'Enviado a ' + this.day(r.submittedAt) : '');
  });

  readonly steps = computed(() => {
    const r = this.review();
    if (!r) return [];
    const labels = r.kind === 'APPLICATION'
      ? ['Envio', 'Análise', 'Entrevista', 'Publicação']
      : ['Envio', 'Análise', 'Publicação'];
    const current: Record<ReviewStage, number> = {
      ANALYSIS: 1,
      CHANGES: 1,
      REJECTED: 1,
      INTERVIEW_TO_BOOK: 2,
      INTERVIEW_BOOKED: 2,
      PUBLISHED: labels.length,
    };
    const cur = current[r.stage];
    return labels.map((label, i) => {
      const isCur = i === cur;
      return {
        n: i + 1,
        done: i < cur,
        current: isCur,
        tone: isCur && r.stage === 'REJECTED' ? 'red' : 'blue',
        label: isCur && r.stage === 'REJECTED'
          ? 'Análise · recusado'
          : isCur && r.stage === 'CHANGES'
            ? 'Análise · alterações pedidas'
            : label,
      };
    });
  });

  private readonly proApproved = computed(() => {
    const r = this.review();
    return !!r && r.kind === 'APPLICATION' && r.decision === 'CONCLUDED'
      && r.items.find(i => i.key === 'pro')?.decision === 'APPROVED';
  });

  readonly showInterview = computed(() => this.proApproved());

  private readonly refusedNote = computed(() => {
    const r = this.review();
    if (!r || !this.proApproved()) return '';
    const refused = r.items.filter(i => i.serviceId !== null && i.decision === 'REJECTED').map(i => `“${i.name}”`);
    if (!refused.length) return '';
    return ' ' + (refused.length === 1
      ? `A proposta ${refused[0]} não foi aprovada`
      : `As propostas ${refused.join(', ')} não foram aprovadas`) + '; os comentários da equipe estão no pedido.';
  });

  readonly stageText = computed(() => {
    const r = this.review();
    if (!r) return '';
    const iv = r.interview;
    const start = iv ? zonedWallTimeToInstant(iv.date, iv.startTime, sessionZone(iv.timeZone)) : null;
    const when = start
      ? `${this.weekday(start)}, às ${timeInZone(start, this.zone())}`
      : '';
    const texts: Record<ReviewStage, string> = {
      ANALYSIS: 'A equipe da CARE está analisando o pedido, parte por parte. Você pode acompanhar e responder aos comentários à medida que forem surgindo.',
      CHANGES: 'A equipe pediu alterações nos pontos indicados abaixo. Depois que você revisar o pedido, a análise continua.',
      INTERVIEW_TO_BOOK: 'Seu perfil foi aprovado. O próximo passo é uma entrevista com a equipe da CARE: escolha abaixo o horário mais conveniente para você.' + this.refusedNote(),
      INTERVIEW_BOOKED: `A entrevista está agendada para ${when}. Depois da entrevista, o perfil e os serviços aprovados são publicados.` + this.refusedNote(),
      PUBLISHED: (r.kind === 'APPLICATION'
        ? 'Seu perfil e os serviços aprovados estão publicados na plataforma.'
        : 'A proposta foi aprovada e o serviço está publicado.') + this.refusedNote(),
      REJECTED: 'O pedido não foi aprovado. Os comentários da equipe estão no pedido completo.',
    };
    return texts[r.stage];
  });

  /** Pontos negados (em análise) ou cuja última mensagem é da equipa. */
  readonly attention = computed(() => {
    const r = this.review();
    if (!r) return [];
    return r.points
      .map(p => {
        const last = p.comments[p.comments.length - 1];
        const unanswered = !!last && last.fromTeam;
        const denied = p.status === 'REJECTED';
        if (!(unanswered || (this.inAnalysis() && denied))) return null;
        return {
          key: p.key,
          label: p.label,
          status: p.status ? POINT_STATUS[p.status] : null,
          last: unanswered ? last.text : '',
          when: unanswered ? this.shortDay(last.at) : '',
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  });

  readonly items = computed(() => {
    const r = this.review();
    if (!r) return [];
    return r.items.map(it => {
      const pts = r.points.filter(p => p.itemKey === it.key);
      const ok = pts.filter(p => p.status === 'APPROVED').length;
      const denied = pts.filter(p => p.status === 'REJECTED').length;
      const decided = r.decision === 'CONCLUDED' && it.decision ? ITEM_DECISION[it.decision] : null;
      const status = decided ?? (r.stage === 'CHANGES'
        ? { label: 'Alterações pedidas', tone: 'lilac' }
        : { label: 'Em análise', tone: 'blue' });
      return {
        key: it.key,
        kind: it.key === 'pro' ? 'Perfil profissional' : 'Proposta de serviço',
        name: it.name,
        progress: `${ok} de ${plural(pts.length, 'ponto aprovado', 'pontos aprovados')}`
          + (denied ? ' · ' + plural(denied, 'negado', 'negados') : ''),
        ...status,
      };
    });
  });

  readonly reviewLink = computed(() => {
    const r = this.review();
    return r ? ['/', Pages.MEUS_PEDIDOS, kindPath(r.kind), r.id, 'pedido'] : [];
  });

  /** Rever: a candidatura no formulário do pedido; uma proposta na página de propostas. */
  readonly reviseLink = computed(() =>
    this.review()?.kind === 'APPLICATION' ? ['/', ...Pages.JUNTE_SE_PEDIDO.split('/')] : ['/', 'dashboard', 'servicos', 'propor'],
  );
  readonly reviseQuery = computed(() => {
    const r = this.review();
    return r && r.kind === 'PROPOSAL' ? { rever: r.id } : {};
  });

  ngOnInit(): void {
    const kind = kindFromPath(this.route.snapshot.paramMap.get('kind'));
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!kind || !id) {
      this.notFound.set(true);
      return;
    }
    this.api.get(kind, id).subscribe({
      next: r => this.review.set(r),
      error: () => this.notFound.set(true),
    });
  }

  private day(at: string): string {
    return new Date(at).toLocaleDateString('pt-PT', { timeZone: this.zone(), day: 'numeric', month: 'long', year: 'numeric' });
  }

  private shortDay(at: string): string {
    return new Date(at).toLocaleDateString('pt-PT', { timeZone: this.zone(), day: 'numeric', month: 'long' });
  }

  private weekday(instant: Date): string {
    const s = instant.toLocaleDateString('pt-PT', { timeZone: this.zone(), weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}
