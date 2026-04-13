import { getSupabase } from './client';
import type { MatchEventEntry } from '@/engine/types';

let _pendingEvents: { match_id: string; minute: number; kind: string; payload: Record<string, unknown> }[] = [];
let _flushTimer: ReturnType<typeof setTimeout> | null = null;

const FLUSH_INTERVAL_MS = 3000;
const FLUSH_BATCH_SIZE = 50;

function scheduleFlush() {
  if (_flushTimer) return;
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    void flushEvents();
  }, FLUSH_INTERVAL_MS);
}

async function flushEvents() {
  const sb = getSupabase();
  if (!sb || _pendingEvents.length === 0) return;
  const batch = _pendingEvents.splice(0, FLUSH_BATCH_SIZE);
  try {
    const { error } = await sb.from('match_events').insert(batch as never);
    if (error) {
      console.warn('[matchPersistence] flush error:', error.message);
      _pendingEvents.unshift(...batch);
    }
  } catch (e) {
    console.warn('[matchPersistence] flush exception:', e);
    _pendingEvents.unshift(...batch);
  }
  if (_pendingEvents.length > 0) scheduleFlush();
}

export async function insertMatch(input: {
  homeClubId: string;
  awayName: string;
  mode: 'quick' | 'auto' | 'test2d';
  simulationSeed?: number;
}): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from('matches')
      .insert({
        home_club_id: input.homeClubId,
        away_name: input.awayName,
        mode: input.mode,
        status: 'live',
        simulation_seed: input.simulationSeed ?? null,
        started_at: new Date().toISOString(),
      } as never)
      .select('id')
      .single();
    if (error) {
      console.warn('[matchPersistence] insertMatch error:', error.message);
      return null;
    }
    return (data as { id: string } | null)?.id ?? null;
  } catch (e) {
    console.warn('[matchPersistence] insertMatch exception:', e);
    return null;
  }
}

export function queueMatchEvents(matchId: string, events: MatchEventEntry[]) {
  for (const ev of events) {
    _pendingEvents.push({
      match_id: matchId,
      minute: ev.minute,
      kind: ev.kind,
      payload: { text: ev.text, id: ev.id },
    });
  }
  scheduleFlush();
}

export async function finalizeMatch(
  matchId: string,
  scoreHome: number,
  scoreAway: number,
  postMatchData?: Record<string, unknown>,
) {
  await flushEvents();
  const sb = getSupabase();
  if (!sb) return;
  try {
    const { error } = await sb
      .from('matches')
      .update({
        status: 'finished',
        score_home: scoreHome,
        score_away: scoreAway,
        ended_at: new Date().toISOString(),
        post_match_data: postMatchData ?? null,
      } as never)
      .eq('id', matchId);
    if (error) {
      console.warn('[matchPersistence] finalizeMatch error:', error.message);
    }
  } catch (e) {
    console.warn('[matchPersistence] finalizeMatch exception:', e);
  }
}

export async function persistPlayers(
  clubId: string,
  players: Array<{
    id: string;
    name: string;
    num: number;
    pos: string;
    archetype: string;
    zone: string;
    behavior: string;
    attributes: Record<string, number>;
    fatigue: number;
    injuryRisk: number;
    evolutionXp: number;
    outForMatches: number;
  }>,
) {
  const sb = getSupabase();
  if (!sb) return;
  for (const p of players) {
    try {
      await sb.from('players').upsert(
        {
          id: p.id,
          club_id: clubId,
          name: p.name,
          num: p.num,
          pos: p.pos,
          archetype: p.archetype,
          zone: p.zone,
          behavior: p.behavior,
          attributes: p.attributes,
          fatigue: p.fatigue,
          injury_risk: p.injuryRisk,
          evolution_xp: p.evolutionXp,
          out_for_matches: p.outForMatches,
        } as never,
        { onConflict: 'id' },
      );
    } catch {
      // non-critical
    }
  }
}
