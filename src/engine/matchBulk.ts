import type { LiveMatchSnapshot } from './types';
import { runMatchMinute, type RunMinuteInput } from './runMatchMinute';
import type { PlayerEntity } from '@/entities/types';

/**
 * Modo automático (`/match/auto`): mesma pipeline que a partida rápida — `runMatchMinute` →
 * `buildSpiritContext` + `gameSpiritTick` (OLEFOOT). Tick um pouco abaixo da rápida para CPU;
 * lesões/cartões extra desligados em `runMatchMinute` quando `mode === 'auto'` para caber em ~10s.
 */
const AUTO_MATCH_SPIRIT_TICK_PROB = 0.54;

/** Minutos por batch na resolução automática (menos overhead JS entre apitos). */
const AUTO_MINUTES_PER_BATCH = 5;

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
  const isAutoAdvance = input.snapshot.mode === 'auto';
  const simInput: RunMinuteInput = isAutoAdvance
    ? { ...input, spiritTickProb: input.spiritTickProb ?? AUTO_MATCH_SPIRIT_TICK_PROB }
    : input;
  let snapshot = simInput.snapshot;
  const merged: Record<string, PlayerEntity> = {};
  let guard = 0;
  const maxGuard = isAutoAdvance ? 22 : 120;
  while (snapshot.phase === 'playing' && snapshot.minute < 90 && guard < maxGuard) {
    guard += 1;
    const roster = simInput.homeRoster.map((r) => merged[r.id] ?? r);
    if (isAutoAdvance) {
      const steps = Math.min(AUTO_MINUTES_PER_BATCH, 90 - snapshot.minute);
      if (steps <= 0) break;
      const out = runMatchMinuteBulk({
        ...simInput,
        snapshot,
        homeRoster: roster,
        skipEvent: simInput.skipEvent,
        steps,
      });
      snapshot = out.snapshot;
      Object.assign(merged, out.updatedPlayers);
    } else {
      const out = runMatchMinute({
        ...simInput,
        snapshot,
        homeRoster: roster,
        skipEvent: simInput.skipEvent,
      });
      snapshot = out.snapshot;
      Object.assign(merged, out.updatedPlayers);
    }
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
