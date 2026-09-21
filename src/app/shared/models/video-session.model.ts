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
}
