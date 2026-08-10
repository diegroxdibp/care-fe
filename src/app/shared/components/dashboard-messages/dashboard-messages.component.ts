import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MessageService } from '../../../core/services/message.service';
import { SessionService } from '../../services/session.service';
import { ChatMessage, Thread } from '../../models/message.model';
import { ProfessionalSessionService } from '../../enums/professional-session-service.enum';

interface DayGroup {
  label: string;
  messages: ChatMessage[];
}

/**
 * O backend grava o contextLabel da thread com o nome do serviço em inglês
 * (SessionService.getDisplayName) — traduz aqui para o mesmo português que o
 * resto da aplicação mostra, inclusive nas threads já gravadas.
 */
const SERVICE_LABEL_PT: Record<string, string> = {
  'Reichian Body Analysis': ProfessionalSessionService.REICHIAN_BODY_ANALYSIS,
  Mindfulness: ProfessionalSessionService.MINDFULNESS,
  'Somatic Experiencing®': ProfessionalSessionService.SOMATIC_EXPERIENCE,
  Supervision: ProfessionalSessionService.SUPERVISION,
};

@Component({
  selector: 'app-dashboard-messages',
  imports: [],
  templateUrl: './dashboard-messages.component.html',
  styleUrl: './dashboard-messages.component.scss',
})
export class DashboardMessagesComponent implements OnInit, OnDestroy {
  readonly messageService = inject(MessageService);
  private readonly sessionService = inject(SessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly selectedThreadId = signal<number | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly draft = signal('');
  readonly sending = signal(false);

  private incomingSub?: Subscription;

  readonly currentUserId = computed(() => this.sessionService.user()?.id ?? null);

  readonly selectedThread = computed(() =>
    this.messageService.threads().find((t) => t.id === this.selectedThreadId()) ?? null,
  );

  readonly dayGroups = computed<DayGroup[]>(() => {
    // Slice devolve mais recentes primeiro — inverte para ordem cronológica na conversa.
    const ordered = [...this.messages()].reverse();
    const groups: DayGroup[] = [];
    for (const m of ordered) {
      const label = this.dayLabel(m.createdAt);
      const last = groups[groups.length - 1];
      if (last && last.label === label) {
        last.messages.push(m);
      } else {
        groups.push({ label, messages: [m] });
      }
    }
    return groups;
  });

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const raw = params.get('thread');
      const id = raw ? Number(raw) : null;
      if (id) this.selectThread(id);
    });

    this.incomingSub = this.messageService.incoming$.subscribe((msg) => {
      if (msg.threadId === this.selectedThreadId()) {
        this.messages.update((list) => [msg, ...list]);
        this.messageService.markRead(msg.threadId).subscribe();
      }
    });
  }

  ngOnDestroy(): void {
    this.incomingSub?.unsubscribe();
  }

  selectThread(id: number): void {
    this.selectedThreadId.set(id);
    this.messages.set([]);
    this.messageService.listMessages(id).subscribe((slice) => this.messages.set(slice.content));
    this.messageService.markRead(id).subscribe();
  }

  send(): void {
    const threadId = this.selectedThreadId();
    const body = this.draft().trim();
    if (!threadId || !body || this.sending()) return;

    this.sending.set(true);
    this.messageService.sendMessage(threadId, body).subscribe({
      next: (msg) => {
        this.messages.update((list) => [msg, ...list]);
        this.draft.set('');
        this.sending.set(false);
      },
      error: () => this.sending.set(false),
    });
  }

  isMine(msg: ChatMessage): boolean {
    return msg.senderId === this.currentUserId();
  }

  /** "Supervision · sessão de 12 ago, 14:30" → "Supervisão · sessão de 12 ago, 14:30". */
  contextLabel(thread: Thread): string {
    const [service, ...rest] = thread.contextLabel.split(' · ');
    const translated = SERVICE_LABEL_PT[service.trim()] ?? service;
    return [translated, ...rest].join(' · ');
  }

  timeLabel(iso: string): string {
    return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  }

  goToSession(thread: Thread): void {
    if (!thread.appointmentId) return;
    this.router.navigate(['/dashboard'], { state: { openAppointmentId: thread.appointmentId } });
  }

  private dayLabel(iso: string): string {
    const date = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

    if (sameDay(date, today)) return 'Hoje';
    if (sameDay(date, yesterday)) return 'Ontem';
    return date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
  }
}
