/**
 * Scheduler Server-Side da Liga Global
 *
 * Roda em loop no Railway a cada 10s.
 * Gerencia o ciclo completo dos playoffs:
 *   scheduled → live (1min) → finished → próxima rodada no topo de 5min
 *
 * Persiste no Supabase após cada mudança — todos os clients recebem via Realtime.
 */

import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';

const ROUND_DURATION_MS = 60 * 1000;       // 1 minuto real = 90min de jogo
const GAME_MINUTE_MS = ROUND_DURATION_MS / 90;
const TICK_INTERVAL_MS = 10 * 1000;        // tick a cada 10s

type FixtureStatus = 'scheduled' | 'live' | 'finished';
type RoundStatus = 'scheduled' | 'live' | 'finished';

interface MatchEvent {
  id: string;
  fixtureId: string;
  type: string;
  minute: number;
  side: 'home' | 'away';
  text: string;
  highlight: boolean;
  timestampMs: number;
  playerName?: string;
}

interface Fixture {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeOverall: number;
  awayOverall: number;
  scoreHome: number;
  scoreAway: number;
  currentMinute: number;
  status: FixtureStatus;
  kickoffMs?: number;
  finishedAtMs?: number;
  events: MatchEvent[];
  division: string | number;
}

interface PlayoffRound {
  roundNumber: number;
  phase: string;
  status: RoundStatus;
  scheduledKickoffMs: number;
  actualKickoffMs?: number;
  finishedAtMs?: number;
  fixtures: Fixture[];
}

interface GlobalTeam {
  id: string;
  managerId: string;
  clubName: string;
  clubShort: string;
  overall: number;
  playoffPoints: number;
  playoffMatchesPlayed: number;
  playoffWins: number;
  playoffDraws: number;
  playoffLosses: number;
  playoffGoalsFor: number;
  playoffGoalsAgainst: number;
  points: number;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  recentForm: string[];
  registeredAt: number;
  division?: number;
  position?: number;
}

interface LeagueState {
  seasonId: string;
  status: string;
  teams: GlobalTeam[];
  minTeamsRequired: number;
  playoffRounds: PlayoffRound[];
  currentPlayoffRound?: number;
  leagueRounds: unknown[];
  currentLeagueRound?: number;
  teamsPerDivision: number;
  promotionPercentage: number;
  relegationPercentage: number;
  createdAt: number;
  lastUpdated: number;
}

/** Próximo topo de 5min do relógio */
function getNextRoundTime(nowMs: number): number {
  const intervalMs = 5 * 60 * 1000;
  return Math.ceil((nowMs + 1000) / intervalMs) * intervalMs;
}

/** Simula resultado de uma partida baseado nos overalls */
function simulateMatch(homeOvr: number, awayOvr: number): { homeScore: number; awayScore: number } {
  const homePower = homeOvr + Math.random() * 20;
  const awayPower = awayOvr + Math.random() * 20;
  const diff = homePower - awayPower;

  const homeGoals = Math.max(0, Math.round((diff / 20) + (Math.random() * 3 - 0.5)));
  const awayGoals = Math.max(0, Math.round((-diff / 20) + (Math.random() * 3 - 0.5)));

  return { homeScore: homeGoals, awayScore: awayGoals };
}

/** Gera eventos de gol distribuídos nos 90min */
function generateEvents(homeScore: number, awayScore: number, fixture: Fixture): MatchEvent[] {
  const events: MatchEvent[] = [];
  const usedMinutes = new Set<number>();

  const addGoal = (side: 'home' | 'away', teamName: string) => {
    let minute: number;
    do { minute = 1 + Math.floor(Math.random() * 89); } while (usedMinutes.has(minute));
    usedMinutes.add(minute);
    events.push({
      id: `evt_${fixture.id}_${minute}_${side}`,
      fixtureId: fixture.id,
      type: 'goal',
      minute,
      side,
      text: `⚽ Gol de ${teamName}!`,
      highlight: true,
      timestampMs: Date.now(),
    });
  };

  for (let i = 0; i < homeScore; i++) addGoal('home', fixture.homeTeamName);
  for (let i = 0; i < awayScore; i++) addGoal('away', fixture.awayTeamName);

  return events.sort((a, b) => a.minute - b.minute);
}

/** Atualiza pontos dos times após rodada de playoff */
function applyPlayoffResults(teams: GlobalTeam[], fixtures: Fixture[]): GlobalTeam[] {
  return teams.map(team => {
    const fixture = fixtures.find(f => f.homeTeamId === team.id || f.awayTeamId === team.id);
    if (!fixture) return team;

    const isHome = fixture.homeTeamId === team.id;
    const scored = isHome ? fixture.scoreHome : fixture.scoreAway;
    const conceded = isHome ? fixture.scoreAway : fixture.scoreHome;
    const won = scored > conceded;
    const drew = scored === conceded;

    return {
      ...team,
      playoffMatchesPlayed: team.playoffMatchesPlayed + 1,
      playoffPoints: team.playoffPoints + (won ? 3 : drew ? 1 : 0),
      playoffWins: team.playoffWins + (won ? 1 : 0),
      playoffDraws: team.playoffDraws + (drew ? 1 : 0),
      playoffLosses: team.playoffLosses + (!won && !drew ? 1 : 0),
      playoffGoalsFor: team.playoffGoalsFor + scored,
      playoffGoalsAgainst: team.playoffGoalsAgainst + conceded,
    };
  });
}

/** Carrega estado da liga do Supabase */
async function loadState(): Promise<LeagueState | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;

  const { data: stateRow, error } = await sb
    .from('global_league_state')
    .select('*')
    .eq('id', 'current')
    .maybeSingle();

  if (error || !stateRow) return null;

  const seasonId = String(stateRow.season_id);

  const [teamsRes, roundsRes, fixturesRes, eventsRes] = await Promise.all([
    sb.from('global_league_teams').select('*'),
    sb.from('global_league_rounds').select('*').eq('season_id', seasonId),
    sb.from('global_league_fixtures').select('*'),
    sb.from('global_league_events').select('*'),
  ]);

  const teams: GlobalTeam[] = (teamsRes.data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    managerId: String(r.manager_id),
    clubName: String(r.club_name),
    clubShort: String(r.club_short),
    overall: Number(r.overall),
    division: r.division == null ? undefined : Number(r.division),
    position: r.position == null ? undefined : Number(r.position),
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
    recentForm: (r.recent_form as string[]) ?? [],
    registeredAt: r.registered_at ? new Date(String(r.registered_at)).getTime() : Date.now(),
  }));

  // Indexar eventos por fixture
  const eventsByFixture = new Map<string, MatchEvent[]>();
  for (const ev of eventsRes.data ?? []) {
    const e = ev as Record<string, unknown>;
    const fxId = String(e.fixture_id);
    const list = eventsByFixture.get(fxId) ?? [];
    list.push({
      id: String(e.id),
      fixtureId: fxId,
      type: String(e.event_type),
      minute: Number(e.minute),
      side: e.side as 'home' | 'away',
      text: String(e.text),
      highlight: Boolean(e.highlight),
      timestampMs: Number(e.timestamp_ms),
      playerName: e.player_name ? String(e.player_name) : undefined,
    });
    eventsByFixture.set(fxId, list);
  }

  // Indexar fixtures por round
  const fixturesByRound = new Map<string, Fixture[]>();
  for (const fx of fixturesRes.data ?? []) {
    const f = fx as Record<string, unknown>;
    const roundId = String(f.round_id);
    const list = fixturesByRound.get(roundId) ?? [];
    list.push({
      id: String(f.id),
      homeTeamId: String(f.home_team_id),
      awayTeamId: String(f.away_team_id),
      homeTeamName: String(f.home_team_name),
      awayTeamName: String(f.away_team_name),
      homeOverall: Number(f.home_overall),
      awayOverall: Number(f.away_overall),
      scoreHome: Number(f.score_home ?? 0),
      scoreAway: Number(f.score_away ?? 0),
      currentMinute: Number(f.current_minute ?? 0),
      status: f.status as FixtureStatus,
      kickoffMs: f.kickoff_ms ? Number(f.kickoff_ms) : undefined,
      finishedAtMs: f.finished_at_ms ? Number(f.finished_at_ms) : undefined,
      division: f.division as string | number,
      events: eventsByFixture.get(String(f.id)) ?? [],
    });
    fixturesByRound.set(roundId, list);
  }

  const playoffRounds: PlayoffRound[] = (roundsRes.data ?? [])
    .filter((r: Record<string, unknown>) => r.round_type === 'playoff')
    .map((r: Record<string, unknown>) => {
      const roundId = String(r.id);
      return {
        roundNumber: Number(r.round_number),
        phase: String(r.phase ?? 'round_1'),
        status: r.status as RoundStatus,
        scheduledKickoffMs: Number(r.scheduled_kickoff_ms),
        actualKickoffMs: r.actual_kickoff_ms ? Number(r.actual_kickoff_ms) : undefined,
        finishedAtMs: r.finished_at_ms ? Number(r.finished_at_ms) : undefined,
        fixtures: fixturesByRound.get(roundId) ?? [],
      };
    })
    .sort((a: PlayoffRound, b: PlayoffRound) => a.roundNumber - b.roundNumber);

  return {
    seasonId,
    status: String(stateRow.status),
    teams,
    minTeamsRequired: 1,
    playoffRounds,
    currentPlayoffRound: stateRow.current_playoff_round == null ? undefined : Number(stateRow.current_playoff_round),
    leagueRounds: [],
    teamsPerDivision: Number(stateRow.teams_per_division ?? 11),
    promotionPercentage: Number(stateRow.promotion_percentage ?? 0.1),
    relegationPercentage: Number(stateRow.relegation_percentage ?? 0.1),
    createdAt: Date.now(),
    lastUpdated: Date.now(),
  };
}

/** Persiste mudanças no Supabase */
async function persistChanges(state: LeagueState, changedRound: PlayoffRound): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;

  // Atualizar estado singleton
  await sb.from('global_league_state').upsert({
    id: 'current',
    season_id: state.seasonId,
    status: state.status,
    current_playoff_round: state.currentPlayoffRound ?? null,
    min_teams_required: 1,
    teams_per_division: state.teamsPerDivision,
    promotion_percentage: state.promotionPercentage,
    relegation_percentage: state.relegationPercentage,
  }, { onConflict: 'id' });

  // Atualizar rodada
  await sb.from('global_league_rounds').upsert({
    id: `playoff_${state.seasonId}_${changedRound.roundNumber}`,
    season_id: state.seasonId,
    round_number: changedRound.roundNumber,
    round_type: 'playoff',
    phase: changedRound.phase,
    status: changedRound.status,
    scheduled_kickoff_ms: changedRound.scheduledKickoffMs,
    actual_kickoff_ms: changedRound.actualKickoffMs ?? null,
    finished_at_ms: changedRound.finishedAtMs ?? null,
  }, { onConflict: 'id' });

  // Atualizar fixtures
  if (changedRound.fixtures.length > 0) {
    const roundId = `playoff_${state.seasonId}_${changedRound.roundNumber}`;
    await sb.from('global_league_fixtures').upsert(
      changedRound.fixtures.map(f => ({
        id: f.id,
        round_id: roundId,
        division: f.division,
        home_team_id: f.homeTeamId,
        away_team_id: f.awayTeamId,
        home_team_name: f.homeTeamName,
        away_team_name: f.awayTeamName,
        home_overall: f.homeOverall,
        away_overall: f.awayOverall,
        score_home: f.scoreHome,
        score_away: f.scoreAway,
        current_minute: f.currentMinute,
        status: f.status,
        kickoff_ms: f.kickoffMs ?? null,
        finished_at_ms: f.finishedAtMs ?? null,
      })),
      { onConflict: 'id' }
    );

    // Persistir eventos
    const allEvents = changedRound.fixtures.flatMap(f => f.events);
    if (allEvents.length > 0) {
      await sb.from('global_league_events').upsert(
        allEvents.map(e => ({
          id: e.id,
          fixture_id: e.fixtureId,
          event_type: e.type,
          minute: e.minute,
          side: e.side,
          text: e.text,
          highlight: e.highlight,
          timestamp_ms: e.timestampMs,
          player_name: e.playerName ?? null,
          player_id: null,
        })),
        { onConflict: 'id' }
      );
    }
  }

  // Atualizar times (pontos)
  if (state.teams.length > 0) {
    await sb.from('global_league_teams').upsert(
      state.teams.map(t => ({
        id: t.id,
        manager_id: t.managerId,
        club_name: t.clubName,
        club_short: t.clubShort,
        overall: t.overall,
        division: t.division ?? null,
        position: t.position ?? null,
        previous_position: null,
        playoff_points: t.playoffPoints,
        playoff_matches_played: t.playoffMatchesPlayed,
        playoff_wins: t.playoffWins,
        playoff_draws: t.playoffDraws,
        playoff_losses: t.playoffLosses,
        playoff_goals_for: t.playoffGoalsFor,
        playoff_goals_against: t.playoffGoalsAgainst,
        points: t.points,
        matches_played: t.matchesPlayed,
        wins: t.wins,
        draws: t.draws,
        losses: t.losses,
        goals_for: t.goalsFor,
        goals_against: t.goalsAgainst,
        goal_difference: t.goalDifference,
        recent_form: t.recentForm,
        registered_at: new Date(t.registeredAt).toISOString(),
      })),
      { onConflict: 'id' }
    );
  }
}

/** Tick principal — avança o estado da liga */
async function tick(): Promise<void> {
  const state = await loadState();
  if (!state || state.status !== 'playoffs') return;

  const nowMs = Date.now();
  const roundNumber = state.currentPlayoffRound;
  if (!roundNumber) return;

  const round = state.playoffRounds.find(r => r.roundNumber === roundNumber);
  if (!round) return;

  // 1. Iniciar rodada no kickoff
  if (round.status === 'scheduled' && nowMs >= round.scheduledKickoffMs) {
    console.log(`[scheduler] Iniciando rodada ${roundNumber}`);

    const simulatedFixtures = round.fixtures.map(fixture => {
      const homeTeam = state.teams.find(t => t.id === fixture.homeTeamId);
      const awayTeam = state.teams.find(t => t.id === fixture.awayTeamId);
      const homeOvr = homeTeam?.overall ?? 70;
      const awayOvr = awayTeam?.overall ?? 70;
      const result = simulateMatch(homeOvr, awayOvr);
      const events = generateEvents(result.homeScore, result.awayScore, fixture);

      return {
        ...fixture,
        scoreHome: result.homeScore,
        scoreAway: result.awayScore,
        status: 'live' as FixtureStatus,
        kickoffMs: nowMs,
        currentMinute: 0,
        events,
      };
    });

    round.status = 'live';
    round.actualKickoffMs = nowMs;
    round.fixtures = simulatedFixtures;

    await persistChanges(state, round);
    return;
  }

  // 2. Revelar minuto atual ao vivo
  if (round.status === 'live' && round.actualKickoffMs) {
    const elapsed = nowMs - round.actualKickoffMs;
    const currentMinute = Math.min(90, Math.floor(elapsed / GAME_MINUTE_MS));

    // Atualizar placar revelado
    round.fixtures = round.fixtures.map(f => {
      const revealedEvents = f.events.filter(e => e.minute <= currentMinute);
      const scoreHome = revealedEvents.filter(e => e.type === 'goal' && e.side === 'home').length;
      const scoreAway = revealedEvents.filter(e => e.type === 'goal' && e.side === 'away').length;
      return { ...f, currentMinute, scoreHome, scoreAway };
    });

    await persistChanges(state, round);

    // 3. Finalizar rodada após 1min
    if (elapsed >= ROUND_DURATION_MS) {
      console.log(`[scheduler] Finalizando rodada ${roundNumber}`);

      round.status = 'finished';
      round.finishedAtMs = nowMs;
      round.fixtures = round.fixtures.map(f => ({ ...f, status: 'finished' as FixtureStatus, finishedAtMs: nowMs }));

      // Atualizar pontos dos times
      state.teams = applyPlayoffResults(state.teams, round.fixtures);

      await persistChanges(state, round);
    }
    return;
  }

  // 4. Agendar próxima rodada no topo de 5min
  if (round.status === 'finished') {
    const nextRoundNumber = roundNumber + 1;
    const nextRound = state.playoffRounds.find(r => r.roundNumber === nextRoundNumber);
    if (!nextRound) {
      console.log(`[scheduler] Playoffs concluídos após rodada ${roundNumber}`);
      return;
    }

    if (nextRound.status === 'scheduled' && nextRound.scheduledKickoffMs <= nowMs + 5000) {
      const nextKickoffMs = getNextRoundTime(nowMs);
      console.log(`[scheduler] Agendando rodada ${nextRoundNumber} para ${new Date(nextKickoffMs).toISOString()}`);

      nextRound.scheduledKickoffMs = nextKickoffMs;
      state.currentPlayoffRound = nextRoundNumber;

      await persistChanges(state, nextRound);
    }
  }
}

/** Inicia o loop do scheduler */
export function startGlobalLeagueScheduler(): void {
  console.log('[scheduler] Global League Scheduler iniciado');

  const run = async () => {
    try {
      await tick();
    } catch (err) {
      console.error('[scheduler] Erro no tick:', err);
    }
  };

  // Primeiro tick imediato
  void run();

  // Loop a cada 10s
  setInterval(() => void run(), TICK_INTERVAL_MS);
}
