/**
 * As regras de EARNING, num lugar só (Vault, Produção e Stake).
 *
 * 🔴 Por que este arquivo existe: os mesmos números moravam em três lugares. O
 * split da colheita está em `harvestSplit.ts` — e a OLEWALLET tinha uma CÓPIA
 * dele à mão, com o comentário "os MESMOS números de harvestSplit.ts". A
 * política do Vault e os prazos do Stake só existiam dentro de uma tela. Número
 * de dinheiro copiado em tela é número que um dia diverge sem ninguém ver: o
 * split já somou 110% uma vez.
 *
 * Daqui sai o que GET /api/earnings entrega, e as telas leem de lá.
 *
 * ⚠️ NADA AQUI É TAXA PROMETIDA. O backtest é leitura do passado e vai rotulado
 * como backtest; `resultadoRealizado` é `null` porque o fundo nunca operou com
 * dinheiro — e null é diferente de zero.
 */
import { BPS_TOTAL, FATIAS, POLITICA_VAGA_PADRAO, type IdFatia, type Papel, type PoliticaVaga } from './harvestSplit.js';

// ─────────────────────────────────────────────────────────────── produção ───

export interface FatiaPublicada {
  readonly id: IdFatia;
  readonly rotulo: string;
  readonly papel: Papel;
  /** Base 10.000: 5000 = 50%. */
  readonly bps: number;
}

export function splitPublicado(): readonly FatiaPublicada[] {
  return FATIAS.map((f) => ({ id: f.id, rotulo: f.rotulo, papel: f.papel, bps: f.bps }));
}

// ────────────────────────────────────────────────────────────────── vault ───

/**
 * Política v1, confirmada pelo fundador em 2026-09-22: LP de faixa cheia em
 * WSOL/USDC, SEMPRE na pool, sem timing. A saída é decisão humana; taxa baixa
 * acende o canário, não vende.
 *
 * O backtest é o do motor da casa (2,7 anos). O overlay de timing foi
 * aposentado por viés de look-ahead e NÃO entra aqui.
 */
export const VAULT_POLITICA = {
  /** O fundo que a carteira mostra. Tem que bater com `vault_fund.slug`. */
  slug: 'wsol-usdc',
  par: 'WSOL / USDC',
  faixa: 'cheia',
  canario: { nome: 'K1', pisoAprBps: 2_500 },
  saida: 'humana',
  backtest: {
    janelaAnosDecimos: 27,
    retornoAoAnoPct: { de: 60, ate: 77 },
    piorQuedaPct: -32,
    segurandoSol: { retornoAoAnoPct: 22, piorQuedaPct: -76 },
  },
  /** null = o fundo nunca operou com dinheiro. Não é zero. */
  resultadoRealizado: null,
} as const;

// ────────────────────────────────────────────────────────────────── stake ───

export interface PrazoDeStake {
  readonly dias: number;
  /** Base 10.000: 15000 = 1,5×. Multiplica a FATIA, não promete taxa. */
  readonly multiplicadorBps: number;
}

export const STAKE_PRAZOS: readonly PrazoDeStake[] = [
  { dias: 30, multiplicadorBps: 10_000 },
  { dias: 90, multiplicadorBps: 15_000 },
  { dias: 180, multiplicadorBps: 20_000 },
  { dias: 360, multiplicadorBps: 30_000 },
];

/** O stake só abre com o token na Solana. Até lá a tela publica a regra. */
export const STAKE_ABERTO = false;
export const STAKE_SAIDA_ANTECIPADA = false;

// Não é comentário, é checagem — a mesma disciplina do split.
{
  for (let i = 1; i < STAKE_PRAZOS.length; i++) {
    const ant = STAKE_PRAZOS[i - 1] as PrazoDeStake;
    const at = STAKE_PRAZOS[i] as PrazoDeStake;
    if (at.dias <= ant.dias || at.multiplicadorBps < ant.multiplicadorBps) {
      throw new Error(`prazos de stake fora de ordem: ${ant.dias}d → ${at.dias}d`);
    }
  }
  const b = VAULT_POLITICA.backtest;
  if (b.retornoAoAnoPct.de > b.retornoAoAnoPct.ate || b.piorQuedaPct > 0 || b.segurandoSol.piorQuedaPct > 0) {
    throw new Error('backtest do vault incoerente: faixa invertida ou queda positiva');
  }
}

// ──────────────────────────────────────────────────────── o que é servido ───

export interface RegrasDeEarnings {
  readonly producao: {
    readonly fatias: readonly FatiaPublicada[];
    readonly totalBps: number;
    readonly fatiaSemDono: PoliticaVaga;
  };
  readonly vault: typeof VAULT_POLITICA;
  readonly stake: {
    readonly aberto: boolean;
    readonly saidaAntecipada: boolean;
    readonly prazos: readonly PrazoDeStake[];
  };
}

export function regrasDeEarnings(): RegrasDeEarnings {
  return {
    producao: { fatias: splitPublicado(), totalBps: BPS_TOTAL, fatiaSemDono: POLITICA_VAGA_PADRAO },
    vault: VAULT_POLITICA,
    stake: { aberto: STAKE_ABERTO, saidaAntecipada: STAKE_SAIDA_ANTECIPADA, prazos: STAKE_PRAZOS },
  };
}
