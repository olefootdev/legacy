/**
 * Economia OLEFOOT — contrato de produto (EXP, BRO, leilões).
 * Compliance jurídico/contábil fica fora deste arquivo.
 */

/** Moeda do ledger genérico (backend). */
export type WalletCurrency = 'EXP' | 'BRO';

/** Leilão: uma moeda por anúncio — não misturar lances EXP e BRO no mesmo leilão (MVP). */
export type AuctionCurrency = 'EXP' | 'BRO';

export interface LedgerEntry {
  userId: string;
  currency: WalletCurrency;
  delta: number;
  reason: string;
  refId?: string;
  createdAt: string;
}

/**
 * Visão lógica do usuário (espelho de persistência / API).
 * No cliente local, `FinanceState` usa `ole` como exp_balance legado.
 */
export interface UserEconomySnapshot {
  expBalance: number;
  expLifetimeEarned: number;
  /** BRO em centavos (0,01 BRO) — saldo único na plataforma */
  broBalanceCents: number;
  broLifetimeInCents?: number;
  broLifetimeOutCents?: number;
}

/** Chave única do ranking mundial de EXP (produto). */
export function worldExpRankingKey(expBalance: number): number {
  return expBalance;
}

/** No cliente local, `exp_balance` do produto = campo persistido `ole`. */
export function expBalanceFromFinanceState(f: { ole: number }): number {
  return f.ole;
}

/** Ordenação sugerida para leaderboard: só saldo; desempate externo (ex.: updatedAt, userId). */
export function compareExpRanking(a: { expBalance: number }, b: { expBalance: number }): number {
  return b.expBalance - a.expBalance;
}

export const BRO_USD_PARITY_COPY =
  '1 BRO corresponde aproximadamente a 1 USD para comunicação e relatórios internos. Saques em moeda local, taxas e termos legais aplicam-se.';

export interface AuctionListingCore {
  id: string;
  auctionCurrency: AuctionCurrency;
  /** Título para UI — deve deixar explícito EXP ou BRO */
  title: string;
}
