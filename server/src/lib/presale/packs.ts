/**
 * Os PACKS da pré-venda do OLEFOOT.
 *
 * $10 · $50 · $250 · $500 · $1.250 · Outro (digitado). O valor entra em USD, sai
 * em OLEFOOT, e vira reais pra cobrança no Pix do Mercado Pago.
 *
 * 🔴 PREÇO É SEMPRE DO SERVIDOR. `payments.ts` diz isso no comentário e o
 * projeto já pagou por aprender: "preço PIX client-side" foi um dos furos de
 * dinheiro fechados no card. O catálogo aqui é a fonte; o cliente manda só QUAL
 * pack, nunca quanto custa.
 *
 * ✨ Uma propriedade bonita do preço escolhido: a $0,000125 por OLEFOOT, cada
 * CENTAVO de dólar compra exatamente **80 tokens**. Nenhum pack em centavo
 * inteiro tem arredondamento — a conversão é exata, não aproximada. Se algum dia
 * o preço mudar e essa divisão deixar de fechar, o self-test acusa.
 *
 * 🔴 A TAXA DE 5% É COBERTA PELA CASA (opção 2, decidida em 2026-09-28).
 *
 * O Token-2022 retém 5% em toda transferência e **não existe isenção por
 * endereço** — nem whitelist, nem exceção pra tesouraria (transfer hook seria o
 * único jeito, e a Raydium não suporta). Então alguém tem que absorver.
 *
 * A decisão: **o número anunciado é o número ENTREGUE**. Quem compra $10 vê
 * 80.000 e recebe 80.000. A tesouraria debita 84.211 e a diferença sai do balde
 * de Liquidez. O preço anunciado passa a ser o preço verdadeiro.
 *
 * Custa 13.157.895 tokens na pré-venda inteira (0,263% do supply, 2,3% do balde
 * de Liquidez) e compra: número redondo na tela, preço honesto, e nenhuma
 * explicação de rodapé sobre por que faltaram 4.000 tokens. Numa pré-venda a
 * pergunta "por que recebi menos do que dizia?" custa mais que isso.
 *
 * ⚠️ O founder recebe a taxa nas duas opções — na 2 recebe até um pouco mais
 * (13.157.895 contra 12.500.000). A escolha foi só de quem cobre o buraco.
 */
import { brutoParaEntregar, taxaDe, TAXA_LANCAMENTO, type ConfigTaxa } from '../expansao/taxaDeTransferencia.js';

/** Casas decimais do mint. 1 OLEFOOT = 10^9 na menor unidade. */
export const DECIMAIS = 9;
export const UNIDADE = 10n ** BigInt(DECIMAIS);

/** Preço da pré-venda: $0,000125 por OLEFOOT. */
export const PRECO_USD_POR_TOKEN = '0.000125';

/**
 * Tokens ENTREGUES por CENTAVO de dólar. Derivado do preço, não inventado:
 *   1 centavo = $0,01 ; $0,01 ÷ $0,000125 = 80 tokens
 *
 * 🔑 Entregues, não vendidos: com a opção 2 este é o número que a pessoa VÊ e o
 * número que CHEGA. O bruto que a tesouraria debita é maior e sai daqui por
 * `brutoParaEntregar`.
 */
export const TOKENS_POR_CENTAVO_USD = 80n;

/** Alocação da pré-venda, em token inteiro ENTREGUE. */
export const ALOCACAO_PRESALE = 250_000_000n;

/** Os packs oferecidos, em centavos de dólar. */
export const PACKS_USD_CENTS = [1_000, 5_000, 25_000, 50_000, 125_000] as const;
export type PackUsdCents = (typeof PACKS_USD_CENTS)[number];

/** Piso do valor digitado em "Outro". Abaixo disso o Pix não se paga. */
export const MINIMO_USD_CENTS = 1_000; // $10

export interface Cotacao {
  /** Reais por dólar, em micro (1e6). 5,42 → 5_420_000. */
  readonly brlPorUsdMicro: bigint;
  /** Quando a cotação foi lida (ISO). Entra no orçamento pra ter validade. */
  readonly lidaEm: string;
}

export interface Orcamento {
  readonly usdCents: number;
  readonly brlCents: bigint;
  /** 🔑 OLEFOOT que a pessoa RECEBE, em token inteiro. É o número anunciado. */
  readonly tokensEntregues: bigint;
  /** O mesmo, na menor unidade. */
  readonly liquidoNaMenorUnidade: bigint;
  /** O que SAI da tesouraria, na menor unidade — maior, por causa da taxa. */
  readonly brutoNaMenorUnidade: bigint;
  /** A taxa retida pelo Token-2022, coberta pela casa (balde de Liquidez). */
  readonly taxaNaMenorUnidade: bigint;
  readonly cotacao: Cotacao;
  /**
   * Preço por token entregue, em micro-centavos de dólar.
   * Com a opção 2 tem que dar exatamente 12.500 = $0,000125 — o anunciado.
   */
  readonly precoEfetivoMicroCents: bigint;
}

export type Recusa =
  | { readonly ok: false; readonly motivo: 'abaixo_do_minimo'; readonly minimoUsdCents: number }
  | { readonly ok: false; readonly motivo: 'nao_inteiro' }
  | { readonly ok: false; readonly motivo: 'acima_do_teto_por_conta'; readonly tetoUsdCents: number }
  | { readonly ok: false; readonly motivo: 'alocacao_insuficiente'; readonly restamTokens: bigint }
  | { readonly ok: false; readonly motivo: 'cotacao_invalida' };

export interface Limites {
  /** Teto por conta, em centavos de dólar. null = sem teto. */
  readonly tetoPorContaUsdCents: number | null;
  /** Quanto a conta já comprou, em centavos de dólar. */
  readonly jaCompradoUsdCents: number;
  /** Tokens ainda disponíveis na alocação da pré-venda, em token inteiro. */
  readonly restamTokens: bigint;
}

/** Divisão inteira arredondando pra CIMA. Usada só no valor a COBRAR. */
function porCima(n: bigint, d: bigint): bigint {
  return (n + d - 1n) / d;
}

/**
 * Monta o orçamento de uma compra.
 *
 * Arredondamento, e a direção de cada um é decisão, não acidente:
 *  - TOKENS: pra baixo. Em centavo inteiro não sobra fração (80/centavo), então
 *    isso só morde se o preço mudar — e aí é melhor entregar de menos que
 *    prometer token que a alocação não tem.
 *  - REAIS: pra cima, no centavo. A casa nunca cobra menos que o dólar valia;
 *    o erro máximo é R$0,01 e fica com a casa, não com o Mercado Pago.
 */
export function orcar(
  usdCents: number,
  cotacao: Cotacao,
  limites: Limites,
  taxa: ConfigTaxa = TAXA_LANCAMENTO,
): { readonly ok: true; readonly orcamento: Orcamento } | Recusa {
  if (!Number.isInteger(usdCents)) return { ok: false, motivo: 'nao_inteiro' };
  if (usdCents < MINIMO_USD_CENTS) {
    return { ok: false, motivo: 'abaixo_do_minimo', minimoUsdCents: MINIMO_USD_CENTS };
  }
  if (cotacao.brlPorUsdMicro <= 0n) return { ok: false, motivo: 'cotacao_invalida' };

  const teto = limites.tetoPorContaUsdCents;
  if (teto !== null && limites.jaCompradoUsdCents + usdCents > teto) {
    return { ok: false, motivo: 'acima_do_teto_por_conta', tetoUsdCents: teto };
  }

  // A alocação é medida no que é ENTREGUE — é isso que a pessoa recebe e é
  // isso que os 250M da tabela significam. O bruto a mais sai de Liquidez.
  const tokensEntregues = BigInt(usdCents) * TOKENS_POR_CENTAVO_USD;
  if (tokensEntregues > limites.restamTokens) {
    return { ok: false, motivo: 'alocacao_insuficiente', restamTokens: limites.restamTokens };
  }

  const liquidoNaMenorUnidade = tokensEntregues * UNIDADE;
  const brutoNaMenorUnidade = brutoParaEntregar(liquidoNaMenorUnidade, taxa);
  const taxaNaMenorUnidade = taxaDe(brutoNaMenorUnidade, taxa);
  const brlCents = porCima(BigInt(usdCents) * cotacao.brlPorUsdMicro, 1_000_000n);

  const precoEfetivoMicroCents = liquidoNaMenorUnidade > 0n
    ? (BigInt(usdCents) * 1_000_000n * UNIDADE) / liquidoNaMenorUnidade
    : 0n;

  return {
    ok: true,
    orcamento: {
      usdCents, brlCents, tokensEntregues,
      liquidoNaMenorUnidade, brutoNaMenorUnidade, taxaNaMenorUnidade,
      cotacao, precoEfetivoMicroCents,
    },
  };
}

/**
 * Caminho inverso pro "Outro": a pessoa digita em REAIS.
 *
 * No Brasil quem digita pensa em real, não em dólar. Converte pra centavo de
 * dólar arredondando pra BAIXO — se sobrar fração de centavo de dólar ela fica
 * de fora, nunca cobrada a mais do que a pessoa digitou.
 */
export function usdCentsDeBrlCents(brlCents: bigint, cotacao: Cotacao): number {
  if (brlCents < 0n) throw new RangeError(`reais negativos: ${brlCents}`);
  if (cotacao.brlPorUsdMicro <= 0n) throw new RangeError('cotação inválida');
  return Number((brlCents * 1_000_000n) / cotacao.brlPorUsdMicro);
}

/** Quanto vale a alocação inteira, em dólares. Serve pra meta da pré-venda. */
export function metaDaPresaleUsdCents(): number {
  return Number(ALOCACAO_PRESALE / TOKENS_POR_CENTAVO_USD);
}

/**
 * O que a pré-venda inteira custa à tesouraria, entregando os 250M líquidos.
 * A diferença contra a alocação é a taxa que o balde de Liquidez cobre.
 */
export function custoBrutoDaPresale(taxa: ConfigTaxa = TAXA_LANCAMENTO): {
  readonly entregue: bigint;
  readonly bruto: bigint;
  readonly cobertoPelaCasa: bigint;
} {
  const entregue = ALOCACAO_PRESALE * UNIDADE;
  const bruto = brutoParaEntregar(entregue, taxa);
  return { entregue, bruto, cobertoPelaCasa: bruto - entregue };
}
