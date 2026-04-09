import type { LiveMatchClockPeriod, LiveMatchSnapshot } from '@/engine/types';
import { hashStringSeed } from '@/match/seededRng';
import { generateStoryTimeline } from './storyMotor';
import { stepLiveStoryEngine } from './liveStoryEngine';

/**
 * Avança o roteiro GameSpirit para o minuto indicado (um único passo por minuto).
 * Chamado dentro de `SIM_SYNC` para evitar batching de dois reducers na mesma frame.
 */
export function advanceLiveStoryMinute(
  lm: LiveMatchSnapshot,
  displayMinute: number,
  clockPeriod: LiveMatchClockPeriod,
): LiveMatchSnapshot {
  if (!lm.liveStory?.spiritScoresAuthoritative || lm.phase !== 'playing') return lm;
  if (clockPeriod === 'halftime') return lm;
  if (displayMinute <= lm.liveStory.lastStoryMinuteProcessed) return lm;
  if (!lm.livePrematch) return lm;

  let ls = lm.liveStory;
  let timelineSecond = ls.timelineSecondHalf;
  if (clockPeriod === 'second_half' && !timelineSecond) {
    const v2seed = hashStringSeed(`${ls.storyV1Id}|half2|auto`);
    timelineSecond = generateStoryTimeline(
      2,
      lm.livePrematch.matrix,
      lm.livePrematch.sectorHome,
      lm.livePrematch.sectorAway,
      ls.storyWeights,
      v2seed,
    );
    ls = { ...ls, storyV2Id: timelineSecond.id, timelineSecondHalf: timelineSecond };
  }

  const activeHalf = clockPeriod === 'second_half' ? 2 : 1;
  const step = stepLiveStoryEngine({
    displayMinute,
    timelineFirst: ls.timelineFirstHalf,
    timelineSecond: timelineSecond ?? undefined,
    activeHalf,
    weights: ls.storyWeights,
    simulationSeed: lm.simulationSeed ?? 0,
    homeOutfieldIds: lm.homePlayers.map((p) => p.playerId),
    homePlayersBrief: lm.homePlayers.map((p) => ({
      playerId: p.playerId,
      name: p.name,
      role: p.role,
    })),
    awayShort: lm.awayShort,
  });

  let th = ls.timelineFirstHalf;
  let t2 = ls.timelineSecondHalf ?? timelineSecond;
  if (step.updatedFirstHalfBeats) th = { ...th, beats: step.updatedFirstHalfBeats };
  if (step.updatedSecondHalfBeats && t2) t2 = { ...t2, beats: step.updatedSecondHalfBeats };

  const nextLs = {
    ...ls,
    timelineFirstHalf: th,
    timelineSecondHalf: t2 ?? timelineSecond,
    lastStoryMinuteProcessed: displayMinute,
  };

  return {
    ...lm,
    homeScore: lm.homeScore + step.homeScoreDelta,
    awayScore: lm.awayScore + step.awayScoreDelta,
    events: [...step.newEvents, ...lm.events].slice(0, 80),
    liveStory: nextLs,
    spiritPendingRestart: step.spiritPendingRestartSide
      ? { side: step.spiritPendingRestartSide }
      : lm.spiritPendingRestart,
    sentOffPlayerIds: step.redCardHomePlayerId
      ? [...(lm.sentOffPlayerIds ?? []), step.redCardHomePlayerId]
      : lm.sentOffPlayerIds,
  };
}
