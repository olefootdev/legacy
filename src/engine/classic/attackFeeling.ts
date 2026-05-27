/**
 * AttackFeeling — sistema de intenção ofensiva para o engine CLASSIC.
 *
 * Atacantes em zona ofensiva pensam primeiro em gol.
 * Ordem: finalizar > entrar em zona melhor > passe-chave > driblar > cruzar > recuar (último recurso).
 *
 * Integra no decisionEngine como camada de "goal awareness" que modifica
 * a intenção e a probabilidade de chute baseado em atributos reais.
 */

import type { ClassicPlayer, ArchetypeId, PassStyle, ManagerSkillId } from './types';
import { zoneFromRole } from './types';
import { ARCHETYPES } from './archetypes';
import { FIELD_W_LOGIC, FIELD_H_LOGIC } from './formations';
import { getFatigueState } from '@/match/fatigueState';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type ShotOpportunityZone = 'critical' | 'high' | 'medium' | 'low' | 'invalid';

export type AttackDecision =
  | 'shoot'
  | 'enter_box'
  | 'key_pass'
  | 'dribble_to_angle'
  | 'cross'
  | 'layoff'
  | 'hold';

export interface GoalIntentResult {
  score: number;           // 0-100
  zone: ShotOpportunityZone;
  decision: AttackDecision;
  shotProbOverride: number | null;  // se não-null, substitui shotProb do decisionEngine
  antiBackpass: boolean;   // true = proibir recuo
  rationale: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// ─── Classificação de zona de finalização ────────────────────────────────────

export function classifyShotZone(
  xRel: number,
  yRel: number,
  distToGoal: number,
): ShotOpportunityZone {
  // Pequena área: xRel >= 0.88 e centralizado
  if (xRel >= 0.88 && yRel > 0.25 && yRel < 0.75) return 'critical';
  // Dentro da área: xRel >= 0.78
  if (xRel >= 0.78 && yRel > 0.15 && yRel < 0.85) return 'high';
  // Entrada da área: xRel >= 0.68
  if (xRel >= 0.68 && yRel > 0.10 && yRel < 0.90) return 'medium';
  // Último terço mas longe: xRel >= 0.60
  if (xRel >= 0.60 && distToGoal < 220) return 'low';
  return 'invalid';
}

// ─── Bônus de arquétipo ofensivo ─────────────────────────────────────────────

const ARCHETYPE_GOAL_BONUS: Record<ArchetypeId, number> = {
  FINISHER: 18,
  COLD_BLOOD: 15,
  BOX_INVADER: 14,
  WILD: 10,
  HUNTER: 4,
  ENGINE: 2,
  MAESTRO: 6,
  VETERAN: 5,
  DESTROYER: -5,
};

const ARCHETYPE_BOX_PRESENCE: Record<ArchetypeId, number> = {
  FINISHER: 20,
  BOX_INVADER: 22,
  COLD_BLOOD: 16,
  WILD: 12,
  HUNTER: 6,
  ENGINE: 4,
  MAESTRO: 3,
  VETERAN: 4,
  DESTROYER: -8,
};

// ─── Goal Intent Score ───────────────────────────────────────────────────────

export function computeGoalIntent(
  player: ClassicPlayer,
  opponents: ClassicPlayer[],
  attackDir: 1 | -1,
  activeSkills: ManagerSkillId[],
  chainLastType: string | null,
): GoalIntentResult {
  const teamSide = player.team;
  const xRel = teamSide === 'home'
    ? player.position.x / FIELD_W_LOGIC
    : 1 - player.position.x / FIELD_W_LOGIC;
  const yRel = player.position.y / FIELD_H_LOGIC;

  const goalX = attackDir > 0 ? FIELD_W_LOGIC : 0;
  const goalY = FIELD_H_LOGIC / 2;
  const distToGoal = distance(player.position, { x: goalX, y: goalY });

  const zone = classifyShotZone(xRel, yRel, distToGoal);
  const holderZone = zoneFromRole(player.role);
  const cfg = ARCHETYPES[player.archetype];

  // Fadiga real: tabela canônica `getFatigueState` substitui a penalidade
  // linear antiga. Permite que cansaço dene atributos (finishing/positioning/
  // composure) — fadiga vira gameplay, não enfeite.
  const fatSt = getFatigueState(player.fatigue ?? 0);
  const fatMul = fatSt.attrMultiplier;

  // ─── Componentes do score ──────────────────────────────────────────────
  const finishing = clamp(player.ovr * (cfg.shotFreq * 0.6 + 0.4) * fatMul, 0, 100);
  const positioning = clamp(player.ovr * (cfg.positionBonus * 0.5 + 0.5) * fatMul, 0, 100);
  const composure = cfg.stressImmune ? 85 : clamp((player.confidence * 0.7 + player.ovr * 0.3) * fatMul, 0, 100);

  const archetypeBonus = ARCHETYPE_GOAL_BONUS[player.archetype] ?? 0;
  const boxPresence = ARCHETYPE_BOX_PRESENCE[player.archetype] ?? 0;

  // Zone bonus
  const zoneBonus = zone === 'critical' ? 30
    : zone === 'high' ? 20
    : zone === 'medium' ? 10
    : zone === 'low' ? 2
    : -20;

  // Momentum: on fire, chain from cross/corner/rebound
  let momentumBonus = 0;
  if (player.onFire) momentumBonus += 12;
  if (chainLastType === 'cross' || chainLastType === 'corner') momentumBonus += 8;
  if (chainLastType === 'rebound') momentumBonus += 15;
  if (activeSkills.includes('offens')) momentumBonus += 6;

  // Penalties
  const nearestOpp = opponents.reduce((min, o) => {
    const d = distance(player.position, o.position);
    return d < min ? d : min;
  }, 999);
  const pressurePenalty = nearestOpp < 30 ? 12 : nearestOpp < 50 ? 6 : 0;

  // Bad angle: ponta muito aberta
  const angleToGoal = Math.abs(Math.atan2(goalY - player.position.y, goalX - player.position.x));
  const badAnglePenalty = angleToGoal > 1.2 ? 15 : angleToGoal > 0.9 ? 8 : 0;

  // Penalidade flat extra na zona vermelha — alinha com risco de lesão da tabela.
  const fatiguePenalty = fatSt.level === 'critical' ? 12 : fatSt.level === 'exhausted' ? 6 : 0;

  // ─── Score final ───────────────────────────────────────────────────────
  const rawScore =
    finishing * 0.25 +
    positioning * 0.15 +
    composure * 0.15 +
    archetypeBonus +
    (zone === 'critical' || zone === 'high' ? boxPresence * 0.5 : 0) +
    zoneBonus +
    momentumBonus -
    pressurePenalty -
    badAnglePenalty -
    fatiguePenalty;

  const score = clamp(Math.round(rawScore), 0, 100);

  // ─── Decisão baseada no score + zona ───────────────────────────────────
  let decision: AttackDecision;
  let shotProbOverride: number | null = null;
  let antiBackpass = false;

  if (zone === 'invalid') {
    decision = holderZone === 'attack' ? 'enter_box' : 'key_pass';
  } else if (zone === 'critical') {
    // Pequena área: finaliza quase sempre
    antiBackpass = true;
    if (score >= 40) {
      decision = 'shoot';
      shotProbOverride = clamp(0.85 + (score - 40) * 0.003, 0.85, 0.98);
    } else {
      decision = 'shoot';
      shotProbOverride = 0.75;
    }
  } else if (zone === 'high') {
    // Dentro da área
    antiBackpass = score >= 35;
    if (score >= 55) {
      decision = 'shoot';
      shotProbOverride = clamp(0.65 + (score - 55) * 0.005, 0.65, 0.92);
    } else if (score >= 35) {
      decision = nearestOpp < 35 ? 'dribble_to_angle' : 'shoot';
      shotProbOverride = score >= 45 ? 0.55 : 0.40;
    } else {
      decision = 'layoff';
    }
  } else if (zone === 'medium') {
    // Entrada da área
    if (score >= 60) {
      decision = 'shoot';
      shotProbOverride = clamp(0.45 + (score - 60) * 0.006, 0.45, 0.75);
    } else if (score >= 40) {
      decision = holderZone === 'attack' ? 'enter_box' : 'key_pass';
    } else {
      decision = 'key_pass';
    }
  } else {
    // Low zone
    if (score >= 70 && holderZone === 'attack') {
      decision = 'enter_box';
    } else {
      decision = 'key_pass';
    }
  }

  // ─── Role-specific overrides ───────────────────────────────────────────
  const role = player.role.toUpperCase();

  // Pontas na ala: preferem cruzar ou cortar para dentro
  if ((role === 'LW' || role === 'RW') && zone === 'medium') {
    const inFlank = player.position.y < 100 || player.position.y > FIELD_H_LOGIC - 100;
    if (inFlank && decision !== 'shoot') {
      decision = 'cross';
    }
  }

  // Laterais: nunca chutam
  if (role === 'LB' || role === 'RB') {
    decision = 'cross';
    shotProbOverride = null;
    antiBackpass = false;
  }

  // Volantes: não forçam chute
  if (role === 'DM' && zone !== 'critical') {
    if (decision === 'shoot') {
      decision = 'key_pass';
      shotProbOverride = null;
    }
  }

  // ST na pequena área: nunca recua
  if (role === 'ST' && (zone === 'critical' || zone === 'high')) {
    antiBackpass = true;
  }

  const rationale = `[AttackFeeling] ${player.shortName} (${player.archetype}) zone=${zone} score=${score} → ${decision}`;

  return { score, zone, decision, shotProbOverride, antiBackpass, rationale };
}

// ─── Anti-backpass: verifica se atacante pode recuar ─────────────────────────

export function canAttackerBackpass(
  player: ClassicPlayer,
  opponents: ClassicPlayer[],
  attackDir: 1 | -1,
  activeSkills: ManagerSkillId[],
  chainLastType: string | null,
): boolean {
  const intent = computeGoalIntent(player, opponents, attackDir, activeSkills, chainLastType);
  // Se antiBackpass está ativo, atacante NÃO pode recuar
  // Exceção: pressão extrema (2+ adversários a < 25px)
  if (!intent.antiBackpass) return true;

  const closeOpponents = opponents.filter(o =>
    distance(player.position, o.position) < 25
  ).length;

  // Só permite recuo se completamente cercado
  return closeOpponents >= 2;
}

// ─── Winger cut-inside detection ─────────────────────────────────────────────

export function shouldWingerCutInside(
  player: ClassicPlayer,
  opponents: ClassicPlayer[],
  attackDir: 1 | -1,
): boolean {
  const role = player.role.toUpperCase();
  if (role !== 'LW' && role !== 'RW') return false;

  const xRel = player.team === 'home'
    ? player.position.x / FIELD_W_LOGIC
    : 1 - player.position.x / FIELD_W_LOGIC;

  // Só corta se está no último terço
  if (xRel < 0.60) return false;

  const inFlank = player.position.y < 100 || player.position.y > FIELD_H_LOGIC - 100;
  if (!inFlank) return false; // já está por dentro

  // Verifica se há espaço para cortar
  const centerY = FIELD_H_LOGIC / 2;
  const cutDirection = player.position.y < centerY ? 1 : -1; // corta para o centro
  const cutTarget = { x: player.position.x, y: player.position.y + cutDirection * 80 };

  const blockingOpponents = opponents.filter(o =>
    distance(o.position, cutTarget) < 50
  ).length;

  // Corta se há espaço e o arquétipo favorece
  const cfg = ARCHETYPES[player.archetype];
  const cutChance = cfg.unpredictable ? 0.55 : cfg.shotFreq >= 0.7 ? 0.45 : 0.30;

  return blockingOpponents < 2 && Math.random() < cutChance;
}
