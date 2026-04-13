/**
 * TESTE 2D / futuro pré-jogo — pesos por posição (slot tático) sobre atributos de jogo.
 * Mock estável: sem HTTP; útil para enriquecer simulação ou UI de scouting.
 *
 * Integração futura: APIs externas alimentam percentis/attrs antes da partida, não por tick.
 */
import type { PlayerEntity } from '@/entities/types';

/** Pesos 0–1 por chave de atributo de entidade (subset usado no match). */
export type PositionWeightMap = Record<string, number>;

/**
 * Pesos ilustrativos por slot de formação (não replicam produtos comerciais).
 * Soma não precisa ser 1 — `weightedProfileScore` normaliza pelo peso total.
 */
/** Chaves alinhadas a `PlayerAttributes` (entities/types). */
export const MOCK_SLOT_WEIGHTS: Record<string, PositionWeightMap> = {
  gol: { marcacao: 0.85, passe: 0.5, velocidade: 0.4, fairPlay: 0.2, tatico: 0.9 },
  zag1: { marcacao: 1, passe: 0.45, velocidade: 0.5, fairPlay: 0.35, fisico: 0.55 },
  zag2: { marcacao: 1, passe: 0.45, velocidade: 0.5, fairPlay: 0.35, fisico: 0.55 },
  le: { velocidade: 0.9, passe: 0.55, marcacao: 0.65, drible: 0.5, fairPlay: 0.2 },
  ld: { velocidade: 0.9, passe: 0.55, marcacao: 0.65, drible: 0.5, fairPlay: 0.2 },
  vol: { marcacao: 0.85, passe: 0.9, velocidade: 0.65, fairPlay: 0.3, tatico: 0.55 },
  mc1: { passe: 1, marcacao: 0.5, velocidade: 0.55, fairPlay: 0.25, drible: 0.45 },
  mc2: { passe: 1, marcacao: 0.5, velocidade: 0.55, fairPlay: 0.25, drible: 0.45 },
  pe: { velocidade: 0.85, drible: 0.95, finalizacao: 0.55, passe: 0.45, mentalidade: 0.35 },
  pd: { velocidade: 0.85, drible: 0.95, finalizacao: 0.55, passe: 0.45, mentalidade: 0.35 },
  ata: { finalizacao: 1, velocidade: 0.75, passe: 0.5, drible: 0.65, fairPlay: 0.2 },
};

function attrNum(attrs: PlayerEntity['attrs'], key: string): number {
  const v = (attrs as unknown as Record<string, number | undefined>)[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : 50;
}

/**
 * Score 0–100: soma ponderada de atributos do `PlayerEntity.attrs` para o slot.
 */
export function weightedProfileScoreForSlot(player: PlayerEntity, slotId: string): number {
  const weights = MOCK_SLOT_WEIGHTS[slotId] ?? MOCK_SLOT_WEIGHTS.mc1!;
  let sum = 0;
  let wsum = 0;
  for (const [k, w] of Object.entries(weights)) {
    if (w <= 0) continue;
    sum += attrNum(player.attrs, k) * w;
    wsum += w;
  }
  if (wsum <= 0) return 50;
  return Math.min(99, Math.max(1, Math.round(sum / wsum)));
}
