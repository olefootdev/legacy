/**
 * Leitura da Liga Global do Supabase (hidratação) + registro de identidade
 * do time do manager. A Edge Function `global-league-tick` é a ÚNICA fonte
 * de verdade para ranking, pontos, fixtures, eventos. O frontend nunca
 * reescreve esse estado — só lê.
 */

import { getSupabase, isSupabaseConfigured } from './client';
import type { GlobalLeagueMVPState, GlobalTeam, PlayoffRound, LeagueRound, DailyKnockoutRound, DailyCrown } from '@/match/globalLeagueMVP';
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
  /** Time do coração (id api-sports) — denormalizado pra o brasão do adversário na Home. */
  favoriteTeamId?: number | null;
}): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'supabase-not-configured' };
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'no-client' };

  try {
    const { data: existing, error: selErr } = await supabase
      .from('global_league_teams')
      .select('id, favorite_team_id')
      .eq('manager_id', opts.managerId)
      .maybeSingle();
    if (selErr) {
      console.warn('[globalLeague] registerGlobalTeamIdentity select error:', selErr.message);
      return { ok: false, error: selErr.message };
    }
    if (existing) {
      // Backfill do brasão pra quem já está inscrito: só grava se mudou (evita
      // write inútil). Falha de RLS/coluna ausente é tolerada — o card cai no
      // shield neutro sem quebrar o registro.
      const current = (existing as { favorite_team_id?: number | null }).favorite_team_id ?? null;
      const next = opts.favoriteTeamId ?? null;
      if (next != null && next !== current) {
        await supabase
          .from('global_league_teams')
          .update({ favorite_team_id: next })
          .eq('manager_id', opts.managerId);
      }
      return { ok: true };
    }
    const { data: stateRow } = await supabase
      .from('global_league_state').select('status').eq('id', 'current').maybeSingle();
    const leagueActive = (stateRow as { status: string } | null)?.status === 'active';
    const { error: insErr } = await supabase
      .from('global_league_teams')
      .insert({
        id: opts.id,
        manager_id: opts.managerId,
        club_name: opts.clubName,
        club_short: opts.clubShort,
        overall: opts.overall,
        registered_at: new Date(opts.registeredAt ?? Date.now()).toISOString(),
        ...(opts.favoriteTeamId != null ? { favorite_team_id: opts.favoriteTeamId } : {}),
        ...(leagueActive ? { division: 3 } : {}),
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

  // A liga deixou de ser legível por anon (migration 20260717170000: o
  // manager_id guarda e-mail e a tabela tinha leitura pública). getUser()
  // aguarda o initializePromise, então isto também elimina a corrida de boot em
  // que a query saía antes da sessão hidratar e voltava 401.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

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
      engagementScore: Number(r.engagement_score ?? 0),
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
      availablePlayerCount: r.available_player_count != null ? Number(r.available_player_count) : undefined,
      rivalryEncounters: (r.rivalry_encounters as Record<string, number>) ?? undefined,
      // Ciclo diário (Coroa do Dia) — fallback 0 antes da migration
      dailyPoints: Number(r.daily_points ?? 0),
      dailyMatchesPlayed: Number(r.daily_matches_played ?? 0),
      dailyWins: Number(r.daily_wins ?? 0),
      dailyDraws: Number(r.daily_draws ?? 0),
      dailyLosses: Number(r.daily_losses ?? 0),
      dailyGoalsFor: Number(r.daily_goals_for ?? 0),
      dailyGoalsAgainst: Number(r.daily_goals_against ?? 0),
      dailyGoalDifference: Number(r.daily_goal_difference ?? 0),
      seasonCrowns: Number(r.season_crowns ?? 0),
      allTimeCrowns: Number(r.all_time_crowns ?? 0),
      // Brasão do time do coração — fallback undefined antes da migration
      favoriteTeamId: r.favorite_team_id == null ? undefined : Number(r.favorite_team_id),
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
        penaltyScoreHome: f.penalty_score_home == null ? undefined : Number(f.penalty_score_home),
        penaltyScoreAway: f.penalty_score_away == null ? undefined : Number(f.penalty_score_away),
        wentToPenalties: Boolean(f.went_to_penalties),
        woHome: Boolean(f.wo_home),
        woAway: Boolean(f.wo_away),
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
      // Ciclo Diário (Coroa do Dia) — Fase A
      dailyDate: stateRow.daily_date == null ? undefined : String(stateRow.daily_date),
      dailyPhase: (stateRow.daily_phase as GlobalLeagueMVPState['dailyPhase']) ?? 'qualifying',
      dailyKoSeasonId: stateRow.daily_ko_season_id == null ? undefined : String(stateRow.daily_ko_season_id),
      dailyKoSize: stateRow.daily_ko_size == null ? undefined : Number(stateRow.daily_ko_size),
      dailyQualifyHour: stateRow.daily_qualify_hour == null ? 19 : Number(stateRow.daily_qualify_hour),
      dailyKoMaxSize: stateRow.daily_ko_max_size == null ? 32 : Number(stateRow.daily_ko_max_size),
      createdAt: stateRow.created_at ? new Date(String(stateRow.created_at)).getTime() : Date.now(),
      lastUpdated: stateRow.updated_at ? new Date(String(stateRow.updated_at)).getTime() : Date.now(),
    };
  } catch (err) {
    console.warn('[globalLeague] loadGlobalLeagueFromSupabase failed', err);
    return null;
  }
}

/**
 * Carrega o bracket do Mata-Mata Diário. Os rounds daily_ko vivem em uma
 * season própria (`dko_<dia>`), separada da liga, então NÃO vêm em
 * loadGlobalLeagueFromSupabase (que filtra pela season da liga). Use o
 * `dailyKoSeasonId` do estado para buscar aqui.
 */
export async function loadDailyKnockoutFromSupabase(
  dkoSeasonId: string,
): Promise<DailyKnockoutRound[]> {
  if (!isSupabaseConfigured() || !dkoSeasonId) return [];
  const supabase = getSupabase();
  if (!supabase) return [];

  try {
    const { data: roundsData, error: roundsErr } = await supabase
      .from('global_league_rounds')
      .select('*')
      .eq('season_id', dkoSeasonId)
      .eq('round_type', 'daily_ko');
    if (roundsErr || !roundsData || roundsData.length === 0) return [];

    const roundIds = roundsData.map((r: Record<string, unknown>) => String(r.id));
    const [fixturesRes, eventsRes] = await Promise.all([
      supabase.from('global_league_fixtures').select('*').in('round_id', roundIds),
      supabase.from('global_league_events').select('*'),
    ]);

    const eventsByFixture = new Map<string, GlobalMatchEvent[]>();
    for (const ev of eventsRes.data ?? []) {
      const e = ev as Record<string, unknown>;
      const fxId = String(e.fixture_id);
      const list = eventsByFixture.get(fxId) ?? [];
      list.push({
        id: String(e.id), fixtureId: fxId,
        type: e.event_type as GlobalMatchEvent['type'],
        minute: Number(e.minute), timestampMs: Number(e.timestamp_ms),
        side: e.side as GlobalMatchEvent['side'],
        playerName: e.player_name ? String(e.player_name) : undefined,
        playerId: e.player_id ? String(e.player_id) : undefined,
        text: String(e.text), highlight: Boolean(e.highlight),
      });
      eventsByFixture.set(fxId, list);
    }

    const fixturesByRound = new Map<string, GlobalFixture[]>();
    for (const fx of fixturesRes.data ?? []) {
      const f = fx as Record<string, unknown>;
      const roundId = String(f.round_id);
      const fixture: GlobalFixture = {
        id: String(f.id), roundId, division: String(f.division),
        homeTeamId: String(f.home_team_id), awayTeamId: String(f.away_team_id),
        homeTeamName: String(f.home_team_name), awayTeamName: String(f.away_team_name),
        homeOverall: Number(f.home_overall), awayOverall: Number(f.away_overall),
        scoreHome: Number(f.score_home ?? 0), scoreAway: Number(f.score_away ?? 0),
        currentMinute: Number(f.current_minute ?? 0),
        events: eventsByFixture.get(String(f.id)) ?? [],
        status: f.status as GlobalFixture['status'],
        kickoffMs: f.kickoff_ms == null ? undefined : Number(f.kickoff_ms),
        finishedAtMs: f.finished_at_ms == null ? undefined : Number(f.finished_at_ms),
        penaltyScoreHome: f.penalty_score_home == null ? undefined : Number(f.penalty_score_home),
        penaltyScoreAway: f.penalty_score_away == null ? undefined : Number(f.penalty_score_away),
        wentToPenalties: Boolean(f.went_to_penalties),
        woHome: Boolean(f.wo_home),
        woAway: Boolean(f.wo_away),
      };
      const list = fixturesByRound.get(roundId) ?? [];
      list.push(fixture);
      fixturesByRound.set(roundId, list);
    }

    const rounds: DailyKnockoutRound[] = (roundsData as Record<string, unknown>[]).map((r) => {
      const fixtures = fixturesByRound.get(String(r.id)) ?? [];
      // Ordena fixtures pelo índice do confronto (sufixo do id: dkofx_..._<i>)
      fixtures.sort((a, b) => {
        const ai = Number(a.id.split('_').pop()); const bi = Number(b.id.split('_').pop());
        return (Number.isFinite(ai) ? ai : 0) - (Number.isFinite(bi) ? bi : 0);
      });
      const size = fixtures.length * 2;
      return {
        id: String(r.id),
        roundNumber: Number(r.round_number),
        phase: String(r.phase ?? `ko_${size}`),
        size,
        fixtures,
        status: r.status as DailyKnockoutRound['status'],
        scheduledKickoffMs: Number(r.scheduled_kickoff_ms),
        finishedAtMs: r.finished_at_ms == null ? undefined : Number(r.finished_at_ms),
      };
    });
    rounds.sort((a, b) => a.roundNumber - b.roundNumber);
    return rounds;
  } catch (err) {
    console.warn('[globalLeague] loadDailyKnockoutFromSupabase failed', err);
    return [];
  }
}

function mapCrownRow(c: Record<string, unknown>): DailyCrown {
  return {
    id: String(c.id),
    teamId: String(c.team_id),
    managerId: String(c.manager_id),
    clubName: String(c.club_name),
    clubShort: String(c.club_short),
    dailyDate: String(c.daily_date),
    seasonId: String(c.season_id),
    competitionId: c.competition_id == null ? undefined : String(c.competition_id),
    bracketSize: Number(c.bracket_size ?? 0),
    runnerUpTeamId: c.runner_up_team_id == null ? undefined : String(c.runner_up_team_id),
    runnerUpClubName: c.runner_up_club_name == null ? undefined : String(c.runner_up_club_name),
    finalScoreHome: c.final_score_home == null ? undefined : Number(c.final_score_home),
    finalScoreAway: c.final_score_away == null ? undefined : Number(c.final_score_away),
    finalWentToPens: Boolean(c.final_went_to_pens),
    crownedAtMs: Number(c.crowned_at_ms ?? 0),
  };
}

/**
 * Todas as Coroas do Dia conquistadas por um manager (filtrado por manager_id).
 * Usado pela seção de Troféus em /manager.
 */
export async function loadCrownsForManager(managerId: string, limit = 100): Promise<DailyCrown[]> {
  if (!isSupabaseConfigured() || !managerId) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('daily_crowns')
      .select('*')
      .eq('manager_id', managerId)
      .order('crowned_at_ms', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map(mapCrownRow);
  } catch (err) {
    console.warn('[globalLeague] loadCrownsForManager failed', err);
    return [];
  }
}

/** Últimas Coroas do Dia (campeões do mata-mata diário), mais recentes primeiro. */
export async function loadRecentCrowns(limit = 3): Promise<DailyCrown[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('daily_crowns')
      .select('*')
      .order('crowned_at_ms', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map(mapCrownRow);
  } catch (err) {
    console.warn('[globalLeague] loadRecentCrowns failed', err);
    return [];
  }
}
