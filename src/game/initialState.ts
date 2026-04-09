import type { FormationSchemeId } from '@/match-engine/types';
import type { LiveMatchSnapshot } from '@/engine/types';
import type { OlefootGameState } from './types';
import { defaultUserSettings } from '@/settings/defaultUserSettings';
import { createInitialSquad, defaultFixture, DEFAULT_CLUB } from '@/entities/team';
import { createDefaultStructures } from '@/clubStructures/upgrade';
import { createInitialWalletState } from '@/wallet/initial';
import { STYLE_PRESETS } from '@/tactics/playingStyle';
import { createInitialLeagueSeason } from '@/match/leagueSeason';
import { createDefaultAdminLeagues } from '@/match/adminLeagues';
import { createInitialStaffState } from '@/systems/staff';
import { createInitialSocialState } from '@/social/types';
import { pickHomeCaptainPlayerId } from '@/match/impactRules';

export function createInitialGameState(): OlefootGameState {
  const players = createInitialSquad();
  return {
    version: 1,
    club: DEFAULT_CLUB,
    cardCollections: {},
    players,
    lineup: {},
    finance: {
      ole: 0,
      broCents: 0,
      expLifetimeEarned: 0,
      expHistory: [],
      companyTreasuryBroCents: 0,
      friendlyChallengeEscrowBroCents: 0,
      wallet: createInitialWalletState(),
    },
    crowd: { supportPercent: 0, moodLabel: 'Desconhecido' },
    form: [],
    results: [],
    leagueSeason: createInitialLeagueSeason(),
    adminLeagues: createDefaultAdminLeagues(),
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
    mode: 'live',
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
