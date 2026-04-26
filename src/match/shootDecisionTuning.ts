/**
 * Elegibilidade e peso de finalização — evita remates “mortos” por score sempre inferior ao passe.
 */

/**
 * Zona mínima para candidatura a remate.
 * Inclui 'attacking_third' para permitir chutes de fora da área quando há espaço.
 * Jogadores com boa finalização e sem pressão podem chutar de ~25-28m.
 */
export const SHOOT_MIN_ZONE_TAGS = ['opp_box', 'attacking_third'] as const;

/**
 * Raio máximo ao gol (m) para candidatura mesmo fora do `opp_box`.
 * 28m permite chutes de meia-distância (era 22m, muito conservador).
 */
export const SHOOT_MAX_DIST_TO_GOAL_M = 28;

/**
 * Distância mínima para considerar chute de longa distância (fora da área).
 * Chutes entre 22-28m são "long range" e têm xG reduzido mas são permitidos.
 */
export const SHOOT_LONG_RANGE_MIN_DIST = 22;

/** Piso: score(shoot) >= score(pass_safe) * F + epsilon (quando elegível) */
export const SHOOT_SCORE_VS_PASS_SAFE_FACTOR = 0.62;
export const SHOOT_SCORE_FLOOR_EPSILON = 0.16;

/** Pressão: penalidade mínima residual (não anular shoot por pressure) */
export const SHOOT_PRESSURE_PENALTY_CAP = 0.72;

/** Sem tentativa de remate neste intervalo (s de simTime) → forçar elegibilidade agressiva */
export const SHOT_BUDGET_NO_ATTEMPT_SEC = 22;
/** Após forçar, consumir o orçamento (evitar spam) */
export const SHOT_BUDGET_COOLDOWN_AFTER_FORCE_SEC = 8;

/** Bola no terço ofensivo com posse contínua > T → boost de remate */
export const SHOOT_OFFENSIVE_STALL_SEC = 7;

/** Teste de regressão: minutos sim × taxa ≈ mínimo de tentativas esperadas */
export const SHOT_ATTEMPTS_MIN_PER_90MIN_SIM = 8;

/** Harness jogo “natural” (~200 s sim): mínimo de remates (≈2× um patamar fraco ~6–7 em jogo completo escalado). */
/** QA “motor vivo”: contagem mínima de remates em janela longa de sim natural (varia com golos/reinícios). */
export const LIVE_NATURAL_SHOT_ATTEMPTS_MIN = 8;

/** Radius (m) around carrier for counting nearby opponents in xG. */
export const SHOT_CROWD_SCAN_RADIUS_M = 4;
/** Per-opponent xG penalty when shooting from >= SHOT_CROWD_TAPER_DIST_M. */
export const SHOT_CROWD_PEN_FAR = 0.026;
/** Per-opponent xG penalty at dist ~0 (inside small area). */
export const SHOT_CROWD_PEN_CLOSE_MIN = 0.009;
/** Distance (m) to goal below which crowd penalty starts tapering down. */
export const SHOT_CROWD_TAPER_DIST_M = 16;

// ─────────────────────────────────────────────────────────────────
// SmartField integration (zone-aware shoot tuning)
// ─────────────────────────────────────────────────────────────────
//
// Centraliza a consulta SHOOT × zona usando os módulos do SmartField.
// Consumers existentes (`isShootMinEligible`, scoring) podem chamar:
//
//   if (isZoneShootIncompatible(carrier, side)) return false;
//   const mult = shootZoneMultiplier(carrier, homePlayers, side);
//   triggerChance = baseTriggerChance * mult;

import type { PitchPlayerState } from '@/engine/types';
import { zoneAtUI } from '@/match/spatialZones';
import { getAwarenessContext, type AwarePlayer } from '@/smartfield/awareness';
import {
  isSkillCompatibleWithZone,
  zoneMultiplierForSkill,
} from '@/smartfield/skillZoneIntegration';

/**
 * `true` se a zona atual da bola/portador NÃO autoriza skill SHOOT
 * (ex.: meio-campo defensivo, próprio terço). Consumers devem zerar
 * triggerChance e logar reason.
 */
export function isZoneShootIncompatible(
  carrier: PitchPlayerState,
  side: 'home' | 'away',
): { incompatible: boolean; reason?: string } {
  const z = zoneAtUI(carrier.x, carrier.y, side);
  const compat = isSkillCompatibleWithZone('SHOOT', z);
  if (!compat) {
    return { incompatible: true, reason: `SHOOT incompatível com ${z.macro ?? 'zona desconhecida'}` };
  }
  return { incompatible: false };
}

/**
 * Multiplicador zonal a aplicar em `baseTriggerChance` (ou em qualquer
 * score de chute). Aplica `ZONE_BIAS` + ajuste de pressão (focal cone
 * com adversários a < 8u UI).
 *
 * `homePlayers` deve incluir o portador; é convertido pra `AwarePlayer`
 * com team='home'. Se o caller tem o lado adversário em pitch (test2d),
 * inclui também tagado com team='away' pra leitura de pressureLevel.
 */
export function shootZoneMultiplier(
  carrier: PitchPlayerState,
  homePlayers: PitchPlayerState[],
  side: 'home' | 'away',
  awayPlayers: PitchPlayerState[] = [],
): number {
  const carrierAware: AwarePlayer = { ...carrier, team: side };
  const tagged: AwarePlayer[] = [
    ...homePlayers.map((p): AwarePlayer => ({ ...p, team: side })),
    ...awayPlayers.map(
      (p): AwarePlayer => ({ ...p, team: side === 'home' ? 'away' : 'home' }),
    ),
  ];
  const aw = getAwarenessContext(carrierAware, tagged, side);
  return zoneMultiplierForSkill('SHOOT', aw.ballZoneInfo, aw);
}
