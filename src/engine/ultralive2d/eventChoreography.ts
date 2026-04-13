/**
 * ultralive2d — mapa causal → coreografia (duração, heróis, offsets).
 *
 * Evento → animação (resumo):
 * - shot_attempt + shot_result(goal/post_in) → bola rematador→golo (longo); heróis: rematador + (visitante) ou GR (casa).
 * - shot_result(save) → bola → zona GR; heróis: rematador + GR defensor.
 * - shot_result(block) → bola para linha de bloqueio; heróis: rematador + defesa mais próxima da trajetória.
 * - shot_result(wide/post_out/miss…) → bola para fora; heróis: rematador.
 *
 * Autoridade: geometria base vem de `visualBeatGeometryFromCausalBatch` (par shot no lote).
 */
import type { PitchPoint } from '@/engine/types';
import type { PitchPlayerState } from '@/engine/types';
import type { CausalMatchEvent } from '@/match/causal/matchCausalTypes';
import {
  visualBeatGeometryFromCausalBatch,
  type Test2dVisualBeatGeometry,
} from '@/engine/test2d/visualBeatFromCausal';
import type { MatchEventEntry, Ultralive2dStagedPlay } from '@/engine/types';

const DUR_MULT_GOAL = 1.08;
const DUR_MULT_SAVE = 1.12;
const SUBSTEPS_GOAL = 16;
const SUBSTEPS_SAVE = 12;
const SUBSTEPS_DEFAULT = 10;

function hashSeq(n: number): number {
  let x = Math.imul(n, 2654435761) >>> 0;
  x ^= x >>> 16;
  return (x >>> 0) / 0xffffffff;
}

function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function nearestOpponentToSegment(
  opponents: PitchPlayerState[] | undefined,
  fx: number, fy: number, tx: number, ty: number,
): PitchPlayerState | undefined {
  if (!opponents?.length) return undefined;
  let best: PitchPlayerState | undefined;
  let bestD = 1e9;
  for (const p of opponents) {
    const t = 0.5;
    const mx = fx + (tx - fx) * t;
    const my = fy + (ty - fy) * t;
    const d = dist2(p.x, p.y, mx, my);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

function homeGoalkeeper(home: PitchPlayerState[]): PitchPlayerState | undefined {
  return home.find((p) => p.role === 'gk') ?? home[0];
}

function burstOffsets(
  heroIds: string[],
  kind: string,
  seq: number,
  homePlayers: PitchPlayerState[],
  awayPlayers: PitchPlayerState[] | undefined,
): { playerId: string; ox: number; oy: number }[] {
  const h = hashSeq(seq);
  const amp = kind.includes('goal') ? 2.8 : kind.includes('save') ? 2.2 : 1.6;
  const out: { playerId: string; ox: number; oy: number }[] = [];
  let i = 0;
  for (const id of heroIds) {
    const ang = (h + i * 0.31) * Math.PI * 2;
    const r = amp * (0.4 + hashSeq(seq + i + 7));
    out.push({
      playerId: id,
      ox: Math.cos(ang) * r * 0.35,
      oy: Math.sin(ang) * r * 0.5,
    });
    i++;
  }
  void homePlayers;
  void awayPlayers;
  return out;
}

export function ultraliveGeometryFromCausalBatch(
  batch: CausalMatchEvent[],
  preTickBall: PitchPoint,
  homePlayers: PitchPlayerState[],
  awayPitchPlayers: PitchPlayerState[] | undefined,
): Test2dVisualBeatGeometry | null {
  return visualBeatGeometryFromCausalBatch(batch, preTickBall, homePlayers, awayPitchPlayers);
}

export function buildUltralive2dStagedPlay(args: {
  geometry: Test2dVisualBeatGeometry;
  causalBatch: CausalMatchEvent[];
  deferredFeedEvent: MatchEventEntry;
  homePlayers: PitchPlayerState[];
  awayPitchPlayers: PitchPlayerState[] | undefined;
}): Ultralive2dStagedPlay {
  const { geometry, causalBatch, deferredFeedEvent, homePlayers, awayPitchPlayers } = args;

  const attempt = causalBatch.find(
    (e): e is Extract<CausalMatchEvent, { type: 'shot_attempt' }> =>
      e.type === 'shot_attempt' && e.seq === geometry.causalSeqAnchor,
  );
  const shooterId = attempt?.payload.shooterId ?? '';
  const side = attempt?.payload.side ?? 'home';

  const heroPlayerIds: string[] = [];
  if (shooterId) heroPlayerIds.push(shooterId);

  if (geometry.kind === 'goal_home') {
    const gk = awayPitchPlayers?.find((p) => p.role === 'gk');
    if (gk && gk.playerId !== shooterId) heroPlayerIds.push(gk.playerId);
  } else if (geometry.kind === 'goal_away') {
    const gk = homeGoalkeeper(homePlayers);
    if (gk && gk.playerId !== shooterId) heroPlayerIds.push(gk.playerId);
  } else if (geometry.kind === 'shot_save') {
    if (side === 'home') {
      const gk = awayPitchPlayers?.find((p) => p.role === 'gk');
      if (gk && gk.playerId !== shooterId) heroPlayerIds.push(gk.playerId);
    } else {
      const gk = homeGoalkeeper(homePlayers);
      if (gk && gk.playerId !== shooterId) heroPlayerIds.push(gk.playerId);
    }
  } else if (geometry.kind === 'shot_block') {
    const opp = side === 'home' ? awayPitchPlayers : homePlayers;
    const blk = nearestOpponentToSegment(
      opp,
      geometry.ballFrom.x,
      geometry.ballFrom.y,
      geometry.ballTo.x,
      geometry.ballTo.y,
    );
    if (blk && blk.playerId !== shooterId) heroPlayerIds.push(blk.playerId);
  }

  let durationMs = geometry.durationMs;
  let substeps = SUBSTEPS_DEFAULT;
  if (geometry.kind === 'goal_home' || geometry.kind === 'goal_away') {
    durationMs = Math.round(geometry.durationMs * DUR_MULT_GOAL);
    substeps = SUBSTEPS_GOAL;
  } else if (geometry.kind === 'shot_save') {
    durationMs = Math.round(geometry.durationMs * DUR_MULT_SAVE);
    substeps = SUBSTEPS_SAVE;
  }

  const heroBurstOffsets = burstOffsets(heroPlayerIds, geometry.kind, geometry.causalSeqAnchor, homePlayers, awayPitchPlayers);

  return {
    causalSeqAnchor: geometry.causalSeqAnchor,
    kind: geometry.kind,
    ballFrom: geometry.ballFrom,
    ballTo: geometry.ballTo,
    durationMs,
    substeps,
    deferredFeedEvent,
    heroPlayerIds: heroPlayerIds.slice(0, 2),
    heroBurstOffsets: heroBurstOffsets.filter((o) => heroPlayerIds.slice(0, 2).includes(o.playerId)),
  };
}
