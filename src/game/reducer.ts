import { pitchPlayersFromLineup, roleFromPos } from '@/engine/pitchFromLineup';
import { runMatchMinute } from '@/engine/runMatchMinute';
import { advanceMatchToPostgame, runMatchMinuteBulk } from '@/engine/matchBulk';
import { applySubstitution } from '@/engine/substitution';
import { applyRedCardAutoSub } from '@/engine/redCardAutoSub';
import type { GameAction, ManagerProspectArtRequest, OlefootGameState } from './types';
import { createInitialGameState, defaultLiveMatchShell } from './initialState';
import { rehydrateGameState } from './persistence';
import { awayStartingElevenFromSquad, buildDefaultLineup, mergeLineupWithDefaults } from '@/entities/lineup';
import { normalizeFixture, normalizeOpponentStub } from '@/entities/team';
import { overallFromAttributes } from '@/entities/player';
import type { PlayerEntity } from '@/entities/types';
import {
  buildManagerCreatedPlayerEntity,
  buildNpcManagerProspectSnapshot,
  buildProspectAdminArtPrompt,
  DEFAULT_MANAGER_PROSPECT_CREATE_COST_EXP,
  isValidManagerHeritage,
  MANAGER_PROSPECT_CREATE_MAX_OVR,
  MANAGER_PROSPECT_EVOLVED_MAX_OVR,
  scaleAttrsToMaxOvr,
  type ManagerProspectHeritageBrief,
} from '@/entities/managerProspect';
import {
  applyMatchPerformanceEvolution,
  clampPlayerToEvolutionCap,
  ensureMintOverall,
} from '@/entities/playerEvolution';
import { validateAcademyProspectName } from '@/entities/managerProspectReservedNames';
import { addBroCents, addOle, friendlyChallengeBroFeeCents, grantEarnedExp } from '@/systems/economy';
import { tripKmForFixture, applyTravelFatigueToSquad } from '@/systems/logistics';
import { updateStreak } from './quickMatchStreak';
import {
  generateDailyChallenges,
  getTodaySeed,
  shouldResetDailyChallenges,
  updateChallengeProgress,
} from './dailyChallenges';
import { tickRecoveryMatches } from '@/systems/injury';
import {
  applyMatchConsequences as applyHealthConsequences,
  tickHealthRecovery,
} from '@/systems/playerHealth/reducer';
import { liveMatchToHealthEvents } from '@/systems/playerHealth/fromLiveMatch';
import { applyHealthEffect } from '@/systems/playerHealth/reducer';
import { generateProactiveHealthActions } from '@/coach/proactiveHealthActions';
import { applyMatchResultToMoral, createDefaultMoral } from '@/systems/playerMoral/types';
import type { MatchResult, PlayerMoral } from '@/systems/playerMoral/types';
import {
  OLEFOOT_LEAGUE_CONSTANTS,
  createDefaultEloRating,
  createEmptyOlefootRankedState,
} from '@/olefootLeague/types';
import type {
  EloRating,
  OlefootLeaderboardRow,
  OlefootMatchRecord,
  OlefootRankedState,
} from '@/olefootLeague/types';
import { updateElo, scoreFromGoals } from '@/olefootLeague/elo';
import { generateProactiveTrainingActions } from '@/coach/proactiveTrainingActions';
import { generateProactiveTacticalActions } from '@/coach/proactiveTacticalActions';
import { buildPreMatchBriefing } from '@/coach/coachBriefing';
import { createDefaultCoachAgent } from '@/coach/defaultCoach';
import { applyWorldCatchUp } from './worldCatchUp';
import { mergeWalletIntoFinance } from './financeWalletSync';
import { applySquadTraining } from '@/systems/training';
import { buyOlePack } from '@/systems/market';
import type { MatchEventEntry } from '@/engine/types';
import { computeMatchMvp, finalizeScoutTallies } from '@/gamespirit/scoutScoring';
import { clearNarrativeHistory } from '@/gamespirit/narrativeVariation';
import {
  ledgerTouchMarketAfterMatch,
  marketBroSnapshotFromPlayers,
  mergeLedgerAfterMatch,
  mergeLedgerAfterTrainingLightSession,
  mergeLedgerAfterTrainingPlan,
  sanitizePlayerSeasonLedger,
} from '@/team/playerSeasonLedger';
import {
  appendEvolutionTimelinePoints,
  sanitizePlayerEvolutionTimeline,
} from '@/team/playerEvolutionTimeline';
import {
  applyHomeContractsAfterMatch,
  genesisListingPriceExpFromMintOverall,
  managerProspectContractPremiumExp,
} from '@/playerContracts/playerContracts';
import type { ManagerProspectContractGames } from '@/playerContracts/playerContracts';
import { tryUpgradeStructure } from '@/clubStructures/upgrade';
import { DEFAULT_BRO_PRICES_CENTS } from '@/clubStructures/broDefaults';
import { STRUCTURE_LABELS, LEDGER_REASON_EXP, LEDGER_REASON_BRO } from '@/clubStructures/types';
import { gatCategoryForStructure } from '@/clubStructures/gatCategory';
import {
  effectiveCrowdSupportPercent,
  medicalDeptRecoverySpeedBonusPercent,
  medicalDeptTreatmentSlots,
  structureMatchExpBonuses,
  trainingCenterAttributeGainMultiplier,
  trainingCenterMaxConcurrentCollectivePlans,
  youthAcademyProspectTrainingMultiplier,
} from '@/clubStructures/benefits';
import {
  applyTreatmentCompletionToPlayer,
  splitDueTreatments,
  TREATMENT_PLAN_DURATION_H,
} from '@/systems/medicalTreatment';
import { resolveInteractiveMoment } from '@/match/quickInteractiveMoments';
import { updateChallengeProgress as updateStreakProgress, generateWeeklyChallenges, shouldRefreshChallenges } from '@/match/quickStreakChallenges';
import { createPendingCommand } from '@/voiceCommand/commandQueue';
import { TEAM_OBEDIENCE_DELTAS } from '@/voiceCommand/obedienceRoll';
import { evaluatePerformanceBonuses, calculateTotalBonusRewards } from '@/match/quickPerformanceBonuses';
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
import { createInitialCompetitiveRanking, updateCompetitiveRanking } from './competitiveRanking';
import {
  handleInitGlobalLeagueMVP,
  handleRegisterGlobalTeam,
  handleAdminStartGlobalPlayoffs,
  handleStartGlobalPlayoffRound,
  handleFinishGlobalPlayoffRound,
  handleStartGlobalLeagueRound,
  handleFinishGlobalLeagueRound,
  handleApplyPromotionRelegation,
  handleResetGlobalLeagueMVP,
} from './globalLeagueMVPReducer';
import {
  createOlexpPosition,
  claimOlexpPrincipal,
  accrueOlexpDaily,
  earlyExitOlexpToSpot,
} from '@/wallet/olexp';
import { writeSwapKycToStorage } from '@/wallet/swapKycStorage';
import { registerSponsor as walletRegisterSponsor } from '@/wallet/referral';
import { transferBroByReferralCode } from '@/wallet/peerTransfer';
import { registerGatBase, accrueGatDaily } from '@/wallet/gat';
import { simulateFiatDeposit, simulateFiatWithdrawal } from '@/wallet/adminFiatFlow';
import { STYLE_PRESETS } from '@/tactics/playingStyle';
import { applyResultToLeagueSeason } from '@/match/leagueSeason';
import { buildRoundRobinSchedule } from '@/match/leagueSchedule';
import { evaluateOfficialSquad, isOfficialSquadGateRelaxedForTests } from '@/match/squadEligibility';
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
import {
  nutritionPostMatchFatigueRecoveryBonus,
  npcProspectBasePriceExp,
  npcProspectPriceAfterScoutDiscount,
  staffRunMatchMinuteEffects,
} from '@/systems/staffBenefits';
import { buildAwayPitchPlayersFromEntities } from '@/engine/test2d/tacticalPositioning';
import { hashStringSeed } from '@/match/seededRng';
import { FORMATION_BASES } from '@/match-engine/formations/catalog';
import { appendMemorableTrophyUnlocks } from '@/trophies/memorableCatalog';
import { diffNewMemorableTrophyIds, memorableTrophyFinanceReward } from '@/trophies/memorablePrizes';
import {
  EXP_EXCHANGE_MAX_LOT,
  EXP_EXCHANGE_MIN_BRO_CENTS,
  EXP_EXCHANGE_MIN_LOT,
  replenishNpcExpOrders,
} from '@/economy/expExchange';
import {
  advancePenaltyStage,
  initialPenaltyState,
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
import { queueMatchEvents, finalizeMatch, persistPlayers } from '@/supabase/matchPersistence';
import type { SocialState } from '@/social/types';
import { discoverableById } from '@/social/catalog';
import { makeInboxItem } from './inboxItem';
import { buildPostMatchStaffInboxItem } from './postMatchStaffInbox';
import { defaultShopCatalog, findShopItem, normalizeShopCatalog, shopEffectNeedsPlayer } from './shopCatalog';

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
  // fromServer=true: deltas positivos vindos de operações do jogo são legítimos
  return {
    ...state,
    finance: mergeWalletIntoFinance(state.finance, wallet, true),
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

function buildNpcOffersForShop(state: OlefootGameState) {
  const seed = `${state.club.id}:${Date.now()}`;
  const ol = state.manager.staff.roles.olheiro ?? 1;
  return [0, 1, 2, 3].map((i) => {
    const snapshot = buildNpcManagerProspectSnapshot(seed, i, ol);
    const ovr = overallFromAttributes(snapshot.attrs);
    const base = npcProspectBasePriceExp(ovr);
    const priceExp = npcProspectPriceAfterScoutDiscount(base, state.manager.staff);
    return {
      listingId: `npc_${seed.replace(/:/g, '_')}_${i}`,
      snapshot,
      priceExp,
    };
  });
}

function nextKitNumber(players: Record<string, import('@/entities/types').PlayerEntity>): number {
  let m = 0;
  for (const p of Object.values(players)) {
    if (typeof p.num === 'number' && Number.isFinite(p.num) && p.num > m) m = p.num;
  }
  return m + 1;
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

/** Funde feed do sim (novos primeiro) com eventos só no store (ex.: apito inicial). */
function mergeSimSyncEvents(
  prev: import('@/engine/types').MatchEventEntry[],
  fromSim: import('@/engine/types').MatchEventEntry[],
): import('@/engine/types').MatchEventEntry[] {
  if (fromSim.length === 0) return prev;
  const seen = new Set<string>();
  const out: import('@/engine/types').MatchEventEntry[] = [];
  for (const e of fromSim) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  for (const e of prev) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  if (out.length > 60) out.length = 60;
  return out;
}

function syncWalletSpotBro(finance: import('@/entities/types').FinanceState): import('@/entities/types').FinanceState {
  if (!finance.wallet) return finance;
  return { ...finance, wallet: { ...finance.wallet, spotBroCents: finance.broCents } };
}

function crowdSupportForMatchSimulation(state: OlefootGameState): number {
  return effectiveCrowdSupportPercent(state.crowd.supportPercent, state.structures, state.nextFixture.isHome);
}

function runTick(state: OlefootGameState): OlefootGameState {
  if (!state.liveMatch || state.liveMatch.phase !== 'playing') return state;
  const roster = homeRosterFromLineup(state);
  const { snapshot, updatedPlayers, newInboxItems } = runMatchMinute({
    snapshot: state.liveMatch,
    homeRoster: roster,
    allPlayers: state.players,
    crowdSupport: crowdSupportForMatchSimulation(state),
    tacticalMentality: state.manager.tacticalMentality,
    tacticalStyle: state.manager.tacticalStyle,
    opponentStrength: state.nextFixture.opponent.strength,
    awayShort: state.nextFixture.opponent.shortName,
    opponentId: state.nextFixture.opponent.id,
    awayRoster: state.liveMatch.awayRoster,
    staffMatchEffects: staffRunMatchMinuteEffects(state.manager.staff),
    tacticalIntensity: state.quickMatchIntensity?.current,
  });
  let liveMatch = snapshot;
  const players = { ...state.players, ...updatedPlayers };
  const inbox = newInboxItems && newInboxItems.length > 0
    ? [...newInboxItems, ...state.inbox]
    : state.inbox;
  if (liveMatch.minute >= 90 && liveMatch.phase === 'playing') {
    const whistle: MatchEventEntry = {
      id: uid(),
      minute: 90,
      text: `90' — Apito final.`,
      kind: 'whistle',
    };
    liveMatch = { ...liveMatch, phase: 'postgame', events: [whistle, ...liveMatch.events] };
  }
  return { ...state, liveMatch, players, inbox };
}

/**
 * Aplica efeitos de uma CoachAction no state. Usado por COACH_EXECUTE_ACTION
 * (caminho normal: aprovar→executar) e por auto-execução em COACH_GENERATE_HEALTH_ACTIONS
 * quando o coach tem `autonomyLevel >= 80`.
 */
function applyCoachActionEffects(
  state: OlefootGameState,
  coachAction: import('@/coach/types').CoachAction,
): OlefootGameState {
  let newState = state;
  switch (coachAction.type) {
    case 'start_training': {
      const data = coachAction.data as any;
      const plan = {
        id: `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        mode: data.mode,
        trainingType: data.trainingType,
        playerIds: data.playerIds,
        group: data.group,
        startedAt: new Date().toISOString(),
        endAt: new Date(Date.now() + data.durationHours * 60 * 60 * 1000).toISOString(),
        status: 'running' as const,
      };
      newState = {
        ...newState,
        manager: { ...newState.manager, trainingPlans: [...newState.manager.trainingPlans, plan] },
      };
      break;
    }
    case 'start_treatment': {
      const data = coachAction.data as any;
      const treatmentPlan = {
        id: `treat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        playerId: data.playerId,
        startedAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        status: 'running' as const,
      };
      newState = {
        ...newState,
        manager: {
          ...newState.manager,
          treatmentPlans: [...(newState.manager.treatmentPlans || []), treatmentPlan],
        },
      };
      break;
    }
    case 'set_lineup_formation': {
      const data = coachAction.data as any;
      const scheme = data.formationScheme as FormationSchemeId;
      if (!scheme || !(scheme in FORMATION_BASES)) break;
      newState = {
        ...newState,
        manager: { ...newState.manager, formationScheme: scheme },
        ...(data.lineup ? { lineup: { ...data.lineup } } : {}),
      };
      break;
    }
    case 'buy_health_booster': {
      const data = coachAction.data as any;
      const item = findShopItem(newState.shopCatalog, data.shopItemId);
      if (!item || !item.consumable || !item.effect) break;
      const costExp = item.priceExp ?? 0;
      const costBro = item.priceBroCents ?? 0;
      if (costExp > 0 && newState.finance.ole < costExp) break;
      if (costBro > 0 && newState.finance.broCents < costBro) break;

      let pHealth = newState.playerHealth;
      let applied = false;
      switch (item.effect.kind) {
        case 'reset_squad_fatigue': {
          const next: typeof pHealth = {};
          for (const [pid, h] of Object.entries(pHealth)) {
            next[pid] = applyHealthEffect(h, { kind: 'reset_fatigue' });
          }
          pHealth = next;
          applied = true;
          break;
        }
        case 'reduce_player_injury': {
          const target = data.targetPlayerId as string | undefined;
          if (target && pHealth[target]) {
            const matches = (item.effect as { matches?: number }).matches ?? 1;
            const cur = pHealth[target];
            pHealth = {
              ...pHealth,
              [target]: { ...cur, outForMatches: Math.max(0, cur.outForMatches - matches) },
            };
            applied = true;
          }
          break;
        }
      }
      if (!applied) break;

      newState = {
        ...newState,
        finance: {
          ...newState.finance,
          ole: newState.finance.ole - costExp,
          broCents: newState.finance.broCents - costBro,
        },
        playerHealth: pHealth,
      };
      break;
    }
  }
  return newState;
}

/** Aplica resultado nas morais dos jogadores das duas equipes. */
function applyMoralToPlayers(
  moralMap: Record<string, PlayerMoral> | undefined,
  homeIds: string[],
  homeResult: MatchResult,
  awayIds: string[],
  awayResult: MatchResult,
): Record<string, PlayerMoral> {
  const next: Record<string, PlayerMoral> = { ...(moralMap ?? {}) };
  const now = Date.now();
  for (const pid of homeIds) {
    const cur = next[pid] ?? createDefaultMoral(pid, now);
    next[pid] = applyMatchResultToMoral(cur, homeResult, now);
  }
  for (const pid of awayIds) {
    const cur = next[pid] ?? createDefaultMoral(pid, now);
    next[pid] = applyMatchResultToMoral(cur, awayResult, now);
  }
  return next;
}

/** Recalcula leaderboard a partir do mapa de ratings + histórico recente. */
function recomputeLeaderboard(
  ratings: Record<string, EloRating>,
  recentMatches: OlefootMatchRecord[],
  knownNames: Record<string, string>,
): OlefootLeaderboardRow[] {
  const goalsFor: Record<string, number> = {};
  const goalsAgainst: Record<string, number> = {};
  const names: Record<string, string> = { ...knownNames };
  for (const m of recentMatches) {
    goalsFor[m.homeManagerId] = (goalsFor[m.homeManagerId] ?? 0) + m.homeGoals;
    goalsFor[m.awayManagerId] = (goalsFor[m.awayManagerId] ?? 0) + m.awayGoals;
    goalsAgainst[m.homeManagerId] = (goalsAgainst[m.homeManagerId] ?? 0) + m.awayGoals;
    goalsAgainst[m.awayManagerId] = (goalsAgainst[m.awayManagerId] ?? 0) + m.homeGoals;
    if (!names[m.homeManagerId]) names[m.homeManagerId] = m.homeManagerName;
    if (!names[m.awayManagerId]) names[m.awayManagerId] = m.awayManagerName;
  }
  const rows: OlefootLeaderboardRow[] = Object.values(ratings).map((r) => ({
    managerId: r.managerId,
    managerName: names[r.managerId] ?? r.managerId,
    points: r.wins * 3 + r.draws,
    matchesPlayed: r.matchesPlayed,
    wins: r.wins,
    draws: r.draws,
    losses: r.losses,
    goalsFor: goalsFor[r.managerId] ?? 0,
    goalsAgainst: goalsAgainst[r.managerId] ?? 0,
    rating: r.rating,
  }));
  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    return b.rating - a.rating;
  });
  return rows;
}

/** Mapeia CoachActionType → CoachDecision['type'] para o learning loop. */
function mapActionTypeToDecisionType(
  t: import('@/coach/types').CoachActionType,
): import('@/coach/types').CoachDecision['type'] {
  switch (t) {
    case 'start_training':
      return 'training_plan';
    case 'upgrade_staff':
      return 'staff_upgrade';
    case 'assign_staff':
      return 'staff_assignment';
    case 'set_lineup_formation':
      return 'tactical_tweak';
    case 'start_treatment':
    case 'buy_health_booster':
      return 'training_plan';
  }
}

/**
 * Merge de ações proativas no coach + auto-execução (autonomia >= 80, urgency >= medium).
 * Usado por COACH_GENERATE_{HEALTH,TRAINING,TACTICAL}_ACTIONS.
 */
function mergeProactiveActions(
  state: OlefootGameState,
  proactive: import('@/coach/types').CoachAction[],
): OlefootGameState {
  if (!state.manager.coach) return state;
  if (!proactive.length) return state;
  const existing = state.manager.coach.pendingActions;
  const existingTitles = new Set(existing.filter((a) => a.status === 'pending').map((a) => a.title));
  const fresh = proactive.filter((a) => !existingTitles.has(a.title));
  if (!fresh.length) return state;

  const autonomy = state.manager.coach.autonomyLevel ?? 0;
  const autoExecute = autonomy >= 80;
  const merged = [...existing, ...fresh];

  if (!autoExecute) {
    return {
      ...state,
      manager: { ...state.manager, coach: { ...state.manager.coach, pendingActions: merged } },
    };
  }

  let nextState: OlefootGameState = state;
  const finalActions = merged.map((a) => ({ ...a }));
  for (const a of fresh) {
    if (a.urgency !== 'high' && a.urgency !== 'medium') continue;
    const before = nextState;
    const after = applyCoachActionEffects(before, a);
    if (after !== before) {
      nextState = after;
      const idx = finalActions.findIndex((x) => x.id === a.id);
      if (idx >= 0) finalActions[idx] = { ...finalActions[idx], status: 'executed' };
    }
  }
  return {
    ...nextState,
    manager: {
      ...nextState.manager,
      coach: { ...nextState.manager.coach!, pendingActions: finalActions },
    },
  };
}

export function gameReducer(state: OlefootGameState, action: GameAction): OlefootGameState {
  switch (action.type) {
    case 'APPLY_MATCH_CONSEQUENCES': {
      if (!action.events.length) return state;
      const { next } = applyHealthConsequences(state.playerHealth, action.events);
      return { ...state, playerHealth: next };
    }
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
      // Limpar histórico de narrativa ao iniciar nova partida
      clearNarrativeHistory();

      let st = state;
      if (st.liveMatch?.phase === 'postgame') {
        st = gameReducer(st, { type: 'FINALIZE_MATCH' });
      }
      const squadCheck = evaluateOfficialSquad(st.lineup, st.players);
      const skipSquadGateForQuickTest =
        (action.mode === 'quick' || action.mode === 'test2d') && isOfficialSquadGateRelaxedForTests();
      if (!squadCheck.ok && !skipSquadGateForQuickTest) {
        const inboxWithoutDup = st.inbox.filter((i) => i.id !== 'lineup-requirement-live-match');
        const lineupNote = makeInboxItem(
          'lineup-requirement-live-match',
          'LINEUP_ISSUE',
          'PLANTEL',
          'Não podes entrar em campo — plantel incompleto',
          {
            body: `${squadCheck.reason ?? 'Requisitos não cumpridos.'} São necessários 11 titulares disponíveis (sem lesão/suspensão) e pelo menos 5 jogadores no banco. Reforça o plantel ou ajusta a escalação.`,
            deepLink: '/team',
          },
        );
        return { ...st, inbox: [lineupNote, ...inboxWithoutDup].slice(0, 24) };
      }
      const lu = mergeLineupWithDefaults(st.lineup, st.players);
      const travelKm = tripKmForFixture(st.nextFixture);
      let players = applyTravelFatigueToSquad(st.players, travelKm);
      const fs = st.manager.formationScheme;
      const homePlayers = pitchPlayersFromLineup(lu, players, fs);
      let liveMatch = defaultLiveMatchShell(
        st.club.shortName,
        st.nextFixture.opponent.shortName,
        homePlayers,
        lu,
        travelKm,
        fs,
        { homeName: st.club.name, awayName: st.nextFixture.opponent.name },
      );
      liveMatch = { ...liveMatch, mode: action.mode };
      if (typeof action.simulationSeed === 'number' && Number.isFinite(action.simulationSeed)) {
        liveMatch = { ...liveMatch, simulationSeed: Math.floor(action.simulationSeed) };
      }

      if (action.mode === 'auto') {
        liveMatch = { ...liveMatch, phase: 'playing' };
        const roster = homeRosterFromLineup({ ...st, players });
        const { snapshot, updatedPlayers } = advanceMatchToPostgame({
          snapshot: liveMatch,
          homeRoster: roster,
          allPlayers: players,
          crowdSupport: effectiveCrowdSupportPercent(
            st.crowd.supportPercent,
            st.structures,
            st.nextFixture.isHome,
          ),
          tacticalMentality: st.manager.tacticalMentality,
          tacticalStyle: st.manager.tacticalStyle,
          opponentStrength: st.nextFixture.opponent.strength,
          awayShort: st.nextFixture.opponent.shortName,
          staffMatchEffects: staffRunMatchMinuteEffects(st.manager.staff),
        });
        players = { ...players, ...updatedPlayers };
        liveMatch = snapshot;
      } else if (action.mode === 'quick' || action.mode === 'test2d') {
        const kickLabel = action.mode === 'test2d' ? '(ao vivo 2D)' : '(partida rápida)';
        const kick: MatchEventEntry = {
          id: uid(),
          minute: 0,
          text: `0' — ${st.club.shortName} x ${st.nextFixture.opponent.shortName} ${kickLabel}.`,
          kind: 'whistle',
        };
        const opp = st.nextFixture.opponent;
        const genesisAway = opp.genesisAwayPlayers;
        let awayRoster: NonNullable<import('@/engine/types').LiveMatchSnapshot['awayRoster']>;
        let awayPitchPlayers: import('@/engine/types').PitchPlayerState[] | undefined;

        if (genesisAway?.length) {
          const starters = awayStartingElevenFromSquad(genesisAway);
          awayRoster = starters.map((p) => ({ id: p.id, num: p.num, name: p.name, pos: p.pos }));
          if (action.mode === 'test2d') {
            awayPitchPlayers = buildAwayPitchPlayersFromEntities(starters, fs);
          }
        } else {
          const awaySlots: { pos: string; num: number }[] = [
            { pos: 'GOL', num: 1 }, { pos: 'ZAG', num: 4 }, { pos: 'ZAG', num: 5 },
            { pos: 'LE', num: 3 }, { pos: 'LD', num: 2 }, { pos: 'VOL', num: 8 },
            { pos: 'MC', num: 6 }, { pos: 'MC', num: 10 }, { pos: 'PE', num: 7 },
            { pos: 'PD', num: 11 }, { pos: 'ATA', num: 9 },
          ];
          const surnames = ['RIBEIRO','NUNES','CARVALHO','MENDES','TEIXEIRA','BARBOSA','CARDOSO','REIS','MOREIRA','CASTRO','FREITAS'];
          const sessionKey = Date.now();
          awayRoster = awaySlots.map((slot, i) => {
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
        }
        liveMatch = {
          ...liveMatch,
          phase: 'playing',
          minute: 0,
          clockPeriod: 'first_half',
          events: [kick],
          awayRoster,
          awayRosterAtKickoff: awayRoster.map((p) => ({ ...p })),
          ...(awayPitchPlayers ? { awayPitchPlayers } : {}),
        };
      }

      const matchClientNonce = Date.now() + Math.floor(Math.random() * 1_000_000);
      liveMatch = { ...liveMatch, matchClientNonce };

      return {
        ...st,
        players,
        liveMatch,
        clubLogistics: { lastTripKm: travelKm },
      };
    }
    case 'SET_LIVE_MATCH_SUPABASE_ID': {
      const lm = state.liveMatch;
      if (!lm || lm.supabaseMatchId) return state;
      if (lm.matchClientNonce !== action.matchClientNonce) return state;
      return {
        ...state,
        liveMatch: { ...lm, supabaseMatchId: action.matchId },
      };
    }

    case 'TRIGGER_QUICK_INTERACTIVE_MOMENT': {
      if (!state.liveMatch) return state;
      return {
        ...state,
        liveMatch: {
          ...state.liveMatch,
          activeInteractiveMoment: action.moment,
        },
      };
    }

    case 'RESOLVE_QUICK_INTERACTIVE_MOMENT': {
      if (!state.liveMatch?.activeInteractiveMoment) return state;

      const outcome = resolveInteractiveMoment(
        state.liveMatch.activeInteractiveMoment,
        action.choiceId,
      );

      const newFinance = {
        ...state.finance,
        ole: state.finance.ole + outcome.rewards.ole,
      };

      const newMomentum = state.liveMatch.spiritMomentum ?? { home: 50, away: 50 };
      newMomentum.home = Math.max(0, Math.min(100, newMomentum.home + outcome.momentumDelta));

      const narrativeEvent: MatchEventEntry = {
        id: `moment_${Date.now()}`,
        minute: state.liveMatch.minute,
        text: outcome.narrative,
        kind: 'narrative',
      };

      return {
        ...state,
        finance: newFinance,
        liveMatch: {
          ...state.liveMatch,
          activeInteractiveMoment: null,
          spiritMomentum: newMomentum,
          events: [narrativeEvent, ...state.liveMatch.events],
        },
      };
    }

    case 'SET_TACTICAL_INTENSITY': {
      return {
        ...state,
        quickMatchIntensity: {
          current: action.level,
          changedAtMinute: state.liveMatch?.minute ?? 0,
        },
      };
    }

    case 'UPDATE_STREAK_CHALLENGES': {
      if (!state.streakChallenges) return state;

      const updated = updateStreakProgress(
        state.streakChallenges.challenges,
        action.currentStreak,
        action.won,
      );

      return {
        ...state,
        streakChallenges: {
          ...state.streakChallenges,
          challenges: updated,
        },
      };
    }

    case 'REFRESH_STREAK_CHALLENGES': {
      return {
        ...state,
        streakChallenges: {
          challenges: generateWeeklyChallenges(),
          lastRefreshDate: new Date().toISOString(),
        },
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
    case 'COMMIT_TEST2D_VISUAL_BEAT_FEED': {
      const lm = state.liveMatch;
      if (!lm?.test2dVisualBeat) return state;
      const ev = lm.test2dVisualBeat.deferredFeedEvent;
      const nextEvents = [ev, ...lm.events];
      if (nextEvents.length > 40) nextEvents.length = 40;
      return {
        ...state,
        liveMatch: {
          ...lm,
          test2dVisualBeat: undefined,
          events: nextEvents,
        },
      };
    }
    case 'COMMIT_ULTRALIVE2D_STAGED_FEED': {
      const lm = state.liveMatch;
      if (!lm?.ultralive2dStagedPlay) return state;
      const ev = lm.ultralive2dStagedPlay.deferredFeedEvent;
      const nextEvents = [ev, ...lm.events];
      if (nextEvents.length > 40) nextEvents.length = 40;
      return {
        ...state,
        liveMatch: {
          ...lm,
          ultralive2dStagedPlay: undefined,
          events: nextEvents,
        },
      };
    }
    case 'SIM_SYNC': {
      if (!state.liveMatch || state.liveMatch.phase !== 'playing') return state;
      const lm = state.liveMatch;
      const simStats: Record<string, { passesOk: number; passesAttempt: number; tackles: number; km: number; rating: number; shotsOn: number; shotsOff: number; saves: number; dribblesOk: number }> = {};
      for (const [pid, s] of Object.entries(action.stats)) {
        const comp = s.passesAttempt > 0 ? s.passesOk / s.passesAttempt : 0.75;
        simStats[pid] = {
          passesOk: s.passesOk,
          passesAttempt: s.passesAttempt,
          tackles: s.tackles,
          km: s.km,
          rating: Math.min(9.2, 6 + comp * 2.2 + s.tackles * 0.08 + Math.min(1.2, s.km / 12)),
          shotsOn: s.shotsOn ?? 0,
          shotsOff: s.shotsOff ?? 0,
          saves: s.saves ?? 0,
          dribblesOk: s.dribblesOk ?? 0,
        };
      }
      const homeScore = action.homeScore;
      const awayScore = action.awayScore;
      const mergedEvents =
        action.events.length > 0 ? mergeSimSyncEvents(lm.events, action.events) : [...lm.events];

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
            spiritPenaltyCooldownTicks: 8,
          },
        };
      }
      return state;
    }
    case 'COACH_TECHNICAL_COMMAND': {
      return state;
    }
    case 'LIVE_MATCH_SWAP_HOME_SLOTS': {
      const lm = state.liveMatch;
      if (!lm || lm.phase !== 'playing') return state;
      const { slotA, slotB } = action;
      if (slotA === slotB) return state;
      const lu = mergeLineupWithDefaults(state.lineup, state.players);
      const idA = lu[slotA];
      const idB = lu[slotB];
      if (!idA || !idB) return state;
      const fs = state.manager.formationScheme;
      const nextLineup = { ...lu, [slotA]: idB, [slotB]: idA };
      const homePlayers = pitchPlayersFromLineup(nextLineup, state.players, fs);
      const matchLineupBySlot: Record<string, string> = {};
      for (const hp of homePlayers) {
        matchLineupBySlot[hp.slotId] = hp.playerId;
      }
      return {
        ...state,
        lineup: { ...state.lineup, [slotA]: idB, [slotB]: idA },
        liveMatch: {
          ...lm,
          homePlayers,
          matchLineupBySlot,
          homeFormationScheme: fs,
        },
      };
    }
    case 'LIVE_MATCH_SET_FORMATION': {
      const lm = state.liveMatch;
      if (!lm || lm.phase !== 'playing') return state;
      const fs = action.formationScheme;
      if (!(fs in FORMATION_BASES)) return state;
      const base = mergeLineupWithDefaults(state.lineup, state.players);
      const mergedLu = { ...base, ...lm.matchLineupBySlot };
      const homePlayers = pitchPlayersFromLineup(mergedLu, state.players, fs);
      const matchLineupBySlot: Record<string, string> = {};
      const nextLineup = { ...state.lineup };
      for (const hp of homePlayers) {
        matchLineupBySlot[hp.slotId] = hp.playerId;
        nextLineup[hp.slotId] = hp.playerId;
      }
      return {
        ...state,
        manager: { ...state.manager, formationScheme: fs },
        lineup: nextLineup,
        liveMatch: {
          ...lm,
          homePlayers,
          matchLineupBySlot,
          homeFormationScheme: fs,
        },
      };
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
        crowdSupport: crowdSupportForMatchSimulation(state),
        tacticalMentality: state.manager.tacticalMentality,
        tacticalStyle: state.manager.tacticalStyle,
        opponentStrength: state.nextFixture.opponent.strength,
        awayShort: state.nextFixture.opponent.shortName,
        steps: action.steps,
        staffMatchEffects: staffRunMatchMinuteEffects(state.manager.staff),
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
      const nextLineup = { ...state.lineup };
      for (const [slot, pid] of Object.entries(snap.matchLineupBySlot ?? {})) {
        if (pid) nextLineup[slot] = pid;
      }

      // Recalcula forças dos times após substituição
      const updatedSnap = {
        ...snap,
        teamStrengthRecalculatedAt: Date.now(),
      };

      return { ...state, liveMatch: updatedSnap, lineup: nextLineup };
    }
    case 'RECALCULATE_TEAM_STRENGTH': {
      if (!state.liveMatch) return state;
      // Marca timestamp para GameSpirit recalcular forças
      return {
        ...state,
        liveMatch: {
          ...state.liveMatch,
          teamStrengthRecalculatedAt: Date.now(),
        },
      };
    }
    case 'CANCEL_QUICK_INJURY_SUB': {
      const lm = state.liveMatch;
      if (!lm || !lm.quickInjurySub) return state;
      const q = lm.quickInjurySub;
      const ent = state.players[q.outPlayerId];
      if (!ent) return { ...state, liveMatch: { ...lm, quickInjurySub: undefined } };
      const restoredPlayer = {
        playerId: q.outPlayerId,
        slotId: q.slotId,
        name: q.name,
        num: ent.num,
        pos: ent.pos,
        x: q.x,
        y: q.y,
        fatigue: Math.round(ent.fatigue),
        role: roleFromPos(ent.pos),
      };
      const riskEv: MatchEventEntry = {
        id: uid(),
        minute: lm.minute ?? 0,
        text: `${lm.minute ?? 0}' — ${q.name} decide continuar apesar das dores. Risco elevado de agravamento.`,
        kind: 'narrative',
      };
      return {
        ...state,
        liveMatch: {
          ...lm,
          quickInjurySub: undefined,
          homePlayers: [...(lm.homePlayers ?? []).filter(p => p.playerId !== q.outPlayerId), restoredPlayer],
          events: [riskEv, ...lm.events],
        },
      };
    }
    case 'PENALTY_SET_TAKER': {
      const lm = state.liveMatch;
      if (!lm || !lm.penalty) return state;
      return {
        ...state,
        liveMatch: {
          ...lm,
          penalty: { ...lm.penalty, takerId: (action as any).playerId, takerName: (action as any).name },
        },
      };
    }
    case 'AWARD_SET_PIECE': {
      const lm = state.liveMatch;
      if (!lm) return state;
      if (lm.pendingSetPiece) return state; // already pending
      const a = action as any;
      return {
        ...state,
        liveMatch: {
          ...lm,
          // Limpa flags do engine pra não dupla-resolução: o set-piece passa pro overlay
          pendingCornerForSide: a.mode === 'corner' ? null : lm.pendingCornerForSide,
          pendingFreeKickForSide: a.mode === 'free_kick' ? null : lm.pendingFreeKickForSide,
          pendingSetPiece: {
            mode: a.mode,
            side: a.side,
            cornerSide: a.cornerSide,
            distance: a.distance,
            zone: a.zone,
          },
        },
      };
    }
    case 'RESOLVE_SET_PIECE': {
      const lm = state.liveMatch;
      if (!lm || !lm.pendingSetPiece) return state;
      const a = action as any;
      const minute = lm.minute ?? 0;
      const outcome: 'goal' | 'shot_saved' | 'cleared' | 'recycled' = a.outcome;
      const isCorner = lm.pendingSetPiece.mode === 'corner';

      // Narrativa
      const targetPart = a.targetName ? ` ${a.targetName} sobe` : '';
      let narrativeText: string;
      switch (outcome) {
        case 'goal':
          narrativeText = isCorner
            ? `${a.takerName} cobra escanteio,${targetPart} e marca de cabeça!`
            : `${a.takerName} cobra falta direto e supera a barreira — GOL!`;
          break;
        case 'shot_saved':
          narrativeText = isCorner
            ? `${a.takerName} cruza,${targetPart} mas o goleiro defende firme.`
            : `${a.takerName} chuta a falta — goleiro defende.`;
          break;
        case 'cleared':
          narrativeText = `Defesa adversária afasta a bola após cobrança de ${a.takerName}.`;
          break;
        default:
          narrativeText = `${a.takerName} bate, jogada continua e o ataque é reciclado.`;
      }

      const ev: MatchEventEntry = {
        id: uid(),
        minute,
        text: narrativeText,
        kind: outcome === 'goal' ? 'goal_home' : 'narrative',
      };

      // Atualiza placar se gol
      let homeScore = lm.homeScore;
      let awayScore = lm.awayScore;
      if (outcome === 'goal') {
        if (lm.pendingSetPiece.side === 'home') homeScore += 1;
        else awayScore += 1;
      }

      return {
        ...state,
        liveMatch: {
          ...lm,
          homeScore,
          awayScore,
          events: [ev, ...lm.events],
          pendingSetPiece: null, // limpa direto — narrativa fica no events
        },
      };
    }
    case 'CANCEL_SET_PIECE': {
      const lm = state.liveMatch;
      if (!lm) return state;
      return { ...state, liveMatch: { ...lm, pendingSetPiece: null } };
    }
    case 'ADD_LIVE_MATCH_EVENT': {
      const lm = state.liveMatch;
      if (!lm) return state;
      const ev: MatchEventEntry = {
        id: uid(),
        minute: lm.minute ?? 0,
        text: (action as any).text as string,
        kind: ((action as any).kind ?? 'narrative') as MatchEventEntry['kind'],
      };
      return { ...state, liveMatch: { ...lm, events: [ev, ...lm.events] } };
    }
    case 'QUICK_ENFORCE_CARD_RULES': {
      if (!state.liveMatch) return state;
      const lm = state.liveMatch;
      // only enforce in quick/test2d mode
      if (lm.mode !== 'quick' && lm.mode !== 'test2d') return state;
      const playerId = (action as any).playerId as string;
      if (!playerId) return state;
      if ((lm.sentOffPlayerIds ?? []).includes(playerId)) return state;

      const res = applyRedCardAutoSub({ snapshot: lm, players: state.players, sentOffId: playerId, minute: lm.minute ?? 0, health: state.playerHealth });
      const snap = res.snapshot;
      const nextLineup = { ...state.lineup };
      for (const [slot, pid] of Object.entries(snap.matchLineupBySlot ?? {})) {
        if (pid) nextLineup[slot] = pid;
      }
      return { ...state, liveMatch: snap, lineup: nextLineup };
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
    case 'AWARD_LIVE_PENALTY': {
      if (!state.liveMatch || state.liveMatch.phase !== 'playing') return state;
      const lm = state.liveMatch;
      if (lm.penalty) return state; // já existe pênalti em curso
      const { attackingSide, takerId, takerName, minute } = action;
      const penalty = initialPenaltyState(attackingSide, takerName, takerId);
      const nowMs = Date.now();
      const overlay = penaltyOverlayForStage(
        'banner',
        takerName,
        lm.homeShort,
        lm.awayShort,
        nowMs,
        2000,
      );
      const whistleEv: MatchEventEntry = {
        id: uid(),
        minute,
        text: `${minute}' — PÊNALTI para ${attackingSide === 'home' ? lm.homeShort : lm.awayShort}!`,
        kind: 'whistle',
      };
      return {
        ...state,
        liveMatch: {
          ...lm,
          penalty,
          spiritPhase: 'penalty',
          spiritOverlay: overlay,
          events: [whistleEv, ...lm.events].slice(0, 40),
        },
      };
    }
    case 'VOICE_COMMAND_ISSUED': {
      if (!state.liveMatch || state.liveMatch.phase !== 'playing') return state;
      const lm = state.liveMatch;
      const cmd = createPendingCommand({
        intent: action.intent,
        simTimeMs: Date.now(),
        effectiveObedience: action.effectiveObedience,
        tier: action.tier,
        payload: action.payload,
      });
      const vc = { ...(lm.voiceCommands ?? {}), [action.playerId]: cmd };
      const player = lm.homePlayers.find((p) => p.playerId === action.playerId);
      const tierText: Record<string, string> = {
        critical_accept: '"DEIXA COMIGO!"',
        accept: '"Vou fazer"',
        weak_accept: '"Vou tentar"',
        refuse: '"Tá difícil..."',
        protest: '"NÃO POSSO"',
      };
      const feedEv: import('@/engine/types').MatchEventEntry = {
        id: uid(),
        minute: lm.minute,
        text: `${lm.minute}' — Comando: "${action.rawText}" → ${player?.name ?? 'jogador'} ${tierText[action.tier] ?? ''}`,
        kind: 'narrative',
        live2dMoment: action.tier === 'critical_accept' ? 'good' : action.tier === 'refuse' || action.tier === 'protest' ? 'bad' : 'info',
        playerId: action.playerId,
      };
      // Bump team obedience ponderado pelo tier do resultado individual.
      const tierDelta = TEAM_OBEDIENCE_DELTAS.byTier[action.tier] ?? 0;
      const nextObed = Math.max(30, Math.min(100, (state.tacticalObedience ?? 30) + tierDelta));
      // Relação individual: accept sobe, refuse/protest cai — persistente entre partidas.
      const relDelta: Record<string, number> = {
        critical_accept: 0.5, accept: 0.2, weak_accept: 0.05, refuse: -0.3, protest: -0.8,
      };
      const prevRel = state.managerRelationByPlayer ?? {};
      const curRel = prevRel[action.playerId] ?? 75;
      const nextRel = Math.max(0, Math.min(100, curRel + (relDelta[action.tier] ?? 0)));
      return {
        ...state,
        tacticalObedience: nextObed,
        managerRelationByPlayer: { ...prevRel, [action.playerId]: nextRel },
        liveMatch: {
          ...lm,
          voiceCommands: vc,
          events: [feedEv, ...lm.events].slice(0, 40),
        },
      };
    }
    case 'VOICE_COMMAND_EXPIRED': {
      if (!state.liveMatch) return state;
      const lm = state.liveMatch;
      const { [action.playerId]: _, ...rest } = lm.voiceCommands ?? {};
      void _;
      return { ...state, liveMatch: { ...lm, voiceCommands: rest } };
    }
    case 'VOICE_COMMANDS_SWEEP': {
      if (!state.liveMatch) return state;
      const lm = state.liveMatch;
      const current = lm.voiceCommands;
      if (!current) return state;
      const next: typeof current = {};
      let changed = false;
      for (const [pid, cmd] of Object.entries(current)) {
        const expired = action.nowMs >= cmd.expiresAt;
        const refused = cmd.tier === 'refuse' || cmd.tier === 'protest';
        if (expired || refused) { changed = true; continue; }
        next[pid] = cmd;
      }
      if (!changed) return state;
      return { ...state, liveMatch: { ...lm, voiceCommands: next } };
    }
    case 'TEAM_OBEDIENCE_BUMP': {
      const next = Math.max(30, Math.min(100, (state.tacticalObedience ?? 30) + action.delta));
      return { ...state, tacticalObedience: next };
    }
    case 'REFEREE_WARNING_LANGUAGE': {
      if (!state.liveMatch) return state;
      const lm = state.liveMatch;
      const warnings = (lm.refereeLanguageWarnings ?? 0) + 1;
      const ev: import('@/engine/types').MatchEventEntry = {
        id: uid(),
        minute: action.minute,
        text: `${action.minute}' — ⚠ Árbitro adverte o banco — linguagem imprópria do treinador.`,
        kind: 'narrative',
        live2dMoment: 'bad',
      };
      const obed = Math.max(30, (state.tacticalObedience ?? 30) - 0.5);
      return {
        ...state,
        tacticalObedience: obed,
        liveMatch: { ...lm, refereeLanguageWarnings: warnings, events: [ev, ...lm.events].slice(0, 40) },
      };
    }
    case 'REFEREE_RED_FOR_LANGUAGE': {
      if (!state.liveMatch) return state;
      const lm = state.liveMatch;
      const ev: import('@/engine/types').MatchEventEntry = {
        id: uid(),
        minute: action.minute,
        text: `${action.minute}' — 🟥 Árbitro expulsa ${action.expelledPlayerName} por conduta do treinador!`,
        kind: 'red_home',
        playerId: action.expelledPlayerId,
      };
      // Remove do campo + suspensão 1 jogo
      const nextHomePlayers = lm.homePlayers.filter((p) => p.playerId !== action.expelledPlayerId);
      const pl = state.players[action.expelledPlayerId];
      const nextPlayers = pl
        ? { ...state.players, [action.expelledPlayerId]: { ...pl, outForMatches: Math.max(1, pl.outForMatches ?? 0) } }
        : state.players;
      const obed = Math.max(30, (state.tacticalObedience ?? 30) - 2);
      return {
        ...state,
        players: nextPlayers,
        tacticalObedience: obed,
        liveMatch: {
          ...lm,
          homePlayers: nextHomePlayers,
          refereeLanguageWarnings: (lm.refereeLanguageWarnings ?? 0) + 1,
          events: [ev, ...lm.events].slice(0, 40),
        },
      };
    }
    case 'FINALIZE_MATCH': {
      if (!state.liveMatch) return state;
      const lm = state.liveMatch;
      const homeWin = lm.homeScore > lm.awayScore;

      // Update quick match streak if this was a quick match
      const quickMatchStreak = lm.mode === 'quick'
        ? updateStreak(state.quickMatchStreak, homeWin)
        : state.quickMatchStreak;

      // Apply streak multiplier to rewards for quick matches
      const streakMultiplier = lm.mode === 'quick' && quickMatchStreak ? quickMatchStreak.multiplier : 1.0;

      // Evaluate performance bonuses for quick matches (Sprint 1)
      let performanceBonuses: import('@/match/quickPerformanceBonuses').PerformanceBonus[] = [];
      let bonusOle = 0;
      let bonusExp = 0;
      if (lm.mode === 'quick') {
        // Check if was losing at some point
        let wasLosing = false;
        let tempHome = 0;
        let tempAway = 0;
        for (const e of [...lm.events].reverse()) {
          if (e.kind === 'goal_home') tempHome++;
          if (e.kind === 'goal_away') tempAway++;
          if (tempAway > tempHome) wasLosing = true;
        }

        const shots = lm.events.filter(e =>
          e.kind === 'shot_home' ||
          (e.kind === 'narrative' && e.text.toLowerCase().includes('chut'))
        ).length;

        performanceBonuses = evaluatePerformanceBonuses({
          homeScore: lm.homeScore,
          awayScore: lm.awayScore,
          goalsAgainst: lm.awayScore,
          possession: 60, // TODO: track real possession
          shots,
          events: lm.events,
          wasLosing,
          won: homeWin,
        });

        const bonusRewards = calculateTotalBonusRewards(performanceBonuses);
        bonusOle = bonusRewards.ole;
        bonusExp = bonusRewards.exp;
      }

      // Update streak challenges (Sprint 3)
      let streakChallenges = state.streakChallenges;
      if (lm.mode === 'quick' && streakChallenges && quickMatchStreak) {
        // Check if needs refresh
        if (shouldRefreshChallenges(streakChallenges)) {
          streakChallenges = {
            challenges: generateWeeklyChallenges(),
            lastRefreshDate: new Date().toISOString(),
          };
        } else {
          // Update progress
          streakChallenges = {
            ...streakChallenges,
            challenges: updateStreakProgress(
              streakChallenges.challenges,
              quickMatchStreak.current,
              homeWin,
            ),
          };
        }
      }

      // Update daily challenges for quick matches
      let dailyChallenges = state.dailyChallenges;
      if (lm.mode === 'quick' && dailyChallenges) {
        // Check if challenges need reset
        if (shouldResetDailyChallenges(dailyChallenges.lastResetDate)) {
          const todaySeed = getTodaySeed();
          dailyChallenges = {
            challenges: generateDailyChallenges(todaySeed),
            lastResetDate: new Date().toISOString(),
            streak: 0,
          };
        }

        // Find first goal minute
        const firstGoalEvent = lm.events.find((e) => e.kind === 'goal_home');
        const firstGoalMinute = firstGoalEvent?.minute;

        // Update challenge progress based on match result
        const matchData = {
          won: homeWin,
          homeScore: lm.homeScore,
          awayScore: lm.awayScore,
          firstGoalMinute,
          wasLosingAtHalftime: false, // TODO: track this in match state
        };

        // Update each challenge type
        if (homeWin) {
          dailyChallenges.challenges = updateChallengeProgress(dailyChallenges.challenges, 'win_matches');
        }
        if (lm.homeScore > 0) {
          dailyChallenges.challenges = updateChallengeProgress(dailyChallenges.challenges, 'score_goals', lm.homeScore);
        }
        if (homeWin && lm.awayScore === 0) {
          dailyChallenges.challenges = updateChallengeProgress(dailyChallenges.challenges, 'clean_sheet');
        }
        if (homeWin && firstGoalMinute !== undefined && firstGoalMinute <= 15) {
          dailyChallenges.challenges = updateChallengeProgress(dailyChallenges.challenges, 'quick_goals');
        }
        if (homeWin && lm.homeScore - lm.awayScore >= 3) {
          const challenge = dailyChallenges.challenges.find((c) => c.type === 'dominant_win' && !c.completed);
          if (challenge && lm.homeScore - lm.awayScore >= challenge.target) {
            dailyChallenges.challenges = updateChallengeProgress(dailyChallenges.challenges, 'dominant_win');
          }
        }
        if (quickMatchStreak && quickMatchStreak.current >= 3) {
          const challenge = dailyChallenges.challenges.find((c) => c.type === 'win_streak' && !c.completed);
          if (challenge && quickMatchStreak.current >= challenge.target) {
            dailyChallenges.challenges = updateChallengeProgress(dailyChallenges.challenges, 'win_streak');
          }
        }
      }

      const oleGainBase = 80 + lm.homeScore * 35 + (homeWin ? 120 : 0);
      const structBonuses = structureMatchExpBonuses({
        structures: state.structures,
        baseCrowdSupportPercent: state.crowd.supportPercent,
        isHomeFixture: state.nextFixture.isHome,
        userWin: homeWin,
      });
      const oleGain = Math.round((oleGainBase + structBonuses.totalExtra + bonusOle) * streakMultiplier);
      const draw = lm.homeScore === lm.awayScore;
      const staffNote = buildPostMatchStaffInboxItem(state, lm);
      const structExtraLine =
        structBonuses.totalExtra > 0
          ? ` Estruturas: estádio +${structBonuses.stadiumExp} EXP${homeWin ? `, Megaloja +${structBonuses.megastoreExp} EXP` : ''} (apoio efectivo ~${structBonuses.effectiveCrowd.toFixed(1)}%).`
          : '';
      const streakBonusLine =
        streakMultiplier > 1.0
          ? ` 🔥 Streak de ${quickMatchStreak?.current ?? 0} vitórias: ${streakMultiplier}x multiplicador aplicado!`
          : '';
      const performanceBonusLine =
        performanceBonuses.length > 0
          ? ` 🏆 Bônus de Performance: +${bonusOle} OLE, +${bonusExp} EXP (${performanceBonuses.map(b => b.name).join(', ')})`
          : '';
      const financeNote = makeInboxItem(
        `finance-${Date.now()}`,
        'FINANCE_EXP_GAIN',
        'FINANCEIRO',
        `+${oleGain} EXP creditados pela jornada.`,
        {
          body: `${homeWin
            ? 'Bónus de jornada creditado. Desfecho desportivo e detalhes ficam no histórico de jogos e na liga — não na caixa de notificações.'
            : draw
              ? 'Jornada contabilizada na competição — tabela e calendário na área de competição.'
              : 'Jornada contabilizada — segue a preparação no plantel e no staff; placares no histórico de jogos.'}${structExtraLine}${streakBonusLine}${performanceBonusLine}`,
          deepLink: '/wallet',
          hideFromHomeFeed: true,
        },
      );
      const nextResult: import('@/entities/types').FormLetter = homeWin ? 'W' : draw ? 'D' : 'L';
      const form = [...state.form.slice(1), nextResult];

      // Scout scoring: finalizar bônus de fim de jogo e eleger MVP
      const rawTallies = { ...(lm.scoutTallies ?? {}) };
      finalizeScoutTallies(rawTallies, { homeScore: lm.homeScore, awayScore: lm.awayScore });
      const scoutResult = computeMatchMvp(rawTallies);

      const lastRow = {
        home: state.club.name,
        away: state.nextFixture.opponent.name,
        scoreHome: lm.homeScore,
        scoreAway: lm.awayScore,
        status: 'FT',
        result: homeWin ? ('win' as const) : draw ? ('draw' as const) : ('loss' as const),
        scoutMvp: scoutResult.mvp,
        scoutTop3: scoutResult.top3,
      };
      const results = [lastRow, ...state.results].slice(0, 8);

      const marketBeforeMatch = marketBroSnapshotFromPlayers(state.players);
      let playerSeasonLedger = mergeLedgerAfterMatch(state.playerSeasonLedger, lm, marketBeforeMatch);

      let players = tickRecoveryMatches(state.players, state.structures.medical_dept ?? 1);

      // SSOT shadow-write: aplica consequências de saúde no mapa unificado.
      // Mantém-se em paralelo com a mutação legacy em `players` durante a Fase 1.
      const isFriendly =
        /amist/i.test(state.nextFixture.competition) ||
        /^FRIENDLY/i.test(state.nextFixture.competition);
      const matchModeForHealth = isFriendly ? 'friendly' : (lm.mode as 'quick' | 'auto' | 'test2d');
      const healthEvents = liveMatchToHealthEvents({
        lm,
        matchId: state.nextFixture.id ?? `match-${Date.now()}`,
        leagueId: isFriendly ? null : (state.adminPrimaryLeagueId ?? null),
        modeOverride: matchModeForHealth,
      });
      const healthAfterMatch = healthEvents.length
        ? applyHealthConsequences(state.playerHealth, healthEvents).next
        : state.playerHealth;
      const playerHealth = tickHealthRecovery(healthAfterMatch, {
        medicalBonusPct: state.structures.medical_dept ? state.structures.medical_dept * 10 : 0,
      });

      const outcome: 'win' | 'draw' | 'loss' = homeWin ? 'win' : draw ? 'draw' : 'loss';
      for (const [pid, stat] of Object.entries(lm.homeStats ?? {})) {
        const pl = players[pid];
        if (!pl) continue;
        let next = applyMatchPerformanceEvolution(pl, stat, outcome);
        next = clampPlayerToEvolutionCap(ensureMintOverall(next));
        players[pid] = next;
      }

      players = applyHomeContractsAfterMatch(players, lm);

      const playedIds =
        Object.keys(lm.homeStats ?? {}).length > 0
          ? Object.keys(lm.homeStats ?? {})
          : (lm.homePlayers ?? []).map((h) => h.playerId).filter(Boolean);
      const playedUnique = [...new Set(playedIds)];
      const postNut = nutritionPostMatchFatigueRecoveryBonus(state.manager.staff);
      if (postNut > 0) {
        for (const pid of playedUnique) {
          const pl = players[pid];
          if (!pl) continue;
          players[pid] = {
            ...pl,
            fatigue: Math.max(0, Math.round(pl.fatigue * (1 - postNut * 0.55))),
          };
        }
      }
      // Sync engine-final → SSOT: o engine ainda escreve fatigue/injuryRisk/outForMatches
      // em PlayerEntity durante a partida. Aqui transcrevemos os valores finais
      // (já com postNut/tickRecovery aplicados) para o playerHealth, garantindo paridade.
      const syncedHealth: typeof playerHealth = { ...playerHealth };
      for (const [pid, p] of Object.entries(players)) {
        const cur = syncedHealth[pid];
        if (!cur) continue;
        syncedHealth[pid] = {
          ...cur,
          fatigue: p.fatigue,
          injuryRisk: p.injuryRisk,
          outForMatches: p.outForMatches,
          atRisk: p.fatigue >= 80 || p.injuryRisk >= 70,
        };
      }
      // Reatribui via const-block aliasing
      const playerHealthFinal = syncedHealth;

      const marketAfterMatch = marketBroSnapshotFromPlayers(players);
      playerSeasonLedger = ledgerTouchMarketAfterMatch(playerSeasonLedger, playedUnique, marketAfterMatch);

      const playerEvolutionTimeline = appendEvolutionTimelinePoints(
        state.playerEvolutionTimeline,
        playedUnique,
        players,
        playerSeasonLedger,
        'match',
        homeWin,
      );

      const playerPersistPayload = Object.values(players).map((p) => ({
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
      }));
      if (lm.supabaseMatchId) {
        const postData: Record<string, unknown> = {
          homeStats: lm.homeStats,
          events: lm.events.slice(0, 60).map((e) => ({ minute: e.minute, kind: e.kind, text: e.text })),
          scoutMvp: lastRow.scoutMvp,
          scoutTop3: lastRow.scoutTop3,
        };
        void finalizeMatch(lm.supabaseMatchId, lm.homeScore, lm.awayScore, postData);
      }
      void persistPlayers(state.club.id, playerPersistPayload);

      const leagueSeason = applyResultToLeagueSeason(state.leagueSeason, lastRow);

      const prevMem = state.memorableTrophyUnlockedIds ?? [];
      const memorableTrophyUnlockedIds = appendMemorableTrophyUnlocks(prevMem, {
        homeWin,
        competition: state.nextFixture.competition,
        leaguePoints: leagueSeason.points,
        leaguePlayed: leagueSeason.played,
      });
      const newTrophies = diffNewMemorableTrophyIds(prevMem, memorableTrophyUnlockedIds);

      let finance = grantEarnedExp(state.finance, oleGain);
      finance = withExpHistory(finance, oleGain, 'Recompensa de partida');
      for (const tid of newTrophies) {
        const { exp: te, broCents: tb } = memorableTrophyFinanceReward(tid);
        if (te > 0) {
          finance = grantEarnedExp(finance, te);
          finance = withExpHistory(finance, te, 'Prémio de competição (troféu)');
        }
        if (tb > 0) finance = addBroCents(finance, tb);
      }

      let inbox = [staffNote, financeNote, ...state.inbox].slice(0, 14);
      if (newTrophies.length > 0) {
        const trophyNote = makeInboxItem(
          `trophy-${Date.now()}`,
          'FINANCE_EXP_GAIN',
          'COMPETIÇÃO',
          'Prémios de título memorável creditados.',
          {
            body: `Novos troféus: ${newTrophies.join(', ')}. EXP e BRO na carteira de jogo.`,
            deepLink: '/manager',
          },
        );
        inbox = [trophyNote, ...inbox].slice(0, 14);
      }

      // Atualizar ranking competitivo se a partida for competitiva contra humano
      let competitiveRanking = state.competitiveRanking;
      if (lm.isCompetitive && lm.opponentType === 'human') {
        const current = competitiveRanking ?? createInitialCompetitiveRanking();
        competitiveRanking = updateCompetitiveRanking(current, lm.homeScore, lm.awayScore);

        // Adicionar notificação de ranking
        const pointsGained = homeWin ? 3 : draw ? 1 : 0;
        if (pointsGained > 0) {
          const rankingNote = makeInboxItem(
            `ranking-${Date.now()}`,
            'FINANCE_EXP_GAIN',
            'RANKING',
            `+${pointsGained} pontos no ranking competitivo!`,
            {
              body: `Partida competitiva: ${homeWin ? 'Vitória' : 'Empate'} contra adversário humano. Total: ${competitiveRanking.points} pontos (${competitiveRanking.wins}V ${competitiveRanking.draws}E ${competitiveRanking.losses}D).`,
              deepLink: '/ranking',
            },
          );
          inbox = [rankingNote, ...inbox].slice(0, 14);
        }
      }

      // Gerar propostas proativas do Coach baseadas em saúde pós-jogo.
      const stateAfterMatch: OlefootGameState = {
        ...state,
        finance,
        inbox,
        form,
        results,
        leagueSeason,
        memorableTrophyUnlockedIds,
        liveMatch: null,
        players,
        playerHealth: playerHealthFinal,
        playerSeasonLedger,
        playerEvolutionTimeline,
        quickMatchStreak,
        dailyChallenges,
        streakChallenges,
        competitiveRanking,
      };
      let manager = stateAfterMatch.manager;
      if (manager.coach) {
        const proactive = generateProactiveHealthActions(stateAfterMatch);
        if (proactive.length) {
          const existingTitles = new Set(
            manager.coach.pendingActions
              .filter((a) => a.status === 'pending')
              .map((a) => a.title),
          );
          const fresh = proactive.filter((a) => !existingTitles.has(a.title));
          if (fresh.length) {
            manager = {
              ...manager,
              coach: {
                ...manager.coach,
                pendingActions: [...manager.coach.pendingActions, ...fresh],
              },
            };
          }
        }
      }
      // Atualiza apoio da torcida com base no resultado da partida.
      // Vitória: +3 a +5 | Empate: -1 | Derrota: -4 a -6
      // Goleada (3+ gols de diferença) dá bônus extra.
      const goalDiff = lm.homeScore - lm.awayScore;
      const crowdDelta = homeWin
        ? Math.min(5, 3 + Math.floor(Math.max(0, goalDiff - 1)))
        : draw
        ? -1
        : Math.max(-6, -4 - Math.floor(Math.max(0, -goalDiff - 1)));
      const newSupportPercent = Math.min(99, Math.max(0, stateAfterMatch.crowd.supportPercent + crowdDelta));
      const crowd = { supportPercent: newSupportPercent, moodLabel: crowdMood(newSupportPercent) };

      return { ...stateAfterMatch, manager, crowd };
    }
    case 'MERGE_PLAYERS': {
      const players = { ...state.players, ...action.players };
      const playerSeasonLedger = sanitizePlayerSeasonLedger(
        state.playerSeasonLedger,
        new Set(Object.keys(players)),
      );
      const playerEvolutionTimeline = sanitizePlayerEvolutionTimeline(
        state.playerEvolutionTimeline,
        new Set(Object.keys(players)),
      );
      return { ...state, players, playerSeasonLedger, playerEvolutionTimeline };
    }
    case 'SET_PLAYERS_RECORD': {
      const players = action.players;
      const lineup = buildDefaultLineup(players);
      let liveMatch = state.liveMatch;
      if (liveMatch) {
        const ids = new Set(Object.keys(players));
        const badLineup = Object.values(liveMatch.matchLineupBySlot ?? {}).some((pid) => pid && !ids.has(pid));
        const badHome = (liveMatch.homePlayers ?? []).some((hp) => !ids.has(hp.playerId));
        if (badLineup || badHome) liveMatch = null;
      }
      const staff = state.manager.staff;
      const assignedByPlayer = { ...staff.assignedByPlayer };
      for (const pid of Object.keys(assignedByPlayer)) {
        if (!players[pid]) delete assignedByPlayer[pid];
      }
      const mpm = state.managerProspectMarket;
      const ownListings = mpm.ownListings.filter((l) => players[l.playerId]);
      const managerProspectArtQueue = (state.managerProspectArtQueue ?? []).filter((r) => players[r.playerId]);
      const playerSeasonLedger = sanitizePlayerSeasonLedger(
        state.playerSeasonLedger,
        new Set(Object.keys(players)),
      );
      const playerEvolutionTimeline = sanitizePlayerEvolutionTimeline(
        state.playerEvolutionTimeline,
        new Set(Object.keys(players)),
      );
      return {
        ...state,
        players,
        lineup,
        liveMatch,
        manager: {
          ...state.manager,
          staff: { ...staff, assignedByPlayer },
        },
        managerProspectMarket: { ...mpm, ownListings },
        managerProspectArtQueue,
        playerSeasonLedger,
        playerEvolutionTimeline,
      };
    }
    case 'CREATE_MANAGER_PROSPECT': {
      const cost = Math.max(
        0,
        Math.round(state.managerProspectConfig?.createCostExp ?? DEFAULT_MANAGER_PROSPECT_CREATE_COST_EXP),
      );
      const tier = (action.payload.contractMatches ?? 10) as ManagerProspectContractGames;
      const totalCost = cost + managerProspectContractPremiumExp(tier);
      if (state.finance.ole < totalCost) return state;
      const hasAcademiaTune = action.payload.attrs !== undefined;
      if (hasAcademiaTune && !isValidManagerHeritage(action.payload.heritage)) return state;
      if (hasAcademiaTune) {
        const nameCheck = validateAcademyProspectName(action.payload.name ?? '');
        if (!nameCheck.ok) return state;
      }
      const id = `mgr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const num = nextKitNumber(state.players);
      const built = buildManagerCreatedPlayerEntity(action.payload, id, num, true);
      if (overallFromAttributes(built.attrs) > MANAGER_PROSPECT_CREATE_MAX_OVR) return state;
      const finance = withExpHistory(addOle(state.finance, -totalCost), -totalCost, 'academia_ole_criar');
      const strongFoot = built.strongFoot ?? 'right';
      const heritage = action.payload.heritage;
      const adminArtPrompt = buildProspectAdminArtPrompt({
        name: built.name,
        pos: built.pos,
        age: built.age ?? action.payload.age,
        country: built.country ?? action.payload.country,
        strongFoot,
        behavior: built.behavior,
        attrs: built.attrs,
        heritage: hasAcademiaTune && heritage ? heritage : undefined,
        visual: action.payload.visualBrief,
      });
      const requestId = `art_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const createdAtIso = new Date().toISOString();
      const heritageBrief: ManagerProspectHeritageBrief = heritage
        ? {
            portraitStyleRegion: heritage.portraitStyleRegion,
            originTags: [...(heritage.originTags ?? [])],
            originText: heritage.originText.trim(),
          }
        : {
            portraitStyleRegion: 'americas_sul',
            originTags: [],
            originText:
              'Registo interno sem bloco de origem do fluxo Academia — completar nota no painel Jogadores da Academia.',
          };
      const queueEntry: ManagerProspectArtRequest = {
        id: requestId,
        playerId: built.id,
        createdAtIso,
        playerCreationStep: 'awaiting_photo',
        adminArtPrompt,
        attributesSnapshot: { ...built.attrs },
        visualBrief: action.payload.visualBrief,
        heritage: heritageBrief,
        draftPortraitUrl: undefined,
      };
      const prevQueue = state.managerProspectArtQueue ?? [];
      const managerProspectArtQueue = [queueEntry, ...prevQueue].slice(0, 200);
      return {
        ...state,
        finance,
        players: { ...state.players, [built.id]: built },
        managerProspectArtQueue,
      };
    }
    case 'RENEW_MANAGER_PROSPECT_CONTRACT': {
      const player = state.players[action.playerId];
      if (!player) return state;
      if (!player.contractExpired) return state;
      if (!player.managerCreated) return state;

      // Custo de renovação: 50% do custo base + prêmio do contrato
      const baseCost = Math.max(
        0,
        Math.round(state.managerProspectConfig?.createCostExp ?? DEFAULT_MANAGER_PROSPECT_CREATE_COST_EXP),
      );
      const renewalBaseCost = Math.round(baseCost * 0.5);
      const contractPremium = managerProspectContractPremiumExp(action.contractMatches);
      const totalCost = renewalBaseCost + contractPremium;

      if (state.finance.ole < totalCost) return state;

      const finance = withExpHistory(
        addOle(state.finance, -totalCost),
        -totalCost,
        'academia_ole_renovar',
      );

      const updatedPlayer: PlayerEntity = {
        ...player,
        contractMatchesRemaining: action.contractMatches,
        contractMatchesIncluded: action.contractMatches,
        contractExpired: false,
      };

      return {
        ...state,
        finance,
        players: { ...state.players, [action.playerId]: updatedPlayer },
      };
    }
    case 'LIST_MANAGER_PROSPECT': {
      const pl = state.players[action.playerId];
      if (!pl) return state;
      if (pl.listedOnMarket) return state;
      if (state.managerProspectMarket.ownListings.some((l) => l.playerId === action.playerId)) return state;
      const priceExp = Math.max(50_000, Math.min(5_000_000, Math.round(action.priceExp)));
      const listingId = `lst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const listedAtIso = new Date().toISOString();
      const lineup = { ...state.lineup };
      for (const [slot, pid] of Object.entries(lineup)) {
        if (pid === action.playerId) delete lineup[slot];
      }
      const players = {
        ...state.players,
        [action.playerId]: { ...pl, listedOnMarket: true },
      };
      return {
        ...state,
        lineup,
        players,
        managerProspectMarket: {
          ...state.managerProspectMarket,
          ownListings: [
            { listingId, playerId: action.playerId, priceExp, listedAtIso },
            ...state.managerProspectMarket.ownListings,
          ],
        },
      };
    }
    case 'DELIST_MANAGER_PROSPECT': {
      const li = state.managerProspectMarket.ownListings.find((l) => l.listingId === action.listingId);
      if (!li) return state;
      const pl = state.players[li.playerId];
      if (!pl) {
        return {
          ...state,
          managerProspectMarket: {
            ...state.managerProspectMarket,
            ownListings: state.managerProspectMarket.ownListings.filter((l) => l.listingId !== action.listingId),
          },
        };
      }
      return {
        ...state,
        players: {
          ...state.players,
          [li.playerId]: { ...pl, listedOnMarket: false },
        },
        managerProspectMarket: {
          ...state.managerProspectMarket,
          ownListings: state.managerProspectMarket.ownListings.filter((l) => l.listingId !== action.listingId),
        },
      };
    }
    case 'BUY_GENESIS_MARKET_PLAYER': {
      const pid = action.player.id;
      if (!pid.startsWith('genesis-')) return state;
      if (state.players[pid]) return state;
      if (action.genesisCatalogId !== pid.replace(/^genesis-/, '')) return state;
      const mint = Math.round(action.mintOverall);
      const expected = genesisListingPriceExpFromMintOverall(mint);
      if (action.priceExp !== expected) return state;
      const ovr = overallFromAttributes(action.player.attrs);
      if (Math.abs(ovr - mint) > 1) return state;
      if (state.finance.ole < action.priceExp) return state;
      const finance = withExpHistory(addOle(state.finance, -action.priceExp), -action.priceExp, 'mercado_genesis');
      return {
        ...state,
        finance,
        players: { ...state.players, [pid]: { ...action.player, listedOnMarket: false } },
      };
    }
    case 'APPLY_LEGACY_LEARNED': {
      const ATTR_KEYS: Array<keyof import('@/entities/types').PlayerAttributes> = [
        'passe', 'marcacao', 'velocidade', 'drible', 'finalizacao',
        'fisico', 'tatico', 'mentalidade', 'confianca', 'fairPlay',
      ];
      const nextPlayers = { ...state.players };
      let changed = false;
      for (const upd of action.updates) {
        const pl = nextPlayers[upd.studentPlayerId];
        if (!pl) continue;
        const nextAttrs = { ...pl.attrs };
        let anyDelta = false;
        for (const k of ATTR_KEYS) {
          const learned = upd.learnedAttributes[k as string];
          const legacyCap = upd.legacyAttributes[k as string];
          if (typeof learned !== 'number' || !Number.isFinite(learned)) continue;
          if (typeof legacyCap !== 'number' || !Number.isFinite(legacyCap)) continue;
          const base = nextAttrs[k] ?? 0;
          if (base >= legacyCap) continue;
          const effective = Math.min(legacyCap, base + learned);
          if (effective > base) {
            nextAttrs[k] = Math.round(effective);
            anyDelta = true;
          }
        }

        // Transfere positionKnowledge do mentor, com sessionsCompleted escalado pelo progresso.
        let nextPk = pl.positionKnowledge;
        if (upd.legacyPositionKnowledge) {
          const taught = upd.taughtAttributes && upd.taughtAttributes.length > 0
            ? upd.taughtAttributes
            : Object.keys(upd.legacyAttributes);
          let sum = 0;
          let count = 0;
          for (const k of taught) {
            const cap = upd.legacyAttributes[k];
            const learned = upd.learnedAttributes[k] ?? 0;
            if (typeof cap !== 'number' || cap <= 0) continue;
            sum += Math.min(1, learned / cap);
            count += 1;
          }
          const progress = count > 0 ? sum / count : 0;
          const srcSessions = upd.legacyPositionKnowledge.sessionsCompleted || 0;
          const scaledSessions = Math.round(progress * Math.max(srcSessions, 5));
          nextPk = {
            ...upd.legacyPositionKnowledge,
            sessionsCompleted: scaledSessions,
            legendSource: upd.legacyPositionKnowledge.legendSource ?? 'legacy_mentor',
          };
        }

        if (anyDelta || nextPk !== pl.positionKnowledge) {
          nextPlayers[upd.studentPlayerId] = {
            ...pl,
            attrs: nextAttrs,
            ...(nextPk ? { positionKnowledge: nextPk } : {}),
          };
          changed = true;
        }
      }
      if (!changed) return state;
      return { ...state, players: nextPlayers };
    }
    case 'BUY_LEGACY_PLAYER': {
      const pid = action.player.id;
      if (!pid.startsWith('legacy-')) return state;
      if (state.players[pid]) return state;
      if (state.finance.ole < action.priceExp) return state;
      const finance = withExpHistory(addOle(state.finance, -action.priceExp), -action.priceExp, 'mercado_legacy');
      return {
        ...state,
        finance,
        players: { ...state.players, [pid]: { ...action.player, listedOnMarket: false } },
      };
    }
    case 'BUY_MANAGER_NPC_OFFER': {
      const offer = state.managerProspectMarket.npcOffers.find((o) => o.listingId === action.listingId);
      if (!offer) return state;
      if (state.finance.ole < offer.priceExp) return state;
      const newId = `mgr_imp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const num = nextKitNumber(state.players);
      let attrs = offer.snapshot.attrs;
      if (overallFromAttributes(attrs) > MANAGER_PROSPECT_EVOLVED_MAX_OVR) {
        attrs = scaleAttrsToMaxOvr(attrs, MANAGER_PROSPECT_EVOLVED_MAX_OVR);
      }
      const importMint = overallFromAttributes(attrs);
      const added: import('@/entities/types').PlayerEntity = {
        ...offer.snapshot,
        id: newId,
        num,
        attrs,
        mintOverall: importMint,
        evolutionRate: offer.snapshot.evolutionRate ?? 1,
        listedOnMarket: false,
        evolutionXp: offer.snapshot.evolutionXp ?? 0,
      };
      const price = offer.priceExp;
      const finance = withExpHistory(addOle(state.finance, -price), -price, 'mercado_academia_npc');
      const npcOffers = state.managerProspectMarket.npcOffers.filter((o) => o.listingId !== action.listingId);
      return {
        ...state,
        finance,
        players: { ...state.players, [added.id]: added },
        managerProspectMarket: {
          ...state.managerProspectMarket,
          npcOffers,
        },
      };
    }
    case 'REFRESH_MANAGER_NPC_MARKET': {
      const npcOffers = buildNpcOffersForShop(state);
      return {
        ...state,
        managerProspectMarket: { ...state.managerProspectMarket, npcOffers },
      };
    }
    case 'GRANT_EARNED_EXP': {
      const a = Math.round(action.amount);
      if (a <= 0) return state;
      // Guard: teto por chamada para limitar impacto de dispatch manual no console.
      // Valor legítimo mais alto: recompensa de temporada ~500k EXP.
      if (a > 1_000_000) return state;
      const src = action.historySource?.trim() || 'Recompensa';
      let finance = grantEarnedExp(state.finance, a);
      finance = withExpHistory(finance, a, src);
      return { ...state, finance };
    }
    case 'EXP_EXCHANGE_ANNOUNCE_SELL': {
      const expAmount = Math.round(action.expAmount);
      const broCents = Math.round(action.broCents);
      if (
        expAmount < EXP_EXCHANGE_MIN_LOT ||
        expAmount > EXP_EXCHANGE_MAX_LOT ||
        broCents < EXP_EXCHANGE_MIN_BRO_CENTS ||
        state.finance.ole < expAmount
      ) {
        return state;
      }
      const finance = withExpHistory(addOle(state.finance, -expAmount), -expAmount, 'Exchange · anúncio EXP');
      const order = {
        id: `ex_pl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        kind: 'player' as const,
        sellerClubId: state.club.id,
        teamName: state.club.name,
        expAmount,
        broCents,
        createdAtIso: new Date().toISOString(),
      };
      return {
        ...state,
        finance,
        expExchange: {
          ...state.expExchange,
          playerOrders: [order, ...state.expExchange.playerOrders],
        },
      };
    }
    case 'EXP_EXCHANGE_CANCEL_SELL': {
      const o = state.expExchange.playerOrders.find((x) => x.id === action.orderId);
      if (!o || o.sellerClubId !== state.club.id) return state;
      const finance = withExpHistory(addOle(state.finance, o.expAmount), o.expAmount, 'Exchange · cancelar venda');
      return {
        ...state,
        finance,
        expExchange: {
          ...state.expExchange,
          playerOrders: state.expExchange.playerOrders.filter((x) => x.id !== action.orderId),
        },
      };
    }
    case 'EXP_EXCHANGE_BUY': {
      const ex = state.expExchange;
      const npcIdx = ex.npcOrders.findIndex((o) => o.id === action.orderId);
      if (npcIdx < 0) return state;
      const o = ex.npcOrders[npcIdx]!;
      // Guard: order deve ter valores dentro de limites razoáveis.
      if (o.broCents <= 0 || o.expAmount <= 0 || o.expAmount > 10_000_000) return state;
      if (state.finance.broCents < o.broCents) return state;
      let finance = addBroCents(state.finance, -o.broCents);
      finance = grantEarnedExp(finance, o.expAmount);
      finance = withExpHistory(finance, o.expAmount, 'Exchange · compra EXP');
      const npcOrders = ex.npcOrders.filter((x) => x.id !== o.id);
      const expExchange = replenishNpcExpOrders({ ...ex, npcOrders });
      return { ...state, finance, expExchange };
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
    case 'SET_PRESSING_CONTEXT': {
      const a = action as any;
      const cur = state.manager.pressing ?? {
        triggers: { onTurnover: true, whenLosing: true, whenLeading: false },
        zone: 'mid' as const,
        intensity: 60,
      };
      const next = {
        triggers: { ...cur.triggers, ...(a.patch?.triggers ?? {}) },
        zone: a.patch?.zone ?? cur.zone,
        intensity: a.patch?.intensity ?? cur.intensity,
      };
      return { ...state, manager: { ...state.manager, pressing: next } };
    }
    case 'SET_MARKING_ASSIGNMENT': {
      const a = action as any;
      const current = state.manager.markingAssignments ?? {};
      let next: Record<string, string>;
      if (a.opponentId == null) {
        // Remove assignment
        next = { ...current };
        delete next[a.homePlayerId];
      } else {
        // Remove qualquer outro home jogador que estivesse marcando esse opp
        next = Object.fromEntries(
          Object.entries(current).filter(([_, oppId]) => oppId !== a.opponentId),
        );
        next[a.homePlayerId] = a.opponentId;
      }
      return { ...state, manager: { ...state.manager, markingAssignments: next } };
    }
    case 'CLEAR_MARKING_ASSIGNMENTS': {
      return { ...state, manager: { ...state.manager, markingAssignments: {} } };
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
      if (action.mode === 'coletivo') {
        const maxColl = trainingCenterMaxConcurrentCollectivePlans(state.structures.training_center ?? 1);
        const runningColl = state.manager.trainingPlans.filter((p) => p.status === 'running' && p.mode === 'coletivo')
          .length;
        if (runningColl >= maxColl) {
          return {
            ...state,
            inbox: [
              makeInboxItem(
                `train-coll-${Date.now()}`,
                'TRAINING_SLOT_BLOCKED',
                'TREINO',
                `Limite de treinos colectivos em simultâneo: ${maxColl}.`,
                { colorClass: 'text-red-400' },
              ),
              ...state.inbox,
            ].slice(0, 14),
          };
        }
      }
      const now = new Date().toISOString();
      const group = action.group ?? 'all';
      const resolvedIds =
        action.mode === 'coletivo'
          ? resolveGroupPlayerIds(state.players, group)
          : action.playerIds.slice(0, slots);
      if (resolvedIds.length === 0) return state;
      /** Coletivo: todo o grupo definido por `group`; individual: até `slots` por tipo de treino. */
      const playerIdsForPlan = action.mode === 'coletivo' ? resolvedIds : resolvedIds.slice(0, slots);
      const plan = {
        id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        mode: action.mode,
        trainingType: action.trainingType,
        playerIds: playerIdsForPlan,
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
      const { due: dueTreat, rest: restTreat } = splitDueTreatments(state.manager.treatmentPlans ?? [], nowIso);
      if (due.length === 0 && dueTreat.length === 0) return state;
      let players = { ...state.players };
      let playerSeasonLedger = { ...state.playerSeasonLedger };
      let playerEvolutionTimeline = { ...state.playerEvolutionTimeline };
      const yaLvl = state.structures.youth_academy ?? 1;
      const ctLvl = state.structures.training_center ?? 1;
      const medLvl = state.structures.medical_dept ?? 1;
      for (const plan of due) {
        const marketSnap = marketBroSnapshotFromPlayers(players);
        for (const pid of plan.playerIds) {
          const pl = players[pid];
          if (!pl) continue;
          const assigned = state.manager.staff.assignedByPlayer[pid] ?? [];
          const collectiveRoles = plan.mode === 'coletivo' ? state.manager.staff.assignedCollective[plan.group] ?? [] : [];
          const roleIds = Array.from(new Set([...assigned, ...collectiveRoles]));
          const base = applyTrainingToPlayer(pl, plan.trainingType);
          const prospectMult =
            pl.archetype === 'novo_talento' ? youthAcademyProspectTrainingMultiplier(yaLvl) : 1;
          const ctMult = trainingCenterAttributeGainMultiplier(ctLvl);
          const boosted = amplifyTrainingResult(
            pl,
            base,
            trainingGainMultiplier(state.manager.staff, roleIds) * prospectMult * ctMult,
          );
          const recovered = applyNutritionRecovery(boosted, state.manager.staff);
          players[pid] = clampPlayerToEvolutionCap(ensureMintOverall(recovered));
        }
        playerSeasonLedger = mergeLedgerAfterTrainingPlan(
          playerSeasonLedger,
          plan.playerIds,
          plan.trainingType,
          marketSnap,
        );
        playerEvolutionTimeline = appendEvolutionTimelinePoints(
          playerEvolutionTimeline,
          plan.playerIds,
          players,
          playerSeasonLedger,
          'training_plan',
        );
      }
      for (const t of dueTreat) {
        const pl = players[t.playerId];
        if (!pl) continue;
        players[t.playerId] = clampPlayerToEvolutionCap(
          ensureMintOverall(applyTreatmentCompletionToPlayer(pl, medLvl)),
        );
      }
      const done = due.map((p) => ({ ...p, status: 'completed' as const }));
      const doneTreat = dueTreat.map((p) => ({ ...p, status: 'completed' as const }));
      const inboxParts: string[] = [];
      if (due.length > 0) inboxParts.push(`${due.length} treino(s) concluído(s)`);
      if (dueTreat.length > 0) inboxParts.push(`${dueTreat.length} tratamento(s) concluído(s)`);

      // Sync playerHealth (SSOT) com fatigue/injuryRisk pós-treino/tratamento — descanso deposita aqui.
      const syncedHealth: typeof state.playerHealth = { ...state.playerHealth };
      for (const [pid, p] of Object.entries(players)) {
        const cur = syncedHealth[pid];
        if (!cur) continue;
        syncedHealth[pid] = {
          ...cur,
          fatigue: p.fatigue,
          injuryRisk: p.injuryRisk,
          outForMatches: p.outForMatches,
          atRisk: p.fatigue >= 80 || p.injuryRisk >= 70,
        };
      }

      return {
        ...state,
        players,
        playerHealth: syncedHealth,
        playerSeasonLedger,
        playerEvolutionTimeline,
        manager: {
          ...state.manager,
          trainingPlans: [...done, ...rest].slice(0, 80),
          treatmentPlans: [...doneTreat, ...restTreat].slice(0, 40),
        },
        inbox: [
          makeInboxItem(
            `train-done-${Date.now()}`,
            'TRAINING_PLANS_COMPLETED',
            'TREINO',
            `${inboxParts.join('; ')}.`,
            { deepLink: '/team' },
          ),
          ...state.inbox,
        ].slice(0, 14),
      };
    }
    case 'START_TREATMENT_PLAN': {
      const medLvl = state.structures.medical_dept ?? 1;
      const maxTreat = medicalDeptTreatmentSlots(medLvl);
      const runningTreat = (state.manager.treatmentPlans ?? []).filter((p) => p.status === 'running').length;
      if (runningTreat >= maxTreat) {
        return {
          ...state,
          inbox: [
            makeInboxItem(
              `treat-slot-${Date.now()}`,
              'TRAINING_SLOT_BLOCKED',
              'CLUBE',
              `Todos os slots de tratamento estão ocupados (máx. ${maxTreat}).`,
              { colorClass: 'text-red-400', deepLink: '/team/treino' },
            ),
            ...state.inbox,
          ].slice(0, 14),
        };
      }
      const pl = state.players[action.playerId];
      if (!pl) return state;
      const already = (state.manager.treatmentPlans ?? []).some(
        (p) => p.status === 'running' && p.playerId === action.playerId,
      );
      if (already) {
        return {
          ...state,
          inbox: [
            makeInboxItem(
              `treat-dup-${Date.now()}`,
              'TRAINING_SLOT_BLOCKED',
              'CLUBE',
              'Este jogador já tem um tratamento em curso.',
              { colorClass: 'text-red-400', deepLink: '/team/treino' },
            ),
            ...state.inbox,
          ].slice(0, 14),
        };
      }
      const now = new Date().toISOString();
      const plan = {
        id: `med-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        playerId: action.playerId,
        startedAt: now,
        endAt: addHoursIso(now, TREATMENT_PLAN_DURATION_H),
        status: 'running' as const,
      };
      return {
        ...state,
        manager: {
          ...state.manager,
          treatmentPlans: [plan, ...(state.manager.treatmentPlans ?? [])].slice(0, 40),
        },
        inbox: [
          makeInboxItem(
            `treat-start-${Date.now()}`,
            'STAFF_ADVICE',
            'STAFF',
            `Tratamento iniciado: ${pl.name}`,
            {
              body: `Departamento médico (nível ${medLvl}). Conclusão em ~${TREATMENT_PLAN_DURATION_H}h.`,
              advisorLabel: 'Departamento médico',
              deepLink: '/team/treino',
            },
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
      const trainedPlayers: Record<string, import('@/entities/types').PlayerEntity> = {};
      for (const [id, p] of Object.entries(r.players)) {
        trainedPlayers[id] = clampPlayerToEvolutionCap(ensureMintOverall(p));
      }
      const marketSnap = marketBroSnapshotFromPlayers(state.players);
      const trainedIds = Object.keys(trainedPlayers);
      const playerSeasonLedger = mergeLedgerAfterTrainingLightSession(
        state.playerSeasonLedger,
        trainedIds,
        marketSnap,
      );
      const playerEvolutionTimeline = appendEvolutionTimelinePoints(
        state.playerEvolutionTimeline,
        trainedIds,
        trainedPlayers,
        playerSeasonLedger,
        'training_light',
      );
      return {
        ...state,
        players: trainedPlayers,
        playerSeasonLedger,
        playerEvolutionTimeline,
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
      const perRoleCap = maxStaffSlotsByLevel(state.manager.staff.roles.treinador ?? 1);
      const prev = state.manager.staff.assignedByPlayer ?? {};
      const requested = Array.from(new Set(action.roleIds));
      // Enforce per-role slot capacity: se a role já está cheia com outros jogadores, não aceita este.
      const accepted: typeof requested = [];
      for (const roleId of requested) {
        const otherUsers = Object.entries(prev)
          .filter(([pid, roles]) => pid !== action.playerId && (roles ?? []).includes(roleId))
          .length;
        if (otherUsers < perRoleCap) accepted.push(roleId);
      }
      return {
        ...state,
        manager: {
          ...state.manager,
          staff: {
            ...state.manager.staff,
            assignedByPlayer: {
              ...prev,
              [action.playerId]: accepted,
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
      const medMult = 1 + medicalDeptRecoverySpeedBonusPercent(state.structures.medical_dept ?? 1) / 100;
      const players = { ...state.players };
      for (const id of Object.keys(players)) {
        const p = players[id];
        if (!p) continue;
        players[id] = {
          ...p,
          fatigue: Math.max(0, p.fatigue - Math.round(CITY_QUICK_MEDICAL_FATIGUE_DELTA * medMult)),
          injuryRisk: Math.max(0, p.injuryRisk - Math.round(CITY_QUICK_MEDICAL_INJURY_RISK_DELTA * medMult)),
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
      const maxColl = trainingCenterMaxConcurrentCollectivePlans(state.structures.training_center ?? 1);
      const runningColl = state.manager.trainingPlans.filter((p) => p.status === 'running' && p.mode === 'coletivo')
        .length;
      if (runningColl >= maxColl) {
        return {
          ...state,
          inbox: [
            makeInboxItem(
              `city-train-coll-${Date.now()}`,
              'TRAINING_SLOT_BLOCKED',
              'TREINO',
              `Treino intensivo indisponível: limite de ${maxColl} treino(s) colectivo(s) em simultâneo.`,
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
    case 'WALLET_SYNC_REFERRAL_CODE': {
      const w = walletOf(state);
      const norm = String(action.code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!norm || norm === w.myReferralCode) return state;
      return syncWalletToFinance(state, { ...w, myReferralCode: norm });
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
              { colorClass: 'text-red-400', deepLink: '/wallet/referrals' },
            ),
            ...state.inbox,
          ].slice(0, 14),
        };
      }
      return syncWalletToFinance(state, result.state);
    }
    case 'WALLET_TRANSFER_BRO_BY_CODE': {
      const w = { ...walletOf(state), spotBroCents: state.finance.broCents };
      const result = transferBroByReferralCode(w, action.recipientCode, action.amountCents);
      if (result.ok === false) {
        return {
          ...state,
          inbox: [
            makeInboxItem(
              `xfer-fail-${Date.now()}`,
              'WALLET_TRANSFER_FAIL',
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
    case 'REFUND_FRIENDLY_CHALLENGE': {
      const opponentName = action.opponentName.trim();
      const currency = action.currency;
      if (currency === 'BRO') {
        const prizeCents = Math.max(1, Math.round(action.prizeAmount * 100));
        const feeCents = friendlyChallengeBroFeeCents(prizeCents);
        const totalCents = prizeCents + feeCents;
        const escrow = state.finance.friendlyChallengeEscrowBroCents ?? 0;
        if (prizeCents > escrow) {
          return state;
        }
        let f = addBroCents(state.finance, totalCents);
        const out = Math.max(0, (f.broLifetimeOutCents ?? 0) - totalCents);
        f = {
          ...f,
          broLifetimeOutCents: out,
          companyTreasuryBroCents: Math.max(0, (f.companyTreasuryBroCents ?? 0) - feeCents),
          friendlyChallengeEscrowBroCents: Math.max(
            0,
            (f.friendlyChallengeEscrowBroCents ?? 0) - prizeCents,
          ),
        };
        f = syncWalletSpotBro(f);
        return {
          ...state,
          finance: f,
          inbox: [
            makeInboxItem(
              `amistoso-refund-${Date.now()}`,
              'FRIENDLY_CHALLENGE',
              'COMPETIÇÃO',
              `Desafio amistoso vs ${opponentName || 'adversário'}: devolução (BRO).`,
              {
                body: 'O convite expirou ou foi recusado/cancelado; prémio e taxa foram estornados ao saldo.',
                colorClass: 'text-gray-300',
              },
            ),
            ...state.inbox,
          ].slice(0, 14),
        };
      }
      const prizeExp = Math.max(1, Math.round(action.prizeAmount));
      const f = withExpHistory(addOle(state.finance, prizeExp), prizeExp, `Amistoso: estorno vs ${opponentName}`);
      return {
        ...state,
        finance: f,
        inbox: [
          makeInboxItem(
            `amistoso-refund-${Date.now()}`,
            'FRIENDLY_CHALLENGE',
            'COMPETIÇÃO',
            `Desafio amistoso vs ${opponentName || 'adversário'}: devolução (EXP).`,
            {
              body: 'O convite expirou ou foi recusado/cancelado; EXP retidos foram devolvidos.',
              colorClass: 'text-gray-300',
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
              deepLink: '/manager#rede-manager',
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
            deepLink: '/manager#rede-manager',
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
            { kind: 'news', deepLink: '/manager#rede-manager' },
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
    case 'INBOX_PREPEND': {
      const id = action.item.id;
      const rest = state.inbox.filter((i) => i.id !== id);
      return { ...state, inbox: [action.item, ...rest].slice(0, 50) };
    }
    case 'SET_USER_SETTINGS': {
      return {
        ...state,
        userSettings: { ...state.userSettings, ...action.partial },
      };
    }
    case 'GRANT_ONBOARDING_PACKAGE': {
      const players = { ...state.players, ...action.players };
      const playerSeasonLedger = sanitizePlayerSeasonLedger(
        state.playerSeasonLedger,
        new Set(Object.keys(players)),
      );
      const playerEvolutionTimeline = sanitizePlayerEvolutionTimeline(
        state.playerEvolutionTimeline,
        new Set(Object.keys(players)),
      );
      const lineup = { ...action.lineup };
      let formationScheme = state.manager.formationScheme;
      if (action.formationScheme && action.formationScheme in FORMATION_BASES) {
        formationScheme = action.formationScheme;
      }
      const finance =
        action.starterExpAmount > 0
          ? grantEarnedExp(state.finance, action.starterExpAmount)
          : state.finance;
      return {
        ...state,
        players,
        playerSeasonLedger,
        playerEvolutionTimeline,
        lineup,
        manager: { ...state.manager, formationScheme },
        finance,
        userSettings: {
          ...state.userSettings,
          welcomeGenesisPackVersion: action.welcomePackVersion,
        },
      };
    }
    case 'CLAIM_DAILY_BONUS': {
      return {
        ...state,
        userSettings: {
          ...state.userSettings,
          dailyBonus: {
            lastClaimMs: action.claimMs,
            streakDay: action.streakDay,
          },
        },
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
      const leagueSchedule = {
        ...state.leagueSchedule,
        byLeagueId: {
          ...state.leagueSchedule.byLeagueId,
          [action.league.id]: buildRoundRobinSchedule(action.league, state.club),
        },
      };
      return { ...state, adminLeagues: leagues, leagueSchedule };
    }
    case 'ADMIN_REMOVE_LEAGUE': {
      const next = state.adminLeagues.filter((l) => l.id !== action.id);
      let primary = state.adminPrimaryLeagueId;
      if (primary === action.id) primary = next[0]?.id ?? '';
      const { [action.id]: _removed, ...restBuckets } = state.leagueSchedule.byLeagueId;
      return {
        ...state,
        adminLeagues: next,
        adminPrimaryLeagueId: primary,
        leagueSchedule: { ...state.leagueSchedule, byLeagueId: restBuckets },
      };
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
        deepLink: '/manager',
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
            deepLink: '/manager#rede-manager',
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
    case 'SET_GLOBAL_LEAGUE_STATE': {
      return {
        ...state,
        globalLeague: action.payload,
      };
    }

    case 'SET_OLEFOOT_LEAGUE': {
      return {
        ...state,
        olefootLeague: action.payload,
      };
    }

    case 'FINALIZE_OLEFOOT_ROUND': {
      if (!state.olefootLeague) return state;
      const { finalizeRound } = require('@/match/olefootLeague');
      const updated = finalizeRound(state.olefootLeague, action.roundNumber, action.fixtures);
      return {
        ...state,
        olefootLeague: updated,
      };
    }

    case 'ADVANCE_OLEFOOT_ROUND': {
      if (!state.olefootLeague) return state;
      const { advanceToNextRound } = require('@/match/olefootLeague');
      const updated = advanceToNextRound(state.olefootLeague);
      return {
        ...state,
        olefootLeague: updated,
      };
    }

    case 'CREATE_GLOBAL_ROUND': {
      if (!state.olefootLeague) return state;
      const { createScheduledRound } = require('@/match/globalRoundScheduler');
      const newRound = createScheduledRound(state.olefootLeague, action.scheduledKickoffMs);
      return {
        ...state,
        globalLeague: {
          ...(state.globalLeague ?? { recentRounds: [], roundIntervalMs: 3600000, commandWindowMs: 600000 }),
          currentRound: newRound,
          nextScheduledMs: action.scheduledKickoffMs,
        },
      };
    }

    case 'START_COMMAND_WINDOW': {
      if (!state.globalLeague?.currentRound) return state;
      return {
        ...state,
        globalLeague: {
          ...state.globalLeague,
          currentRound: {
            ...state.globalLeague.currentRound,
            status: 'pre_match',
          },
        },
      };
    }

    case 'START_GLOBAL_ROUND': {
      if (!state.globalLeague?.currentRound) return state;
      const { simulateGlobalRound } = require('@/match/globalMatchSimulator');
      const kickoffMs = Date.now();
      const { updatedFixtures, allEvents, highlights } = simulateGlobalRound(
        state.globalLeague.currentRound.fixtures,
        kickoffMs
      );

      return {
        ...state,
        globalLeague: {
          ...state.globalLeague,
          currentRound: {
            ...state.globalLeague.currentRound,
            status: 'live',
            actualKickoffMs: kickoffMs,
            fixtures: updatedFixtures.map(f => ({
              ...f,
              status: 'live' as const,
              currentMinute: 0,
              scoreHome: 0,
              scoreAway: 0,
            })),
            highlights,
          },
        },
      };
    }

    case 'UPDATE_LIVE_ROUND': {
      if (!state.globalLeague?.currentRound || state.globalLeague.currentRound.status !== 'live') {
        return state;
      }
      const { GLOBAL_MATCH_CONSTANTS } = require('@/match/globalMatch');
      const currentRound = state.globalLeague.currentRound;
      const elapsed = action.nowMs - (currentRound.actualKickoffMs ?? 0);
      const currentMinute = Math.floor(elapsed / GLOBAL_MATCH_CONSTANTS.GAME_MINUTE_MS);

      const liveFixtures = currentRound.fixtures.map(f => {
        const revealedEvents = f.events.filter(e => e.minute <= currentMinute);
        const scoreHome = revealedEvents.filter(e => e.type === 'goal' && e.side === 'home').length;
        const scoreAway = revealedEvents.filter(e => e.type === 'goal' && e.side === 'away').length;

        return {
          ...f,
          currentMinute,
          scoreHome,
          scoreAway,
          status: 'live' as const,
        };
      });

      return {
        ...state,
        globalLeague: {
          ...state.globalLeague,
          currentRound: {
            ...currentRound,
            fixtures: liveFixtures,
          },
        },
      };
    }

    case 'FINISH_GLOBAL_ROUND': {
      if (!state.globalLeague?.currentRound || !state.olefootLeague) return state;
      const currentRound = state.globalLeague.currentRound;

      // Finalizar rodada
      const finishedRound = {
        ...currentRound,
        status: 'finished' as const,
        finishedAtMs: action.nowMs,
      };

      // Atualizar OLEFOOT LIGA com os resultados
      const { finalizeRound } = require('@/match/olefootLeague');
      const updatedLeague = finalizeRound(
        state.olefootLeague,
        currentRound.roundNumber,
        currentRound.fixtures
      );

      return {
        ...state,
        globalLeague: {
          ...state.globalLeague,
          currentRound: finishedRound,
        },
        olefootLeague: updatedLeague,
      };
    }

    case 'ADVANCE_GLOBAL_ROUND': {
      if (!state.globalLeague || !state.olefootLeague) return state;
      const { autoAdvanceRound } = require('@/match/globalRoundScheduler');
      const { globalLeague, olefootLeague } = autoAdvanceRound(
        state.globalLeague,
        state.olefootLeague,
        action.nowMs
      );

      return {
        ...state,
        globalLeague,
        olefootLeague,
      };
    }
    case 'UPDATE_COMPETITIVE_RANKING': {
      if (!action.isCompetitive) return state;

      const current = state.competitiveRanking ?? createInitialCompetitiveRanking();
      const updated = updateCompetitiveRanking(current, action.homeScore, action.awayScore);

      return {
        ...state,
        competitiveRanking: updated,
      };
    }
    case 'ADMIN_SET_MANAGER_PROSPECT_CONFIG': {
      const createCostExp = Math.max(0, Math.min(50_000_000, Math.round(action.createCostExp)));
      return {
        ...state,
        managerProspectConfig: { createCostExp },
      };
    }
    case 'ADMIN_MARK_PROSPECT_ART_FULFILLED': {
      const managerProspectArtQueue = (state.managerProspectArtQueue ?? []).map((r) =>
        r.id === action.requestId ? { ...r, playerCreationStep: 'launched' as const } : r,
      );
      return { ...state, managerProspectArtQueue };
    }
    case 'ADMIN_PATCH_PLAYER': {
      const pl = state.players[action.playerId];
      if (!pl) return state;
      const attrs =
        action.partial.attrs != null ? { ...pl.attrs, ...action.partial.attrs } : pl.attrs;
      const merged = { ...pl, ...action.partial, attrs };
      return {
        ...state,
        players: {
          ...state.players,
          [action.playerId]: clampPlayerToEvolutionCap(ensureMintOverall(merged)),
        },
      };
    }
    case 'ADMIN_PLAYER_CREATION_SET_PHOTO': {
      const url = action.portraitUrl.trim();
      if (!url.startsWith('data:image/') && !/^https?:\/\//i.test(url)) return state;
      const managerProspectArtQueue = (state.managerProspectArtQueue ?? []).map((r) => {
        if (r.id !== action.requestId) return r;
        if (r.playerCreationStep !== 'awaiting_photo' && r.playerCreationStep !== 'photo_uploaded') return r;
        return { ...r, draftPortraitUrl: url, playerCreationStep: 'photo_uploaded' as const };
      });
      return { ...state, managerProspectArtQueue };
    }
    case 'ADMIN_PLAYER_CREATION_VALIDATE': {
      const managerProspectArtQueue = (state.managerProspectArtQueue ?? []).map((r) => {
        if (r.id !== action.requestId) return r;
        if (r.playerCreationStep !== 'photo_uploaded' || !r.draftPortraitUrl?.trim()) return r;
        return { ...r, playerCreationStep: 'validated' as const };
      });
      return { ...state, managerProspectArtQueue };
    }
    case 'ADMIN_PLAYER_CREATION_APPROVE': {
      const managerProspectArtQueue = (state.managerProspectArtQueue ?? []).map((r) => {
        if (r.id !== action.requestId) return r;
        if (r.playerCreationStep !== 'validated') return r;
        return { ...r, playerCreationStep: 'approved' as const };
      });
      return { ...state, managerProspectArtQueue };
    }
    case 'ADMIN_PLAYER_CREATION_LAUNCH': {
      const q = state.managerProspectArtQueue ?? [];
      const req = q.find((r) => r.id === action.requestId);
      if (!req || req.playerCreationStep !== 'approved') return state;
      const draft = req.draftPortraitUrl?.trim();
      if (!draft) return state;
      const pl = state.players[req.playerId];
      if (!pl) return state;
      if (pl.listedOnMarket) return state;
      if (state.managerProspectMarket.ownListings.some((l) => l.playerId === req.playerId)) return state;

      const priceExp = Math.max(50_000, Math.min(5_000_000, Math.round(action.priceExp ?? 500_000)));
      const listingId = `lst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const listedAtIso = new Date().toISOString();

      const lineup = { ...state.lineup };
      for (const [slot, pid] of Object.entries(lineup)) {
        if (pid === req.playerId) delete lineup[slot];
      }

      const launchedPlayer = { ...pl, portraitUrl: draft, listedOnMarket: true as const };

      const managerProspectArtQueue = q.map((r) =>
        r.id === action.requestId
          ? {
              ...r,
              playerCreationStep: 'launched' as const,
              draftPortraitUrl: null,
              marketListingId: listingId,
              marketPriceExp: priceExp,
              marketListedAtIso: listedAtIso,
            }
          : r,
      );

      return {
        ...state,
        lineup,
        managerProspectArtQueue,
        players: { ...state.players, [req.playerId]: launchedPlayer },
        managerProspectMarket: {
          ...state.managerProspectMarket,
          ownListings: [
            { listingId, playerId: req.playerId, priceExp, listedAtIso },
            ...state.managerProspectMarket.ownListings,
          ],
        },
      };
    }
    case 'ADMIN_PATCH_NEXT_FIXTURE': {
      const prev = state.nextFixture;
      const p = action.partial;
      const mergedOpp =
        p.opponent && typeof p.opponent === 'object'
          ? normalizeOpponentStub({ ...prev.opponent, ...p.opponent })
          : prev.opponent;
      const nextFx = normalizeFixture({
        ...prev,
        ...p,
        opponent: mergedOpp,
      });
      return { ...state, nextFixture: nextFx };
    }
    case 'ADMIN_SET_SHOP_CATALOG': {
      const next = normalizeShopCatalog(action.items);
      return { ...state, shopCatalog: next.length ? next : defaultShopCatalog() };
    }
    case 'ADMIN_SET_UI_BANNER': {
      return {
        ...state,
        uiBanners: { ...state.uiBanners, [action.slot]: action.entry },
      };
    }
    case 'ADMIN_SET_PLAYER_LISTED': {
      const pl = state.players[action.playerId];
      if (!pl) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [action.playerId]: {
            ...pl,
            listedOnMarket: action.listed,
            ...(pl.adminMarketTag != null ? { adminMarketTag: pl.adminMarketTag } : {}),
          },
        },
      };
    }
    case 'ADMIN_SET_PLAYER_COLLECTION': {
      const pl = state.players[action.playerId];
      if (!pl) return state;
      const patched = action.collectionId
        ? { ...pl, adminMarketTag: action.collectionId }
        : { ...pl, adminMarketTag: undefined };
      return { ...state, players: { ...state.players, [action.playerId]: patched } };
    }
    case 'ADMIN_SET_COACH': {
      return { ...state, manager: { ...state.manager, coach: action.coach } };
    }
    case 'ADMIN_REMOVE_COACH': {
      return {
        ...state,
        manager: { ...state.manager, coach: createDefaultCoachAgent() },
      };
    }
    case 'ADMIN_GRANT_SHOP_ITEM': {
      const item = state.shopCatalog.find((x) => x.id === action.itemId);
      if (!item?.consumable) return state;
      const q = Math.max(1, Math.min(999, Math.round(action.qty)));
      const have = state.shopInventory[item.id] ?? 0;
      return {
        ...state,
        shopInventory: { ...state.shopInventory, [item.id]: Math.min(9999, have + q) },
      };
    }
    case 'SHOP_PURCHASE_ITEM': {
      const item = state.shopCatalog.find((x) => x.id === action.itemId);
      if (!item) return state;
      const canExp = item.priceExp != null && item.priceExp > 0;
      const canBro = item.priceBroCents != null && item.priceBroCents > 0;
      if (!canExp && !canBro) return state;
      const cur = action.currency;
      let payExp = false;
      let payBro = false;
      if (canExp && canBro) {
        if (cur !== 'exp' && cur !== 'bro') return state;
        payExp = cur === 'exp';
        payBro = cur === 'bro';
      } else if (canExp) payExp = true;
      else payBro = true;
      if (payExp && state.finance.ole < item.priceExp!) return state;
      if (payBro && state.finance.broCents < item.priceBroCents!) return state;

      let finance = state.finance;
      if (payExp) {
        finance = withExpHistory(addOle(finance, -item.priceExp!), -item.priceExp!, `Loja · ${item.title}`);
      }
      if (payBro) {
        finance = addBroCents(finance, -item.priceBroCents!);
        finance = syncWalletSpotBro(finance);
      }

      if (item.consumable) {
        const qty = state.shopInventory[item.id] ?? 0;
        return {
          ...state,
          finance,
          shopInventory: { ...state.shopInventory, [item.id]: Math.min(9999, qty + 1) },
          inbox: [
            makeInboxItem(
              `shop-buy-${Date.now()}`,
              'STAFF_ADVICE',
              'CLUBE',
              `Compra: ${item.title}`,
              {
                body: `**${item.title}** foi para o inventário. Usa em **Meu Time** ao abrir um jogador.`,
                advisorLabel: 'Loja',
                deepLink: '/team',
              },
            ),
            ...state.inbox,
          ].slice(0, 14),
        };
      }

      return {
        ...state,
        finance,
        inbox: [
          makeInboxItem(
            `shop-pack-${Date.now()}`,
            'STAFF_ADVICE',
            'CLUBE',
            `Pedido: ${item.title}`,
            {
              body: `**${item.title}** — entrega de pack em desenvolvimento; o pagamento foi registado.`,
              deepLink: '/store',
            },
          ),
          ...state.inbox,
        ].slice(0, 14),
      };
    }
    case 'CONSUME_SHOP_ITEM': {
      const item = state.shopCatalog.find((x) => x.id === action.itemId);
      if (!item?.consumable || !item.effect) return state;
      const have = state.shopInventory[item.id] ?? 0;
      if (have < 1) return state;
      if (shopEffectNeedsPlayer(item.effect) && !action.playerId) return state;
      if (action.playerId && !state.players[action.playerId]) return state;

      const eff = item.effect;
      let players = state.players;
      let crowd = state.crowd;
      let finance = state.finance;
      let managerProspectMarket = state.managerProspectMarket;

      switch (eff.kind) {
        case 'reset_squad_fatigue': {
          players = { ...players };
          for (const id of Object.keys(players)) {
            const p = players[id];
            if (p) players[id] = { ...p, fatigue: 0 };
          }
          break;
        }
        case 'reduce_player_injury': {
          const pid = action.playerId!;
          const p = players[pid];
          if (!p) return state;
          players = { ...players, [pid]: { ...p, outForMatches: Math.max(0, p.outForMatches - eff.matches) } };
          break;
        }
        case 'boost_crowd_support': {
          const sp = Math.min(99, Math.max(0, state.crowd.supportPercent + eff.deltaPercent));
          crowd = { supportPercent: sp, moodLabel: crowdMood(sp) };
          break;
        }
        case 'reduce_squad_injury_risk': {
          players = { ...players };
          for (const id of Object.keys(players)) {
            const p = players[id];
            if (p) players[id] = { ...p, injuryRisk: Math.max(0, p.injuryRisk - eff.delta) };
          }
          break;
        }
        case 'reduce_squad_fatigue': {
          players = { ...players };
          for (const id of Object.keys(players)) {
            const p = players[id];
            if (p) players[id] = { ...p, fatigue: Math.max(0, p.fatigue - eff.delta) };
          }
          break;
        }
        case 'refresh_npc_market': {
          managerProspectMarket = { ...managerProspectMarket, npcOffers: buildNpcOffersForShop(state) };
          break;
        }
        case 'grant_earned_exp': {
          finance = grantEarnedExp(finance, eff.amount);
          finance = withExpHistory(finance, eff.amount, `Booster · ${item.title}`);
          break;
        }
        default:
          return state;
      }

      const inv = { ...state.shopInventory };
      const nextQty = have - 1;
      if (nextQty <= 0) delete inv[item.id];
      else inv[item.id] = nextQty;

      return {
        ...state,
        players,
        crowd,
        finance,
        managerProspectMarket,
        shopInventory: inv,
        inbox: [
          makeInboxItem(
            `shop-use-${Date.now()}`,
            'STAFF_ADVICE',
            'CLUBE',
            `Booster: ${item.title}`,
            {
              body: `Ativaste **${item.title}** no teu clube.`,
              advisorLabel: 'Loja',
              deepLink: '/team',
            },
          ),
          ...state.inbox,
        ].slice(0, 14),
      };
    }
    case 'RESET_DAILY_CHALLENGES': {
      const todaySeed = getTodaySeed();
      const challenges = generateDailyChallenges(todaySeed);
      return {
        ...state,
        dailyChallenges: {
          challenges,
          lastResetDate: new Date().toISOString(),
          streak: 0,
        },
      };
    }
    case 'UPDATE_CHALLENGE_PROGRESS': {
      if (!state.dailyChallenges) return state;
      const challenges = updateChallengeProgress(
        state.dailyChallenges.challenges,
        action.challengeType,
        action.increment,
      );
      return {
        ...state,
        dailyChallenges: {
          ...state.dailyChallenges,
          challenges,
        },
      };
    }
    case 'CLAIM_CHALLENGE_REWARD': {
      if (!state.dailyChallenges) return state;
      const challenge = state.dailyChallenges.challenges.find((c) => c.id === action.challengeId);
      if (!challenge || !challenge.completed || challenge.claimed) return state;

      const challenges = state.dailyChallenges.challenges.map((c) =>
        c.id === action.challengeId ? { ...c, claimed: true } : c,
      );

      let finance = grantEarnedExp(state.finance, challenge.reward);
      finance = withExpHistory(finance, challenge.reward, `Desafio: ${challenge.title}`);

      const inbox = [
        makeInboxItem(
          `challenge-${Date.now()}`,
          'FINANCE_EXP_GAIN',
          'DESAFIOS',
          `+${challenge.reward} EXP — ${challenge.title}`,
          {
            body: `Completaste o desafio "${challenge.title}". Recompensa creditada.`,
            deepLink: '/wallet',
          },
        ),
        ...state.inbox,
      ].slice(0, 14);

      return {
        ...state,
        finance,
        inbox,
        dailyChallenges: {
          ...state.dailyChallenges,
          challenges,
        },
      };
    }
    case 'RESET':
      return createInitialGameState();

    // ============================================================================
    // Coach Agent Actions
    // ============================================================================

    case 'COACH_GENERATE_HEALTH_ACTIONS': {
      return mergeProactiveActions(state, generateProactiveHealthActions(state));
    }

    case 'COACH_GENERATE_TRAINING_ACTIONS': {
      return mergeProactiveActions(state, generateProactiveTrainingActions(state));
    }

    case 'COACH_GENERATE_TACTICAL_ACTIONS': {
      return mergeProactiveActions(state, generateProactiveTacticalActions(state, action.opponentContext));
    }

    case 'OLEFOOT_RECORD_MATCH': {
      const league = state.olefootRanked ?? createEmptyOlefootRankedState();
      const ratings = { ...league.ratings };

      const home = ratings[action.homeManagerId] ?? createDefaultEloRating(action.homeManagerId);
      const away = ratings[action.awayManagerId] ?? createDefaultEloRating(action.awayManagerId);
      const homeBefore = home.rating;
      const awayBefore = away.rating;

      const homeScore = scoreFromGoals(action.homeGoals, action.awayGoals);
      const elo = updateElo(homeBefore, awayBefore, homeScore);

      const isHomeWin = action.homeGoals > action.awayGoals;
      const isDraw = action.homeGoals === action.awayGoals;

      ratings[action.homeManagerId] = {
        ...home,
        rating: elo.newHome,
        matchesPlayed: home.matchesPlayed + 1,
        wins: home.wins + (isHomeWin ? 1 : 0),
        draws: home.draws + (isDraw ? 1 : 0),
        losses: home.losses + (!isHomeWin && !isDraw ? 1 : 0),
      };
      ratings[action.awayManagerId] = {
        ...away,
        rating: elo.newAway,
        matchesPlayed: away.matchesPlayed + 1,
        wins: away.wins + (!isHomeWin && !isDraw ? 1 : 0),
        draws: away.draws + (isDraw ? 1 : 0),
        losses: away.losses + (isHomeWin ? 1 : 0),
      };

      const record: OlefootMatchRecord = {
        matchId: action.matchId,
        homeManagerId: action.homeManagerId,
        awayManagerId: action.awayManagerId,
        homeManagerName: action.homeManagerName,
        awayManagerName: action.awayManagerName,
        homeGoals: action.homeGoals,
        awayGoals: action.awayGoals,
        finishedAt: Date.now(),
        homeRatingBefore: homeBefore,
        awayRatingBefore: awayBefore,
        homeRatingDelta: elo.deltaHome,
        awayRatingDelta: elo.deltaAway,
      };
      const recentMatches = [record, ...league.recentMatches].slice(
        0,
        OLEFOOT_LEAGUE_CONSTANTS.RECENT_MATCHES_CAP,
      );

      const homeResult: MatchResult = isHomeWin ? 'win' : isDraw ? 'draw' : 'loss';
      const awayResult: MatchResult = isHomeWin ? 'loss' : isDraw ? 'draw' : 'win';
      const playerMoral = applyMoralToPlayers(
        state.playerMoral,
        action.homePlayerIds,
        homeResult,
        action.awayPlayerIds,
        awayResult,
      );

      const leaderboard = recomputeLeaderboard(ratings, recentMatches, {
        [action.homeManagerId]: action.homeManagerName,
        [action.awayManagerId]: action.awayManagerName,
      });

      const olefootRanked: OlefootRankedState = {
        ratings,
        leaderboard,
        recentMatches,
      };

      return { ...state, olefootRanked, playerMoral };
    }

    case 'COACH_GENERATE_BRIEFING': {
      if (!state.manager.coach) return state;
      const msg = buildPreMatchBriefing(state, action.opponentContext);
      if (!msg) return state;
      return {
        ...state,
        manager: {
          ...state.manager,
          coach: {
            ...state.manager.coach,
            conversationContext: [...state.manager.coach.conversationContext, msg].slice(-50),
          },
        },
      };
    }

    case 'CONSUME_SHOP_BOOSTER': {
      const item = findShopItem(state.shopCatalog, action.itemId);
      if (!item || !item.consumable || !item.effect) return state;
      const inv = { ...state.shopInventory };
      if ((inv[item.id] ?? 0) <= 0) return state;
      inv[item.id] = inv[item.id] - 1;
      if (inv[item.id] <= 0) delete inv[item.id];

      let playerHealth = state.playerHealth;
      switch (item.effect.kind) {
        case 'reset_squad_fatigue': {
          const next: typeof playerHealth = {};
          for (const [pid, h] of Object.entries(playerHealth)) {
            next[pid] = applyHealthEffect(h, { kind: 'reset_fatigue' });
          }
          playerHealth = next;
          break;
        }
        case 'reduce_player_injury': {
          const target = action.targetPlayerId;
          if (!target || !playerHealth[target]) return state;
          const matches = (item.effect as { matches?: number }).matches ?? 1;
          const cur = playerHealth[target];
          playerHealth = {
            ...playerHealth,
            [target]: {
              ...cur,
              outForMatches: Math.max(0, cur.outForMatches - matches),
            },
          };
          break;
        }
        default:
          return state;
      }
      return { ...state, shopInventory: inv, playerHealth };
    }

    case 'COACH_ADD_PENDING_ACTION': {
      if (!state.manager.coach) return state;
      return {
        ...state,
        manager: {
          ...state.manager,
          coach: {
            ...state.manager.coach,
            pendingActions: [...state.manager.coach.pendingActions, action.action],
          },
        },
      };
    }

    case 'COACH_APPROVE_ACTION': {
      if (!state.manager.coach) return state;
      const target = state.manager.coach.pendingActions.find((a) => a.id === action.actionId);
      const decisionHistory = target
        ? [
            ...state.manager.coach.memory.decisionHistory,
            {
              timestamp: Date.now(),
              type: mapActionTypeToDecisionType(target.type),
              context: target.title,
              action: target.description,
              reasoning: target.reasoning,
              managerApproved: true,
            },
          ].slice(-100)
        : state.manager.coach.memory.decisionHistory;
      return {
        ...state,
        manager: {
          ...state.manager,
          coach: {
            ...state.manager.coach,
            pendingActions: state.manager.coach.pendingActions.map((a) =>
              a.id === action.actionId ? { ...a, status: 'approved' as const } : a
            ),
            memory: { ...state.manager.coach.memory, decisionHistory },
          },
        },
      };
    }

    case 'COACH_REJECT_ACTION': {
      if (!state.manager.coach) return state;
      const target = state.manager.coach.pendingActions.find((a) => a.id === action.actionId);
      const decisionHistory = target
        ? [
            ...state.manager.coach.memory.decisionHistory,
            {
              timestamp: Date.now(),
              type: mapActionTypeToDecisionType(target.type),
              context: target.title,
              action: target.description,
              reasoning: target.reasoning,
              managerApproved: false,
              outcome: 'Rejeitada pelo manager',
            },
          ].slice(-100)
        : state.manager.coach.memory.decisionHistory;
      return {
        ...state,
        manager: {
          ...state.manager,
          coach: {
            ...state.manager.coach,
            pendingActions: state.manager.coach.pendingActions.map((a) =>
              a.id === action.actionId ? { ...a, status: 'rejected' as const } : a
            ),
            memory: { ...state.manager.coach.memory, decisionHistory },
          },
        },
      };
    }

    case 'COACH_ADD_MESSAGE': {
      if (!state.manager.coach) return state;
      return {
        ...state,
        manager: {
          ...state.manager,
          coach: {
            ...state.manager.coach,
            conversationContext: [
              ...state.manager.coach.conversationContext,
              action.message,
            ].slice(-50), // Mantém últimas 50 mensagens
          },
        },
      };
    }

    case 'COACH_ADD_INSTRUCTION': {
      if (!state.manager.coach) return state;
      const text = action.instruction.trim();
      if (text.length === 0) return state;
      const next = {
        timestamp: Date.now(),
        instruction: text,
        context: action.context ?? 'Treinamento manual via Admin',
        priority: action.priority ?? 'medium',
        active: true,
        category: action.category ?? 'general',
      };
      return {
        ...state,
        manager: {
          ...state.manager,
          coach: {
            ...state.manager.coach,
            memory: {
              ...state.manager.coach.memory,
              managerInstructions: [
                ...state.manager.coach.memory.managerInstructions,
                next,
              ].slice(-200),
            },
          },
        },
      };
    }

    case 'COACH_TOGGLE_INSTRUCTION': {
      if (!state.manager.coach) return state;
      const list = state.manager.coach.memory.managerInstructions;
      if (action.index < 0 || action.index >= list.length) return state;
      const updated = list.map((it, i) => (i === action.index ? { ...it, active: action.active } : it));
      return {
        ...state,
        manager: {
          ...state.manager,
          coach: {
            ...state.manager.coach,
            memory: { ...state.manager.coach.memory, managerInstructions: updated },
          },
        },
      };
    }

    case 'COACH_REMOVE_INSTRUCTION': {
      if (!state.manager.coach) return state;
      const list = state.manager.coach.memory.managerInstructions;
      if (action.index < 0 || action.index >= list.length) return state;
      const updated = list.filter((_, i) => i !== action.index);
      return {
        ...state,
        manager: {
          ...state.manager,
          coach: {
            ...state.manager.coach,
            memory: { ...state.manager.coach.memory, managerInstructions: updated },
          },
        },
      };
    }

    case 'COACH_EXECUTE_ACTION': {
      if (!state.manager.coach) return state;

      const coachAction = state.manager.coach.pendingActions.find((a) => a.id === action.actionId);
      if (!coachAction || coachAction.status !== 'approved') return state;

      let newState = applyCoachActionEffects(state, coachAction);

      // upgrade_staff/assign_staff não fazem parte do helper de saúde — preservar.
      if (coachAction.type === 'upgrade_staff') {
        const data = coachAction.data as any;
        const result = tryUpgradeStaffRole(newState.manager.staff, newState.finance, data.roleId);
        if (result.ok) {
          newState = {
            ...newState,
            finance: result.finance,
            manager: { ...newState.manager, staff: result.staff },
          };
        }
      } else if (coachAction.type === 'assign_staff') {
        const data = coachAction.data as any;
        newState = {
          ...newState,
          manager: {
            ...newState.manager,
            staff: {
              ...newState.manager.staff,
              assignedByPlayer: {
                ...newState.manager.staff.assignedByPlayer,
                [data.playerId]: data.roleIds,
              },
            },
          },
        };
      }

      // Marca ação como executada
      return {
        ...newState,
        manager: {
          ...newState.manager,
          coach: {
            ...newState.manager.coach!,
            pendingActions: newState.manager.coach!.pendingActions.map((a) =>
              a.id === action.actionId ? { ...a, status: 'executed' as const } : a
            ),
          },
        },
      };
    }

    case 'COACH_CLEAR_EXECUTED_ACTIONS': {
      if (!state.manager.coach) return state;
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;
      return {
        ...state,
        manager: {
          ...state.manager,
          coach: {
            ...state.manager.coach,
            pendingActions: state.manager.coach.pendingActions.filter(
              (a) =>
                a.status === 'pending' ||
                a.status === 'approved' ||
                a.createdAt > oneHourAgo
            ),
          },
        },
      };
    }

    // Global League MVP Actions
    case 'HYDRATE_GLOBAL_LEAGUE_MVP':
      return { ...state, globalLeagueMVP: action.payload };

    case 'INIT_GLOBAL_LEAGUE_MVP':
      return handleInitGlobalLeagueMVP(state);

    case 'REGISTER_GLOBAL_TEAM':
      return handleRegisterGlobalTeam(
        state,
        action.managerId,
        action.clubName,
        action.clubShort,
        action.overall
      );

    case 'ADMIN_START_GLOBAL_PLAYOFFS':
      return handleAdminStartGlobalPlayoffs(state);

    case 'START_GLOBAL_PLAYOFF_ROUND':
      return handleStartGlobalPlayoffRound(state, action.roundNumber);

    case 'FINISH_GLOBAL_PLAYOFF_ROUND':
      return handleFinishGlobalPlayoffRound(state, action.roundNumber, action.finishedFixtures);

    case 'START_GLOBAL_LEAGUE_ROUND':
      return handleStartGlobalLeagueRound(state, action.roundNumber);

    case 'FINISH_GLOBAL_LEAGUE_ROUND':
      return handleFinishGlobalLeagueRound(state, action.roundNumber, action.finishedFixtures);

    case 'APPLY_GLOBAL_PROMOTION_RELEGATION':
      return handleApplyPromotionRelegation(state);

    case 'RESET_GLOBAL_LEAGUE_MVP':
      return handleResetGlobalLeagueMVP(state);

    default:
      return state;
  }
}
