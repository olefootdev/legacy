/**
 * O teto diário de CLAIM, derivado da profundidade da pool.
 *
 * Por que isto existe (medido em 2026-09-28, `docs/TOKENOMICS.md`):
 *
 * A tranche de bônus da pré-venda é maior do que a pool aguenta absorver. Numa
 * pool de 80M OLEFOOT, despejar a tranche de uma vez derruba ~50% do preço. Só
 * que o bônus acumula em OLEXP, que é contador e tem ZERO impacto de mercado —
 * quem toca o mercado é o CLAIM. Então a trava certa não é no bônus, é aqui.
 *
 * A régua: o claim de um dia não pode mover o preço mais que `impactoMaxBps`.
 *
 * Num AMM de produto constante (x·y=k), vender `v` contra reserva `R` leva o
 * preço a (R/(R+v))². Igualando a (1 − teto) e isolando v:
 *
 *   v = R · (1 − √(1−teto)) / √(1−teto)
 *
 * 🔴 Sem float. Dinheiro em float arrasta erro e aqui o erro decide quanto sai
 * da tesouraria.
 *
 * 🐞 E a direção do arredondamento não é óbvia — o primeiro teste pegou isso.
 * Como `s` aparece no DENOMINADOR de (E−s)/s, truncar a raiz pra baixo faz o
 * teto sair MAIOR que o exato: o numerador cresce e o denominador encolhe ao
 * mesmo tempo. O teto de 100bps liberava um volume de 101bps de impacto. Por
 * isso a raiz aqui é por CIMA (`raizInteiraTeto`) e só a divisão final trunca
 * pra baixo. Errar a favor da pool é a única direção aceitável, e "a favor"
 * aqui era o contrário do que a intuição dizia.
 */

/** Escala fixa da aritmética da raiz. 1e12 dá 12 casas — folga de sobra. */
const ESCALA = 1_000_000_000_000n;

/** floor(√n) por Newton. Exato para todo n ≥ 0. */
export function raizInteira(n: bigint): bigint {
  if (n < 0n) throw new RangeError(`raiz de negativo: ${n}`);
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

/** ceil(√n). É esta que o teto usa — ver a nota de arredondamento no topo. */
export function raizInteiraTeto(n: bigint): bigint {
  const r = raizInteira(n);
  return r * r === n ? r : r + 1n;
}

/** Teto recomendado: 1% de impacto máximo por dia (decisão de 2026-09-28). */
export const IMPACTO_MAX_BPS_PADRAO = 100;

/**
 * Quanto OLEFOOT pode sair em claims num dia, dada a reserva de token da pool.
 *
 * `reservaPool` = OLEFOOT no lado token da pool, na menor unidade (lamports do
 * token). Reserva desconhecida ou zero devolve 0 — e zero aqui significa
 * "não libera nada", que é o estado seguro por padrão.
 */
export function tetoDiarioDeClaim(reservaPool: bigint, impactoMaxBps: number = IMPACTO_MAX_BPS_PADRAO): bigint {
  if (reservaPool < 0n) throw new RangeError(`reserva negativa: ${reservaPool}`);
  if (!Number.isInteger(impactoMaxBps) || impactoMaxBps < 1 || impactoMaxBps >= 10_000) {
    throw new RangeError(`impacto fora de 1–9999 bps: ${impactoMaxBps}`);
  }
  if (reservaPool === 0n) return 0n;

  // √(1−teto) na escala: √((10000−bps)/10000) · ESCALA
  const restante = BigInt(10_000 - impactoMaxBps);
  const s = raizInteiraTeto((restante * ESCALA * ESCALA) / 10_000n);
  if (s === 0n) return 0n;

  return (reservaPool * (ESCALA - s)) / s;
}

/**
 * O impacto que uma venda de `v` causaria, em bps, na mesma reserva.
 * Serve pro relatório da auditoria dizer o tamanho do estrago, não só que passou.
 */
export function impactoEmBps(reservaPool: bigint, venda: bigint): number {
  if (reservaPool <= 0n) return 10_000;
  if (venda <= 0n) return 0;
  const razao = (reservaPool * ESCALA) / (reservaPool + venda);
  const restanteBps = (razao * razao * 10_000n) / (ESCALA * ESCALA);
  return 10_000 - Number(restanteBps);
}

export interface EstadoDoTeto {
  readonly reservaPool: bigint;
  readonly impactoMaxBps: number;
  readonly jaPagoHoje: bigint;
}

/** Quanto ainda cabe hoje. Nunca negativo. */
export function restanteHoje(e: EstadoDoTeto): bigint {
  const teto = tetoDiarioDeClaim(e.reservaPool, e.impactoMaxBps);
  if (e.jaPagoHoje < 0n) throw new RangeError(`já pago negativo: ${e.jaPagoHoje}`);
  const resta = teto - e.jaPagoHoje;
  return resta > 0n ? resta : 0n;
}
