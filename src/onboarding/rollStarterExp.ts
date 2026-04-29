import type { SeededRng } from './seededRng';

/**
 * Roleta de EXP inicial do onboarding.
 *
 * Pesos balanceados pra premiar o manager (EV ≈ 825K, com cauda rara em 2.5M).
 * Confirmado em product review: removemos o tier 100K para não dar a sensação
 * de "ué, só isso?" no primeiro contato.
 */
export interface StarterExpTier {
  readonly amount: number;
  readonly weight: number;
  /** ID estável para UI/telemetria (não traduzir). */
  readonly id: string;
  /** Rótulo curto para reveal. */
  readonly label: string;
}

export const STARTER_EXP_TIERS: ReadonlyArray<StarterExpTier> = [
  { id: 'basic',     amount:   250_000, weight: 20, label: '250K' },
  { id: 'standard',  amount:   500_000, weight: 35, label: '500K' },
  { id: 'good',      amount: 1_000_000, weight: 25, label: '1M' },
  { id: 'great',     amount: 1_500_000, weight: 15, label: '1.5M' },
  { id: 'legendary', amount: 2_500_000, weight:  5, label: '2.5M' },
] as const;

export function rollStarterExp(rng: SeededRng): StarterExpTier {
  return rng.pickWeighted(
    STARTER_EXP_TIERS.map((t) => ({ weight: t.weight, value: t })),
  );
}

/** Soma dos pesos — exposta pra testes sanity-check. */
export function totalStarterExpWeight(): number {
  return STARTER_EXP_TIERS.reduce((acc, t) => acc + t.weight, 0);
}
