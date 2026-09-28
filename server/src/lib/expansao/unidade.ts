/**
 * OLEXP — a unidade de expansão da rede (BÔNUS DE EQUIPARAÇÃO · v1).
 *
 * ⚠️ OLEXP NÃO É MOEDA. Não tem cotação, não tem preço, não se compra e não se
 * vende. É contador de expansão: serve pra graduar, medir perna e apurar
 * equiparação. Quem tem preço é o OLEFOOT, na Solana. O saldo do jogo é VERBA.
 *
 * 🔴 NUNCA escreva, em código, comentário ou tela, que "1 OLEXP vale X".
 * O valor só existe DEPOIS de um ciclo com pool real, e muda a cada ciclo:
 *   valor de liquidação do ciclo = pool do ciclo ÷ OLEXP equiparado no ciclo
 * Uma constante de preço aqui viraria promessa de rendimento, que é
 * exatamente o que o desenho de pool existe pra não ser.
 *
 * Inteiro, sempre. Mesma disciplina do livro do Vault: `bigint`, nunca float —
 * `0.1 + 0.2` numa contabilidade de rede vira divergência que ninguém acha.
 */

/** OLEXP em unidades inteiras. 1 OLEFOOT comprada = 1 OLEXP (regra inicial). */
export type Olexp = bigint;

/** Lado da árvore binária. Os nomes que o manager lê são Time 1 e Time 2. */
export type Lado = 1 | 2;
export const LADOS: readonly Lado[] = [1, 2];

/**
 * DOIS TIPOS DE OLEXP, e a separação é do desenho, não detalhe.
 *
 * `qualificacao` conta pra graduação e volume de perna — é o que faz a pessoa
 * virar TETRA. `equiparacao` é o que pode virar dinheiro.
 *
 * Toda fonte gera qualificação; só as fontes que o administrador marcar geram
 * equiparação. É isso que permite dar OLEXP por missão, evento ou item do jogo
 * sem criar obrigação financeira — e é o que impede que "OLEXP de campanha"
 * vire saque.
 */
export interface Elegibilidade {
  readonly qualificacao: boolean;
  readonly equiparacao: boolean;
}

/** De onde o OLEXP veio. Tudo que credita tem que declarar origem. */
export type FonteOlexp =
  | 'compra_olefoot'   // entrada nova pelo nosso canal (Pix/USDT) — gera equiparação
  | 'compra_dex'       // 🔴 comprou na Raydium: NÃO gera comissão nenhuma
  | 'nft'
  | 'marketplace'
  | 'produto_jogo'
  | 'assinatura'
  | 'evento'
  | 'campanha'
  | 'ajuste_admin';

/**
 * A régua de v1. Só compra de OLEFOOT pelo NOSSO canal vira dinheiro; o resto,
 * quando existir, entra como qualificação até o administrador decidir o
 * contrário.
 *
 * 🔴 `compra_dex` NÃO gera NEM qualificação NEM equiparação, e é a única fonte
 * assim. Decisão do fundador (2026-09-28): depois do lançamento da liquidez,
 * quem compra direto na Raydium não contabiliza comissão. A razão é econômica,
 * não arbitrária — comissão sai de RECEITA, e market buy não gera receita
 * nenhuma pra empresa: o dinheiro entra na pool e sai pra quem vendeu. Pagar
 * comissão sobre isso seria pagar com dinheiro que nunca entrou.
 *
 * ⚠️ `ajuste_admin` NUNCA gera equiparação, e isso não é configurável aqui de
 * propósito: crédito manual que vira saque é o caminho mais curto entre uma
 * conta de admin comprometida e o caixa.
 */
export const ELEGIBILIDADE_PADRAO: Readonly<Record<FonteOlexp, Elegibilidade>> = {
  compra_olefoot: { qualificacao: true, equiparacao: true },
  compra_dex:     { qualificacao: false, equiparacao: false },
  nft:            { qualificacao: true, equiparacao: false },
  marketplace:    { qualificacao: true, equiparacao: false },
  produto_jogo:   { qualificacao: true, equiparacao: false },
  assinatura:     { qualificacao: true, equiparacao: false },
  evento:         { qualificacao: true, equiparacao: false },
  campanha:       { qualificacao: true, equiparacao: false },
  ajuste_admin:   { qualificacao: true, equiparacao: false },
};

export function podeEquiparar(fonte: FonteOlexp, regra = ELEGIBILIDADE_PADRAO): boolean {
  if (fonte === 'ajuste_admin') return false; // trava dura, acima da configuração
  if (fonte === 'compra_dex') return false;   // trava dura: market buy não gera receita
  return regra[fonte].equiparacao;
}

/** Compra na DEX não conta nem pra graduar. Trava dura, acima da configuração. */
export function podeQualificar(fonte: FonteOlexp, regra = ELEGIBILIDADE_PADRAO): boolean {
  if (fonte === 'compra_dex') return false;
  return regra[fonte].qualificacao;
}

/**
 * Compra de OLEFOOT → OLEXP. Hoje 1:1, mas passa por aqui pra a regra ter um
 * lugar só quando mudar.
 */
export const OLEXP_POR_OLEFOOT = 1n;

export function olexpDaCompra(olefoot: bigint): Olexp {
  if (olefoot < 0n) throw new RangeError(`compra negativa: ${olefoot}`);
  return olefoot * OLEXP_POR_OLEFOOT;
}

export function exigePositivo(nome: string, v: bigint): void {
  if (v <= 0n) throw new RangeError(`${nome} tem que ser positivo, veio ${v}`);
}
