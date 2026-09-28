/**
 * A taxa de transferência do OLEFOOT (Token-2022 `TransferFee`).
 *
 * DECISÃO DO FUNDADOR (2026-09-28): **5% desde o momento zero**, para a wallet
 * dos founders. Eu levantei o custo duas vezes (`docs/TOKENOMICS.md` §6) e ele
 * reafirmou. Decisão dele; aqui o trabalho é fazer funcionar sem erro.
 *
 * 🔴 POR QUE ISTO NÃO É HIGIENE CONTÁBIL, É BLOQUEIO DE TRANSAÇÃO:
 * na instrução `transfer_checked_with_fee` **o cliente informa a taxa esperada e
 * o programa confere**. Se divergir em UM lamport, a transação falha. Então esta
 * função não pode ser "mais ou menos" a fórmula do Token-2022 — tem que ser
 * EXATAMENTE ela.
 *
 * A fórmula do `calculate_fee` do spl-token-2022, espelhada aqui:
 *
 *   taxa = min( ceil(bruto × bps / 10_000), maximumFee )
 *   e 0 quando bps == 0 ou bruto == 0
 *
 * ⚠️ A divisão é por CIMA (ceiling), não truncada. Truncar aqui daria uma taxa
 * 1 lamport menor que a do programa e **toda transferência reverteria**.
 *
 * 🔒 Direção do arredondamento no gross-up: sempre a favor de QUEM RECEBE. Se
 * sobra fração, a tesouraria absorve. O contrário entregaria menos do que a
 * auditoria prometeu, e aí o número do ciclo não fecha com o que chegou.
 */

const BASE = 10_000n;

export interface ConfigTaxa {
  /** Alíquota em basis points. 500 = 5%. */
  readonly bps: number;
  /**
   * Teto absoluto por transferência, na menor unidade do token.
   * null = sem teto (5% literal em qualquer tamanho) — é o que "5%" significa.
   */
  readonly maximoPorTransferencia: bigint | null;
}

/** A configuração do lançamento. Decisão do fundador, 2026-09-28. */
export const TAXA_LANCAMENTO: ConfigTaxa = {
  bps: 500,
  maximoPorTransferencia: null,
};

function valida(cfg: ConfigTaxa): void {
  if (!Number.isInteger(cfg.bps) || cfg.bps < 0 || cfg.bps > 10_000) {
    throw new RangeError(`alíquota fora de 0–10000 bps: ${cfg.bps}`);
  }
  if (cfg.maximoPorTransferencia !== null && cfg.maximoPorTransferencia < 0n) {
    throw new RangeError(`teto negativo: ${cfg.maximoPorTransferencia}`);
  }
}

/** A taxa que o programa vai cobrar de uma transferência de `bruto`. */
export function taxaDe(bruto: bigint, cfg: ConfigTaxa = TAXA_LANCAMENTO): bigint {
  valida(cfg);
  if (bruto < 0n) throw new RangeError(`bruto negativo: ${bruto}`);
  if (bruto === 0n || cfg.bps === 0) return 0n;

  const bps = BigInt(cfg.bps);
  // ceiling: (n + BASE - 1) / BASE — igual ao spl-token-2022.
  const bruta = (bruto * bps + BASE - 1n) / BASE;
  const teto = cfg.maximoPorTransferencia;
  return teto !== null && bruta > teto ? teto : bruta;
}

/** Quanto CHEGA na wallet de destino numa transferência de `bruto`. */
export function liquidoDe(bruto: bigint, cfg: ConfigTaxa = TAXA_LANCAMENTO): bigint {
  return bruto - taxaDe(bruto, cfg);
}

/**
 * Inverso: o MENOR bruto que entrega ao menos `liquido` na wallet de destino.
 *
 * Fecha o laço conferindo com a própria `taxaDe` — um inverso de fórmula com
 * arredondamento não se prova por álgebra, se prova por verificação. O palpite
 * inicial vem da fórmula contínua e o ajuste sobe no máximo poucas unidades.
 */
export function brutoParaEntregar(liquido: bigint, cfg: ConfigTaxa = TAXA_LANCAMENTO): bigint {
  valida(cfg);
  if (liquido < 0n) throw new RangeError(`líquido negativo: ${liquido}`);
  if (liquido === 0n) return 0n;
  if (cfg.bps === 0) return liquido;
  if (cfg.bps === 10_000 && cfg.maximoPorTransferencia === null) {
    // 100% de taxa sem teto: nada chega, por mais que se mande.
    throw new RangeError('alíquota de 100% sem teto: impossível entregar líquido');
  }

  const bps = BigInt(cfg.bps);
  // Palpite: bruto ≈ liquido / (1 − bps/BASE), por cima.
  const denom = BASE - bps;
  let g = denom > 0n ? (liquido * BASE + denom - 1n) / denom : liquido;

  // Com teto, o bruto nunca passa de liquido + teto.
  const teto = cfg.maximoPorTransferencia;
  if (teto !== null) {
    const comTeto = liquido + teto;
    if (comTeto < g) g = comTeto;
  }

  // Ajuste verificado. Sobe enquanto não entregar o prometido.
  let voltas = 0;
  while (liquidoDe(g, cfg) < liquido) {
    g += 1n;
    if (++voltas > 1_000) throw new Error('gross-up não convergiu — configuração inesperada');
  }
  // E desce enquanto der pra entregar o mesmo com menos (o palpite pode passar).
  while (g > 0n && liquidoDe(g - 1n, cfg) >= liquido) g -= 1n;

  return g;
}

/**
 * O que a tesouraria gasta e o que a pessoa recebe, num só lugar.
 *
 * `brutoDebitado` é o que sai da tesouraria; `liquidoEntregue` é o que chega na
 * wallet; `taxaRetida` é o que o Token-2022 retém para os founders. A auditoria
 * do ciclo reporta os três — reportar só um dos lados foi o furo que a taxa
 * abriu na `auditarCiclo`.
 */
export interface Liquidacao {
  readonly liquidoPrometido: bigint;
  readonly brutoDebitado: bigint;
  readonly liquidoEntregue: bigint;
  readonly taxaRetida: bigint;
}

export function liquidarComTaxa(liquidoPrometido: bigint, cfg: ConfigTaxa = TAXA_LANCAMENTO): Liquidacao {
  const brutoDebitado = brutoParaEntregar(liquidoPrometido, cfg);
  const taxaRetida = taxaDe(brutoDebitado, cfg);
  return {
    liquidoPrometido,
    brutoDebitado,
    liquidoEntregue: brutoDebitado - taxaRetida,
    taxaRetida,
  };
}
