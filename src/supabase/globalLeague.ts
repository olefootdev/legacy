/**
 * Leitura da Liga Global do Supabase (hidratação) + registro de identidade
 * do time do manager. A Edge Function `global-league-tick` é a ÚNICA fonte
 * de verdade para ranking, pontos, fixtures, eventos. O frontend nunca
 * reescreve esse estado — só lê.
 */

import { getSupabase, isSupabaseConfigured } from './client';
import type { GlobalLeagueMVPState, GlobalTeam, PlayoffRound, LeagueRound } from '@/match/globalLeagueMVP';
import type { GlobalFixture, GlobalMatchEvent } from '@/match/globalMatch';

const SINGLETON_STATE_ID = 'current';

// ─── Operações públicas ──────────────────────────────────────────────────

/**
 * Registra a identidade do time do manager — apenas se ainda NÃO existe
 * (insert-if-absent). Se já existe linha com o mesmo manager_id, NÃO faz
 * nada: nunca mutar a PK (id) de um time existente — fixtures/events
 * referenciam essa PK e seriam orfanados.
 *
 * Stats (pontos, vitórias, divisão, all-time) NUNCA saem do cliente. A
 * Edge Function é a única autoridade sobre o ranking.
 */
export async function registerGlobalTeamIdentity(opts: {
  id: string;
  managerId: string;
  clubName: string;
  clubShort: string;
  overall: number;
  registeredAt?: number;
}): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'supabase-not-configured' };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'no-client' };

  try {
    const { data: existing, error: selErr } = await supabase
      .from('global_league_teams')
      .select('id')
      .eq('manager_id', opts.managerId)
      .maybeSingle();
    if (selErr) {
      console.warn('[globalLeague] registerGlobalTeamIdentity select error:', selErr.message);
      return { ok: false, error: selErr.message };
    }
    if (existing) {
      // Time já existe — não tocar. Mutar a PK orfana fixtures/events.
      return { ok: true };
    }
    const { error: insErr } = await supabase
      .from('global_league_teams')
      .insert({
        id: opts.id,
        manager_id: opts.managerId,
        club_name: opts.clubName,
        club_short: opts.clubShort,
        overall: opts.overall,
        registered_at: new Date(opts.registeredAt ?? Date.now()).toISOString(),
      });
    if (insErr) {
      console.warn('[globalLeague] registerGlobalTeamIdentity insert error:', insErr.message);
      return { ok: false, error: insErr.message };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function loadGlobalLeagueFromSupabase(): Promise<GlobalLeagueMVPState | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const { data: stateRow, error: stateErr } = await supabase
      .from('global_league_state')
      .select('*')
      .eq('id', SINGLETON_STATE_ID)
      .maybeSingle();
    if (stateErr || !stateRow) return null;

    const seasonId: string = stateRow.season_id;

    const [teamsRes, roundsRes, fixturesRes, eventsRes] = await Promise.all([
      supabase.from('global_league_teams').select('*'),
      supabase.from('global_league_rounds').select('*').eq('season_id', seasonId),
      supabase.from('global_league_fixtures').select('*'),
      supabase.from('global_league_events').select('*'),
    ]);

    const teams: GlobalTeam[] = (teamsRes.data ?? []).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      managerId: String(r.manager_id),
      clubName: String(r.club_name),
      clubShort: String(r.club_short),
      overall: Number(r.overall),
      division: r.division == null ? undefined : Number(r.division),
      position: r.position == null ? undefined : Number(r.position),
      previousPosition: r.previous_position == null ? undefined : Number(r.previous_position),
      playoffPoints: Number(r.playoff_points ?? 0),
      playoffMatchesPlayed: Number(r.playoff_matches_played ?? 0),
      playoffWins: Number(r.playoff_wins ?? 0),
      playoffDraws: Number(r.playoff_draws ?? 0),
      playoffLosses: Number(r.playoff_losses ?? 0),
      playoffGoalsFor: Number(r.playoff_goals_for ?? 0),
      playoffGoalsAgainst: Number(r.playoff_goals_against ?? 0),
      points: Number(r.points ?? 0),
      matchesPlayed: Number(r.matches_played ?? 0),
      wins: Number(r.wins ?? 0),
      draws: Number(r.draws ?? 0),
      losses: Number(r.losses ?? 0),
      goalsFor: Number(r.goals_for ?? 0),
      goalsAgainst: Number(r.goals_against ?? 0),
      goalDifference: Number(r.goal_difference ?? 0),
      recentForm: (r.recent_form as Array<'W' | 'D' | 'L'>) ?? [],
      registeredAt: r.registered_at ? new Date(String(r.registered_at)).getTime() : Date.now(),
      // ALL-TIME — fallback 0 antes da migration
      allTimePoints: Number(r.all_time_points ?? 0),
      allTimeMatchesPlayed: Number(r.all_time_matches_played ?? 0),
      allTimeWins: Number(r.all_time_wins ?? 0),
      allTimeDraws: Number(r.all_time_draws ?? 0),
      allTimeLosses: Number(r.all_time_losses ?? 0),
      allTimeGoalsFor: Number(r.all_time_goals_for ?? 0),
      allTimeGoalsAgainst: Number(r.all_time_goals_against ?? 0),
      allTimeSeasonsPlayed: Number(r.all_time_seasons_played ?? 0),
      injuryRoundsRemaining: Number(r.injury_rounds_remaining ?? 0),
      injuryModifier: Number(r.injury_modifier ?? 0),
      yellowCardCount: Number(r.yellow_card_count ?? 0),
      suspensionRoundsRemaining: Number(r.suspension_rounds_remaining ?? 0),
    }));

    // Indexar fixtures e eventos por round_id
    const eventsByFixture = new Map<string, GlobalMatchEvent[]>();
    for (const ev of eventsRes.data ?? []) {
      const e = ev as Record<string, unknown>;
      const fxId = String(e.fixture_id);
      const list = eventsByFixture.get(fxId) ?? [];
      list.push({
        id: String(e.id),
        fixtureId: fxId,
        type: e.event_type as GlobalMatchEvent['type'],
        minute: Number(e.minute),
        timestampMs: Number(e.timestamp_ms),
        side: e.side as GlobalMatchEvent['side'],
        playerName: e.player_name ? String(e.player_name) : undefined,
        playerId: e.player_id ? String(e.player_id) : undefined,
        text: String(e.text),
        highlight: Boolean(e.highlight),
      });
      eventsByFixture.set(fxId, list);
    }

    const fixturesByRound = new Map<string, GlobalFixture[]>();
    for (const fx of fixturesRes.data ?? []) {
      const f = fx as Record<string, unknown>;
      const roundId = String(f.round_id);
      const fixture: GlobalFixture = {
        id: String(f.id),
        roundId,
        division: String(f.division),
        homeTeamId: String(f.home_team_id),
        awayTeamId: String(f.away_team_id),
        homeTeamName: String(f.home_team_name),
        awayTeamName: String(f.away_team_name),
        homeOverall: Number(f.home_overall),
        awayOverall: Number(f.away_overall),
        scoreHome: Number(f.score_home ?? 0),
        scoreAway: Number(f.score_away ?? 0),
        currentMinute: Number(f.current_minute ?? 0),
        events: eventsByFixture.get(String(f.id)) ?? [],
        status: f.status as GlobalFixture['status'],
        kickoffMs: f.kickoff_ms == null ? undefined : Number(f.kickoff_ms),
        finishedAtMs: f.finished_at_ms == null ? undefined : Number(f.finished_at_ms),
      };
      const list = fixturesByRound.get(roundId) ?? [];
      list.push(fixture);
      fixturesByRound.set(roundId, list);
    }

    const playoffRounds: PlayoffRound[] = [];
    const leagueRounds: LeagueRound[] = [];
    for (const rr of roundsRes.data ?? []) {
      const r = rr as Record<string, unknown>;
      const roundId = String(r.id);
      const fixtures = fixturesByRound.get(roundId) ?? [];
      const base = {
        roundNumber: Number(r.round_number),
        fixtures,
        status: r.status as 'scheduled' | 'live' | 'finished',
        scheduledKickoffMs: Number(r.scheduled_kickoff_ms),
        actualKickoffMs: r.actual_kickoff_ms == null ? undefined : Number(r.actual_kickoff_ms),
        finishedAtMs: r.finished_at_ms == null ? undefined : Number(r.finished_at_ms),
      };
      if (r.round_type === 'playoff') {
        playoffRounds.push({ ...base, phase: (r.phase as PlayoffRound['phase']) ?? 'round_1' });
      } else {
        leagueRounds.push(base);
      }
    }
    playoffRounds.sort((a, b) => a.roundNumber - b.roundNumber);
    leagueRounds.sort((a, b) => a.roundNumber - b.roundNumber);

    return {
      seasonId,
      status: stateRow.status as GlobalLeagueMVPState['status'],
      teams,
      minTeamsRequired: 1,
      playoffRounds,
      currentPlayoffRound: stateRow.current_playoff_round == null ? undefined : Number(stateRow.current_playoff_round),
      leagueRounds,
      currentLeagueRound: stateRow.current_league_round == null ? undefined : Number(stateRow.current_league_round),
      teamsPerDivision: Number(stateRow.teams_per_division ?? 11),
      promotionPercentage: Number(stateRow.promotion_percentage ?? 0.1),
      relegationPercentage: Number(stateRow.relegation_percentage ?? 0.1),
      // Slots (Etapa 2)
      matchSlots: Array.isArray(stateRow.match_slots) ? stateRow.match_slots as string[] : undefined,
      slotDurationMin: stateRow.slot_duration_min == null ? undefined : Number(stateRow.slot_duration_min),
      currentOlefootDay: stateRow.current_olefoot_day == null ? undefined : String(stateRow.current_olefoot_day),
      // Competição (Etapa 3)
      competitionId: stateRow.competition_id == null ? undefined : String(stateRow.competition_id),
      competitionStartedAt: stateRow.competition_started_at ? new Date(String(stateRow.competition_started_at)).getTime() : undefined,
      competitionDurationDays: stateRow.competition_duration_days == null ? undefined : Number(stateRow.competition_duration_days),
      createdAt: stateRow.created_at ? new Date(String(stateRow.created_at)).getTime() : Date.now(),
      lastUpdated: stateRow.updated_at ? new Date(String(stateRow.updated_at)).getTime() : Date.now(),
    };
  } catch (err) {
    console.warn('[globalLeague] loadGlobalLeagueFromSupabase failed', err);
    return null;
  }
}
