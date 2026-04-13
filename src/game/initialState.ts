import type { FormationSchemeId } from '@/match-engine/types';
import type { LiveMatchSnapshot } from '@/engine/types';
import type { FinanceState } from '@/entities/types';
import type { ManagerProspectMarketState, OlefootGameState } from './types';
import { DEFAULT_MANAGER_PROSPECT_CREATE_COST_EXP } from '@/entities/managerProspect';
import { buildNpcManagerProspectSnapshot } from '@/entities/managerProspect';
import { defaultUserSettings } from '@/settings/defaultUserSettings';
import { createInitialSquad, defaultFixture, DEFAULT_CLUB } from '@/entities/team';
import { createDefaultStructures } from '@/clubStructures/upgrade';
import { createInitialWalletState } from '@/wallet/initial';
import { STYLE_PRESETS } from '@/tactics/playingStyle';
import { createInitialLeagueSeason } from '@/match/leagueSeason';
import { createDefaultAdminLeagues } from '@/match/adminLeagues';
import { buildRoundRobinSchedule, createEmptyLeagueScheduleState } from '@/match/leagueSchedule';
import { createInitialStaffState } from '@/systems/staff';
import { createInitialSocialState } from '@/social/types';
import { pickHomeCaptainPlayerId } from '@/match/impactRules';
import { grantEarnedExp } from '@/systems/economy';

function startingExpBonusForTests(): number {
  const raw = import.meta.env.VITE_STARTING_EXP;
  if (raw !== undefined && String(raw).trim() !== '') {
    const n = Number(String(raw).replace(/\s/g, ''));
    if (Number.isFinite(n) && n > 0) return Math.min(Math.floor(n), 999_999_999);
  }
  if (import.meta.env.DEV) return 10_000_000;
  return 0;
}

function createInitialManagerProspectMarket(): ManagerProspectMarketState {
  const seed = 'v1';
  return {
    ownListings: [],
    npcOffers: Array.from({ length: 5 }, (_, i) => ({
      listingId: `npc_lst_${seed}_${i}`,
      snapshot: buildNpcManagerProspectSnapshot(seed, i),
      priceExp: 88_000 + ((i * 41_000) % 310_000),
    })),
  };
}

export function createInitialGameState(): OlefootGameState {
  const players = createInitialSquad();
  const adminLeagues = createDefaultAdminLeagues();
  const primaryLeague = adminLeagues.find((l) => l.id === 'lg_ole_serie_a') ?? adminLeagues[0];
  const leagueSchedule =
    primaryLeague && primaryLeague.format === 'round_robin'
      ? {
          byLeagueId: {
            ...createEmptyLeagueScheduleState().byLeagueId,
            [primaryLeague.id]: buildRoundRobinSchedule(primaryLeague, DEFAULT_CLUB),
          },
        }
      : createEmptyLeagueScheduleState();
  const baseFinance: FinanceState = {
    ole: 0,
    broCents: 0,
    expLifetimeEarned: 0,
    expHistory: [],
    companyTreasuryBroCents: 0,
    friendlyChallengeEscrowBroCents: 0,
    wallet: createInitialWalletState(),
  };
  const bonusExp = startingExpBonusForTests();
  const finance = bonusExp > 0 ? grantEarnedExp(baseFinance, bonusExp) : baseFinance;
  return {
    version: 1,
    club: DEFAULT_CLUB,
    cardCollections: {},
    players,
    lineup: {},
    finance,
    crowd: { supportPercent: 0, moodLabel: 'Desconhecido' },
    form: [],
    results: [],
    leagueSeason: createInitialLeagueSeason(),
    adminLeagues,
    leagueSchedule,
    adminPrimaryLeagueId: 'lg_ole_serie_a',
    inbox: [],
    nextFixture: defaultFixture(),
    liveMatch: null,
    manager: {
      formationScheme: '4-3-3',
      tacticalMentality: 75,
      defensiveLine: 80,
      tempo: 65,
      tacticalStyle: STYLE_PRESETS.balanced,
      savedTactics: [],
      activeMatchTacticId: null,
      activeTrainingTacticId: null,
      trainingPlans: [],
      staff: createInitialStaffState(),
    },
    lastWorldRealMs: Date.now(),
    clubLogistics: { lastTripKm: 0 },
    structures: createDefaultStructures(),
    memorableTrophyUnlockedIds: [],
    social: createInitialSocialState(),
    userSettings: { ...defaultUserSettings },
    uiBanners: {},
    managerProspectMarket: createInitialManagerProspectMarket(),
    managerProspectConfig: { createCostExp: DEFAULT_MANAGER_PROSPECT_CREATE_COST_EXP },
    managerProspectArtQueue: [],
  };
}

export function defaultLiveMatchShell(
  homeShort: string,
  awayShort: string,
  homePlayers: import('@/engine/types').PitchPlayerState[],
  matchLineupBySlot: Record<string, string>,
  travelKm: number,
  homeFormationScheme: FormationSchemeId,
  displayNames?: { homeName: string; awayName: string },
): LiveMatchSnapshot {
  return {
    mode: 'test2d',
    phase: 'pregame',
    minute: 0,
    homeScore: 0,
    awayScore: 0,
    homeShort,
    awayShort,
    ...(displayNames
      ? { homeName: displayNames.homeName, awayName: displayNames.awayName }
      : {}),
    possession: 'home',
    ball: { x: 52, y: 48 },
    homeFormationScheme,
    homePlayers,
    events: [
      {
        id: 'warmup',
        minute: 0,
        text: `Pré-jogo — Aquecimento em ${homeShort}. Viagem de ~${Math.round(travelKm)} km.`,
        kind: 'narrative',
      },
    ],
    homeStats: {},
    matchLineupBySlot: { ...matchLineupBySlot },
    substitutionsUsed: 0,
    awaySubstitutionsUsed: 0,
    travelKm,
    engineSimPhase: 'LIVE',
    causalLog: { nextSeq: 1, entries: [] },
    homeImpactLedger: [],
    homeCaptainPlayerId: pickHomeCaptainPlayerId(homePlayers),
    footballElapsedSec: 0,
    spiritPhase: 'open_play',
    spiritOverlay: null,
    penalty: null,
    spiritBuildupGkTicksRemaining: 0,
    spiritMomentumClamp01: null,
    preGoalHint: null,
  };
}
