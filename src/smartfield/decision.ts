/**
 * Motor único de decisão posicional do SmartField.
 *
 * Cada jogador, por tick, consulta `getBestAction(player, all, side, ctx)` e
 * recebe uma `Decision` tipada (action + confidence + reason + target). A
 * hierarquia de zonas decide:
 *
 *   goalmouth > six_yard > box > creation > press > build_up > recovery
 *
 * Bias por macro-zona em `ZONE_BIAS` é a única fonte de verdade — handlers
 * (skills, cobranças, eventos) chamam `biasFor(zone)` em vez de espalhar
 * pesos pelos arquivos.
 */

import type { ZoneInfo } from '@/match/spatialZones';
import {
  isBox,
  isSixYard,
  isGoalmouth,
  isCreationZone,
  isPressZone,
  isBuildUpZone,
  isRecoveryZone,
  isFinalThird,
  isMidThird,
  isWing,
  isHalfspace,
  laneOf,
} from '@/match/spatialZones';
import { getAwarenessContext, distance2D, type AwarePlayer } from '@/smartfield/awareness';

// ── Bias por macro-zona ───────────────────────────────────────────

export interface ZoneBiasEntry {
  shoot?: number;
  dribble?: number;
  cross?: number;
  halfspace?: number;
  mustShootIfFree?: boolean;
}

export const ZONE_BIAS: Record<string, ZoneBiasEntry> = {
  attacking_center: { shoot: 0.4, dribble: 0.1, cross: 0.0, mustShootIfFree: true },
  attacking_left_halfspace: { shoot: 0.1, dribble: 0.2, cross: 0.1, halfspace: 0.3 },
  attacking_right_halfspace: { shoot: 0.1, dribble: 0.2, cross: 0.1, halfspace: 0.3 },
  attacking_left_wing: { shoot: -0.2, dribble: 0.1, cross: 0.4 },
  attacking_right_wing: { shoot: -0.2, dribble: 0.1, cross: 0.4 },
};

export function biasFor(z: ZoneInfo): ZoneBiasEntry {
  return ZONE_BIAS[z.macro ?? ''] ?? {};
}

// ── Decision API ──────────────────────────────────────────────────

export type ActionKind =
  | 'SHOOT'
  | 'CROSS'
  | 'PASS'
  | 'DRIBBLE'
  | 'PRESS'
  | 'MID_BLOCK'
  | 'CLEAR'
  | 'HOLD'
  | 'RECOVER_POSITION'
  | 'FREE_KICK_DIRECT';

export interface Decision {
  action: ActionKind;
  confidence: number;
  reason: string;
  target?: AwarePlayer;
  /** Delta a aplicar no xG/triggerChance quando aplicável. */
  shootBias?: number;
}

export interface DecisionContext {
  hasBall: boolean;
  isFreeKick: boolean;
  ballCarrier?: AwarePlayer;
}

export function getBestAction(
  player: AwarePlayer,
  allPlayers: AwarePlayer[],
  side: 'home' | 'away',
  ctx: DecisionContext,
): Decision {
  const aw = getAwarenessContext(player, allPlayers, side);
  const z = aw.ballZoneInfo;
  const bias = biasFor(z);

  // 1. Boca do gol → empurrar
  if (isGoalmouth(z) && ctx.hasBall) {
    return { action: 'SHOOT', confidence: 0.95, reason: `${z.subzone} — boca do gol` };
  }
  // 2. Pequena área → finalizar
  if (isSixYard(z) && ctx.hasBall) {
    return { action: 'SHOOT', confidence: 0.9, reason: `${z.subzone} — pequena área` };
  }
  // 3. Falta na grande área → chute direto / pênalti
  if (ctx.isFreeKick && isBox(z)) {
    return {
      action: 'FREE_KICK_DIRECT',
      confidence: 0.85,
      shootBias: 0.3,
      reason: `Falta em ${z.subzone}`,
    };
  }
  // 4. Grande área + livre → finalizar
  if (isBox(z) && ctx.hasBall && aw.pressureLevel < 0.7) {
    return {
      action: 'SHOOT',
      confidence: 0.75 + (bias.shoot ?? 0),
      reason: `${z.macro} — área livre`,
    };
  }
  // 5. Falta no terço de ataque < 25m do gol
  if (ctx.isFreeKick && isFinalThird(z) && aw.distanceToGoalM < 25) {
    return {
      action: 'FREE_KICK_DIRECT',
      confidence: 0.7,
      reason: `Falta a ${aw.distanceToGoalM.toFixed(1)}m`,
    };
  }
  // 6. Halfspace de ataque + livre → diagonal ao gol
  if (isHalfspace(z) && isFinalThird(z) && aw.hasClearShot && ctx.hasBall) {
    return {
      action: 'SHOOT',
      confidence: 0.6 + (bias.halfspace ?? 0.3),
      reason: 'Halfspace ataque — diagonal',
    };
  }
  // 7. Zona de criação → criar para área
  if (isCreationZone(z) && ctx.hasBall) {
    const lane = laneOf(z);
    const targetInBox = aw.availableTeammates.find((t) => isBox(t.zone));
    if (lane !== 'center' && targetInBox) {
      return {
        action: 'CROSS',
        target: targetInBox,
        confidence: 0.75,
        reason: `creation_${lane} → cruzamento`,
      };
    }
    if (targetInBox) {
      return {
        action: 'PASS',
        target: targetInBox,
        confidence: 0.8,
        reason: 'creation_center → passe na área',
      };
    }
    return { action: 'SHOOT', confidence: 0.5, reason: 'creation — tentativa' };
  }
  // 8. Asa de ataque → cruzar
  if (isWing(z) && isFinalThird(z) && ctx.hasBall) {
    const targetInBox = aw.availableTeammates.find((t) => isBox(t.zone));
    if (targetInBox) {
      return {
        action: 'CROSS',
        target: targetInBox,
        confidence: 0.7 + (bias.cross ?? 0),
        reason: `${z.macro} → cruzamento`,
      };
    }
  }
  // 9. Pressing → pressionar carrier (mas se portador tem 3+ aliados perto, recua para mid-block)
  if (isPressZone(z) && !ctx.hasBall && ctx.ballCarrier) {
    const carrier = ctx.ballCarrier;
    const carrierMatesNear = allPlayers.filter(
      (q) => q.team === carrier.team && q.playerId !== carrier.playerId
        && distance2D(q.x, q.y, carrier.x, carrier.y) < 6,
    ).length;
    if (carrierMatesNear >= 3) {
      return { action: 'MID_BLOCK', confidence: 0.7, reason: 'opp_overload_local' };
    }
    return {
      action: 'PRESS',
      target: ctx.ballCarrier,
      confidence: 0.75,
      reason: `${z.subzone} — pressing`,
    };
  }
  // 10. Build-up → passe seguro
  if (isBuildUpZone(z) && ctx.hasBall && aw.bestPassOption) {
    return {
      action: 'PASS',
      target: aw.bestPassOption,
      confidence: 0.8,
      reason: `${z.subzone} — construção`,
    };
  }
  // 11. Recovery sem bola → recuperar posição
  if (isRecoveryZone(z) && !ctx.hasBall) {
    return { action: 'RECOVER_POSITION', confidence: 0.85, reason: `${z.subzone}` };
  }
  // 12. Halfspace de meio → diagonal pro ataque
  if (isHalfspace(z) && isMidThird(z) && ctx.hasBall) {
    const forward = aw.availableTeammates.find((t) => isFinalThird(t.zone));
    if (forward) {
      return {
        action: 'PASS',
        target: forward,
        confidence: 0.7,
        reason: `${z.macro} → diagonal pro ataque`,
      };
    }
  }
  // 13. Passe pra melhor opção
  if (ctx.hasBall && aw.bestPassOption && aw.pressureLevel < 0.8) {
    return {
      action: 'PASS',
      target: aw.bestPassOption,
      confidence: aw.bestPassOption.passQuality,
      reason: `${z.macro} → melhor passe`,
    };
  }
  // 14. Pressão máxima → afastar
  if (ctx.hasBall && aw.pressureLevel >= 0.8) {
    return { action: 'CLEAR', confidence: 0.6, reason: `Pressão máxima em ${z.macro}` };
  }

  return { action: 'HOLD', confidence: 0.3, reason: `${z.macro} — aguardar` };
}
