import type { LiveMatchSnapshot } from './types';
import { runMatchMinute, type RunMinuteInput } from './runMatchMinute';
import type { PlayerEntity } from '@/entities/types';

export function runMatchMinuteBulk(
  input: RunMinuteInput & { steps: number },
): { snapshot: LiveMatchSnapshot; updatedPlayers: Record<string, PlayerEntity> } {
  let snapshot = input.snapshot;
  const merged: Record<string, PlayerEntity> = {};
  const steps = Math.max(1, Math.min(input.steps, 120));
  for (let i = 0; i < steps; i++) {
    if (snapshot.phase !== 'playing' || snapshot.minute >= 90) break;
    const roster = input.homeRoster.map((r) => merged[r.id] ?? r);
    const out = runMatchMinute({ ...input, snapshot, homeRoster: roster });
    snapshot = out.snapshot;
    Object.assign(merged, out.updatedPlayers);
  }
  return { snapshot, updatedPlayers: merged };
}

export function advanceMatchToPostgame(input: RunMinuteInput): {
  snapshot: LiveMatchSnapshot;
  updatedPlayers: Record<string, PlayerEntity>;
} {
  let snapshot = input.snapshot;
  const merged: Record<string, PlayerEntity> = {};
  let guard = 0;
  while (snapshot.phase === 'playing' && snapshot.minute < 90 && guard < 120) {
    guard += 1;
    const roster = input.homeRoster.map((r) => merged[r.id] ?? r);
    const out = runMatchMinute({ ...input, snapshot, homeRoster: roster });
    snapshot = out.snapshot;
    Object.assign(merged, out.updatedPlayers);
  }
  if (snapshot.minute >= 90 && snapshot.phase === 'playing') {
    snapshot = {
      ...snapshot,
      phase: 'postgame',
      events: [
        {
          id: `ft-sim-${Date.now()}`,
          minute: 90,
          text: `90' — Apito final.`,
          kind: 'whistle',
        },
        ...snapshot.events,
      ],
    };
  }
  return { snapshot, updatedPlayers: merged };
}
