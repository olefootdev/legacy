/**
 * O plano de carreira — as cinco graduações (BÔNUS DE EQUIPARAÇÃO · v1).
 *
 * 🔑 A graduação conta o OLEXP que JÁ FOI PAGO em equiparação — a soma de todos
 * os `equiparado` dos ciclos, acumulada. Regra do fundador, 2026-09-29.
 *
 * Antes eu lia o volume atual da equipe menor, e isso tinha um furo que o
 * exemplo dele expõe:
 *
 *   ciclo 1:  T1=1000  T2=500   → equipara 500 → T1=500  T2=0
 *   ciclo 2:  entra investidor no T2
 *             T1=1000  T2=5000  → equipara 1000 → T1=0  T2=4000
 *
 * No ciclo 2 a perna MENOR TROCOU DE LADO. Lendo "a menor agora", a graduação
 * passaria a olhar outro número e poderia até cair. Somando o que foi pago,
 * ela vai a 1500 e nunca volta.
 *
 * Por que isso é melhor, e não só diferente:
 *   · é MONOTÔNICO POR CONSTRUÇÃO — soma de parcelas não-negativas não desce,
 *     então a graduação não precisa de um trilho protegido pra não cair;
 *   · é imune à troca de lado da perna menor, que acontece toda vez que um
 *     volume grande entra de um lado só;
 *   · e conta o que a rede PRODUZIU de verdade, não o que está parado nela.
 *
 * Continua difícil de forjar pelo mesmo motivo de antes: só entra aqui o que
 * passou pelo MIN das duas pernas, e empilhar um lado só equipara zero.
 */
import type { Olexp } from './unidade.js';

export type Graduacao = 'CAMPEAO' | 'DUPLO_CAMPEAO' | 'TRI_CAMPEAO' | 'TETRA' | 'PENTA';

export interface Degrau {
  readonly id: Graduacao;
  /** O que o manager lê. Em inglês a tradução vive no dicionário da UI. */
  readonly nome: string;
  /** OLEXP acumulado em equiparação para alcançar o degrau. */
  readonly exige: Olexp;
  /**
   * Prêmio em OLEFOOT (token inteiro) ao atingir o degrau, uma vez por pessoa.
   * Regra do fundador, 2026-09-30. Espelha `expansao_degraus()` no banco.
   * Não passa pelo preço de referência e não entra no teto diário.
   */
  readonly premioOlefoot: bigint;
}

/** Em ordem crescente. A ordem é usada pra achar atual e próxima. */
export const DEGRAUS: readonly Degrau[] = [
  { id: 'CAMPEAO',       nome: 'Campeão',       exige: 10_000n,  premioOlefoot: 1_000n },
  { id: 'DUPLO_CAMPEAO', nome: 'Duplo Campeão', exige: 50_000n,  premioOlefoot: 5_000n },
  { id: 'TRI_CAMPEAO',   nome: 'Tri-Campeão',   exige: 100_000n, premioOlefoot: 10_000n },
  { id: 'TETRA',         nome: 'Tetra',         exige: 250_000n, premioOlefoot: 25_000n },
  { id: 'PENTA',         nome: 'Penta',         exige: 500_000n, premioOlefoot: 50_000n },
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
  /** O que já foi pago em equiparação, somado ao longo de todos os ciclos. */
  readonly equiparadoAcumulado: Olexp;
  /** Quanto falta pra próxima. 0n quando não há próxima. */
  readonly falta: Olexp;
  /** 0–100, quanto do caminho ATÉ a próxima já andou. 100 quando é PENTA. */
  readonly progresso: number;
}

/**
 * A graduação nunca cai: o acumulado só cresce, então o degrau só sobe.
 * Receber bônus AUMENTA a graduação em vez de gastá-la — é a mesma equiparação
 * contada duas vezes de propósito: uma paga, a outra reconhece.
 */
export function carreiraDe(equiparadoAcumulado: Olexp): Carreira {
  if (equiparadoAcumulado < 0n) {
    throw new RangeError(`equiparado acumulado negativo: ${equiparadoAcumulado}`);
  }

  let atual: Degrau | null = null;
  for (const d of DEGRAUS) {
    if (equiparadoAcumulado >= d.exige) atual = d;
    else break;
  }

  const i = atual ? DEGRAUS.findIndex((d) => d.id === atual?.id) : -1;
  const proxima = i + 1 < DEGRAUS.length ? (DEGRAUS[i + 1] as Degrau) : null;

  if (!proxima) return { atual, proxima: null, equiparadoAcumulado, falta: 0n, progresso: 100 };

  const piso = atual ? atual.exige : 0n;
  const faixa = proxima.exige - piso;
  const andou = equiparadoAcumulado - piso;
  return {
    atual,
    proxima,
    equiparadoAcumulado,
    falta: proxima.exige - equiparadoAcumulado,
    progresso: Number((andou * 100n) / faixa),
  };
}

/**
 * Os degraus cruzados ao sair de `antes` e chegar em `depois` — os que pagam
 * prêmio agora. Pular dois degraus num ciclo paga os dois; ficar parado não
 * paga nada. A trava de "uma vez por degrau" é o acumulado só crescer.
 */
export function premiosAoCruzar(antes: Olexp, depois: Olexp): readonly Degrau[] {
  if (antes < 0n || depois < antes) throw new RangeError(`acumulado não pode descer: ${antes} → ${depois}`);
  return DEGRAUS.filter((d) => d.exige > antes && d.exige <= depois);
}
