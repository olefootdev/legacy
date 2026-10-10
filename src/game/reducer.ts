/**
 * 🚀 HEY HACKER 👋
 *
 * I know you understand much more than me about game development.
 * If you find this message, it's because I'm not an expert — just one
 * football lover trying to launch a game to back us to the best moment
 * of our lives.
 *
 * Please, contact me to share vulnerabilities.
 * We are open and truly believe in the power of community.
 *
 * I created this game by myself using AI tools just to share my IDEA
 * as a nice MVP. Let's Play Together! ⚽
 *
 * 📧 Contact: contact@olefoot.ai
 */

import { L, LOCALE } from '@/i18n/L';
import { pitchPlayersFromLineup, roleFromPos } from '@/engine/pitchFromLineup';
import { runMatchMinute } from '@/engine/runMatchMinute';
import { advanceMatchToPostgame } from '@/engine/matchBulk';
import { applySubstitution } from '@/engine/substitution';
import { applyRedCardAutoSub } from '@/engine/redCardAutoSub';
import type { GameAction, ManagerProspectArtRequest, OlefootGameState } from './types';
import { createInitialGameState, defaultLiveMatchShell } from './initialState';
import { rehydrateGameState } from './persistence';
import { awayStartingElevenFromSquad, buildDefaultLineup, mergeLineupWithDefaults } from '@/entities/lineup';
import { buildFatigueByIdMap } from '@/systems/fatigue';
import { normalizeFixture, normalizeOpponentStub } from '@/entities/team';
import { createPlayer, overallFromAttributes, samePersonKey } from '@/entities/player';
import type { PlayerEntity } from '@/entities/types';
import {
  buildManagerCreatedPlayerEntity,
  buildNpcManagerProspectSnapshot,
  buildProspectAdminArtPrompt,
  countActiveAcademyProspects,
  DEFAULT_MANAGER_PROSPECT_CREATE_COST_EXP,
  isValidManagerHeritage,
  MANAGER_PROSPECT_CREATE_MAX_OVR,
  
  MAX_ACTIVE_ACADEMY_PROSPECTS,
  
  type ManagerProspectHeritageBrief } from '@/entities/managerProspect';
import {
  applyMatchPerformanceEvolution,
  clampPlayerToEvolutionCap,
  ensureMintOverall,
} from '@/entities/playerEvolution';
import { validateAcademyProspectName } from '@/entities/managerProspectReservedNames';
import { addBroCents, addOle,  grantEarnedExp } from '@/systems/economy';
import { JANELA_ELENCO_MINIMO, valorNaVarzea } from '@/onboarding/janelaEstreia';
import { tripKmForFixture, applyTravelFatigueToSquad } from '@/systems/logistics';
import { updateStreak } from './quickMatchStreak';
import {
  generateDailyChallenges,
  getTodaySeed,
  shouldResetDailyChallenges,
  updateChallengeProgress,
} from './dailyChallenges';
import { INJURY_LABEL_PT, tickRecoveryMatches } from '@/systems/injury';
import {
  applyMatchConsequences as applyHealthConsequences,
  healthFromLegacyPlayer,
  tickHealthRecovery,
} from '@/systems/playerHealth/reducer';
import { liveMatchToHealthEvents } from '@/systems/playerHealth/fromLiveMatch';
import { quickPlanToConsequenceEvents } from '@/systems/playerHealth/fromQuickPlan';
import { financeWithLedger } from '@/wallet/gameLedger';
import { addManagerScore } from '@/systems/managerScore/managerScore';
import { styleAttrWeights, applyStyleTrainingBias } from '@/tactics/styleAttrWeights';
// OLEFOOT PYTHON MODE — wire-up dos sistemas A + E
import {
  EMPTY_CONSEQUENCE_STORE,
  addManyConsequences,
  tickConsequences,
} from '@/systems/consequences/store';
import {
  eventsFromMatchSummary,
  materializeBatch,
} from '@/systems/consequences/handlers';
import { buildImpactSummary } from '@/systems/consequences/fromLiveMatch';
import {
  derivePersonality,
  detectPlayerRequest,
  resolveRequest,
} from '@/systems/playerPersonality';
import { buildGlobalImpactSummary } from '@/systems/consequences/fromGlobalFixture';
import { recordCheckIn } from '@/systems/engagement/checkIn';
import { evaluateAbsence } from '@/systems/engagement/absencePenalty';
import { attemptClaim } from '@/systems/engagement/loginBonus';
import { computeEngagementScore } from '@/systems/engagement/engagementScore';
import {
  shouldApplyAbsenceEffects,
  buildAbsenceSideEffects,
} from '@/systems/engagement/absenceEffects';
import { applyHealthEffect } from '@/systems/playerHealth/reducer';
import { generateProactiveHealthActions } from '@/coach/proactiveHealthActions';
import { applyMatchResultToMoral, createDefaultMoral, updateFormStreak } from '@/systems/playerMoral/types';
import type { PlayerMoral } from '@/systems/playerMoral/types';
import { createDefaultCoachAgent } from '@/coach/defaultCoach';
import { applyWorldCatchUp } from './worldCatchUp';
import { mergeWalletIntoFinance } from './financeWalletSync';
import type { MatchEventEntry } from '@/engine/types';
import { computeMatchMvp, finalizeScoutTallies } from '@/gamespirit/scoutScoring';
import { clearNarrativeHistory } from '@/gamespirit/narrativeVariation';
import {
  ledgerTouchMarketAfterMatch,
  marketBroSnapshotFromPlayers,
  mergeLedgerAfterMatch,
  
  mergeLedgerAfterTrainingPlan,
  sanitizePlayerSeasonLedger } from '@/team/playerSeasonLedger';
import {
  appendEvolutionTimelinePoints,
  sanitizePlayerEvolutionTimeline,
} from '@/team/playerEvolutionTimeline';
import {
  applyHomeContractsAfterMatch,
  contractFieldsForManagerProspectTier,
  decrementContractsForIds,
  genesisListingPriceExpFromMintOverall,
  managerProspectContractPremiumExp,
} from '@/playerContracts/playerContracts';
import type { ManagerProspectContractGames } from '@/playerContracts/playerContracts';
import { tryUpgradeStructure } from '@/clubStructures/upgrade';
import { DEFAULT_BRO_PRICES_CENTS } from '@/clubStructures/broDefaults';
import { STRUCTURE_LABELS, LEDGER_REASON_EXP, LEDGER_REASON_BRO } from '@/clubStructures/types';
import {
  effectiveCrowdSupportPercent,
  
  medicalDeptTreatmentSlots,
  structureMatchExpBonuses,
  trainingCenterAttributeGainMultiplier,
  trainingCenterMaxConcurrentCollectivePlans,
  youthAcademyProspectTrainingMultiplier } from '@/clubStructures/benefits';
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
import { computeQuickPlanCredit } from '@/match/quickEngaged/creditQuickPlan';
import { advanceLigaOle, ligaOleRoundReward, dinastiaMultiplier, managerOpponent } from '@/match/ligaOle/ligaOleModel';
import {
  applyMatchResult as applyLegendsCupResult,
  legendsCupPhaseExp,
  roundOf as legendsCupRoundOf,
} from '@/match/legendsCup/legendsCupModel';
import {
  
  
  
  CITY_QUICK_STORE_COST_EXP,
  CITY_QUICK_STORE_CROWD_DELTA,
  
  
  STADIUM_UPGRADE_CROWD_DELTA } from './cityQuickConstants';
import { createInitialWalletState } from '@/wallet/initial';
import { createInitialCompetitiveRanking, updateCompetitiveRanking } from './competitiveRanking';
import {
  handleInitGlobalLeagueMVP,
  handleRegisterGlobalTeam,
  handleAdminStartGlobalPlayoffs,
  handleStartGlobalPlayoffRound,
  handleFinishGlobalPlayoffRound,
  
  
  
  handleResetGlobalLeagueMVP } from './globalLeagueMVPReducer';
import { registerSponsor as walletRegisterSponsor } from '@/wallet/referral';
// Imports estáticos — substituem chamadas legadas de require() que quebravam
// no browser ("require is not defined") quando os reducers eram acionados.
import { registerTeam } from '@/match/globalLeagueMVP';
import {
  milestoneExpReward,
  milestoneInboxBody,
  milestoneInboxTitle,
  milestoneLabel,
  parseMilestoneId,
} from '@/match/globalLeagueMilestones';
import {
  applyResultToLocalLeague,
  emptyLocalLeaguesState,
} from '@/match/localLeagues';
import { finalizeRound } from '@/match/olefootLeague';
import { createScheduledRound, autoAdvanceRound } from '@/match/globalRoundScheduler';
import { simulateGlobalRound } from '@/match/globalMatchSimulator';
import { GLOBAL_MATCH_CONSTANTS } from '@/match/globalMatch';
import { STYLE_PRESETS } from '@/tactics/playingStyle';
import { applyResultToLeagueSeason } from '@/match/leagueSeason';
import { buildRoundRobinSchedule } from '@/match/leagueSchedule';
import { evaluateOfficialSquad } from '@/match/squadEligibility';
import { selectEffectiveTeamStrength } from '@/match/availabilityReport';
import { computeMatchContextModifiers } from '@/match/contextFactors';
import { applyQuickMatchToDna } from '@/systems/clubDna';
import { addRenown } from '@/systems/renown';
import { applyQuickScars } from '@/systems/scars';
import { isoWeekKey, activeDecreeOption } from '@/systems/weeklyDecree';
import { buildRoundChronicle } from '@/match/ligaOle/ligaOleChronicle';
import { nemesisIsDerby } from '@/match/rivalDerby';
import { addHoursIso, applyTrainingToPlayer, durationGainMultiplier, maxSlotsByTrainingCenter, resolveGroupPlayerIds, splitDuePlans } from '@/systems/trainingPlans';
import {
  STAFF_LABELS,
  amplifyTrainingResult,
  applyNutritionRecovery,
  maxStaffSlotsByLevel,
  
  trainingGainMultiplier,
  tryUpgradeStaffRole } from '@/systems/staff';
import {
  nutritionPostMatchFatigueRecoveryBonus,
  npcProspectBasePriceExp,
  npcProspectPriceAfterScoutDiscount,
  staffRunMatchMinuteEffects,
} from '@/systems/staffBenefits';
import { hashStringSeed } from '@/match/seededRng';
import { FORMATION_BASES } from '@/match-engine/formations/catalog';
import { appendMemorableTrophyUnlocks } from '@/trophies/memorableCatalog';
import { diffNewMemorableTrophyIds, memorableTrophyFinanceReward } from '@/trophies/memorablePrizes';
import {
  advancePenaltyStage,
  
  penaltyNarrativeLine,
  penaltyOverlayForStage,
  rollPenaltyOutcome } from '@/gamespirit/spiritStateMachine';
import {
  appendGoalScorerHome,
  appendTeamGoalConcededHome,
  appendTeamGoalScoredHome,
} from '@/match/impactLedger';
import type { FormationSchemeId } from '@/match-engine/types';
import {  finalizeMatch, persistPlayers, persistPlayerGoals } from '@/supabase/matchPersistence';
import { pushValueSnapshots } from '@/market/marketLiveClient';
import { makeInboxItem } from './inboxItem';
import { buildPostMatchStaffInboxItem } from './postMatchStaffInbox';
import { defaultShopCatalog, findShopItem, normalizeShopCatalog, shopEffectNeedsPlayer } from './shopCatalog';

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Promove a partida para postgame e limpa overlays/pendências que ficariam
 * "vivos" depois do apito (overlay de gol, modal de pênalti, momento interativo,
 * substituição por lesão pendente, corner/falta agendados).
 *
 * Sem esse cleanup a tela de pós-jogo abre por baixo do overlay residual e o
 * usuário não vê — ou continua narrando ações depois do fim.
 */
function promoteToPostgame(
  liveMatch: import('@/engine/types').LiveMatchSnapshot,
  opts: { whistleText?: string; minute?: number } = {},
): import('@/engine/types').LiveMatchSnapshot {
  const minute = opts.minute ?? Math.max(liveMatch.minute, 90);
  const whistle: MatchEventEntry = {
    id: uid(),
    minute,
    text: opts.whistleText ?? L(`${minute}' — Apito final.`, `${minute}' — Full time.`),
    kind: 'whistle',
  };
  return {
    ...liveMatch,
    phase: 'postgame',
    events: [whistle, ...liveMatch.events],
    spiritOverlay: null,
    penalty: null,
    activeInteractiveMoment: null,
    quickInjurySub: null,
    preGoalHint: null,
    pendingCornerForSide: null,
    pendingFreeKickForSide: null,
  };
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
  const fatigueById = buildFatigueByIdMap(state.players, state.playerHealth);
  const lu = mergeLineupWithDefaults(state.lineup, state.players, { fatigueById });
  const ids = new Set<string>(Object.values(lu));
  return Array.from(ids)
    .map((id) => state.players[id])
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
}

function crowdMood(support: number): string {
  if (support < 40) return L('Cética', 'Sceptical');
  if (support < 62) return L('Expectante', 'Expectant');
  if (support < 82) return L('Confiante', 'Confident');
  return L('Euforia', 'Euphoric');
}

function buildNpcOffersForShop(state: OlefootGameState) {
  const seed = `${state.club.id}:${Date.now()}`;
  const ol = state.manager.staff.roles.olheiro ?? 1;
  return [0, 1, 2, 3].map((i) => {
    const snapshot = buildNpcManagerProspectSnapshot(seed, i, ol);
    const ovr = overallFromAttributes(snapshot.attrs, snapshot.pos);
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

  // Fase 3 — fatores contextuais consumidos por GameSpirit dentro do tick.
  // Cobre mando, desfalques, descanso real (via SSOT playerHealth.lastMatchAt).
  const effectiveStrength = selectEffectiveTeamStrength({
    players: state.players, health: state.playerHealth,
  });
  let daysSinceLastMatch: number | undefined;
  if (state.playerHealth) {
    let mostRecent = 0;
    for (const h of Object.values(state.playerHealth)) {
      if (h.lastMatchAt && h.lastMatchAt > mostRecent) mostRecent = h.lastMatchAt;
    }
    if (mostRecent > 0) {
      daysSinceLastMatch = (Date.now() - mostRecent) / (1000 * 60 * 60 * 24);
    }
  }
  const contextModifiers = effectiveStrength.startersCounted > 0
    ? computeMatchContextModifiers({
        isHome: state.nextFixture.isHome,
        daysSinceLastMatch,
        effectiveTeamStrength: effectiveStrength,
        // FABLE — nêmesis/rivalidade acende o derby (maquinário já existia).
        isDerby: nemesisIsDerby({
          opponentId: state.nextFixture.opponent?.id,
          ligaOleNemesisId: state.ligaOleNemesis?.id,
        }),
        decree: activeDecreeOption(state.weeklyDecree, Date.now()),
      })
    : undefined;

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
    clubDnaAxis: state.clubDna?.axis,
    staffMatchEffects: staffRunMatchMinuteEffects(state.manager.staff),
    tacticalIntensity: state.quickMatchIntensity?.current,
    contextModifiers,
  });
  let liveMatch = snapshot;
  const players = { ...state.players, ...updatedPlayers };
  const inbox = newInboxItems && newInboxItems.length > 0
    ? [...newInboxItems, ...state.inbox]
    : state.inbox;
  if (liveMatch.minute >= 90 && liveMatch.phase === 'playing') {
    liveMatch = promoteToPostgame(liveMatch);
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


export function gameReducer(state: OlefootGameState, action: GameAction): OlefootGameState {
  switch (action.type) {
    case 'APPLY_MATCH_CONSEQUENCES': {
      if (!action.events.length) return state;
      const { next } = applyHealthConsequences(state.playerHealth, action.events);
      return { ...state, playerHealth: next };
    }
    case 'TICK_HEALTH_RECOVERY': {
      const medicalLevel = state.structures?.medical_dept ?? 1;
      const medicalBonusPct = (medicalLevel - 1) * 10; // cada nível = +10% recuperação
      const next = tickHealthRecovery(state.playerHealth, { medicalBonusPct });
      return { ...state, playerHealth: next };
    }
    case 'APPLY_GLOBAL_ROUND_MORAL': {
      const playerMoral = { ...(state.playerMoral ?? {}) };
      for (const pid of action.playerIds) {
        const prev = playerMoral[pid] ?? createDefaultMoral(pid);
        playerMoral[pid] = applyMatchResultToMoral(prev, action.result);
      }
      return { ...state, playerMoral };
    }
    case 'UPDATE_PLAYER_FORM_STREAK': {
      const playerMoral = { ...(state.playerMoral ?? {}) };
      for (const { playerId, good } of action.updates) {
        const prev = playerMoral[playerId] ?? createDefaultMoral(playerId);
        playerMoral[playerId] = updateFormStreak(prev, good);
      }
      return { ...state, playerMoral };
    }
    case 'PUSH_INBOX_ITEMS': {
      if (!action.items.length) return state;
      const inbox = [...action.items, ...state.inbox].slice(0, 24);
      return { ...state, inbox };
    }
    case 'SET_EMERGENCY_TRANSFER_OFFER': {
      const current = state.emergencyTransferOffers ?? [];
      if (current.length >= 3) return state; // max 3 na fila
      return { ...state, emergencyTransferOffers: [...current, action.offer] };
    }
    case 'DISMISS_EMERGENCY_TRANSFER': {
      const current = state.emergencyTransferOffers ?? [];
      if (current.length <= 1) return { ...state, emergencyTransferOffers: [] };
      return { ...state, emergencyTransferOffers: current.slice(1) };
    }
    case 'SET_LAST_PROCESSED_GLOBAL_ROUND': {
      return { ...state, lastProcessedGlobalRound: action.roundKey };
    }
    case 'SET_LINEUP': {
      // Regra: nunca dois jogadores da MESMA PESSOA escalados juntos (pode ter
      // duas raridades/fases no elenco, mas só uma titular). Dedup defensivo —
      // mantém o primeiro slot de cada pessoa, descarta repetições.
      const lineup: Record<string, string> = {};
      const seenPersons = new Set<string>();
      for (const [slotId, playerId] of Object.entries(action.lineup)) {
        const pl = state.players[playerId];
        const key = pl ? samePersonKey(pl) : `id:${playerId}`;
        if (seenPersons.has(key)) continue;
        seenPersons.add(key);
        lineup[slotId] = playerId;
      }
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

      // Identifica preferência de visualização para o modo Legacy
      const viewPreference = (action as any).viewPreference ?? 'expert'; 
      const isLegacy = action.mode === 'auto' || action.mode === 'quick';

      const squadCheck = evaluateOfficialSquad(st.lineup, st.players);
      const skipSquadGateForQuickTest =
        action.mode === 'quick';
      if (!squadCheck.ok && !skipSquadGateForQuickTest) {
        const inboxWithoutDup = st.inbox.filter((i) => i.id !== 'lineup-requirement-live-match');
        const lineupNote = makeInboxItem(
          'lineup-requirement-live-match',
          'LINEUP_ISSUE',
          'PLANTEL',
          L('Não podes entrar em campo — plantel incompleto', "You can't take the pitch — squad incomplete"),
          {
            body: L(
              `${squadCheck.reason ?? 'Requisitos não cumpridos.'} São necessários 11 titulares disponíveis (sem lesão/suspensão) e pelo menos 5 jogadores no banco. Reforça o plantel ou ajusta a escalação.`,
              `${squadCheck.reason ?? 'Requirements not met.'} You need 11 available starters (no injuries/suspensions) and at least 5 players on the bench. Strengthen the squad or adjust the lineup.`,
            ),
            deepLink: '/team',
          },
        );
        return { ...st, inbox: [lineupNote, ...inboxWithoutDup].slice(0, 24) };
      }
      const fatigueById = buildFatigueByIdMap(st.players, st.playerHealth);
      const lu = mergeLineupWithDefaults(st.lineup, st.players, { fatigueById });
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
      
      liveMatch = { ...liveMatch, viewPreference } as any;
      liveMatch = { ...liveMatch, mode: action.mode };
      if (typeof action.simulationSeed === 'number' && Number.isFinite(action.simulationSeed)) {
        liveMatch = { ...liveMatch, simulationSeed: Math.floor(action.simulationSeed) };
      }

      if (action.mode === 'auto') {
        liveMatch = { ...liveMatch, phase: 'playing' };
        const roster = homeRosterFromLineup({ ...st, players });
        // Fase 3 — modificadores aplicados no Auto também
        const autoEffective = selectEffectiveTeamStrength({ players, health: st.playerHealth });
        const autoMods = autoEffective.startersCounted > 0
          ? computeMatchContextModifiers({
              isHome: st.nextFixture.isHome,
              effectiveTeamStrength: autoEffective,
              isDerby: nemesisIsDerby({
                opponentId: st.nextFixture.opponent?.id,
                ligaOleNemesisId: st.ligaOleNemesis?.id,
              }),
              decree: activeDecreeOption(st.weeklyDecree, Date.now()),
            })
          : undefined;
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
          clubDnaAxis: st.clubDna?.axis,
          staffMatchEffects: staffRunMatchMinuteEffects(st.manager.staff),
          contextModifiers: autoMods,
        });
        players = { ...players, ...updatedPlayers };
        liveMatch = snapshot;
        
        // Se for Expert View no modo Auto, injetamos uma flag para o Ticker de Tensão
        if (viewPreference === 'expert') {
           (liveMatch as any).useLegacyTicker = true;
        }
      } 
      else if (action.mode === 'quick') {
        const kickLabel = L('(partida rápida)', '(quick match)');
        const kick: MatchEventEntry = {
          id: uid(),
          minute: 0,
          text: `0' — ${st.club.shortName} x ${st.nextFixture.opponent.shortName} ${kickLabel}.`,
          kind: 'whistle',
        };
        const opp = st.nextFixture.opponent;
        const genesisAway = opp.genesisAwayPlayers;
        let awayRoster: NonNullable<import('@/engine/types').LiveMatchSnapshot['awayRoster']>;

        if (genesisAway?.length) {
          const starters = awayStartingElevenFromSquad(genesisAway);
          awayRoster = starters.map((p) => ({ id: p.id, num: p.num, name: p.name, pos: p.pos }));
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

    case 'SET_NARRATIVE_ARC': {
      if (!state.liveMatch) return state;
      return {
        ...state,
        liveMatch: { ...state.liveMatch, narrativeArc: action.arc },
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
    case 'CLAIM_STREAK_CHALLENGE_REWARD': {
      if (!state.streakChallenges) return state;
      const challenge = state.streakChallenges.challenges.find((c) => c.id === action.challengeId);
      if (!challenge || !challenge.completed || challenge.claimed) return state;

      // ole e exp aqui são nomenclatura legada — ambos vão pro mesmo saldo (finance.ole === expBalance).
      const totalReward = challenge.reward.ole + challenge.reward.exp;
      let finance = grantEarnedExp(state.finance, totalReward);
      finance = withExpHistory(finance, totalReward, L(`Desafio semanal: ${challenge.name}`, `Weekly challenge: ${challenge.name}`));

      const challenges = state.streakChallenges.challenges.map((c) =>
        c.id === action.challengeId ? { ...c, claimed: true } : c,
      );

      const inbox = [
        makeInboxItem(
          `streak-challenge-${Date.now()}`,
          'FINANCE_EXP_GAIN',
          'DESAFIOS',
          `+${totalReward} EXP — ${challenge.name}`,
          {
            body: L(`Completaste o desafio semanal "${challenge.name}". Recompensa creditada.`, `You completed the weekly challenge "${challenge.name}". Reward credited.`),
            deepLink: '/wallet',
          },
        ),
        ...state.inbox,
      ].slice(0, 14);

      return {
        ...state,
        finance,
        inbox,
        streakChallenges: {
          ...state.streakChallenges,
          challenges,
        },
      };
    }
    case 'TICK_MATCH_MINUTE': {
      return runTick(state);
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
        const line = penaltyNarrativeLine(outcome, pen.takerName, L('O guarda-redes', 'The keeper'));
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
        text: L(`${lm.minute ?? 0}' — ${q.name} decide continuar apesar das dores. Risco elevado de agravamento.`, `${lm.minute ?? 0}' — ${q.name} plays on through the pain. High risk of aggravation.`),
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
      const targetPart = a.targetName ? L(` ${a.targetName} sobe`, ` ${a.targetName} rises`) : '';
      let narrativeText: string;
      switch (outcome) {
        case 'goal':
          narrativeText = isCorner
            ? L(`${a.takerName} cobra escanteio,${targetPart} e marca de cabeça!`, `${a.takerName} takes the corner,${targetPart} and heads it in!`)
            : L(`${a.takerName} cobra falta direto e supera a barreira — GOL!`, `${a.takerName} curls the free kick over the wall — GOAL!`);
          break;
        case 'shot_saved':
          narrativeText = isCorner
            ? L(`${a.takerName} cruza,${targetPart} mas o goleiro defende firme.`, `${a.takerName} crosses,${targetPart} but the keeper holds firm.`)
            : L(`${a.takerName} chuta a falta — goleiro defende.`, `${a.takerName} strikes the free kick — keeper saves.`);
          break;
        case 'cleared':
          narrativeText = L(`Defesa adversária afasta a bola após cobrança de ${a.takerName}.`, `The defence clears ${a.takerName}'s delivery.`);
          break;
        default:
          narrativeText = L(`${a.takerName} bate, jogada continua e o ataque é reciclado.`, `${a.takerName} takes it, play goes on and the attack is recycled.`);
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
      // only enforce in quick mode
      if (lm.mode !== 'quick') return state;
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
      return { ...state, liveMatch: promoteToPostgame(state.liveMatch) };
    }
    case 'FORFEIT_MATCH': {
      const asMode = action.mode;
      const forfeiEv: MatchEventEntry = {
        id: uid(),
        minute: 90,
        text: L(`WO — Desistência: vitória de ${state.nextFixture.opponent.shortName} por 5–0.`, `Walkover — Forfeit: ${state.nextFixture.opponent.shortName} win 5–0.`),
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
            spiritOverlay: null,
            penalty: null,
            activeInteractiveMoment: null,
            quickInjurySub: null,
            preGoalHint: null,
            pendingCornerForSide: null,
            pendingFreeKickForSide: null,
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
    case 'REFEREE_WARNING_LANGUAGE': {
      if (!state.liveMatch) return state;
      const lm = state.liveMatch;
      const warnings = (lm.refereeLanguageWarnings ?? 0) + 1;
      const ev: import('@/engine/types').MatchEventEntry = {
        id: uid(),
        minute: action.minute,
        text: L(`${action.minute}' — ⚠ Árbitro adverte o banco — linguagem imprópria do treinador.`, `${action.minute}' — ⚠ Referee warns the bench — improper language from the coach.`),
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
        text: L(`${action.minute}' — 🟥 Árbitro expulsa ${action.expelledPlayerName} por conduta do treinador!`, `${action.minute}' — 🟥 Referee sends off ${action.expelledPlayerName} for the coach's conduct!`),
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
          (e.kind === 'narrative' && /chut|shot|shoot/.test(e.text.toLowerCase()))
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
          ? L(
              ` Estruturas: estádio +${structBonuses.stadiumExp} EXP${homeWin ? `, Megaloja +${structBonuses.megastoreExp} EXP` : ''} (apoio efectivo ~${structBonuses.effectiveCrowd.toFixed(1)}%).`,
              ` Facilities: stadium +${structBonuses.stadiumExp} EXP${homeWin ? `, Megastore +${structBonuses.megastoreExp} EXP` : ''} (effective support ~${structBonuses.effectiveCrowd.toFixed(1)}%).`,
            )
          : '';
      const streakBonusLine =
        streakMultiplier > 1.0
          ? L(` 🔥 Streak de ${quickMatchStreak?.current ?? 0} vitórias: ${streakMultiplier}x multiplicador aplicado!`, ` 🔥 ${quickMatchStreak?.current ?? 0}-win streak: ${streakMultiplier}x multiplier applied!`)
          : '';
      const performanceBonusLine =
        performanceBonuses.length > 0
          ? L(` 🏆 Bônus de Performance: +${bonusOle} OLE, +${bonusExp} EXP (${performanceBonuses.map(b => b.name).join(', ')})`, ` 🏆 Performance Bonus: +${bonusOle} OLE, +${bonusExp} EXP (${performanceBonuses.map(b => b.name).join(', ')})`)
          : '';
      const financeNote = makeInboxItem(
        `finance-${Date.now()}`,
        'FINANCE_EXP_GAIN',
        'FINANCEIRO',
        L(`+${oleGain} EXP creditados pela jornada.`, `+${oleGain} EXP credited for the matchday.`),
        {
          body: `${homeWin
            ? L('Bónus de jornada creditado. Desfecho desportivo e detalhes ficam no histórico de jogos e na liga — não na caixa de notificações.', 'Matchday bonus credited. Results and details are in the match history and the league — not in notifications.')
            : draw
              ? L('Jornada contabilizada na competição — tabela e calendário na área de competição.', 'Matchday counted in the competition — table and fixtures in the competition area.')
              : L('Jornada contabilizada — segue a preparação no plantel e no staff; placares no histórico de jogos.', 'Matchday counted — keep preparing the squad and staff; scores in the match history.')}${structExtraLine}${streakBonusLine}${performanceBonusLine}`,
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
      const matchModeForHealth = isFriendly ? 'friendly' : (lm.mode as 'quick' | 'auto');
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
      const legacyModeWasActive = !!(lm as unknown as Record<string, unknown>)['legacyModeWasActive'];
      const classicStyleWeights = styleAttrWeights(state.manager?.tacticalStyle);
      for (const [pid, stat] of Object.entries(lm.homeStats ?? {})) {
        const pl = players[pid];
        if (!pl) continue;
        let next = applyMatchPerformanceEvolution(pl, stat, outcome, legacyModeWasActive, classicStyleWeights);
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
      // FIX B + C — Sync engine→SSOT primeiro, recovery garantido depois.
      //
      // FIX B: cria entry no playerHealth pra QUALQUER jogador (antes pulava
      // entries que não existiam — bug de jogador novo nunca virar SSOT).
      //
      // FIX C: aplica recovery garantido por partida JOGADA, independente de
      // manager presente/ausente — antes ficava preso na recuperação off-match
      // que só rodava se presente <36h. Banco recupera mais que titulares.
      const playedSet = new Set(playedUnique);
      const POST_MATCH_BASE_RECOVERY = 12;
      const POST_MATCH_BENCH_BONUS = 18; // banco descansa muito mais
      const syncedHealth: typeof playerHealth = { ...playerHealth };
      for (const [pid, p] of Object.entries(players)) {
        const cur = syncedHealth[pid] ?? healthFromLegacyPlayer({
          id: pid,
          fatigue: p.fatigue,
          injuryRisk: p.injuryRisk,
          outForMatches: p.outForMatches,
        });
        const played = playedSet.has(pid);
        const recovery = POST_MATCH_BASE_RECOVERY + (played ? 0 : POST_MATCH_BENCH_BONUS);
        const nextFatigue = Math.max(0, p.fatigue - recovery);
        syncedHealth[pid] = {
          ...cur,
          fatigue: nextFatigue,
          injuryRisk: p.injuryRisk,
          outForMatches: p.outForMatches,
          atRisk: nextFatigue >= 80 || p.injuryRisk >= 70,
        };
        // Espelha no PlayerEntity legacy pra UI antiga ainda mostrar valor coerente.
        players[pid] = { ...p, fatigue: nextFatigue };
      }
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
        // Artilharia real: persiste quem marcou (o motor já sabe, via scoutTallies).
        // Fire-and-forget, igual ao persistPlayers — nunca bloqueia o fim da partida.
        void persistPlayerGoals(
          state.club.id,
          lm.supabaseMatchId,
          state.club.name,
          Object.values(rawTallies).map((t) => ({
            playerId: t.playerId,
            name: t.name,
            pos: t.pos,
            goals: t.goals,
            assists: t.assists,
          })),
        );
      }
      void persistPlayers(state.club.id, playerPersistPayload);

      // RPG-PRICE-LIVE: o preço sobe pro SERVIDOR a cada partida — é daqui que
      // ticker, OLE-100 e o salário (yield com teto no banco) leem. Só quem
      // jogou (tem stat) e já tem valor dinâmico entra; fire-and-forget.
      void pushValueSnapshots(
        playedUnique
          .map((pid) => players[pid])
          .filter((p): p is PlayerEntity => !!p && p.marketValueBroCents != null && p.marketValueBroCents > 0)
          .map((p) => ({
            gamePlayerId: p.id,
            name: p.name,
            pos: p.pos,
            ovr: overallFromAttributes(p.attrs, p.pos),
            marketBroCents: p.marketValueBroCents!,
            rating: lm.homeStats[p.id]?.rating ?? null,
            source: 'match' as const,
          })),
      );

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
      finance = withExpHistory(finance, oleGain, L('Recompensa de partida', 'Match reward'));
      for (const tid of newTrophies) {
        const { exp: te, broCents: tb } = memorableTrophyFinanceReward(tid);
        if (te > 0) {
          finance = grantEarnedExp(finance, te);
          finance = withExpHistory(finance, te, L('Prémio de competição (troféu)', 'Competition prize (trophy)'));
        }
        if (tb > 0) finance = addBroCents(finance, tb);
      }

      // A comissão de indicação que era simulada AQUI (5% por nível, gravada no
      // livro local como se a pessoa tivesse recebido) saiu com o plano de
      // marketing antigo, cancelado em 2026-09-30. A rede que paga é a expansão.

      let inbox = [staffNote, financeNote, ...state.inbox].slice(0, 14);
      if (newTrophies.length > 0) {
        const trophyNote = makeInboxItem(
          `trophy-${Date.now()}`,
          'FINANCE_EXP_GAIN',
          'COMPETIÇÃO',
          L('Prémios de título memorável creditados.', 'Memorable title prizes credited.'),
          {
            body: L(`Novos troféus: ${newTrophies.join(', ')}. EXP e BRO na carteira de jogo.`, `New trophies: ${newTrophies.join(', ')}. EXP and BRO in your game wallet.`),
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
            L(`+${pointsGained} pontos no ranking competitivo!`, `+${pointsGained} points in the competitive ranking!`),
            {
              body: L(
                `Partida competitiva: ${homeWin ? 'Vitória' : 'Empate'} contra adversário humano. Total: ${competitiveRanking.points} pontos (${competitiveRanking.wins}V ${competitiveRanking.draws}E ${competitiveRanking.losses}D).`,
                `Competitive match: ${homeWin ? 'Win' : 'Draw'} against a human opponent. Total: ${competitiveRanking.points} points (${competitiveRanking.wins}W ${competitiveRanking.draws}D ${competitiveRanking.losses}L).`,
              ),
              deepLink: '/ranking',
            },
          );
          inbox = [rankingNote, ...inbox].slice(0, 14);
        }
      }

      // FAST LIGA — modo QUICK soma pontos em local league dedicada.
      let localLeagues = state.localLeagues ?? emptyLocalLeaguesState();
      if (lm.mode === 'quick') {
        const ll = homeWin ? 'win' : draw ? 'draw' : 'loss';
        localLeagues = {
          ...localLeagues,
          fast: applyResultToLocalLeague(localLeagues.fast, ll, lm.homeScore, lm.awayScore),
        };
      }

      // Gerar propostas proativas do Coach baseadas em saúde pós-jogo.
      // ─── OLEFOOT PYTHON MODE — gera consequências persistentes ──
      const managerIdForImpact =
        state.userSettings?.managerProfile?.email ?? state.club.id ?? 'guest';
      const impactSummary = buildImpactSummary({
        lm,
        scoutResult,
        managerId: managerIdForImpact,
        clubId: state.club.id,
        matchId: state.nextFixture.id ?? `match-${Date.now()}`,
      });
      const impactEvents = eventsFromMatchSummary(impactSummary);
      const newConsequences = materializeBatch(impactEvents);
      const prevStore = state.consequenceStore ?? EMPTY_CONSEQUENCE_STORE;
      const tickedStore = tickConsequences(prevStore, Date.now()).next;
      const consequenceStore = newConsequences.length
        ? addManyConsequences(tickedStore, newConsequences)
        : tickedStore;
      // ─────────────────────────────────────────────────────────────

      // ─── FASE 4 — o jogador tem algo a dizer ────────────────────────
      //
      // Depois da partida, UM jogador (no máximo) pode bater na porta: quem
      // joga pouco cobra minutos, quem é ambicioso quer palco maior, quem
      // carrega o time quer status. Os três traços são DERIVADOS de dado que
      // já existe (idade, OVR, mint, jogos) — sem campo novo no jogador.
      //
      // Um pedido por vez, de propósito: o valor está em UMA decisão com peso,
      // não numa caixa de reclamações.
      const nextPlayerRequests = (() => {
        const pending = state.playerRequests ?? [];
        if (pending.length > 0) return pending; // já tem pedido na mesa
        const roster = Object.values(players);
        if (roster.length === 0) return pending;

        const clubMatches = results.length;
        const overalls = roster.map((p) => overallFromAttributes(p.attrs, p.pos));
        const squadAvg = overalls.reduce((a, b) => a + b, 0) / overalls.length;
        const relations = state.managerRelationByPlayer ?? {};
        const now = Date.now();

        for (let idx = 0; idx < roster.length; idx++) {
          const p = roster[idx]!;
          const personality = derivePersonality({
            playerId: p.id,
            age: p.age,
            overall: overalls[idx]!,
            mintOverall: p.mintOverall,
            squadAverageOverall: squadAvg,
            matchesPlayed: playerSeasonLedger[p.id]?.matchesPlayed ?? 0,
            clubMatchesPlayed: clubMatches,
          });
          const req = detectPlayerRequest({
            playerId: p.id,
            playerName: p.name,
            personality,
            matchesPlayed: playerSeasonLedger[p.id]?.matchesPlayed ?? 0,
            clubMatchesPlayed: clubMatches,
            relation: relations[p.id] ?? 75,
            now,
          });
          if (req) return [req];
        }
        return pending;
      })();

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
        localLeagues,
        consequenceStore,
        playerRequests: nextPlayerRequests,
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
    case 'FINALIZE_QUICK_PLAN': {
      // Crédito da Partida Rápida 2.0 (motor Python) — reusa os helpers puros
      // de economia/evolução/fadiga/streak sem reconstruir um liveMatch.
      const credit = computeQuickPlanCredit(
        {
          finance: state.finance,
          players: state.players,
          playerHealth: state.playerHealth,
          quickMatchStreak: state.quickMatchStreak,
        },
        {
          homeScore: action.homeScore,
          awayScore: action.awayScore,
          reading: action.reading,
          homeStats: action.homeStats,
          homeOnPitch: action.homeOnPitch,
          agg: action.agg,
          shootoutWin: action.shootoutWin,
          styleWeights: styleAttrWeights(state.manager?.tacticalStyle),
        },
      );
      // Empate no tempo normal é decidido nos pênaltis (nenhum jogo empata).
      const drawScore = action.homeScore === action.awayScore;
      const homeWin = action.homeScore > action.awayScore || (drawScore && action.shootoutWin === 'home');
      const draw = drawScore && !action.shootoutWin;
      // Rival fantasma (viral #6): guarda a MELHOR vitória (maior saldo) como marca
      // a bater. Vitória que supera o recorde acende um badge transitório no pós-jogo.
      const winMargin = action.homeScore - action.awayScore;
      const prevBestMargin = state.quickBestWin
        ? state.quickBestWin.homeScore - state.quickBestWin.awayScore
        : 0;
      const lastQuickNewRecord = homeWin && winMargin > prevBestMargin;
      const quickBestWin = lastQuickNewRecord
        ? { homeScore: action.homeScore, awayScore: action.awayScore, opponentName: state.nextFixture.opponent?.name ?? L('Adversário', 'Opponent') }
        : state.quickBestWin;
      // Ponte #2: desafios semanais de streak também progridem no motor Engaged
      // (antes só o FINALIZE_MATCH legado os atualizava → loop de retorno morto).
      let streakChallenges = state.streakChallenges;
      if (streakChallenges) {
        if (shouldRefreshChallenges(streakChallenges)) {
          streakChallenges = {
            challenges: generateWeeklyChallenges(),
            lastRefreshDate: new Date().toISOString(),
          };
        } else {
          streakChallenges = {
            ...streakChallenges,
            challenges: updateStreakProgress(
              streakChallenges.challenges,
              credit.quickMatchStreak.current,
              homeWin,
            ),
          };
        }
      }
      let finance = withExpHistory(credit.finance, credit.oleGain, L('Partida Rápida', 'Quick Match'));
      finance = financeWithLedger(finance, {
        type: 'MATCH_REWARD',
        currency: 'EXP',
        amount: credit.oleGain,
        source: 'quick_match',
        refId: `qp-reward-${Date.now()}`,
      });
      const nextResult: import('@/entities/types').FormLetter = homeWin ? 'W' : draw ? 'D' : 'L';
      const form = [...state.form.slice(1), nextResult];
      const results = [{
        home: state.club.name,
        away: state.nextFixture.opponent?.name ?? L('Adversário', 'Opponent'),
        scoreHome: action.homeScore,
        scoreAway: action.awayScore,
        status: 'FT',
        result: homeWin ? ('win' as const) : draw ? ('draw' as const) : ('loss' as const),
      }, ...state.results].slice(0, 8);
      const iqLine = action.reading.total > 0
        ? L(` Leitura de jogo ${action.reading.good}/${action.reading.total} — Manager IQ ${credit.readingMult >= 1 ? `+${Math.round((credit.readingMult - 1) * 100)}%` : `${Math.round((credit.readingMult - 1) * 100)}%`} na recompensa.`, ` Game reading ${action.reading.good}/${action.reading.total} — Manager IQ ${credit.readingMult >= 1 ? `+${Math.round((credit.readingMult - 1) * 100)}%` : `${Math.round((credit.readingMult - 1) * 100)}%`} on the reward.`)
        : '';
      const note = makeInboxItem(
        `qp-${Date.now()}`,
        'FINANCE_EXP_GAIN',
        'FINANCEIRO',
        L(`+${credit.oleGain} EXP pela Partida Rápida.`, `+${credit.oleGain} EXP from the Quick Match.`),
        {
          body: `${L('Recompensa creditada.', 'Reward credited.')}${credit.bonusNames.length ? L(` Bônus: ${credit.bonusNames.join(', ')}.`, ` Bonus: ${credit.bonusNames.join(', ')}.`) : ''}${iqLine}`,
          deepLink: '/wallet',
          // Ponte #4: quando saiu bônus de performance, o feito MERECE o feed da
          // Home (growth orgânico). Partida rotineira sem bônus segue escondida.
          hideFromHomeFeed: credit.bonusNames.length === 0,
        },
      );
      // LIGA OLE: se esta partida era da liga (pendingOpponentId setado),
      // avança o chaveamento com o resultado real (V/E→pênaltis/D), credita o
      // PRÊMIO DA FASE e liquida a APOSTA (2× na vitória).
      let ligaOle = state.ligaOle;
      let ligaOleResultFlash = state.ligaOleResultFlash;
      let ligaOleNemesis = state.ligaOleNemesis;
      let ligaOleTitles = state.ligaOleTitles ?? 0;
      let ligaOleLastDefeated = state.ligaOleLastDefeated;
      const ligaNotes: import('@/game/inboxTypes').InboxItem[] = [];
      // ─── FABLE: DNA Tático + Renome + Cicatrizes (memória e rosto) ─────
      const fableNowMs = Date.now();
      // DNA: as escolhas de estilo ao vivo + formação marcam o eixo
      // Romântico↔Pragmático do clube (muda devagar, cap por partida).
      const clubDna = applyQuickMatchToDna(state.clubDna, {
        styleLog: action.styleLog ?? [],
        formation: action.formation,
      });
      // Renome: feitos públicos somam fama (nunca decai).
      let clubRenown = state.clubRenown;
      if (homeWin) clubRenown = addRenown(clubRenown, 2, L('Vitória na Partida Rápida', 'Quick Match win'), fableNowMs);
      if (homeWin && action.agg.wasLosing) clubRenown = addRenown(clubRenown, 15, L('Virada épica', 'Epic comeback'), fableNowMs);
      // Cicatrizes: pênalti errado marca; conversão carregando a marca CURA
      // (redenção); gol aos 85'+ vira medalha de clutch.
      let playerScars = state.playerScars;
      if ((action.shootoutKicks?.length ?? 0) > 0 || (action.lateHeroIds?.length ?? 0) > 0) {
        const scarred = applyQuickScars(
          playerScars,
          {
            shootoutKicks: action.shootoutKicks,
            lateHeroIds: action.lateHeroIds,
            matchLabel: `vs ${state.nextFixture.opponent?.name ?? L('Adversário', 'Opponent')}`,
            atMs: fableNowMs,
          },
          (id) => state.players[id]?.name ?? L('Jogador', 'Player'),
        );
        playerScars = scarred.map;
        for (const n of scarred.narratives) {
          ligaNotes.push(makeInboxItem(
            `scar-${n.playerId}-${fableNowMs}`,
            'COMPANY_ANNOUNCEMENT',
            'PLANTEL',
            n.text,
            { tag: L('Elenco', 'Squad'), hideFromHomeFeed: n.kind !== 'healed' },
          ));
        }
      }
      if (ligaOle?.pendingOpponentId && ligaOle.status === 'active') {
        const roundPlayed = ligaOle.roundIndex;
        const playedRoundName = ligaOleRoundReward(roundPlayed).round;
        const opponent = managerOpponent(ligaOle); // adversário ANTES de avançar
        const wager = ligaOle.pendingWager ?? 0;
        const isWeekly = ligaOle.mode === 'weekly';
        const weekKey = ligaOle.weekKey;
        // DINASTIA: títulos anteriores multiplicam os prêmios desta campanha.
        const dinastiaMult = dinastiaMultiplier(ligaOleTitles);
        const advanced = advanceLigaOle(ligaOle, {
          won: homeWin,
          scoreManager: action.homeScore,
          scoreOpp: action.awayScore,
          shootout: !!action.shootoutWin,
        });

        if (homeWin) {
          // Prêmio por vencer a fase (índice = rodada vencida) × dinastia. Final = 1.000.000 base.
          const prize = ligaOleRoundReward(roundPlayed);
          const amount = Math.round(prize.amount * dinastiaMult);
          if (amount > 0) {
            const label = prize.isChampion ? L('Liga Ole · CAMPEÃO', 'Liga Ole · CHAMPION') : `Liga Ole · ${prize.round}`;
            finance = withExpHistory(grantEarnedExp(finance, amount), amount, label);
            const dinastiaTag = dinastiaMult > 1 ? L(` (Dinastia ×${dinastiaMult.toFixed(2)})`, ` (Dynasty ×${dinastiaMult.toFixed(2)})`) : '';
            ligaNotes.push(makeInboxItem(
              `lo-prize-${Date.now()}`,
              'FINANCE_EXP_GAIN',
              'COMPETIÇÃO',
              prize.isChampion
                ? L(`🏆 CAMPEÃO! +${amount.toLocaleString(LOCALE)} EXP de título${dinastiaTag}.`, `🏆 CHAMPION! +${amount.toLocaleString(LOCALE)} title EXP${dinastiaTag}.`)
                : L(`Avançou na ${prize.round}: +${amount.toLocaleString(LOCALE)} EXP${dinastiaTag}.`, `Through the ${prize.round}: +${amount.toLocaleString(LOCALE)} EXP${dinastiaTag}.`),
              { tag: 'Liga Ole', deepLink: '/liga-ole', hideFromHomeFeed: false },
            ));
          }
          // Aposta: vitória paga 2× (devolve o stake + lucro igual ao stake).
          if (wager > 0) {
            const payout = wager * 2;
            finance = withExpHistory(grantEarnedExp(finance, payout), payout, L('Liga Ole · aposta vencedora', 'Liga Ole · winning bet'));
            ligaNotes.push(makeInboxItem(
              `lo-bet-${Date.now()}`,
              'FINANCE_EXP_GAIN',
              'COMPETIÇÃO',
              L(`Aposta vencedora: +${payout.toLocaleString(LOCALE)} EXP (dobrou ${wager.toLocaleString(LOCALE)}).`, `Winning bet: +${payout.toLocaleString(LOCALE)} EXP (doubled ${wager.toLocaleString(LOCALE)}).`),
              { tag: 'Liga Ole', deepLink: '/liga-ole', hideFromHomeFeed: false },
            ));
          }
          // NÊMESIS: venceu um rival REAL → notifica o derrotado (efeito cross-user no componente).
          if (opponent?.managerId) {
            ligaOleLastDefeated = { managerId: opponent.managerId, clubName: state.club.name, round: playedRoundName };
          }
          // REVANCHE cumprida: bateu justamente o nêmesis → some o selo.
          if (ligaOleNemesis && opponent && opponent.id === ligaOleNemesis.id) {
            ligaNotes.push(makeInboxItem(
              `lo-revenge-${Date.now()}`,
              'FINANCE_EXP_GAIN',
              'COMPETIÇÃO',
              L(`Revanche! Você eliminou ${ligaOleNemesis.name} — conta acertada.`, `Revenge! You knocked out ${ligaOleNemesis.name} — score settled.`),
              { tag: 'Liga Ole', deepLink: '/liga-ole', hideFromHomeFeed: false },
            ));
            ligaOleNemesis = undefined;
          }
        } else {
          // Derrota: o algoz vira o NÊMESIS da próxima campanha (revanche).
          if (opponent) {
            ligaOleNemesis = { id: opponent.id, name: opponent.name, short: opponent.short, overall: opponent.overall, managerId: opponent.managerId, round: playedRoundName };
          }
          if (wager > 0) {
            ligaNotes.push(makeInboxItem(
              `lo-bet-${Date.now()}`,
              'FINANCE_EXP_GAIN',
              'COMPETIÇÃO',
              L(`Aposta perdida: ${wager.toLocaleString(LOCALE)} EXP. Fica pra próxima.`, `Bet lost: ${wager.toLocaleString(LOCALE)} EXP. Next time.`),
              { tag: 'Liga Ole', deepLink: '/liga-ole', hideFromHomeFeed: true },
            ));
          }
        }

        // DINASTIA: título conquistado incrementa o contador (multiplica futuras campanhas).
        if (advanced.status === 'champion') ligaOleTitles = ligaOleTitles + 1;

        // FABLE — Renome: avançar fase +30; título soma +100 (fama nunca decai).
        if (homeWin) {
          clubRenown = advanced.status === 'champion'
            ? addRenown(clubRenown, 130, L('Campeão da Liga Ole', 'Liga Ole champion'), fableNowMs)
            : addRenown(clubRenown, 30, L(`Liga Ole — venceu na ${playedRoundName}`, `Liga Ole — won in the ${playedRoundName}`), fableNowMs);
        }
        // FABLE — Crônica da edição: zebra/goleada/carrasco da rodada viram
        // manchete no inbox (a história sendo escrita sem autor humano).
        ligaNotes.push(...buildRoundChronicle(ligaOle, advanced, {
          managerClubName: state.club.name,
          idSalt: fableNowMs,
        }));

        if (advanced.status === 'active') {
          // Segue vivo na liga — guarda o avanço; zera aposta/alvo do confronto.
          ligaOle = { ...advanced, pendingOpponentId: undefined, pendingWager: undefined };
        } else {
          // Campanha ACABOU (campeão/eliminado): vira FLASH transitório e some do
          // landing (só aparece como resultado da partida, não como tela inicial).
          ligaOleResultFlash = { outcome: advanced.status, reachedRound: advanced.reachedRound, clubName: state.club.name, weekKey: isWeekly ? weekKey : undefined };
          ligaOle = undefined;
        }
      }

      // LEGENDS CUP: mesmo mecanismo da Liga Ole. Se esta Quick era do Cup,
      // aplica o resultado na campanha, credita o EXP da fase e avança.
      // A fase de grupos NÃO elimina por derrota — quem decide é a tabela ao
      // fim das 3 rodadas, então o crédito só sai quando a fase é vencida.
      let legendsCup = state.legendsCup;
      let legendsCupResultFlash = state.legendsCupResultFlash;
      let legendsCupTitles = state.legendsCupTitles ?? 0;
      if (legendsCup?.pendingOpponentId && legendsCup.status === 'active') {
        const roundBefore = legendsCup.roundIndex;
        const advanced = applyLegendsCupResult(
          legendsCup,
          homeWin,
          action.homeScore,
          action.awayScore,
        );
        const passedPhase = advanced.roundIndex > roundBefore || advanced.status === 'champion';
        if (passedPhase) {
          const amount = legendsCupPhaseExp(roundBefore, legendsCup.runNumber);
          if (amount > 0) {
            const label = advanced.status === 'champion'
              ? L('Legends Cup · CAMPEÃO', 'Legends Cup · CHAMPION')
              : `Legends Cup · ${legendsCupRoundOf(roundBefore)}`;
            finance = withExpHistory(grantEarnedExp(finance, amount), amount, label);
            ligaNotes.push(makeInboxItem(
              `lc-prize-${Date.now()}`,
              'FINANCE_EXP_GAIN',
              'COMPETIÇÃO',
              advanced.status === 'champion'
                ? L(`🏆 Você venceu OS IMORTAIS! +${amount.toLocaleString(LOCALE)} EXP.`, `🏆 You beat THE IMMORTALS! +${amount.toLocaleString(LOCALE)} EXP.`)
                : L(`Passou da ${legendsCupRoundOf(roundBefore)}: +${amount.toLocaleString(LOCALE)} EXP.`, `Through the ${legendsCupRoundOf(roundBefore)}: +${amount.toLocaleString(LOCALE)} EXP.`),
              { tag: 'Legends Cup', deepLink: '/legends-cup', hideFromHomeFeed: false },
            ));
          }
        }
        if (advanced.status === 'champion') legendsCupTitles += 1;
        if (advanced.status === 'active') {
          legendsCup = { ...advanced, pendingOpponentId: undefined };
        } else {
          legendsCupResultFlash = { outcome: advanced.status, reachedRound: advanced.reachedRound };
          legendsCup = undefined;
        }
      }

      // CONSEQUÊNCIAS DE COMPETIÇÃO — contratos, cartões/suspensões e lesões
      // contam nas partidas OFICIAIS jogadas pelo motor Quick (Liga Ole e
      // Legends Cup; a Liga Global tem o próprio produtor no
      // useGlobalConsequencesSync). Amistoso Quick segue sem consequências.
      let players = credit.players;
      let playerHealth = credit.playerHealth;
      const wasLigaOleMatch = !!(state.ligaOle?.pendingOpponentId && state.ligaOle.status === 'active');
      const wasLegendsCupMatch = !!(state.legendsCup?.pendingOpponentId && state.legendsCup.status === 'active');
      const competitionLeagueId = wasLigaOleMatch ? 'liga-ole' : wasLegendsCupMatch ? 'legends-cup' : null;
      if (competitionLeagueId) {
        // 1) Contrato: partida oficial consome 1 jogo de quem atuou.
        const playedIds = Object.keys(action.homeStats);
        players = decrementContractsForIds(players, playedIds);
        const newlyExpired = playedIds.filter(
          (pid) => players[pid]?.contractExpired === true && state.players[pid]?.contractExpired !== true,
        );
        for (const pid of newlyExpired) {
          ligaNotes.push(makeInboxItem(
            `qp-contract-${pid}-${fableNowMs}`,
            'COMPANY_ANNOUNCEMENT',
            'PLANTEL',
            L(`Contrato de ${players[pid]?.name ?? 'jogador'} EXPIROU — renove para voltar a escalar.`, `${players[pid]?.name ?? 'Player'}'s contract EXPIRED — renew to pick him again.`),
            { tag: L('Contratos', 'Contracts'), colorClass: 'text-red-400', deepLink: '/clube/elenco' },
          ));
        }
        // 2) Disciplina + lesões, derivadas dos stats reais da partida
        //    (seed = timestamp da finalização; saúde ANTES do jogo alimenta o risco).
        const consequenceEvents = quickPlanToConsequenceEvents({
          matchId: `qp-${competitionLeagueId}-${fableNowMs}`,
          leagueId: competitionLeagueId,
          homeStats: action.homeStats,
          playerHealth: state.playerHealth,
          seed: fableNowMs,
          shots: action.agg.shots,
          now: fableNowMs,
        });
        if (consequenceEvents.length > 0) {
          const applied = applyHealthConsequences(playerHealth, consequenceEvents);
          playerHealth = applied.next;
          for (const o of applied.outcomes) {
            const pl = players[o.playerId];
            if (!pl) continue;
            // Espelha no campo legado de PlayerEntity lido por parte da UI.
            players = { ...players, [o.playerId]: { ...pl, outForMatches: o.after.outForMatches } };
            if (o.injured) {
              ligaNotes.push(makeInboxItem(
                `qp-injury-${o.playerId}-${fableNowMs}`,
                'COMPANY_ANNOUNCEMENT',
                'PLANTEL',
                L(`${INJURY_LABEL_PT[o.injured]}: ${pl.name} fora por ${o.after.outForMatches} jogo(s).`, `${INJURY_LABEL_PT[o.injured]}: ${pl.name} out for ${o.after.outForMatches} match(es).`),
                { tag: L('Departamento Médico', 'Medical Department'), colorClass: 'text-red-400', deepLink: '/clube/elenco' },
              ));
            }
            if (o.newlySuspended) {
              ligaNotes.push(makeInboxItem(
                `qp-susp-${o.playerId}-${fableNowMs}`,
                'COMPANY_ANNOUNCEMENT',
                'PLANTEL',
                L(`${pl.name} suspenso: cumpre ${o.after.suspendedMatches} jogo(s) de gancho.`, `${pl.name} suspended: banned for ${o.after.suspendedMatches} match(es).`),
                { tag: L('Disciplina', 'Discipline'), colorClass: 'text-red-400', deepLink: '/clube/elenco' },
              ));
            }
          }
        }
      }

      // PONTUAÇÃO DO MANAGER — jogar sempre pontua; oficial vale mais.
      const scoreOppName = state.nextFixture.opponent?.name ?? L('Adversário', 'Opponent');
      const managerScore = addManagerScore(
        state.managerScore,
        homeWin ? (competitionLeagueId ? 'vitoria_oficial' : 'vitoria_amistosa') : 'derrota',
        homeWin
          ? L(`Vitória ${competitionLeagueId ? 'oficial ' : ''}sobre ${scoreOppName}`, `${competitionLeagueId ? 'Official w' : 'W'}in over ${scoreOppName}`)
          : draw ? L(`Empate com ${scoreOppName}`, `Draw with ${scoreOppName}`) : L(`Jogou contra ${scoreOppName}`, `Played ${scoreOppName}`),
        fableNowMs,
        draw ? 4 : undefined,
      );

      return {
        ...state,
        finance,
        players,
        playerHealth,
        managerScore,
        quickMatchStreak: credit.quickMatchStreak,
        lastQuickEvolution: credit.evolution,
        lastQuickBonuses: credit.bonuses,
        quickBestWin,
        lastQuickNewRecord,
        streakChallenges,
        results,
        form,
        inbox: [...ligaNotes, note, ...state.inbox].slice(0, 60),
        ligaOle,
        ligaOleResultFlash,
        ligaOleNemesis,
        ligaOleTitles,
        ligaOleLastDefeated,
        legendsCup,
        legendsCupResultFlash,
        legendsCupTitles,
        clubDna,
        clubRenown,
        playerScars,
      };
    }
    case 'VOTE_WEEKLY_DECREE': {
      // FABLE — Decreto da Semana: voto vale só na semana ISO corrente; o
      // efeito entra via computeMatchContextModifiers (decree option ativa).
      const now = Date.now();
      const weekKey = isoWeekKey(now);
      // Preserva o resultado global se já chegou pra ESTA semana.
      const globalOption = state.weeklyDecree?.weekKey === weekKey
        ? state.weeklyDecree.globalOption
        : undefined;
      return {
        ...state,
        weeklyDecree: { weekKey, vote: action.option, votedAtMs: now, globalOption },
      };
    }
    case 'SET_WEEKLY_DECREE_GLOBAL': {
      // FABLE v2 — o decreto VENCEDOR (tally cross-user) passa a valer pra
      // este mundo, mesmo se o manager votou na opção derrotada (Fable 3:
      // quem perde a votação também vive com a consequência).
      const cur = state.weeklyDecree;
      const sameWeek = cur?.weekKey === action.weekKey;
      return {
        ...state,
        weeklyDecree: {
          weekKey: action.weekKey,
          vote: sameWeek ? cur?.vote : undefined,
          votedAtMs: sameWeek ? cur?.votedAtMs : undefined,
          globalOption: action.option,
        },
      };
    }
    case 'CREATE_LIGA_OLE': {
      return {
        ...state,
        ligaOle: { ...action.liga, mode: action.mode ?? 'classic', weekKey: action.weekKey },
        ligaOleResultFlash: undefined,
      };
    }
    case 'LIGA_OLE_NEMESIS_NOTIFIED': {
      if (!state.ligaOleLastDefeated) return state;
      return { ...state, ligaOleLastDefeated: undefined };
    }
    case 'START_LIGA_OLE_MATCH': {
      if (!state.ligaOle) return state;
      // Aposta opcional em EXP: debita NA HORA (cap no saldo) e guarda o stake.
      // Vitória paga 2× no FINALIZE_QUICK_PLAN; derrota perde o apostado.
      const wager = Math.max(0, Math.floor(action.wager ?? 0));
      const stake = Math.min(wager, Math.max(0, state.finance.ole));
      const finance = stake > 0
        ? withExpHistory(addOle(state.finance, -stake), -stake, L('Liga Ole · aposta', 'Liga Ole · bet'))
        : state.finance;
      return {
        ...state,
        finance,
        ligaOle: { ...state.ligaOle, pendingOpponentId: action.opponentId, pendingWager: stake > 0 ? stake : undefined },
      };
    }
    case 'RESET_LIGA_OLE': {
      return { ...state, ligaOle: undefined, ligaOleResultFlash: undefined };
    }
    case 'DISMISS_LIGA_OLE_RESULT': {
      return { ...state, ligaOleResultFlash: undefined };
    }
    case 'CREATE_LEGENDS_CUP': {
      return { ...state, legendsCup: action.cup, legendsCupResultFlash: undefined };
    }
    case 'START_LEGENDS_CUP_MATCH': {
      if (!state.legendsCup) return state;
      return {
        ...state,
        legendsCup: { ...state.legendsCup, pendingOpponentId: action.opponentId },
      };
    }
    case 'RESET_LEGENDS_CUP': {
      return { ...state, legendsCup: undefined, legendsCupResultFlash: undefined };
    }
    case 'DISMISS_LEGENDS_CUP_RESULT': {
      return { ...state, legendsCupResultFlash: undefined };
    }

    /**
     * FASE 4 — o manager responde ao pedido do jogador.
     *
     * É aqui que a corrente fecha: a escolha escreve em `managerRelationByPlayer`
     * — campo que JÁ existia, já persiste no Supabase (`manager_relation`) e já
     * alimenta `relacaoManager` → `computeIndividualObedience()` na partida ao
     * vivo — e, pela PONTE nova, também na moral do jogador, que todos os modos
     * leem. Sem essa ponte a decisão só teria efeito no caminho de comando de voz.
     */
    case 'RESOLVE_PLAYER_REQUEST': {
      const pending = state.playerRequests ?? [];
      const req = pending.find((r) => r.id === action.requestId);
      if (!req) return state;

      const outcome = resolveRequest(req.kind, action.choice);
      const now = Date.now();

      const prevRel = state.managerRelationByPlayer ?? {};
      const curRel = prevRel[req.playerId] ?? 75;
      const nextRel = Math.max(0, Math.min(100, curRel + outcome.relationDelta));

      const prevMoral = state.playerMoral ?? {};
      const curMoral = prevMoral[req.playerId] ?? createDefaultMoral(req.playerId, now);
      const nextMoral: PlayerMoral = {
        ...curMoral,
        moral: Math.max(0, Math.min(100, curMoral.moral + outcome.moralDelta)),
        lastResultAt: now,
      };

      const inbox = [
        makeInboxItem(
          `player_request_${req.id}_${now}`,
          'PLAYER_MORALE',
          'PLANTEL',
          L(`${req.playerName} — conversa resolvida`, `${req.playerName} — talk resolved`),
          { body: outcome.reply, tag: L('PLANTEL', 'SQUAD'), timeLabel: L('Agora', 'Now'), deepLink: '/clube/elenco' },
        ),
        ...state.inbox,
      ].slice(0, 60);

      return {
        ...state,
        playerRequests: pending.filter((r) => r.id !== action.requestId),
        managerRelationByPlayer: { ...prevRel, [req.playerId]: nextRel },
        playerMoral: { ...prevMoral, [req.playerId]: nextMoral },
        inbox,
      };
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
      // Slot da Academia OLE — máximo 5 prospects ativos por vez.
      // Pra criar o 6º, manager precisa vender um ao Market Maker
      // ou listar pra outro manager primeiro.
      if (countActiveAcademyProspects(state.players) >= MAX_ACTIVE_ACADEMY_PROSPECTS) return state;
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
      if (overallFromAttributes(built.attrs, built.pos) > MANAGER_PROSPECT_CREATE_MAX_OVR) return state;
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
      // P2 — se a foto JÁ veio gerada pelo pipeline automatizado (Freepik +
      // Pinata via POST /api/academy/generate-portrait), pula o queue do admin.
      // Caso contrário, cai no fluxo legacy (admin processa manualmente).
      if (action.payload.portraitUrl) {
        return {
          ...state,
          finance,
          players: { ...state.players, [built.id]: built },
        };
      }
      // Jogador fictício — manager NÃO marcou "sou esse jogador". Sem foto,
      // sem fila admin. Vai direto pro plantel; PlayerCard renderiza iniciais.
      if (action.payload.isFictional) {
        return {
          ...state,
          finance,
          players: { ...state.players, [built.id]: built },
        };
      }
      const queueEntry: ManagerProspectArtRequest = {
        id: requestId,
        playerId: built.id,
        playerName: built.name,
        createdAtIso,
        // Se a selfie já chegou, pula direto pra 'photo_uploaded' (admin já
        // tem material pra trabalhar). Caso contrário fica em 'awaiting_photo'.
        playerCreationStep: action.payload.selfieUrl ? 'photo_uploaded' : 'awaiting_photo',
        adminArtPrompt,
        attributesSnapshot: { ...built.attrs },
        visualBrief: action.payload.visualBrief,
        heritage: heritageBrief,
        draftPortraitUrl: undefined,
        selfieUrl: action.payload.selfieUrl,
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
    case 'CONFIRM_GACHA_DRAW': {
      // Server já fez o gate (≥5 indicados) e garantiu sorteio único.
      // Aqui só respeitamos o slot (1 por manager) e criamos o jogador com os
      // atributos do sorteio CRUS — sem clampAttrsToCreationCap, pois a banda
      // de OVR já foi aplicada server-side conforme a raridade (até 90).
      if (countActiveAcademyProspects(state.players) >= MAX_ACTIVE_ACADEMY_PROSPECTS) return state;
      const gp = action.payload;
      const gName = gp.name.trim().toUpperCase().slice(0, 24) || 'NOVO';
      const gPos = gp.pos.toUpperCase();
      const gId = `mgr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const gNum = nextKitNumber(state.players);
      const gMint = gp.overall || overallFromAttributes(gp.attrs, gp.pos);
      const gBuilt: PlayerEntity = {
        ...createPlayer({
          id: gId,
          num: gNum,
          name: gName,
          pos: gPos,
          attrs: gp.attrs,
          behavior: 'equilibrado',
          creatorType: 'amador',
          managerCreated: true,
          mintOverall: gMint,
          evolutionRate: 1,
          age: 24,
          strongFoot: 'right',
          listedOnMarket: false,
          fatigue: 12,
          bio: L(`Jogou como ${gp.likePlayerName} (${gp.year})`, `Played like ${gp.likePlayerName} (${gp.year})`),
          ...contractFieldsForManagerProspectTier(250),
        }),
        gachaProvenance: { likePlayerName: gp.likePlayerName, year: gp.year, rarity: gp.rarity },
      };
      // Fila de arte → foto manual (WhatsApp na Fase 4). awaiting_photo.
      const gReqId = `art_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const gQueueEntry: ManagerProspectArtRequest = {
        id: gReqId,
        playerId: gId,
        playerName: gName,
        createdAtIso: new Date().toISOString(),
        playerCreationStep: 'awaiting_photo',
        adminArtPrompt: `Gacha — jogou como ${gp.likePlayerName} (${gp.year}) · ${gPos} · ${gp.rarity} · OVR ${gMint}`,
        attributesSnapshot: { ...gp.attrs },
        heritage: {
          portraitStyleRegion: 'americas_sul',
          originTags: [],
          originText: `Sorteio: jogou como ${gp.likePlayerName} em ${gp.year}`,
        },
      };
      const gPrevQueue = state.managerProspectArtQueue ?? [];
      const gInbox = [
        makeInboxItem(
          `gacha-create-${Date.now()}`,
          'PLAYER_BOUGHT',
          'PLANTEL',
          L(`${gName} criado — jogou como ${gp.likePlayerName} (${gp.year})`, `${gName} created — played like ${gp.likePlayerName} (${gp.year})`),
          {
            body: L(`Teu jogador de raridade ${gp.rarity.toUpperCase()} (OVR ${gMint}) está no plantel. Envia tua foto pra finalizarmos o card.`, `Your ${gp.rarity.toUpperCase()} player (OVR ${gMint}) is in the squad. Send your photo so we can finish the card.`),
            deepLink: '/team',
          },
        ),
        ...state.inbox,
      ].slice(0, 14);
      return {
        ...state,
        players: { ...state.players, [gId]: gBuilt },
        managerProspectArtQueue: [gQueueEntry, ...gPrevQueue].slice(0, 200),
        inbox: gInbox,
      };
    }
    case 'RENEW_MANAGER_PROSPECT_CONTRACT': {
      const player = state.players[action.playerId];
      if (!player) return state;
      if (!player.contractExpired) return state;
      // Renovável: prospects criados pelo manager OU jogadores Genesis (catálogo)
      // não-vitalícios. Vitalícios nunca vencem, então nunca chegam aqui.
      const isRenewable =
        player.managerCreated === true ||
        (player.genesisCatalogId != null && player.contractIsLifetime !== true);
      if (!isRenewable) return state;

      // OLEFOOT já foi debitado server-side via RPC `spend_olefoot` ANTES do dispatch.
      // Reducer só renova o contrato; sem mexer em finance.ole.
      const paymentMethod = action.paymentMethod ?? 'exp';
      if (paymentMethod === 'olefoot') {
        const updatedPlayer: PlayerEntity = {
          ...player,
          contractMatchesRemaining: action.contractMatches,
          contractMatchesIncluded: action.contractMatches,
          contractExpired: false,
        };
        return {
          ...state,
          players: { ...state.players, [action.playerId]: updatedPlayer },
        };
      }

      // Path EXP — debita finance.ole na mesma transação.
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
    case 'APPLY_CONTRACT_DECREMENT_FOR_PLAYED': {
      if (!action.playerIds || action.playerIds.length === 0) return state;
      const next = decrementContractsForIds(state.players, action.playerIds);
      // decrementContractsForIds devolve a referência original quando nada mudou.
      if (next === state.players) return state;
      return { ...state, players: next };
    }
    case 'EVOLVE_SPECIALIST_BY_LANCE': {
      const bumps = action.bumps ?? [];
      if (bumps.length === 0) return state;
      const clamp = (n: number) => Math.max(1, Math.min(99, Math.round(n)));
      let changed = false;
      const players = { ...state.players };
      for (const b of bumps) {
        const p = players[b.playerId];
        if (!p) continue; // jogador não está no plantel local — ignora
        const attrs = { ...p.attrs };
        // +1 no especialista por gol daquele lance. Evolui QUEM FAZ: o zagueiro
        // que cabeceia sobe cabeceio, o batedor sobe bola parada, o cobrador pênalti.
        if (b.header) attrs.cabeceio = clamp(attrs.cabeceio + b.header);
        if (b.freeKick) attrs.bolaParada = clamp(attrs.bolaParada + b.freeKick);
        if (b.penalty) attrs.penalti = clamp(attrs.penalti + b.penalty);
        players[b.playerId] = { ...p, attrs };
        changed = true;
      }
      return changed ? { ...state, players } : state;
    }
    case 'SET_AUTO_RENEW_CONTRACT': {
      const pl = state.players[action.playerId];
      if (!pl) return state;
      if ((pl.autoRenewContract ?? false) === action.enabled) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [action.playerId]: { ...pl, autoRenewContract: action.enabled },
        },
      };
    }
    case 'MARKET_MAKER_ACCEPT': {
      const pl = state.players[action.playerId];
      if (!pl) return state;
      const offerExp = Math.max(0, Math.round(action.offerExp));
      // Remove da lineup
      const lineup = { ...state.lineup };
      for (const [slot, pid] of Object.entries(lineup)) {
        if (pid === action.playerId) delete lineup[slot];
      }
      // Remove do plantel
      const players = { ...state.players };
      delete players[action.playerId];
      // Credita EXP (grantEarnedExp incrementa expLifetimeEarned para o plano de carreira)
      const finance = financeWithLedger(
        withExpHistory(
          grantEarnedExp(state.finance, offerExp),
          offerExp,
          `Market Maker · ${pl.name}`,
        ),
        {
          type: 'TRANSFER',
          currency: 'EXP',
          amount: offerExp,
          source: 'market_maker',
          refId: `mm-${action.playerId}-${Date.now()}`,
          metadata: { playerId: action.playerId, playerName: pl.name },
        },
      );
      // Notificação no inbox
      const inboxItem = {
        id: `mm_${Date.now()}`,
        messageType: 'PLAYER_SOLD' as const,
        category: 'FINANCEIRO' as const,
        tag: 'Market Maker',
        title: L('Market Maker comprou seu jogador', 'Market Maker bought your player'),
        body: L(`**${pl.name}** vendido por **${offerExp.toLocaleString(LOCALE)} EXP**. Saldo creditado na wallet.`, `**${pl.name}** sold for **${offerExp.toLocaleString(LOCALE)} EXP**. Balance credited to your wallet.`),
        timeLabel: L('agora', 'now'),
        colorClass: 'text-neon-yellow',
        read: false,
      };
      const inbox = [inboxItem, ...(state.inbox ?? [])];
      return {
        ...state, lineup, players, finance, inbox,
        managerScore: addManagerScore(state.managerScore, 'venda_jogador', L(`Vendeu ${pl.name} por ${offerExp.toLocaleString(LOCALE)} EXP`, `Sold ${pl.name} for ${offerExp.toLocaleString(LOCALE)} EXP`), Date.now()),
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
    // ── NEGOCIAÇÃO P2P ENTRE MANAGERS ──
    case 'SET_MARKET_OFFERS': {
      // Sincroniza a lista de propostas (recebidas/enviadas) vinda do servidor.
      return {
        ...state,
        managerProspectMarket: {
          ...state.managerProspectMarket,
          incomingOffers: action.incoming,
          outgoingOffers: action.outgoing,
        },
      };
    }
    case 'APPLY_OFFER_ACCEPTED_AS_BUYER': {
      // Minha proposta foi ACEITA (servidor já fez a transferência atômica):
      // entrego o jogador e SETO o OLE autoritativo (não re-deduz). Idempotente.
      const pid = action.player.id;
      const expHistory = action.ledgerEntry && !state.players[pid]
        ? [action.ledgerEntry, ...(state.finance.expHistory ?? [])].slice(0, 120)
        : state.finance.expHistory;
      const finance = { ...state.finance, ole: Math.max(0, Math.round(action.ole)), expHistory };
      if (state.players[pid]) return { ...state, finance };
      return {
        ...state,
        finance,
        players: { ...state.players, [pid]: { ...action.player, listedOnMarket: false } },
        managerScore: addManagerScore(state.managerScore, 'compra_jogador', L(`Contratou ${action.player.name} por proposta`, `Signed ${action.player.name} via offer`), Date.now()),
        managerProspectMarket: {
          ...state.managerProspectMarket,
          outgoingOffers: (state.managerProspectMarket.outgoingOffers ?? []).filter((o) => o.gamePlayerId !== pid),
        },
        inbox: [
          makeInboxItem(
            `offer-won-${Date.now()}`,
            'PLAYER_SOLD',
            'FINANCEIRO',
            L(`Proposta aceita: ${action.player.name} é teu.`, `Offer accepted: ${action.player.name} is yours.`),
            { body: L(`Pagaste ${action.priceExp.toLocaleString(LOCALE)} EXP. Jogador no plantel.`, `You paid ${action.priceExp.toLocaleString(LOCALE)} EXP. Player in the squad.`), deepLink: '/clube/elenco', hideFromHomeFeed: false },
          ),
          ...state.inbox,
        ].slice(0, 60),
      };
    }
    case 'APPLY_OFFER_SETTLED_AS_SELLER': {
      // Meu jogador foi VENDIDO por proposta aceita: removo do plantel e da
      // escalação. O EXP é creditado via wallet_credits ao logar (não re-credito
      // aqui pra não duplicar) — mostro o feito e pontuo a venda.
      if (!state.players[action.playerId]) return state;
      const players = { ...state.players };
      delete players[action.playerId];
      const lineup = { ...state.lineup };
      for (const [slot, pid] of Object.entries(lineup)) {
        if (pid === action.playerId) delete lineup[slot];
      }
      return {
        ...state,
        players,
        lineup,
        managerScore: addManagerScore(state.managerScore, 'venda_jogador', L(`Vendeu ${action.playerName} para ${action.buyerClubName}`, `Sold ${action.playerName} to ${action.buyerClubName}`), Date.now()),
        managerProspectMarket: {
          ...state.managerProspectMarket,
          ownListings: state.managerProspectMarket.ownListings.filter((l) => l.playerId !== action.playerId),
          incomingOffers: (state.managerProspectMarket.incomingOffers ?? []).filter((o) => o.gamePlayerId !== action.playerId),
        },
        inbox: [
          makeInboxItem(
            `offer-sold-${Date.now()}`,
            'PLAYER_SOLD',
            'FINANCEIRO',
            L(`Vendeste ${action.playerName} por ${action.creditExp.toLocaleString(LOCALE)} EXP.`, `You sold ${action.playerName} for ${action.creditExp.toLocaleString(LOCALE)} EXP.`),
            { body: L(`${action.buyerClubName} fechou a proposta. EXP creditado na carteira.`, `${action.buyerClubName} closed the deal. EXP credited to your wallet.`), deepLink: '/wallet', hideFromHomeFeed: false },
          ),
          ...state.inbox,
        ].slice(0, 60),
      };
    }
    case 'APPLY_SQUAD_SALE_AS_SELLER': {
      // Venda no MERCADO DE ELENCO (OLEFOOT) liquidada no servidor: removo os
      // jogadores vendidos do estado local (um ou o time inteiro). O OLEFOOT
      // já está no saldo do servidor (legacy_olefoot_credits) — aqui não se
      // credita nada, só se aplica a saída e se conta o feito.
      const vendidos = action.playerIds.filter((pid) => state.players[pid]);
      if (vendidos.length === 0) return state;
      const players = { ...state.players };
      for (const pid of vendidos) delete players[pid];
      const lineup = { ...state.lineup };
      for (const [slot, pid] of Object.entries(lineup)) {
        if (vendidos.includes(pid)) delete lineup[slot];
      }
      return {
        ...state,
        players,
        lineup,
        managerScore: addManagerScore(
          state.managerScore,
          'venda_jogador',
          L(`Vendeu ${action.titulo} para ${action.buyerClubName} por OLEFOOT`, `Sold ${action.titulo} to ${action.buyerClubName} for OLEFOOT`),
          Date.now(),
        ),
        inbox: [
          makeInboxItem(
            `squad-sale-${Date.now()}`,
            'PLAYER_SOLD',
            'FINANCEIRO',
            L(`Vendeste ${action.titulo} por ${action.priceOlefoot.toLocaleString(LOCALE)} OLEFOOT.`, `You sold ${action.titulo} for ${action.priceOlefoot.toLocaleString(LOCALE)} OLEFOOT.`),
            {
              body: L(`${action.buyerClubName} comprou no mercado de elenco. O OLEFOOT já está na tua carteira.`, `${action.buyerClubName} bought on the squad market. The OLEFOOT is already in your wallet.`),
              deepLink: '/wallet',
              hideFromHomeFeed: false,
            },
          ),
          ...state.inbox,
        ].slice(0, 60),
      };
    }
    case 'APPLY_LOAN_RETURNED_AS_BORROWER': {
      // Fim do empréstimo: o jogador ALUGADO volta pro dono (o servidor já
      // moveu). Aqui só se aplica a saída local — sem pontuação, não é venda.
      const devolvidos = action.playerIds.filter((pid) => state.players[pid]);
      if (devolvidos.length === 0) return state;
      const players = { ...state.players };
      for (const pid of devolvidos) delete players[pid];
      const lineup = { ...state.lineup };
      for (const [slot, pid] of Object.entries(lineup)) {
        if (devolvidos.includes(pid)) delete lineup[slot];
      }
      return {
        ...state,
        players,
        lineup,
        inbox: [
          makeInboxItem(
            `loan-returned-${Date.now()}`,
            'PLAYER_SOLD',
            'FINANCEIRO',
            L(`Empréstimo encerrado: ${action.titulo} voltou pro dono.`, `Loan ended: ${action.titulo} went back to the owner.`),
            { body: L('O contrato venceu. Toda a evolução que ele ganhou aqui vai junto.', 'The contract expired. All the progress made here goes with him.'), deepLink: '/clube/valores', hideFromHomeFeed: true },
          ),
          ...state.inbox,
        ].slice(0, 60),
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
      const ovr = overallFromAttributes(action.player.attrs, action.player.pos);
      if (Math.abs(ovr - mint) > 1) return state;
      if (state.finance.ole < action.priceExp) return state;
      let financeGenesis = withExpHistory(addOle(state.finance, -action.priceExp), -action.priceExp, 'mercado_genesis');
      financeGenesis = financeWithLedger(financeGenesis, {
        type: 'PURCHASE',
        currency: 'EXP',
        amount: -action.priceExp,
        source: 'mercado_genesis',
        refId: `buy-${pid}`,
        metadata: { playerId: pid, playerName: action.player.name },
      });


      return {
        ...state,
        finance: financeGenesis,
        managerScore: addManagerScore(state.managerScore, 'compra_jogador', L(`Contratou ${action.player.name}`, `Signed ${action.player.name}`), Date.now()),
        players: { ...state.players, [pid]: { ...action.player, listedOnMarket: false } },
      };
    }
    case 'BUY_MANAGER_PROSPECT': {
      // Server já fez a transferência cross-user. Aqui só:
      //  - garante saldo (server não checa EXP do comprador hoje — finance é local-only)
      //  - adiciona o jogador ao plantel local (idempotente: se já existe, no-op)
      //  - debita o preço do EXP local
      const pid = action.player.id;
      if (state.players[pid]) return state; // já no plantel: no-op (idempotente)
      if (state.finance.ole < action.priceExp) return state;
      const finance = financeWithLedger(
        withExpHistory(
          addOle(state.finance, -action.priceExp),
          -action.priceExp,
          'mercado_academia',
        ),
        {
          type: 'PURCHASE',
          currency: 'EXP',
          amount: -action.priceExp,
          source: 'mercado_academia',
          refId: `buy-${pid}`,
          metadata: { playerId: pid, playerName: action.player.name },
        },
      );
      return {
        ...state,
        finance,
        managerScore: addManagerScore(state.managerScore, 'compra_jogador', L(`Contratou ${action.player.name}`, `Signed ${action.player.name}`), Date.now()),
        players: {
          ...state.players,
          [pid]: { ...action.player, listedOnMarket: false },
        },
      };
    }
    case 'BUY_LEGACY_PLAYER': {
      const pid = action.player.id;
      if (!pid.startsWith('legacy-')) return state;
      if (state.players[pid]) return state;
      if (state.finance.ole < action.priceExp) return state;
      let financeLegacy = withExpHistory(addOle(state.finance, -action.priceExp), -action.priceExp, 'mercado_legacy');
      financeLegacy = financeWithLedger(financeLegacy, {
        type: 'PURCHASE',
        currency: 'EXP',
        amount: -action.priceExp,
        source: 'mercado_legacy',
        refId: `buy-${pid}`,
        metadata: { playerId: pid, playerName: action.player.name },
      });


      return {
        ...state,
        finance: financeLegacy,
        managerScore: addManagerScore(state.managerScore, 'compra_legend', L(`Garantiu a lenda ${action.player.name}`, `Secured the legend ${action.player.name}`), Date.now()),
        players: { ...state.players, [pid]: { ...action.player, listedOnMarket: false } },
      };
    }
    case 'CONFIRM_LEGACY_PURCHASE': {
      // O servidor já validou + debitou o OLE (autoritativo). Aqui só ALINHAMOS
      // o estado local: SETA o OLE (não re-deduz), grava o ledger e entrega o
      // player. Idempotente: se já tem o player, só sincroniza o saldo.
      const pid = action.player.id;
      const expHistory = action.ledgerEntry && !state.players[pid]
        ? [action.ledgerEntry, ...(state.finance.expHistory ?? [])].slice(0, 120)
        : state.finance.expHistory;
      const finance = { ...state.finance, ole: Math.max(0, Math.round(action.ole)), expHistory };
      if (state.players[pid]) return { ...state, finance };
      return {
        ...state,
        finance,
        players: { ...state.players, [pid]: { ...action.player, listedOnMarket: false } },
        // FABLE — Renome: contratar uma lenda é evento SOCIAL (+50).
        clubRenown: addRenown(state.clubRenown, 50, L(`Contratou a lenda ${action.player.name}`, `Signed the legend ${action.player.name}`), Date.now()),
        managerScore: addManagerScore(state.managerScore, 'compra_legend', L(`Garantiu a lenda ${action.player.name}`, `Secured the legend ${action.player.name}`), Date.now()),
      };
    }
    case 'GRANT_EARNED_EXP': {
      const a = Math.round(action.amount);
      if (a <= 0) return state;
      // Guard: teto por chamada para limitar impacto de dispatch manual no console.
      // Valor legítimo mais alto: recompensa de temporada ~500k EXP.
      if (a > 1_000_000) return state;
      const src = action.historySource?.trim() || L('Recompensa', 'Reward');
      let finance = grantEarnedExp(state.finance, a);
      finance = withExpHistory(finance, a, src);
      return { ...state, finance };
    }
    case 'CLAIM_SEASON_CHAMPION_PRIZE': {
      const ole = Math.max(0, Math.round(action.ole));
      const exp = Math.max(0, Math.round(action.exp));
      if (ole === 0 && exp === 0) return state;
      // Teto defensivo (mesma filosofia do GRANT_EARNED_EXP). Idempotência real
      // mora no flag `claimed` da tabela global_league_season_champions (cliente
      // só dispatcha após marcar claimed=true com sucesso).
      if (ole > 5_000_000 || exp > 5_000_000) return state;
      let finance = state.finance;
      if (ole > 0) finance = withExpHistory(addOle(finance, ole), ole, L(`Campeão Div ${action.division} · OLE`, `Div ${action.division} champion · OLE`));
      if (exp > 0) finance = withExpHistory(grantEarnedExp(finance, exp), exp, L(`Campeão Div ${action.division} · EXP`, `Div ${action.division} champion · EXP`));
      // FABLE — Renome: título de divisão é feito público (+100).
      const clubRenown = addRenown(state.clubRenown, 100, L(`Campeão da Divisão ${action.division}`, `Division ${action.division} champion`), Date.now());
      return { ...state, finance, clubRenown };
    }
    case 'CLAIM_KO_PRIZE': {
      // Prêmio do mata-mata diário (Coroa do Dia). Idempotência real mora no flag
      // `claimed` da tabela global_league_ko_prizes (cliente só dispatcha após
      // marcar claimed=true). Teto defensivo: final = 2.5M, total dia ≤ 3.45M.
      const exp = Math.max(0, Math.round(action.exp));
      if (exp === 0 || exp > 5_000_000) return state;
      const labels: Record<string, string> = {
        qualified: L('Classificação Mata-Mata', 'Knockout qualification'), r16: L('Vitória nas oitavas', 'Round of 16 win'),
        qf: L('Vitória nas quartas', 'Quarter-final win'), sf: L('Vitória na semifinal', 'Semi-final win'), final: L('Campeão do Dia', 'Champion of the Day'),
      };
      const src = `${L('Mata-Mata', 'Knockout')} · ${labels[action.stage] ?? action.stage} · EXP`;
      const finance = withExpHistory(grantEarnedExp(state.finance, exp), exp, src);
      // FABLE — Renome: Coroa do Dia +50; fases do mata-mata +10.
      const clubRenown = addRenown(
        state.clubRenown,
        action.stage === 'final' ? 50 : 10,
        labels[action.stage] ?? L('Mata-Mata do Dia', 'Daily Knockout'),
        Date.now(),
      );
      return { ...state, finance, clubRenown };
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
            L(`Tática "${name}" salva e pronta para partidas.`, `Tactic "${name}" saved and ready for matches.`),
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
              L(`Sem slots disponíveis para este treino (limite ${slots}).`, `No slots available for this training (limit ${slots}).`),
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
                L(`Limite de treinos colectivos em simultâneo: ${maxColl}.`, `Simultaneous team training limit: ${maxColl}.`),
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
      // Item 4: um jogador não pode estar em dois treinos ao mesmo tempo (evita evolução paralela grátis).
      const busyPlayerIds = new Set(
        state.manager.trainingPlans
          .filter((p) => p.status === 'running')
          .flatMap((p) => p.playerIds),
      );
      const freeIdsForPlan = playerIdsForPlan.filter((id) => !busyPlayerIds.has(id));
      if (freeIdsForPlan.length === 0) {
        return {
          ...state,
          inbox: [
            makeInboxItem(
              `train-busy-${Date.now()}`,
              'TRAINING_SLOT_BLOCKED',
              'TREINO',
              action.mode === 'coletivo'
                ? L('Todos do grupo já estão num treino em curso.', 'Everyone in the group is already in training.')
                : L('Jogador(es) já estão num treino em curso.', 'Player(s) already in training.'),
              { colorClass: 'text-red-400', deepLink: '/team/treino' },
            ),
            ...state.inbox,
          ].slice(0, 14),
        };
      }
      const plan = {
        id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        mode: action.mode,
        trainingType: action.trainingType,
        playerIds: freeIdsForPlan,
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
            L(`Treino iniciado (${action.trainingType}, ${plan.playerIds.length} jogador(es)).`, `Training started (${action.trainingType}, ${plan.playerIds.length} player(s)).`),
            { body: L('Fadiga e atributos serão atualizados ao concluir o plano.', 'Fatigue and attributes will update when the plan ends.'), deepLink: '/team' },
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
      // OLEFOOT PYTHON MODE — gate por absence tier (treinos rendem menos / nada)
      const absenceAtCompletion = evaluateAbsence(state.managerPresence, Date.now());
      const absenceMult = absenceAtCompletion.effect.trainingMultiplier;
      for (const plan of due) {
        const marketSnap = marketBroSnapshotFromPlayers(players);
        // Item 1: duração do plano escala o ganho (retorno decrescente). Constante por plano.
        const planHours = Math.max(
          1,
          (new Date(plan.endAt).getTime() - new Date(plan.startedAt).getTime()) / 3_600_000,
        );
        const durMult = durationGainMultiplier(planHours);
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
          // Item 3: potencial do jogador (evolutionRate 0.25–3) modula o ganho — jovem cresce rápido, veterano devagar.
          const rateMult =
            pl.evolutionRate != null && Number.isFinite(pl.evolutionRate)
              ? Math.max(0.25, Math.min(3, pl.evolutionRate))
              : 1;
          const boosted = amplifyTrainingResult(
            pl,
            base,
            trainingGainMultiplier(state.manager.staff, roleIds) * prospectMult * ctMult * absenceMult * durMult * rateMult,
          );
          const recovered = applyNutritionRecovery(boosted, state.manager.staff);
          // Viés de ESTILO: a sessão reforça a identidade tática do time
          // (posse→passe/tático, pressão→físico/marcação...). Descanso não treina.
          const styled = plan.trainingType === 'descanso'
            ? recovered
            : { ...recovered, attrs: applyStyleTrainingBias(recovered.attrs, styleAttrWeights(state.manager?.tacticalStyle)) };
          players[pid] = clampPlayerToEvolutionCap(ensureMintOverall(styled));
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
      if (due.length > 0) inboxParts.push(L(`${due.length} treino(s) concluído(s)`, `${due.length} training(s) completed`));
      if (dueTreat.length > 0) inboxParts.push(L(`${dueTreat.length} tratamento(s) concluído(s)`, `${dueTreat.length} treatment(s) completed`));

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

      // PONTUAÇÃO DO MANAGER — cada plano de treino concluído pontua.
      let scoreAfterTraining = state.managerScore;
      for (const plan of due) {
        scoreAfterTraining = addManagerScore(
          scoreAfterTraining,
          'treino_concluido',
          L(`Treino concluído (${plan.playerIds.length} jogador${plan.playerIds.length === 1 ? '' : 'es'})`, `Training completed (${plan.playerIds.length} player${plan.playerIds.length === 1 ? '' : 's'})`),
          Date.now(),
        );
      }

      return {
        ...state,
        players,
        playerHealth: syncedHealth,
        playerSeasonLedger,
        playerEvolutionTimeline,
        managerScore: scoreAfterTraining,
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
              L(`Todos os slots de tratamento estão ocupados (máx. ${maxTreat}).`, `All treatment slots are taken (max. ${maxTreat}).`),
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
              L('Este jogador já tem um tratamento em curso.', 'This player is already in treatment.'),
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
            L(`Tratamento iniciado: ${pl.name}`, `Treatment started: ${pl.name}`),
            {
              body: L(`Departamento médico (nível ${medLvl}). Conclusão em ~${TREATMENT_PLAN_DURATION_H}h.`, `Medical department (level ${medLvl}). Done in ~${TREATMENT_PLAN_DURATION_H}h.`),
              advisorLabel: L('Departamento médico', 'Medical department'),
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
        // PONTUAÇÃO DO MANAGER — evoluir profissional é ação de gestão (ponte que faltava).
        managerScore: addManagerScore(state.managerScore, 'upgrade_staff', L(`Evoluiu ${STAFF_LABELS[action.roleId]} (nível ${lvl})`, `Upgraded ${STAFF_LABELS[action.roleId]} (level ${lvl})`), Date.now()),
        inbox: [
          makeInboxItem(
            `staff-up-${Date.now()}`,
            'STAFF_LEVEL_UP',
            'STAFF',
            L(`${STAFF_LABELS[action.roleId]} subiu para nível ${lvl}.`, `${STAFF_LABELS[action.roleId]} reached level ${lvl}.`),
            { body: L('Efeitos em treinos e relatórios já aplicados ao plantel.', 'Training and report effects already applied to the squad.'), deepLink: '/clube/staff' },
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
    case 'CITY_QUICK_STORE_CAMPAIGN': {
      if (state.finance.ole < CITY_QUICK_STORE_COST_EXP) {
        return {
          ...state,
          inbox: [
            makeInboxItem(
              `city-store-fail-${Date.now()}`,
              'STRUCTURE_UPGRADE_FAIL',
              'CLUBE',
              L('Campanha na Megaloja cancelada: EXP insuficiente.', 'Megastore campaign cancelled: not enough EXP.'),
              { colorClass: 'text-red-400', deepLink: '/city' },
            ),
            ...state.inbox,
          ].slice(0, 14),
        };
      }
      let finance = withExpHistory(
        addOle(state.finance, -CITY_QUICK_STORE_COST_EXP),
        -CITY_QUICK_STORE_COST_EXP,
        L('Campanha Megaloja (cidade)', 'Megastore campaign (city)'),
      );
      // 2026-08-01: a campanha NÃO paga mais BRO. Convertia 540 EXP em R$ 75
      // sem cooldown nem teto — o jogo imprimia dinheiro de valor real em loop.
      // O efeito que faz sentido (apoio da torcida) continua logo abaixo.
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
            L(`Campanha na Megaloja: a torcida respondeu.`, `Megastore campaign: the fans responded.`),
            {
              body: L(`**${CITY_QUICK_STORE_COST_EXP} EXP** em marketing e logística. Pico de vendas e reforço do apoio da torcida.`, `**${CITY_QUICK_STORE_COST_EXP} EXP** in marketing and logistics. Sales spike and stronger fan support.`),
              deepLink: '/wallet',
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
              result.error ?? L('Upgrade de estrutura bloqueado.', 'Facility upgrade blocked.'),
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
      const broCost = result.ledgerReason === LEDGER_REASON_BRO
        ? (state.finance.broCents - (result.finance?.broCents ?? state.finance.broCents))
        : 0;
      let nextFinance = expCost > 0
        ? withExpHistory(result.finance!, -expCost, L(`Upgrade de estrutura: ${label}`, `Facility upgrade: ${label}`))
        : result.finance!;
      if (expCost > 0) {
        nextFinance = financeWithLedger(nextFinance, {
          type: 'STRUCTURE_UPGRADE', currency: 'EXP', amount: -expCost,
          source: `structure_${action.structureId}`, metadata: { structureId: action.structureId, newLevel },
        });
      } else if (broCost > 0) {
        nextFinance = financeWithLedger(nextFinance, {
          type: 'STRUCTURE_UPGRADE', currency: 'BRO', amount: -broCost,
          source: `structure_${action.structureId}`, metadata: { structureId: action.structureId, newLevel },
        });
      }
      const nextState: OlefootGameState = {
        ...state,
        structures: result.structures!,
        finance: nextFinance,
        managerScore: addManagerScore(state.managerScore, 'upgrade_estrutura', L(`${label} evoluiu para nível ${newLevel}`, `${label} upgraded to level ${newLevel}`), Date.now()),
      };
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
            L(`${label} evoluiu para nível ${newLevel}.`, `${label} upgraded to level ${newLevel}.`),
            {
              body:
                action.structureId === 'stadium'
                  ? L(`Pagamento em ${currencyLabel}. Expansão reforça o ambiente e o apoio em dias de jogo.`, `Paid in ${currencyLabel}. Expansion boosts the atmosphere and support on matchdays.`)
                  : L(`Pagamento registrado em ${currencyLabel}.`, `Payment recorded in ${currencyLabel}.`),
              deepLink: '/city',
            },
          ),
          ...nextState.inbox,
        ].slice(0, 14),
      };
    }
    case 'WALLET_SYNC_REFERRAL_CODE': {
      const w = walletOf(state);
      const norm = String(action.code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!norm || norm === w.myReferralCode) return state;
      return syncWalletToFinance(state, { ...w, myReferralCode: norm });
    }
    case 'WALLET_RECEIVE_PVP_REWARD': {
      const amount = Math.floor(action.amount);
      if (!Number.isFinite(amount) || amount <= 0) return state;
      // grantEarnedExp: conta em lifetime → dispara comissão pro indicador (5%).
      // Coerente com pacote de design: PvP é "ganho" do manager.
      const modeLabel = action.mode === 'quick' ? L('Liga Rápida', 'Quick League') : L('Liga Clássica', 'Classic League');
      const outcomeLabel = action.outcome === 'win' ? L('Vitória', 'Win') : action.outcome === 'draw' ? L('Empate', 'Draw') : L('Derrota', 'Loss');
      let finance = grantEarnedExp(state.finance, amount);
      finance = withExpHistory(finance, amount, `${outcomeLabel} · ${modeLabel}`);
      const opponentLine = action.opponentLabel ? ` vs ${action.opponentLabel}` : '';
      const inbox = [
        makeInboxItem(
          `pvp-${action.mode}-${Date.now()}`,
          'FINANCE_EXP_GAIN',
          'COMPETIÇÃO',
          `${outcomeLabel} · ${modeLabel}${opponentLine} (+${amount.toLocaleString(LOCALE)} EXP)`,
          {
            body: L(`Resultado registrado na ${modeLabel}. +${amount.toLocaleString(LOCALE)} EXP creditados.`, `Result recorded in the ${modeLabel}. +${amount.toLocaleString(LOCALE)} EXP credited.`),
            deepLink: '/',
          },
        ),
        ...state.inbox,
      ].slice(0, 14);
      return { ...state, finance, inbox };
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
              { colorClass: 'text-red-400', deepLink: '/wallet/network' },
            ),
            ...state.inbox,
          ].slice(0, 14),
        };
      }
      return syncWalletToFinance(state, result.state);
    }
    case 'WALLET_RESTORE_SNAPSHOT': {
      const w = walletOf(state);
      // Só restaura em wallet "vazia" (navegador limpo / novo dispositivo).
      // Nunca sobrescreve estado local que já tem dados duráveis.
      const hasLocalDurable = (w.ledger?.length ?? 0) > 0;
      if (hasLocalDurable) return state;

      const snap = action.snapshot;
      // Restaura só a data DURÁVEL. Saldos spot ficam do estado atual (o dinheiro
      // vem do servidor via créditos — confiar no snapshot inflaria saldo).
      const restored: import('@/wallet/types').WalletState = {
        ...w,
        ledger: snap.ledger ?? [],
        referralTree: snap.referralTree ?? w.referralTree,
        referralCommissions: snap.referralCommissions ?? w.referralCommissions,
        hasCompletedSwapKyc: snap.hasCompletedSwapKyc ?? w.hasCompletedSwapKyc,
        kycProfile: snap.kycProfile ?? w.kycProfile,
        myReferralCode: snap.myReferralCode ?? w.myReferralCode,
        sponsorId: snap.sponsorId ?? w.sponsorId,
        spotBroCents: state.finance.broCents,
        spotExpBalance: w.spotExpBalance,
      };
      return syncWalletToFinance(state, restored);
    }
    case 'DISMISS_INBOX_ITEM': {
      return {
        ...state,
        inbox: state.inbox.filter((i) => i.id !== action.id),
      };
    }
    case 'MARK_INBOX_READ': {
      return {
        ...state,
        inbox: state.inbox.map((i) => (i.id === action.id ? { ...i, read: true } : i)),
      };
    }
    case 'MARK_ALL_INBOX_READ': {
      return {
        ...state,
        inbox: state.inbox.map((i) => (i.read ? i : { ...i, read: true })),
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

      // Auto-registrar na liga global ao receber o plantel
      const allPlayers = Object.values(players);
      const avgOverall = allPlayers.length > 0
        ? Math.round(allPlayers.reduce((sum, p) => sum + overallFromAttributes(p.attrs, p.pos), 0) / allPlayers.length)
        : 70;
      const managerId = state.userSettings.managerProfile?.email ?? state.club.id;
      const clubName = state.club.name ?? 'Olefoot FC';
      const clubShort = state.club.shortName ?? clubName.slice(0, 3).toUpperCase();
      let globalLeagueMVP = state.globalLeagueMVP;
      if (globalLeagueMVP && !globalLeagueMVP.teams.some(t => t.managerId === managerId)) {
        globalLeagueMVP = registerTeam(globalLeagueMVP, managerId, clubName, clubShort, avgOverall);
      }

      return {
        ...state,
        players,
        playerSeasonLedger,
        playerEvolutionTimeline,
        lineup,
        manager: { ...state.manager, formationScheme },
        finance,
        globalLeagueMVP,
        userSettings: {
          ...state.userSettings,
          hasDoneOnboarding: true,
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
    case 'APPLY_CASUAL_RESULT_TO_LEAGUE': {
      // Resultado de partida casual (CLASSIC / Quick) que conta na liga
      // olefoot — manager passa a querer vencer mesmo nos modos rápidos.
      const leagueSeason = applyResultToLeagueSeason(state.leagueSeason, {
        scoreHome: action.result.scoreHome,
        scoreAway: action.result.scoreAway,
        result: action.result.result,
      });
      return { ...state, leagueSeason };
    }
    case 'ADMIN_PATCH_CLUB': {
      return {
        ...state,
        club: { ...state.club, ...action.partial },
      };
    }
    case 'VENDER_PARA_VARZEA': {
      const id = state.club.identidade;
      const p = state.players[action.playerId];
      const agora = action.agoraMs ?? Date.now();
      // Travas: janela aberta, jogador do pacote, nunca a Edição Fundação,
      // elenco não cai abaixo de 13. Qualquer falha = nada acontece.
      if (!id?.janelaAte || agora > Date.parse(id.janelaAte)) return state;
      if (!p || !id.pacote?.includes(p.id) || p.edicaoFundacao || p.id.startsWith('fundacao-')) return state;
      if (Object.keys(state.players).length <= JANELA_ELENCO_MINIMO) return state;
      const valor = valorNaVarzea(p);
      if (valor <= 0) return state;
      const players = { ...state.players };
      delete players[p.id];
      const lineup = Object.fromEntries(Object.entries(state.lineup ?? {}).filter(([, pid]) => pid !== p.id));
      let finance = addOle(state.finance, valor);
      finance = withExpHistory(finance, valor, L(`Venda pra várzea: ${p.name}`, `Sold to a local club: ${p.name}`));
      return {
        ...state,
        players,
        lineup,
        finance,
        club: { ...state.club, identidade: { ...id, pacote: id.pacote.filter((x) => x !== p.id) } },
      };
    }
    case 'SET_CLUB_IDENTIDADE': {
      // A formação escolhida na fundação é a do time: o manager não precisa
      // escolher de novo, e a Partida Rápida passa a jogar com ela.
      return {
        ...state,
        club: { ...state.club, identidade: action.identidade },
        manager: { ...state.manager, formationScheme: action.identidade.formacao },
      };
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



    case 'CREATE_GLOBAL_ROUND': {
      if (!state.olefootLeague) return state;
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


    case 'START_GLOBAL_ROUND': {
      if (!state.globalLeague?.currentRound) return state;
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
      const updatedLeague = finalizeRound(
        state.olefootLeague,
        currentRound.roundNumber,
        currentRound.fixtures
      );

      // ─── OLEFOOT PYTHON MODE — gera consequências da partida do manager ─
      const managerIdForImpact =
        state.userSettings?.managerProfile?.email ?? state.club.id ?? 'guest';
      // teamId em fixtures globais segue padrão `gt_${managerId-sanitized}`
      // (ver src/hooks/useAutoRegisterGlobalLeague.ts). Fallback: globalLeagueMVP
      // teams que têm managerId.
      const myTeamId =
        state.globalLeagueMVP?.teams.find((t) => t.managerId === managerIdForImpact)?.id ??
        `gt_${managerIdForImpact.replace(/[^a-z0-9]/gi, '_')}`;
      let consequenceStore = state.consequenceStore ?? EMPTY_CONSEQUENCE_STORE;
      consequenceStore = tickConsequences(consequenceStore, Date.now()).next;
      for (const fixture of currentRound.fixtures) {
        if (fixture.status !== 'finished') continue;
        const summary = buildGlobalImpactSummary({
          fixture,
          managerId: managerIdForImpact,
          clubId: state.club.id,
          myTeamId,
        });
        if (!summary) continue; // fixture não envolve o manager
        const events = eventsFromMatchSummary(summary);
        const newConsequences = materializeBatch(events);
        if (newConsequences.length) {
          consequenceStore = addManyConsequences(consequenceStore, newConsequences);
        }
      }

      return {
        ...state,
        globalLeague: {
          ...state.globalLeague,
          currentRound: finishedRound,
        },
        olefootLeague: updatedLeague,
        consequenceStore,
      };
    }

    case 'ADVANCE_GLOBAL_ROUND': {
      if (!state.globalLeague || !state.olefootLeague) return state;
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
    case 'ADMIN_SET_MANAGER_PROSPECT_CONFIG': {
      const createCostExp = Math.max(0, Math.min(50_000_000, Math.round(action.createCostExp)));
      return {
        ...state,
        managerProspectConfig: { createCostExp },
      };
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
    case 'ADMIN_PLAYER_CREATION_SET_PROMOTIONAL': {
      const url = action.promotionalCardUrl.trim();
      if (url && !url.startsWith('data:image/') && !/^https?:\/\//i.test(url)) return state;
      const managerProspectArtQueue = (state.managerProspectArtQueue ?? []).map((r) => {
        if (r.id !== action.requestId) return r;
        // Pode ser definido em qualquer fase do queue (admin pode preencher
        // antes ou depois de Lançar). Url vazia = limpa o campo.
        return { ...r, promotionalCardUrl: url || undefined };
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

      // Inbox: notifica o manager que a carta da Academia chegou. Inclui
      // payload `academy` com URLs + texto pré-formatado pra share.
      // deepLink abre o modal de entrega via /clube/elenco?academyDelivery=<id>
      const shareText = [
        L(`🎁 Acabei de receber minha carta da Academia OLE!`, `🎁 I just got my OLE Academy card!`),
        L(`Conheça ${pl.name}, ${pl.pos} da minha Academia.`, `Meet ${pl.name}, ${pl.pos} from my Academy.`),
        L(`Jogue no #Olefoot — seu time, sua história.`, `Play #Olefoot — your team, your story.`),
      ].join('\n');
      const deliveryInbox = makeInboxItem(
        `academy-delivery-${action.requestId}`,
        'ACADEMY_CARD_DELIVERED',
        'PLANTEL',
        L(`🎁 Carta da Academia OLE: ${pl.name}`, `🎁 OLE Academy card: ${pl.name}`),
        {
          tag: L('ACADEMIA', 'ACADEMY'),
          body: L('Sua carta foi entregue pela Olefoot. Compartilhe e mostre seu jogador pro mundo!', 'Your card was delivered by Olefoot. Share it and show your player to the world!'),
          deepLink: `/clube/elenco?academyDelivery=${action.requestId}`,
          colorClass: 'text-neon-yellow',
          academy: {
            playerId: req.playerId,
            playerName: pl.name,
            portraitUrl: draft,
            promotionalUrl: req.promotionalCardUrl,
            shareText,
          },
        },
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
        inbox: [deliveryInbox, ...state.inbox].slice(0, 14),
      };
    }
    /**
     * SMART-PROFILE Fase 2C — o servidor manda na progressão do jogador.
     *
     * O reducer já creditou a partida de forma otimista (FINALIZE_QUICK_PLAN) pra
     * tela não esperar a rede. Quando a resposta do servidor chega, ela VALE: o
     * servidor refez a conta partindo da ficha dele, com a nota conferida contra
     * os lances do plano que ele mesmo emitiu.
     *
     * Só atributos e XP. Economia, fadiga, moral, contratos e forma continuam do
     * reducer — o servidor ainda não credita isso.
     */
    case 'APLICAR_EVOLUCAO_DO_SERVIDOR': {
      if (!action.jogadores?.length) return state;
      const players = { ...state.players };
      let mudou = false;
      for (const j of action.jogadores) {
        const pl = players[j.id];
        if (!pl) continue;
        const attrs = { ...pl.attrs };
        let difere = false;
        for (const [k, v] of Object.entries(j.attrs ?? {})) {
          if (!(k in attrs) || typeof v !== 'number' || !Number.isFinite(v)) continue;
          if ((attrs as Record<string, number>)[k] !== v) { (attrs as Record<string, number>)[k] = v; difere = true; }
        }
        const xp = Number.isFinite(j.xp) ? j.xp : pl.evolutionXp;
        if (!difere && xp === pl.evolutionXp) continue;
        players[j.id] = { ...pl, attrs, evolutionXp: xp };
        mudou = true;
      }
      return mudou ? { ...state, players } : state;
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
        finance = withExpHistory(addOle(finance, -item.priceExp!), -item.priceExp!, L(`Loja · ${item.title}`, `Shop · ${item.title}`));
        finance = financeWithLedger(finance, {
          type: 'PURCHASE', currency: 'EXP', amount: -item.priceExp!,
          source: 'loja', metadata: { itemId: item.id, itemTitle: item.title },
        });
      }
      if (payBro) {
        finance = addBroCents(finance, -item.priceBroCents!);
        finance = syncWalletSpotBro(finance);
        finance = financeWithLedger(finance, {
          type: 'PURCHASE', currency: 'BRO', amount: -item.priceBroCents!,
          source: 'loja', metadata: { itemId: item.id, itemTitle: item.title },
        });
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
              L(`Compra: ${item.title}`, `Purchase: ${item.title}`),
              {
                body: L(`**${item.title}** foi para o inventário. Usa em **Meu Time** ao abrir um jogador.`, `**${item.title}** went to your inventory. Use it in **My Team** when opening a player.`),
                advisorLabel: L('Loja', 'Shop'),
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
            L(`Pedido: ${item.title}`, `Order: ${item.title}`),
            {
              body: L(`**${item.title}** — entrega de pack em desenvolvimento; o pagamento foi registrado.`, `**${item.title}** — pack delivery in development; the payment was recorded.`),
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
              body: L(`Ativaste **${item.title}** no teu clube.`, `You activated **${item.title}** at your club.`),
              advisorLabel: L('Loja', 'Shop'),
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
      finance = withExpHistory(finance, challenge.reward, L(`Desafio: ${challenge.title}`, `Challenge: ${challenge.title}`));
      // FABLE — Renome: desafio diário cumprido é feito público (+10).
      const clubRenown = addRenown(state.clubRenown, 10, L(`Desafio: ${challenge.title}`, `Challenge: ${challenge.title}`), Date.now());

      const inbox = [
        makeInboxItem(
          `challenge-${Date.now()}`,
          'FINANCE_EXP_GAIN',
          'DESAFIOS',
          `+${challenge.reward} EXP — ${challenge.title}`,
          {
            body: L(`Completaste o desafio "${challenge.title}". Recompensa creditada.`, `You completed the challenge "${challenge.title}". Reward credited.`),
            deepLink: '/wallet',
          },
        ),
        ...state.inbox,
      ].slice(0, 14);

      return {
        ...state,
        finance,
        inbox,
        clubRenown,
        dailyChallenges: {
          ...state.dailyChallenges,
          challenges,
        },
      };
    }
    case 'RESET':
      return createInitialGameState();

    case 'GLOBAL_LEAGUE_MATCH_RESULT': {
      // Aplica o mesmo delta de torcida usado nas partidas locais.
      // Vitória: +3 a +5 | Empate: -1 | Derrota: -4 a -6
      // Goleada (3+ gols de diferença) dá bônus extra.
      const goalDiff = action.goalsFor - action.goalsAgainst;
      const crowdDelta = action.win
        ? Math.min(5, 3 + Math.floor(Math.max(0, goalDiff - 1)))
        : action.draw
        ? -1
        : Math.max(-6, -4 - Math.floor(Math.max(0, -goalDiff - 1)));
      const newSupportPercent = Math.min(99, Math.max(0, state.crowd.supportPercent + crowdDelta));
      // FABLE — Renome: vitória na Liga Global é feito público (+5).
      const clubRenown = action.win
        ? addRenown(state.clubRenown, 5, L('Vitória na Liga Global', 'Global League win'), Date.now())
        : state.clubRenown;
      return {
        ...state,
        crowd: { supportPercent: newSupportPercent, moodLabel: crowdMood(newSupportPercent) },
        clubRenown,
      };
    }


    // ============================================================================







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

    case 'COACH_SET_ONBOARDING_STEP': {
      if (!state.manager.coach) return state;
      return {
        ...state,
        manager: {
          ...state.manager,
          coach: {
            ...state.manager.coach,
            memory: { ...state.manager.coach.memory, onboardingStep: action.step },
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

    case 'RECORD_LOCAL_LEAGUE_RESULT': {
      const prev = state.localLeagues ?? emptyLocalLeaguesState();
      const updated = applyResultToLocalLeague(
        prev[action.league],
        action.result,
        action.goalsFor,
        action.goalsAgainst,
      );
      return {
        ...state,
        localLeagues: { ...prev, [action.league]: updated },
      };
    }
    case 'CLAIM_GLOBAL_LEAGUE_MILESTONES_SILENT': {
      // Baseline silenciosa — marca marcos como vistos SEM grant EXP nem inbox.
      // Usado quando o user entra na liga global pela 1ª vez e o time já tem
      // stats retroativas (Edge Function simulou partidas). Daqui em diante,
      // só marcos NOVOS pagam.
      const already = new Set(state.globalLeagueMilestonesClaimed ?? []);
      const fresh = action.milestoneIds.filter((id) => !already.has(id));
      if (fresh.length === 0) return state;
      return {
        ...state,
        globalLeagueMilestonesClaimed: [...(state.globalLeagueMilestonesClaimed ?? []), ...fresh],
      };
    }
    case 'CLAIM_GLOBAL_LEAGUE_MILESTONES': {
      const already = new Set(state.globalLeagueMilestonesClaimed ?? []);
      const fresh = action.milestoneIds.filter((id) => !already.has(id));
      if (fresh.length === 0) return state;

      let finance = state.finance;
      const newNotes = fresh.map((id) => {
        const parsed = parseMilestoneId(id);
        if (!parsed) return null;
        const reward = milestoneExpReward(parsed.threshold);
        finance = grantEarnedExp(finance, reward);
        finance = withExpHistory(finance, reward, `Liga Global · ${milestoneLabel(parsed.category, parsed.threshold)}`);
        return makeInboxItem(
          `gl-milestone-${id}-${Date.now()}`,
          'SEASON_MILESTONE',
          'COMPETIÇÃO',
          milestoneInboxTitle(parsed.category, parsed.threshold),
          { body: milestoneInboxBody(parsed.category, parsed.threshold, reward) },
        );
      }).filter((x): x is NonNullable<typeof x> => x != null);

      const inbox = newNotes.length > 0 ? [...newNotes, ...state.inbox].slice(0, 14) : state.inbox;
      const claimed = [...(state.globalLeagueMilestonesClaimed ?? []), ...fresh];
      return { ...state, finance, inbox, globalLeagueMilestonesClaimed: claimed };
    }

    case 'ADMIN_START_GLOBAL_PLAYOFFS':
      return handleAdminStartGlobalPlayoffs(state);

    case 'SET_GLOBAL_LEAGUE_MVP_MIN_TEAMS': {
      if (!state.globalLeagueMVP) return state;
      return {
        ...state,
        globalLeagueMVP: {
          ...state.globalLeagueMVP,
          minTeamsRequired: action.minTeams,
        },
      };
    }

    case 'START_GLOBAL_PLAYOFF_ROUND':
      return handleStartGlobalPlayoffRound(state, action.roundNumber);

    case 'UPDATE_GLOBAL_PLAYOFF_LIVE': {
      if (!state.globalLeagueMVP || state.globalLeagueMVP.status !== 'playoffs') return state;
      const roundNumber = state.globalLeagueMVP.currentPlayoffRound;
      if (!roundNumber) return state;
      const round = state.globalLeagueMVP.playoffRounds.find(r => r.roundNumber === roundNumber);
      if (!round || round.status !== 'live' || !round.actualKickoffMs) return state;

      const elapsed = action.nowMs - round.actualKickoffMs;
      const currentMinute = Math.min(90, Math.floor(elapsed / GLOBAL_MATCH_CONSTANTS.GAME_MINUTE_MS));

      const updatedFixtures = round.fixtures.map(f => {
        const revealedEvents = f.events.filter((e: { minute: number }) => e.minute <= currentMinute);
        const scoreHome = revealedEvents.filter((e: { type: string; side: string }) => e.type === 'goal' && e.side === 'home').length;
        const scoreAway = revealedEvents.filter((e: { type: string; side: string }) => e.type === 'goal' && e.side === 'away').length;
        return { ...f, currentMinute, scoreHome, scoreAway };
      });

      return {
        ...state,
        globalLeagueMVP: {
          ...state.globalLeagueMVP,
          playoffRounds: state.globalLeagueMVP.playoffRounds.map(r =>
            r.roundNumber === roundNumber ? { ...r, fixtures: updatedFixtures } : r
          ),
        },
      };
    }

    case 'FINISH_GLOBAL_PLAYOFF_ROUND':
      return handleFinishGlobalPlayoffRound(state, action.roundNumber, action.finishedFixtures);

    case 'RESCHEDULE_PLAYOFF_ROUND': {
      if (!state.globalLeagueMVP) return state;
      return {
        ...state,
        globalLeagueMVP: {
          ...state.globalLeagueMVP,
          currentPlayoffRound: action.roundNumber,
          playoffRounds: state.globalLeagueMVP.playoffRounds.map(r =>
            r.roundNumber === action.roundNumber
              ? { ...r, scheduledKickoffMs: action.scheduledKickoffMs }
              : r
          ),
        },
      };
    }

    case 'RESET_GLOBAL_LEAGUE_MVP':
      return handleResetGlobalLeagueMVP(state);

    // ─── OLEFOOT PYTHON MODE ─────────────────────────────────────────
    case 'RECORD_CHECK_IN': {
      const now = Date.now();
      // Avalia ausência ANTES de atualizar lastLoginAt — esse é o tier que
      // foi atingido enquanto o manager estava fora.
      const absence = evaluateAbsence(state.managerPresence, now);
      const prevTier = state.managerPresence?.lastAbsenceTier;
      const nextPresence = recordCheckIn(state.managerPresence, action.managerId, now);

      // Engagement score — buff de vitória na Liga Global
      const totalPlayers = Object.keys(state.players ?? {}).length;
      const healthyPlayers = Object.values(state.players ?? {}).filter(
        (p) => !p.outForMatches && p.pos !== 'GOL_RESERVE',
      ).length;
      const engScore = computeEngagementScore({
        presence: nextPresence,
        totalPlayers,
        healthyPlayers,
        lastTrainingAt: (state as any)._lastTrainingAt,
        lastPurchaseAt: (state as any)._lastPurchaseAt,
      }, now);

      // Decide se precisa aplicar efeitos novos (lesões, queda torcida, inbox)
      if (!shouldApplyAbsenceEffects(prevTier, absence.tier)) {
        return {
          ...state,
          managerPresence: { ...nextPresence, lastAbsenceTier: absence.tier, engagementScore: engScore },
        };
      }

      // Aplica efeitos REAIS: lesões automáticas + apoio torcida + inbox
      const eligibleIds = Object.values(state.players)
        .filter((p) => p.pos !== 'GOL' && !p.outForMatches)
        .map((p) => p.id);
      const sideEffects = buildAbsenceSideEffects({
        managerId: action.managerId,
        clubId: state.club.id,
        eligiblePlayerIds: eligibleIds,
        tier: absence.tier,
        effect: absence.effect,
        hoursAbsent: absence.hours,
        now,
      });

      // Adiciona consequências ao store
      const prevStore = state.consequenceStore ?? EMPTY_CONSEQUENCE_STORE;
      const newStore = sideEffects.consequences.length
        ? addManyConsequences(prevStore, sideEffects.consequences)
        : prevStore;

      // Mescla inbox (novos no topo)
      const inbox = [...sideEffects.inboxItems, ...state.inbox];

      return {
        ...state,
        managerPresence: { ...nextPresence, lastAbsenceTier: absence.tier, engagementScore: engScore },
        consequenceStore: newStore,
        inbox,
      };
    }

    case 'CLAIM_LOGIN_BONUS': {
      const now = Date.now();
      // Garante presença mínima (caso UI dispatche antes de RECORD_CHECK_IN)
      const presence = state.managerPresence ?? recordCheckIn(undefined, 'guest', now);
      const { result, nextPresence } = attemptClaim(presence, now);

      // Se claim teve sucesso e é EXP, credita no saldo
      let finance = state.finance;
      if (result.claimed && result.reward?.kind?.startsWith('exp_') && result.reward.expAmount) {
        const rounded = Math.round(result.reward.expAmount);
        finance = {
          ...finance,
          ole: Math.max(0, Math.round((finance.ole ?? 0) + rounded)),
          expLifetimeEarned: (finance.expLifetimeEarned ?? 0) + rounded,
        };
      }
      return {
        ...state,
        managerPresence: nextPresence,
        lastLoginBonusClaim: result,
        finance,
      };
    }

    case 'CLEAR_LAST_BONUS_CLAIM':
      return { ...state, lastLoginBonusClaim: undefined };

    case 'ADD_CONSEQUENCES': {
      if (!action.consequences.length) return state;
      const store = state.consequenceStore ?? EMPTY_CONSEQUENCE_STORE;
      return {
        ...state,
        consequenceStore: addManyConsequences(store, action.consequences),
      };
    }

    case 'TICK_CONSEQUENCES': {
      const store = state.consequenceStore ?? EMPTY_CONSEQUENCE_STORE;
      const { next } = tickConsequences(store, Date.now());
      // Só atualiza se algo expirou (evita re-render desnecessário)
      if (Object.keys(next.active).length === Object.keys(store.active).length) {
        return state;
      }
      return { ...state, consequenceStore: next };
    }

    case 'HYDRATE_OLEFOOT_PYTHON_MODE': {
      // Merge defensivo: local SEMPRE vence em conflito (não regride trabalho da sessão)
      const localStore = state.consequenceStore ?? EMPTY_CONSEQUENCE_STORE;
      const mergedActive: Record<string, typeof localStore.active[string]> = {};
      // Remote primeiro — pode ser sobrescrito pelo local
      for (const c of action.consequences) {
        mergedActive[c.id] = c;
      }
      // Local vence
      for (const [id, c] of Object.entries(localStore.active)) {
        mergedActive[id] = c;
      }
      const mergedStore = { active: mergedActive, lastTickAt: Date.now() };

      // Presence: usa a mais recente (lastLoginAt mais alto)
      const localPresence = state.managerPresence;
      let nextPresence = localPresence;
      if (action.managerPresence) {
        if (!localPresence || action.managerPresence.lastLoginAt > localPresence.lastLoginAt) {
          nextPresence = action.managerPresence;
        } else {
          // Local mais recente: preserva mas pode reaproveitar streak/sessões do remoto
          nextPresence = {
            ...localPresence,
            totalSessions: Math.max(
              localPresence.totalSessions,
              action.managerPresence.totalSessions,
            ),
            bonusStreakSlots: Math.max(
              localPresence.bonusStreakSlots,
              action.managerPresence.bonusStreakSlots,
            ),
          };
        }
      }

      return {
        ...state,
        consequenceStore: mergedStore,
        managerPresence: nextPresence,
      };
    }

    default:
      return state;
  }
}
