/**
 * Consciência espacial IFAB em metros (eixo X comprimento, Z largura).
 * 2.º tempo: troca de lados — gol defendido/ataque invertem para ambos os times.
 */

import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';

export type MatchHalf = 1 | 2;
export type TeamSide = 'home' | 'away';

/** Extremidade física do campo onde está o gol (x=0 oeste, x=L leste). */
export type PitchEnd = 'west' | 'east';

export interface PitchPosition {
  x: number;
  z: number;
}

export interface TeamPitchContext {
  team: TeamSide;
  half: MatchHalf;
}

/** IFAB: profundidade da grande área a partir da linha de fundo (m). */
export const PENALTY_AREA_DEPTH_M = 16.5;
/** Metade da largura da grande área (m a cada lado do eixo central). */
export const PENALTY_AREA_HALF_WIDTH_M = 20.16;

const MID_X = FIELD_LENGTH / 2;
const CZ = FIELD_WIDTH / 2;
const Z_LO = CZ - PENALTY_AREA_HALF_WIDTH_M;
const Z_HI = CZ + PENALTY_AREA_HALF_WIDTH_M;

/** Gol que o time defende neste tempo (coordenada X do travessão). */
export function getDefendingGoalX(team: TeamSide, half: MatchHalf): number {
  if (half === 1) return team === 'home' ? 0 : FIELD_LENGTH;
  return team === 'home' ? FIELD_LENGTH : 0;
}

/** Gol que o time ataca. */
export function getAttackingGoalX(team: TeamSide, half: MatchHalf): number {
  return FIELD_LENGTH - getDefendingGoalX(team, half);
}

/** Profundidade máxima (m) a que o GR pode afastar-se da linha de baliza defendida — evita atravessar o campo. */
export const GOALKEEPER_MAX_DEPTH_FROM_GOAL_M = 28;

/**
 * Mantém o alvo X do guarda-redes junto à baliza que defende neste tempo.
 */
export function clampGoalkeeperTargetX(team: TeamSide, half: MatchHalf, x: number): number {
  const dg = getDefendingGoalX(team, half);
  const m = GOALKEEPER_MAX_DEPTH_FROM_GOAL_M;
  if (dg <= FIELD_LENGTH * 0.5) {
    return Math.max(0.8, Math.min(m, x));
  }
  return Math.max(FIELD_LENGTH - m, Math.min(FIELD_LENGTH - 0.8, x));
}

/**
 * Lado do campo em termos de gol: onde está o gol defendido vs o atacado.
 * Útil para presets narrativos / debug.
 */
export function getPitchSideGoals(team: TeamSide, half: MatchHalf): {
  defendingGoal: PitchEnd;
  attackingGoal: PitchEnd;
} {
  const dx = getDefendingGoalX(team, half);
  return {
    defendingGoal: dx < MID_X ? 'west' : 'east',
    attackingGoal: dx < MID_X ? 'east' : 'west',
  };
}

/** Vetor unidade no eixo X apontando para o gol adversário (+1 leste, -1 oeste). */
export function getSideAttackDir(team: TeamSide, half: MatchHalf): 1 | -1 {
  const def = getDefendingGoalX(team, half);
  const att = getAttackingGoalX(team, half);
  return att > def ? 1 : -1;
}

/** Profundidade 0..L a partir do próprio gol (ao longo do eixo de ataque). */
export function depthFromOwnGoal(x: number, team: TeamSide, half: MatchHalf): number {
  const gx = getDefendingGoalX(team, half);
  return Math.abs(x - gx);
}

/** Grande área do gol nesta extremidade (retângulo em X,Z). */
export function isInsidePenaltyAreaAtEnd(pos: PitchPosition, end: PitchEnd): boolean {
  const x = pos.x;
  const z = pos.z;
  if (z < Z_LO || z > Z_HI) return false;
  if (end === 'west') return x >= 0 && x <= PENALTY_AREA_DEPTH_M;
  return x <= FIELD_LENGTH && x >= FIELD_LENGTH - PENALTY_AREA_DEPTH_M;
}

/** Grande área própria do time (defende este gol). */
export function isInsideOwnPenaltyArea(pos: PitchPosition, ctx: TeamPitchContext): boolean {
  const end: PitchEnd = getDefendingGoalX(ctx.team, ctx.half) < MID_X ? 'west' : 'east';
  return isInsidePenaltyAreaAtEnd(pos, end);
}

/** Grande área adversária. */
export function isInsideOppPenaltyArea(pos: PitchPosition, ctx: TeamPitchContext): boolean {
  const end: PitchEnd = getAttackingGoalX(ctx.team, ctx.half) < MID_X ? 'west' : 'east';
  return isInsidePenaltyAreaAtEnd(pos, end);
}

/** Margem extra para ficar claramente fora da grande área (reinícios). */
export const PENALTY_AREA_EXIT_MARGIN_M = 1.2;

/** Limiar de X (lado oeste) para jogadores de campo na saída de baliza — fora da grande área. */
export const OUTSIDE_WEST_PENALTY_MIN_X_M = PENALTY_AREA_DEPTH_M + PENALTY_AREA_EXIT_MARGIN_M;

/**
 * Empurra (x,z) para fora das duas grandes áreas (ambas as balizas), com pequena margem.
 * Usado na saída de baliza após remate para fora: todos os jogadores de campo devem sair da área.
 */
export function clampWorldOutsideBothPenaltyAreas(x: number, z: number): { x: number; z: number } {
  let nx = x;
  const nz = z;
  const m = PENALTY_AREA_EXIT_MARGIN_M;
  for (let i = 0; i < 6; i++) {
    let moved = false;
    if (isInsidePenaltyAreaAtEnd({ x: nx, z: nz }, 'west')) {
      nx = PENALTY_AREA_DEPTH_M + m;
      moved = true;
    }
    if (isInsidePenaltyAreaAtEnd({ x: nx, z: nz }, 'east')) {
      nx = FIELD_LENGTH - PENALTY_AREA_DEPTH_M - m;
      moved = true;
    }
    if (!moved) break;
  }
  return {
    x: Math.min(FIELD_LENGTH - 1.2, Math.max(1.2, nx)),
    z: Math.min(FIELD_WIDTH - 1.2, Math.max(1.2, nz)),
  };
}

/** Posição do GR que coloca a bola em jogo após remate para fora (junto à baliza defendida). */
export function goalKickRestartGoalkeeperWorldPos(team: TeamSide, half: MatchHalf): { x: number; z: number } {
  const dg = getDefendingGoalX(team, half);
  const inset = 2.35;
  const x = dg < MID_X ? inset : FIELD_LENGTH - inset;
  return { x, z: FIELD_WIDTH / 2 };
}

export function isInsideOwnHalf(pos: PitchPosition, ctx: TeamPitchContext): boolean {
  const gx = getDefendingGoalX(ctx.team, ctx.half);
  const ax = getAttackingGoalX(ctx.team, ctx.half);
  const mid = (gx + ax) / 2;
  return gx < ax ? pos.x < mid : pos.x > mid;
}

export type PitchThird = 'defensive' | 'middle' | 'attacking';

export function getThird(pos: PitchPosition, ctx: TeamPitchContext): PitchThird {
  const d = depthFromOwnGoal(pos.x, ctx.team, ctx.half);
  const t = FIELD_LENGTH / 3;
  if (d < t) return 'defensive';
  if (d < 2 * t) return 'middle';
  return 'attacking';
}

export type PitchLane = 'left' | 'half_left' | 'center' | 'half_right' | 'right';

export function getLane(pos: PitchPosition): PitchLane {
  const u = pos.z / FIELD_WIDTH;
  if (u < 0.18) return 'left';
  if (u < 0.36) return 'half_left';
  if (u < 0.64) return 'center';
  if (u < 0.82) return 'half_right';
  return 'right';
}

/**
 * Tags compostas para decisão / debug.
 */
export function getZoneTags(pos: PitchPosition, ctx: TeamPitchContext): string[] {
  const tags: string[] = [];
  const third = getThird(pos, ctx);
  tags.push(`${third}_third`);
  tags.push(`lane_${getLane(pos)}`);
  if (isInsideOwnPenaltyArea(pos, ctx)) tags.push('own_box');
  if (isInsideOppPenaltyArea(pos, ctx)) tags.push('opp_box');
  if (isInsideOwnHalf(pos, ctx)) tags.push('own_half');
  else tags.push('opp_half');
  if (third === 'middle' && getLane(pos) === 'center') tags.push('central_corridor');
  if (third === 'attacking' && (getLane(pos) === 'half_left' || getLane(pos) === 'half_right')) {
    tags.push('half_space');
  }
  return tags;
}
