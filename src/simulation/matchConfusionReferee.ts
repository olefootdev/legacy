/**
 * Árbitro lógico do motor tático: lê o log causal (append-only) e a geometria em campo
 * para detetar confusão de jogo ou ajuntamento irreal; força blocos para posições de
 * formação deslocadas pelo contexto da bola.
 */
import type { PossessionSide } from '@/engine/types';
import type { CausalMatchEvent } from '@/match/causal/matchCausalTypes';
import { FORMATION_BASES } from '@/match-engine/formations/catalog';
import type { FormationSchemeId } from '@/match-engine/types';
import { slotToWorld } from '@/formation/layout433';
import { applyBallCentricShiftToSlotMap } from '@/match/tacticalField18';
import {
  defendingTeamAtGoalEnd,
  isInsideOppPenaltyArea,
  penaltyAreaEndContainingBall,
  type MatchHalf,
} from '@/match/fieldZones';
import { clampToPitch } from '@/simulation/field';

const CAUSAL_TAIL = 40;
/** Troca de posse “em espiral” no log — típico de lances ilegíveis em sequência. */
const POSSESSION_FLIP_THRESHOLD = 4;
const POSSESSION_FLIP_WITH_FOULS = 3;
const FOUL_BURST_FOR_CONFUSION = 2;

const SWARM_RADIUS_M = 10;
/** Jogadores de campo (sem GR) dentro do raio da bola — acima disto = ajuntamento. */
const SWARM_OUTFIELD_THRESHOLD = 6;

/** Grande área: bola + GR defensor + ajuntamento (distância à bola, sem exigir pequena área por jogador). */
const PA_CLUMP_RADIUS_M = 5.6;
const PA_CLUMP_MIN_PLAYERS = 3;
const PA_CLUMP_MIN_SIDES = 2;

/** Atacante com bola às mãos preso na área adversária com GR + defesas encostados. */
const ATT_JAM_OPP_NEAR_M = 4.6;
const ATT_JAM_MIN_OPPONENTS = 2;
const ATT_JAM_GK_MAX_M = 6;

export type RefereeConfusionReason =
  | 'causal_whirlwind'
  | 'spatial_swarm'
  | 'box_clump_gk_foul'
  | 'box_clump_attacker_foul';

export interface RefereeConfusionVerdict {
  reason: RefereeConfusionReason;
  awardedSide: PossessionSide;
  /** Registo `foul_committed` quando o árbitro intervém por jam na área. */
  foulFoulerId?: string;
  foulFoulerSide?: PossessionSide;
  foulVictimId?: string;
  foulKind?: string;
}

export function buildRefereeDispositionMaps(
  homeScheme: FormationSchemeId,
  awayScheme: FormationSchemeId,
  ballX: number,
  ballZ: number,
  half: MatchHalf,
): { home: Map<string, { x: number; z: number }>; away: Map<string, { x: number; z: number }> } {
  const homeBases = FORMATION_BASES[homeScheme] ?? FORMATION_BASES['4-3-3'];
  const awayBases = FORMATION_BASES[awayScheme] ?? FORMATION_BASES['4-3-3'];
  const home = new Map<string, { x: number; z: number }>();
  const away = new Map<string, { x: number; z: number }>();
  const homeSide: 'home' | 'away' = half === 2 ? 'away' : 'home';
  const awaySide: 'home' | 'away' = half === 2 ? 'home' : 'away';
  for (const [sid, b] of Object.entries(homeBases)) {
    home.set(sid, slotToWorld(homeSide, { nx: b.nx, nz: b.nz }));
  }
  for (const [sid, b] of Object.entries(awayBases)) {
    away.set(sid, slotToWorld(awaySide, { nx: b.nx, nz: b.nz }));
  }
  applyBallCentricShiftToSlotMap(home, { ballX, ballZ, side: 'home', half, strength: 0.11 });
  applyBallCentricShiftToSlotMap(away, { ballX, ballZ, side: 'away', half, strength: 0.11 });
  for (const [k, p] of home) {
    home.set(k, clampToPitch(p.x, p.z));
  }
  for (const [k, p] of away) {
    away.set(k, clampToPitch(p.x, p.z));
  }
  return { home, away };
}

function lastPossessionChangeTo(entries: readonly CausalMatchEvent[]): PossessionSide | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i]!;
    if (e.type === 'possession_change') return e.payload.to;
  }
  return null;
}

/**
 * Confusão a partir do rasto causal recente (independente do relógio de mundo).
 */
export function scanCausalLogConfusion(entries: readonly CausalMatchEvent[]): RefereeConfusionVerdict | null {
  if (entries.length === 0) return null;
  const tail = entries.slice(-CAUSAL_TAIL);
  let poss = 0;
  let fouls = 0;
  for (const e of tail) {
    if (e.type === 'possession_change') poss++;
    if (e.type === 'foul_committed') fouls++;
  }
  const whirl =
    poss >= POSSESSION_FLIP_THRESHOLD || (poss >= POSSESSION_FLIP_WITH_FOULS && fouls >= FOUL_BURST_FOR_CONFUSION);
  if (!whirl) return null;
  const awarded = lastPossessionChangeTo(tail) ?? lastPossessionChangeTo(entries) ?? 'home';
  return { reason: 'causal_whirlwind', awardedSide: awarded };
}

export function countOutfieldPlayersNearBall(
  positions: readonly { x: number; z: number; slotId?: string; role?: string }[],
  ballX: number,
  ballZ: number,
  radius: number = SWARM_RADIUS_M,
): number {
  let n = 0;
  for (const p of positions) {
    if (p.slotId === 'gol' || p.role === 'gk') continue;
    if (Math.hypot(p.x - ballX, p.z - ballZ) <= radius) n++;
  }
  return n;
}

export function scanSpatialSwarmConfusion(
  positions: readonly { x: number; z: number; slotId?: string; role?: string }[],
  ballX: number,
  ballZ: number,
  currentPossession: PossessionSide,
): RefereeConfusionVerdict | null {
  const c = countOutfieldPlayersNearBall(positions, ballX, ballZ);
  if (c < SWARM_OUTFIELD_THRESHOLD) return null;
  return { reason: 'spatial_swarm', awardedSide: currentPossession };
}

export type RefereeAgentPositionSample = {
  id: string;
  x: number;
  z: number;
  slotId?: string;
  role?: string;
  side: PossessionSide;
};

function scanPenaltyAreaAttackerHeldJam(
  positions: readonly RefereeAgentPositionSample[],
  ballX: number,
  ballZ: number,
  ballMode: string,
  carrierId: string | null,
  half: MatchHalf,
): RefereeConfusionVerdict | null {
  if (ballMode !== 'held' || !carrierId) return null;
  const carrier = positions.find((p) => p.id === carrierId);
  if (!carrier || carrier.role === 'gk' || carrier.slotId === 'gol') return null;
  const carrierPt = { x: carrier.x, z: carrier.z };
  if (!isInsideOppPenaltyArea(carrierPt, { team: carrier.side, half })) return null;
  const oppSide: PossessionSide = carrier.side === 'home' ? 'away' : 'home';
  const opps = positions.filter((p) => p.side === oppSide);
  let oppNear = 0;
  for (const p of opps) {
    if (Math.hypot(p.x - carrier.x, p.z - carrier.z) <= ATT_JAM_OPP_NEAR_M) oppNear++;
  }
  if (oppNear < ATT_JAM_MIN_OPPONENTS) return null;
  const gk = opps.find((p) => p.role === 'gk' || p.slotId === 'gol');
  if (!gk) return null;
  if (Math.hypot(gk.x - carrier.x, gk.z - carrier.z) > ATT_JAM_GK_MAX_M) return null;
  void ballX;
  void ballZ;
  return {
    reason: 'box_clump_attacker_foul',
    awardedSide: oppSide,
    foulFoulerId: carrier.id,
    foulFoulerSide: carrier.side,
    foulVictimId: gk.id,
    foulKind: 'attacker_box_clump_on_gk',
  };
}

/**
 * Bola na **grande** área + GR defensor + ajuntamento multi-equipa perto da bola.
 */
function scanPenaltyAreaGkClumpJam(
  positions: readonly RefereeAgentPositionSample[],
  ballX: number,
  ballZ: number,
  half: MatchHalf,
): RefereeConfusionVerdict | null {
  const end = penaltyAreaEndContainingBall(ballX, ballZ);
  if (!end) return null;
  const clumped = positions.filter((p) => Math.hypot(p.x - ballX, p.z - ballZ) <= PA_CLUMP_RADIUS_M);
  if (clumped.length < PA_CLUMP_MIN_PLAYERS) return null;
  const gk = clumped.find((p) => p.role === 'gk' || p.slotId === 'gol');
  if (!gk) return null;
  const defendingHere = defendingTeamAtGoalEnd(end, half);
  if (gk.side !== defendingHere) return null;
  const sides = new Set(clumped.map((p) => p.side));
  if (sides.size < PA_CLUMP_MIN_SIDES) return null;
  const gkTeam = gk.side;
  const awardedSide: PossessionSide = gkTeam === 'home' ? 'away' : 'home';
  return {
    reason: 'box_clump_gk_foul',
    awardedSide,
    foulFoulerId: gk.id,
    foulFoulerSide: gkTeam,
    foulKind: 'gk_box_clump',
  };
}

/**
 * Ajuntamento na grande área **ou** atacante com bola presa no bloco defensivo.
 * Ordem: primeiro atacante (caso típico de “travado na área”), depois falta lógica no GR.
 */
export function scanPenaltyAreaClumpRecovery(
  positions: readonly RefereeAgentPositionSample[],
  ballX: number,
  ballZ: number,
  ballMode: 'held' | 'loose' | 'flight' | 'dead',
  carrierId: string | null,
  half: MatchHalf,
): RefereeConfusionVerdict | null {
  const att = scanPenaltyAreaAttackerHeldJam(positions, ballX, ballZ, ballMode, carrierId, half);
  if (att) return att;
  if (ballMode === 'dead') return null;
  return scanPenaltyAreaGkClumpJam(positions, ballX, ballZ, half);
}
