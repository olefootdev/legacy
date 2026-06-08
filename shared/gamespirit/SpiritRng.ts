/**
 * Pseudo-random number generator seedável usado pelo GameSpirit pra produzir
 * resultados REPRODUTÍVEIS — fundamento do Monte Carlo (Fase 1 do plano
 * MELHORIAS_INTELIGENCIA_PARTIDAS.md).
 *
 * Algoritmo: Mulberry32 — rápido, distribuição uniforme decente, period > 2^32.
 * Mais que suficiente pra ~1000 simulações de partida (cada uma usa ~100k rolls).
 *
 * Uso:
 *   const rng = new SpiritRng(42);           // seed determinística
 *   rng.next();                              // 0..1 (float)
 *   rng.range(0, 90);                        // 0..90 (float)
 *   rng.int(1, 10);                          // 1..10 (int)
 *
 * Para integração com SpiritContext, usar o helper `rngNext(ctx)` em
 * shared/gamespirit/rngNext.ts — quando ctx.rng for undefined, faz fallback
 * pra Math.random (preserva comportamento antigo em chamadores não-Monte-Carlo).
 */

export class SpiritRng {
  private state: number;

  constructor(seed: number) {
    // Normaliza pra uint32 evitando seed=0 (degenera).
    this.state = (seed >>> 0) || 0x9e3779b9;
  }

  /** Próximo float em [0, 1). Avança o estado. */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Float em [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Inteiro em [min, max] (inclusive). */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** Pega um elemento aleatório do array (sem mutação). */
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]!;
  }

  /** Snapshot do estado interno — útil pra debug e testes. */
  getState(): number {
    return this.state;
  }

  /** Cria um RNG filho que herda da seed atual (pra evitar correlação cruzada). */
  fork(): SpiritRng {
    return new SpiritRng(this.next() * 0xffffffff);
  }
}
