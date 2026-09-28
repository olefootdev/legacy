/**
 * A trava dos tokens da pré-venda, e as duas portas de liberação.
 *
 * DECISÕES DO FUNDADOR (2026-09-28):
 *  - token comprado na pré-venda entra TRAVADO;
 *  - libera por TEMPO (o cronograma da tabela) ou comprando de novo;
 *  - liberação por compra vai até **85% da posição** — os 15% finais só saem
 *    por tempo, sempre;
 *  - a compra que destrava tem que ser **entrada nova (Pix/USDT)**, nunca um
 *    market buy na Raydium.
 *
 * 🔑 Por que a compra tem que ser entrada nova: eu modelei os dois e o efeito no
 * PREÇO é idêntico (−1,58% nos dois casos numa posição de $1.000) — o dinheiro
 * do market buy entra na pool e sai no mesmo movimento. A compra não protege o
 * gráfico. O que ela faz é **filtrar**: a maioria não paga pra destravar, então
 * a maioria fica travada. O valor está em reduzir o NÚMERO de liberações, não o
 * impacto de cada uma. E se for market buy, a empresa não recebe nada.
 *
 * 🐞 O FURO QUE A FÓRMULA POR RAZÃO DE DÓLAR TEM:
 * "comprou $1.000, compra $250, libera 25%" funciona no preço de lançamento.
 * Mas se o preço DOBRAR, $250 passa a comprar metade dos tokens e continuaria
 * liberando os mesmos 25% — o multiplicador vira 2 e **isso é arbitragem pura**:
 * paga $250 e solta $500 em token. Todo mundo faria no dia 1.
 *
 * A correção: a liberação é o MENOR entre a razão de dólar e a paridade em
 * TOKEN. No preço de lançamento os dois dão o mesmo número (é a proposta do
 * fundador, intacta); fora dele, o menor segura o abuso dos dois lados.
 */
import { UNIDADE } from './packs.js';

/** Teto da porta de compra. Decisão do fundador: 85%. */
export const TETO_LIBERACAO_POR_COMPRA_BPS = 8_500;

export interface Posicao {
  /** Quanto a pessoa pagou na pré-venda, em centavos de dólar. */
  readonly compraOriginalUsdCents: number;
  /** Tokens entregues pela pré-venda, na menor unidade. Entram travados. */
  readonly tokensTotais: bigint;
  /** Já liberado pela porta de COMPRA, na menor unidade. */
  readonly liberadoPorCompra: bigint;
  /** Já liberado pela porta de TEMPO, na menor unidade. */
  readonly liberadoPorTempo: bigint;
  /** Já sacado de fato. */
  readonly sacado: bigint;
}

function exigeCoerente(p: Posicao): void {
  if (p.compraOriginalUsdCents <= 0) throw new RangeError('compra original tem que ser positiva');
  if (p.tokensTotais < 0n || p.liberadoPorCompra < 0n || p.liberadoPorTempo < 0n || p.sacado < 0n) {
    throw new RangeError('posição com valor negativo');
  }
  if (p.liberadoPorCompra > p.tokensTotais || p.liberadoPorTempo > p.tokensTotais) {
    throw new RangeError('liberado maior que a posição');
  }
}

/** Teto absoluto da porta de compra, em token. */
export function tetoPorCompra(p: Posicao): bigint {
  return (p.tokensTotais * BigInt(TETO_LIBERACAO_POR_COMPRA_BPS)) / 10_000n;
}

/**
 * Quanto uma compra nova libera.
 *
 * `novaCompraUsdCents` — a entrada nova (Pix/USDT), em centavos de dólar.
 *
 * `tokensEquivalentes` — quantos tokens esse dinheiro VALE no preço de
 *   referência atual, na menor unidade. É a paridade que fecha a arbitragem.
 *
 * ⚠️ E é por isso que o parâmetro é "equivalentes" e não "entregues": a compra
 * que destrava **não precisa ser de token**. Comprar card, lenda ou pack no jogo
 * também é entrada nova de dinheiro, e contar essas compras faz a trava
 * empurrar receita de PRODUTO, não só de token. Nesse caso `tokensEquivalentes`
 * é quanto aquele dinheiro compraria de token no preço atual — a mesma régua,
 * então nem a compra de token nem a de produto abre brecha de arbitragem.
 */
export function liberarPorCompra(
  p: Posicao,
  novaCompraUsdCents: number,
  tokensEquivalentes: bigint,
): { readonly libera: bigint; readonly limitadoPor: 'razao_usd' | 'paridade_token' | 'teto_85' | 'posicao' } {
  exigeCoerente(p);
  if (!Number.isInteger(novaCompraUsdCents) || novaCompraUsdCents <= 0) {
    throw new RangeError(`compra nova inválida: ${novaCompraUsdCents}`);
  }
  if (tokensEquivalentes < 0n) throw new RangeError('tokens equivalentes negativos');

  // Porta 1 — a proposta do fundador: fração de dólar sobre a posição.
  const porRazaoUsd = (p.tokensTotais * BigInt(novaCompraUsdCents)) / BigInt(p.compraOriginalUsdCents);
  // Porta 2 — paridade em token (m = 1). Fecha a arbitragem se o preço subir.
  const porParidade = tokensEquivalentes;

  let libera = porRazaoUsd;
  let limitadoPor: 'razao_usd' | 'paridade_token' | 'teto_85' | 'posicao' = 'razao_usd';
  if (porParidade < libera) { libera = porParidade; limitadoPor = 'paridade_token'; }

  // Teto de 85% acumulado nesta porta.
  const cabeNoTeto = tetoPorCompra(p) - p.liberadoPorCompra;
  const restante = cabeNoTeto > 0n ? cabeNoTeto : 0n;
  if (restante < libera) { libera = restante; limitadoPor = 'teto_85'; }

  // E nunca passa do que resta da posição somando as duas portas.
  const cabeNaPosicao = p.tokensTotais - p.liberadoPorCompra - p.liberadoPorTempo;
  const sobra = cabeNaPosicao > 0n ? cabeNaPosicao : 0n;
  if (sobra < libera) { libera = sobra; limitadoPor = 'posicao'; }

  return { libera, limitadoPor };
}

// ------------------------------------------------------------- por tempo ----

/**
 * Cronograma de tempo da pré-venda: 10% no lançamento, 1 mês de carência,
 * depois linear por 12 meses. É o da tabela em `docs/TOKENOMICS.md`.
 */
export const NO_LANCAMENTO_BPS = 1_000;
export const CARENCIA_DIAS = 30;
export const LINEAR_DIAS = 360;

/** Fração liberada por tempo, em bps, `dias` após o lançamento. */
export function fracaoPorTempoBps(dias: number): number {
  if (!Number.isFinite(dias) || dias < 0) throw new RangeError(`dias inválido: ${dias}`);
  if (dias < CARENCIA_DIAS) return NO_LANCAMENTO_BPS;
  const apos = Math.min(dias - CARENCIA_DIAS, LINEAR_DIAS);
  const resto = 10_000 - NO_LANCAMENTO_BPS;
  return NO_LANCAMENTO_BPS + Math.floor((resto * apos) / LINEAR_DIAS);
}

export function liberadoPorTempoEm(p: Posicao, dias: number): bigint {
  exigeCoerente(p);
  return (p.tokensTotais * BigInt(fracaoPorTempoBps(dias))) / 10_000n;
}

// ------------------------------------------------------------- disponível ---

/**
 * O que a pessoa pode sacar agora.
 *
 * As duas portas SOMAM, com teto na posição — é isso que faz os 15% finais
 * dependerem do tempo mesmo para quem esgotou a porta de compra.
 */
export function disponivel(p: Posicao, dias: number): bigint {
  exigeCoerente(p);
  const porTempo = liberadoPorTempoEm(p, dias);
  const total = p.liberadoPorCompra + porTempo;
  const liberado = total > p.tokensTotais ? p.tokensTotais : total;
  const resta = liberado - p.sacado;
  return resta > 0n ? resta : 0n;
}

/** Em quantos dias a posição fica 100% líquida, dado o já liberado por compra. */
export function diasPara100(p: Posicao): number {
  exigeCoerente(p);
  if (p.liberadoPorCompra >= p.tokensTotais) return 0;
  const faltaBps = Number(((p.tokensTotais - p.liberadoPorCompra) * 10_000n) / p.tokensTotais);
  for (let d = 0; d <= CARENCIA_DIAS + LINEAR_DIAS; d++) {
    if (fracaoPorTempoBps(d) >= faltaBps) return d;
  }
  return CARENCIA_DIAS + LINEAR_DIAS;
}

/** Tokens inteiros, pra exibir. */
export const emTokens = (v: bigint): bigint => v / UNIDADE;
