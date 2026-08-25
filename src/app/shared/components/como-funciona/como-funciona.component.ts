import { Component, inject } from '@angular/core';
import { NavigationService } from '../../services/navigation.service';
import { SessionService } from '../../services/session.service';
import { Pages } from '../../enums/pages.enum';

interface Step {
  n: string;
  title: string;
  description: string;
  needsLogin: boolean;
  accentColor: string;
}

@Component({
  selector: 'app-como-funciona',
  standalone: true,
  templateUrl: './como-funciona.component.html',
  styleUrl: './como-funciona.component.scss',
})
export class ComoFuncionaComponent {
  private readonly navigationService = inject(NavigationService);
  private readonly sessionService = inject(SessionService);

  readonly isAuthenticated = this.sessionService.isAuthenticated;

  readonly steps: Step[] = [
    {
      n: '01',
      title: 'Escolha o serviço e a pessoa profissional',
      description: 'Veja as abordagens disponíveis e para quem cada uma se destina antes de decidir.',
      needsLogin: false,
      accentColor: 'var(--color-secondary-indigo)',
    },
    {
      n: '02',
      title: 'Veja a agenda completa',
      description: 'Datas, horários, modalidade de atendimento e valor aparecem antes da confirmação.',
      needsLogin: true,
      accentColor: 'var(--color-secondary-cyan)',
    },
    {
      n: '03',
      title: 'Confirme e acompanhe pelo perfil',
      description: 'Cancelar, reagendar e rever os seus atendimentos ficam no mesmo lugar.',
      needsLogin: true,
      accentColor: 'var(--color-secondary-green)',
    },
  ];

  navigateToSignUp(): void {
    this.navigationService.navigateTo(Pages.SIGN_UP);
  }
}
