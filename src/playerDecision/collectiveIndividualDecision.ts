import { FIELD_LENGTH, FIELD_WIDTH, clampToPitch } from '@/simulation/field';
import type { AgentSnapshot, PassOption } from '@/simulation/InteractionResolver';
import type { DecisionContext, PlayerProfile } from './types';
import { DECISION_DEBUG_TOP_N } from '@/match/matchSimulationTuning';
import {
  SHOOT_SCORE_FLOOR_EPSILON,
  SHOOT_SCORE_VS_PASS_SAFE_FACTOR,
  SHOOT_PRESSURE_PENALTY_CAP,
} from '@/match/shootDecisionTuning';
import type { MatchCognitiveArchetype } from '@/match/playerInMatch';
import { getDefendingGoalX, isInsideOwnPenaltyArea, type TeamSide } from '@/match/fieldZones';
import { roleZonePenalty, scoreActionZoneBias } from '@/match/roleZoneTactics';
import {
  getDefensiveIntent,
  normalizeStyle,
  styleActionBias,
  type NormalizedTacticalStyle,
  type TeamTacticalStyle,
} from '@/tactics/playingStyle';

export type TacticalRole = 'zagueiro' | 'lateral' | 'volante' | 'meia' | 'ponta' | 'atacante' | 'goleiro';
export type CognitiveArchetype = MatchCognitiveArchetype;
export type DecisionActionId =
  | 'pass_safe'
  | 'pass_progressive'
  | 'pass_long'
  | 'cross'
  | 'carry'
  | 'dribble_risk'
  | 'shoot'
  | 'clearance'
  | 'hold_position'
  | 'press'
  | 'cover';

export interface DecisionAttributes {
  tecnica: number;
  passe: number;
  cruzamento: number;
  marcacao: number;
  visao: number;
  criatividade: number;
  compostura: number;
  desarme: number;
  finalizacao: number;
  forca: number;
  velocidade: number;
  posicionamento: number;
  decisao: number;
}

export interface TeamTacticalContext {
  mentalidade: number;
  linhaDefensiva: number;
  pressao: number;
  largura: number;
  ritmo: number;
  style: NormalizedTacticalStyle;
}

export interface PlayerState {
  x: number;
  z: number;
  speed: number;
  stamina: number;
  hasPossession: boolean;
  pressureReceived: number;
  teamPhase: DecisionContext['teamPhase'];
  confidenceRuntime: number;
}

export interface CollectiveTarget {
  targetX: number;
  targetZ: number;
  prioritySet: string[];
}

export interface ActionOption {
  id: DecisionActionId;
  pass?: PassOption;
  targetX?: number;
  targetZ?: number;
}

export interface ScoredAction {
  id: DecisionActionId;
  score: number;
  reason: string;
}

export interface DecisionPick {
  action: ActionOption;
  top3: ScoredAction[];
  reason: string;
}

const ARCHETYPE_BIAS: Record<CognitiveArchetype, Partial<Record<DecisionActionId, number>>> = {
  executor: { pass_safe: 0.22, hold_position: 0.2, cover: 0.1, dribble_risk: -0.22, shoot: -0.06, cross: -0.06 },
  criador: { pass_progressive: 0.26, cross: 0.12, carry: 0.1, dribble_risk: 0.08, pass_safe: -0.08 },
  destruidor: { press: 0.22, cover: 0.2, clearance: 0.12, pass_progressive: -0.1, dribble_risk: -0.2, cross: -0.15 },
  construtor: { pass_safe: 0.2, pass_progressive: 0.14, hold_position: 0.1, shoot: -0.1, cross: 0.04 },
  finalizador: { shoot: 0.26, carry: 0.08, pass_progressive: 0.06, cross: 0.1, hold_position: -0.08 },
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function n(v: number): number {
  return clamp01(v / 100);
}

export function mapRole(self: AgentSnapshot): TacticalRole {
  const slot = self.slotId ?? '';
  if (self.role === 'gk' || slot === 'gol') return 'goleiro';
  if (slot === 'vol') return 'volante';
  if (slot === 'le' || slot === 'ld') return 'lateral';
  if (slot === 'pe' || slot === 'pd') return 'ponta';
  if (slot === 'ca' || slot === 'ata1' || slot === 'ata2' || self.role === 'attack') return 'atacante';
  if (slot === 'zag1' || slot === 'zag2' || slot === 'zag3') return 'zagueiro';
  if (self.role === 'def') return 'zagueiro';
  if (self.role === 'mid') return 'meia';
  return 'meia';
}

export function mapArchetype(
  profile: PlayerProfile,
  self?: Pick<AgentSnapshot, 'cognitiveArchetype'>,
): CognitiveArchetype {
  if (self?.cognitiveArchetype) return self.cognitiveArchetype;
  switch (profile.archetype) {
    case 'creative':
    case 'playmaker':
      return 'criador';
    case 'destroyer':
      return 'destruidor';
    case 'anchor':
    case 'conservative':
      return 'executor';
    case 'poacher':
    case 'target_man':
      return 'finalizador';
    default:
      return 'construtor';
  }
}

export function extractAttributes(self: AgentSnapshot, profile: PlayerProfile): DecisionAttributes {
  const criatividade = Math.round((profile.vision * 100 * 0.5) + (profile.riskAppetite * 100 * 0.5));
  const visao = Math.round(profile.vision * 100);
  const compostura = Math.round(self.mentalidade * 0.55 + self.confianca * 0.45);
  const decisao = Math.round(self.tatico * 0.45 + self.mentalidade * 0.55);
  const tecnica = Math.round((self.passeCurto + self.drible + self.finalizacao) / 3);
  const posicionamento = Math.round((self.tatico * 0.55 + self.marcacao * 0.45));
  return {
    tecnica,
    passe: self.passe,
    cruzamento: self.cruzamento,
    marcacao: self.marcacao,
    visao,
    criatividade,
    compostura,
    desarme: self.marcacao,
    finalizacao: self.finalizacao,
    forca: self.fisico,
    velocidade: self.velocidade,
    posicionamento,
    decisao,
  };
}

export function buildTeamTacticalContext(ctx: DecisionContext): TeamTacticalContext {
  return {
    mentalidade: ctx.mentality,
    linhaDefensiva: ctx.tacticalDefensiveLine ?? 50,
    pressao: ctx.tacticalPressing ?? Math.max(15, Math.min(95, ctx.mentality)),
    largura: ctx.tacticalWidth ?? 50,
    ritmo: ctx.tacticalTempo ?? 50,
    style: normalizeStyle(ctx.tacticalStyle),
  };
}

export function buildPlayerState(ctx: DecisionContext, pressure01: number): PlayerState {
  return {
    x: ctx.self.x,
    z: ctx.self.z,
    speed: ctx.self.speed,
    stamina: ctx.stamina ?? 100,
    hasPossession: ctx.isCarrier,
    pressureReceived: pressure01,
    teamPhase: ctx.teamPhase,
    confidenceRuntime: ctx.self.confidenceRuntime ?? 1,
  };
}

export function getCollectiveTarget(player: AgentSnapshot, ctx: DecisionContext): CollectiveTarget {
  const role = mapRole(player);
  const ballX = ctx.ballX;
  const ballZ = ctx.ballZ;
  const side = player.side as TeamSide;
  const half = ctx.clockHalf ?? 1;
  const ownGoalX = getDefendingGoalX(side, half);
  const ad = ctx.attackDir;
  const target = { x: ctx.slotX, z: ctx.slotZ };
  const priorities: string[] = [];

  if (
    isInsideOwnPenaltyArea({ x: ballX, z: ballZ }, { team: side, half })
    && ctx.teamPhase === 'transition_def'
  ) {
    target.x = ownGoalX + ad * 6;
    target.z = FIELD_WIDTH / 2 + (ballZ - FIELD_WIDTH / 2) * 0.42;
    priorities.push('colapso_area', 'cobertura_gol');
  }

  switch (role) {
    case 'zagueiro':
      target.x = ownGoalX + ad * 14;
      target.z = FIELD_WIDTH / 2 + (player.z < FIELD_WIDTH / 2 ? -7 : 7);
      priorities.push('proteger_gol', 'manter_linha', 'cobertura_central');
      break;
    case 'volante':
      target.x = ownGoalX + ad * 23;
      target.z = FIELD_WIDTH / 2 + (ballZ - FIELD_WIDTH / 2) * 0.35;
      priorities.push('cobrir_corredor_central', 'equilibrio', 'primeira_saida');
      break;
    case 'meia':
      target.x = ctx.ballX - ad * 7;
      target.z = ctx.slotZ + (ballZ - ctx.slotZ) * 0.25;
      priorities.push('conectar_setores', 'linha_de_passe', 'entrelinhas');
      break;
    case 'ponta':
      target.x = ballX + ad * 10;
      target.z = player.z < FIELD_WIDTH / 2 ? 6 : FIELD_WIDTH - 6;
      priorities.push('alongar_campo', 'atacar_corredor');
      break;
    case 'atacante':
      target.x = ballX + ad * 14;
      target.z = FIELD_WIDTH / 2 + (player.z - FIELD_WIDTH / 2) * 0.25;
      priorities.push('profundidade', 'atacar_espaco', 'area');
      break;
    case 'lateral':
      target.x = ctx.teamPhase === 'transition_def'
        ? ctx.slotX
        : ctx.slotX + ad * 6;
      target.z = ctx.slotZ;
      priorities.push('equilibrio_largura_recomposicao');
      break;
    case 'goleiro':
    default:
      target.x = ownGoalX + ad * 3;
      target.z = FIELD_WIDTH / 2;
      priorities.push('proteger_gol');
      break;
  }

  const clamped = clampToPitch(target.x, target.z, 2);
  return { targetX: clamped.x, targetZ: clamped.z, prioritySet: priorities };
}

export function chooseAction(
  role: TacticalRole,
  attrs: DecisionAttributes,
  archetype: CognitiveArchetype,
  tctx: TeamTacticalContext,
  pstate: PlayerState,
  options: ActionOption[],
  debug = false,
  zoneOpts?: { tags: readonly string[]; shootFloorEligible?: boolean; shootBudgetForce?: boolean },
): DecisionPick {
  const scored: ScoredAction[] = [];
  let best = options[0]!;
  let bestScore = -9999;
  let bestReason = 'fallback';

  for (const option of options) {
    const tacticalFit = roleActionFit(role, option.id, pstate.teamPhase);
    const capability = actionCapability(option.id, attrs);
    let riskPenalty = contextualRisk(option.id, pstate, tctx);
    if (option.id === 'shoot') {
      riskPenalty = Math.min(SHOOT_PRESSURE_PENALTY_CAP, riskPenalty);
    }
    const bias = ARCHETYPE_BIAS[archetype][option.id] ?? 0;
    const zb = zoneOpts?.tags ? scoreActionZoneBias(zoneOpts.tags, option.id) : 0;
    const zp = zoneOpts?.tags ? roleZonePenalty(role, option.id, zoneOpts.tags) : 0;
    const styleBias = mapStyleBias(option.id, tctx.style, zoneOpts?.tags);
    const score =
      tacticalFit * 0.38
      + capability * 0.34
      + bias * 0.2
      - riskPenalty * 0.25
      + zb * 0.2
      - zp * 0.38
      + styleBias * 0.28;
    const reason = `${option.id}: fit=${tacticalFit.toFixed(2)} cap=${capability.toFixed(2)} bias=${bias.toFixed(2)} risk=${riskPenalty.toFixed(2)} zone=${zb.toFixed(2)}/${zp.toFixed(2)} style=${styleBias.toFixed(2)}`;
    scored.push({ id: option.id, score, reason });
    if (score > bestScore) {
      bestScore = score;
      best = option;
      bestReason = reason;
    }
  }

  const passSafeEntry = scored.find((s) => s.id === 'pass_safe');
  const shootEntry = scored.find((s) => s.id === 'shoot');
  if (
    zoneOpts?.shootFloorEligible
    && passSafeEntry
    && shootEntry
    && options.some((o) => o.id === 'shoot')
  ) {
    const floor = passSafeEntry.score * SHOOT_SCORE_VS_PASS_SAFE_FACTOR + SHOOT_SCORE_FLOOR_EPSILON;
    if (shootEntry.score < floor) {
      shootEntry.score = floor;
      shootEntry.reason += `|floor=${floor.toFixed(3)}`;
    }
    if (zoneOpts.shootBudgetForce) {
      shootEntry.score = Math.max(shootEntry.score, passSafeEntry.score + 0.14);
      shootEntry.reason += '|budget_force';
    }
    best = options[0]!;
    bestScore = -9999;
    for (const option of options) {
      const s = scored.find((x) => x.id === option.id);
      if (s && s.score > bestScore) {
        bestScore = s.score;
        best = option;
        bestReason = s.reason;
      }
    }
  }

  const top3 = scored.sort((a, b) => b.score - a.score).slice(0, DECISION_DEBUG_TOP_N);
  if (debug) {
    const t = top3.map((x) => `${x.id}:${x.score.toFixed(2)}`).join(' | ');
    console.debug(`[decision] role=${role} arch=${archetype} best=${best.id} top3=${t} reason=${bestReason}`);
  }
  return { action: best, top3, reason: bestReason };
}

function roleActionFit(role: TacticalRole, action: DecisionActionId, phase: PlayerState['teamPhase']): number {
  const defensive = phase === 'transition_def';
  if (defensive) {
    if (action === 'cover' || action === 'press') return role === 'zagueiro' || role === 'volante' || role === 'lateral' ? 0.95 : 0.62;
    if (action === 'hold_position') return 0.75;
    return 0.35;
  }

  switch (role) {
    case 'zagueiro':
      if (action === 'pass_safe' || action === 'hold_position' || action === 'cover') return 0.92;
      if (action === 'clearance' || action === 'pass_long') return 0.76;
      return 0.4;
    case 'volante':
      if (action === 'pass_safe' || action === 'pass_progressive' || action === 'pass_long' || action === 'cover') return 0.9;
      return 0.55;
    case 'meia':
      if (action === 'pass_progressive' || action === 'carry' || action === 'dribble_risk') return 0.9;
      if (action === 'shoot') return 0.84;
      return 0.62;
    case 'ponta':
      if (action === 'dribble_risk' || action === 'carry' || action === 'pass_progressive' || action === 'cross') return 0.92;
      if (action === 'shoot') return 0.88;
      return 0.62;
    case 'atacante':
      if (action === 'shoot' || action === 'carry' || action === 'pass_progressive' || action === 'pass_long') return 0.94;
      return 0.52;
    case 'lateral':
      if (action === 'pass_safe' || action === 'cover' || action === 'carry' || action === 'cross') return 0.88;
      if (action === 'shoot') return 0.76;
      return 0.58;
    case 'goleiro':
      return action === 'pass_safe' || action === 'clearance' || action === 'hold_position' ? 0.94 : 0.25;
    default:
      return 0.5;
  }
}

function actionCapability(action: DecisionActionId, a: DecisionAttributes): number {
  switch (action) {
    case 'pass_safe':
      return n(a.passe) * 0.5 + n(a.compostura) * 0.3 + n(a.decisao) * 0.2;
    case 'pass_progressive':
      return n(a.passe) * 0.35 + n(a.visao) * 0.35 + n(a.criatividade) * 0.2 + n(a.decisao) * 0.1;
    case 'pass_long':
      return n(a.passe) * 0.34 + n(a.visao) * 0.2 + n(a.forca) * 0.3 + n(a.decisao) * 0.16;
    case 'cross':
      return n(a.cruzamento) * 0.45 + n(a.passe) * 0.25 + n(a.visao) * 0.2 + n(a.decisao) * 0.1;
    case 'carry':
      return n(a.tecnica) * 0.35 + n(a.velocidade) * 0.35 + n(a.compostura) * 0.3;
    case 'dribble_risk':
      return n(a.tecnica) * 0.35 + n(a.criatividade) * 0.3 + n(a.velocidade) * 0.2 + n(a.decisao) * 0.15;
    case 'shoot':
      return n(a.finalizacao) * 0.65 + n(a.compostura) * 0.2 + n(a.decisao) * 0.15;
    case 'clearance':
      return n(a.forca) * 0.4 + n(a.decisao) * 0.35 + n(a.desarme) * 0.25;
    case 'press':
      return n(a.marcacao) * 0.45 + n(a.desarme) * 0.35 + n(a.velocidade) * 0.2;
    case 'cover':
      return n(a.posicionamento) * 0.5 + n(a.marcacao) * 0.3 + n(a.decisao) * 0.2;
    case 'hold_position':
    default:
      return n(a.posicionamento) * 0.5 + n(a.compostura) * 0.3 + n(a.decisao) * 0.2;
  }
}

function contextualRisk(action: DecisionActionId, p: PlayerState, t: TeamTacticalContext): number {
  const pressure = p.pressureReceived;
  const lateLosing = p.teamPhase !== 'transition_def' && t.mentalidade > 65;
  const lowConf = Math.max(0, 1.15 - p.confidenceRuntime);
  const riskMod = 1 - (t.style.riskTaking - 0.5) * 0.42;
  switch (action) {
    case 'dribble_risk':
      return (pressure * 0.85 + (p.stamina < 40 ? 0.2 : 0)) * riskMod;
    case 'pass_progressive':
      return (pressure * (0.45 + lowConf * 0.35) + (t.ritmo > 70 ? 0.1 : 0)) * riskMod;
    case 'pass_long':
      return (pressure * 0.42 + (t.ritmo > 68 ? 0.08 : 0)) * riskMod;
    case 'cross':
      return pressure * 0.38 + (p.stamina < 35 ? 0.12 : 0);
    case 'shoot':
      return pressure * 0.3 + (lateLosing ? -0.05 : 0.05);
    case 'pass_safe':
      return Math.max(0, pressure * 0.12 - lowConf * 0.06);
    case 'press':
      return p.teamPhase === 'transition_def' ? 0.1 : 0.25;
    case 'cover':
      return 0.08;
    case 'clearance':
      return 0.2;
    default:
      return 0.14 * riskMod;
  }
}

function mapStyleBias(action: DecisionActionId, style: NormalizedTacticalStyle, zoneTags?: readonly string[]): number {
  switch (action) {
    case 'pass_safe':
      return styleActionBias(style, 'pass_safe', zoneTags);
    case 'pass_progressive':
      return styleActionBias(style, 'pass_progressive', zoneTags);
    case 'pass_long':
      return styleActionBias(style, 'pass_long', zoneTags);
    case 'cross':
      return styleActionBias(style, 'cross', zoneTags);
    case 'carry':
    case 'dribble_risk':
      return styleActionBias(style, 'dribble', zoneTags);
    case 'shoot':
      return styleActionBias(style, 'shoot', zoneTags);
    case 'clearance':
      return styleActionBias(style, 'clearance', zoneTags);
    case 'hold_position':
      return styleActionBias(style, 'hold', zoneTags);
    case 'press': {
      const d = getDefensiveIntent(style);
      return d.pressTrigger / 20 - 0.5;
    }
    case 'cover': {
      const d = getDefensiveIntent(style);
      return d.funnel === 'inside' ? 0.18 : d.funnel === 'outside' ? 0.06 : 0.1;
    }
    default:
      return 0;
  }
}

