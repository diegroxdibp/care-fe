import { Component, computed, effect, inject, Output, EventEmitter } from '@angular/core';
import { AuthService } from '../../../auth/auth.service';
import { NavigationService } from '../../services/navigation.service';
import { NavigationBarService } from '../../services/navigation-bar.service';
import { SessionService } from '../../services/session.service';
import { ScreenSizeService } from '../../services/screen-size.service';
import { NotificationService } from '../../../core/services/notification.service';
import { MessageService } from '../../../core/services/message.service';
import { Pages } from '../../enums/pages.enum';
import { Roles } from '../../enums/roles.enum';

interface NavRow {
  label: string;
  icon: string;
  page: Pages;
  showBadge?: boolean;
  ariaLabel?: string;
  /** De onde vem a contagem do badge — cada linha pode ter a sua própria fonte. */
  badgeCount?: () => number;
}

@Component({
  selector: 'app-mobile-menu-sheet',
  imports: [],
  templateUrl: './mobile-menu-sheet.component.html',
  styleUrl: './mobile-menu-sheet.component.scss',
})
export class MobileMenuSheetComponent {
  @Output() closed = new EventEmitter<void>();

  private readonly authService = inject(AuthService);
  private readonly sessionService = inject(SessionService);
  private readonly screenSizeService = inject(ScreenSizeService);
  readonly navigationService = inject(NavigationService);
  readonly navbarService = inject(NavigationBarService);
  readonly notificationService = inject(NotificationService);
  readonly messageService = inject(MessageService);
  readonly Pages = Pages;

  constructor() {
    effect(() => {
      if (this.screenSizeService.isTablet() || this.screenSizeService.isDesktop()) {
        this.closed.emit();
      }
    });
  }

  private readonly user = this.sessionService.user;

  readonly userInitials = computed(() => {
    const parts = (this.user()?.name ?? '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return parts.length === 1
      ? parts[0][0].toUpperCase()
      : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  });

  readonly userName = computed(() => this.user()?.name ?? '');
  readonly userEmail = computed(() => this.user()?.email ?? '');


  private readonly baseRows: NavRow[] = [
    {
      label: 'Mensagens',
      icon: 'forum',
      page: Pages.DASHBOARD_MESSAGES,
      showBadge: true,
      ariaLabel: 'Mensagens',
      badgeCount: () => this.messageService.unreadCount(),
    },
    {
      label: 'Notificações',
      icon: 'notifications',
      page: Pages.DASHBOARD,
      showBadge: true,
      ariaLabel: 'Notificações',
      badgeCount: () => this.notificationService.unreadCount(),
    },
    { label: 'Conta', icon: 'person', page: Pages.DASHBOARD_PROFILE },
  ];

  /** As linhas da conta, mais a área da equipa (/admin) para quem é ADMIN. */
  readonly userRows = computed<NavRow[]>(() =>
    this.user()?.roles?.includes(Roles.ADMIN)
      ? [...this.baseRows, { label: 'Área da equipe', icon: 'admin_panel_settings', page: Pages.ADMIN }]
      : this.baseRows,
  );

  go(page: Pages): void {
    this.navigationService.navigateTo(page);
    this.closed.emit();
  }

  signIn(): void {
    this.navigationService.navigateTo(Pages.SIGN_IN);
    this.closed.emit();
  }

  logout(): void {
    this.authService.logout();
    this.closed.emit();
  }

  close(): void {
    this.closed.emit();
  }
}
