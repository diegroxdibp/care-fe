/** Estado da troca de email no perfil (GET/POST/DELETE /api/user/email-change). */
export interface EmailChangeStatus {
  /** O email novo à espera de confirmação pelo link, ou null. */
  pendingEmail: string | null;
  pendingExpiresAt: string | null;
  /** Conta criada com o Google: o email é o do Google e não se troca aqui. */
  googleAccount: boolean;
  /** Sem senha não há como reconfirmar quem pede a troca. */
  hasPassword: boolean;
}
