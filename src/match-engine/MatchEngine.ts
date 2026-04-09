import type { PossessionSide } from '@/engine/types';
import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';
import { computePressureOnCarrier } from './pressure';
import { pitchZoneFromBallX } from './zones';
import { attackingThirdForSide, buildZoneForSide } from './zones';
import { FORMATION_BASES } from './formations/catalog';
import type { FormationSchemeId, PlayBeat, EngineSlotIntent, MatchEngineFrame, PitchZone, PossessionContext, PossessionState, PressureReading } from './types';
import { PlayStoryTracker } from './playStory';

export interface MatchEngineStepInput {
  dt: number;
  ballX: number;
  ballZ: number;
  livePossession: PossessionSide;
  onBallPlayerId?: string | null;
  contestCarrierId: string | null;
  homePlayers: { id: string; x: number; z: number }[];
  awayPlayers: { id: string; x: number; z: number }[];
  manager: { tacticalMentality: number; defensiveLine: number; tempo: number };
  homeScheme: FormationSchemeId;
  awayScheme: FormationSchemeId;
}

const NEUTRAL_PRESSURE: PressureReading = {
  opponentsWithin6m: 0,
  opponentsWithin12m: 0,
  closestOpponentM: 24,
  intensity: 0,
};

function derivePossessionContext(
  side: PossessionSide,
  ballX: number,
  storyBeat: PlayBeat,
  storyTimeInBeat: number,
): PossessionContext {
  if (storyBeat === 'recovery' && storyTimeInBeat < 1.05) {
    return 'transition_attack';
  }
  if (buildZoneForSide(side, ballX)) return 'build';
  if (attackingThirdForSide(side, ballX)) return 'attack';
  return 'progression';
}

function shiftAttackingSlot(
  nx: number,
  nz: number,
  line: EngineSlotIntent['line'],
  slot: string,
  ballX: number,
  ballZ: number,
  manager: MatchEngineStepInput['manager'],
  context: PossessionContext,
  storyBeat: PlayBeat,
  pressure: PressureReading,
): { nx: number; nz: number } {
  const mind = (manager.tacticalMentality - 50) / 100;
  const defL = (manager.defensiveLine - 50) / 120;
  const press = (manager.tacticalMentality - 50) / 200;
  const bx = ballX / FIELD_LENGTH;
  const bz = ballZ / FIELD_WIDTH;
  let nx2 = nx + mind * 0.06 + (bx - 0.5) * 0.085 * (1 + press) - defL * 0.05;
  let nz2 = nz;

  if (context === 'transition_attack') {
    nx2 += 0.032;
  }
  if (context === 'attack' || storyBeat === 'chance_creation' || storyBeat === 'finishing') {
    if (line === 'att') nx2 += 0.022;
    if (slot === 'pe' || slot === 'pd') {
      nz2 = Math.min(0.94, Math.max(0.06, nz + (nz - 0.5) * 0.14));
    }
  }
  if (pressure.intensity > 0.62 && line === 'def') {
    nx2 -= 0.035;
  }
  const tempoBoost = (manager.tempo - 50) / 250;
  nx2 += tempoBoost * 0.04;

  return {
    nx: Math.min(0.93, Math.max(0.05, nx2)),
    nz: Math.min(0.94, Math.max(0.06, nz2 + (bz - 0.5) * 0.04 * (slot === 'mc1' || slot === 'mc2' ? 1 : 0.35))),
  };
}

function shiftDefendingSlot(
  nx: number,
  nz: number,
  slot: string,
  ballX: number,
  ballZ: number,
  manager: MatchEngineStepInput['manager'],
  storyBeat: PlayBeat,
): { nx: number; nz: number } {
  const defL = (manager.defensiveLine - 50) / 120;
  const press = (manager.tacticalMentality - 50) / 200;
  const bx = ballX / FIELD_LENGTH;
  const bz = ballZ / FIELD_WIDTH;
  const pressHigh = manager.tacticalMentality > 76;

  let nx2 = nx - defL * 0.09 + (bx - 0.5) * (pressHigh ? 0.09 : 0.055) * (1 + press);
  let nz2 = nz + (bz - 0.5) * 0.05;

  if (storyBeat === 'recovery' || storyBeat === 'organization') {
    nx2 -= pressHigh ? 0.02 : 0.04;
  }

  if (slot === 'pe' || slot === 'pd') {
    nz2 = Math.min(0.94, Math.max(0.06, nz2 + (nz - 0.5) * 0.06));
  }

  return {
    nx: Math.min(0.92, Math.max(0.06, nx2)),
    nz: Math.min(0.94, Math.max(0.06, nz2)),
  };
}

function findCarrierPosition(
  carrierId: string | null,
  homePlayers: MatchEngineStepInput['homePlayers'],
  awayPlayers: MatchEngineStepInput['awayPlayers'],
): { x: number; z: number } | null {
  if (!carrierId) return null;
  const h = homePlayers.find((p) => p.id === carrierId);
  if (h) return { x: h.x, z: h.z };
  const a = awayPlayers.find((p) => p.id === carrierId);
  if (a) return { x: a.x, z: a.z };
  return null;
}

export class MatchEngine {
  private story = new PlayStoryTracker();

  reset() {
    this.story.reset();
  }

  step(input: MatchEngineStepInput): MatchEngineFrame {
    const {
      dt,
      ballX,
      ballZ,
      livePossession,
      onBallPlayerId,
      contestCarrierId,
      homePlayers,
      awayPlayers,
      manager,
      homeScheme,
      awayScheme,
    } = input;

    let side: PossessionSide = livePossession;
    let carrierPlayerId: string | null = onBallPlayerId ?? null;
    if (contestCarrierId) {
      carrierPlayerId = contestCarrierId;
      side = contestCarrierId.startsWith('away-') ? 'away' : 'home';
    }

    const ballZone: PitchZone = pitchZoneFromBallX(ballX);

    const story = this.story.tick({
      dt,
      ballX,
      possessionSide: side,
      ballZone,
    });

    const possessionContext = derivePossessionContext(side, ballX, story.beat, story.timeInBeat);

    const carrierPos = findCarrierPosition(carrierPlayerId, homePlayers, awayPlayers);
    const opps = side === 'home' ? awayPlayers : homePlayers;
    const pressure: PressureReading = carrierPos
      ? computePressureOnCarrier(carrierPos.x, carrierPos.z, opps.map((p) => ({ x: p.x, z: p.z })))
      : NEUTRAL_PRESSURE;

    const possession: PossessionState = {
      side,
      carrierPlayerId,
      context: possessionContext,
      ballZone,
      pressure,
    };

    const homeSlots = this.buildSlotsForTeam(
      side === 'home',
      homeScheme,
      ballX,
      ballZ,
      manager,
      possessionContext,
      story.beat,
      pressure,
    );
    const awaySlots = this.buildSlotsForTeam(
      side === 'away',
      awayScheme,
      ballX,
      ballZ,
      manager,
      possessionContext,
      story.beat,
      pressure,
    );

    return {
      possession,
      story,
      homeSlots,
      awaySlots,
    };
  }

  private buildSlotsForTeam(
    hasBall: boolean,
    scheme: FormationSchemeId,
    ballX: number,
    ballZ: number,
    manager: MatchEngineStepInput['manager'],
    possessionContext: PossessionContext,
    storyBeat: PlayBeat,
    pressure: PressureReading,
  ): Map<string, EngineSlotIntent> {
    const bases = FORMATION_BASES[scheme];
    const out = new Map<string, EngineSlotIntent>();
    if (!bases) return out;

    for (const [slot, base] of Object.entries(bases)) {
      const shifted = hasBall
        ? shiftAttackingSlot(
            base.nx,
            base.nz,
            base.line,
            slot,
            ballX,
            ballZ,
            manager,
            possessionContext,
            storyBeat,
            pressure,
          )
        : shiftDefendingSlot(base.nx, base.nz, slot, ballX, ballZ, manager, storyBeat);
      out.set(slot, { nx: shifted.nx, nz: shifted.nz, line: base.line });
    }
    return out;
  }
}
