/**
 * Conversões entre a hora que a API guarda e a hora que se desenha.
 *
 * Viviam dentro de availability.component; passaram para aqui quando o cálculo
 * de vagas livres deixou de ser só do calendário da pessoa profissional (ver
 * free-slots.util) e o painel da pessoa cliente precisou das mesmas regras.
 */

export function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** "HH:mm:ss" → "HH:mm"; deixa "HH:mm" como está. */
export function stripSec(t: string): string {
  return t && t.length > 5 ? t.slice(0, 5) : t;
}

/*
 * A meia-noite tem duas escritas e cada lado precisa da sua.
 *
 * Do lado do ecrã o fim do dia é "24:00": mantém timeToMin monótono, e é o que
 * faz um bloco das 23:00 ter altura em vez de altura negativa. Na API é
 * "00:00", porque endTime desserializa para LocalTime e "24:00" não é um
 * LocalTime. A troca acontece só nestes dois pontos.
 */
const API_END_OF_DAY = '00:00';
const LOCAL_END_OF_DAY = '24:00';

export function toApiTime(t: string): string {
  return t === LOCAL_END_OF_DAY ? API_END_OF_DAY : t;
}

/** Só uma *hora de fim* a 00:00 é meia-noite; um início a 00:00 seria o topo do dia. */
export function fromApiEndTime(t: string): string {
  return stripSec(t) === API_END_OF_DAY ? LOCAL_END_OF_DAY : stripSec(t);
}
