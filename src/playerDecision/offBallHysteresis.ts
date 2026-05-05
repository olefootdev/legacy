import { nearestOpponentPressure01 } from '@/simulation/InteractionResolver';
import { FIELD_LENGTH } from '@/simulation/field';
import type { DecisionContext } from './types';

/**
 * Faster replan in the attacking/defensive third where reactions matter most.
 * Longer replan in midfield when pressure is low to avoid robotic jitter.
 *
 * AJUSTE: intervalos aumentados para reduzir movimento por conta — o agente
 * guarda a posição e só age quando necessário.
 */
export function offBallReplanIntervalSec(ctx: DecisionContext): number {
  if (ctx.carrierJustChanged) return 0.2;

  const inFinalThird = isInFinalThird(ctx);
  const phase = ctx.collective?.phase;

  // Transitions require immediate collective response
  if (phase === 'transition_defense' || phase === 'transition_attack') return 0.24;

  let minD = Infinity;
  for (const o of ctx.opponents) {
    const d = Math.hypot(o.x - ctx.self.x, o.z - ctx.self.z);
    if (d < minD) minD = d;
  }
  if (minD < 6.5) return inFinalThird ? 0.18 : 0.28;

  if (inFinalThird) return 0.32;

  // Defensive block: replan a bit faster to maintain shape
  if (phase === 'defensive_block') return 0.42;

  const press01 = nearestOpponentPressure01(ctx.self, ctx.opponents);
  if (press01 > 0.52) return 0.38;
  if (press01 > 0.32) return 0.58;
  if (press01 > 0.18) return 0.78;
  return 1.2;
}

function isInFinalThird(ctx: DecisionContext): boolean {
  const depth = ctx.attackDir === 1
    ? ctx.self.x
    : FIELD_LENGTH - ctx.self.x;
  return depth > FIELD_LENGTH * 0.66 || depth < FIELD_LENGTH * 0.33;
}
