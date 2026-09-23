/**
 * Livro do Vault — cotas por manager (A VIRADA · V1).
 *
 * A USDFY já escreveu a contabilidade por cota pensando nisto: "na Fase 1 há um
 * só depositante (a casa), mas o modelo já nasce por-cota pra a Fase 2 (cliente)
 * entrar sem refatorar" (`vault/src/nav.ts`). A OLEFOOT é a Fase 2. Este arquivo
 * é a mesma semântica — deposita, recebe cotas ao NAV; saca, queima ao NAV —
 * com duas diferenças que dinheiro de terceiro exige:
 *
 *   1. INTEIRO, NUNCA FLOAT. O motor da casa usa `number` porque tem um
 *      depositante só. Aqui são muitos, e `0.1 + 0.2` vira processo. Tudo é
 *      bigint na menor unidade do ativo (lamport pro SOL, 1e-6 pro USDT).
 *   2. ARREDONDA SEMPRE A FAVOR DA POOL. Quem entra recebe cotas para BAIXO;
 *      quem sai leva unidades para BAIXO. A poeira do arredondamento fica com
 *      quem ficou, nunca com quem mexeu. É a única direção que não permite
 *      sacar em looping pra raspar o livro.
 *
 * Puro: não lê banco, não escreve arquivo, não sabe quem é o dono. Persistência
 * e autorização ficam fora.
 */

/** Menor unidade do ativo. SOL → lamport (1e9). USDT na Solana → 1e6. */
export type Unidades = bigint;

/** Micro-cotas. 1 cota = 1e9 micro-cotas, pra fração sem float. */
export type Cotas = bigint;

export const MICRO_POR_COTA = 1_000_000_000n;

export interface Livro {
  /** Micro-cotas emitidas, somando todos os detentores. */
  readonly cotasEmitidas: Cotas;
  /** Patrimônio do vault marcado a mercado, na menor unidade. */
  readonly patrimonio: Unidades;
}

export const LIVRO_VAZIO: Livro = { cotasEmitidas: 0n, patrimonio: 0n };

function exigeNaoNegativo(nome: string, v: bigint): void {
  if (v < 0n) throw new RangeError(`${nome} não pode ser negativo: ${v}`);
}

/**
 * Livro vazio vale 1:1 — a primeira cota nasce ao par, como no selftest da casa
 * ("1º depósito: NAV = 1"). Livro com cota emitida e patrimônio zero está
 * quebrado: emitir cota ali diluiria a zero. Recusa.
 */
function exigeConsistente(l: Livro): void {
  if (l.cotasEmitidas > 0n && l.patrimonio <= 0n) {
    throw new RangeError('livro inconsistente: há cotas emitidas e patrimônio não-positivo');
  }
}

/**
 * Quantas micro-cotas `unidades` compra AGORA. Arredonda para baixo: o
 * depositante nunca recebe cota a mais às custas de quem já estava dentro.
 */
export function cotasPorAporte(livro: Livro, unidades: Unidades): Cotas {
  exigeNaoNegativo('unidades', unidades);
  exigeConsistente(livro);
  if (livro.cotasEmitidas === 0n) return unidades * MICRO_POR_COTA;
  return (unidades * livro.cotasEmitidas) / livro.patrimonio;
}

/**
 * Quanto `cotas` vale AGORA. Arredonda para baixo: quem sai nunca leva unidade
 * a mais às custas de quem fica.
 */
export function unidadesPorResgate(livro: Livro, cotas: Cotas): Unidades {
  exigeNaoNegativo('cotas', cotas);
  exigeConsistente(livro);
  if (livro.cotasEmitidas === 0n) return 0n;
  if (cotas > livro.cotasEmitidas) {
    throw new RangeError(`resgate de ${cotas} cotas acima das ${livro.cotasEmitidas} emitidas`);
  }
  return (cotas * livro.patrimonio) / livro.cotasEmitidas;
}

export interface Aporte {
  readonly livro: Livro;
  readonly cotasEmitidas: Cotas;
}

/** Deposita: emite cotas ao NAV corrente. Não dilui quem já está dentro. */
export function depositar(livro: Livro, unidades: Unidades): Aporte {
  const cotas = cotasPorAporte(livro, unidades);
  return {
    livro: {
      cotasEmitidas: livro.cotasEmitidas + cotas,
      patrimonio: livro.patrimonio + unidades,
    },
    cotasEmitidas: cotas,
  };
}

export interface Resgate {
  readonly livro: Livro;
  readonly unidadesPagas: Unidades;
}

/** Saca: queima cotas ao NAV corrente. A poeira do arredondamento fica na pool. */
export function resgatar(livro: Livro, cotas: Cotas): Resgate {
  const unidades = unidadesPorResgate(livro, cotas);
  return {
    livro: {
      cotasEmitidas: livro.cotasEmitidas - cotas,
      patrimonio: livro.patrimonio - unidades,
    },
    unidadesPagas: unidades,
  };
}

/**
 * Marca a mercado. Taxa colhida e perda de preço entram aqui: o patrimônio
 * muda, a quantidade de cotas não. É por isso que NAV sobe sem ninguém
 * receber nada — e é o que a tela do Vault promete.
 */
export function marcar(livro: Livro, patrimonio: Unidades): Livro {
  exigeNaoNegativo('patrimonio', patrimonio);
  return { cotasEmitidas: livro.cotasEmitidas, patrimonio };
}

/**
 * Colheita que NÃO sai do livro: entra como patrimônio e sobe o NAV de todo
 * mundo pro rata. É o destino da fatia sem dono no rateio (ver harvestSplit).
 */
export function reinvestir(livro: Livro, unidades: Unidades): Livro {
  exigeNaoNegativo('unidades', unidades);
  return { cotasEmitidas: livro.cotasEmitidas, patrimonio: livro.patrimonio + unidades };
}

/**
 * NAV em unidades por UMA cota inteira, só pra exibir. Não use pra contabilizar:
 * as conversões acima são exatas, esta perde a fração.
 */
export function navPorCota(livro: Livro): Unidades {
  if (livro.cotasEmitidas === 0n) return 0n;
  return (livro.patrimonio * MICRO_POR_COTA) / livro.cotasEmitidas;
}
