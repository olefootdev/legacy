import type { DecisionContext, OffBallAction, PrethinkingIntent, PrethinkingSpeed, PrethinkingState } from './types';
import { applyPhase1HintToPrethinkingIntent } from '@/gamespirit/gameSpiritPhase1PrethinkingMerge';
import type { DecisionActionId } from './collectiveIndividualDecision';
import { buildContextReading, identifyFieldZone, scanPressure } from './ContextScanner';
import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';
import { pick01ForDecision } from './decisionRng';

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

const INTENT_TTL: Record<PrethinkingSpeed, number> = {
  fast: 0.4,
  normal: 0.52,
  slow: 0.66,
};

const BASE_REFRESH: Record<PrethinkingSpeed, number> = {
  fast: 0.1,
  normal: 0.21,
  slow: 0.36,
};

/** Distância ao adversário mais próximo (m). */
function nearestOpponentDist(ctx: DecisionContext): number {
  let min = Infinity;
  for (const o of ctx.opponents) {
    const d = Math.hypot(o.x - ctx.self.x, o.z - ctx.self.z);
    if (d < min) min = d;
  }
  return Number.isFinite(min) ? min : 22;
}

/** 0–1: quão “no lance” o jogador está → atualiza intenção mais vezes. */
export function prethinkingAttention01(ctx: DecisionContext): number {
  const d = Math.hypot(ctx.ballX - ctx.self.x, ctx.ballZ - ctx.self.z);
  let a = 0;
  if (d < 16) a += 0.38;
  else if (d < 26) a += 0.22;
  else if (d < 38) a += 0.1;

  if (ctx.isReceiver) a += 0.36;
  if (ctx.isCarrier) a += 0.22;
  if (ctx.threatLevel > 0.48) a += 0.14;

  const zone = identifyFieldZone(ctx.self.x, ctx.attackDir);
  if (zone === 'opp_box' || zone === 'own_box') a += 0.14;
  if (zone === 'att_third' || zone === 'def_third') a += 0.08;

  const nd = nearestOpponentDist(ctx);
  if (nd < 7) a += 0.12;
  else if (nd < 11) a += 0.06;

  if (ctx.threatTrend === 'rising' && d > 10 && d < 28) a += 0.08;

  if (ctx.ballFlightProgress > 0.12 && ctx.ballFlightProgress < 0.88) a += 0.06;

  const dSlot = Math.hypot(ctx.slotX - ctx.self.x, ctx.slotZ - ctx.self.z);
  const ballNearSlot = Math.hypot(ctx.ballX - ctx.slotX, ctx.ballZ - ctx.slotZ);
  if (dSlot < 14 && ballNearSlot < 22) a += 0.1;
  else if (dSlot < 20 && ballNearSlot < 30) a += 0.05;

  return clamp(a, 0, 1);
}

export function prethinkingRefreshSeconds(speed: PrethinkingSpeed, attention01: number): number {
  const base = BASE_REFRESH[speed];
  return base * (1.85 - attention01 * 1.05);
}

/**
 * Velocidade cognitiva: mentalidade, técnica (passe/drible), tático, confiança, pressão, fadiga.
 * GameSpirit só empurra ligeiramente (casa com momentum → home um pouco mais `fast`).
 */
export function computePrethinkingSpeed(ctx: DecisionContext): PrethinkingSpeed {
  const mental = (ctx.self.mentalidade ?? 70) / 100;
  const tatico = (ctx.self.tatico ?? 70) / 100;
  const tech =
    ((ctx.self.drible ?? 65) + (ctx.self.passe ?? ctx.self.passeCurto ?? 65)) / 200;
  const conf = (ctx.self.confianca ?? 70) / 100;
  /** Stamina alta = fresco; baixa = cansado → prethinking mais lento. */
  const fatigue01 =
    ctx.stamina != null ? clamp((72 - ctx.stamina) / 72, 0, 1) : 0.22;

  const pr = scanPressure(ctx.self, ctx.opponents);
  let pressureCost = 0;
  if (pr.intensity === 'extreme') pressureCost = 0.24;
  else if (pr.intensity === 'high') pressureCost = 0.14;
  else if (pr.intensity === 'medium') pressureCost = 0.06;

  let score =
    mental * 0.3
    + tatico * 0.22
    + tech * 0.2
    + conf * 0.18
    - pressureCost
    - fatigue01 * 0.14;

  const m = ctx.gameSpiritHomeMomentum01;
  if (m != null) {
    const c = clamp(m, 0.02, 0.98);
    if (ctx.self.side === 'home') score += (c - 0.5) * 0.1;
    else score -= (c - 0.5) * 0.06;
  }

  if (score >= 0.63) return 'fast';
  if (score <= 0.37) return 'slow';
  return 'normal';
}

export function invalidatePrethinking(state: PrethinkingState, ctx: DecisionContext, simTime: number): boolean {
  if (simTime > state.validUntil) return true;
  if (ctx.possession !== state.possessionSide) return true;
  if (ctx.carrierId !== state.carrierId) return true;
  if (ctx.isReceiver !== state.snapIsReceiver || ctx.isCarrier !== state.snapIsCarrier) return true;

  if (Math.abs(ctx.threatLevel - state.threatLevel01) > 0.2) return true;

  const drift = Math.hypot(ctx.self.x - state.anchorX, ctx.self.z - state.anchorZ);
  if (drift > 15) return true;

  const att = prethinkingAttention01(ctx);
  const ballMove = Math.hypot(ctx.ballX - state.ballX, ctx.ballZ - state.ballZ);
  const ballThresh = att > 0.55 ? 4.2 : att > 0.32 ? 5.2 : 6;
  if (ballMove > ballThresh) return true;

  const pr = scanPressure(ctx.self, ctx.opponents);
  if (pr.intensity !== state.pressureIntensity) return true;

  const nd = nearestOpponentDist(ctx);
  if (Math.abs(nd - state.nearestOppDist) > 3.2) return true;

  return false;
}

function applySpiritIntentNudge(
  ctx: DecisionContext,
  intent: PrethinkingIntent,
  teamHasBall: boolean,
): PrethinkingIntent {
  const m = ctx.gameSpiritHomeMomentum01;
  if (m == null || intent !== 'encaixe') return intent;
  const c = clamp(m, 0.02, 0.98);
  if (ctx.self.side === 'home' && teamHasBall && !ctx.isCarrier && c > 0.68 && pick01ForDecision(ctx) < 0.22) {
    return 'atacar_espaco';
  }
  if (ctx.self.side === 'away' && !teamHasBall && c > 0.68 && pick01ForDecision(ctx) < 0.18) {
    return 'cobertura_defensiva';
  }
  return intent;
}

/** Escolhe intenção a partir da leitura (bola, colegas, adversários, espaço via `buildContextReading`). */
function pickPrethinkingIntent(ctx: DecisionContext): PrethinkingIntent {
  const teamHasBall = ctx.possession === ctx.self.side;
  const reading = buildContextReading(ctx);
  const dBall = Math.hypot(ctx.ballX - ctx.self.x, ctx.ballZ - ctx.self.z);
  const cog = ctx.cognitiveArchetype;

  if (ctx.isReceiver) {
    const pr = reading.pressure;
    if (pr.intensity === 'extreme' || (pr.intensity === 'high' && pr.nearestOpponentDist < 4.2)) {
      return pr.nearestOpponentDist < 2.9 ? 'proteger_bola' : 'passe_rapido';
    }
    if (
      reading.bestTeammate
      && reading.bestTeammate.isOpen
      && reading.bestTeammate.closestOppDist > 4.8
      && pick01ForDecision(ctx) < 0.55 + ctx.profile.firstTouchPlay * 0.2
    ) {
      return 'passe_rapido';
    }
    return 'receber_e_girar';
  }

  if (teamHasBall && ctx.isCarrier) {
    const inFinal = reading.fieldZone === 'opp_box' || reading.fieldZone === 'att_third';
    if (inFinal && reading.distToGoal < 28 && reading.lineOfSightScore > 0.48) return 'finalizar_rapido';
    if (reading.pressure.intensity === 'high' || reading.pressure.intensity === 'extreme') return 'passe_rapido';
    return 'atacar_espaco';
  }

  if (teamHasBall) {
    const inFinal = reading.fieldZone === 'opp_box' || reading.fieldZone === 'att_third';
    if (ctx.self.role === 'attack' || cog === 'finalizador') {
      if (inFinal && reading.distToGoal < 26 && reading.lineOfSightScore > 0.44) return 'finalizar_rapido';
      return 'atacar_espaco';
    }
    if (ctx.self.role === 'mid') {
      if (
        dBall < 20
        && (cog === 'criador' || ctx.profile.archetype === 'playmaker' || ctx.profile.archetype === 'creative')
      ) {
        return pick01ForDecision(ctx) < 0.42 ? 'tabela' : 'passe_rapido';
      }
      return dBall < 24 ? 'passe_rapido' : 'atacar_espaco';
    }
    if (dBall < 14 && reading.teamPhase === 'attack') return 'atacar_espaco';
    return 'encaixe';
  }

  if (!ctx.carrierId && ctx.possession && dBall < 13) {
    return 'disputar_rebote';
  }

  if (ctx.carrierId && dBall < 11) {
    const destroyer =
      ctx.profile.archetype === 'destroyer'
      || ctx.profile.archetype === 'anchor'
      || cog === 'destruidor';
    if (destroyer && reading.fieldZone !== 'opp_box') {
      return pick01ForDecision(ctx) < 0.48 ? 'matar_jogada' : 'pressionar_portador';
    }
    return 'pressionar_portador';
  }

  if (ctx.carrierId && dBall < 28) {
    if (ctx.self.role === 'def' && reading.progressToGoal < 0.5) return 'interceptar_linha';
    return 'pressionar_portador';
  }

  if (ctx.self.role === 'def' || ctx.self.role === 'mid') {
    return 'cobertura_defensiva';
  }

  return 'encaixe';
}

function softenRepeatedIntent(
  ctx: DecisionContext,
  intent: PrethinkingIntent,
  previousIntent: PrethinkingIntent | null,
): PrethinkingIntent {
  if (!previousIntent || intent !== previousIntent || ctx.isReceiver) return intent;
  const att = prethinkingAttention01(ctx);
  if (att >= 0.38 || pick01ForDecision(ctx) <= 0.57) return intent;
  if (intent === 'proteger_bola' || intent === 'passe_rapido' || intent === 'pressionar_portador' || intent === 'matar_jogada') {
    return intent;
  }
  return 'encaixe';
}

export function buildPrethinkingState(
  ctx: DecisionContext,
  simTime: number,
  speed: PrethinkingSpeed,
  previousIntent: PrethinkingIntent | null,
): PrethinkingState | null {
  if (ctx.self.role === 'gk') return null;

  const pr = scanPressure(ctx.self, ctx.opponents);
  const teamHasBall = ctx.possession === ctx.self.side;
  let intent = pickPrethinkingIntent(ctx);
  intent = applySpiritIntentNudge(ctx, intent, teamHasBall);
  intent = softenRepeatedIntent(ctx, intent, previousIntent);
  if (ctx.gameSpiritPhase1Hint) {
    intent = applyPhase1HintToPrethinkingIntent(intent, ctx, ctx.gameSpiritPhase1Hint);
  }

  const conviction01 = clamp(
    (ctx.self.mentalidade ?? 70) / 100 * 0.38
      + (ctx.profile.composure ?? 0.7) * 0.32
      + (ctx.profile.vision ?? 0.65) * 0.3,
    0.26,
    0.95,
  );

  return {
    prethinkingIntent: intent,
    speed,
    validUntil: simTime + INTENT_TTL[speed],
    possessionSide: ctx.possession ?? null,
    carrierId: ctx.carrierId,
    anchorX: ctx.self.x,
    anchorZ: ctx.self.z,
    ballX: ctx.ballX,
    ballZ: ctx.ballZ,
    pressureIntensity: pr.intensity,
    nearestOppDist: nearestOpponentDist(ctx),
    conviction01,
    snapIsReceiver: ctx.isReceiver,
    snapIsCarrier: ctx.isCarrier,
    threatLevel01: ctx.threatLevel,
  };
}

/** Penalidade extra na probabilidade de domínio limpo (execução imperfeita em `slow`). */
export function prethinkingReceptionSuccessPenalty(ctx: DecisionContext): number {
  const s = ctx.prethinking;
  if (!s || s.speed !== 'slow') return 0;
  return 0.035 + s.conviction01 * 0.025;
}

/** Encurta deliberação quando a intenção já “encaixa” no lance; `fast` reduz mais. */
export function prethinkingDeliberationFactor(ctx: DecisionContext): number {
  const s = ctx.prethinking;
  if (!s) return 1;
  const c = s.conviction01;
  let f = 1;
  switch (s.prethinkingIntent) {
    case 'passe_rapido':
    case 'receber_e_girar':
      f *= 1 - c * 0.15;
      break;
    case 'finalizar_rapido':
      f *= 1 - c * 0.12;
      break;
    case 'proteger_bola':
      f *= 1 - c * 0.08;
      break;
    case 'atacar_espaco':
    case 'tabela':
      f *= 1 - c * 0.1;
      break;
    case 'finalizar_rapido':
      f *= 1 - c * 0.11;
      break;
    default:
      break;
  }
  if (s.speed === 'fast') f *= 0.92;
  else if (s.speed === 'slow') f *= 1.08;
  return clamp(f, 0.72, 1.12);
}

export function prethinkingScanDelayFactor(ctx: DecisionContext): number {
  const s = ctx.prethinking;
  if (!s || !ctx.isCarrier) return 1;
  const c = s.conviction01;
  let f = 1;
  if (
    s.prethinkingIntent === 'atacar_espaco'
    || s.prethinkingIntent === 'finalizar_rapido'
    || s.prethinkingIntent === 'passe_rapido'
    || s.prethinkingIntent === 'tabela'
  ) {
    f *= 1 - c * 0.11;
  }
  if (s.speed === 'fast') f *= 0.94;
  else if (s.speed === 'slow') f *= 1.06;
  return clamp(f, 0.78, 1.1);
}

/** Base da ação com bola: inclinação somada a `macroTilt` (não substitui o coletivo). */
export function prethinkingMacroTilt(ctx: DecisionContext): Partial<Record<DecisionActionId, number>> {
  const s = ctx.prethinking;
  if (!s) return {};
  const c = s.conviction01;
  const i = s.prethinkingIntent;
  switch (i) {
    case 'passe_rapido':
      return {
        pass_progressive: c * 0.5,
        pass_safe: c * 0.12,
        carry: -c * 0.18,
        shoot: -c * 0.06,
      };
    case 'receber_e_girar':
      return {
        pass_progressive: c * 0.48,
        carry: c * 0.14,
        pass_safe: -c * 0.14,
      };
    case 'proteger_bola':
      return {
        pass_safe: c * 0.28,
        carry: c * 0.1,
        pass_progressive: -c * 0.2,
        shoot: -c * 0.12,
        dribble_risk: -c * 0.08,
      };
    case 'atacar_espaco':
      return {
        carry: c * 0.22,
        dribble_risk: c * 0.18,
        pass_progressive: c * 0.2,
        pass_safe: -c * 0.1,
      };
    case 'finalizar_rapido':
      return {
        shoot: c * 0.52,
        dribble_risk: c * 0.12,
        pass_safe: -c * 0.12,
      };
    case 'tabela':
      return {
        pass_progressive: c * 0.42,
        carry: c * 0.16,
        pass_long: c * 0.08,
        pass_safe: -c * 0.1,
      };
    case 'disputar_rebote':
      return {
        carry: c * 0.2,
        dribble_risk: c * 0.12,
        pass_progressive: c * 0.1,
        pass_safe: -c * 0.08,
      };
    case 'cobertura_defensiva':
    case 'interceptar_linha':
      return {
        pass_safe: c * 0.14,
        carry: -c * 0.06,
        shoot: -c * 0.1,
      };
    default:
      return {};
  }
}

export function applyPrethinkingToOffBall(ctx: DecisionContext, action: OffBallAction): OffBallAction {
  const s = ctx.prethinking;
  if (!s) return action;
  const i = s.prethinkingIntent;
  const c = s.conviction01;
  const teamHasBall = ctx.possession === ctx.self.side;

  if (teamHasBall && !ctx.isCarrier && 'targetX' in action) {
    if (i === 'atacar_espaco' || i === 'finalizar_rapido') {
      const ad = ctx.attackDir;
      const side = ctx.self.z < ctx.ballZ ? -1 : 1;
      return {
        ...action,
        targetX: clamp(action.targetX + ad * (3.2 + c * 5) * 0.4, 3, FIELD_LENGTH - 3),
        targetZ: clamp(action.targetZ + side * c * 3.2, 3, FIELD_WIDTH - 3),
      };
    }
  }

  if (!teamHasBall && ctx.carrierId) {
    const d = Math.hypot(ctx.ballX - ctx.self.x, ctx.ballZ - ctx.self.z);

    if (i === 'pressionar_portador' || i === 'matar_jogada') {
      const pressR = i === 'matar_jogada' ? 14 + c * 10 : 12 + c * 8;
      if (d < pressR && pick01ForDecision(ctx) < 0.45 + c * 0.26) {
        return { type: 'press_carrier', targetX: ctx.ballX, targetZ: ctx.ballZ };
      }
      if ('targetX' in action && (action.type === 'delay_press' || action.type === 'cover_central' || action.type === 'mark_zone')) {
        const t = (i === 'matar_jogada' ? 0.26 : 0.18) + c * 0.2;
        return {
          ...action,
          targetX: lerp(action.targetX, ctx.ballX, t),
          targetZ: lerp(action.targetZ, ctx.ballZ, t),
        };
      }
    }

    if (i === 'interceptar_linha' && 'targetX' in action) {
      const t = 0.12 + c * 0.14;
      return {
        ...action,
        targetX: lerp(action.targetX, (ctx.self.x + ctx.ballX) / 2, t),
        targetZ: lerp(action.targetZ, (ctx.self.z + ctx.ballZ) / 2, t),
      };
    }

    if (i === 'cobertura_defensiva' && 'targetX' in action && action.type !== 'press_carrier') {
      return {
        ...action,
        targetX: lerp(action.targetX, ctx.slotX, 0.14 + c * 0.12),
        targetZ: lerp(action.targetZ, ctx.slotZ, 0.14 + c * 0.12),
      };
    }

    if (i === 'disputar_rebote' && d < 16 && 'targetX' in action) {
      return {
        ...action,
        targetX: lerp(action.targetX, ctx.ballX, 0.28 + c * 0.18),
        targetZ: lerp(action.targetZ, ctx.ballZ, 0.28 + c * 0.18),
      };
    }
  }

  return action;
}
