import type { MatchTruthPlayer } from '@/bridge/matchTruthSchema';
import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';
import type { MatchHalf } from '@/match/fieldZones';

export interface TacticalContext {
  defensiveLineDepth: number;
  mentality: number;
  ballX: number;
  ballZ: number;
  /** 1 = 1.º tempo; 2 = 2.º tempo (lados IFAB invertidos para clamp por profundidade local). */
  half?: MatchHalf;
}

function toLocalDepth(x: number, side: MatchTruthPlayer['side'], half: MatchHalf): number {
  if (side === 'home') return half === 1 ? x : FIELD_LENGTH - x;
  return half === 1 ? FIELD_LENGTH - x : x;
}

function fromLocalDepth(d: number, side: MatchTruthPlayer['side'], half: MatchHalf): number {
  if (side === 'home') return half === 1 ? d : FIELD_LENGTH - d;
  return half === 1 ? FIELD_LENGTH - d : d;
}

function isForwardSlot(slotId: string | undefined): boolean {
  return slotId === 'ata' || slotId === 'pe' || slotId === 'pd';
}

function isFullbackSlot(slotId: string | undefined): boolean {
  return slotId === 'le' || slotId === 'ld';
}

/**
 * Anchors players to their role zone to maintain team structure.
 * Prevents defenders from pushing into the box, midfielders from
 * going too high, and keeps the team shaped — not a swarm.
 *
 * `slotId` (quando disponível) afinar: pontas/CA mais altos; laterais não sobem à linha de ataque.
 */
export function clampTargetToRoleZone(
  player: Pick<MatchTruthPlayer, 'role' | 'side'> & { slotId?: string },
  rawX: number,
  rawZ: number,
  ctx: TacticalContext,
): { x: number; z: number } {
  const half: MatchHalf = ctx.half ?? 1;
  let local = toLocalDepth(rawX, player.side, half);
  const defDepth = 12 + ctx.defensiveLineDepth * 0.15;
  let attMin = FIELD_LENGTH * 0.42 + ctx.mentality * 0.12;
  if (isForwardSlot(player.slotId)) {
    attMin += 9;
  }

  const defMax = defDepth + 15;
  const midMax = FIELD_LENGTH * 0.65;
  const midMin = defDepth - 2;

  if (player.role === 'gk') {
    local = Math.min(local, 14);
  } else if (player.role === 'def') {
    let cap = defMax;
    if (isFullbackSlot(player.slotId)) {
      cap = Math.min(cap, defDepth + 22);
    }
    local = Math.min(local, cap);
  } else if (player.role === 'attack') {
    local = Math.max(local, attMin);
    local = Math.min(local, FIELD_LENGTH - 4);
  } else if (player.role === 'mid') {
    let lo = midMin;
    let hi = midMax;
    if (player.slotId === 'vol') {
      hi = Math.min(FIELD_LENGTH * 0.72, hi + 6);
    }
    local = Math.min(Math.max(local, lo), hi);
  }

  const x = fromLocalDepth(local, player.side, half);
  const z = Math.min(FIELD_WIDTH - 2, Math.max(2, rawZ));
  return { x, z };
}
