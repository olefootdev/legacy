/**
 * O plano de carreira — as cinco graduações (BÔNUS DE EQUIPARAÇÃO · v1).
 *
 * A graduação sai da EQUIPE MENOR, e é isso que a torna difícil de forjar:
 * não adianta empilhar tudo de um lado. Pra virar PENTA é preciso 500.000
 * OLEXP no lado mais fraco — ou seja, pelo menos 1.000.000 na rede.
 *
 * Usa OLEXP de QUALIFICAÇÃO (todas as fontes), não o de equiparação. Graduar
 * é reconhecimento; pagar é outra coisa, e vive em equiparacao.ts.
 */
import type { Olexp } from './unidade.js';

export type Graduacao = 'CAMPEAO' | 'DUPLO_CAMPEAO' | 'TRI_CAMPEAO' | 'TETRA' | 'PENTA';

export interface Degrau {
  readonly id: Graduacao;
  /** O que o manager lê. Em inglês a tradução vive no dicionário da UI. */
  readonly nome: string;
  /** OLEXP exigido na equipe menor. */
  readonly exige: Olexp;
}

/** Em ordem crescente. A ordem é usada pra achar atual e próxima. */
export const DEGRAUS: readonly Degrau[] = [
  { id: 'CAMPEAO',       nome: 'Campeão',       exige: 10_000n },
  { id: 'DUPLO_CAMPEAO', nome: 'Duplo Campeão', exige: 50_000n },
  { id: 'TRI_CAMPEAO',   nome: 'Tri-Campeão',   exige: 100_000n },
  { id: 'TETRA',         nome: 'Tetra',         exige: 250_000n },
  { id: 'PENTA',         nome: 'Penta',         exige: 500_000n },
] as const;

// Não é comentário, é checagem: degrau fora de ordem faria a graduação pular
// ou travar, e o erro só apareceria com alguém já graduado.
{
  for (let i = 1; i < DEGRAUS.length; i++) {
    const ant = DEGRAUS[i - 1] as Degrau;
    const at = DEGRAUS[i] as Degrau;
    if (at.exige <= ant.exige) {
      throw new Error(`degraus fora de ordem: ${ant.id} (${ant.exige}) → ${at.id} (${at.exige})`);
    }
  }
}

export interface Carreira {
  /** null = ainda não graduou. */
  readonly atual: Degrau | null;
  /** null = já é PENTA. */
  readonly proxima: Degrau | null;
  readonly equipeMenor: Olexp;
  /** Quanto falta pra próxima. 0n quando não há próxima. */
  readonly falta: Olexp;
  /** 0–100, quanto do caminho ATÉ a próxima já andou. 100 quando é PENTA. */
  readonly progresso: number;
}

/**
 * A graduação nunca cai por si só: ela é função do volume acumulado, e volume
 * acumulado não diminui. A equiparação CONSOME o OLEXP de equiparação, mas não
 * o de qualificação — senão quem recebesse bônus seria rebaixado por isso.
 */
export function carreiraDe(equipeMenor: Olexp): Carreira {
  if (equipeMenor < 0n) throw new RangeError(`equipe menor negativa: ${equipeMenor}`);

  let atual: Degrau | null = null;
  for (const d of DEGRAUS) {
    if (equipeMenor >= d.exige) atual = d;
    else break;
  }

  const i = atual ? DEGRAUS.findIndex((d) => d.id === atual?.id) : -1;
  const proxima = i + 1 < DEGRAUS.length ? (DEGRAUS[i + 1] as Degrau) : null;

  if (!proxima) return { atual, proxima: null, equipeMenor, falta: 0n, progresso: 100 };

  const piso = atual ? atual.exige : 0n;
  const faixa = proxima.exige - piso;
  const andou = equipeMenor - piso;
  return {
    atual,
    proxima,
    equipeMenor,
    falta: proxima.exige - equipeMenor,
    progresso: Number((andou * 100n) / faixa),
  };
}
