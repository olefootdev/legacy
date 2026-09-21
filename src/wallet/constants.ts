/**
 * Wallet Financial Hub — constantes tuníveis.
 * Todas as taxas, limites e configurações de produto num único lugar.
 */

// ---------------------------------------------------------------------------
// Referral
// ---------------------------------------------------------------------------

/** Comissão por nível (mesma taxa nos 3 níveis) */
export const REFERRAL_RATE = 0.05;

export const REFERRAL_MAX_LEVELS = 3;

/**
 * Tipos de ganho elegíveis para comissão de referral.
 * Yield, transferência, bônus e referral em si NÃO geram comissão (anti-pirâmide).
 */
export const REFERRAL_ELIGIBLE_SOURCES: readonly string[] = [
  'MATCH_REWARD',
  'PURCHASE',
] as const;

// ---------------------------------------------------------------------------
// OLE — preço interno (imutável)
// ---------------------------------------------------------------------------

/**
 * Preço de venda interno do token OLE em USD.
 * IMUTÁVEL — qualquer alteração requer decisão explícita do fundador.
 *
 * ÚNICA FONTE DE PREÇO DO TOKEN NO CÓDIGO (Onda 0, 2026-09-01).
 * Até esta data existia um segundo módulo, `economy/tokenEconomyConfig.ts`, que
 * lia `token_economy_config` do banco e dizia ser o canônico — com $0,00001,
 * dez vezes este valor. Ele não tinha um único consumidor: a página de Rede
 * chamava `getTokenPrice()` e jogava o resultado fora. Foi removido.
 *
 * A tabela e o RPC `get_token_price` continuam no banco, ociosos, com a linha
 * `current` ainda em 0,00001 — reconciliar quando o token real existir (Onda 3),
 * que é quando um preço formado por mercado passa a fazer sentido.
 */
/**
 * ════════════════════════════════════════════════════════════════════════════
 * OLEXP — o nome do saldo do jogo. FONTE ÚNICA.
 * ════════════════════════════════════════════════════════════════════════════
 * Decidido pelo fundador em 2026-09-21, antes de lançar o token na Solana:
 *
 *   OLEXP   = saldo DO JOGO, fictício, existe pra sempre, não é dinheiro
 *   OLEFOOT = o TOKEN na rede Solana (fora do jogo)
 *
 * Até aqui os dois se chamavam OLEFOOT, e a Carteira ainda chamava o saldo de
 * "Olefoot Token". Lançado o token com esse nome, todo extrato do jogo viraria
 * extrato de token — e o que é fictício passaria a parecer dinheiro.
 *
 * 🔴 REGRA: em texto que o manager lê, saldo do jogo é OLEXP. A palavra
 * OLEFOOT na tela só pode significar a MARCA (o jogo, a empresa) ou, depois do
 * lançamento, o token. Nunca um saldo.
 *
 * Os identificadores internos (`legacy_olefoot_credits`, `fetchMyOlefootBalance`)
 * seguem com o nome antigo de propósito: renomear tabela em produção é risco
 * sem ganho pro manager. O que o manager lê vem daqui.
 */
export const MOEDA_JOGO = 'OLEXP';

export const OLE_INTERNAL_PRICE_USD = 0.000001;

/** Formata o preço OLE para exibição: "$0.000001" */
export const OLE_INTERNAL_PRICE_DISPLAY = '$0.000001';

/** Converte quantidade OLE → USD equivalente */
export function oleToUsd(oleAmount: number): number {
  return oleAmount * OLE_INTERNAL_PRICE_USD;
}

/** Converte USD → quantidade OLE equivalente */
export function usdToOle(usdAmount: number): number {
  if (usdAmount <= 0) return 0;
  return usdAmount / OLE_INTERNAL_PRICE_USD;
}

// ---------------------------------------------------------------------------
// TradingView — mercado de referência
// ---------------------------------------------------------------------------

/** Cotação de referência exibida no topo da Wallet (mini overview TradingView). */
export const TRADINGVIEW_SYMBOL = 'BINANCE:BTCUSDT';
