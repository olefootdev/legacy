import { advanceMatchToPostgame } from '@/engine/matchBulk';
import { defaultLiveMatchShell } from '@/game/initialState';
import type { OlefootGameState } from '@/game/types';
import { makeInboxItem } from '@/game/inboxItem';
import { buildPostMatchStaffInboxItem } from '@/game/postMatchStaffInbox';
import type { FinanceState } from '@/entities/types';
import type { Fixture, OpponentStub } from '@/entities/types';
import { mergeLineupWithDefaults } from '@/entities/lineup';
import { pitchPlayersFromLineup } from '@/engine/pitchFromLineup';
import { tripKmForFixture, applyTravelFatigueToSquad } from '@/systems/logistics';
import { grantEarnedExp } from '@/systems/economy';
import { tickRecoveryMatches } from '@/systems/injury';
import { applyResultToLeagueSeason } from '@/match/leagueSeason';
import { appendMemorableTrophyUnlocks } from '@/trophies/memorableCatalog';
import { evaluateOfficialSquad } from '@/match/squadEligibility';
import {
  fixtureKickoffMs,
  fixtureInvolvesUser,
  userIsHomeInFixture,
  userTeamIdForLeague,
  type LeagueScheduleBucket,
  type ScheduledLeagueFixture,
} from '@/match/leagueSchedule';
import {
  patchStandingsAfterResult,
  simAiVersusAi,
  standingRowByTeamId,
  syntheticOpponentStrength,
} from '@/match/leagueStandingsPatch';
import { normalizeOpponentStub } from '@/entities/team';
import type { LiveMatchSnapshot } from '@/engine/types';
import type { FormLetter } from '@/entities/types';

/** Evita simular meses de uma vez no mesmo WORLD_CATCH_UP; o resto fica para a próxima sincronização. */
export const MAX_LEAGUE_FIXTURES_PER_WORLD_CATCHUP = 12;

function appendExpHistory(finance: FinanceState, amount: number, source: string): FinanceState {
  if (!amount) return finance;
  const next = [
    {
      id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      amount: Math.round(amount),
      source,
      createdAt: new Date().toISOString(),
    },
    ...(finance.expHistory ?? []),
  ].slice(0, 120);
  return { ...finance, expHistory: next };
}

function homeRosterFromLineupState(state: OlefootGameState): import('@/entities/types').PlayerEntity[] {
  const lu = mergeLineupWithDefaults(state.lineup, state.players);
  const ids = new Set<string>(Object.values(lu));
  return Array.from(ids)
    .map((id) => state.players[id])
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
}

function buildTempFixture(
  state: OlefootGameState,
  fx: ScheduledLeagueFixture,
  userTeamId: string,
  opponentName: string,
  opponentTeamId: string,
): Fixture {
  const userHome = userIsHomeInFixture(fx, userTeamId);
  const short = opponentName.length > 8 ? opponentName.slice(0, 8).toUpperCase() : opponentName.toUpperCase();
  const opponent: OpponentStub = normalizeOpponentStub({
    id: opponentTeamId,
    name: opponentName,
    shortName: short,
    strength: syntheticOpponentStrength(opponentTeamId),
  });
  return {
    id: fx.id,
    kickoffLabel: `${fx.dateIso} ${fx.kickoffHHmm}`,
    venue: state.club.stadium,
    competition: state.adminLeagues.find((l) => l.id === fx.leagueId)?.name ?? 'Liga',
    homeName: userHome ? state.club.name : opponentName,
    awayName: userHome ? opponentName : state.club.name,
    opponent,
    isHome: userHome,
  };
}

function woSnapshot(state: OlefootGameState, homeScore: number, awayScore: number): LiveMatchSnapshot {
  const lu = mergeLineupWithDefaults(state.lineup, state.players);
  const fs = state.manager.formationScheme;
  const homePlayers = pitchPlayersFromLineup(lu, state.players, fs);
  return {
    ...defaultLiveMatchShell(
      state.club.shortName,
      'WO',
      homePlayers,
      lu,
      0,
      fs,
      { homeName: state.club.name, awayName: 'WO' },
    ),
    mode: 'auto',
    phase: 'postgame',
    minute: 90,
    footballElapsedSec: 90 * 60,
    homeScore,
    awayScore,
    events: [
      {
        id: `wo-${Date.now()}`,
        minute: 0,
        text: `WO — Equipa não cumpriu requisitos mínimos de inscrição (11 titulares + 5 no banco).`,
        kind: 'whistle',
      },
    ],
  };
}

function applyUserMatchResolution(
  state: OlefootGameState,
  fx: ScheduledLeagueFixture,
  leagueId: string,
  userTeamId: string,
  walkover: boolean,
  walkoverUserLoses: boolean,
): OlefootGameState {
  const league = state.adminLeagues.find((l) => l.id === leagueId);
  if (!league) return state;

  const userHome = userIsHomeInFixture(fx, userTeamId);
  const oppTeamId = userHome ? fx.awayTeamId : fx.homeTeamId;
  const oppName = userHome ? fx.awayName : fx.homeName;
  const tempFx = buildTempFixture(state, fx, userTeamId, oppName, oppTeamId);

  let players = state.players;
  let liveMatch: LiveMatchSnapshot;
  let officialSH: number;
  let officialSA: number;

  if (walkover && walkoverUserLoses) {
    if (userHome) {
      officialSH = 0;
      officialSA = 3;
    } else {
      officialSH = 3;
      officialSA = 0;
    }
    liveMatch = woSnapshot(state, userHome ? officialSH : officialSA, userHome ? officialSA : officialSH);
  } else {
    const travelKm = tripKmForFixture(tempFx);
    players = applyTravelFatigueToSquad(players, travelKm);
    const lu = mergeLineupWithDefaults(state.lineup, players);
    const fs = state.manager.formationScheme;
    const homePlayers = pitchPlayersFromLineup(lu, players, fs);
    liveMatch = defaultLiveMatchShell(
      state.club.shortName,
      tempFx.opponent.shortName,
      homePlayers,
      lu,
      travelKm,
      fs,
      { homeName: state.club.name, awayName: tempFx.opponent.name },
    );
    liveMatch = { ...liveMatch, mode: 'auto', phase: 'playing' };
    const roster = homeRosterFromLineupState({ ...state, players });
    const out = advanceMatchToPostgame({
      snapshot: liveMatch,
      homeRoster: roster,
      allPlayers: players,
      crowdSupport: state.crowd.supportPercent,
      tacticalMentality: state.manager.tacticalMentality,
      tacticalStyle: state.manager.tacticalStyle,
      opponentStrength: tempFx.opponent.strength,
      awayShort: tempFx.opponent.shortName,
      opponentId: tempFx.opponent.id,
    });
    liveMatch = out.snapshot;
    players = { ...players, ...out.updatedPlayers };
    officialSH = userHome ? liveMatch.homeScore : liveMatch.awayScore;
    officialSA = userHome ? liveMatch.awayScore : liveMatch.homeScore;
  }

  const userFor = userHome ? officialSH : officialSA;
  const userAgainst = userHome ? officialSA : officialSH;
  const userWin = userFor > userAgainst;
  const draw = userFor === userAgainst;
  const oleGain = 80 + userFor * 35 + (userWin ? 120 : 0);
  let finance = grantEarnedExp(state.finance, oleGain);
  finance = appendExpHistory(finance, oleGain, 'Jornada (GameSpirit)');

  const staffNote = buildPostMatchStaffInboxItem(state, liveMatch);
  const financeNote = makeInboxItem(`finance-${fx.id}`, 'FINANCE_EXP_GAIN', 'FINANCEIRO', `+${oleGain} EXP (jogo simulado)`, {
    body: 'Resultado processado automaticamente pelo GameSpirit.',
    deepLink: '/wallet',
    hideFromHomeFeed: true,
  });
  const simNote = makeInboxItem(
    `league-sim-${fx.id}`,
    'LEAGUE_MATCH_SIMULATED',
    'COMPETIÇÃO',
    `${fx.homeName} ${officialSH}–${officialSA} ${fx.awayName}`,
    {
      body: `Não estiveste no relvado à hora marcada — o GameSpirit correu a partida. ${walkover && walkoverUserLoses ? 'WO por plantel incompleto.' : 'Vê o calendário para a próxima jornada.'}`,
      deepLink: '/calendar',
    },
  );

  const nextResult: FormLetter = userWin ? 'W' : draw ? 'D' : 'L';
  const form = [...state.form.slice(1), nextResult];
  const lastRow = {
    home: state.club.name,
    away: oppName,
    scoreHome: userFor,
    scoreAway: userAgainst,
    status: 'FT',
    result: userWin ? ('win' as const) : draw ? ('draw' as const) : ('loss' as const),
  };
  const results = [lastRow, ...state.results].slice(0, 8);
  players = tickRecoveryMatches(players);

  let leagueSeason = state.leagueSeason;
  let memorableTrophyUnlockedIds = state.memorableTrophyUnlockedIds ?? [];
  if (league.syncStatsFromSeason && league.id === state.adminPrimaryLeagueId) {
    leagueSeason = applyResultToLeagueSeason(leagueSeason, lastRow);
    memorableTrophyUnlockedIds = appendMemorableTrophyUnlocks(memorableTrophyUnlockedIds, {
      homeWin: userWin,
      competition: league.name,
      leaguePoints: leagueSeason.points,
      leaguePlayed: leagueSeason.played,
    });
  }

  let adminLeagues = patchStandingsAfterResult(state.adminLeagues, leagueId, fx.homeTeamId, fx.awayTeamId, officialSH, officialSA);

  const inbox = [simNote, staffNote, financeNote, ...state.inbox].slice(0, 20);

  const resolvedFx: ScheduledLeagueFixture = {
    ...fx,
    status: walkover && walkoverUserLoses ? 'walkover' : 'finished',
    scoreHome: officialSH,
    scoreAway: officialSA,
    walkoverWinner: walkover && walkoverUserLoses ? (userHome ? 'away' : 'home') : undefined,
    walkoverNote: walkover && walkoverUserLoses ? 'Plantel incompleto (11+5)' : undefined,
    resolvedAtMs: Date.now(),
  };

  const bucket = state.leagueSchedule.byLeagueId[leagueId];
  if (!bucket) return state;
  const nextBucket: LeagueScheduleBucket = {
    ...bucket,
    fixtures: bucket.fixtures.map((f) => (f.id === fx.id ? resolvedFx : f)),
  };

  const nextSchedule = {
    ...state.leagueSchedule,
    byLeagueId: { ...state.leagueSchedule.byLeagueId, [leagueId]: nextBucket },
  };

  const nextFixture = pickNextFixtureFromSchedule({ ...state, adminLeagues, leagueSchedule: nextSchedule });

  return {
    ...state,
    players,
    finance,
    inbox,
    form,
    results,
    leagueSeason,
    memorableTrophyUnlockedIds,
    adminLeagues,
    leagueSchedule: nextSchedule,
    liveMatch: null,
    nextFixture: nextFixture ?? state.nextFixture,
  };
}

function pickNextFixtureFromSchedule(state: OlefootGameState): import('@/entities/types').Fixture | undefined {
  const league = state.adminLeagues.find((l) => l.id === state.adminPrimaryLeagueId);
  const bucket = league ? state.leagueSchedule.byLeagueId[league.id] : undefined;
  const uid = league ? userTeamIdForLeague(league, state.club) : undefined;
  if (!league || !bucket || !uid) return undefined;
  const now = Date.now();
  const upcoming = bucket.fixtures
    .filter((f) => f.status === 'scheduled' && fixtureInvolvesUser(f, uid))
    .sort((a, b) => fixtureKickoffMs(a) - fixtureKickoffMs(b))
    .find((f) => fixtureKickoffMs(f) > now);
  if (!upcoming) return undefined;
  const oppName = upcoming.homeTeamId === uid ? upcoming.awayName : upcoming.homeName;
  const oppId = upcoming.homeTeamId === uid ? upcoming.awayTeamId : upcoming.homeTeamId;
  return buildTempFixture(state, upcoming, uid, oppName, oppId);
}

function resolveAiOnlyMatch(
  state: OlefootGameState,
  fx: ScheduledLeagueFixture,
  leagueId: string,
): OlefootGameState {
  const league = state.adminLeagues.find((l) => l.id === leagueId);
  if (!league) return state;
  const homeRow = standingRowByTeamId(league, fx.homeTeamId);
  const awayRow = standingRowByTeamId(league, fx.awayTeamId);
  if (!homeRow || !awayRow) return state;
  const { scoreHome, scoreAway } = simAiVersusAi(homeRow, awayRow);
  let adminLeagues = patchStandingsAfterResult(state.adminLeagues, leagueId, fx.homeTeamId, fx.awayTeamId, scoreHome, scoreAway);

  const resolvedFx: ScheduledLeagueFixture = {
    ...fx,
    status: 'finished',
    scoreHome,
    scoreAway,
    resolvedAtMs: Date.now(),
  };
  const bucket = state.leagueSchedule.byLeagueId[leagueId];
  if (!bucket) return state;
  const nextBucket: LeagueScheduleBucket = {
    ...bucket,
    fixtures: bucket.fixtures.map((f) => (f.id === fx.id ? resolvedFx : f)),
  };
  return {
    ...state,
    adminLeagues,
    leagueSchedule: {
      ...state.leagueSchedule,
      byLeagueId: { ...state.leagueSchedule.byLeagueId, [leagueId]: nextBucket },
    },
  };
}

/**
 * Processa jogos agendados cuja hora de início já passou (GameSpirit corre sozinho).
 * Não corre jogo do utilizador se já houver `liveMatch` em curso.
 */
export function processLeagueScheduleDue(state: OlefootGameState, nowMs: number): OlefootGameState {
  const primaryId = state.adminPrimaryLeagueId;
  const bucket = state.leagueSchedule.byLeagueId[primaryId];
  const league = state.adminLeagues.find((l) => l.id === primaryId);
  if (!bucket?.fixtures.length || !league || league.format !== 'round_robin') {
    return state;
  }

  const userTeamId = userTeamIdForLeague(league, state.club);
  const due = bucket.fixtures
    .filter((f) => f.status === 'scheduled' && fixtureKickoffMs(f) <= nowMs)
    .sort((a, b) => fixtureKickoffMs(a) - fixtureKickoffMs(b));

  let next = state;
  let processed = 0;
  let stoppedByCatchUpLimit = false;
  for (const fx of due) {
    if (processed >= MAX_LEAGUE_FIXTURES_PER_WORLD_CATCHUP) {
      stoppedByCatchUpLimit = true;
      break;
    }
    const playingUser = next.liveMatch && next.liveMatch.phase === 'playing';
    if (fixtureInvolvesUser(fx, userTeamId)) {
      if (playingUser) break;
      const squad = evaluateOfficialSquad(next.lineup, next.players);
      const wo = !squad.ok;
      next = applyUserMatchResolution(next, fx, primaryId, userTeamId!, wo, wo);
      processed += 1;
      continue;
    }
    next = resolveAiOnlyMatch(next, fx, primaryId);
    processed += 1;
  }

  if (stoppedByCatchUpLimit) {
    const inboxRest = next.inbox.filter((i) => i.id !== 'league-catchup-pending');
    const queueNote = makeInboxItem(
      'league-catchup-pending',
      'FIXTURE_REMINDER',
      'COMPETIÇÃO',
      'Calendário: ainda há jogos por processar',
      {
        body: `Foram simulados até ${MAX_LEAGUE_FIXTURES_PER_WORLD_CATCHUP} jogos nesta sincronização (para não sobrecarregar o jogo de uma vez). Os restantes entram na próxima abertura do app ou no próximo ciclo de tempo real.`,
        deepLink: '/calendar',
      },
    );
    next = { ...next, inbox: [queueNote, ...inboxRest].slice(0, 24) };
  }

  const nf = pickNextFixtureFromSchedule(next);
  if (nf) next = { ...next, nextFixture: nf };
  return next;
}
