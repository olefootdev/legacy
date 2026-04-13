import type { LiveMatchSnapshot } from './types';
import { runMatchMinute, type RunMinuteInput } from './runMatchMinute';
import type { PlayerEntity } from '@/entities/types';

/**
 * Modo automático (`/match/auto`): mesma pipeline que a partida rápida — `runMatchMinute` →
 * `buildSpiritContext` + `gameSpiritTick` (OLEFOOT). Probabilidade de tick ligeiramente
 * abaixo da rápida só para ganhar tempo de CPU; **não** se desliga o GameSpirit (isso
 * aplica-se à Partida ao vivo `test2d` com motor tático + `SIM_SYNC`).
 */
const AUTO_MATCH_SPIRIT_TICK_PROB = 0.56;

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
  while (snapshot.phase === 'playing' && snapshot.minute < 90 && guard < 120) {
    guard += 1;
    const roster = simInput.homeRoster.map((r) => merged[r.id] ?? r);
    const out = runMatchMinute({
      ...simInput,
      snapshot,
      homeRoster: roster,
      skipEvent: simInput.skipEvent,
    });
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
