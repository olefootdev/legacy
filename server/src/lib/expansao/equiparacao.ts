/**
 * O bônus de equiparação e o ciclo (BÔNUS DE EQUIPARAÇÃO · v1).
 *
 * O bônus compara o OLEXP ELEGÍVEL das duas pernas e equipara o menor:
 *   equiparado = MIN(elegível Time 1, elegível Time 2)
 * e DEBITA dos dois lados. O que sobra do lado maior fica pro próximo ciclo —
 * é o carry-over, e é ele que faz a rede valer a pena no longo prazo.
 *
 * 🔴 O QUE ESTE ARQUIVO SE RECUSA A FAZER: dizer quanto vale um OLEXP antes de
 * existir pool. Não há constante de preço aqui, e não pode haver. O valor sai
 * de uma divisão que só é possível depois do ciclo fechado:
 *   valor de liquidação = pool do ciclo ÷ OLEXP equiparado no ciclo
 *
 * 🔴 CICLO SEM POOL NÃO LIQUIDA. Se a hora não teve receita elegível, o pool é
 * zero e o valor de liquidação é INDEFINIDO — não zero. Equiparar nesse ciclo
 * debitaria OLEXP das duas pernas em troca de nada. Então a equiparação fica
 * RETIDA e entra no próximo ciclo que tiver pool: ninguém perde unidade sem
 * receber. (Decisão de 2026-09-28; mudar isso muda quem paga a conta de uma
 * hora parada.)
 */
import { exigePositivo, type Olexp } from './unidade.js';
import type { Ativacao } from './arvore.js';

/** O elegível de cada perna, no momento em que o ciclo fecha. */
export interface SaldoElegivel {
  readonly time1: Olexp;
  readonly time2: Olexp;
}

export interface Equiparacao {
  readonly equiparado: Olexp;
  readonly sobra: SaldoElegivel;
  /** Qual perna ficou zerada. null quando as duas zeraram (empate exato). */
  readonly pernaZerada: 1 | 2 | null;
}

/** MIN dos dois lados, debitado dos dois. O resto fica pro próximo ciclo. */
export function equiparar(s: SaldoElegivel): Equiparacao {
  if (s.time1 < 0n || s.time2 < 0n) throw new RangeError('saldo elegível negativo');
  const eq = s.time1 < s.time2 ? s.time1 : s.time2;
  const sobra = { time1: s.time1 - eq, time2: s.time2 - eq };
  const pernaZerada = sobra.time1 === 0n && sobra.time2 === 0n ? null : sobra.time1 === 0n ? 1 : 2;
  return { equiparado: eq, sobra, pernaZerada };
}

/**
 * A equiparação COM a trava de ativação.
 *
 * Regra do fundador: só equipara quem indicou pelo menos 1 pessoa em CADA perna
 * (ver `ativacaoDe` em `arvore.ts`). Quem não indicou os dois lados não perde
 * nada — o saldo fica RETIDO e equipara inteiro no ciclo em que ativar.
 *
 * 🔴 Reter em vez de zerar não é generosidade, é a única leitura honesta: o
 * OLEXP foi gerado por compra que aconteceu de verdade. Zerar seria confiscar
 * volume real por uma condição que a pessoa ainda pode cumprir. E reter é o que
 * faz a trava virar INCENTIVO ("ative e destrave tudo") em vez de punição.
 *
 * O pico que isso pode criar não quebra nada: o pool do ciclo é fixo, então
 * mais gente equiparando dilui o valor por OLEXP daquela hora — não estoura o
 * caixa.
 */
export interface EquiparacaoComTrava extends Equiparacao {
  readonly retidoPorInatividade: boolean;
  readonly faltaNaPerna: 1 | 2 | null;
}

export function equipararSeAtivo(s: SaldoElegivel, a: Ativacao): EquiparacaoComTrava {
  if (!a.ativo) {
    if (s.time1 < 0n || s.time2 < 0n) throw new RangeError('saldo elegível negativo');
    return {
      equiparado: 0n,
      sobra: { time1: s.time1, time2: s.time2 },  // nada é debitado
      pernaZerada: null,
      retidoPorInatividade: true,
      faltaNaPerna: a.faltaNaPerna,
    };
  }
  return { ...equiparar(s), retidoPorInatividade: false, faltaNaPerna: null };
}

// ------------------------------------------------------------------ ciclo ---

export type StatusCiclo = 'OPEN' | 'CALCULATING' | 'READY' | 'SETTLING' | 'SETTLED' | 'CANCELED' | 'HELD';

/** Configuração do pool. Percentual administrável — NUNCA cravado em código. */
export interface ConfigPool {
  /** Em base 10.000: 2500 = 25%. Inteiro pra não arrastar float em dinheiro. */
  readonly percentualBps: number;
}

export const PERCENTUAL_BPS_PADRAO = 2500; // 25% — ponto de partida, configurável

/**
 * Pool do ciclo = percentual × receita elegível.
 *
 * `receita` na menor unidade da moeda contábil (centavos de BRL, micro-USDT…).
 * Arredonda pra BAIXO: a casa nunca promete mais do que arrecadou.
 */
export function poolDoCiclo(receita: bigint, cfg: ConfigPool): bigint {
  if (receita < 0n) throw new RangeError(`receita negativa: ${receita}`);
  if (!Number.isInteger(cfg.percentualBps) || cfg.percentualBps < 0 || cfg.percentualBps > 10_000) {
    throw new RangeError(`percentual fora de 0–10000 bps: ${cfg.percentualBps}`);
  }
  return (receita * BigInt(cfg.percentualBps)) / 10_000n;
}

export interface Liquidacao {
  readonly status: Extract<StatusCiclo, 'READY' | 'HELD'>;
  readonly pool: bigint;
  readonly equiparadoTotal: Olexp;
  /**
   * Quanto cada OLEXP equiparado rende NESTE ciclo, em micro-unidades da moeda
   * contábil (1e6) pra não perder fração em divisão inteira.
   * null quando o ciclo não liquida — e null é diferente de zero.
   */
  readonly valorPorOlexpMicro: bigint | null;
  readonly motivo?: string;
}

export const MICRO = 1_000_000n;

/**
 * Fecha o ciclo. Devolve READY com valor, ou HELD com o motivo.
 *
 * Nunca devolve valor zero como se fosse liquidação: um ciclo que não pode
 * pagar precisa dizer que não pagou, e por quê.
 */
export function fecharCiclo(pool: bigint, equiparadoTotal: Olexp): Liquidacao {
  if (pool < 0n) throw new RangeError(`pool negativo: ${pool}`);
  if (equiparadoTotal < 0n) throw new RangeError(`equiparado negativo: ${equiparadoTotal}`);

  if (equiparadoTotal === 0n) {
    return { status: 'HELD', pool, equiparadoTotal, valorPorOlexpMicro: null, motivo: 'nada a equiparar neste ciclo' };
  }
  if (pool === 0n) {
    return {
      status: 'HELD', pool, equiparadoTotal, valorPorOlexpMicro: null,
      motivo: 'ciclo sem receita elegível — equiparação retida para o próximo ciclo com pool',
    };
  }
  return {
    status: 'READY', pool, equiparadoTotal,
    valorPorOlexpMicro: (pool * MICRO) / equiparadoTotal,
  };
}

/**
 * Quanto uma pessoa recebe, em moeda contábil (menor unidade).
 * Arredonda pra baixo — a sobra fica no pool, nunca é inventada.
 */
export function bonusContabil(equiparadoDaPessoa: Olexp, valorPorOlexpMicro: bigint): bigint {
  if (equiparadoDaPessoa < 0n) throw new RangeError('equiparado negativo');
  if (valorPorOlexpMicro < 0n) throw new RangeError('valor por olexp negativo');
  return (equiparadoDaPessoa * valorPorOlexpMicro) / MICRO;
}

/**
 * Bônus contábil → OLEFOOT, ao preço de referência do momento da liquidação.
 *
 * `precoMicro` = preço de 1 OLEFOOT na mesma moeda contábil, em micro-unidades.
 * O preço entra como PARÂMETRO de propósito: ele vem do ciclo, é registrado
 * junto, e não existe em lugar nenhum como constante.
 */
export function olefootAPagar(bonusContabil: bigint, precoMicro: bigint): bigint {
  exigePositivo('preço de referência', precoMicro);
  if (bonusContabil < 0n) throw new RangeError('bônus negativo');
  return (bonusContabil * MICRO) / precoMicro;
}

// ------------------------------------------------- tranche do balde ---------

/**
 * Quanto do balde de expansão pode ser LIBERADO.
 *
 * 🔴 A tranche NÃO pode ser um percentual fixo do balde. Medido em
 * `docs/TOKENOMICS.md`: 5% do balde de 1,25B são 62,5M tokens = $7.812,50 no
 * preço da pré-venda, mas uma pré-venda que arrecade $10.000 só cobre 20M
 * (25% de $10.000). A regra fixa liberaria **3,1× mais do que a receita
 * sustenta** — e aí o "a cada $1 destino $0,25" deixa de ser verdade.
 *
 * Então a tranche é o MENOR entre o degrau do balde e o que a receita cobre.
 * O degrau é teto administrativo; a receita é o chão da realidade.
 */
export function trancheLiberavel(args: {
  /** Tamanho total do balde de expansão, em token (menor unidade). */
  readonly baldeTotal: bigint;
  /** Degrau administrativo, em bps do balde. 500 = 5%. */
  readonly degrauBps: number;
  /** Receita elegível acumulada, na menor unidade da moeda contábil. */
  readonly receitaAcumulada: bigint;
  /** Fatia da receita destinada à expansão, em bps. 2500 = 25%. */
  readonly percentualBps: number;
  /** Preço de referência de 1 token na moeda contábil, em micro. */
  readonly precoMicro: bigint;
  /** Já liberado do balde até agora, em token. */
  readonly jaLiberado: bigint;
}): { readonly tranche: bigint; readonly limitadoPor: 'degrau' | 'receita' | 'balde' } {
  const { baldeTotal, degrauBps, receitaAcumulada, percentualBps, precoMicro, jaLiberado } = args;
  if (baldeTotal < 0n || receitaAcumulada < 0n || jaLiberado < 0n) {
    throw new RangeError('valores do balde não podem ser negativos');
  }
  if (!Number.isInteger(degrauBps) || degrauBps < 0 || degrauBps > 10_000) {
    throw new RangeError(`degrau fora de 0–10000 bps: ${degrauBps}`);
  }
  exigePositivo('preço de referência', precoMicro);

  const porDegrau = (baldeTotal * BigInt(degrauBps)) / 10_000n;
  const porReceita = olefootAPagar(poolDoCiclo(receitaAcumulada, { percentualBps }), precoMicro);
  const restaNoBalde = baldeTotal > jaLiberado ? baldeTotal - jaLiberado : 0n;

  let tranche = porDegrau;
  let limitadoPor: 'degrau' | 'receita' | 'balde' = 'degrau';
  if (porReceita < tranche) { tranche = porReceita; limitadoPor = 'receita'; }
  if (restaNoBalde < tranche) { tranche = restaNoBalde; limitadoPor = 'balde'; }
  return { tranche, limitadoPor };
}

/**
 * Piso do balde: abaixo dele a liquidação troca de régua.
 *
 * Enquanto há folga, o ciclo liquida denominado em DINHEIRO (pool ÷ equiparado)
 * — o que é certo, porque o bônus é uma promessa em valor. Mas se o balde
 * afunda, continuar denominando em dinheiro obriga a emitir mais token conforme
 * o preço cai, que é exatamente a espiral que `docs/TOKENOMICS.md` descreve.
 *
 * Abaixo do piso o ciclo passa a distribuir FRAÇÃO DO BALDE RESTANTE. Assim o
 * balde nunca fica insolvente e nunca é forçado a emitir num mercado caindo.
 */
export const PISO_DO_BALDE_BPS = 2_000; // 20% da tranche

export function abaixoDoPiso(saldoDoBalde: bigint, tamanhoDaTranche: bigint, pisoBps = PISO_DO_BALDE_BPS): boolean {
  if (saldoDoBalde < 0n || tamanhoDaTranche < 0n) throw new RangeError('valores negativos');
  return saldoDoBalde < (tamanhoDaTranche * BigInt(pisoBps)) / 10_000n;
}
