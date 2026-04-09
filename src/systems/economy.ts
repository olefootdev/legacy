import type { FinanceState } from '@/entities/types';
import { BRO_USD_PARITY_COPY } from '@/economy/model';

/** Taxa da plataforma em desafios amistosos liquidados em BRO (feeChallenger). */
export const FRIENDLY_CHALLENGE_BRO_FEE_RATE = 0.05;

export function friendlyChallengeBroFeeCents(prizeBroCents: number): number {
  return Math.round(prizeBroCents * FRIENDLY_CHALLENGE_BRO_FEE_RATE);
}

/** Altera só o saldo EXP (ranking); não incrementa lifetime. */
export function addOle(f: FinanceState, amount: number): FinanceState {
  return { ...f, ole: Math.max(0, Math.round(f.ole + amount)) };
}

/**
 * Ganho de EXP “de jogo” (partida, missão, relatório, etc.): sobe saldo e lifetime.
 * Não usar para compra BRO → EXP ou ajustes administrativos.
 */
export function grantEarnedExp(f: FinanceState, amount: number): FinanceState {
  const rounded = Math.round(amount);
  if (rounded <= 0) return addOle(f, rounded);
  const life = f.expLifetimeEarned ?? 0;
  const next = addOle(f, rounded);
  return { ...next, expLifetimeEarned: life + rounded };
}

export function addBroCents(f: FinanceState, cents: number): FinanceState {
  return { ...f, broCents: Math.max(0, f.broCents + cents) };
}

export function formatOle(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/** Preferir na UI nova copy de EXP em vez de OLE. */
export const formatExp = formatOle;

export function formatBroFromCents(cents: number): string {
  return formatBroDisplay(cents).primary;
}

/** Saldo BRO + referência USD (produto); não substitui assessoria fiscal. */
export function formatBroDisplay(cents: number): { primary: string; footnote: string } {
  const bro = cents / 100;
  const primary = `${bro.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BRO`;
  const usdRef = bro.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const footnote = `${BRO_USD_PARITY_COPY} Referência: ~${usdRef}.`;
  return { primary, footnote };
}
