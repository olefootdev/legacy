/**
 * Âncora tática viva: alvos de movimento fora da bola são misturados com a posição-base
 * da formação (MatchEngine → slot) para evitar enxame e colapso na bola.
 *
 * Usado apenas em `TacticalSimLoop.executeOffBallAction` — não duplica o motor de decisão.
 * O modo de envolvimento (grelha 12 zonas) ajusta raios sem nova camada de simulação.
 */
import type { TacticalBehaviorProfile, ZoneEngagementMode } from '@/match/tacticalField18';
import { clampToPitch } from './field';

export interface TacticalMovementRadii {
  /** Metros: jogador “no setor” da jogada — participação plena (com teto de desvio à âncora). */
  actionRadius: number;
  /** Metros: faixa de apoio — deslocamento moderado em direção ao alvo desejado. */
  supportRadius: number;
  /** 0–1: fora do support, quanto do caminho para o desejado se descarta a favor da âncora. */
  returnBias: number;
  /** Metros: teto de afastamento da âncora quando dentro do actionRadius. */
  maxDeviationInAction: number;
}

export function tacticalRadiiFor(role: string, slotId: string): TacticalMovementRadii {
  const sid = slotId.toLowerCase();
  if (role === 'gk' || sid === 'gol') {
    return { actionRadius: 11, supportRadius: 15, returnBias: 0.92, maxDeviationInAction: 9 };
  }
  if (sid.includes('zag')) {
    return { actionRadius: 17, supportRadius: 28, returnBias: 0.84, maxDeviationInAction: 13 };
  }
  if (sid === 'le' || sid === 'ld') {
    return { actionRadius: 19, supportRadius: 30, returnBias: 0.78, maxDeviationInAction: 15 };
  }
  if (sid === 'vol') {
    return { actionRadius: 21, supportRadius: 32, returnBias: 0.72, maxDeviationInAction: 16 };
  }
  if (sid.startsWith('mc')) {
    return { actionRadius: 23, supportRadius: 36, returnBias: 0.64, maxDeviationInAction: 17 };
  }
  if (sid === 'pe' || sid === 'pd') {
    return { actionRadius: 25, supportRadius: 38, returnBias: 0.56, maxDeviationInAction: 19 };
  }
  if (sid === 'ata') {
    return { actionRadius: 27, supportRadius: 40, returnBias: 0.5, maxDeviationInAction: 21 };
  }
  if (role === 'def') {
    return { actionRadius: 17, supportRadius: 28, returnBias: 0.82, maxDeviationInAction: 13 };
  }
  if (role === 'mid') {
    return { actionRadius: 23, supportRadius: 36, returnBias: 0.62, maxDeviationInAction: 17 };
  }
  if (role === 'attack') {
    return { actionRadius: 27, supportRadius: 40, returnBias: 0.52, maxDeviationInAction: 21 };
  }
  return { actionRadius: 21, supportRadius: 34, returnBias: 0.68, maxDeviationInAction: 16 };
}

/** Com posse: apoiantes podem estender ligeiramente o setor de ação. */
export function scaleRadiiForTeamPossession(
  r: TacticalMovementRadii,
  teamHasBall: boolean,
): TacticalMovementRadii {
  if (!teamHasBall) return r;
  return {
    actionRadius: r.actionRadius * 1.08,
    supportRadius: r.supportRadius * 1.05,
    returnBias: r.returnBias * 0.96,
    maxDeviationInAction: r.maxDeviationInAction * 1.06,
  };
}

/** Ajuste de raios: zona da bola (15 zonas) + perfil de papel (linha / função). */
export function scaleRadiiForZoneEngagement(
  r: TacticalMovementRadii,
  mode: ZoneEngagementMode,
  profile?: TacticalBehaviorProfile,
): TacticalMovementRadii {
  let out: TacticalMovementRadii;
  switch (mode) {
    case 'engage':
      out = {
        actionRadius: r.actionRadius * 1.14,
        supportRadius: r.supportRadius * 1.1,
        returnBias: r.returnBias * 0.86,
        maxDeviationInAction: r.maxDeviationInAction * 1.2,
      };
      break;
    case 'support':
      out = {
        actionRadius: r.actionRadius * 0.94,
        supportRadius: r.supportRadius * 1.04,
        returnBias: r.returnBias * 0.95,
        maxDeviationInAction: r.maxDeviationInAction * 0.9,
      };
      break;
    case 'structure':
      out = {
        actionRadius: r.actionRadius * 0.68,
        supportRadius: r.supportRadius * 0.74,
        returnBias: Math.min(0.97, r.returnBias * 1.24),
        maxDeviationInAction: r.maxDeviationInAction * 0.55,
      };
      break;
  }

  if (!profile) return out;

  switch (profile) {
    case 'gk':
      if (mode === 'structure') {
        out = {
          ...out,
          returnBias: Math.min(0.98, out.returnBias * 1.1),
          maxDeviationInAction: out.maxDeviationInAction * 0.78,
          actionRadius: out.actionRadius * 0.88,
        };
      }
      break;
    case 'center_back':
      if (mode === 'structure') {
        out = {
          ...out,
          returnBias: Math.min(0.96, out.returnBias * 1.08),
          maxDeviationInAction: out.maxDeviationInAction * 0.8,
          actionRadius: out.actionRadius * 0.9,
        };
      }
      break;
    case 'fullback':
      if (mode === 'structure') {
        out = {
          ...out,
          returnBias: Math.min(0.96, out.returnBias * 1.04),
          maxDeviationInAction: out.maxDeviationInAction * 0.86,
        };
      }
      break;
    case 'midfield':
      if (mode === 'support') {
        out = {
          ...out,
          supportRadius: out.supportRadius * 1.06,
          returnBias: out.returnBias * 0.96,
        };
      }
      break;
    case 'winger':
    case 'striker':
    case 'shadow':
      if (mode === 'engage') {
        out = {
          ...out,
          actionRadius: out.actionRadius * 1.06,
          maxDeviationInAction: out.maxDeviationInAction * 1.08,
          returnBias: out.returnBias * 0.93,
        };
      }
      break;
  }

  return out;
}

function clampPullFromAnchor(
  desired: { x: number; z: number },
  anchor: { x: number; z: number },
  maxDist: number,
): { x: number; z: number } {
  const dx = desired.x - anchor.x;
  const dz = desired.z - anchor.z;
  const d = Math.hypot(dx, dz);
  if (d <= maxDist || d < 0.01) return clampToPitch(desired.x, desired.z, 1);
  const s = maxDist / d;
  return clampToPitch(anchor.x + dx * s, anchor.z + dz * s, 1);
}

/**
 * @param desired — alvo vindo da decisão off-ball (passe, apoio, pressão…)
 * @param anchor — posição-base dinâmica do slot (MatchEngine + clamp de papel)
 * @param self — posição atual do jogador
 * @param ball — posição da bola
 */
export function blendOffBallDestination(
  desired: { x: number; z: number },
  anchor: { x: number; z: number },
  self: { x: number; z: number },
  ball: { x: number; z: number },
  radii: TacticalMovementRadii,
  opts?: { isPressingCarrier?: boolean },
): { x: number; z: number } {
  let r = radii;
  if (opts?.isPressingCarrier) {
    r = {
      actionRadius: radii.actionRadius + 12,
      supportRadius: radii.supportRadius + 10,
      returnBias: Math.max(0.35, radii.returnBias * 0.88),
      maxDeviationInAction: radii.maxDeviationInAction + 10,
    };
  }

  const dSelfBall = Math.hypot(self.x - ball.x, self.z - ball.z);
  const px = desired.x;
  const pz = desired.z;

  if (dSelfBall <= r.actionRadius) {
    return clampPullFromAnchor({ x: px, z: pz }, anchor, r.maxDeviationInAction);
  }

  if (dSelfBall <= r.supportRadius) {
    const span = r.supportRadius - r.actionRadius;
    const u = span > 0.01 ? (dSelfBall - r.actionRadius) / span : 1;
    const wDesired = 0.62 * (1 - u) + 0.15;
    const bx = anchor.x + (px - anchor.x) * wDesired;
    const bz = anchor.z + (pz - anchor.z) * wDesired;
    return clampToPitch(bx, bz, 1);
  }

  const pull = r.returnBias;
  const bx = anchor.x + (px - anchor.x) * (1 - pull);
  const bz = anchor.z + (pz - anchor.z) * (1 - pull);
  return clampToPitch(bx, bz, 1);
}
