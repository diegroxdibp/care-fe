import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Pages } from './shared/enums/pages.enum';
import { AccessGuard } from './auth/auth.guard';
import { AuthOnlyGuard } from './auth/authOnly.guard';
import { AvailabilityAccessGuard } from './auth/availability-access.guard';
import { pendingBookingGuard } from './core/pages/scheduling/confirm/pending-booking.guard';
import { HomeComponent } from './core/pages/home/home.component';

export const routes: Routes = [
  // HOME is eager (not loadComponent): it's the landing page almost every
  // visitor hits first, and lazy-loading it left a real gap where the
  // router-outlet was empty and the sticky footer collapsed up to fill the
  // short page, then jumped down once the chunk arrived.
  {
    path: Pages.HOME,
    component: HomeComponent,
  },

  // páginas usando HomeComponent
  {
    path: Pages.ATENDIMENTO,
    component: HomeComponent,
  },
  {
    path: Pages.ATENDIMENTO_INDIVIDUAL,
    component: HomeComponent,
  },
  {
    path: Pages.ATENDIMENTO_GRUPO,
    component: HomeComponent,
  },

  // páginas isoladas
  {
    path: Pages.ANALISE_REICHANA,
    loadComponent: () =>
      import(
        './shared/components/analise-corporal-reichana/analise-corporal-reichana.component'
        ).then((m) => m.AnaliseCorporalReichanaComponent),
  },

  {
    path: Pages.MINDFULLNESS,
    loadComponent: () =>
      import('./shared/components/mindfulness/mindfulness.component').then(
        (m) => m.MindfulnessComponent,
      ),
  },

  {
    path: Pages.SOMATIC_EXPERIENCE,
    loadComponent: () =>
      import(
        './shared/components/somatic-experience/somatic-experience.component'
        ).then((m) => m.SomaticExperienceComponent),
  },

  {
    path: Pages.SUPERVISION,
    loadComponent: () =>
      import('./shared/components/supervision/supervision.component').then(
        (m) => m.SupervisionComponent,
      ),
  },

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

  {
    path: Pages.BIO,
    loadComponent: () =>
      import('./shared/components/biography/biography.component').then(
        (m) => m.BiographyComponent,
      ),
  },

  {
    path: `${Pages.BIO}/:name`,
    loadComponent: () =>
      import('./shared/components/biography/biography.component').then(
        (m) => m.BiographyComponent,
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
