import { pitchPlayersFromLineup } from '@/engine/pitchFromLineup';
import { runMatchMinute } from '@/engine/runMatchMinute';
import { advanceMatchToPostgame, runMatchMinuteBulk } from '@/engine/matchBulk';
import { applySubstitution } from '@/engine/substitution';
import type { GameAction, OlefootGameState } from './types';
import { createInitialGameState, defaultLiveMatchShell } from './initialState';
import { rehydrateGameState } from './persistence';
import { mergeLineupWithDefaults } from '@/entities/lineup';
import { overallFromAttributes } from '@/entities/player';
import { addBroCents, addOle, friendlyChallengeBroFeeCents, grantEarnedExp } from '@/systems/economy';
import { tripKmForFixture, applyTravelFatigueToSquad } from '@/systems/logistics';
import { tickRecoveryMatches } from '@/systems/injury';
import { applyWorldCatchUp } from './worldCatchUp';
import { applySquadTraining } from '@/systems/training';
import { buyOlePack } from '@/systems/market';
import type { MatchEventEntry } from '@/engine/types';
import { tryUpgradeStructure } from '@/clubStructures/upgrade';
import { DEFAULT_BRO_PRICES_CENTS } from '@/clubStructures/broDefaults';
import { STRUCTURE_LABELS, LEDGER_REASON_EXP, LEDGER_REASON_BRO } from '@/clubStructures/types';
import { gatCategoryForStructure } from '@/clubStructures/gatCategory';
import {
  CITY_QUICK_MEDICAL_COST_EXP,
  CITY_QUICK_MEDICAL_FATIGUE_DELTA,
  CITY_QUICK_MEDICAL_INJURY_RISK_DELTA,
  CITY_QUICK_STORE_BRO_GAIN_CENTS,
  CITY_QUICK_STORE_COST_EXP,
  CITY_QUICK_STORE_CROWD_DELTA,
  CITY_QUICK_TRAINING_COST_EXP,
  CITY_QUICK_TRAINING_DURATION_H,
  STADIUM_UPGRADE_CROWD_DELTA,
} from './cityQuickConstants';
import { createInitialWalletState } from '@/wallet/initial';
import {
  createOlexpPosition,
  claimOlexpPrincipal,
  accrueOlexpDaily,
  earlyExitOlexpToSpot,
} from '@/wallet/olexp';
import { writeSwapKycToStorage } from '@/wallet/swapKycStorage';
import { registerSponsor as walletRegisterSponsor } from '@/wallet/referral';
import { registerGatBase, accrueGatDaily } from '@/wallet/gat';
import { simulateFiatDeposit, simulateFiatWithdrawal } from '@/wallet/adminFiatFlow';
import { STYLE_PRESETS } from '@/tactics/playingStyle';
import { applyResultToLeagueSeason } from '@/match/leagueSeason';
import { addHoursIso, applyTrainingToPlayer, maxSlotsByTrainingCenter, resolveGroupPlayerIds, splitDuePlans } from '@/systems/trainingPlans';
import {
  STAFF_LABELS,
  amplifyTrainingResult,
  applyNutritionRecovery,
  maxStaffSlotsByLevel,
  scoutExpReward,
  trainingGainMultiplier,
  tryUpgradeStaffRole,
} from '@/systems/staff';
import { hashStringSeed } from '@/match/seededRng';
import { FORMATION_BASES } from '@/match-engine/formations/catalog';
import { appendMemorableTrophyUnlocks } from '@/trophies/memorableCatalog';
import { buildLivePrematchBundle } from '@/gamespirit/buildLivePrematch';
import {
  advancePenaltyStage,
  penaltyNarrativeLine,
  penaltyOverlayForStage,
  rollPenaltyOutcome,
} from '@/gamespirit/spiritStateMachine';
import {
  appendGoalScorerHome,
  appendTeamGoalConcededHome,
  appendTeamGoalScoredHome,
} from '@/match/impactLedger';
import type { FormationSchemeId } from '@/match-engine/types';
import { insertMatch, queueMatchEvents, finalizeMatch, persistPlayers } from '@/supabase/matchPersistence';
import type { SocialState } from '@/social/types';
import { discoverableById } from '@/social/catalog';
import { makeInboxItem } from './inboxItem';
import { buildPostMatchStaffInboxItem } from './postMatchStaffInbox';

function socialOf(state: OlefootGameState): SocialState {
  return state.social ?? { friends: [], incoming: [], outgoing: [] };
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function walletOf(state: OlefootGameState) {
  return state.finance.wallet ?? createInitialWalletState();
}

function syncWalletToFinance(state: OlefootGameState, wallet: import('@/wallet/types').WalletState): OlefootGameState {
  return {
    ...state,
    finance: {
      ...state.finance,
      broCents: state.finance.broCents + (wallet.spotBroCents - (state.finance.wallet?.spotBroCents ?? 0)),
      wallet,
    },
  };
}

function homeRosterFromLineup(state: OlefootGameState): import('@/entities/types').PlayerEntity[] {
  const lu = mergeLineupWithDefaults(state.lineup, state.players);
  const ids = new Set<string>(Object.values(lu));
  return Array.from(ids)
    .map((id) => state.players[id])
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
}

function crowdMood(support: number): string {
  if (support < 40) return 'Cética';
  if (support < 62) return 'Expectante';
  if (support < 82) return 'Confiante';
  return 'Euforia';
}

function withExpHistory(
  finance: import('@/entities/types').FinanceState,
  amount: number,
  source: string,
): import('@/entities/types').FinanceState {
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

function syncWalletSpotBro(finance: import('@/entities/types').FinanceState): import('@/entities/types').FinanceState {
  if (!finance.wallet) return finance;
  return { ...finance, wallet: { ...finance.wallet, spotBroCents: finance.broCents } };
}

function runTick(state: OlefootGameState): OlefootGameState {
  if (!state.liveMatch || state.liveMatch.phase !== 'playing') return state;
  const roster = homeRosterFromLineup(state);
  const { snapshot, updatedPlayers } = runMatchMinute({
    snapshot: state.liveMatch,
    homeRoster: roster,
    allPlayers: state.players,
    crowdSupport: state.crowd.supportPercent,
    tacticalMentality: state.manager.tacticalMentality,
    tacticalStyle: state.manager.tacticalStyle,
    opponentStrength: state.nextFixture.opponent.strength,
    awayShort: state.nextFixture.opponent.shortName,
    opponentId: state.nextFixture.opponent.id,
    awayRoster: state.liveMatch.awayRoster,
  });
  let liveMatch = snapshot;
  const players = { ...state.players, ...updatedPlayers };
  if (liveMatch.minute >= 90 && liveMatch.phase === 'playing') {
    const whistle: MatchEventEntry = {
      id: uid(),
      minute: 90,
      text: `90' — Apito final.`,
      kind: 'whistle',
    };
    liveMatch = { ...liveMatch, phase: 'postgame', events: [whistle, ...liveMatch.events] };
  }
  return { ...state, liveMatch, players };
}

export function gameReducer(state: OlefootGameState, action: GameAction): OlefootGameState {
  switch (action.type) {
    case 'SET_LINEUP': {
      const lineup = { ...action.lineup };
      let formationScheme: FormationSchemeId | undefined = action.formationScheme;
      if (formationScheme && !(formationScheme in FORMATION_BASES)) {
        formationScheme = undefined;
      }
      if (formationScheme) {
        return {
          ...state,
          lineup,
          manager: { ...state.manager, formationScheme },
        };
      }
      return { ...state, lineup };
    }
    case 'START_LIVE_MATCH': {
      const lu = mergeLineupWithDefaults(state.lineup, state.players);
      const travelKm = tripKmForFixture(state.nextFixture);
      let players = applyTravelFatigueToSquad(state.players, travelKm);
      const fs = state.manager.formationScheme;
      const homePlayers = pitchPlayersFromLineup(lu, players, fs);
      let liveMatch = defaultLiveMatchShell(
        state.club.shortName,
        state.nextFixture.opponent.shortName,
        homePlayers,
        lu,
        travelKm,
        fs,
        { homeName: state.club.name, awayName: state.nextFixture.opponent.name },
      );
      liveMatch = { ...liveMatch, mode: action.mode };

      if (action.mode === 'auto') {
        liveMatch = { ...liveMatch, phase: 'playing' };
        const roster = homeRosterFromLineup({ ...state, players });
        const { snapshot, updatedPlayers } = advanceMatchToPostgame({
          snapshot: liveMatch,
          homeRoster: roster,
          allPlayers: players,
          crowdSupport: state.crowd.supportPercent,
          tacticalMentality: state.manager.tacticalMentality,
          tacticalStyle: state.manager.tacticalStyle,
          opponentStrength: state.nextFixture.opponent.strength,
          awayShort: state.nextFixture.opponent.shortName,
        });
        players = { ...players, ...updatedPlayers };
        liveMatch = snapshot;
      } else if (action.mode === 'quick') {
        const kick: MatchEventEntry = {
          id: uid(),
          minute: 0,
          text: `0' — ${state.club.shortName} x ${state.nextFixture.opponent.shortName} (partida rápida).`,
          kind: 'whistle',
        };
        const opp = state.nextFixture.opponent;
        const awaySlots: { pos: string; num: number }[] = [
          { pos: 'GOL', num: 1 }, { pos: 'ZAG', num: 4 }, { pos: 'ZAG', num: 5 },
          { pos: 'LE', num: 3 }, { pos: 'LD', num: 2 }, { pos: 'VOL', num: 8 },
          { pos: 'MC', num: 6 }, { pos: 'MC', num: 10 }, { pos: 'PE', num: 7 },
          { pos: 'PD', num: 11 }, { pos: 'ATA', num: 9 },
        ];
        const surnames = ['RIBEIRO','NUNES','CARVALHO','MENDES','TEIXEIRA','BARBOSA','CARDOSO','REIS','MOREIRA','CASTRO','FREITAS'];
        const sessionKey = Date.now();
        const awayRoster = awaySlots.map((slot, i) => {
          const h = hashStringSeed(`${opp.id}|away|${sessionKey}|${i}`);
          const sur = surnames[Math.abs(h) % surnames.length]!;
          const isStar = slot.pos === 'ATA' && opp.highlightPlayer;
          return {
            id: `away-${opp.id}-${sessionKey}-${i}`,
            num: slot.num,
            name: isStar ? opp.highlightPlayer!.name : sur,
            pos: slot.pos,
          };
        });
        liveMatch = {
          ...liveMatch,
          phase: 'playing',
          minute: 0,
          clockPeriod: 'first_half',
          events: [kick],
          awayRoster,
        };
      } else if (action.mode === 'live') {
        const simSeed = hashStringSeed(
          `${state.club.shortName}|${state.nextFixture.opponent.shortName}|${homePlayers.length}|live`,
        );
        const roster = homeRosterFromLineup({ ...state, players });
        const livePrematch = buildLivePrematchBundle({
          homePlayers,
          homeRoster: roster,
          opponentStrength: state.nextFixture.opponent.strength,
          homeShort: state.club.shortName,
          awayShort: state.nextFixture.opponent.shortName,
          simulationSeed: simSeed,
        });
        liveMatch = {
          ...liveMatch,
          simulationSeed: simSeed,
          livePrematch,
        };
      }

      void insertMatch({
        homeClubId: state.club.id,
        awayName: state.nextFixture.opponent.shortName,
        mode: action.mode,
        simulationSeed: liveMatch.simulationSeed,
      }).then((sbId) => {
        if (sbId) liveMatch.supabaseMatchId = sbId;
      });

      return {
        ...state,
        players,
        liveMatch,
        clubLogistics: { lastTripKm: travelKm },
      };
    }
    case 'BEGIN_PLAY_FROM_PREGAME': {
      if (!state.liveMatch || state.liveMatch.phase !== 'pregame') return state;
      const kick: MatchEventEntry = {
        id: uid(),
        minute: 0,
        text: `0' — Bola rolando. ${state.liveMatch.homeShort} x ${state.liveMatch.awayShort}.`,
        kind: 'whistle',
      };
      return {
        ...state,
        liveMatch: {
          ...state.liveMatch,
          phase: 'playing',
          minute: 0,
          clockPeriod: 'first_half',
          events: [kick, ...state.liveMatch.events],
        },
      };
    }
    case 'TICK_MATCH_MINUTE': {
      return runTick(state);
    }
    case 'SIM_SYNC': {
      if (!state.liveMatch || state.liveMatch.phase !== 'playing') return state;
      const lm = state.liveMatch;
      const simStats: Record<string, { passesOk: number; passesAttempt: number; tackles: number; km: number; rating: number }> = {};
      for (const [pid, s] of Object.entries(action.stats)) {
        const comp = s.passesAttempt > 0 ? s.passesOk / s.passesAttempt : 0.75;
        simStats[pid] = {
          passesOk: s.passesOk,
          passesAttempt: s.passesAttempt,
          tackles: s.tackles,
          km: s.km,
          rating: Math.min(9.2, 6 + comp * 2.2 + s.tackles * 0.08 + Math.min(1.2, s.km / 12)),
        };
      }
      const homeScore = action.homeScore;
      const awayScore = action.awayScore;
      let mergedEvents = [...lm.events];
      if (action.events.length > 0) {
        mergedEvents = action.events;
      }

      let nextLive: import('@/engine/types').LiveMatchSnapshot = {
        ...lm,
        minute: action.minute,
        clockPeriod: action.clockPeriod,
        homeScore,
        awayScore,
        possession: action.possession,
        onBallPlayerId: action.carrierId ?? undefined,
        events: mergedEvents,
        homeStats: { ...lm.homeStats, ...simStats },
      };

      if (lm.supabaseMatchId && action.events.length > 0) {
        const newEvents = action.events.filter((ev) => !lm.events.some((e) => e.id === ev.id));
        if (newEvents.length > 0) queueMatchEvents(lm.supabaseMatchId, newEvents);
      }

      if (action.fullTime && nextLive.phase === 'playing') {
        const whistle: import('@/engine/types').MatchEventEntry = {
          id: `ft-${Date.now()}`,
          minute: 90,
          text: `90' — Apito final.`,
          kind: 'whistle',
        };
        nextLive = { ...nextLive, phase: 'postgame', events: [whistle, ...nextLive.events] };
      }
      return { ...state, liveMatch: nextLive };
    }
    case 'CLEAR_SPIRIT_PENDING_RESTART': {
      if (!state.liveMatch) return state;
      return {
        ...state,
        liveMatch: { ...state.liveMatch, spiritPendingRestart: null },
      };
    }
    case 'SET_SPIRIT_OVERLAY': {
      if (!state.liveMatch) return state;
      return {
        ...state,
        liveMatch: { ...state.liveMatch, spiritOverlay: action.overlay },
      };
    }
    case 'DISMISS_SPIRIT_OVERLAY': {
      if (!state.liveMatch) return state;
      const lm = state.liveMatch;
      let spiritPhase = lm.spiritPhase ?? 'open_play';
      let penalty = lm.penalty ?? null;
      if (spiritPhase === 'celebration_goal') spiritPhase = 'open_play';
      if (penalty?.stage === 'result') {
        penalty = null;
        spiritPhase = 'open_play';
      }
      return {
        ...state,
        liveMatch: {
          ...lm,
          spiritOverlay: null,
          spiritPhase,
          penalty,
          spiritMomentumClamp01: 0.5,
          preGoalHint: null,
        },
      };
    }
    case 'APPLY_SPIRIT_OUTCOME': {
      if (!state.liveMatch) return state;
      const lm = state.liveMatch;
      const { payload } = action;
      if (payload.kind === 'penalty_advance') {
        const pen = lm.penalty;
        if (!pen || pen.stage === 'kick') return state;
        const nextPen = advancePenaltyStage(pen);
        if (nextPen.stage === pen.stage) return state;
        const nowMs = Date.now();
        const auto =
          nextPen.stage === 'walk' ? 2000 : nextPen.stage === 'kick' ? 1700 : 2000;
        const ov = penaltyOverlayForStage(
          nextPen.stage,
          nextPen.takerName,
          lm.homeShort,
          lm.awayShort,
          nowMs,
          auto,
        );
        return {
          ...state,
          liveMatch: { ...lm, penalty: nextPen, spiritOverlay: ov },
        };
      }
      if (payload.kind === 'penalty_resolve') {
        const pen = lm.penalty;
        if (!pen || pen.stage !== 'kick') return state;
        const rng = payload.rng ?? Math.random();
        const outcome = rollPenaltyOutcome(rng);
        const line = penaltyNarrativeLine(outcome, pen.takerName, 'O guarda-redes');
        const isGoal = outcome === 'goal' || outcome === 'post_in';
        let homeScore = lm.homeScore;
        let awayScore = lm.awayScore;
        if (isGoal && pen.side === 'home') homeScore += 1;
        if (isGoal && pen.side === 'away') awayScore += 1;
        const nowMs = Date.now();
        const newPen = { ...pen, stage: 'result' as const, outcome };
        const ov = penaltyOverlayForStage(
          'result',
          pen.takerName,
          lm.homeShort,
          lm.awayShort,
          nowMs,
          2600,
          line,
        );
        const events = [...lm.events];
        const minute = lm.minute;
        const takerPlayerId = pen.takerId ?? lm.homePlayers.find((h) => h.name === pen.takerName)?.playerId;
        if (isGoal && pen.side === 'home') {
          events.unshift({
            id: uid(),
            minute,
            text: `${minute}' — ${line}`,
            kind: 'goal_home',
            playerId: takerPlayerId,
            momentumFlash: true,
            threatBar01: 0.5,
          });
        } else if (isGoal && pen.side === 'away') {
          events.unshift({
            id: uid(),
            minute,
            text: `${minute}' — ${line}`,
            kind: 'goal_away',
            playerId: pen.takerId,
            momentumFlash: true,
            threatBar01: 0.5,
          });
        } else {
          events.unshift({
            id: uid(),
            minute,
            text: `${minute}' — ${line}`,
            kind: 'penalty_result',
            playerId: takerPlayerId,
          });
        }
        if (events.length > 40) events.length = 40;

        let impactLedger = [...(lm.homeImpactLedger ?? [])];
        if (isGoal && pen.side === 'home') {
          const gid = takerPlayerId ?? lm.homePlayers.find((h) => h.name === pen.takerName)?.playerId;
          appendTeamGoalScoredHome(impactLedger, minute, lm.homePlayers.map((p) => p.playerId));
          if (gid) appendGoalScorerHome(impactLedger, minute, gid, lm.homeCaptainPlayerId);
        }
        if (isGoal && pen.side === 'away') {
          appendTeamGoalConcededHome(impactLedger, minute, lm.homePlayers);
        }

        return {
          ...state,
          liveMatch: {
            ...lm,
            homeScore,
            awayScore,
            penalty: newPen,
            spiritOverlay: ov,
            events,
            homeImpactLedger: impactLedger,
          },
        };
      }
      return state;
    }
    case 'COACH_TECHNICAL_COMMAND': {
      return state;
    }
    case 'REGENERATE_LIVE_SECOND_HALF_STORY': {
      return state;
    }
    case 'TICK_MATCH_BULK': {
      if (!state.liveMatch || state.liveMatch.phase !== 'playing') return state;
      const roster = homeRosterFromLineup(state);
      const { snapshot, updatedPlayers } = runMatchMinuteBulk({
        snapshot: state.liveMatch,
        homeRoster: roster,
        allPlayers: state.players,
        crowdSupport: state.crowd.supportPercent,
        tacticalMentality: state.manager.tacticalMentality,
        tacticalStyle: state.manager.tacticalStyle,
        opponentStrength: state.nextFixture.opponent.strength,
        awayShort: state.nextFixture.opponent.shortName,
        steps: action.steps,
      });
      let liveMatch = snapshot;
      const players = { ...state.players, ...updatedPlayers };
      if (liveMatch.minute >= 90 && liveMatch.phase === 'playing') {
        const whistle: MatchEventEntry = {
          id: uid(),
          minute: 90,
          text: `90' — Apito final.`,
          kind: 'whistle',
        };
        liveMatch = { ...liveMatch, phase: 'postgame', events: [whistle, ...liveMatch.events] };
      }
      return { ...state, liveMatch, players };
    }
    case 'MATCH_SUBSTITUTE': {
      if (!state.liveMatch) return state;
      const res = applySubstitution({
        snapshot: state.liveMatch,
        players: state.players,
        outPlayerId: action.outPlayerId,
        inPlayerId: action.inPlayerId,
        minute: state.liveMatch.minute,
      });
      if (res.error) return state;
      const snap = res.snapshot;
      return { ...state, liveMatch: snap };
    }
    case 'END_MATCH_TO_POST': {
      if (!state.liveMatch) return state;
      return { ...state, liveMatch: { ...state.liveMatch, phase: 'postgame' } };
    }
    case 'FORFEIT_MATCH': {
      const asMode = action.mode;
      const forfeiEv: MatchEventEntry = {
        id: uid(),
        minute: 90,
        text: `WO — Desistência: vitória de ${state.nextFixture.opponent.shortName} por 5–0.`,
        kind: 'whistle',
      };

      if (state.liveMatch && state.liveMatch.mode === asMode) {
        const lm = state.liveMatch;
        return {
          ...state,
          liveMatch: {
            ...lm,
            phase: 'postgame',
            homeScore: 0,
            awayScore: 5,
            minute: Math.max(lm.minute, 90),
            events: [forfeiEv, ...lm.events],
          },
        };
      }

      const lu = mergeLineupWithDefaults(state.lineup, state.players);
      const travelKm = tripKmForFixture(state.nextFixture);
      const players = applyTravelFatigueToSquad(state.players, travelKm);
      const fs = state.manager.formationScheme;
      const homePlayers = pitchPlayersFromLineup(lu, players, fs);
      let liveMatch = defaultLiveMatchShell(
        state.club.shortName,
        state.nextFixture.opponent.shortName,
        homePlayers,
        lu,
        travelKm,
        fs,
        { homeName: state.club.name, awayName: state.nextFixture.opponent.name },
      );
      liveMatch = {
        ...liveMatch,
        mode: asMode,
        phase: 'postgame',
        minute: 90,
        homeScore: 0,
        awayScore: 5,
        events: [forfeiEv],
        homeStats: {},
      };
      return {
        ...state,
        players,
        liveMatch,
        clubLogistics: { lastTripKm: travelKm },
      };
    }
    case 'FINALIZE_MATCH': {
      if (!state.liveMatch) return state;
      const lm = state.liveMatch;
      const oleGain = 80 + lm.homeScore * 35 + (lm.homeScore > lm.awayScore ? 120 : 0);
      const homeWin = lm.homeScore > lm.awayScore;
      const draw = lm.homeScore === lm.awayScore;
      let finance = grantEarnedExp(state.finance, oleGain);
      finance = withExpHistory(finance, oleGain, 'Recompensa de partida');
      const staffNote = buildPostMatchStaffInboxItem(state, lm);
      const financeNote = makeInboxItem(
        `finance-${Date.now()}`,
        'FINANCE_EXP_GAIN',
        'FINANCEIRO',
        `+${oleGain} EXP creditados pela jornada.`,
        {
          body: homeWin
            ? 'Bónus de jornada creditado. Desfecho desportivo e detalhes ficam no histórico de jogos e na liga — não na caixa de notificações.'
            : draw
              ? 'Jornada contabilizada na competição — tabela e calendário na área de competição.'
              : 'Jornada contabilizada — segue a preparação no plantel e no staff; placares no histórico de jogos.',
          deepLink: '/wallet',
          hideFromHomeFeed: true,
        },
      );
      const inbox = [staffNote, financeNote, ...state.inbox].slice(0, 14);
      const nextResult: import('@/entities/types').FormLetter = homeWin ? 'W' : draw ? 'D' : 'L';
      const form = [...state.form.slice(1), nextResult];
      const lastRow = {
        home: state.club.name,
        away: state.nextFixture.opponent.name,
        scoreHome: lm.homeScore,
        scoreAway: lm.awayScore,
        status: 'FT',
        result: homeWin ? ('win' as const) : draw ? ('draw' as const) : ('loss' as const),
      };
      const results = [lastRow, ...state.results].slice(0, 8);

      let players = tickRecoveryMatches(state.players);

      if (lm.supabaseMatchId) {
        const postData: Record<string, unknown> = {
          homeStats: lm.homeStats,
          events: lm.events.slice(0, 60).map((e) => ({ minute: e.minute, kind: e.kind, text: e.text })),
        };
        void finalizeMatch(lm.supabaseMatchId, lm.homeScore, lm.awayScore, postData);
        void persistPlayers(
          state.club.id,
          Object.values(players).map((p) => ({
            id: p.id,
            name: p.name,
            num: p.num,
            pos: p.pos,
            archetype: p.archetype,
            zone: p.zone,
            behavior: p.behavior,
            attributes: p.attrs as unknown as Record<string, number>,
            fatigue: p.fatigue,
            injuryRisk: p.injuryRisk,
            evolutionXp: p.evolutionXp,
            outForMatches: p.outForMatches,
          })),
        );
      }

      const leagueSeason = applyResultToLeagueSeason(state.leagueSeason, lastRow);

      const memorableTrophyUnlockedIds = appendMemorableTrophyUnlocks(state.memorableTrophyUnlockedIds ?? [], {
        homeWin,
        competition: state.nextFixture.competition,
        leaguePoints: leagueSeason.points,
        leaguePlayed: leagueSeason.played,
      });

      return {
        ...state,
        finance,
        inbox,
        form,
        results,
        leagueSeason,
        memorableTrophyUnlockedIds,
        liveMatch: null,
        players,
      };
    }
    case 'MERGE_PLAYERS': {
      return { ...state, players: { ...state.players, ...action.players } };
    }
    case 'UPSERT_CARD_COLLECTION': {
      const c = action.collection;
      const maxSupply = Math.max(1, Math.floor(c.maxSupply));
      const name = c.name?.trim();
      if (!c.id?.trim() || !name) return state;
      return {
        ...state,
        cardCollections: {
          ...state.cardCollections,
          [c.id]: {
            id: c.id,
            name,
            maxSupply,
            createdAt: c.createdAt?.trim() || new Date().toISOString(),
          },
        },
      };
    }
    case 'SET_MANAGER_SLIDERS': {
      return { ...state, manager: { ...state.manager, ...action.partial } };
    }
    case 'SET_PLAYING_STYLE_PRESET': {
      const preset = STYLE_PRESETS[action.presetId];
      return { ...state, manager: { ...state.manager, tacticalStyle: preset } };
    }
    case 'SAVE_TACTIC_PLAN': {
      const name = action.name.trim();
      if (!name) return state;
      const now = new Date().toISOString();
      const existing = state.manager.savedTactics.find((t) => t.name.toLowerCase() === name.toLowerCase());
      let saved = state.manager.savedTactics;
      let activeId = state.manager.activeMatchTacticId;
      if (existing) {
        saved = saved.map((t) =>
          t.id === existing.id
            ? { ...t, style: state.manager.tacticalStyle, updatedAt: now }
            : t,
        );
        activeId = existing.id;
      } else {
        const id = `tt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        saved = [
          {
            id,
            name,
            style: state.manager.tacticalStyle,
            createdAt: now,
            updatedAt: now,
          },
          ...saved,
        ].slice(0, 24);
        activeId = id;
      }
      return {
        ...state,
        manager: {
          ...state.manager,
          savedTactics: saved,
          activeMatchTacticId: activeId,
        },
        inbox: [
          makeInboxItem(
            `tactic-save-${Date.now()}`,
            'TACTIC_SAVED',
            'TREINO',
            `Tática "${name}" salva e pronta para partidas.`,
            { deepLink: '/team' },
          ),
          ...state.inbox,
        ].slice(0, 14),
      };
    }
    case 'START_TACTIC_TRAINING': {
      const tactic = state.manager.savedTactics.find((t) => t.id === action.tacticId);
      if (!tactic) return state;
      return {
        ...state,
        manager: {
          ...state.manager,
          tacticalStyle: tactic.style,
          activeTrainingTacticId: tactic.id,
        },
        inbox: [
          makeInboxItem(
            `tactic-train-${Date.now()}`,
            'TACTIC_TRAINING_FOCUS',
            'TREINO',
            `Treino com foco na tática "${tactic.name}" iniciado.`,
            { deepLink: '/team' },
          ),
          ...state.inbox,
        ].slice(0, 14),
      };
    }
    case 'START_TEAM_TRAINING_PLAN': {
      const slots = maxSlotsByTrainingCenter(state.structures.training_center ?? 1);
      const runningSameType = state.manager.trainingPlans.filter(
        (p) => p.status === 'running' && p.trainingType === action.trainingType,
      ).length;
      if (runningSameType >= slots) {
        return {
          ...state,
          inbox: [
            makeInboxItem(
              `train-slot-${Date.now()}`,
              'TRAINING_SLOT_BLOCKED',
              'TREINO',
              `Sem slots disponíveis para este treino (limite ${slots}).`,
              { colorClass: 'text-red-400' },
            ),
            ...state.inbox,
          ].slice(0, 14),
        };
      }
      const now = new Date().toISOString();
      const group = action.group ?? 'all';
      const resolvedIds =
        action.mode === 'coletivo'
          ? resolveGroupPlayerIds(state.players, group)
          : action.playerIds.slice(0, slots);
      if (resolvedIds.length === 0) return state;
      const plan = {
        id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        mode: action.mode,
        trainingType: action.trainingType,
        playerIds: resolvedIds.slice(0, slots),
        group,
        startedAt: now,
        endAt: addHoursIso(now, Math.max(1, action.durationHours)),
        status: 'running' as const,
      };
      return {
        ...state,
        manager: {
          ...state.manager,
          trainingPlans: [plan, ...state.manager.trainingPlans].slice(0, 60),
        },
        inbox: [
          makeInboxItem(
            `train-start-${Date.now()}`,
            'TRAINING_PLAN_STARTED',
            'TREINO',
            `Treino iniciado (${action.trainingType}, ${plan.playerIds.length} jogador(es)).`,
            { body: 'Fadiga e atributos serão atualizados ao concluir o plano.', deepLink: '/team' },
          ),
          ...state.inbox,
        ].slice(0, 14),
      };
    }
    case 'COMPLETE_DUE_TRAININGS': {
      const nowIso = action.nowIso ?? new Date().toISOString();
      const { due, rest } = splitDuePlans(state.manager.trainingPlans, nowIso);
      if (due.length === 0) return state;
      let players = { ...state.players };
      for (const plan of due) {
        for (const pid of plan.playerIds) {
          const pl = players[pid];
          if (!pl) continue;
          const assigned = state.manager.staff.assignedByPlayer[pid] ?? [];
          const collectiveRoles = plan.mode === 'coletivo' ? state.manager.staff.assignedCollective[plan.group] ?? [] : [];
          const roleIds = Array.from(new Set([...assigned, ...collectiveRoles]));
          const base = applyTrainingToPlayer(pl, plan.trainingType);
          const boosted = amplifyTrainingResult(pl, base, trainingGainMultiplier(state.manager.staff, roleIds));
          players[pid] = applyNutritionRecovery(boosted, state.manager.staff);
        }
      }
      const done = due.map((p) => ({ ...p, status: 'completed' as const }));
      return {
        ...state,
        players,
        manager: { ...state.manager, trainingPlans: [...done, ...rest].slice(0, 80) },
        inbox: [
          makeInboxItem(
            `train-done-${Date.now()}`,
            'TRAINING_PLANS_COMPLETED',
            'TREINO',
            `${due.length} treino(s) concluído(s); fadiga e atributos atualizados.`,
            { deepLink: '/team' },
          ),
          ...state.inbox,
        ].slice(0, 14),
      };
    }
    case 'WORLD_CATCH_UP': {
      let next = applyWorldCatchUp(state, action.nowMs);
      next = gameReducer(next, { type: 'COMPLETE_DUE_TRAININGS', nowIso: new Date(action.nowMs).toISOString() });
      return {
        ...next,
        crowd: { ...next.crowd, moodLabel: crowdMood(next.crowd.supportPercent) },
      };
    }
    case 'TRAINING_SESSION': {
      const r = applySquadTraining(state.players, state.finance, 40);
      if (!r.ok) {
        return {
          ...state,
          inbox: [
            makeInboxItem(
              `train-fail-${Date.now()}`,
              'TRAINING_SESSION_FAIL',
              'FINANCEIRO',
              'Treino leve cancelado: saldo EXP insuficiente.',
              { colorClass: 'text-red-400', deepLink: '/wallet' },
            ),
            ...state.inbox,
          ].slice(0, 14),
        };
      }
      return {
        ...state,
        players: r.players,
        finance: withExpHistory(r.finance, -40, 'Treino leve'),
        inbox: [
          makeInboxItem(
            `train-${Date.now()}`,
            'TRAINING_SESSION_LIGHT',
            'TREINO',
            'Sessão leve concluída: elenco recuperou fôlego.',
            { body: 'EXP debitado conforme o plano de treino.', deepLink: '/team' },
          ),
          ...state.inbox,
        ].slice(0, 14),
      };
    }
    case 'BUY_OLE_PACK': {
      const packBroCents = 999;
      const f = buyOlePack(state.finance, packBroCents, 500);
      if (!f) {
        return {
          ...state,
          inbox: [
            makeInboxItem(
              `buy-fail-${Date.now()}`,
              'SHOP_PACK_FAIL',
              'FINANCEIRO',
              'Saldo BRO insuficiente para o pacote de EXP.',
              { colorClass: 'text-red-400', deepLink: '/store' },
            ),
            ...state.inbox,
          ].slice(0, 14),
        };
      }
      const partial = {
        ...state,
        finance: withExpHistory(f, 500, 'Pacote de EXP (BRO)'),
      };
      const gatRes = registerGatBase(walletOf(partial), 'player_pack', packBroCents, undefined, {
        assetLabel: 'Pacote de EXP',
      });
      const nextState = gatRes.ok ? syncWalletToFinance(partial, gatRes.state) : partial;
      return {
        ...nextState,
        inbox: [
          makeInboxItem(
            `buy-${Date.now()}`,
            'SHOP_PACK',
            'FINANCEIRO',
            '+500 EXP creditados na tesouraria (compra com BRO).',
            {
              body: 'Não contabiliza como EXP “ganho” no histórico de recompensas de jogo.',
              deepLink: '/wallet',
            },
          ),
          ...nextState.inbox,
        ].slice(0, 14),
      };
    }
    case 'SELL_SCOUT_INTEL': {
      const exp = scoutExpReward(state.manager.staff);
      return {
        ...state,
        finance: withExpHistory(grantEarnedExp(state.finance, exp), exp, 'Relatório de olheiro'),
        inbox: [
          makeInboxItem(
            `scout-${Date.now()}`,
            'MARKET_SCOUT_REPORT',
            'PLANTEL',
            `Olheiro: +${exp} EXP creditados pelo relatório.`,
            { body: 'Consulta o mercado e o staff para próximos alvos.', deepLink: '/transfer' },
          ),
          ...state.inbox,
        ].slice(0, 14),
      };
    }
    case 'UPGRADE_STAFF_ROLE': {
      const result = tryUpgradeStaffRole(state.manager.staff, state.finance, action.roleId);
      if (result.ok === false) {
        return {
          ...state,
          inbox: [
            makeInboxItem(
              `staff-fail-${Date.now()}`,
              'STAFF_UPGRADE_FAIL',
              'STAFF',
              result.error,
              { colorClass: 'text-red-400', deepLink: '/team/staff' },
            ),
            ...state.inbox,
          ].slice(0, 14),
        };
      }
      const lvl = result.staff.roles[action.roleId];
      return {
        ...state,
        finance: result.finance,
        manager: { ...state.manager, staff: result.staff },
        inbox: [
          makeInboxItem(
            `staff-up-${Date.now()}`,
            'STAFF_LEVEL_UP',
            'STAFF',
            `${STAFF_LABELS[action.roleId]} subiu para nível ${lvl}.`,
            { body: 'Efeitos em treinos e relatórios já aplicados ao plantel.', deepLink: '/team/staff' },
          ),
          ...state.inbox,
        ].slice(0, 14),
      };
    }
    case 'ASSIGN_STAFF_TO_PLAYER': {
      const maxSlots = maxStaffSlotsByLevel(state.manager.staff.roles.treinador ?? 1);
      return {
        ...state,
        manager: {
          ...state.manager,
          staff: {
            ...state.manager.staff,
            assignedByPlayer: {
              ...state.manager.staff.assignedByPlayer,
              [action.playerId]: action.roleIds.slice(0, maxSlots),
            },
          },
        },
      };
    }
    case 'ASSIGN_STAFF_TO_COLLECTIVE': {
      const maxSlots = maxStaffSlotsByLevel(state.manager.staff.roles.treinador ?? 1);
      return {
        ...state,
        manager: {
          ...state.manager,
          staff: {
            ...state.manager.staff,
            assignedCollective: {
              ...state.manager.staff.assignedCollective,
              [action.group]: action.roleIds.slice(0, maxSlots),
            },
          },
        },
      };
    }
    case 'CITY_QUICK_MEDICAL_MUTIRAO': {
      if (state.finance.ole < CITY_QUICK_MEDICAL_COST_EXP) {
        return {
          ...state,
          inbox: [
            makeInboxItem(
              `city-med-fail-${Date.now()}`,
              'STRUCTURE_UPGRADE_FAIL',
              'CLUBE',
              'Mutirão médico cancelado: EXP insuficiente.',
              { colorClass: 'text-red-400', deepLink: '/city' },
            ),
            ...state.inbox,
          ].slice(0, 14),
        };
      }
      const players = { ...state.players };
      for (const id of Object.keys(players)) {
        const p = players[id];
        if (!p) continue;
        players[id] = {
          ...p,
          fatigue: Math.max(0, p.fatigue - CITY_QUICK_MEDICAL_FATIGUE_DELTA),
          injuryRisk: Math.max(0, p.injuryRisk - CITY_QUICK_MEDICAL_INJURY_RISK_DELTA),
        };
      }
      const finance = withExpHistory(
        addOle(state.finance, -CITY_QUICK_MEDICAL_COST_EXP),
        -CITY_QUICK_MEDICAL_COST_EXP,
        'Mutirão médico (cidade)',
      );
      return {
        ...state,
        players,
        finance,
        inbox: [
          makeInboxItem(
            `city-med-${Date.now()}`,
            'STAFF_ADVICE',
            'STAFF',
            'Mutirão médico: recuperação acelerada no grupo.',
            {
              body: `Investimento de **${CITY_QUICK_MEDICAL_COST_EXP} EXP** em fisioterapia e enfermagem. Fadiga e risco de lesão reduzidos em todo o plantel.`,
              advisorLabel: 'Departamento médico',
              deepLink: '/team',
              staffRole: 'nutricao',
            },
          ),
          ...state.inbox,
        ].slice(0, 14),
      };
    }
    case 'CITY_QUICK_STORE_CAMPAIGN': {
      if (state.finance.ole < CITY_QUICK_STORE_COST_EXP) {
        return {
          ...state,
          inbox: [
            makeInboxItem(
              `city-store-fail-${Date.now()}`,
              'STRUCTURE_UPGRADE_FAIL',
              'CLUBE',
              'Campanha na Megaloja cancelada: EXP insuficiente.',
              { colorClass: 'text-red-400', deepLink: '/city' },
            ),
            ...state.inbox,
          ].slice(0, 14),
        };
      }
      let finance = withExpHistory(
        addOle(state.finance, -CITY_QUICK_STORE_COST_EXP),
        -CITY_QUICK_STORE_COST_EXP,
        'Campanha Megaloja (cidade)',
      );
      finance = addBroCents(finance, CITY_QUICK_STORE_BRO_GAIN_CENTS);
      finance = syncWalletSpotBro(finance);
      const sp = Math.min(99, Math.max(0, state.crowd.supportPercent + CITY_QUICK_STORE_CROWD_DELTA));
      return {
        ...state,
        finance,
        crowd: { supportPercent: sp, moodLabel: crowdMood(sp) },
        inbox: [
          makeInboxItem(
            `city-store-${Date.now()}`,
            'FINANCE_BRO_MOVEMENT',
            'FINANCEIRO',
            `Campanha na Megaloja: +${(CITY_QUICK_STORE_BRO_GAIN_CENTS / 100).toFixed(0)} BRO`,
            {
              body: `**${CITY_QUICK_STORE_COST_EXP} EXP** em marketing e logística. Pico de vendas e reforço do apoio da torcida.`,
              deepLink: '/wallet',
            },
          ),
          ...state.inbox,
        ].slice(0, 14),
      };
    }
    case 'CITY_QUICK_TRAINING_INTENSIVO': {
      const slots = maxSlotsByTrainingCenter(state.structures.training_center ?? 1);
      const runningFisico = state.manager.trainingPlans.filter(
        (p) => p.status === 'running' && p.trainingType === 'fisico',
      ).length;
      if (runningFisico >= slots) {
        return {
          ...state,
          inbox: [
            makeInboxItem(
              `city-train-slot-${Date.now()}`,
              'TRAINING_SLOT_BLOCKED',
              'TREINO',
              `Treino intensivo indisponível: limite de ${slots} plano(s) físico(s) coletivo(s).`,
              { colorClass: 'text-red-400', deepLink: '/team/treino' },
            ),
            ...state.inbox,
          ].slice(0, 14),
        };
      }
      const resolvedIds = resolveGroupPlayerIds(state.players, 'all');
      if (resolvedIds.length === 0) return state;
      if (state.finance.ole < CITY_QUICK_TRAINING_COST_EXP) {
        return {
          ...state,
          inbox: [
            makeInboxItem(
              `city-train-exp-${Date.now()}`,
              'TRAINING_SESSION_FAIL',
              'TREINO',
              'Treino intensivo cancelado: EXP insuficiente.',
              { colorClass: 'text-red-400', deepLink: '/city' },
            ),
            ...state.inbox,
          ].slice(0, 14),
        };
      }
      const now = new Date().toISOString();
      const plan = {
        id: `tr-city-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        mode: 'coletivo' as const,
        trainingType: 'fisico' as const,
        playerIds: resolvedIds.slice(0, slots),
        group: 'all' as const,
        startedAt: now,
        endAt: addHoursIso(now, Math.max(1, CITY_QUICK_TRAINING_DURATION_H)),
        status: 'running' as const,
      };
      const finance = withExpHistory(
        addOle(state.finance, -CITY_QUICK_TRAINING_COST_EXP),
        -CITY_QUICK_TRAINING_COST_EXP,
        'Treino intensivo (cidade)',
      );
      return {
        ...state,
        finance,
        manager: {
          ...state.manager,
          trainingPlans: [plan, ...state.manager.trainingPlans].slice(0, 60),
        },
        inbox: [
          makeInboxItem(
            `city-train-${Date.now()}`,
            'TRAINING_PLAN_STARTED',
            'TREINO',
            `Treino físico intensivo (${plan.playerIds.length} jogador(es)).`,
            {
              body: `**${CITY_QUICK_TRAINING_COST_EXP} EXP** em microciclo físico. Conclusão em ~${CITY_QUICK_TRAINING_DURATION_H}h — acompanha em Treino.`,
              deepLink: '/team/treino',
            },
          ),
          ...state.inbox,
        ].slice(0, 14),
      };
    }
    case 'UPGRADE_STRUCTURE': {
      const result = tryUpgradeStructure(
        action.structureId,
        state.structures,
        state.finance,
        DEFAULT_BRO_PRICES_CENTS,
      );
      if (result.ok === false) {
        return {
          ...state,
          inbox: [
            makeInboxItem(
              `struct-fail-${Date.now()}`,
              'STRUCTURE_UPGRADE_FAIL',
              'CLUBE',
              result.error ?? 'Upgrade de estrutura bloqueado.',
              { colorClass: 'text-red-400', deepLink: '/city' },
            ),
            ...state.inbox,
          ].slice(0, 14),
        };
      }
      const label = STRUCTURE_LABELS[action.structureId];
      const newLevel = result.structures![action.structureId];
      const currencyLabel = result.ledgerReason === LEDGER_REASON_BRO ? 'BRO' : 'EXP';
      const expCost = result.ledgerReason === LEDGER_REASON_EXP ? (state.finance.ole - (result.finance?.ole ?? state.finance.ole)) : 0;
      const nextFinance = expCost > 0
        ? withExpHistory(result.finance!, -expCost, `Upgrade de estrutura: ${label}`)
        : result.finance!;
      const partial = {
        ...state,
        structures: result.structures!,
        finance: nextFinance,
      };
      let nextState: OlefootGameState = partial;
      if (result.ledgerReason === LEDGER_REASON_BRO && result.broSpentCents && result.broSpentCents > 0) {
        const gatCat = gatCategoryForStructure(action.structureId);
        const gatRes = registerGatBase(walletOf(partial), gatCat, result.broSpentCents, undefined, {
          assetLabel: label,
        });
        if (gatRes.ok) nextState = syncWalletToFinance(partial, gatRes.state);
      }
      const crowdNext =
        action.structureId === 'stadium'
          ? (() => {
              const sp = Math.min(
                99,
                Math.max(0, nextState.crowd.supportPercent + STADIUM_UPGRADE_CROWD_DELTA),
              );
              return { supportPercent: sp, moodLabel: crowdMood(sp) };
            })()
          : nextState.crowd;
      return {
        ...nextState,
        crowd: crowdNext,
        inbox: [
          makeInboxItem(
            `struct-${Date.now()}`,
            'STRUCTURE_UPGRADED',
            'CLUBE',
            `${label} evoluiu para nível ${newLevel}.`,
            {
              body:
                action.structureId === 'stadium'
                  ? `Pagamento em ${currencyLabel}. Expansão reforça o ambiente e o apoio em dias de jogo.`
                  : `Pagamento registado em ${currencyLabel}.`,
              deepLink: '/city',
            },
          ),
          ...nextState.inbox,
        ].slice(0, 14),
      };
    }
    case 'WALLET_COMPLETE_KYC': {
      const w = walletOf(state);
      return syncWalletToFinance(state, { ...w, kycOlexpDone: true });
    }
    case 'WALLET_SAVE_SWAP_KYC': {
      const w = walletOf(state);
      const profile = { ...action.profile, confirmedAt: action.profile.confirmedAt || new Date().toISOString() };
      const next = { ...w, kycProfile: profile, hasCompletedSwapKyc: true };
      writeSwapKycToStorage({ kycProfile: profile, hasCompletedSwapKyc: true });
      return syncWalletToFinance(state, next);
    }
    case 'WALLET_CREATE_OLEXP': {
      const w = { ...walletOf(state), spotBroCents: state.finance.broCents };
      const result = createOlexpPosition(w, action.planId, action.amountCents);
      if (result.ok === false) {
        return {
          ...state,
          inbox: [
            makeInboxItem(
              `olexp-fail-${Date.now()}`,
              'WALLET_OLEXP_FAIL',
              'FINANCEIRO',
              result.error,
              { colorClass: 'text-red-400', deepLink: '/wallet/olexp' },
            ),
            ...state.inbox,
          ].slice(0, 14),
        };
      }
      const next = syncWalletToFinance(state, result.state);
      return {
        ...next,
        inbox: [
          makeInboxItem(
            `olexp-${Date.now()}`,
            'WALLET_OLEXP',
            'FINANCEIRO',
            `Posição OLEXP criada: ${action.amountCents / 100} BRO.`,
            { deepLink: '/wallet/olexp' },
          ),
          ...next.inbox,
        ].slice(0, 14),
      };
    }
    case 'WALLET_CLAIM_OLEXP': {
      const w = { ...walletOf(state), spotBroCents: state.finance.broCents };
      const result = claimOlexpPrincipal(w, action.positionId);
      if (result.ok === false) {
        return {
          ...state,
          inbox: [
            makeInboxItem(
              `claim-fail-${Date.now()}`,
              'WALLET_CLAIM_FAIL',
              'FINANCEIRO',
              result.error,
              { colorClass: 'text-red-400', deepLink: '/wallet/olexp' },
            ),
            ...state.inbox,
          ].slice(0, 14),
        };
      }
      return syncWalletToFinance(state, result.state);
    }
    case 'WALLET_OLEXP_EARLY_TO_SPOT': {
      const w = { ...walletOf(state), spotBroCents: state.finance.broCents };
      const result = earlyExitOlexpToSpot(w, action.positionId);
      if (result.ok === false) {
        return {
          ...state,
          inbox: [
            makeInboxItem(
              `swap-olexp-fail-${Date.now()}`,
              'WALLET_OLEXP_FAIL',
              'FINANCEIRO',
              result.error,
              { colorClass: 'text-red-400', deepLink: '/wallet/olexp' },
            ),
            ...state.inbox,
          ].slice(0, 14),
        };
      }
      return syncWalletToFinance(state, result.state);
    }
    case 'WALLET_SET_SPONSOR': {
      const w = walletOf(state);
      const result = walletRegisterSponsor(w, action.sponsorId);
      if (result.ok === false) {
        return {
          ...state,
          inbox: [
            makeInboxItem(
              `sponsor-fail-${Date.now()}`,
              'WALLET_SPONSOR_FAIL',
              'FINANCEIRO',
              result.error,
              { colorClass: 'text-red-400', deepLink: '/wallet' },
            ),
            ...state.inbox,
          ].slice(0, 14),
        };
      }
      return syncWalletToFinance(state, result.state);
    }
    case 'WALLET_ACCRUE_DAILY': {
      let w = { ...walletOf(state), spotBroCents: state.finance.broCents };
      w = accrueOlexpDaily(w, action.dateIso);
      w = accrueGatDaily(w, action.dateIso);
      return syncWalletToFinance(state, w);
    }
    case 'WALLET_GAT_PURCHASE': {
      const w = walletOf(state);
      const result = registerGatBase(w, action.category, action.amountCents, undefined, {
        assetLabel: action.assetLabel,
      });
      if (result.ok === false) {
        return {
          ...state,
          inbox: [
            makeInboxItem(
              `gat-fail-${Date.now()}`,
              'WALLET_GAT_FAIL',
              'FINANCEIRO',
              result.error,
              { colorClass: 'text-red-400', deepLink: '/wallet/gat' },
            ),
            ...state.inbox,
          ].slice(0, 14),
        };
      }
      return syncWalletToFinance(state, result.state);
    }
    case 'START_FRIENDLY_CHALLENGE': {
      const opponentName = action.opponentName.trim();
      const opponentId = action.opponentId.trim();
      if (!opponentName || !opponentId) {
        return {
          ...state,
          inbox: [
            makeInboxItem(
              `amistoso-req-${Date.now()}`,
              'FRIENDLY_CHALLENGE_FAIL',
              'COMPETIÇÃO',
              'Desafio amistoso: falta nome do clube ou ID do adversário.',
              { colorClass: 'text-red-400' },
            ),
            ...state.inbox,
          ].slice(0, 14),
        };
      }
      if (action.currency === 'BRO') {
        const prizeCents = Math.max(1, Math.round(action.prizeAmount * 100));
        const feeCents = friendlyChallengeBroFeeCents(prizeCents);
        const totalCents = prizeCents + feeCents;
        if (state.finance.broCents < totalCents) {
          return {
            ...state,
            inbox: [
              makeInboxItem(
                `amistoso-bro-${Date.now()}`,
                'FRIENDLY_CHALLENGE_FAIL',
                'FINANCEIRO',
                'BRO insuficiente para prémio em escrow + taxa da plataforma (5%).',
                { deepLink: '/wallet' },
              ),
              ...state.inbox,
            ].slice(0, 14),
          };
        }
        let f = addBroCents(state.finance, -totalCents);
        const out = (f.broLifetimeOutCents ?? 0) + totalCents;
        f = {
          ...f,
          broLifetimeOutCents: out,
          companyTreasuryBroCents: (f.companyTreasuryBroCents ?? 0) + feeCents,
          friendlyChallengeEscrowBroCents: (f.friendlyChallengeEscrowBroCents ?? 0) + prizeCents,
        };
        f = syncWalletSpotBro(f);
        return {
          ...state,
          finance: f,
          inbox: [
            makeInboxItem(
              `amistoso-${Date.now()}`,
              'FINANCE_ESCROW',
              'FINANCEIRO',
              `Desafio amistoso vs ${opponentName}: prémio em escrow (BRO).`,
              {
                body: `Retido ${(prizeCents / 100).toFixed(2)} BRO para o vencedor; taxa registada ${(feeCents / 100).toFixed(2)} BRO. O resultado fica no histórico após o jogo.`,
                deepLink: '/wallet',
              },
            ),
            ...state.inbox,
          ].slice(0, 14),
        };
      }
      const prizeExp = Math.max(1, Math.round(action.prizeAmount));
      if (state.finance.ole < prizeExp) {
        return {
          ...state,
          inbox: [
            makeInboxItem(
              `amistoso-exp-${Date.now()}`,
              'FRIENDLY_CHALLENGE_FAIL',
              'FINANCEIRO',
              'EXP insuficiente para constituir o prémio em escrow do desafio.',
              { deepLink: '/wallet' },
            ),
            ...state.inbox,
          ].slice(0, 14),
        };
      }
      const f = withExpHistory(addOle(state.finance, -prizeExp), -prizeExp, `Amistoso: prêmio travado vs ${opponentName}`);
      return {
        ...state,
        finance: f,
        inbox: [
          makeInboxItem(
            `amistoso-${Date.now()}`,
            'FINANCE_ESCROW',
            'FINANCEIRO',
            `Desafio amistoso vs ${opponentName}: prémio em escrow (EXP).`,
            {
              body: `${prizeExp} EXP retidos até liquidação após o jogo — consulta histórico e carteira.`,
              deepLink: '/wallet',
            },
          ),
          ...state.inbox,
        ].slice(0, 14),
      };
    }
    case 'SEND_FRIEND_REQUEST': {
      const { managerId, clubName } = action;
      const social = socialOf(state);
      if (social.friends.some((f) => f.managerId === managerId)) return state;
      if (social.incoming.some((r) => r.fromManagerId === managerId)) return state;
      if (social.outgoing.some((o) => o.toManagerId === managerId)) return state;

      const meta = discoverableById(managerId);
      const autoAccept = meta?.autoAccept ?? false;

      if (autoAccept) {
        return {
          ...state,
          social: {
            ...social,
            friends: [
              ...social.friends,
              { managerId, clubName, addedAtIso: new Date().toISOString() },
            ],
            incoming: social.incoming.filter((r) => r.fromManagerId !== managerId),
            outgoing: social.outgoing,
          },
          inbox: [
            makeInboxItem(uid(), 'SOCIAL_FRIEND_ACCEPTED', 'CONTA', `${clubName} entrou na tua rede de managers.`, {
              kind: 'news',
              deepLink: '/profile#rede-manager',
            }),
            ...state.inbox,
          ].slice(0, 14),
        };
      }

      return {
        ...state,
        social: {
          ...social,
          outgoing: [
            ...social.outgoing,
            {
              id: uid(),
              toManagerId: managerId,
              toClubName: clubName,
              sentAtIso: new Date().toISOString(),
            },
          ],
        },
        inbox: [
          makeInboxItem(uid(), 'SOCIAL_INVITE_SENT', 'CONTA', `Pedido de amizade enviado a ${clubName}.`, {
            kind: 'news',
            body: 'Serás notificado quando aceitarem.',
            deepLink: '/profile#rede-manager',
          }),
          ...state.inbox,
        ].slice(0, 14),
      };
    }
    case 'ACCEPT_FRIEND_REQUEST': {
      const social = socialOf(state);
      const req = social.incoming.find((r) => r.id === action.requestId);
      if (!req) return state;
      const exists = social.friends.some((f) => f.managerId === req.fromManagerId);
      const nextFriends = exists
        ? social.friends
        : [
            ...social.friends,
            {
              managerId: req.fromManagerId,
              clubName: req.fromClubName,
              addedAtIso: new Date().toISOString(),
            },
          ];
      const inboxWithout = state.inbox.filter(
        (i) => !(i.kind === 'friend_invite' && i.friendRequestId === action.requestId),
      );
      return {
        ...state,
        social: {
          ...social,
          friends: nextFriends,
          incoming: social.incoming.filter((r) => r.id !== action.requestId),
          outgoing: social.outgoing.filter((o) => o.toManagerId !== req.fromManagerId),
        },
        inbox: [
          makeInboxItem(
            uid(),
            'SOCIAL_INVITE_ACCEPTED_NOTICE',
            'CONTA',
            `${req.fromClubName} faz agora parte da tua rede.`,
            { kind: 'news', deepLink: '/profile#rede-manager' },
          ),
          ...inboxWithout,
        ].slice(0, 14),
      };
    }
    case 'DECLINE_FRIEND_REQUEST': {
      const social = socialOf(state);
      if (!social.incoming.some((r) => r.id === action.requestId)) return state;
      return {
        ...state,
        social: {
          ...social,
          incoming: social.incoming.filter((r) => r.id !== action.requestId),
        },
        inbox: state.inbox.filter(
          (i) => !(i.kind === 'friend_invite' && i.friendRequestId === action.requestId),
        ),
      };
    }
    case 'CANCEL_OUTGOING_FRIEND_REQUEST': {
      const social = socialOf(state);
      return {
        ...state,
        social: {
          ...social,
          outgoing: social.outgoing.filter((o) => o.id !== action.requestId),
        },
      };
    }
    case 'REMOVE_SOCIAL_FRIEND': {
      const social = socialOf(state);
      return {
        ...state,
        social: {
          ...social,
          friends: social.friends.filter((f) => f.managerId !== action.managerId),
        },
      };
    }
    case 'DISMISS_INBOX_ITEM': {
      return {
        ...state,
        inbox: state.inbox.filter((i) => i.id !== action.id),
      };
    }
    case 'SET_USER_SETTINGS': {
      return {
        ...state,
        userSettings: { ...state.userSettings, ...action.partial },
      };
    }
    case 'SET_CLUB_NAME': {
      const name = action.name.trim();
      if (!name) return state;
      return {
        ...state,
        club: { ...state.club, name },
      };
    }
    case 'IMPORT_GAME_STATE': {
      return rehydrateGameState(action.state) ?? state;
    }
    case 'ADMIN_UPSERT_LEAGUE': {
      const leagues = [...state.adminLeagues];
      const idx = leagues.findIndex((l) => l.id === action.league.id);
      if (idx >= 0) leagues[idx] = action.league;
      else leagues.push(action.league);
      return { ...state, adminLeagues: leagues };
    }
    case 'ADMIN_REMOVE_LEAGUE': {
      const next = state.adminLeagues.filter((l) => l.id !== action.id);
      let primary = state.adminPrimaryLeagueId;
      if (primary === action.id) primary = next[0]?.id ?? '';
      return { ...state, adminLeagues: next, adminPrimaryLeagueId: primary };
    }
    case 'ADMIN_SET_PRIMARY_LEAGUE': {
      if (!state.adminLeagues.some((l) => l.id === action.id)) return state;
      return { ...state, adminPrimaryLeagueId: action.id };
    }
    case 'ADMIN_GRANT_RESOURCES': {
      let next = state;
      if (action.earnedExp && action.earnedExp !== 0) {
        next = { ...next, finance: grantEarnedExp(next.finance, action.earnedExp) };
      }
      if (action.oleDelta && action.oleDelta !== 0) {
        next = { ...next, finance: addOle(next.finance, action.oleDelta) };
      }
      if (action.broCentsDelta && action.broCentsDelta !== 0) {
        next = { ...next, finance: addBroCents(next.finance, action.broCentsDelta) };
      }
      if (action.spotBroCentsDelta && action.spotBroCentsDelta !== 0) {
        const w = walletOf(next);
        const w2 = {
          ...w,
          spotBroCents: Math.max(0, w.spotBroCents + action.spotBroCentsDelta),
        };
        next = syncWalletToFinance(next, w2);
      }
      return next;
    }
    case 'ADMIN_POST_INBOX': {
      const item = makeInboxItem(uid(), 'COMPANY_ANNOUNCEMENT', 'CLUBE', action.title, {
        body: action.body,
        deepLink: action.deepLink,
      });
      return { ...state, inbox: [item, ...state.inbox].slice(0, 50) };
    }
    case 'ADMIN_SIMULATE_FRIEND_REQUEST': {
      const social = socialOf(state);
      const reqId = uid();
      const invite = makeInboxItem(uid(), 'SOCIAL_FRIEND_INVITE', 'CONTA', `Pedido: ${action.clubName}`, {
        kind: 'friend_invite',
        friendRequestId: reqId,
        deepLink: '/profile',
      });
      return {
        ...state,
        social: {
          ...social,
          incoming: [
            {
              id: reqId,
              fromManagerId: action.managerId,
              fromClubName: action.clubName,
              sentAtIso: new Date().toISOString(),
            },
            ...social.incoming,
          ],
        },
        inbox: [invite, ...state.inbox].slice(0, 50),
      };
    }
    case 'ADMIN_ADD_FRIEND': {
      const social = socialOf(state);
      if (social.friends.some((f) => f.managerId === action.managerId)) return state;
      return {
        ...state,
        social: {
          ...social,
          friends: [
            {
              managerId: action.managerId,
              clubName: action.clubName,
              addedAtIso: new Date().toISOString(),
            },
            ...social.friends,
          ],
        },
        inbox: [
          makeInboxItem(uid(), 'SOCIAL_INVITE_ACCEPTED_NOTICE', 'CONTA', `${action.clubName} adicionado à rede.`, {
            kind: 'news',
            deepLink: '/profile#rede-manager',
          }),
          ...state.inbox,
        ].slice(0, 50),
      };
    }
    case 'ADMIN_SET_LEAGUE_SEASON': {
      return {
        ...state,
        leagueSeason: { ...state.leagueSeason, ...action.partial },
      };
    }
    case 'ADMIN_SET_FORM': {
      return { ...state, form: [...action.form].slice(0, 10) };
    }
    case 'ADMIN_PATCH_CLUB': {
      return {
        ...state,
        club: { ...state.club, ...action.partial },
      };
    }
    case 'ADMIN_SIMULATE_FIAT_DEPOSIT': {
      const w = { ...walletOf(state), spotBroCents: state.finance.broCents };
      const result = simulateFiatDeposit(w, action.broCents, { note: action.note });
      if (result.ok === false) return state;
      return syncWalletToFinance(state, result.state);
    }
    case 'ADMIN_SIMULATE_FIAT_WITHDRAWAL': {
      const w = { ...walletOf(state), spotBroCents: state.finance.broCents };
      const result = simulateFiatWithdrawal(w, action.broCents, { note: action.note });
      if (result.ok === false) return state;
      return syncWalletToFinance(state, result.state);
    }
    case 'ADMIN_SET_WALLET_KYC': {
      const w = walletOf(state);
      return syncWalletToFinance(state, { ...w, kycOlexpDone: action.kycOlexpDone });
    }
    case 'RESET':
      return createInitialGameState();
    default:
      return state;
  }
}
