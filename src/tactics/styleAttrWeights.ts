/**
 * ESTILO DE JOGO → EVOLUÇÃO DE ATRIBUTOS.
 *
 * Traduz o estilo tático do manager (`TeamTacticalStyle`, 10 eixos) em pesos
 * por atributo do jogador (0..1, somam 1). Esses pesos enviesam QUAIS atributos
 * crescem — no treino e na partida — pra que o plantel de cada manager evolua
 * conforme a identidade dele:
 *   time de posse → passe/tático  ·  contra-ataque → velocidade/finalização  ·
 *   pressão → físico/marcação  ·  jogo direto → velocidade/finalização.
 *
 * Puro e determinístico (sem Date/Math.random) — testável.
 */

import type { PlayerAttributes } from '@/entities/types';
import {
  normalizeStyle,
  type NormalizedTacticalStyle,
  type TeamTacticalStyle,
} from '@/tactics/playingStyle';

export type AttrKey = keyof PlayerAttributes;

const ATTR_KEYS: AttrKey[] = [
  'passe', 'marcacao', 'velocidade', 'drible', 'finalizacao',
  'fisico', 'tatico', 'mentalidade', 'confianca', 'fairPlay',
];

/** Contribuição de cada eixo tático para os atributos (proporções por eixo). */
const AXIS_TO_ATTR: Record<keyof Omit<NormalizedTacticalStyle, 'presetId'>, Partial<Record<AttrKey, number>>> = {
  buildUp:         { passe: 0.7, tatico: 0.3 },
  width:           { passe: 0.6, velocidade: 0.4 },
  verticality:     { velocidade: 0.45, finalizacao: 0.55 },
  chanceCreation:  { passe: 0.4, drible: 0.35, finalizacao: 0.25 },
  shootingProfile: { finalizacao: 0.8, drible: 0.2 },
  defensiveBlock:  { marcacao: 0.65, tatico: 0.35 },
  pressing:        { fisico: 0.55, marcacao: 0.45 },
  compactness:     { tatico: 0.6, marcacao: 0.4 },
  riskTaking:      { drible: 0.7, finalizacao: 0.3 },
  velocidade:      { velocidade: 0.75, fisico: 0.25 },
};

/** Expoente de "afiação": realça o eixo tático DOMINANTE do manager, apaga o ruído
 *  dos eixos fracos — presets planos viram identidades nítidas. */
const SHARPEN = 1.8;

export type StyleAttrWeights = Record<AttrKey, number>;

/**
 * Pesos por atributo a partir do estilo. Soma dos on-pitch = 1 (mentalidade/
 * confiança/fairPlay ficam ~0: são temperamento, evoluem por treino mental/
 * empatia e nivelamento, não pelo estilo tático).
 */
export function styleAttrWeights(style: TeamTacticalStyle | NormalizedTacticalStyle | undefined): StyleAttrWeights {
  const norm = normalizeStyle(style as TeamTacticalStyle);
  const raw: StyleAttrWeights = {
    passe: 0, marcacao: 0, velocidade: 0, drible: 0, finalizacao: 0,
    fisico: 0, tatico: 0, mentalidade: 0, confianca: 0, fairPlay: 0,
  };
  for (const axis of Object.keys(AXIS_TO_ATTR) as (keyof typeof AXIS_TO_ATTR)[]) {
    const frac = norm[axis] ?? 0;
    if (frac <= 0) continue;
    const sharp = Math.pow(frac, SHARPEN);
    const map = AXIS_TO_ATTR[axis];
    for (const attr of Object.keys(map) as AttrKey[]) {
      raw[attr] += sharp * (map[attr] ?? 0);
    }
  }
  const total = ATTR_KEYS.reduce((s, k) => s + raw[k], 0);
  if (total <= 0) return raw;
  for (const k of ATTR_KEYS) raw[k] = raw[k] / total;
  return raw;
}

/** Atributo com maior afinidade de estilo (desempate estável pela ordem canônica). */
export function topStyleAttr(weights: StyleAttrWeights): AttrKey {
  let best: AttrKey = 'tatico';
  let bestW = -1;
  for (const k of ATTR_KEYS) {
    if (weights[k] > bestW) { bestW = weights[k]; best = k; }
  }
  return best;
}

/**
 * Viés de estilo NO TREINO: além dos ganhos por tipo de treino, a sessão reforça
 * a identidade do time — +1 no atributo mais alinhado ao estilo (o 2º também
 * quando o estilo é muito concentrado). Determinístico; o teto de evolução
 * (`clampPlayerToEvolutionCap`, aplicado depois) contém qualquer excesso.
 */
export function applyStyleTrainingBias(
  attrs: PlayerAttributes,
  weights: StyleAttrWeights,
  opts: { concentratedThreshold?: number } = {},
): PlayerAttributes {
  const total = ATTR_KEYS.reduce((s, k) => s + weights[k], 0);
  if (total <= 0) return attrs;
  const ranked = [...ATTR_KEYS].sort((a, b) => weights[b] - weights[a]);
  const out = { ...attrs };
  // Reforça os 2 atributos mais alinhados ao estilo (a assinatura do time).
  out[ranked[0]!] = clamp99(out[ranked[0]!] + 1);
  if (ranked[1]) out[ranked[1]!] = clamp99(out[ranked[1]!] + 1);
  // Estilo muito concentrado treina um 3º atributo.
  const threshold = opts.concentratedThreshold ?? 0.26;
  if (ranked[2] && weights[ranked[0]!] >= threshold) {
    out[ranked[2]!] = clamp99(out[ranked[2]!] + 1);
  }
  return out;
}

function clamp99(v: number): number {
  return Math.max(1, Math.min(99, Math.round(v)));
}
