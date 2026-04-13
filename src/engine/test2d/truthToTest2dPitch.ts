/**
 * Converte snapshot do TacticalSimLoop (metros mundo) para `PitchPlayerState` 0–100
 * usado pelo canvas 2D. Visitantes no sim: `away-{slot}`; alinhamos ao `awayRoster`
 * de `START_LIVE_MATCH` (mesma ordem que `TacticalSimLoop` + 4-3-3).
 */
import type { PitchPlayerState } from '@/engine/types';
import type { MatchTruthSnapshot } from '@/bridge/matchTruthSchema';
import { worldToUiPercent } from '@/simulation/field';

/** Índice em `awayRoster` (reducer) por slot — espelha `defaultSlotOrder` / 4-3-3. */
const SLOT_TO_AWAY_ROSTER_INDEX: Record<string, number> = {
  gol: 0,
  zag1: 1,
  zag2: 2,
  le: 3,
  ld: 4,
  vol: 5,
  mc1: 6,
  mc2: 7,
  pe: 8,
  pd: 9,
  ata: 10,
};

function roleFromSlotId(slot: string): PitchPlayerState['role'] {
  if (slot === 'gol') return 'gk';
  if (slot === 'zag1' || slot === 'zag2' || slot === 'le' || slot === 'ld' || slot === 'vol') return 'def';
  if (slot === 'mc1' || slot === 'mc2') return 'mid';
  return 'attack';
}

function awaySlotFromSimId(simId: string): string | null {
  if (!simId.startsWith('away-')) return null;
  return simId.slice('away-'.length);
}

function coercePitchRole(r: string | undefined): PitchPlayerState['role'] {
  if (r === 'gk' || r === 'def' || r === 'mid' || r === 'attack') return r;
  return 'mid';
}

export function truthSnapshotToTest2dPitch(args: {
  snap: MatchTruthSnapshot;
  homePlayers: PitchPlayerState[];
  awayRoster: { id: string; num: number; name: string; pos: string }[];
}): {
  homePitch: PitchPlayerState[];
  awayPitch: PitchPlayerState[];
  ball: { x: number; y: number };
} {
  const { snap, homePlayers, awayRoster } = args;
  const byHomeId = new Map(homePlayers.map((p) => [p.playerId, p]));

  const homePitch: PitchPlayerState[] = [];
  const awayPitch: PitchPlayerState[] = [];

  for (const tp of snap.players) {
    const { ux, uy } = worldToUiPercent(tp.x, tp.z);
    if (tp.side === 'home') {
      const base = byHomeId.get(tp.id);
      homePitch.push({
        playerId: tp.id,
        slotId: base?.slotId ?? 'mc1',
        name: base?.name ?? `#${tp.shirtNumber ?? ''}`,
        num: base?.num ?? tp.shirtNumber ?? 0,
        pos: base?.pos ?? String(tp.role),
        x: ux,
        y: uy,
        fatigue: base?.fatigue ?? 50,
        role: base?.role ?? coercePitchRole(tp.role),
        attributes: base?.attributes,
        cognitiveArchetype: base?.cognitiveArchetype,
      });
    } else {
      const slot = awaySlotFromSimId(tp.id);
      const idx = slot != null ? SLOT_TO_AWAY_ROSTER_INDEX[slot] : undefined;
      const roster = idx !== undefined ? awayRoster[idx] : undefined;
      const role = slot ? roleFromSlotId(slot) : 'mid';
      awayPitch.push({
        playerId: roster?.id ?? tp.id,
        slotId: slot ?? 'mc1',
        name: roster?.name ?? `#${tp.shirtNumber ?? ''}`,
        num: roster?.num ?? tp.shirtNumber ?? 0,
        pos: roster?.pos ?? String(tp.role),
        x: ux,
        y: uy,
        fatigue: 50,
        role,
      });
    }
  }

  const b = snap.ball;
  const ballPt = worldToUiPercent(b.x, b.z);
  return { homePitch, awayPitch, ball: { x: ballPt.ux, y: ballPt.uy } };
}

/** Converte `carrierId` do sim para o `playerId` usado no store / highlight. */
export function carrierIdToStoreOnBallId(
  carrierId: string | null | undefined,
  awayRoster: { id: string }[],
): string | undefined {
  if (!carrierId) return undefined;
  if (!carrierId.startsWith('away-')) return carrierId;
  const slot = awaySlotFromSimId(carrierId);
  if (!slot) return carrierId;
  const idx = SLOT_TO_AWAY_ROSTER_INDEX[slot];
  const r = idx !== undefined ? awayRoster[idx] : undefined;
  return r?.id ?? carrierId;
}
