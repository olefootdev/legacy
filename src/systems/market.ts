import type { FinanceState } from '@/entities/types';
import { addBroCents, addOle, grantEarnedExp } from './economy';

/** Pacote padrão: troca BRO por EXP (centavos de BRO). EXP do pacote não entra em expLifetimeEarned. */
export function buyOlePack(finance: FinanceState, broCentsPrice = 999, oleAmount = 500): FinanceState | null {
  if (finance.broCents < broCentsPrice) return null;
  let f = addBroCents(finance, -broCentsPrice);
  const out = (f.broLifetimeOutCents ?? 0) + broCentsPrice;
  f = { ...f, broLifetimeOutCents: out };
  f = addOle(f, oleAmount);
  return f;
}

export function sellScoutIntel(finance: FinanceState): FinanceState {
  return grantEarnedExp(finance, 25);
}
