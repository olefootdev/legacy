/**
 * TESTE 2D — Deriva coreografia visual a partir do lote causal do minuto.
 * Autoridade: shot_attempt + shot_result (e metadados) no log; o viewer anima
 * bola de ballFrom → ballTo antes de mostrar a linha do feed (deferredFeedEvent).
 */
import type { PitchPoint } from '@/engine/types';
import type { CausalMatchEvent } from '@/match/causal/matchCausalTypes';
import type { PitchPlayerState } from '@/engine/types';
import { FIELD_LENGTH, FIELD_WIDTH, GOAL_MOUTH_HALF_WIDTH_M } from '@/simulation/field';
import { sfGetGoalContext, sfGetPostZone, sfSnapshot } from '@/smartfield/smartfieldBridge';

export type Test2dVisualBeatKind =
  | 'goal_home'
  | 'goal_away'
  | 'shot_save'
  | 'shot_block'
  | 'shot_wide'
  | 'shot_miss';

const DUR_GOAL_MS = 1_400;
const DUR_SAVE_MS = 950;
const DUR_BLOCK_MS = 750;
const DUR_WIDE_MS = 1_050;

/** Metade da boca em coordenadas UI 0–100 (largura) — remates “ao lado” ficam logo fora do poste, não na banda. */
const GOAL_MOUTH_HALF_UY = (GOAL_MOUTH_HALF_WIDTH_M / FIELD_WIDTH) * 100;

function findPlayer(players: PitchPlayerState[] | undefined, id: string): PitchPlayerState | undefined {
  return players?.find((p) => p.playerId === id);
}

function defaultBallFrom(
  shooter: PitchPlayerState | undefined,
  fallback: PitchPoint,
): PitchPoint {
  if (!shooter) return { ...fallback };
  return { x: shooter.x, y: shooter.y };
}

/**
 * Percorre o lote (ordem append) e devolve o último par attempt+result no lote.
 */
function lastShotPairInBatch(events: CausalMatchEvent[]): {
  attempt: Extract<CausalMatchEvent, { type: 'shot_attempt' }>;
  result: Extract<CausalMatchEvent, { type: 'shot_result' }>;
} | null {
  let attempt: Extract<CausalMatchEvent, { type: 'shot_attempt' }> | null = null;
  let pair: {
    attempt: Extract<CausalMatchEvent, { type: 'shot_attempt' }>;
    result: Extract<CausalMatchEvent, { type: 'shot_result' }>;
  } | null = null;

  for (const e of events) {
    if (e.type === 'shot_attempt') attempt = e;
    else if (e.type === 'shot_result' && attempt && attempt.payload.shooterId === e.payload.shooterId && attempt.payload.side === e.payload.side) {
      pair = { attempt, result: e };
    }
  }
  return pair;
}

export interface Test2dVisualBeatGeometry {
  kind: Test2dVisualBeatKind;
  causalSeqAnchor: number;
  ballFrom: PitchPoint;
  ballTo: PitchPoint;
  durationMs: number;
}

/**
 * Calcula só geometria + tipo; `deferredFeedEvent` junta-se em runMatchMinute.
 */
export function visualBeatGeometryFromCausalBatch(
  batch: CausalMatchEvent[],
  preTickBall: PitchPoint,
  homePlayers: PitchPlayerState[],
  awayPitchPlayers: PitchPlayerState[] | undefined,
): Test2dVisualBeatGeometry | null {
  const pair = lastShotPairInBatch(batch);
  if (!pair) return null;

  const { attempt, result } = pair;
  const side = attempt.payload.side;
  const shooterId = attempt.payload.shooterId;
  const roster = side === 'home' ? homePlayers : awayPitchPlayers ?? [];
  const shooter = findPlayer(roster, shooterId);
  const ballFrom = defaultBallFrom(shooter, preTickBall);
  const target = attempt.payload.target;

  const out = result.payload.outcome;

  const strike = attempt.payload.strike;

  if (out === 'goal' || out === 'post_in') {
    let ballTo: PitchPoint;
    if (target) {
      ballTo = { x: target.x, y: target.y };
    } else {
      const attackDir: 1 | -1 = side === 'home' ? 1 : -1;
      const sf = sfSnapshot();
      const goal = attackDir === 1 ? sf.goals.east : sf.goals.west;
      const goalUx = (goal.goal_line_x / FIELD_LENGTH) * 100;
      const nearPostUy = (goal.near_post.z / FIELD_WIDTH) * 100;
      const farPostUy = (goal.far_post.z / FIELD_WIDTH) * 100;
      const goalCenterUy = (nearPostUy + farPostUy) / 2;
      const spread = (farPostUy - nearPostUy) * 0.35;
      ballTo = {
        x: side === 'home' ? Math.min(99, goalUx - 0.5) : Math.max(1, goalUx + 0.5),
        y: goalCenterUy + (Math.random() - 0.5) * spread,
      };
    }
    const durGoal =
      strike === 'power' ? DUR_GOAL_MS + 180 : strike === 'weak' ? DUR_GOAL_MS - 220 : DUR_GOAL_MS;
    return {
      kind: side === 'home' ? 'goal_home' : 'goal_away',
      causalSeqAnchor: attempt.seq,
      ballFrom,
      ballTo,
      durationMs: durGoal,
    };
  }

  if (out === 'save') {
    const attackDir: 1 | -1 = side === 'home' ? 1 : -1;
    const sf = sfSnapshot();
    const goal = attackDir === 1 ? sf.goals.east : sf.goals.west;
    const penaltySpotUx = (goal.penalty_spot.x / FIELD_LENGTH) * 100;
    const goalCenterUy = (goal.center.z / FIELD_WIDTH) * 100;
    const ballTo = {
      x: side === 'home' ? penaltySpotUx : penaltySpotUx,
      y: goalCenterUy + (Math.random() - 0.5) * 10,
    };
    const durSave =
      strike === 'power' ? DUR_SAVE_MS + 120 : strike === 'weak' ? DUR_SAVE_MS - 180 : DUR_SAVE_MS;
    return {
      kind: 'shot_save',
      causalSeqAnchor: attempt.seq,
      ballFrom,
      ballTo,
      durationMs: durSave,
    };
  }

  if (out === 'block') {
    const midX = side === 'home' ? Math.min(78, ballFrom.x + 14) : Math.max(22, ballFrom.x - 14);
    const durBlock = strike === 'power' ? DUR_BLOCK_MS + 90 : DUR_BLOCK_MS;
    return {
      kind: 'shot_block',
      causalSeqAnchor: attempt.seq,
      ballFrom,
      ballTo: { x: midX, y: ballFrom.y + (Math.random() * 10 - 5) },
      durationMs: durBlock,
    };
  }

  if (out === 'wide' || out === 'post_out' || out === 'miss' || out === 'miss_far') {
    const pastPostUy = GOAL_MOUTH_HALF_UY + 0.9 + Math.random() * 2.4;
    const sign = Math.random() < 0.5 ? -1 : 1;
    const ballTo = target
      ? {
          x: Math.min(99.2, Math.max(0.8, target.x + (side === 'home' ? 0.9 : -0.9))),
          y: Math.min(96, Math.max(4, target.y + sign * pastPostUy)),
        }
      : (() => {
          const aimY = 50 + (Math.random() - 0.5) * 4;
          return {
            x: side === 'home' ? 98.6 : 1.4,
            y: Math.min(96, Math.max(4, aimY + sign * pastPostUy)),
          };
        })();
    const durWide =
      strike === 'power' ? DUR_WIDE_MS + 200 : strike === 'weak' ? DUR_WIDE_MS - 150 : DUR_WIDE_MS;
    return {
      kind: 'shot_wide',
      causalSeqAnchor: attempt.seq,
      ballFrom,
      ballTo,
      durationMs: durWide,
    };
  }

  return null;
}
