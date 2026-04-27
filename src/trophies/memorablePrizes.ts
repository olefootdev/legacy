import type { MemorableTrophyId } from '@/trophies/memorableCatalog';

/** Prémios ao desbloquear troféu memorável (liga / taça) — EXP + BRO na carteira de jogo. */
export function memorableTrophyFinanceReward(id: string): { exp: number; broCents: number } {
  switch (id as MemorableTrophyId | string) {
    case 'mem_liga_ole':
      return { exp: 3_500, broCents: 5_000 };
    case 'mem_copa_ole':
      return { exp: 2_200, broCents: 2_500 };
    case 'mem_supercopa_ole':
      return { exp: 1_500, broCents: 1_500 };
    default:
      return { exp: 0, broCents: 0 };
  }
}

export function diffNewMemorableTrophyIds(prev: readonly string[], next: readonly string[]): string[] {
  const was = new Set(prev);
  return next.filter((id) => !was.has(id));
}
