/**
 * "Quinta-feira, 22/10/2026 · 18:00" — um instante (ISO) no fuso dado.
 * Para pedidos e convites que chegam de outra pessoa: o instante vem do
 * backend, e mostra-se no fuso do perfil de quem vê, nunca no do computador.
 */
export function formatInZone(iso: string, timeZone: string): string {
  const instant = new Date(iso);
  const weekday = new Intl.DateTimeFormat('pt-BR', { timeZone, weekday: 'long' }).format(instant);
  const date = new Intl.DateTimeFormat('pt-BR', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(instant);
  const time = new Intl.DateTimeFormat('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .format(instant);
  return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${date} · ${time}`;
}
