/**
 * Wallet Financial Hub — constantes tuníveis.
 * Todas as taxas, limites e configurações de produto num único lugar.
 */

// ---------------------------------------------------------------------------
// Referral
// ---------------------------------------------------------------------------

/** Comissão por nível (mesma taxa nos 3 níveis) */
import { idiomaAtual, type Idioma } from '@/i18n/idioma';

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
 * VERBA / VRB — o nome do saldo do jogo. FONTE ÚNICA.
 * ════════════════════════════════════════════════════════════════════════════
 * Decidido pelo fundador em 2026-09-28, abrindo espaço pro bônus de expansão:
 *
 *   VERBA (pt) / VRB (en)  = saldo DO JOGO: compra lenda, renova contrato
 *   OLEXP                  = unidade de EXPANSÃO da rede (Time 1 / Time 2)
 *   OLEFOOT                = o TOKEN na rede Solana
 *   BRO                    = crédito comprado no Pix
 *   Pontos                 = classificação na liga
 *
 * Cinco coisas, cinco palavras, nenhuma repetida. Chegar aqui custou duas
 * trocas: o saldo já se chamou OLEFOOT (e virou OLEXP em 21/09 pra não virar
 * extrato de token), e OLEXP agora passa pra expansão. PONTOS foi cogitado e
 * RECUSADO: a liga já usa a palavra em 13 telas — inclusive na tela da Rede,
 * vizinha desta —, e trocaria uma colisão por outra pior.
 *
 * "verba" é a palavra do futebol pra dinheiro de contratação, e estava livre:
 * zero ocorrências na UI e no banco. Fora do Brasil ninguém entende, então em
 * inglês é o ticker VRB — o roadmap é o produto inteiro rodar nos dois idiomas.
 *
 * 🔴 É FUNÇÃO, NÃO CONSTANTE, e de propósito: o nome depende do idioma, e uma
 * constante resolvida no load congelaria a escolha de quem troca de idioma no
 * meio da sessão.
 *
 * ⚠️ `affiliate_commissions.currency` tem `'OLEXP'` no CHECK do banco, hoje
 * significando ESTE saldo. É o sistema de comissão de NFT e a regra é não
 * encostar — então o código lá continua 'OLEXP' e quer dizer verba. Está
 * documentado aqui em vez de alterado.
 *
 * Os identificadores internos (`legacy_olefoot_credits`,
 * `fetchMyOlefootBalance`) seguem com o nome antigo: renomear tabela em
 * produção é risco sem ganho pro manager. O que o manager lê vem daqui.
 */
export const MOEDA_JOGO_VERBETE = { pt: 'VERBA', en: 'VRB' } as const;

export function moedaDoJogo(idioma?: Idioma): string {
  return MOEDA_JOGO_VERBETE[idioma ?? idiomaAtual()];
}

/**
 * ⚠️ SEM CONSUMIDOR desde 2026-09-21. Este preço só aparecia embaixo do saldo
 * na Carteira ("≈ $0.000001/OLEXP"), e o fundador mandou tirar: OLEXP é saldo
 * de jogo e não converte em nada — um valor em dólar ao lado dele, na véspera
 * do token na Solana, volta como cobrança. A constante fica porque o preço
 * ainda precisa ser reconciliado quando o token real existir (Onda 3), mas
 * hoje nada no app a lê. Antes de voltar a exibi-la, decidir o que ela diz.
 */
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
