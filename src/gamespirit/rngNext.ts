/**
 * Helper de migração progressiva pra Math.random → SpiritRng no motor live.
 *
 * Espelha shared/gamespirit/rngNext.ts. Mantém os dois arquivos pra evitar
 * import cross-tree até consolidarmos shared/ ⇄ src/ (tech debt declarada).
 *
 * Quando ctx.rng está presente (futuro Monte Carlo via motor live), todas as
 * decisões estocásticas consomem dele. Senão, cai pra Math.random — preserva
 * 100% do comportamento atual em prod.
 */

/** Devolve um número em [0, 1). Usa ctx.rng quando definido; senão Math.random. */
export function rngNext(ctx?: { rng?: { next: () => number } }): number {
  return ctx?.rng?.next?.() ?? Math.random();
}
