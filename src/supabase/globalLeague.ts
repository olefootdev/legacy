/**
 * Persistência da Liga Global no Supabase.
 *
 * Estratégia MVP: após cada ação relevante (registro, início/fim de rodada,
 * promoção/rebaixamento), fazemos upsert do snapshot completo no DB. É mais
 * tráfego que o necessário, mas idempotente e simples — suficiente para
 * dezenas de times.
 *
 * Próxima iteração pode otimizar: upsert só do delta (time específico,
 * fixture específico) e usar diff entre estado anterior/atual.
 */

import { getSupabase, isSupabaseConfigured } from './client';
import type { GlobalLeagueMVPState, GlobalTeam, PlayoffRound, LeagueRound } from '@/match/globalLeagueMVP';
import type { GlobalFixture, GlobalMatchEvent } from '@/match/globalMatch';

const SINGLETON_STATE_ID = 'current';

// ─── Mapeadores camelCase ↔ snake_case ───────────────────────────────────

function teamToRow(team: GlobalTeam) {
  return {
    id: team.id,
    manager_id: team.managerId,
    club_name: team.clubName,
    club_short: team.clubShort,
    overall: team.overall,
    division: team.division ?? null,
    position: team.position ?? null,
    previous_position: team.previousPosition ?? null,
    playoff_points: team.playoffPoints,
    playoff_matches_played: team.playoffMatchesPlayed,
    playoff_wins: team.playoffWins,
    playoff_draws: team.playoffDraws,
    playoff_losses: team.playoffLosses,
    playoff_goals_for: team.playoffGoalsFor,
    playoff_goals_against: team.playoffGoalsAgainst,
    points: team.points,
    matches_played: team.matchesPlayed,
    wins: team.wins,
    draws: team.draws,
    losses: team.losses,
    goals_for: team.goalsFor,
    goals_against: team.goalsAgainst,
    goal_difference: team.goalDifference,
    recent_form: team.recentForm,
    registered_at: new Date(team.registeredAt).toISOString(),
    // ALL-TIME — preserva entre temporadas
    all_time_points: team.allTimePoints ?? 0,
    all_time_matches_played: team.allTimeMatchesPlayed ?? 0,
    all_time_wins: team.allTimeWins ?? 0,
    all_time_draws: team.allTimeDraws ?? 0,
    all_time_losses: team.allTimeLosses ?? 0,
    all_time_goals_for: team.allTimeGoalsFor ?? 0,
    all_time_goals_against: team.allTimeGoalsAgainst ?? 0,
    all_time_seasons_played: team.allTimeSeasonsPlayed ?? 0,
  };
}

function playoffRoundToRow(round: PlayoffRound, seasonId: string) {
  return {
    id: `playoff_${seasonId}_${round.roundNumber}`,
    season_id: seasonId,
    round_number: round.roundNumber,
    round_type: 'playoff' as const,
    phase: round.phase,
    is_returning: round.roundNumber > 3,
    status: round.status,
    scheduled_kickoff_ms: round.scheduledKickoffMs,
    actual_kickoff_ms: round.actualKickoffMs ?? null,
    finished_at_ms: round.finishedAtMs ?? null,
  };
}

function leagueRoundToRow(round: LeagueRound, seasonId: string) {
  return {
    id: `league_${seasonId}_${round.roundNumber}`,
    season_id: seasonId,
    round_number: round.roundNumber,
    round_type: 'league' as const,
    phase: null,
    is_returning: false,
    status: round.status,
    scheduled_kickoff_ms: round.scheduledKickoffMs,
    actual_kickoff_ms: round.actualKickoffMs ?? null,
    finished_at_ms: round.finishedAtMs ?? null,
  };
}

function fixtureToRow(fixture: GlobalFixture, roundId: string) {
  return {
    id: fixture.id,
    round_id: roundId,
    division: fixture.division,
    home_team_id: fixture.homeTeamId,
    away_team_id: fixture.awayTeamId,
    home_team_name: fixture.homeTeamName,
    away_team_name: fixture.awayTeamName,
    home_overall: fixture.homeOverall,
    away_overall: fixture.awayOverall,
    score_home: fixture.scoreHome,
    score_away: fixture.scoreAway,
    current_minute: fixture.currentMinute,
    status: fixture.status,
    kickoff_ms: fixture.kickoffMs ?? null,
    finished_at_ms: fixture.finishedAtMs ?? null,
  };
}

function eventToRow(event: GlobalMatchEvent) {
  return {
    id: event.id,
    fixture_id: event.fixtureId,
    event_type: event.type,
    minute: event.minute,
    side: event.side,
    player_name: event.playerName ?? null,
    player_id: event.playerId ?? null,
    text: event.text,
    highlight: event.highlight ?? false,
    timestamp_ms: event.timestampMs,
  };
}

function leagueStateRow(league: GlobalLeagueMVPState) {
  return {
    id: SINGLETON_STATE_ID,
    season_id: league.seasonId,
    season_name: `OLEFOOT LIGA — ${league.seasonId}`,
    status: league.status,
    min_teams_required: league.minTeamsRequired,
    teams_per_division: league.teamsPerDivision,
    promotion_percentage: league.promotionPercentage,
    relegation_percentage: league.relegationPercentage,
    current_playoff_round: league.currentPlayoffRound ?? null,
    current_league_round: league.currentLeagueRound ?? null,
  };
}

// ─── Operações públicas ──────────────────────────────────────────────────

/**
 * Persiste snapshot completo da liga no Supabase.
 * Fire-and-forget: erros são logados mas não interrompem o caller.
 */
export async function persistGlobalLeagueSnapshot(league: GlobalLeagueMVPState): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    // 1) Estado singleton
    const { error: stateErr } = await supabase
      .from('global_league_state')
      .upsert(leagueStateRow(league), { onConflict: 'id' });
    if (stateErr) console.warn('[globalLeague] state upsert', stateErr.message);

    // 2) Times
    if (league.teams.length > 0) {
      const { error: teamsErr } = await supabase
        .from('global_league_teams')
        .upsert(league.teams.map(teamToRow), { onConflict: 'id' });
      if (teamsErr) console.warn('[globalLeague] teams upsert', teamsErr.message);
    }

    // 3) Rodadas (playoffs + liga)
    const allRounds = [
      ...league.playoffRounds.map((r) => playoffRoundToRow(r, league.seasonId)),
      ...league.leagueRounds.map((r) => leagueRoundToRow(r, league.seasonId)),
    ];
    if (allRounds.length > 0) {
      const { error: roundsErr } = await supabase
        .from('global_league_rounds')
        .upsert(allRounds, { onConflict: 'id' });
      if (roundsErr) console.warn('[globalLeague] rounds upsert', roundsErr.message);
    }

    // 4) Fixtures
    const allFixtures: ReturnType<typeof fixtureToRow>[] = [];
    const allEvents: ReturnType<typeof eventToRow>[] = [];
    for (const round of league.playoffRounds) {
      const roundId = `playoff_${league.seasonId}_${round.roundNumber}`;
      for (const f of round.fixtures) {
        allFixtures.push(fixtureToRow(f, roundId));
        for (const e of f.events) allEvents.push(eventToRow(e));
      }
    }
    for (const round of league.leagueRounds) {
      const roundId = `league_${league.seasonId}_${round.roundNumber}`;
      for (const f of round.fixtures) {
        allFixtures.push(fixtureToRow(f, roundId));
        for (const e of f.events) allEvents.push(eventToRow(e));
      }
    }
    if (allFixtures.length > 0) {
      const { error: fxErr } = await supabase
        .from('global_league_fixtures')
        .upsert(allFixtures, { onConflict: 'id' });
      if (fxErr) console.warn('[globalLeague] fixtures upsert', fxErr.message);
    }

    // 5) Eventos (append-only, mas usamos upsert por id pra ser idempotente)
    if (allEvents.length > 0) {
      const { error: evErr } = await supabase
        .from('global_league_events')
        .upsert(allEvents, { onConflict: 'id' });
      if (evErr) console.warn('[globalLeague] events upsert', evErr.message);
    }
  } catch (err) {
    console.warn('[globalLeague] persistGlobalLeagueSnapshot failed', err);
  }
}

/**
 * Carrega o estado da Liga Global do Supabase (para hidratação no boot).
 * Retorna null se não houver liga registrada ou se Supabase não está configurado.
 */
/**
 * Registra (upsert) UM time na Liga Global do Supabase.
 * Chamado quando o manager finaliza a cerimônia de abertura — assim a Liga Global
 * enxerga o time imediatamente e o auto-start pode incluir ele na próxima rodada.
 */
/**
 * Registra (upsert) APENAS a identidade do time — id, manager_id, club_name,
 * club_short, overall, registered_at. NUNCA envia pontos, vitórias, forma,
 * divisão, all-time ou qualquer stat: a Edge Function é a única autoridade.
 *
 * Em INSERT, colunas de stats pegam os DEFAULT 0 do schema; em UPDATE elas
 * ficam intocadas — o cliente não pode reescrever o ranking com state local
 * desatualizado.
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
    const { error } = await supabase
      .from('global_league_teams')
      .upsert({
        id: opts.id,
        manager_id: opts.managerId,
        club_name: opts.clubName,
        club_short: opts.clubShort,
        overall: opts.overall,
        registered_at: new Date(opts.registeredAt ?? Date.now()).toISOString(),
      }, { onConflict: 'manager_id' });
    if (error) {
      console.warn('[globalLeague] registerGlobalTeamIdentity error:', error.message);
      return { ok: false, error: error.message };
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
