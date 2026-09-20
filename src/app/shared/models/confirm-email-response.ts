export interface ConfirmEmailResponse {
  message: string;
  /** Validated /scheduling path stored at registration, if any — see AccessGuard. */
  next: string | null;
}
