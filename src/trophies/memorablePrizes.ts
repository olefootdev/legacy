import type { MemorableTrophyId } from '@/trophies/memorableCatalog';

/**
 * Prêmio ao desbloquear troféu memorável (liga / taça).
 *
 * 2026-08-01: o prêmio em BRO foi zerado. Título passa a valer EXP — moeda de
 * jogo — e não dinheiro de valor real. `broCents` continua no retorno porque o
 * reducer e o `processLeagueSchedule` leem o campo; devolver 0 mantém os dois
 * caminhos intactos sem creditar nada.
 */
export function memorableTrophyFinanceReward(id: string): { exp: number; broCents: number } {
  switch (id as MemorableTrophyId | string) {
    case 'mem_liga_ole':
      return { exp: 3_500, broCents: 0 };
    case 'mem_copa_ole':
      return { exp: 2_200, broCents: 0 };
    case 'mem_supercopa_ole':
      return { exp: 1_500, broCents: 0 };
    default:
      return { exp: 0, broCents: 0 };
  }
}

export function diffNewMemorableTrophyIds(prev: readonly string[], next: readonly string[]): string[] {
  const was = new Set(prev);
  return next.filter((id) => !was.has(id));
}
