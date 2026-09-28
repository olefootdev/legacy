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
 * 🔴 E o comprador recebe 95%, não 100%. A taxa de transferência de 5% do
 * Token-2022 morde na entrega. Este módulo devolve os DOIS números — bruto e
 * líquido — porque anunciar só o bruto e entregar o líquido é o tipo de
 * surpresa que destrói uma pré-venda.
 */
import { liquidoDe, taxaDe, TAXA_LANCAMENTO, type ConfigTaxa } from '../expansao/taxaDeTransferencia.js';

/** Casas decimais do mint. 1 OLEFOOT = 10^9 na menor unidade. */
export const DECIMAIS = 9;
export const UNIDADE = 10n ** BigInt(DECIMAIS);

/** Preço da pré-venda: $0,000125 por OLEFOOT. */
export const PRECO_USD_POR_TOKEN = '0.000125';

/**
 * Tokens (inteiros) por CENTAVO de dólar. Derivado do preço, não inventado:
 *   1 centavo = $0,01 ; $0,01 ÷ $0,000125 = 80 tokens
 */
export const TOKENS_POR_CENTAVO_USD = 80n;

/** Alocação total da pré-venda, em token inteiro. */
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
  /** OLEFOOT comprado, em token inteiro. */
  readonly tokensBrutos: bigint;
  /** O que SAI da tesouraria, na menor unidade. */
  readonly brutoNaMenorUnidade: bigint;
  /** O que CHEGA na wallet, na menor unidade (depois da taxa de 5%). */
  readonly liquidoNaMenorUnidade: bigint;
  /** A taxa retida, na menor unidade. */
  readonly taxaNaMenorUnidade: bigint;
  readonly cotacao: Cotacao;
  /** Preço efetivo por token ENTREGUE, em micro-centavos de dólar. */
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

  const tokensBrutos = (BigInt(usdCents) * TOKENS_POR_CENTAVO_USD);
  if (tokensBrutos > limites.restamTokens) {
    return { ok: false, motivo: 'alocacao_insuficiente', restamTokens: limites.restamTokens };
  }

  const brutoNaMenorUnidade = tokensBrutos * UNIDADE;
  const taxaNaMenorUnidade = taxaDe(brutoNaMenorUnidade, taxa);
  const liquidoNaMenorUnidade = liquidoDe(brutoNaMenorUnidade, taxa);
  const brlCents = porCima(BigInt(usdCents) * cotacao.brlPorUsdMicro, 1_000_000n);

  // Preço por token ENTREGUE, em micro-centavos: (usdCents × 1e6 × UNIDADE) / líquido
  const precoEfetivoMicroCents = liquidoNaMenorUnidade > 0n
    ? (BigInt(usdCents) * 1_000_000n * UNIDADE) / liquidoNaMenorUnidade
    : 0n;

  return {
    ok: true,
    orcamento: {
      usdCents, brlCents, tokensBrutos,
      brutoNaMenorUnidade, liquidoNaMenorUnidade, taxaNaMenorUnidade,
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
