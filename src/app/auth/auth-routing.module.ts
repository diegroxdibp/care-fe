import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AuthComponent } from './auth.component';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { CallbackComponent } from './callback/callback.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { ConfirmEmailComponent } from './confirm-email/confirm-email.component';
import { ConfirmEmailChangeComponent } from './confirm-email-change/confirm-email-change.component';
import { GuestOnlyGuard } from './guest-only.guard';

const routes: Routes = [
  {
    path: '',
    component: AuthComponent,
    children: [
      { path: 'signin', canMatch: [GuestOnlyGuard], component: LoginComponent },
      {
        path: 'signup',
        canMatch: [GuestOnlyGuard],
        component: RegisterComponent,
      },
      {
        path: 'forgot-password',
        canMatch: [GuestOnlyGuard],
        component: ForgotPasswordComponent,
      },
      {
        path: 'reset-password',
        canMatch: [GuestOnlyGuard],
        component: ResetPasswordComponent,
      },
      {
        path: 'confirm-email',
        canMatch: [GuestOnlyGuard],
        component: ConfirmEmailComponent,
      },
      {
        // Sem GuestOnlyGuard: o link pode ser aberto com a sessão do email
        // antigo ainda aberta (a troca invalida-a e põe uma nova).
        path: 'confirm-email-change',
        component: ConfirmEmailChangeComponent,
      },
      { path: 'callback', component: CallbackComponent },
      { path: '', redirectTo: 'signin', pathMatch: 'full' },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AuthRoutingModule {}
