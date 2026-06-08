/**
 * Helper de migração progressiva pra Math.random → SpiritRng dentro do GameSpirit.
 *
 * Como funciona:
 *  - Recebe `ctx` ou `undefined`.
 *  - Se `ctx?.rng` está presente (Monte Carlo / testes), usa ele.
 *  - Senão, cai pra Math.random — preserva 100% do comportamento atual em
 *    chamadores normais (Quick/Live/Auto/Liga).
 *
 * Isto torna a refatoração das 25+ chamadas de `Math.random()` em GameSpirit.ts
 * SEGURA — uma de cada vez, sem regressão.
 */

import type { SpiritContext } from './types';

/** Devolve um número em [0, 1). Usa ctx.rng quando definido; senão Math.random. */
export function rngNext(ctx?: { rng?: { next: () => number } } | SpiritContext): number {
  return ctx?.rng?.next?.() ?? Math.random();
}

/** Devolve float em [min, max). */
export function rngRange(min: number, max: number, ctx?: { rng?: { next: () => number } }): number {
  return min + rngNext(ctx) * (max - min);
}

/** Devolve inteiro em [min, max] (inclusivo). */
export function rngInt(min: number, max: number, ctx?: { rng?: { next: () => number } }): number {
  return Math.floor(min + rngNext(ctx) * (max - min + 1));
}
