/**
 * Acesso a uma sala de videochamada já dentro da janela permitida. O token só
 * vale entre `opensAt` e `closesAt` — pedir de novo fora da janela falha no
 * backend (ver ApiService.getVideoSession).
 */
export interface VideoSession {
  roomUrl: string;
  token: string;
  opensAt: string;
  closesAt: string;
  /**
   * Fim combinado. Numa marcação vem 5 min antes de `closesAt` (margem para
   * despedidas); numa sala avulsa é igual a `closesAt`. O aviso de fim conta
   * a partir daqui.
   */
  endsAt?: string;
  /** Só numa sala avulsa, para quem a criou ou admin — ver ApiService.extendRoom. */
  canExtend: boolean;
}
