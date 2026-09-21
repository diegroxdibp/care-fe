import { Component, computed, effect, inject, signal } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterOutlet,
} from '@angular/router';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from './core/components/header/header.component';
import { LoadingService } from './core/services/loading.service';
import { ErrorService } from './core/services/error.service';
import { FooterComponent } from './core/components/footer/footer.component';
import { NotificationService } from './core/services/notification.service';
import { MessageService } from './core/services/message.service';
import { SessionService } from './shared/services/session.service';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    RouterOutlet,
    FooterComponent,
    HeaderComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  standalone: true,
})
export class AppComponent {
  title = 'CARE - Clínica Ampliada Resignificações';
  loader = inject(LoadingService);
  readonly errorService = inject(ErrorService);
  router = inject(Router);
  private readonly notificationService = inject(NotificationService);
  private readonly messageService = inject(MessageService);
  private readonly sessionService = inject(SessionService);

  private readonly currentUrl = signal(this.router.url);

  /** A chamada de vídeo é de ecrã inteiro de propósito - o header fixo (e o menu nele) só lhe ficava por cima. */
  readonly hideChrome = computed(() => /^\/appointments\/\d+\/room(\/|$)/.test(this.currentUrl()));

  constructor() {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.loader.setRouteLoading(true);
      }

      if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        this.loader.setRouteLoading(false);
      }

      if (event instanceof NavigationEnd) {
        this.currentUrl.set(event.urlAfterRedirects);
      }
    });

    effect(() => {
      if (this.sessionService.user()?.profileCompleted) {
        this.notificationService.connect();
        this.messageService.connect();
      } else {
        this.notificationService.disconnect();
        this.messageService.disconnect();
      }
    });
  }
}
