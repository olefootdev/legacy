/**
 * Escolhe quem carrega a bola num tick. Substitui o antigo `nearestToBall`
 * (que viciava o mesmo atacante por minutos seguidos).
 *
 * Combina 4 sinais:
 *   1. Zona da bola × papel natural (attack/mid/def/gk)
 *   2. Atributos individuais relevantes pra zona
 *   3. Proximidade da bola
 *   4. Anti-repeat: portador do tick anterior tem peso reduzido
 *
 * Resultado é estocástico — a soma dos pesos é rolada com `rng` (default Math.random).
 */

import type { PitchPlayerState } from './types';

export type FieldZone = 'def' | 'mid' | 'att';

/** ballX 0–100. Home ataca pra +X; away é espelhado (campo do away começa em 100). */
export function zoneFromBallXForSide(ballX: number, side: 'home' | 'away'): FieldZone {
  const x = side === 'home' ? ballX : 100 - ballX;
  if (x < 34) return 'def';
  if (x < 67) return 'mid';
  return 'att';
}

const ROLE_WEIGHTS_BY_ZONE: Record<FieldZone, Record<PitchPlayerState['role'], number>> = {
  att: { gk: 0.05, def: 0.35, mid: 1.6, attack: 3.0 },
  mid: { gk: 0.08, def: 1.2, mid: 3.0, attack: 1.6 },
  def: { gk: 1.5, def: 3.0, mid: 1.6, attack: 0.4 },
};

function attrBiasForZone(p: PitchPlayerState, zone: FieldZone): number {
  const a = p.attributes;
  if (!a) return 1;
  let raw = 50;
  if (zone === 'att') {
    raw = a.finalizacao * 0.6 + a.velocidade * 0.4;
  } else if (zone === 'mid') {
    raw = a.passeCurto * 0.45 + a.passeLongo * 0.25 + a.drible * 0.30;
  } else {
    raw = a.marcacao * 0.55 + a.fisico * 0.45;
  }
  // 30 → 0.78, 60 → 1.05, 90 → 1.35
  return Math.max(0.7, Math.min(1.4, 0.78 + ((raw - 30) / 60) * 0.55));
}

function proximityBias(p: PitchPlayerState, ball: { x: number; y: number }): number {
  const d = Math.hypot(p.x - ball.x, p.y - ball.y);
  return Math.max(0.4, 1.5 - d / 60);
}

function fatigueBias(p: PitchPlayerState): number {
  if (p.fatigue <= 30) return 1;
  if (p.fatigue >= 85) return 0.5;
  return 1 - ((p.fatigue - 30) / 55) * 0.5;
}

export interface PickCarrierOpts {
  players: PitchPlayerState[];
  ball: { x: number; y: number };
  side: 'home' | 'away';
  /** Quem carregou no tick anterior — penaliza pra forçar rotação. */
  prevCarrierId?: string;
  /** RNG injetável pra testes. Default Math.random(). */
  rng?: number;
}

export function pickBallCarrier(opts: PickCarrierOpts): PitchPlayerState | undefined {
  const { players, ball, side, prevCarrierId } = opts;
  if (players.length === 0) return undefined;
  const rng = opts.rng ?? Math.random();
  const zone = zoneFromBallXForSide(ball.x, side);
  const roleWeights = ROLE_WEIGHTS_BY_ZONE[zone];

  let total = 0;
  const weights: Array<{ p: PitchPlayerState; w: number }> = [];
  for (const p of players) {
    let w = roleWeights[p.role] ?? 1;
    w *= attrBiasForZone(p, zone);
    w *= proximityBias(p, ball);
    w *= fatigueBias(p);
    if (p.playerId === prevCarrierId) w *= 0.32;
    w = Math.max(0.001, w);
    weights.push({ p, w });
    total += w;
  }

  let t = rng * total;
  for (const { p, w } of weights) {
    t -= w;
    if (t <= 0) return p;
  }
  return weights[weights.length - 1]!.p;
}
