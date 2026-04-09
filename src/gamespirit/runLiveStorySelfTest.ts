/**
 * GameSpirit ao vivo: pré-jogo sem vencedor, comandos, diff de beats no intervalo.
 * Run: npx tsx src/gamespirit/runLiveStorySelfTest.ts
 */
import { collectActiveBeatHints, homeAgentMatchesPlayerRef } from './beatArriveHints';
import { buildLivePrematchBundle } from './buildLivePrematch';
import { CANONICAL_RELEVANT_COMMAND, scoreCommandRelevance } from './coachCommands';
import { applyRelevantCommandToStoryWeights } from './coachCommands';
import { generateStoryTimeline, countBeatDifferences } from './storyMotor';
import { normalizeMatchAttributes } from '@/match/playerInMatch';
import type { PitchPlayerState } from '@/engine/types';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function assertNoPredictedWinner(obj: unknown) {
  const forbidden = ['predictedWinner', 'expectedWinner', 'likelyScore', 'finalScore', 'winner'];
  const s = JSON.stringify(obj).toLowerCase();
  for (const w of forbidden) {
    assert(!s.includes(w.toLowerCase()), `prematch leak forbidden token: ${w}`);
  }
}

const mockPitchPlayers: PitchPlayerState[] = [
  {
    playerId: 'p1',
    slotId: 'zag1',
    name: 'A',
    num: 4,
    pos: 'DC',
    x: 40,
    y: 50,
    fatigue: 10,
    role: 'def',
    attributes: normalizeMatchAttributes({ marcacao: 82, fisico: 80 }),
  },
  {
    playerId: 'p2',
    slotId: 'mc1',
    name: 'B',
    num: 8,
    pos: 'MC',
    x: 52,
    y: 50,
    fatigue: 12,
    role: 'mid',
    attributes: normalizeMatchAttributes({ passeCurto: 84, tatico: 78 }),
  },
  {
    playerId: 'p3',
    slotId: 'pe',
    name: 'C',
    num: 11,
    pos: 'PE',
    x: 70,
    y: 40,
    fatigue: 11,
    role: 'attack',
    attributes: normalizeMatchAttributes({ finalizacao: 86, velocidade: 82 }),
  },
];

function main() {
  const prematch = buildLivePrematchBundle({
    homePlayers: mockPitchPlayers,
    homeRoster: [],
    opponentStrength: 78,
    homeShort: 'OLE',
    awayShort: 'RIV',
    simulationSeed: 42,
  });

  assertNoPredictedWinner(prematch);
  assert(prematch.storyV1Id === prematch.timelineFirstHalf.id, 'story v1 id aligns with timeline');

  const relOk = scoreCommandRelevance(CANONICAL_RELEVANT_COMMAND);
  assert(relOk.relevant === true, 'canonical command should be relevant');

  const relBad = scoreCommandRelevance('bom dia equipa');
  assert(relBad.relevant === false, 'fluff should be irrelevant');

  const w0 = { ...prematch.storyWeights };
  const w1 = applyRelevantCommandToStoryWeights(w0, relOk, CANONICAL_RELEVANT_COMMAND);
  assert(
    w1.duelIntensity !== w0.duelIntensity || w1.chanceRate !== w0.chanceRate,
    'relevant command should nudge story weights',
  );

  const tl2a = generateStoryTimeline(
    2,
    prematch.matrix,
    prematch.sectorHome,
    prematch.sectorAway,
    prematch.storyWeights,
    111,
  );
  const tl2b = generateStoryTimeline(
    2,
    prematch.matrix,
    prematch.sectorHome,
    prematch.sectorAway,
    { ...prematch.storyWeights, chanceRate: 1.35, duelIntensity: 1.2 },
    999,
  );
  const diff = countBeatDifferences(tl2a, tl2b);
  assert(diff >= 4, `second-half beat diff should be measurable (got ${diff})`);

  const b0 = prematch.timelineFirstHalf.beats.find((b) => b.hints?.length);
  assert(b0 && b0.minuteStart >= 0, 'expected at least one hinted beat');
  const hintsAt = collectActiveBeatHints(prematch.timelineFirstHalf, b0.minuteStart);
  assert(hintsAt.length > 0, 'collectActiveBeatHints should return hints inside beat window');
  assert(
    homeAgentMatchesPlayerRef('mc1', { id: 'x', slotId: 'mc1', role: 'mid' }),
    'slotId ref',
  );
  assert(
    homeAgentMatchesPlayerRef('attack', { id: 'x', slotId: 'pe', role: 'attack' }),
    'attack line ref',
  );

  console.info(`[live-story-selftest] OK prematch story=${prematch.storyV1Id} beatDiff2h=${diff}`);
}

main();
