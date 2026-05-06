/**
 * Scheduler Server-Side da Liga Global
 *
 * Roda em loop no Railway a cada 10s. Gerencia o ciclo completo:
 *   scheduled → live (1min) → finished → próxima rodada no topo de 5min
 *
 * Cobre playoffs (status='playoffs') e liga oficial (status='active').
 * Persiste no Supabase após cada mudança — todos os clients recebem via Realtime.
 *
 * Single source of truth: este scheduler é AUTORITATIVO. O cliente
 * desativa o scheduler local quando o server está disponível.
 */

import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import {
  generatePlayoffRounds as logicGenPlayoffs,
  distributeIntoDivisions as logicDistribute,
  generateLeagueRounds as logicGenLeague,
  applyPromotionRelegation as logicPromoRele,
  type GlobalTeamLite,
  type RoundLite,
  type FixtureLite,
} from './globalLeagueLogic.js';

const ROUND_DURATION_MS = 60 * 1000;       // 1 minuto real = 90min de jogo
const GAME_MINUTE_MS = ROUND_DURATION_MS / 90;
const TICK_INTERVAL_MS = 10 * 1000;        // tick a cada 10s
const HEARTBEAT_EVERY_N_TICKS = 30;        // log de saúde a cada 5min

type FixtureStatus = 'scheduled' | 'live' | 'finished';
type RoundStatus = 'scheduled' | 'live' | 'finished';
type RoundKind = 'playoff' | 'league';

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

interface Round {
  kind: RoundKind;
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
  playoffRounds: Round[];
  leagueRounds: Round[];
  currentPlayoffRound?: number;
  currentLeagueRound?: number;
  minTeamsRequired: number;
  teamsPerDivision: number;
  promotionPercentage: number;
  relegationPercentage: number;
}

/** Próximo topo de 5min do relógio (15:00, 15:05, 15:10...) */
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

/** Atualiza pontos dos times após rodada da liga oficial */
function applyLeagueResults(teams: GlobalTeam[], fixtures: Fixture[]): GlobalTeam[] {
  return teams.map(team => {
    const fixture = fixtures.find(f => f.homeTeamId === team.id || f.awayTeamId === team.id);
    if (!fixture) return team;

    const isHome = fixture.homeTeamId === team.id;
    const scored = isHome ? fixture.scoreHome : fixture.scoreAway;
    const conceded = isHome ? fixture.scoreAway : fixture.scoreHome;
    const won = scored > conceded;
    const drew = scored === conceded;
    const result: 'W' | 'D' | 'L' = won ? 'W' : drew ? 'D' : 'L';

    return {
      ...team,
      matchesPlayed: team.matchesPlayed + 1,
      points: team.points + (won ? 3 : drew ? 1 : 0),
      wins: team.wins + (won ? 1 : 0),
      draws: team.draws + (drew ? 1 : 0),
      losses: team.losses + (!won && !drew ? 1 : 0),
      goalsFor: team.goalsFor + scored,
      goalsAgainst: team.goalsAgainst + conceded,
      goalDifference: (team.goalsFor + scored) - (team.goalsAgainst + conceded),
      recentForm: [...team.recentForm.slice(-4), result],
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

  const playoffRounds: Round[] = [];
  const leagueRounds: Round[] = [];
  for (const rr of roundsRes.data ?? []) {
    const r = rr as Record<string, unknown>;
    const roundId = String(r.id);
    const round: Round = {
      kind: r.round_type === 'playoff' ? 'playoff' : 'league',
      roundNumber: Number(r.round_number),
      phase: String(r.phase ?? 'round_1'),
      status: r.status as RoundStatus,
      scheduledKickoffMs: Number(r.scheduled_kickoff_ms),
      actualKickoffMs: r.actual_kickoff_ms ? Number(r.actual_kickoff_ms) : undefined,
      finishedAtMs: r.finished_at_ms ? Number(r.finished_at_ms) : undefined,
      fixtures: fixturesByRound.get(roundId) ?? [],
    };
    if (round.kind === 'playoff') playoffRounds.push(round);
    else leagueRounds.push(round);
  }
  playoffRounds.sort((a, b) => a.roundNumber - b.roundNumber);
  leagueRounds.sort((a, b) => a.roundNumber - b.roundNumber);

  return {
    seasonId,
    status: String(stateRow.status),
    teams,
    playoffRounds,
    leagueRounds,
    currentPlayoffRound: stateRow.current_playoff_round == null ? undefined : Number(stateRow.current_playoff_round),
    currentLeagueRound: stateRow.current_league_round == null ? undefined : Number(stateRow.current_league_round),
    minTeamsRequired: Number(stateRow.min_teams_required ?? 2),
    teamsPerDivision: Number(stateRow.teams_per_division ?? 11),
    promotionPercentage: Number(stateRow.promotion_percentage ?? 0.1),
    relegationPercentage: Number(stateRow.relegation_percentage ?? 0.1),
  };
}

/** Persiste mudanças no Supabase para um round específico */
async function persistRound(state: LeagueState, round: Round, options: { persistTeams?: boolean } = {}): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;

  // Atualizar estado singleton
  const { error: stateErr } = await sb.from('global_league_state').upsert({
    id: 'current',
    season_id: state.seasonId,
    season_name: `OLEFOOT LIGA — ${state.seasonId}`,
    status: state.status,
    current_playoff_round: state.currentPlayoffRound ?? null,
    current_league_round: state.currentLeagueRound ?? null,
    min_teams_required: state.minTeamsRequired,
    teams_per_division: state.teamsPerDivision,
    promotion_percentage: state.promotionPercentage,
    relegation_percentage: state.relegationPercentage,
  }, { onConflict: 'id' });
  if (stateErr) console.error('[scheduler] state upsert FAILED:', stateErr.message, stateErr.details ?? '');

  // Atualizar rodada
  const roundIdPrefix = round.kind === 'playoff' ? 'playoff' : 'league';
  const roundId = `${roundIdPrefix}_${state.seasonId}_${round.roundNumber}`;
  await sb.from('global_league_rounds').upsert({
    id: roundId,
    season_id: state.seasonId,
    round_number: round.roundNumber,
    round_type: round.kind,
    phase: round.kind === 'playoff' ? round.phase : null,
    status: round.status,
    scheduled_kickoff_ms: round.scheduledKickoffMs,
    actual_kickoff_ms: round.actualKickoffMs ?? null,
    finished_at_ms: round.finishedAtMs ?? null,
  }, { onConflict: 'id' });

  // Atualizar fixtures
  if (round.fixtures.length > 0) {
    await sb.from('global_league_fixtures').upsert(
      round.fixtures.map(f => ({
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
    const allEvents = round.fixtures.flatMap(f => f.events);
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

  // Atualizar times só quando solicitado (no fim da rodada)
  if (options.persistTeams && state.teams.length > 0) {
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

/** Cache em memória do último minuto persistido por rodada — reduz writes */
const lastPersistedMinute = new Map<string, number>();

/** Processa uma rodada: scheduled → live → finished → próxima */
async function processRound(
  state: LeagueState,
  round: Round,
  rounds: Round[],
  setCurrentRound: (n: number | undefined) => void,
  applyResults: (teams: GlobalTeam[], fixtures: Fixture[]) => GlobalTeam[],
  nowMs: number,
): Promise<boolean /* didChange */> {
  const roundKey = `${round.kind}_${round.roundNumber}`;

  // 1. Iniciar rodada no kickoff
  if (round.status === 'scheduled' && nowMs >= round.scheduledKickoffMs) {
    console.log(`[scheduler] Iniciando ${round.kind} rodada ${round.roundNumber}`);

    const simulatedFixtures = round.fixtures.map(fixture => {
      const homeTeam = state.teams.find(t => t.id === fixture.homeTeamId);
      const awayTeam = state.teams.find(t => t.id === fixture.awayTeamId);
      const homeOvr = homeTeam?.overall ?? 70;
      const awayOvr = awayTeam?.overall ?? 70;
      const result = simulateMatch(homeOvr, awayOvr);
      const events = generateEvents(result.homeScore, result.awayScore, fixture);

      return {
        ...fixture,
        // Esconder placar final inicialmente — só revela conforme avança
        scoreHome: 0,
        scoreAway: 0,
        status: 'live' as FixtureStatus,
        kickoffMs: nowMs,
        currentMinute: 0,
        events,
      };
    });

    round.status = 'live';
    round.actualKickoffMs = nowMs;
    round.fixtures = simulatedFixtures;
    lastPersistedMinute.delete(roundKey);

    await persistRound(state, round);
    return true;
  }

  // 2. Reveal progressivo durante live (só persiste se minuto avançou)
  if (round.status === 'live' && round.actualKickoffMs) {
    const elapsed = nowMs - round.actualKickoffMs;
    const currentMinute = Math.min(90, Math.floor(elapsed / GAME_MINUTE_MS));
    const last = lastPersistedMinute.get(roundKey) ?? -1;

    // 3. Finalizar rodada após duração total
    if (elapsed >= ROUND_DURATION_MS) {
      console.log(`[scheduler] Finalizando ${round.kind} rodada ${round.roundNumber}`);

      round.fixtures = round.fixtures.map(f => {
        const goals = f.events.filter(e => e.type === 'goal');
        const scoreHome = goals.filter(e => e.side === 'home').length;
        const scoreAway = goals.filter(e => e.side === 'away').length;
        return { ...f, currentMinute: 90, scoreHome, scoreAway, status: 'finished' as FixtureStatus, finishedAtMs: nowMs };
      });
      round.status = 'finished';
      round.finishedAtMs = nowMs;

      // Aplicar pontos
      state.teams = applyResults(state.teams, round.fixtures);

      // Agendar a próxima rodada IMEDIATAMENTE (próximo top de 5min)
      const nextRound = rounds.find(r => r.roundNumber === round.roundNumber + 1);
      if (nextRound) {
        const nextKickoffMs = getNextRoundTime(nowMs);
        nextRound.scheduledKickoffMs = nextKickoffMs;
        nextRound.status = 'scheduled';
        setCurrentRound(nextRound.roundNumber);
        console.log(`[scheduler] Próxima ${round.kind} rodada ${nextRound.roundNumber} agendada para ${new Date(nextKickoffMs).toISOString()}`);
        await persistRound(state, round, { persistTeams: true });
        await persistRound(state, nextRound);
      } else {
        // Última rodada da fase
        setCurrentRound(undefined);
        await persistRound(state, round, { persistTeams: true });
      }
      return true;
    }

    // Reveal só quando o minuto mudou (de fato) — reduz writes
    if (currentMinute > last) {
      round.fixtures = round.fixtures.map(f => {
        const revealedEvents = f.events.filter(e => e.minute <= currentMinute);
        const scoreHome = revealedEvents.filter(e => e.type === 'goal' && e.side === 'home').length;
        const scoreAway = revealedEvents.filter(e => e.type === 'goal' && e.side === 'away').length;
        return { ...f, currentMinute, scoreHome, scoreAway };
      });
      lastPersistedMinute.set(roundKey, currentMinute);
      await persistRound(state, round);
      return true;
    }
  }

  return false;
}

/** Converte time interno para o formato da lib pura */
function teamToLite(t: GlobalTeam): GlobalTeamLite {
  return {
    id: t.id, managerId: t.managerId, clubName: t.clubName, clubShort: t.clubShort,
    overall: t.overall, division: t.division, position: t.position,
    playoffPoints: t.playoffPoints, playoffMatchesPlayed: t.playoffMatchesPlayed,
    playoffWins: t.playoffWins, playoffDraws: t.playoffDraws, playoffLosses: t.playoffLosses,
    playoffGoalsFor: t.playoffGoalsFor, playoffGoalsAgainst: t.playoffGoalsAgainst,
    points: t.points, matchesPlayed: t.matchesPlayed,
    wins: t.wins, draws: t.draws, losses: t.losses,
    goalsFor: t.goalsFor, goalsAgainst: t.goalsAgainst, goalDifference: t.goalDifference,
    recentForm: t.recentForm, registeredAt: t.registeredAt,
  };
}

/** Converte de volta para o formato interno */
function liteToTeam(l: GlobalTeamLite): GlobalTeam {
  return l as GlobalTeam;
}

/** Converte rodada da lib para o formato interno do scheduler */
function liteRoundToRound(r: RoundLite): Round {
  return {
    kind: r.kind,
    roundNumber: r.roundNumber,
    phase: r.phase,
    status: r.status,
    scheduledKickoffMs: r.scheduledKickoffMs,
    actualKickoffMs: r.actualKickoffMs,
    finishedAtMs: r.finishedAtMs,
    fixtures: r.fixtures.map(f => ({ ...f } as Fixture)),
  };
}

/**
 * AUTO-START: waiting_teams + teams.length >= min → gera playoffs e transiciona.
 *
 * IMPORTANTE — Safeguard anti-duplicação:
 *   Se já existem rounds para esta season no banco (caso do persist do state
 *   ter falhado em tick anterior por qualquer motivo), promovemos status
 *   localmente para 'playoffs' e SAÍMOS sem regenerar fixtures. O persist do
 *   state com season_name correto vai concluir a transição no próximo write.
 */
async function tryAutoStartPlayoffs(state: LeagueState, nowMs: number): Promise<boolean> {
  if (state.status !== 'waiting_teams') return false;
  if (state.teams.length < state.minTeamsRequired) return false;
  if (state.teams.length < 2) return false;

  // SAFEGUARD: se já há rounds desta season, não regenerar — só promover status
  if (state.playoffRounds.length > 0) {
    console.log(`[scheduler] AUTO-START skipped: já existem ${state.playoffRounds.length} rounds — promovendo status`);
    state.status = 'playoffs';
    state.currentPlayoffRound = 1;
    await persistTeamsAndState(state);
    return true;
  }

  console.log(`[scheduler] AUTO-START playoffs: ${state.teams.length} times atingiram min=${state.minTeamsRequired}`);

  const liteRounds = logicGenPlayoffs(state.teams.map(teamToLite), nowMs);
  if (liteRounds.length === 0) return false;

  state.playoffRounds = liteRounds.map(liteRoundToRound);
  state.status = 'playoffs';
  state.currentPlayoffRound = 1;

  // Persistir TODAS as rodadas iniciais. persistRound já atualiza state singleton
  // com season_name (necessário pra não falhar no NOT NULL constraint).
  for (const r of state.playoffRounds) {
    await persistRound(state, r);
  }
  return true;
}

/**
 * TRANSIÇÃO playoffs → active: quando última rodada de playoff terminou,
 * distribuir times em divisões e gerar leagueRounds.
 */
async function tryTransitionToLeague(state: LeagueState, nowMs: number): Promise<boolean> {
  if (state.status !== 'playoffs') return false;
  // Só transiciona se TODAS as rodadas de playoff terminaram
  const allFinished = state.playoffRounds.length > 0 && state.playoffRounds.every(r => r.status === 'finished');
  if (!allFinished) return false;

  console.log(`[scheduler] TRANSIÇÃO playoffs → active`);

  const distributed = logicDistribute(state.teams.map(teamToLite));
  state.teams = distributed.map(liteToTeam);

  const leagueLite = logicGenLeague(distributed, nowMs);
  state.leagueRounds = leagueLite.map(liteRoundToRound);
  state.status = 'active';
  state.currentLeagueRound = state.leagueRounds.length > 0 ? 1 : undefined;
  state.currentPlayoffRound = undefined;

  // Persistir times com novas divisões + todas as rodadas da liga
  if (state.leagueRounds.length > 0) {
    for (const r of state.leagueRounds) {
      await persistRound(state, r);
    }
    // Garantir times persistidos com divisão
    await persistRound(state, state.leagueRounds[0], { persistTeams: true });
  } else {
    // Sem rodadas (poucos times) — só atualiza estado e times
    await persistTeamsAndState(state);
  }
  return true;
}

/**
 * TRANSIÇÃO active → waiting_teams (nova season): quando última rodada da liga
 * termina, aplica promoção/rebaixamento, zera stats, cria nova season.
 * O scheduler imediatamente vai tentar auto-start na próxima tick.
 */
async function tryTransitionToNewSeason(state: LeagueState, nowMs: number): Promise<boolean> {
  if (state.status !== 'active') return false;
  const allFinished = state.leagueRounds.length > 0 && state.leagueRounds.every(r => r.status === 'finished');
  if (!allFinished) return false;

  console.log(`[scheduler] TRANSIÇÃO active → nova season`);

  const promoted = logicPromoRele(
    state.teams.map(teamToLite),
    state.promotionPercentage,
    state.relegationPercentage,
  );
  state.teams = promoted.map(liteToTeam);
  state.seasonId = `season_${nowMs}`;
  state.status = 'waiting_teams';
  state.currentLeagueRound = undefined;
  state.currentPlayoffRound = undefined;
  state.playoffRounds = [];
  state.leagueRounds = [];

  // Limpar rodadas/fixtures/events da temporada antiga (mantém time IDs estáveis)
  const sb = getSupabaseAdmin();
  if (sb) {
    await sb.from('global_league_events').delete().neq('id', '');
    await sb.from('global_league_fixtures').delete().neq('id', '');
    await sb.from('global_league_rounds').delete().neq('id', '');
  }

  await persistTeamsAndState(state);
  return true;
}

/** Persiste apenas state + teams (usado nas transições) */
async function persistTeamsAndState(state: LeagueState): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;

  const { error: stateErr } = await sb.from('global_league_state').upsert({
    id: 'current',
    season_id: state.seasonId,
    season_name: `OLEFOOT LIGA — ${state.seasonId}`,
    status: state.status,
    current_playoff_round: state.currentPlayoffRound ?? null,
    current_league_round: state.currentLeagueRound ?? null,
    min_teams_required: state.minTeamsRequired,
    teams_per_division: state.teamsPerDivision,
    promotion_percentage: state.promotionPercentage,
    relegation_percentage: state.relegationPercentage,
  }, { onConflict: 'id' });
  if (stateErr) console.error('[scheduler] state upsert FAILED:', stateErr.message, stateErr.details ?? '');

  if (state.teams.length > 0) {
    await sb.from('global_league_teams').upsert(
      state.teams.map(t => ({
        id: t.id, manager_id: t.managerId, club_name: t.clubName, club_short: t.clubShort,
        overall: t.overall, division: t.division ?? null, position: t.position ?? null,
        previous_position: null,
        playoff_points: t.playoffPoints, playoff_matches_played: t.playoffMatchesPlayed,
        playoff_wins: t.playoffWins, playoff_draws: t.playoffDraws, playoff_losses: t.playoffLosses,
        playoff_goals_for: t.playoffGoalsFor, playoff_goals_against: t.playoffGoalsAgainst,
        points: t.points, matches_played: t.matchesPlayed,
        wins: t.wins, draws: t.draws, losses: t.losses,
        goals_for: t.goalsFor, goals_against: t.goalsAgainst, goal_difference: t.goalDifference,
        recent_form: t.recentForm,
        registered_at: new Date(t.registeredAt).toISOString(),
      })),
      { onConflict: 'id' }
    );
  }
}

/**
 * Recuperação de inconsistência: se current_round = N mas rodada N-1 ainda
 * está 'live', o scheduler reiniciou durante aquela rodada. Finaliza N-1
 * antes de continuar para evitar o travamento que ocorreu em 2026-05-06.
 */
async function recoverStaleRounds(
  state: LeagueState,
  rounds: Round[],
  currentRoundNumber: number,
  applyResults: (teams: GlobalTeam[], fixtures: Fixture[]) => GlobalTeam[],
  setCurrentRound: (n: number | undefined) => void,
  nowMs: number,
): Promise<boolean> {
  const stale = rounds.filter(
    r => r.roundNumber < currentRoundNumber && r.status === 'live'
  );
  if (stale.length === 0) return false;

  for (const round of stale) {
    console.warn(`[scheduler] RECOVERY: finalizando rodada ${round.kind} ${round.roundNumber} travada em 'live'`);
    round.fixtures = round.fixtures.map(f => {
      const goals = f.events.filter(e => e.type === 'goal');
      const scoreHome = goals.filter(e => e.side === 'home').length;
      const scoreAway = goals.filter(e => e.side === 'away').length;
      return { ...f, currentMinute: 90, scoreHome, scoreAway, status: 'finished' as FixtureStatus, finishedAtMs: nowMs };
    });
    round.status = 'finished';
    round.finishedAtMs = nowMs;
    state.teams = applyResults(state.teams, round.fixtures);
    await persistRound(state, round, { persistTeams: true });
  }
  return true;
}

/** Tick principal — avança o estado da liga */
async function tick(): Promise<void> {
  const state = await loadState();
  if (!state) return;

  const nowMs = Date.now();

  // ─── Auto-start playoffs ──────────────────────────────────────────────
  if (await tryAutoStartPlayoffs(state, nowMs)) return;

  // ─── Playoffs ────────────────────────────────────────────────────────
  if (state.status === 'playoffs' && state.currentPlayoffRound) {
    // Recuperar rodadas anteriores travadas em 'live' antes de avançar
    if (await recoverStaleRounds(state, state.playoffRounds, state.currentPlayoffRound, applyPlayoffResults, (n) => { state.currentPlayoffRound = n; }, nowMs)) return;

    const round = state.playoffRounds.find(r => r.roundNumber === state.currentPlayoffRound);
    if (round) {
      const changed = await processRound(
        state,
        round,
        state.playoffRounds,
        (n) => { state.currentPlayoffRound = n; },
        applyPlayoffResults,
        nowMs,
      );
      if (changed) return;
    }
    // Se não houve mudança no round, talvez todas terminaram — tenta transicionar
    await tryTransitionToLeague(state, nowMs);
    return;
  }

  // ─── Liga oficial ────────────────────────────────────────────────────
  if (state.status === 'active' && state.currentLeagueRound) {
    // Recuperar rodadas anteriores travadas em 'live' antes de avançar
    if (await recoverStaleRounds(state, state.leagueRounds, state.currentLeagueRound, applyLeagueResults, (n) => { state.currentLeagueRound = n; }, nowMs)) return;

    const round = state.leagueRounds.find(r => r.roundNumber === state.currentLeagueRound);
    if (round) {
      const changed = await processRound(
        state,
        round,
        state.leagueRounds,
        (n) => { state.currentLeagueRound = n; },
        applyLeagueResults,
        nowMs,
      );
      if (changed) return;
    }
    // Se todas terminaram, transiciona para nova season
    await tryTransitionToNewSeason(state, nowMs);
    return;
  }
}

/** Inicia o loop do scheduler */
export function startGlobalLeagueScheduler(): void {
  const sb = getSupabaseAdmin();
  if (!sb) {
    console.warn('[scheduler] Supabase admin não configurado — scheduler NÃO iniciado.');
    return;
  }

  console.log('[scheduler] Global League Scheduler iniciado (tick a cada 10s)');
  let tickCount = 0;

  const run = async () => {
    tickCount++;
    try {
      await tick();
      if (tickCount % HEARTBEAT_EVERY_N_TICKS === 0) {
        console.log(`[scheduler] heartbeat: ${tickCount} ticks (~${Math.round(tickCount * TICK_INTERVAL_MS / 60000)}min)`);
      }
    } catch (err) {
      console.error('[scheduler] Erro no tick:', err);
    }
  };

  void run();
  setInterval(() => void run(), TICK_INTERVAL_MS);
}
