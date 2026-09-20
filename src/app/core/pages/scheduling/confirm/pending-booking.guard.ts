import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SchedulingService } from '../../../../shared/services/scheduling.service';
import { Pages } from '../../../../shared/enums/pages.enum';

/**
 * A confirmação só existe na sequência de uma escolha. Chegar aqui por URL
 * direto, recarregar a página ou voltar depois de marcar deixa a rota sem
 * seleção — nesse caso volta-se à lista de horários em vez de mostrar uma
 * revisão vazia. Isto também é o que acontece a quem regressa de um
 * agendamento pendente após autenticar (AccessGuard → /scheduling/conta →
 * signup/login): o Google OAuth recarrega a app do zero, o que já limpa este
 * estado em memória, então o slot "stale" acaba aqui como qualquer outro —
 * sem seleção — e volta-se ao passo 4, com o serviço/profissional
 * pré-selecionados quando a URL original os tinha, nunca um ecrã de erro.
 */
export const pendingBookingGuard: CanActivateFn = (route) => {
  const schedulingService = inject(SchedulingService);
  const router = inject(Router);

  if (schedulingService.pendingBooking()) {
    return true;
  }

  const service = route.queryParamMap.get('service');
  const professional = route.queryParamMap.get('professional');
  const queryParams: Record<string, string> = {};
  if (service) queryParams['service'] = service;
  if (professional) queryParams['professional'] = professional;

  return router.createUrlTree([Pages.SCHEDULING], { queryParams });
};
