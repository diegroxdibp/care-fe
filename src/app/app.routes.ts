import { inject, NgModule } from '@angular/core';
import { Router, RouterModule, Routes } from '@angular/router';
import { Pages } from './shared/enums/pages.enum';
import { AccessGuard } from './auth/auth.guard';
import { AuthOnlyGuard } from './auth/authOnly.guard';
import { AvailabilityAccessGuard } from './auth/availability-access.guard';
import { AdminGuard } from './auth/admin.guard';
import { GuestOnlyGuard } from './auth/guest-only.guard';
import { pendingBookingGuard } from './core/pages/scheduling/confirm/pending-booking.guard';
import { HomeComponent } from './core/pages/home/home.component';

/** Os serviços estão listados na home; as listas antigas levam até lá. */
const toHomeServices = () => inject(Router).createUrlTree(['/'], { fragment: Pages.SERVICES });

export const routes: Routes = [
  // HOME is eager (not loadComponent): it's the landing page almost every
  // visitor hits first, and lazy-loading it left a real gap where the
  // router-outlet was empty and the sticky footer collapsed up to fill the
  // short page, then jumped down once the chunk arrived.
  {
    path: Pages.HOME,
    component: HomeComponent,
  },

  // A lista de serviços (docs/plans/service-catalogue.md): a página de cada
  // serviço e de cada pessoa profissional, e o "Junte-se a nós". Públicas.
  // Não há páginas de lista: os serviços estão na home, e a cada perfil
  // chega-se pelos serviços. pathMatch full, para não apanhar os endereços
  // antigos de baixo (/atendimento/individual/...).
  { path: Pages.ATENDIMENTO, pathMatch: 'full', redirectTo: toHomeServices },
  { path: Pages.ATENDIMENTO_INDIVIDUAL, pathMatch: 'full', redirectTo: toHomeServices },
  { path: Pages.ATENDIMENTO_GRUPO, pathMatch: 'full', redirectTo: toHomeServices },
  {
    path: `${Pages.SERVICOS}/:slug`,
    loadComponent: () =>
      import('./core/pages/catalogue/service-page.component').then((m) => m.ServicePageComponent),
  },
  { path: Pages.PROFISSIONAIS, pathMatch: 'full', redirectTo: toHomeServices },
  {
    path: `${Pages.PROFISSIONAIS}/:slug`,
    loadComponent: () =>
      import('./core/pages/catalogue/professional-page.component').then((m) => m.ProfessionalPageComponent),
  },
  {
    path: Pages.JUNTE_SE,
    pathMatch: 'full',
    loadComponent: () => import('./core/pages/catalogue/join-us.component').then((m) => m.JoinUsComponent),
  },

  // Os endereços das páginas fixas de antes levam às páginas novas.
  { path: Pages.ANALISE_REICHANA, redirectTo: `${Pages.SERVICOS}/analise-corporal-reichiana` },
  { path: Pages.MINDFULLNESS, redirectTo: `${Pages.SERVICOS}/mindfulness` },
  { path: Pages.SOMATIC_EXPERIENCE, redirectTo: `${Pages.SERVICOS}/somatic-experiencing` },
  { path: Pages.SUPERVISION, redirectTo: `${Pages.SERVICOS}/supervisao-em-analise-reichiana` },
  { path: Pages.LUANE, redirectTo: `${Pages.PROFISSIONAIS}/luane` },
  { path: `${Pages.BIO}/:name`, redirectTo: toHomeServices },
  { path: Pages.BIO, redirectTo: toHomeServices },

  {
    path: Pages.ABOUT,
    loadComponent: () =>
      import('./core/pages/about/about.component').then(
        (m) => m.AboutComponent,
      ),
  },

  {
    path: Pages.CONTACT,
    loadComponent: () =>
      import('./core/pages/contact/contact.component').then(
        (m) => m.ContactComponent,
      ),
  },

  // auth
  {
    path: 'auth',
    loadChildren: () =>
      import('./auth/auth.module').then((m) => m.AuthModule),
  },

  // onboarding
  {
    path: 'onboarding',
    canMatch: [AuthOnlyGuard],
    loadComponent: () =>
      import('./shared/components/onboarding/onboarding.component').then(
        (m) => m.OnboardingComponent,
      ),
  },

  // public leaf routes - must come before the protected "" group below,
  // since a canMatch guard on an empty-path parent is evaluated as a
  // candidate match for any URL (not just ones its children match), and a
  // guard returning a redirect UrlTree short-circuits the whole navigation
  // before the router ever gets to try routes later in this array.
  {
    path: Pages.INSTITUTIONAL,
    loadComponent: () =>
      import('./core/pages/legal/legal.component').then(
        (m) => m.LegalPageComponent,
      ),
  },

  {
    path: Pages.POLITICA_PRIVACIDADE,
    loadComponent: () =>
      import('./core/pages/legal/legal.component').then(
        (m) => m.LegalPageComponent,
      ),
  },

  {
    path: Pages.TERMOS_USO,
    loadComponent: () =>
      import('./core/pages/legal/legal.component').then(
        (m) => m.LegalPageComponent,
      ),
  },

  {
    path: 'error',
    loadComponent: () =>
      import('./core/pages/error/error.component').then(
        (m) => m.ErrorPageComponent,
      ),
  },

  // A invitation link from an email. Public: someone without an account (or
  // logged out) sees who invited them and is sent to sign up or log in, and
  // comes back here through the return path. Outside the protected "" group
  // for the same ordering reason as the other public routes.
  {
    path: 'invitations/:token',
    loadComponent: () =>
      import('./shared/components/invitation-page/invitation-page.component').then(
        (m) => m.InvitationPageComponent,
      ),
  },

  // Step 1 of 5 of the scheduling flow — where AccessGuard sends a
  // logged-out visitor instead of the old blocking snackbar. Public and
  // guest-only, same as the rest of /auth; must stay outside the protected
  // "" group below for the same ordering reason as the other public routes.
  {
    path: `${Pages.SCHEDULING}/conta`,
    canMatch: [GuestOnlyGuard],
    loadComponent: () =>
      import('./core/pages/scheduling/account-step/account-step.component').then(
        (m) => m.AccountStepComponent,
      ),
  },

  // protected area
  {
    path: '',
    canMatch: [AccessGuard],
    children: [
      {
        path: Pages.DASHBOARD,
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(
            (m) => m.DashboardPageComponent,
          ),

        children: [
          {
            // O perfil profissional (página pública), separado do perfil pessoal.
            path: 'perfil-profissional',
            canMatch: [AvailabilityAccessGuard],
            loadComponent: () =>
              import(
                './shared/components/catalogue/professional-profile-editor/professional-profile-editor.component'
              ).then((m) => m.ProfessionalProfileEditorComponent),
          },

          {
            // As ofertas: que serviços da lista oferece e como.
            path: 'servicos',
            canMatch: [AvailabilityAccessGuard],
            loadComponent: () =>
              import('./shared/components/catalogue/offerings-editor/offerings-editor.component').then(
                (m) => m.OfferingsEditorComponent,
              ),
          },

          {
            path: 'servicos/propor',
            canMatch: [AvailabilityAccessGuard],
            loadComponent: () =>
              import(
                './shared/components/catalogue/service-proposal-page/service-proposal-page.component'
              ).then((m) => m.ServiceProposalPageComponent),
          },

          {
            path: 'servicos/:serviceId/alterar',
            canMatch: [AvailabilityAccessGuard],
            loadComponent: () =>
              import(
                './shared/components/catalogue/service-proposal-page/service-proposal-page.component'
              ).then((m) => m.ServiceProposalPageComponent),
          },

          {
            path: 'profile',
            loadComponent: () =>
              import(
                './shared/components/dashboard-profile/dashboard-profile.component'
              ).then((m) => m.DashboardProfileComponent),
          },

          {
            path: 'notifications',
            loadComponent: () =>
              import(
                './shared/components/dashboard-notifications/dashboard-notifications.component'
              ).then((m) => m.DashboardNotificationsComponent),
          },

          {
            path: 'co-professional-requests/:id',
            loadComponent: () =>
              import(
                './shared/components/co-professional-request-page/co-professional-request-page.component'
              ).then((m) => m.CoProfessionalRequestPageComponent),
          },

          {
            path: 'ownership-transfers/:id',
            loadComponent: () =>
              import(
                './shared/components/ownership-transfer-page/ownership-transfer-page.component'
              ).then((m) => m.OwnershipTransferPageComponent),
          },

          {
            path: 'proposals/:id',
            loadComponent: () =>
              import(
                './shared/components/proposal-confirm/proposal-confirm.component'
              ).then((m) => m.ProposalConfirmComponent),
          },

          {
            path: 'reschedules/:id',
            loadComponent: () =>
              import(
                './shared/components/reschedule-confirm/reschedule-confirm.component'
              ).then((m) => m.RescheduleConfirmComponent),
          },

          {
            path: 'messages',
            loadComponent: () =>
              import(
                './shared/components/dashboard-messages/dashboard-messages.component'
              ).then((m) => m.DashboardMessagesComponent),
          },

          {
            // Mesma restrição de papel que /availability — só quem atende tem agenda própria.
            path: 'my-appointments',
            canMatch: [AvailabilityAccessGuard],
            loadComponent: () =>
              import(
                './shared/components/dashboard-professional-appointments/dashboard-professional-appointments.component'
              ).then((m) => m.DashboardProfessionalAppointmentsComponent),
          },

          {
            // Ferramenta de quem atende, mesma restrição de papel — ver RoomController no backend.
            path: 'salas',
            canMatch: [AvailabilityAccessGuard],
            loadComponent: () =>
              import(
                './shared/components/dashboard-salas/dashboard-salas.component'
              ).then((m) => m.DashboardSalasComponent),
          },

          {
            // Prontuário - o acesso a cada pessoa cliente é decidido no backend
            // (tem de haver marcação); o guard só esconde a área a quem não atende.
            path: 'clientes',
            canMatch: [AvailabilityAccessGuard],
            loadComponent: () =>
              import(
                './shared/components/dashboard-clients/dashboard-clients.component'
              ).then((m) => m.DashboardClientsComponent),
          },

          {
            path: 'clientes/:clientId',
            canMatch: [AvailabilityAccessGuard],
            loadComponent: () =>
              import(
                './shared/components/dashboard-client-record/dashboard-client-record.component'
              ).then((m) => m.DashboardClientRecordComponent),
          },
        ],
      },

      {
        // O pedido para fazer parte da Care pede sessão: quem não tem conta
        // cria uma e volta aqui (junte-se está na lista de return paths).
        path: Pages.JUNTE_SE_PEDIDO,
        loadComponent: () =>
          import('./core/pages/catalogue/application-form/application-form.component').then(
            (m) => m.ApplicationFormComponent,
          ),
      },

      {
        path: Pages.ADMIN,
        canMatch: [AdminGuard],
        loadComponent: () => import('./pages/admin/admin-shell.component').then((m) => m.AdminShellComponent),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'pedidos' },
          {
            path: 'pedidos',
            loadComponent: () =>
              import('./pages/admin/admin-requests.component').then((m) => m.AdminRequestsComponent),
          },
          {
            path: 'servicos',
            loadComponent: () =>
              import('./pages/admin/admin-services.component').then((m) => m.AdminServicesComponent),
          },
          {
            path: 'servicos/:id',
            loadComponent: () =>
              import('./pages/admin/admin-services.component').then((m) => m.AdminServicesComponent),
          },
          {
            path: 'profissionais',
            loadComponent: () =>
              import('./pages/admin/admin-professionals.component').then((m) => m.AdminProfessionalsComponent),
          },
          {
            path: 'profissionais/:id',
            loadComponent: () =>
              import('./pages/admin/admin-professionals.component').then((m) => m.AdminProfessionalsComponent),
          },
        ],
      },

      {
        path: Pages.SCHEDULING,
        loadComponent: () =>
          import('./core/pages/scheduling/scheduling.component').then(
            (m) => m.SchedulingComponent,
          ),
      },

      {
        // Passo 2 do agendamento. O guard devolve à lista quando não há
        // seleção pendente — URL direto, refresh ou voltar após marcar.
        path: `${Pages.SCHEDULING}/confirmar`,
        canActivate: [pendingBookingGuard],
        loadComponent: () =>
          import('./core/pages/scheduling/confirm/confirm.component').then(
            (m) => m.SchedulingConfirmComponent,
          ),
      },

      {
        path: Pages.AVAILABILITY,
        canMatch: [AvailabilityAccessGuard],
        loadComponent: () =>
          import('./pages/availability/availability.component').then(
            (m) => m.AvailabilityComponent,
          ),
      },

      // Fora da shell do dashboard de propósito: a chamada de vídeo precisa do
      // ecrã inteiro, sem o menu/sidebar a competir com o layout da sala.
      {
        path: Pages.APPOINTMENT_ROOM,
        loadComponent: () =>
          import('./pages/appointment-room/appointment-room.component').then(
            (m) => m.AppointmentRoomComponent,
          ),
      },

      // Sem canMatch por role de propósito: quem entra por convite pode ser
      // uma pessoa cliente — getVideoSession autoriza por sala, não por papel.
      {
        path: Pages.ROOM_JOIN,
        loadComponent: () =>
          import('./pages/room-join/room-join.component').then(
            (m) => m.RoomJoinComponent,
          ),
      },
    ],
  },

  {
    path: '**',
    redirectTo: '',
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      scrollPositionRestoration: 'enabled',
      anchorScrolling: 'disabled',
    }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
