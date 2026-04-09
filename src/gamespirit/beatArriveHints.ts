import type { LiveMatchSnapshot } from '@/engine/types';
import type { BeatPlayerHint, LiveStoryRuntime, StoryTimeline } from './storyContracts';
import { TacticalIntent } from './storyContracts';
import type { AgentMode } from '@/agents/yukaAgents';

export function selectStoryTimelineForHalf(ls: LiveStoryRuntime, half: 1 | 2): StoryTimeline {
  if (half === 1) return ls.timelineFirstHalf;
  return ls.timelineSecondHalf ?? ls.timelineFirstHalf;
}

/** Hints de todos os beats activos no minuto (janela minuteStart–minuteEnd). */
export function collectActiveBeatHints(
  timeline: StoryTimeline,
  displayMinute: number,
): BeatPlayerHint[] {
  const out: BeatPlayerHint[] = [];
  for (const b of timeline.beats) {
    if (displayMinute < b.minuteStart || displayMinute > b.minuteEnd) continue;
    if (b.hints?.length) out.push(...b.hints);
  }
  return out;
}

export function homeAgentMatchesPlayerRef(
  ref: string,
  agent: { id: string; slotId: string; role: string },
): boolean {
  if (ref === agent.id || ref === agent.slotId) return true;
  if (ref === 'attack' && agent.role === 'attack') return true;
  if (ref === 'def' && agent.role === 'def') return true;
  if (ref === 'mid' && agent.role === 'mid') return true;
  if (ref === 'line' && (agent.role === 'def' || agent.role === 'mid')) return true;
  if (ref === 'team' && agent.role !== 'gk') return true;
  return false;
}

export function tacticalIntentToAgentMode(intent: TacticalIntent, phaseMode: AgentMode): AgentMode {
  if (phaseMode === 'reforming') return 'reforming';
  if (intent === TacticalIntent.PressHigh) return 'pressing';
  return phaseMode === 'pressing' ? 'pressing' : 'in_play';
}

export function collectActiveBeatHintsFromLive(
  live: LiveMatchSnapshot | null,
  half: 1 | 2,
  displayMinute: number,
): BeatPlayerHint[] {
  if (!live?.liveStory?.spiritScoresAuthoritative) return [];
  const tl = selectStoryTimelineForHalf(live.liveStory, half);
  return collectActiveBeatHints(tl, displayMinute);
}
