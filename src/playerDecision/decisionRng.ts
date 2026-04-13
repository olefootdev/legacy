import type { DecisionContext } from './types';

/** [0,1) alinhado à seed da partida quando o motor tático preenche `roll01`. */
export function pick01ForDecision(ctx: DecisionContext): number {
  return ctx.roll01 ? ctx.roll01() : Math.random();
}
