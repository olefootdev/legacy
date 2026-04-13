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
import type { MatchHalf } from '@/match/fieldZones';
import { clampToPitch } from '@/simulation/field';

const CAUSAL_TAIL = 40;
/** Troca de posse “em espiral” no log — típico de lances ilegíveis em sequência. */
const POSSESSION_FLIP_THRESHOLD = 4;
const POSSESSION_FLIP_WITH_FOULS = 3;
const FOUL_BURST_FOR_CONFUSION = 2;

const SWARM_RADIUS_M = 10;
/** Jogadores de campo (sem GR) dentro do raio da bola — acima disto = ajuntamento. */
const SWARM_OUTFIELD_THRESHOLD = 6;

export type RefereeConfusionReason = 'causal_whirlwind' | 'spatial_swarm';

export interface RefereeConfusionVerdict {
  reason: RefereeConfusionReason;
  awardedSide: PossessionSide;
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
  for (const [sid, b] of Object.entries(homeBases)) {
    home.set(sid, slotToWorld('home', { nx: b.nx, nz: b.nz }));
  }
  for (const [sid, b] of Object.entries(awayBases)) {
    away.set(sid, slotToWorld('away', { nx: b.nx, nz: b.nz }));
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
