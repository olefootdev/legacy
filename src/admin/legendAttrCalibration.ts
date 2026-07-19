/**
 * Calibração de atributos da lenda: o admin seta o OVR alvo e o sistema
 * distribui os 10 atributos POR POSIÇÃO e por FASE DE VIDA, escalando pro OVR.
 *
 * Reusa `baseAttrsForPosition` (perfil por posição) e o mesmo peso do
 * `overallFromAttributes` (src/entities/player.ts). O resultado é honesto: o
 * card mostra E joga no OVR calibrado, com o perfil da posição.
 */
import type { PlayerAttributes } from '@/entities/types';
import { baseAttrsForPosition } from '@/entities/managerProspect';
import { ovrWeightsForPos } from '@/entities/ovrWeights';

export type LegendPhaseKey = 'revelacao' | 'consolidacao' | 'expansao';

const KEYS = [
  'passe', 'marcacao', 'velocidade', 'drible', 'finalizacao',
  'fisico', 'tatico', 'mentalidade', 'confianca', 'fairPlay',
] as const;
type AttrKey = (typeof KEYS)[number];

/**
 * Os pesos agora vêm de `ovrWeightsForPos` — a MESMA fonte que o jogo usa.
 * Antes havia uma cópia local do peso único, que ignorava a posição: por isso
 * um volante calibrado pra "OVR 85" nunca chegava lá em campo.
 */
const wOf = (pos?: string) => ovrWeightsForPos(pos);

/**
 * Viés por FASE DE VIDA. Revelação = jovem/físico/cru; consolidação = afirmação;
 * expansão = maduro/tático/mental. Aplicado sobre o perfil da posição.
 */
const PHASE_BIAS: Record<LegendPhaseKey, Partial<Record<AttrKey, number>>> = {
  revelacao:    { velocidade: 5, drible: 4, fisico: 3, tatico: -3, mentalidade: -3, confianca: -1 },
  consolidacao: { tatico: 2, passe: 2, confianca: 2, fisico: 1 },
  expansao:     { tatico: 5, mentalidade: 5, confianca: 3, passe: 2, velocidade: -3, fisico: -1 },
};

/** Atributos que DEFINEM cada posição — pra destacar na visualização. */
const KEY_ATTRS: Record<string, AttrKey[]> = {
  GOL: ['fisico', 'marcacao', 'mentalidade', 'confianca'],
  ZAG: ['marcacao', 'fisico', 'tatico'],
  LE:  ['velocidade', 'marcacao', 'drible', 'fisico'],
  LD:  ['velocidade', 'marcacao', 'drible', 'fisico'],
  VOL: ['passe', 'tatico', 'marcacao', 'fisico'],
  MC:  ['passe', 'tatico', 'marcacao', 'fisico'],
  MEI: ['passe', 'drible', 'finalizacao', 'tatico'],
  PE:  ['velocidade', 'drible', 'passe', 'finalizacao'],
  PD:  ['velocidade', 'drible', 'passe', 'finalizacao'],
  ATA: ['finalizacao', 'velocidade', 'drible'],
};

const clampAttr = (n: number) => Math.max(1, Math.min(99, Math.round(n)));
const rawWeighted = (a: PlayerAttributes, pos?: string) => {
  const w = wOf(pos);
  return KEYS.reduce((s, k) => s + (a[k] ?? 58) * w[k], 0);
};

/** OVR ponderado (mesmo que o game mostra). Use ESTE, não a média simples. */
export function weightedOverall(a: PlayerAttributes, pos?: string): number {
  return Math.round(Math.max(40, Math.min(99, rawWeighted(a, pos))));
}

export function keyAttrsForPosition(pos: string): AttrKey[] {
  return KEY_ATTRS[pos.trim().toUpperCase()] ?? [];
}

/**
 * Escala os atributos pra bater o OVR ponderado alvo, preservando o perfil
 * (multiplicativo + ajuste fino distribuído). Sobe primeiro os de maior peso e
 * rotaciona pra não distorcer nenhum atributo isolado.
 */
function scaleToOvr(attrs: PlayerAttributes, target: number, pos?: string): PlayerAttributes {
  const t = Math.max(40, Math.min(99, Math.round(target)));
  const f = t / (rawWeighted(attrs, pos) || 1);
  const a: PlayerAttributes = { ...attrs };
  for (const k of KEYS) a[k] = clampAttr((attrs[k] ?? 58) * f);

  for (let i = 0; i < 600; i++) {
    const o = weightedOverall(a, pos);
    if (o === t) break;
    const dir = o < t ? 1 : -1;
    const cand = KEYS
      .filter((k) => (dir > 0 ? a[k] < 99 : a[k] > 1))
      .sort((x, y) => wOf(pos)[y] - wOf(pos)[x]);
    if (cand.length === 0) break;
    a[cand[i % cand.length]!] += dir;
  }
  return a;
}

/** Perfil da posição + viés da fase, escalado pro OVR alvo. */
export function calibrateLegendAttrs(
  pos: string,
  phase: LegendPhaseKey,
  targetOvr: number,
): PlayerAttributes {
  const base = baseAttrsForPosition(pos);
  const biased: PlayerAttributes = { ...base };
  const bias = PHASE_BIAS[phase] ?? {};
  for (const k of KEYS) biased[k] = clampAttr((biased[k] ?? 58) + (bias[k] ?? 0));
  return scaleToOvr(biased, targetOvr, pos);
}
