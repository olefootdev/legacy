/**
 * ultralive2d — fatores de movimento derivados de atributos de partida (PitchPlayerState.attributes).
 * Não duplica decisões do GameSpirit; só modula convergência visual e “ousadia” espacial.
 *
 * Knobs (típicos):
 * - moveLerpMult: velocidade de aproximação ao alvo tático (↑ velocidade, drible).
 * - carrierLerpBoostAdd: extra só para portador (↑ com drible/condução).
 * - ballPullMult: atração à bola nos alvos (↑ médios/ataque com passe curto alto).
 * - microNoiseMult: vida orgânica (↓ mentalidade/tático).
 * - minSpacingAdd: anti-cluster (↑ tático, marcação).
 */
import type { MatchPlayerAttributes } from '@/match/playerInMatch';
import type { PitchPlayerState } from '@/engine/types';

export interface UltraliveMovementKnobs {
  moveLerpMult: number;
  carrierLerpBoostAdd: number;
  ballPullMult: number;
  microNoiseMult: number;
  minSpacingAdd: number;
}

const DEFAULT_ATTRS: MatchPlayerAttributes = {
  finalizacao: 50,
  passeCurto: 50,
  passeLongo: 50,
  cruzamento: 50,
  marcacao: 50,
  velocidade: 50,
  fairPlay: 50,
  drible: 50,
  fisico: 50,
  tatico: 50,
  mentalidade: 50,
  confianca: 50,
};

function attrsOf(p: PitchPlayerState): MatchPlayerAttributes {
  return { ...DEFAULT_ATTRS, ...p.attributes };
}

/** Agrega o meio-campo + ataque da casa para um perfil de equipa (ultralive2d). */
export function teamMovementKnobsFromHomePitch(players: PitchPlayerState[]): UltraliveMovementKnobs {
  const mids = players.filter((p) => p.role === 'mid' || p.role === 'attack');
  const sample = mids.length ? mids : players;
  if (!sample.length) {
    return {
      moveLerpMult: 1,
      carrierLerpBoostAdd: 0,
      ballPullMult: 1,
      microNoiseMult: 1,
      minSpacingAdd: 0,
    };
  }

  let vVel = 0;
  let vDri = 0;
  let vPas = 0;
  let vMen = 0;
  let vTac = 0;
  for (const p of sample) {
    const a = attrsOf(p);
    vVel += a.velocidade;
    vDri += a.drible;
    vPas += a.passeCurto;
    vMen += a.mentalidade;
    vTac += a.marcacao;
  }
  const n = sample.length;
  const vel = vVel / n;
  const dri = vDri / n;
  const pas = vPas / n;
  const men = vMen / n;
  const tac = vTac / n;

  const moveLerpMult = 0.88 + (vel / 100) * 0.28 + (dri / 100) * 0.12;
  const carrierLerpBoostAdd = (dri / 100) * 0.06 + (vel / 100) * 0.04;
  const ballPullMult = 0.92 + (pas / 100) * 0.22;
  const microNoiseMult = 1.15 - (men / 100) * 0.35;
  const minSpacingAdd = (tac / 100) * 2.2 + 0.6;

  return {
    moveLerpMult: Math.min(1.35, Math.max(0.82, moveLerpMult)),
    carrierLerpBoostAdd: Math.min(0.12, Math.max(0, carrierLerpBoostAdd)),
    ballPullMult: Math.min(1.28, Math.max(0.85, ballPullMult)),
    microNoiseMult: Math.min(1.2, Math.max(0.55, microNoiseMult)),
    minSpacingAdd: Math.min(4.5, Math.max(0, minSpacingAdd)),
  };
}
