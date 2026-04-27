/**
 * Pontaria tática para UI (seta de visão) e base futura para remates / treinos de precisão.
 * Zagueiros: alta defesa → pontaria de exibição mais baixa; atacantes: o inverso.
 */
import type { PitchPlayerState } from '@/engine/types';
import { FIELD_LENGTH, FIELD_WIDTH, uiPercentToWorld } from '@/simulation/field';
import { hashStringSeed, unitFromParts } from '@/match/seededRng';

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** 0 = péssima pontaria de exibição, 1 = excelente — alinhado a atributos de partida. */
export function tacticalPointingQuality01(p: PitchPlayerState): number {
  const fin = (p.attributes?.finalizacao ?? 56) / 100;
  const mar = (p.attributes?.marcacao ?? 56) / 100;
  const tac = (p.attributes?.tatico ?? 56) / 100;
  const defBlend = (mar + tac) / 2;
  const slot = p.slotId ?? '';
  const forwardSlot = slot === 'ata' || slot === 'pe' || slot === 'pd';
  if (p.role === 'attack' || forwardSlot) {
    return clamp01(0.48 + fin * 0.52);
  }
  if (p.role === 'gk' || slot === 'gol') {
    return clamp01(0.16 + fin * 0.24);
  }
  if (p.role === 'def') {
    return clamp01(0.22 + fin * 0.26 + (1 - defBlend) * 0.14);
  }
  return clamp01(0.34 + fin * 0.36 + (1 - defBlend) * 0.08);
}

/** Erro angular estável (rad) para “spread” de mira fraca — mesmo jogador = mesma offset até mudar seed. */
export function tacticalPointingDisplayJitterRad(playerId: string, quality01: number): number {
  const u = unitFromParts(hashStringSeed(`tactical-aim-display|${playerId}`), ['v2']);
  const maxErr = (1 - clamp01(quality01)) * 0.44;
  return (u - 0.5) * 2 * maxErr;
}

function percentToWorldXY(px: number, py: number): { x: number; z: number } {
  const ux = px >= 0 && px <= 1 ? px * 100 : px;
  const uy = py >= 0 && py <= 1 ? py * 100 : py;
  return uiPercentToWorld(ux, uy);
}

/**
 * Ângulo (rad) no plano XZ, convenção `atan2(vx, vz)` alinhada ao motor / `bodyYaw`.
 */
export function tacticalFallbackLookAngleRad(
  w0: { x: number; z: number },
  ballPercent: { x: number; y: number } | undefined,
  attackDir: 1 | -1,
): number {
  const wBall = ballPercent
    ? percentToWorldXY(ballPercent.x, ballPercent.y)
    : null;
  const gx = attackDir === 1 ? FIELD_LENGTH : 0;
  const gz = FIELD_WIDTH / 2;
  let vx = 0;
  let vz = 0;
  if (wBall) {
    const tbx = wBall.x - w0.x;
    const tbz = wBall.z - w0.z;
    const d = Math.hypot(tbx, tbz) || 1;
    vx += (tbx / d) * 0.82;
    vz += (tbz / d) * 0.82;
  }
  const ngx = gx - w0.x;
  const ngz = gz - w0.z;
  const nd = Math.hypot(ngx, ngz) || 1;
  const goalW = wBall ? 0.18 : 1;
  vx += (ngx / nd) * goalW;
  vz += (ngz / nd) * goalW;
  const len = Math.hypot(vx, vz) || 1;
  return Math.atan2(vx / len, vz / len);
}

export interface VisionArrowEndPercentArgs {
  px: number;
  py: number;
  player: PitchPlayerState;
  ballPercent: { x: number; y: number } | undefined;
  attackDir: 1 | -1;
  /** Comprimento da seta em metros no mundo. */
  lenWorld?: number;
}

/** Extremo da seta em coordenadas % do SVG (0–100), mesma escala que `PitchPlayerState.x/y`. */
export function tacticalVisionArrowEndPercent(args: VisionArrowEndPercentArgs): { x2: number; y2: number } {
  const { px, py, player, ballPercent, attackDir } = args;
  const lenWorld = args.lenWorld ?? 5.2;
  const w0 = percentToWorldXY(px, py);
  const q = tacticalPointingQuality01(player);
  let ang: number;
  if (player.heading !== undefined && Number.isFinite(player.heading)) {
    ang = player.heading + tacticalPointingDisplayJitterRad(player.playerId, q);
  } else {
    ang = tacticalFallbackLookAngleRad(w0, ballPercent, attackDir);
  }
  const lenScale = 0.78 + 0.22 * q;
  const L = lenWorld * lenScale;
  const wx1 = w0.x + L * Math.sin(ang);
  const wz1 = w0.z + L * Math.cos(ang);
  return {
    x2: (wx1 / FIELD_LENGTH) * 100,
    y2: (wz1 / FIELD_WIDTH) * 100,
  };
}
