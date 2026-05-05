import type { LiveMatchSnapshot, PossessionSide, MatchEventEntry, PitchPlayerState } from '@/engine/types';
import { FOOTBALL_TOTAL_SECONDS } from '@/engine/types';
import type { MatchTruthPhase, MatchTruthPlayer, CameraCue } from '@/bridge/matchTruthSchema';
import { Vehicle } from 'yuka';
import { MatchTruthWorld } from './MatchTruthWorld';
import { createAgentProfile } from '@/agents/AgentProfileFactory';
import {
  MatchPlayFsm,
  MATCH_OPENING_KICKOFF_WAIT_SEC,
  SECOND_HALF_KICKOFF_WAIT_SEC,
} from '@/matchState/matchPlayFsm';
import {
  shouldApplyGoalRestartStructuralMap,
  structuralKickoffAnchorWorld,
} from '@/match/matchFlowOrchestrator';
import { MatchEngine } from '@/match-engine/MatchEngine';
import { slotsForScheme, slotToWorld } from '@/match-engine/formations/catalog';
import { kickoffWorldXZ } from '@/engine/kickoffFormationLayout';
import type { FormationSchemeId } from '@/match-engine/types';
import { applyFormationPreset, mirrorPresetToAway } from '@/formation/presets';
import { StructuralReorganizationSystem, type StructuralTargetMap } from '@/simulation/StructuralReorganization';
import {
  applyTransitionCompactionToSlots,
  TRANSITION_COMPACTION_DECAY_SEC,
} from '@/simulation/transitionCompaction';
import { clampTargetToRoleZone, type TacticalContext } from '@/tactics/zones';
import { computeSlotPairWorldDelta } from '@/tactics/slotPairCorrelations';
import {
  applySteeringForPhase,
  createAgentBinding,
  rebuildNeighbors,
  setArriveTarget,
  stepAgentBodyYaw,
  stepVehicle,
  type AgentBinding,
  type AgentMode,
} from '@/agents/yukaAgents';
import { LiveLearningBridge } from '@/agents/liveLearningBridge';
import { SkillActivationSystem } from '@/match/skillActivation';
import { resolveTeamIntent, getTeamIntentBias, type TeamIntentContext } from '@/agents/TeamIntentResolver';
import type { TeamIntent } from '@/agents/types';
import { AgentRegulator } from '@/agents/yukaRegulator';
import {
  computeInterpose,
  computeOffsetSupport,
  computeDefensiveLineCohesion,
  getSupportOffset,
} from '@/agents/advancedSteering';
import { SpatialMemory } from '@/agents/spatialMemory';
import { FIELD_SCHEMA_VERSION } from '@/field-schema/constants';
import {
  CENTER_CIRCLE_RADIUS_M,
  clampToPitch,
  computeAttackPhase,
  FIELD_LENGTH,
  FIELD_WIDTH,
  GOAL_MOUTH_HALF_WIDTH_M,
  uiPercentToWorld,
  worldToUiPercent,
} from './field';
import {
  buildRefereeDispositionMaps,
  scanCausalLogConfusion,
  scanPenaltyAreaClumpRecovery,
  scanSpatialSwarmConfusion,
} from '@/simulation/matchConfusionReferee';
import { MatchSimulationEventBus } from '@/match/events/matchSimulationEventBus';
import {
  emitCausalMatchEvent,
  emitFromMatchEventEntry,
  emitPhaseIfChanged,
} from '@/match/events/emitFromEngineBridge';
import type { SimulationMatchPhase } from '@/match/events/matchSimulationContract';
import {
  applySpeedBoostToPlayerMaxSpeed,
  applySpeedBoostToBallVelocity,
  getActiveSpeedBoostConfig,
} from '@/match/liveMatchSpeedBoost';

import {
  MatchClock,
  type MatchClockPeriod,
  FIRST_HALF_DURATION_SEC,
  SECOND_HALF_DURATION_SEC,
} from './MatchClock';
import { BallSystem, type BallFlight } from './BallSystem';
import {
  createSimMatchState,
  pushSimEvent,
  pushMotorTelemetry,
  appendSimCausal,
  getOrCreateStats,
  type SimMatchState,
} from './SimMatchState';
import {
  attachGameSpiritPhase1Hint,
  detectGameSpiritPhase1Trigger,
  scheduleGameSpiritPhase1Request,
  resetGameSpiritPhase1Orchestrator,
} from '@/gamespirit/gameSpiritPhase1Orchestrator';
import {
  resolveTackle,
  nearestOpponentPressure01,
  findPassOptions,
  passInterceptLineMetrics,
  type AgentSnapshot,
} from './InteractionResolver';
import {
  resolvePassForPossession,
  resolveCrossForPossession,
  resolveDribbleBeat,
  resolveShotForPossession,
  logActionResolverDebug,
  type ShotPossessionResult,
} from './ActionResolver';
import { resolveTackleExecutionTier, type ActionExecutionTier } from '@/match/actionExecutionTier';
import {
  buildMotorActionOutcome,
  type MotorActionCanonicalKind,
  type MotorTelemetryPhaseTag,
  type MotorActionOutcome,
} from '@/match/motorActionOutcome';
import { transitionOutcomeFromSteal } from '@/playerDecision/carrierMacroBrain';
import {
  clampGoalkeeperTargetX,
  clampGoalkeeperTargetZ,
  clampWorldOutsideBothPenaltyAreas,
  clampWorldOutsidePenaltyAreaAtEnd,
  defendingPenaltyEndForTeam,
  goalKickEndFromBallPosition,
  getDefendingGoalX,
  getSideAttackDir,
  getThird,
  getZoneTags,
  isInsideOwnPenaltyArea,
  PENALTY_AREA_DEPTH_M,
  GOAL_AREA_DEPTH_M,
  type MatchHalf,
} from '@/match/fieldZones';
import {
  applyBallCentricShiftToSlotMap,
  buildSlotZoneProfile,
  clampWorldToOperativeTactical18,
  operativeZoneIdSet18,
  resolveZoneEngagement,
  worldPosToTactical18Zone,
} from '@/match/tacticalField18';
import {
  SHOT_BUDGET_COOLDOWN_AFTER_FORCE_SEC,
  SHOT_BUDGET_NO_ATTEMPT_SEC,
  SHOOT_OFFENSIVE_STALL_SEC,
} from '@/match/shootDecisionTuning';
import { hashStringSeed, unitFromParts } from '@/match/seededRng';
import { rngFromSeed, type RngDraw } from '@/match/rngDraw';
import {
  TACKLE_FOUL_PROB_BASE,
  TACKLE_FOUL_FAIRPLAY_WEIGHT,
  TACKLE_FOUL_PROB_CAP,
  FOUL_CARD_RED_P_LIGHT,
  FOUL_CARD_RED_P_FIRM,
  FOUL_CARD_RED_P_UGLY,
  FOUL_CARD_YELLOW_P_LIGHT,
  FOUL_CARD_YELLOW_P_FIRM,
  FOUL_CARD_YELLOW_P_UGLY,
  DRAW_FOUL_SUCCESS_BASE,
  DRAW_FOUL_MENTAL_BONUS,
  DRAW_FOUL_MAX_DIST,
} from '@/match/tacticalLiveDisciplineTuning';
import {
  normalizeMatchAttributes,
  scaleMatchAttributesForCoach,
  createPlayerMatchRuntimeFromPitch,
  compositePasse,
  pushLastAction,
  pushMemoryAction,
  pushMemoryDuel,
  pushMemoryPassTarget,
  bumpPlayerPressure,
  bumpPlayerConfidence,
  awayCognitiveArchetypeForSlot,
  defaultAwayMatchAttributes,
  tickTacticalDiscipline,
  derivePersonalityFromAttrs,
  type MatchPlayerAttributes,
  type MatchPlayerPersonality,
  type PlayerMatchRuntime,
  type MatchCognitiveArchetype,
} from '@/match/playerInMatch';
import type { HomeStaffMatchBonuses } from '@/systems/staffBenefits';
import {
  blendThreeLocomotionCaps,
  clampVehicleMaxSpeed,
  classifyLocomotionTier,
  fatigueSpeedMultiplier,
  INJURED_ON_PITCH_SPEED_MULT,
  locomotionJogSpeed,
  locomotionSprintSpeed,
  locomotionWalkSpeed,
  normalizeSpeedAttr01,
  smoothRunBlend,
  targetRunBlendFromSteering,
  type LocomotionSteeringContext,
} from '@/match/playerSpeedTuning';
import {
  POSSESSION_LOCK_SEC,
  FATIGUE_RATE_BASE,
  STAMINA_RECOVERY_BASE,
  CONFIDENCE_DELTA_GOOD,
  CONFIDENCE_DELTA_BAD,
} from '@/match/matchSimulationTuning';

import { sfGetSubzone, sfShapeCorrection, sfRoleFromSlot } from '@/smartfield/smartfieldBridge';
import { deriveTeamCollectiveState, computeLineCohesionDelta, type TeamCollectiveState } from '@/playerDecision/teamCollectiveState';
import { deriveTeamMorale, type TeamMoraleState } from '@/playerDecision/teamMorale';
import { clampHeadingChange, computeTurnRadius } from '@/behaviorAI/angularInertia';
import { createMomentumBuffState, activateMomentumBuff, tickMomentumBuff, isMomentumBuffActive, type MomentumBuffState } from '@/polishAI/momentumBuff';
import { createTacticalAdaptationState, recordPossessionLoss, recomputeAnchorAdjustment, type TacticalAdaptationState } from '@/behaviorAI/tacticalAdaptation';
import { applyCaptainInfluence, createCaptainInfluenceState } from '@/behaviorAI/captainInfluence';
import { shouldShieldBall, computeShieldPosition } from '@/polishAI/shielding';
import { resolveLooseBall } from '@/polishAI/looseBall';
import { triggerMissedGoalReaction, triggerGoalCelebration } from '@/polishAI/reactionSignals';
import { computeFoulArgumentPositions } from '@/polishAI/foulArgument';
import FanFrustrationSystem, { FrustrationRulesRegistry } from '@/match/fanFrustration/FanFrustrationSystem';
import { createSeededRng, hashTurnoverSeed, pickPlayAfterTurnover } from './pickPlayAfterTurnover';
import {
  test2dPassAfterTurnoverLine,
  test2dCarryAfterTurnoverLine,
  test2dInterceptCutPassLine,
  test2dShotWindupLine,
  test2dGkBallFromShotLine,
  test2dShotMissDetailLine,
  test2dPassIncompleteLine,
  test2dReceptionFumbleLine,
  test2dDribbleStrippedLine,
  test2dDribbleLooseLine,
  test2dCrossFailLine,
  test2dPassSolidLine,
  test2dDribbleSuccessLine,
  test2dHighPressLine,
  test2dChanceCreatedLine,
  type Test2dTurnoverTag,
} from '@/engine/test2d/test2dLiveFeedNarrative';
import {
  createCausalBatch,
  type CausalMatchEvent,
  type ShotStrikeProfile,
} from '@/match/causal/matchCausalTypes';
import {
  anchorPullScaleForOffBallAction,
  blendOffBallDestination,
  scaleRadiiForTeamPossession,
  scaleRadiiForZoneEngagement,
  scaleRadiiForOverlapReturn,
  tacticalRadiiFor,
} from '@/simulation/tacticalAnchorBlend';
import { clampWorldTargetToSlotFlankCorridor } from '@/match/tacticalGrid12';
import {
  PlayerDecisionEngine,
  profileForSlot,
  type PlayerAction,
  type OnBallAction,
  type OffBallAction,
  type DecisionContext,
  type PlayerProfile,
  type BallSector,
} from '@/playerDecision';
import { detectTeamPhase } from '@/playerDecision/ContextScanner';
import { isCommandActive, commandDecisionBias } from '@/voiceCommand/commandQueue';
import { identifyFieldZone } from '@/playerDecision/ContextScanner';
import { recordCrossTelegraphed, recordCrossConcluded } from '@/playerDecision/crossTelegraphTelemetry';
import { computeGoalThreat, type GoalThreat, type ThreatTrend } from '@/playerDecision/ThreatModel';
import { buildGoalContext } from '@/match/goalContext';
import type { TeamTacticalStyle } from '@/tactics/playingStyle';
import { getPlayerIntention } from '@/tactical';
import { getZoneFromNormalizedPosition } from '@/tactical';
import type { FieldZoneId } from '@/tactical';
const FIXED_DT = 1 / 60;
/**
 * Tempo mínimo com bola nas mãos do GR antes do pontapé (s).
 * ~3s dá tempo aos rivais de sair da grande área (evac no freeze) sem colapsar na bola.
 */
const GK_RESTART_KICK_DELAY_SEC = 3;
const DECISION_DEBUG = (globalThis as { __OF_DECISION_DEBUG__?: boolean }).__OF_DECISION_DEBUG__ === true;

function invertLineup(matchLineup: Record<string, string>): Map<string, string> {
  const m = new Map<string, string>();
  for (const [slot, pid] of Object.entries(matchLineup)) {
    m.set(pid, slot);
  }
  return m;
}

function roleFromSlotId(slot: string): string {
  if (slot === 'gol') return 'gk';
  if (slot === 'zag1' || slot === 'zag2' || slot === 'le' || slot === 'ld' || slot === 'vol') return 'def';
  if (slot === 'mc1' || slot === 'mc2') return 'mid';
  return 'attack';
}

/**
 * Sprint L4 — decide se as instruções de pressing se aplicam neste momento.
 * Triggers contextuais: onTurnover, whenLosing, whenLeading.
 * Se nenhum trigger condicional, sempre aplica baseline.
 */
function def_pressingApplies(
  _carrier: AgentSnapshot,
  pressing: NonNullable<TacticalManagerParams['pressing']>,
  simState: { homeScore?: number; awayScore?: number; lastTurnoverTickAgo?: number } & Record<string, unknown>,
): boolean {
  const triggers = pressing.triggers;
  // Sempre aplica modulação baseline (intensidade + zone) — triggers só amplificam.
  if (triggers.onTurnover && (simState as any).recentTurnoverTicks != null && (simState as any).recentTurnoverTicks < 60) {
    return true;
  }
  const homeScore = (simState.homeScore as number) ?? 0;
  const awayScore = (simState.awayScore as number) ?? 0;
  if (triggers.whenLosing && homeScore < awayScore) return true;
  if (triggers.whenLeading && homeScore > awayScore) return true;
  // Sem trigger contextual disparado → ainda aplica modulação base (intensidade + zone)
  return true;
}

function computeBallSector(ballZ: number): BallSector {
  const third = FIELD_WIDTH / 3;
  if (ballZ < third) return 'left';
  if (ballZ > third * 2) return 'right';
  return 'center';
}

/** 0 = longe do golo adversário, 1 = zona final (corrida vs andar). */
function attackProximity01(worldX: number, attackDir: 1 | -1): number {
  const nx = attackDir === 1 ? worldX / FIELD_LENGTH : 1 - worldX / FIELD_LENGTH;
  return Math.max(0, Math.min(1, (nx - 0.26) / 0.66));
}

interface AgentEx extends AgentBinding {
  decision: PlayerDecisionEngine;
  profile: PlayerProfile;
  matchAttrs: MatchPlayerAttributes;
  /** Sprint L2 — personalidade derivada dos atributos. Modula comportamento. */
  personality: MatchPlayerPersonality;
  matchRuntime: PlayerMatchRuntime;
  cognitiveArchetype: MatchCognitiveArchetype;
  /** Esforço locomotor suavizado (0 ≈ andar, 1 ≈ sprint). */
  locomotionRunBlendSmoothed: number;
  /** Discrete locomotion state derived from run blend (for renderer / animation). */
  locomotionState?: 'walk' | 'jog' | 'sprint';
  /** Tier narrativo 1–5: caminhando_lento → muito_veloz. Usado na UI e narração. */
  locomotionTier?: import('@/match/playerSpeedTuning').LocomotionTier;
  /** Jogador lesionado ainda em campo (aguarda substituição) — força tier 1. */
  injuredOnPitch?: boolean;
  strongFoot?: import('@/entities/types').PlayerStrongFoot;
  archetype?: import('@/entities/types').PlayerArchetype;
}

interface TacticalManagerParams {
  tacticalMentality: number;
  defensiveLine: number;
  tempo: number;
  tacticalStyle?: TeamTacticalStyle;
  /** Partida em casa (calendário) — afecta bónus do treinador fora. */
  isHomeFixture?: boolean;
  /** Bónus de staff Casa pré-calculados (undefined = neutro). */
  homeStaffMatch?: HomeStaffMatchBonuses | null;
  /** Buff ATIVO por jogador (extra acima do coletivo). playerId → multiplicador de atributos. */
  homeStaffPlayerBoosts?: Record<string, number>;
  /** Sprint L4 — Instruções contextuais de prensa (default: mid + intensity 60). */
  pressing?: {
    triggers: {
      onTurnover: boolean;
      whenLosing: boolean;
      whenLeading: boolean;
    };
    zone: 'high' | 'mid' | 'low';
    intensity: number; // 0-100
  };
  /** Sprint L4 — Marcações individuais designadas (homePlayerId → opponentPlayerId). */
  markingAssignments?: Record<string, string>;
  /**
   * Bloco D — Modo de linha tática.
   * - `fixed`: usa `defensiveLine` exato do manager.
   * - `high`: força linha alta independente do contexto.
   * - `low`: força linha baixa.
   * - `reactive`: ajusta dinamicamente — sobe quando time ganha + spirit favorável,
   *    recua quando perde / pressionado. Default = `fixed`.
   */
  defensiveLineMode?: 'fixed' | 'high' | 'low' | 'reactive';
}

type ShotPlanKind = 'goal' | 'miss_wide' | 'hold' | 'parry' | 'block_rebound';

/** Remate em voo: causal + efeitos de jogo só após a bola chegar ao ponto físico (sem teletransporte). */
interface ShotPendingResolution {
  phase: 'primary' | 'rebound';
  plan: ShotPlanKind;
  shooterId: string;
  shooterSide: PossessionSide;
  defSide: PossessionSide;
  longRange: boolean;
  shotRes: ShotPossessionResult;
  causalOutcome: 'goal' | 'save' | 'block' | 'miss' | 'wide';
  rebound?: { toX: number; toZ: number; speed: number };
}

export class TacticalSimLoop {
  world = new MatchTruthWorld();
  fsm = new MatchPlayFsm();
  homeAgents: AgentEx[] = [];
  awayAgents: AgentEx[] = [];
  ballVehicle = new Vehicle();
  readonly eventBus = new MatchSimulationEventBus();
  readonly liveLearning = new LiveLearningBridge();
  readonly skillActivation = new SkillActivationSystem();
  private homeTeamIntent: TeamIntent = 'control_game';
  private awayTeamIntent: TeamIntent = 'control_game';
  private readonly teamIntentRegulator = new AgentRegulator(2000, 500);
  private readonly homeSpatialMemory = new SpatialMemory();
  private readonly awaySpatialMemory = new SpatialMemory();
  private readonly matchEngine = new MatchEngine();
  private readonly structuralSys = new StructuralReorganizationSystem();

  private matchClock = new MatchClock();
  private ballSys = new BallSystem();
  simState = createSimMatchState();

  private liveRef: LiveMatchSnapshot | null = null;
  private lastEventId = '';
  private cueQueue: CameraCue[] = [];
  private homeRosterSig = '';
  private accumulator = 0;
  private renderBlend = 1;
  private frameStartBall = { x: 0, y: 0, z: 0 };
  /** Velocidades no início do período de render (Hermite entre passos fixos — bola mais contínua ao vivo). */
  private frameStartBallVel = { x: 0, z: 0 };
  private frameStartBallVy = 0;
  private frameStartPlayers = new Map<string, { x: number; z: number }>();
  /** Modo da bola no início do frame — se mudar, desactiva interpolação para evitar "zip" visual. */
  private frameStartBallMode: string = 'loose';
  private lastSimPhase: SimulationMatchPhase | null = null;
  private shirtNumbers = new Map<string, number>();
  /** New carrier → cannot pass back to this peer until `until` sim time */
  private turnoverPassBlock = new Map<string, { peerId: string; until: number }>();
  /** Receptor não devolve logo ao passe (mobilidade / terceiro homem — E. Barros). */
  private passReturnBlock = new Map<string, { fromId: string; until: number }>();
  /** Passador deve trocar de setor após combinar com o novo portador. */
  private passMobilityHint = new Map<string, { carrierId: string; until: number; forward: boolean }>();
  /**
   * PR2 — Lateral telegrafou cruzamento. Atacantes recebem ponto esperado
   * de entrega (2º pau / pênalti) e antecipam a chegada na área ~0.3s antes
   * da bola ser cruzada. Chave = id do ATACANTE (receptor do sinal).
   */
  private crossIncomingHint = new Map<string, {
    senderId: string;
    expectedX: number;
    expectedZ: number;
    until: number;
  }>();
  /** Defesa deste lado desorganizada até `simTime` (passe crítico recente do adversário). */
  private defensiveShapeBreakUntil: Record<PossessionSide, number> = { home: -1e9, away: -1e9 };
  /** Receptor com passe crítico: decisão mais rápida até `simTime`. */
  private executionBoostUntil = new Map<string, number>();
  private executionBoostImpact01 = new Map<string, number>();
  /** Equipe que saiu no 1.º tempo — o 2.º saída de bola é a outra (IFAB). */
  private firstKickoffPossessionSide: PossessionSide = 'home';
  private initialized = false;
  // Deadball / throw-in state
  private deadBallUntil = -1;
  /** Q3 — Cobrador da bola parada atual (free kick). Populado quando há falta. */
  private pendingFreeKickTakerId: string | null = null;
  private pendingThrowIn: { fetcherId: string; x: number; z: number; restartType: 'throw_in' | 'corner_kick' | 'goal_kick' } | null = null;
  /** Callback opcional disparado quando uma falta acontece dentro da grande área (pênalti). */
  private onPenaltyAwardedCallback: ((info: {
    attackingSide: PossessionSide;
    foulerId: string;
    foulerSide: PossessionSide;
    victimId: string;
    takerName: string;
    takerId: string;
    minute: number;
  }) => void) | null = null;
  /** Q6 — Callback para escanteio (abre SetPieceModal). */
  private onCornerAwardedCallback: ((info: {
    side: PossessionSide;
    cornerSide: 'left' | 'right';
    minute: number;
  }) => void) | null = null;
  private prevClockPeriod: MatchClockPeriod | null = null;
  /** Track carrier changes for collective trigger */
  private prevCarrierId: string | null = null;
  /** Contexto do tick atual para `applyTurnoverPlay` após interceptação / drible falho. */
  private turnoverCtx: {
    manager: TacticalManagerParams;
    slotTargetFor: (a: AgentEx) => { x: number; z: number };
  } | null = null;

  private lastShotAttemptSimTime: Record<PossessionSide, number> = { home: -1e9, away: -1e9 };
  private lastShotBudgetCoolSimTime: Record<PossessionSide, number> = { home: -1e9, away: -1e9 };
  private shotBudgetArmed: Record<PossessionSide, boolean> = { home: false, away: false };
  private offensiveStallAccum: Record<PossessionSide, number> = { home: 0, away: 0 };
  /** Último `manager` passado a `integrateFixed` — usado em resolução de acções e confiança. */
  private stepManagerParams: TacticalManagerParams | null = null;
  /** Evita recursão infinita interceptação → passe → interceptação no mesmo tick. */
  private applyTurnoverDepth = 0;
  /**
   * Passe marcado para interceptação: primeiro voo físico até o ponto na linha, depois posse / eventos.
   * Sem teletransporte nem “flash” — contacto só após a bola percorrer o traço no campo.
   */
  private pendingPassIntercept: {
    interceptorId: string;
    passerId: string;
    stealX: number;
    stealZ: number;
    possessionBefore: PossessionSide;
    contactX: number;
    contactZ: number;
    deadlineSimTime: number;
    icKey: string;
    narrativeLine?: string;
    causalReason?: string;
  } | null = null;
  /** Goal threat levels: each team's attacking threat from the previous tick */
  private homeThreat: GoalThreat = { level: 0, trend: 'stable', factors: { ballZone: 0, openShooters: 0, defensiveDisorganization: 0, numericalAdvantage: 0, progressionSpeed: 0, carrierDanger: 0 } };
  private awayThreat: GoalThreat = { level: 0, trend: 'stable', factors: { ballZone: 0, openShooters: 0, defensiveDisorganization: 0, numericalAdvantage: 0, progressionSpeed: 0, carrierDanger: 0 } };

  /** Possession last frame — pulse compaction for team that lost the ball. */
  private prevLoopPossession: PossessionSide | null = null;
  private transitionCompaction = 0;
  private transitionLoserSide: PossessionSide | null = null;
  /** Após remate para fora: reformação tipo saída de bola sem roubar a bola ao GR no kickoff intermédio. */
  private skipKickoffBallAssign = false;
  /** Após golo: bola e executor no centro durante FSM `kickoff`; o passe de saída corre em `kickoff`→`live`. */
  private pendingPostGoalCenterKickoff = false;
  /** Sequência física do remate (primário ± rebote); causal `shot_result` na conclusão da perna certa. */
  private shotPending: ShotPendingResolution | null = null;
  /** Após bola com o GR (saída de baliza): avanço curto + pontapé (passe livre / meio / chutão) fora da área. */
  private gkRestart: { gkId: string; kickAt: number } | null = null;
  /** Após saída do GR: não puxar `directPlayersToChaseBall` até este instante (evita colapso na área). */
  private gkReleaseChaseSuppressionUntil = -1e9;
  /** 2.º tempo: após troca de campo, instante em que o atacante executa o pontapé de saída (bola ainda ao centro). */
  private secondHalfKickoffAt: number | null = null;
  /** 1.º tempo: após `syncLive`, bola morta no centro até ao passe de saída (dois jogadores próximos). */
  private matchOpeningKickoffAt: number | null = null;
  /** Colega posicionado junto ao executor no apito inicial (passe curto entre os dois). */
  private matchOpeningPartnerId: string | null = null;
  /** Cooldown do árbitro lógico (confusão causal / ajuntamento espacial). */
  private lastConfusionRefereeWorldTime = -1e9;
  /** Evita spam de “momentos” pedagógicos no feed ao vivo 2D. */
  private live2dLearningCooldownUntil = -1e9;
  private passChainCount: Record<PossessionSide, number> = { home: 0, away: 0 };
  private homeCollective: TeamCollectiveState | null = null;
  private awayCollective: TeamCollectiveState | null = null;
  /** Sprint L5 — Moral coletiva por time (recomputada periodicamente). */
  private homeMorale: TeamMoraleState | null = null;
  private awayMorale: TeamMoraleState | null = null;
  private moraleLastComputedTick = -10;
  private homeMomentumBuff: MomentumBuffState = createMomentumBuffState('home');
  private awayMomentumBuff: MomentumBuffState = createMomentumBuffState('away');
  private homeAdaptation: TacticalAdaptationState = createTacticalAdaptationState('home');
  private awayAdaptation: TacticalAdaptationState = createTacticalAdaptationState('away');
  private homeCaptainId: string | null = null;
  private agentProfileCache: Map<string, import('@/agents/types').AgentProfile> = new Map();
  // Rhythm and visual focus
  private matchRhythm: 'fast' | 'normal' | 'slow' = 'normal';
  private timeScale: number = 1;
  private timeScaleTarget: number = 1;
  private fanFrustration: FanFrustrationSystem | null = null;

  constructor() {
    // SPEED BOOST: Bola mais rápida para ações mais dinâmicas
    const speedConfig = getActiveSpeedBoostConfig();
    this.ballVehicle.boundingRadius = 0.42;
    this.ballVehicle.maxSpeed = applySpeedBoostToBallVelocity(144);
    this.ballVehicle.maxForce = 600;
    this.ballVehicle.mass = 0.3;
    // Fan frustration system: provides events that can nudge player behaviour
    try {
      this.fanFrustration = new FanFrustrationSystem(FrustrationRulesRegistry);
      this.fanFrustration.on('FrustrationEvent', (ev: any) => {
        // Best-effort: nudge offending player(s) by setting transient flags on agents
        if (ev.jogador) {
          const ag = this.findAgent(ev.jogador);
          if (!ag) return;
          switch (ev.ruleId) {
            case 'LATERAL_NAO_AVANCA':
            case 'LATERAL_SOBE_SEM_COBERTURA':
              // encourage lateral to advance next decision
              (ag as any)._nudgeAdvance = Math.max(((ag as any)._nudgeAdvance || 0), 1);
              break;
            case 'ATACANTE_RECUA_PARA_GOLEIRO':
            case 'ATACANTE_PASSA_EM_POSICAO_GOL':
            case 'ATACANTE_PASSA_EM_POS_FINAL':
              // discourage passes to keeper and encourage finishing / forward options
              (ag as any)._nudgeAvoidKeeperPass = true;
              (ag as any)._nudgePreferFinish = true;
              break;
            case 'PONTA_RECUA_1x1':
              (ag as any)._nudgeAttack1v1 = true;
              break;
            default:
              break;
          }
          // Apply an immediate morale penalty proportional to the penalty magnitude
          try {
            const pen = Math.abs(ev.penalidade) || 0;
            const moraleDelta = -Math.min(0.22, pen / 120); // small immediate drop (0..~0.2)
            if (ag && ag.matchRuntime) {
              ag.matchRuntime.moraleRuntime = Math.max(-1, Math.min(1, ag.matchRuntime.moraleRuntime + moraleDelta));
            }
            // Learning: increment a transient counter to track repeated offences and push a learning line in test2d
            (ag as any)._frustrationCount = ((ag as any)._frustrationCount || 0) + 1;
            if ((ag as any)._frustrationCount >= 2) {
              this.pushLive2dLearningLine(
                `Aprender: ${ev.type} pelo jogador ${ag.slotId ?? ag.id} (repetição)`,
                'bad',
                { playerId: ag.id, minGapSec: 3 },
              );
            }
          } catch (e) {
            // best effort
          }
        }
      });
    } catch (e) {
      this.fanFrustration = null;
    }
  }

  /**
   * Heuristic rhythm controller: sets `matchRhythm` and `timeScale` based on context.
   */
  private updateRhythm() {
    let next: 'fast' | 'normal' | 'slow' = 'normal';
    const openCounter = this.turnoverCtx != null;
    const threatHigh = Math.max(this.homeThreat.level, this.awayThreat.level) > 0.56;
    if (openCounter) next = 'fast';
    else if (threatHigh && this.simState.minute > 75) next = 'slow';
    else if (this.homeCollective && this.awayCollective) {
      if (this.homeCollective.phase === 'build_up' || this.awayCollective.phase === 'build_up') next = 'slow';
      else next = 'normal';
    }
    this.matchRhythm = next;
  this.timeScaleTarget = next === 'fast' ? 1.0 : next === 'slow' ? 1.12 : 1.0;
  }

  private triggerHighlight(kind: 'danger' | 'goalChance', intensity = 0.9, durationMs = 900) {
  this.timeScaleTarget = 0.75;
  this.cueQueue.push({ kind: kind === 'goalChance' ? 'goal_shake' : 'zoom_finish', intensity, at: this.world.simTime });
    const restoreAt = this.world.simTime + durationMs / 1000;
    setTimeout(() => {
      if (this.world.simTime >= restoreAt) this.timeScale = 1;
    }, durationMs + 10);
  }

  /** Narração rica do feed só em ao vivo 2D (`test2d`). */
  private isTest2dLiveFeed(): boolean {
    return this.liveRef?.mode === 'test2d';
  }

  /**
   * Chutão do GR: durante a supressão pós-saída, a bola “lógica” para slots/motor não avança
   * além de `maxLeadM` a partir do ponto do pontapé — evita que o bloco inteiro salte para o último terço.
   */
  private tacticalBallXYForRunningSlots(rawX: number, rawZ: number, maxLeadM = 24): { x: number; z: number } {
    if (
      this.world.simTime >= this.gkReleaseChaseSuppressionUntil
      || this.ballSys.state.mode !== 'flight'
      || this.ballSys.state.flight?.kind !== 'clearance'
    ) {
      return { x: rawX, z: rawZ };
    }
    const f = this.ballSys.state.flight!;
    const dx = rawX - f.fromX;
    const dz = rawZ - f.fromZ;
    const dist = Math.hypot(dx, dz);
    if (dist <= maxLeadM) return { x: rawX, z: rawZ };
    const s = maxLeadM / dist;
    return { x: f.fromX + dx * s, z: f.fromZ + dz * s };
  }

  /** Alinha a supressão de perseguição ao tempo de voo real (o antigo ~0,34 s deixava o campo colapsar). */
  private scheduleGkReleaseChaseSuppressionFromFlight(
    fromX: number,
    fromZ: number,
    toX: number,
    toZ: number,
    speedMps: number,
  ): void {
    const dist = Math.hypot(toX - fromX, toZ - fromZ);
    const spd = Math.max(11, speedMps);
    const tFly = dist / spd;
    const until = this.world.simTime + Math.min(4.6, Math.max(0.72, tFly * 0.96 + 0.28));
    this.gkReleaseChaseSuppressionUntil = Math.max(this.gkReleaseChaseSuppressionUntil, until);
  }

  /**
   * Initialize agents from LiveMatchSnapshot roster.
   * Called once when roster changes. Does NOT set ball from snapshot each frame.
   */
  syncLive(live: LiveMatchSnapshot | null, manager: TacticalManagerParams) {
    this.liveRef = live;
    if (!live) return;
    if (live.homeCaptainPlayerId) this.homeCaptainId = live.homeCaptainPlayerId;

    if (live.phase !== 'playing') return;

    const inv = invertLineup(live.matchLineupBySlot);
    /**
     * Mesma resolução de slot que ao criar agentes — evita reinício total quando `slotId`
     * vem vazio num tick e preenchido noutro (assinatura instável → teleporte para kickoff).
     */
    const sig = [...live.homePlayers]
      .sort((a, b) => a.playerId.localeCompare(b.playerId))
      .map((p) => `${p.playerId}:${p.slotId || inv.get(p.playerId) || 'mc1'}`)
      .join('|');

    const lenMismatch = this.homeAgents.length !== live.homePlayers.length;
    const sigMismatch = sig !== this.homeRosterSig;
    if (sigMismatch || lenMismatch) {
      const hotSwap =
        this.initialized
        && !lenMismatch
        && sigMismatch
        && this.tryHotSwapHomeSubstitution(live, manager, inv);
      if (hotSwap) {
        this.homeRosterSig = sig;
      } else {
      this.homeRosterSig = sig;
      this.homeAgents = [];
      this.awayAgents = [];
      this.shirtNumbers.clear();

      const homeSchemeInit: FormationSchemeId = (live.homeFormationScheme ?? '4-3-3') as FormationSchemeId;
      for (const hp of live.homePlayers) {
        const slot = hp.slotId || inv.get(hp.playerId) || 'mc1';
        const w = kickoffWorldXZ('home', homeSchemeInit, slot);
        const base = createAgentBinding(hp.playerId, slot, 'home', hp.role, w.x, w.z, 14 + manager.tempo * 0.04);
        const prof = profileForSlot(slot, hp.role);
        let attrs = normalizeMatchAttributes(hp.attributes);
        const coachMul = manager.homeStaffMatch?.coachAttrMulHome ?? 1;
        const playerExtra = manager.homeStaffPlayerBoosts?.[hp.playerId] ?? 1;
        const effectiveMul = coachMul * playerExtra;
        if (effectiveMul > 1.0001) attrs = scaleMatchAttributesForCoach(attrs, effectiveMul);
        const rt = createPlayerMatchRuntimeFromPitch(hp.fatigue, attrs);
        const morale = manager.homeStaffMatch?.coachMoraleStartAdd01 ?? 0;
        if (morale > 0) {
          rt.confidenceRuntime = Math.min(1.28, rt.confidenceRuntime + morale);
        }
        const cog: MatchCognitiveArchetype = hp.cognitiveArchetype ?? 'construtor';
        const personality = derivePersonalityFromAttrs(attrs);
        const agEx: AgentEx = {
          ...base,
          decision: new PlayerDecisionEngine(prof),
          profile: prof,
          matchAttrs: attrs,
          personality,
          matchRuntime: rt,
          cognitiveArchetype: cog,
          locomotionRunBlendSmoothed: 0.35,
          strongFoot: hp.strongFoot,
          archetype: hp.archetype,
        };
        this.applyVehicleSpeedFromAttrs(agEx, FIXED_DT, null);
        this.homeAgents.push(agEx);
        if (hp.num) this.shirtNumbers.set(hp.playerId, hp.num);
      }

      this.matchEngine.reset();

      const awaySchemeInit: FormationSchemeId = (live.awayFormationScheme ?? homeSchemeInit) as FormationSchemeId;
      let awayNum = 1;
      for (const slot of slotsForScheme(awaySchemeInit)) {
        const w = kickoffWorldXZ('away', awaySchemeInit, slot);
        const aid = `away-${slot}`;
        const role = roleFromSlotId(slot);
        const base = createAgentBinding(aid, slot, 'away', role, w.x, w.z, 13);
        const prof = profileForSlot(slot, role);
        const attrs = defaultAwayMatchAttributes(awayNum);
        const rt = createPlayerMatchRuntimeFromPitch(14, attrs);
        const cog = awayCognitiveArchetypeForSlot(slot);
        const personality = derivePersonalityFromAttrs(attrs);
        const agEx: AgentEx = {
          ...base,
          decision: new PlayerDecisionEngine(prof),
          profile: prof,
          matchAttrs: attrs,
          personality,
          matchRuntime: rt,
          cognitiveArchetype: cog,
          locomotionRunBlendSmoothed: 0.35,
        };
        this.applyVehicleSpeedFromAttrs(agEx, FIXED_DT, null);
        this.awayAgents.push(agEx);
        this.shirtNumbers.set(aid, awayNum++);
      }

      this.simState = createSimMatchState();
      resetGameSpiritPhase1Orchestrator();
      this.skipKickoffBallAssign = false;
      this.pendingPostGoalCenterKickoff = false;
      this.shotPending = null;
      this.gkRestart = null;
      this.gkReleaseChaseSuppressionUntil = -1e9;
      this.secondHalfKickoffAt = null;
      this.matchOpeningKickoffAt = null;
      this.matchOpeningPartnerId = null;
      this.lastShotAttemptSimTime = { home: -1e9, away: -1e9 };
      this.lastShotBudgetCoolSimTime = { home: -1e9, away: -1e9 };
      this.shotBudgetArmed = { home: false, away: false };
      this.offensiveStallAccum = { home: 0, away: 0 };
      this.defensiveShapeBreakUntil = { home: -1e9, away: -1e9 };
      this.executionBoostUntil.clear();
      this.executionBoostImpact01.clear();
      this.applyTurnoverDepth = 0;
      this.pendingPassIntercept = null;
      this.simState.simulationSeed =
        live.simulationSeed ?? hashStringSeed(`${live.homeShort}|${live.awayShort}|${live.homePlayers.length}`);
      this.matchClock.reset();
      this.matchClock.start();
      this.prevClockPeriod = null;
      this.ballSys.placeForKickoff();
  // Install throw-in hook so TacticalSimLoop can orchestrate realistic lateral restarts
  // (records last-touch, deadball window, designate fetcher, force short pass).
  // Assumption: BallSystem provides lastTouchPlayerId when available; if missing we
  // default to the current possession as a conservative fallback.
  this.ballSys.setOnThrowIn((info) => this.handleThrowIn(info));

      this.simState.possession = live.possession ?? 'home';
      this.firstKickoffPossessionSide = this.simState.possession;
      this.placeMatchOpeningKickoffPair();
      this.matchOpeningKickoffAt = this.world.simTime + MATCH_OPENING_KICKOFF_WAIT_SEC;
      this.fsm.state = { phase: 'kickoff', goalSequenceTimer: 0 };
      this.initialized = true;
      this.liveLearning.attach(this.eventBus);
      this.liveLearning.registerPlayers(
        [...this.homeAgents, ...this.awayAgents].map((a) => ({
          id: a.id,
          learningState: {
            confidence: 50,
            riskTendency: 50,
            passVsShootPreference: 50,
            criticalComposure: 50,
            tacticalDiscipline: 50,
            egoControl: 50,
            recentEvents: [],
          },
        })),
      );
      }
    }

    const top = live.events[0];
    if (top && top.id !== this.lastEventId) {
      this.lastEventId = top.id;
      emitFromMatchEventEntry(this.eventBus, top, this.world.simTime);
    }

  }

  /** Handle BallSystem out-of-bounds callback — classifies throw-in / corner / goal kick and pauses play. */
  private handleThrowIn(info: { outSide: 'left' | 'right' | 'top' | 'bottom' | 'unknown'; lastTouchPlayerId?: string; x: number; z: number; timestamp: number }) {
    if (this.deadBallUntil > this.world.simTime) return; // already in deadball, ignore re-entry

    const m = this.simState.minute;
    const lt = info.lastTouchPlayerId ?? null;

    // Identify which side the last toucher belongs to.
    let lastToucherSide: PossessionSide | null = null;
    if (lt) {
      if (this.homeAgents.find((a) => a.id === lt)) lastToucherSide = 'home';
      else if (this.awayAgents.find((a) => a.id === lt)) lastToucherSide = 'away';
    }

    const half = this.matchClock.state.half;
    // Home attacks toward x=FIELD_LENGTH when attackDir=1 (1st half default).
    // Home defends the left end (x≈0) when attackDir=1.
    const homeAttackDir = getSideAttackDir('home', half);
    const homeDefendsLeft = homeAttackDir === 1;

    let restartType: 'throw_in' | 'corner_kick' | 'goal_kick' = 'throw_in';
    let restartingSide: PossessionSide = lastToucherSide
      ? (lastToucherSide === 'home' ? 'away' : 'home') // opponent restarts by default
      : (this.simState.possession ?? 'home');

    let ballX = info.x;
    let ballZ = info.z;

    if (info.outSide === 'top' || info.outSide === 'bottom') {
      // Lateral / throw-in
      restartType = 'throw_in';
      const live = this.liveRef;
      const restartName = restartingSide === 'home' ? (live?.homeShort ?? 'Casa') : (live?.awayShort ?? 'Fora');
      pushSimEvent(this.simState, `${m}' — Lateral para o ${restartName}.`, 'whistle');
    } else {
      // Ball crossed a goal line (left = x≈0, right = x≈FIELD_LENGTH).
      // Determine which team defends that end.
      const outAtLeft = info.outSide === 'left';
      const defendingTeam: PossessionSide = outAtLeft
        ? (homeDefendsLeft ? 'home' : 'away')
        : (homeDefendsLeft ? 'away' : 'home');

      if (lastToucherSide === defendingTeam) {
        // Defending team put it out → corner kick for attackers
        restartType = 'corner_kick';
        restartingSide = defendingTeam === 'home' ? 'away' : 'home';
        // Place ball at the corner flag nearest to where it crossed the line
        ballX = outAtLeft ? 0.3 : FIELD_LENGTH - 0.3;
        ballZ = info.z < FIELD_WIDTH / 2 ? 0.3 : FIELD_WIDTH - 0.3;
        const live = this.liveRef;
        const restartName = restartingSide === 'home' ? (live?.homeShort ?? 'Casa') : (live?.awayShort ?? 'Fora');
        pushSimEvent(this.simState, `${m}' — Canto para o ${restartName}!`, 'whistle');
        // Q6 — Dispara modal interativo de set-piece (apenas para o time da casa,
        // visitante mantém fluxo automático do engine).
        if (restartingSide === 'home' && this.onCornerAwardedCallback) {
          this.onCornerAwardedCallback({
            side: 'home',
            cornerSide: ballZ < FIELD_WIDTH / 2 ? 'left' : 'right',
            minute: m,
          });
        }
      } else {
        // Attacking team put it out (or unknown) → goal kick for defenders
        restartType = 'goal_kick';
        restartingSide = defendingTeam;
        // Place ball inside the 6-yard box of the defending GK
        ballX = outAtLeft ? 5.5 : FIELD_LENGTH - 5.5;
        ballZ = FIELD_WIDTH / 2;
        const live = this.liveRef;
        const restartName = restartingSide === 'home' ? (live?.homeShort ?? 'Casa') : (live?.awayShort ?? 'Fora');
        pushSimEvent(this.simState, `${m}' — Saída de baliza para o ${restartName}.`, 'whistle');
      }
    }

    // Freeze ball at restart position.
    this.ballSys.setDeadAt(ballX, ballZ);
    this.simState.possession = restartingSide;
    // Janela pra o fetcher chegar/encenar o reinício. Em tiro de meta pós-chute,
    // encurtamos pra ~1s (já houve 1s de atraso no voo → total ~2s desde o chute),
    // reforçando a percepção "bola saiu, goleiro já cobra".
    this.deadBallUntil = this.world.simTime + (restartType === 'goal_kick' ? 1.0 : 12);

    // Enter FSM set piece state so players reposition and structural system takes over.
    this.triggerPreset(restartType);

    // Designate nearest eligible player from restarting team to fetch/take the restart.
    const team = restartingSide === 'home' ? this.homeAgents : this.awayAgents;
    let best: AgentEx | null = null;
    let bestD = Infinity;
    for (const ag of team) {
      if (ag.role === 'gk' && restartType !== 'goal_kick') continue; // GK doesn't take throw-ins or corners
      const dx = ag.vehicle.position.x - ballX;
      const dz = ag.vehicle.position.z - ballZ;
      const d = Math.hypot(dx, dz);
      if (d < bestD) {
        bestD = d;
        best = ag;
      }
    }

    if (best) {
      setArriveTarget(best, ballX, ballZ, 'reforming');
      this.pendingThrowIn = { fetcherId: best.id, x: ballX, z: ballZ, restartType };
    } else {
      this.pendingThrowIn = null;
    }
  }

  /**
   * Substituição de um jogador da casa: mantém veículo / vizinhança Yuka e o estado da partida
   * (marcador, relógio, bola) — evita o reinício completo de `syncLive`.
   */
  private tryHotSwapHomeSubstitution(
    live: LiveMatchSnapshot,
    manager: TacticalManagerParams,
    inv: Map<string, string>,
  ): boolean {
    if (!this.initialized || this.homeAgents.length !== live.homePlayers.length || this.homeAgents.length === 0) {
      return false;
    }

    const slotKey = (p: PitchPlayerState) => p.slotId || inv.get(p.playerId) || 'mc1';
    const slots = new Set(this.homeAgents.map((a) => a.slotId));

    let changed: { oldAg: AgentEx; hp: PitchPlayerState; outId: string; inId: string } | null = null;
    for (const slot of slots) {
      const oldAg = this.homeAgents.find((a) => a.slotId === slot);
      const hp = live.homePlayers.find((p) => slotKey(p) === slot);
      if (!oldAg || !hp) return false;
      if (oldAg.id !== hp.playerId) {
        if (changed) return false;
        changed = { oldAg, hp, outId: oldAg.id, inId: hp.playerId };
      }
    }
    if (!changed) return false;

    const { oldAg, hp, outId, inId } = changed;
    // SPEED BOOST: Jogadores mais rápidos (base + tempo + boost)
    const baseMaxSpeed = 14 + manager.tempo * 0.04;
    const velocidadeAttr = hp.attributes?.velocidade ?? 50;
    const maxSpeed = applySpeedBoostToPlayerMaxSpeed(baseMaxSpeed, velocidadeAttr);

    const prof = profileForSlot(oldAg.slotId, hp.role);
    let attrs = normalizeMatchAttributes(hp.attributes);
    const coachMul = manager.homeStaffMatch?.coachAttrMulHome ?? 1;
    const playerExtra = manager.homeStaffPlayerBoosts?.[hp.playerId] ?? 1;
    const effectiveMul = coachMul * playerExtra;
    if (effectiveMul > 1.0001) attrs = scaleMatchAttributesForCoach(attrs, effectiveMul);
    const rt = createPlayerMatchRuntimeFromPitch(hp.fatigue, attrs);
    const morale = manager.homeStaffMatch?.coachMoraleStartAdd01 ?? 0;
    if (morale > 0) {
      rt.confidenceRuntime = Math.min(1.28, rt.confidenceRuntime + morale);
    }
    const cog: MatchCognitiveArchetype = hp.cognitiveArchetype ?? 'construtor';

    oldAg.id = inId;
    oldAg.role = hp.role;
    oldAg.decision = new PlayerDecisionEngine(prof);
    oldAg.profile = prof;
    oldAg.matchAttrs = attrs;
    oldAg.matchRuntime = rt;
    oldAg.cognitiveArchetype = cog;
    oldAg.strongFoot = hp.strongFoot;
    oldAg.archetype = hp.archetype;
    this.applyVehicleSpeedFromAttrs(oldAg, FIXED_DT, null);
    oldAg.vehicle.maxSpeed = maxSpeed;

    if (hp.num) this.shirtNumbers.set(inId, hp.num);
    this.shirtNumbers.delete(outId);

    this.remapAgentIdReferences(outId, inId, {
      x: oldAg.vehicle.position.x,
      z: oldAg.vehicle.position.z,
    });

    rebuildNeighbors(this.homeAgents);
    rebuildNeighbors(this.awayAgents);
    return true;
  }

  private remapAgentIdReferences(
    outId: string,
    inId: string,
    carrierPos: { x: number; z: number },
  ): void {
    if (this.simState.carrierId === outId) {
      this.simState.carrierId = inId;
    }
    if (this.prevCarrierId === outId) {
      this.prevCarrierId = inId;
    }
    if (this.ballSys.state.mode === 'held' && this.ballSys.state.carrierId === outId) {
      this.ballSys.giveTo(inId, carrierPos.x, carrierPos.z);
    }
    const fl = this.ballSys.state.flight;
    if (fl?.targetPlayerId === outId) {
      fl.targetPlayerId = inId;
    }
    if (this.gkRestart?.gkId === outId) {
      this.gkRestart = { ...this.gkRestart, gkId: inId };
    }
    if (this.shotPending?.shooterId === outId) {
      this.shotPending = { ...this.shotPending, shooterId: inId };
    }
    if (this.matchOpeningPartnerId === outId) {
      this.matchOpeningPartnerId = inId;
    }

    this.rekeySimIdMap(this.turnoverPassBlock, outId, inId);
    this.rekeySimIdMap(this.passReturnBlock, outId, inId);
    this.rekeySimIdMap(this.passMobilityHint, outId, inId);
    this.rekeySimIdMap(this.crossIncomingHint, outId, inId);
    this.rekeySimIdMap(this.executionBoostUntil, outId, inId);
    this.rekeySimIdMap(this.executionBoostImpact01, outId, inId);

    for (const v of this.crossIncomingHint.values()) {
      if (v.senderId === outId) v.senderId = inId;
    }

    for (const v of this.turnoverPassBlock.values()) {
      if (v.peerId === outId) v.peerId = inId;
    }
    for (const v of this.passReturnBlock.values()) {
      if (v.fromId === outId) v.fromId = inId;
    }
    for (const v of this.passMobilityHint.values()) {
      if (v.carrierId === outId) v.carrierId = inId;
    }

    if (outId in this.simState.stats) {
      const s = this.simState.stats[outId]!;
      delete this.simState.stats[outId];
      this.simState.stats[inId] = { ...s, ...this.simState.stats[inId] };
    }

    const prevPos = this.frameStartPlayers.get(outId);
    if (prevPos !== undefined) {
      this.frameStartPlayers.delete(outId);
      this.frameStartPlayers.set(inId, prevPos);
    }
  }

  private rekeySimIdMap<T>(m: Map<string, T>, oldK: string, newK: string): void {
    if (!m.has(oldK)) return;
    const v = m.get(oldK)!;
    m.delete(oldK);
    if (!m.has(newK)) m.set(newK, v);
  }

  /**
   * Dois jogadores da equipa que sai no círculo central; restantes fora do círculo (IFAB).
   * Bola morta até {@link MATCH_OPENING_KICKOFF_WAIT_SEC} (pode ser 0) e ao passe em
   * {@link executeMatchOpeningKickoffPass}.
   */
  private placeMatchOpeningKickoffPair(): void {
    const cx = FIELD_LENGTH / 2;
    const cz = FIELD_WIDTH / 2;
    const kickTeam = this.simState.possession === 'home' ? this.homeAgents : this.awayAgents;
    const half = this.matchClock.state.half;
    const side: PossessionSide = this.simState.possession;
    const attackDir = getSideAttackDir(side, half);

    const taker =
      kickTeam.find((a) => a.role === 'attack')
      ?? kickTeam.find((a) => a.slotId === 'ata')
      ?? kickTeam.find((a) => a.role === 'mid')
      ?? kickTeam[0];
    if (!taker) {
      this.matchOpeningPartnerId = null;
      return;
    }

    const outfield = kickTeam.filter((a) => a.id !== taker.id && a.role !== 'gk');
    const scored = (a: AgentEx) => {
      const midish = a.role === 'attack' || a.role === 'mid' ? 0 : 1;
      const d = Math.hypot(a.vehicle.position.x - cx, a.vehicle.position.z - cz);
      return { a, key: midish * 1e6 + d };
    };
    outfield.sort((a, b) => scored(a).key - scored(b).key);
    const partner = outfield[0];

    taker.vehicle.position.x = cx;
    taker.vehicle.position.z = cz;
    taker.vehicle.velocity.set(0, 0, 0);
    taker.arrive.target.x = cx;
    taker.arrive.target.z = cz;

    if (partner) {
      const lateral = (taker.id.localeCompare(partner.id) >= 0 ? 1 : -1) * 2.0;
      const back = 1.35;
      const rawX = cx - attackDir * back;
      const rawZ = cz + lateral;
      const c = clampToPitch(rawX, rawZ, 0.55);
      partner.vehicle.position.x = c.x;
      partner.vehicle.position.z = c.z;
      partner.vehicle.velocity.set(0, 0, 0);
      partner.arrive.target.x = c.x;
      partner.arrive.target.z = c.z;
      this.matchOpeningPartnerId = partner.id;
    } else {
      this.matchOpeningPartnerId = null;
    }

    this.simState.carrierId = null;
    const exempt = new Set<string>([taker.id, ...(partner ? [partner.id] : [])]);
    this.enforceKickoffHoldOwnHalves();
    this.enforceCenterCircleKickoffExemptPair(exempt);
    this.enforceKickoffHoldOwnHalves();
  }

  /**
   * Só os dois jogadores da equipa que sai podem estar dentro do círculo central; todos os outros
   * (incl. avançado adversário) ficam ≥ raio + margem.
   */
  private enforceCenterCircleKickoffExemptPair(exempt: Set<string>): void {
    const cx = FIELD_LENGTH / 2;
    const cz = FIELD_WIDTH / 2;
    const half = this.matchClock.state.half as MatchHalf;
    const R = CENTER_CIRCLE_RADIUS_M;
    const margin = 0.55;
    const minDist = R + margin;

    for (const ag of [...this.homeAgents, ...this.awayAgents]) {
      if (exempt.has(ag.id)) continue;
      if (ag.slotId === 'gol' || ag.role === 'gk') continue;

      let px = ag.vehicle.position.x;
      let pz = ag.vehicle.position.z;
      let dx = px - cx;
      let dz = pz - cz;
      let d = Math.hypot(dx, dz);
      if (d >= minDist) continue;

      if (d < 1e-4) {
        const dg = getDefendingGoalX(ag.side, half);
        dx = dg < cx ? -1 : 1;
        dz = 0;
        d = 1;
      }
      const nx = dx / d;
      const nz = dz / d;
      const c = clampToPitch(cx + nx * minDist, cz + nz * minDist, 0.55);
      ag.vehicle.position.x = c.x;
      ag.vehicle.position.z = c.z;
      ag.vehicle.velocity.set(0, 0, 0);
      ag.arrive.target.x = c.x;
      ag.arrive.target.z = c.z;
    }
  }

  /**
   * IFAB: antes do primeiro toque, todos ficam no próprio meio-campo; só a equipa que sai pode
   * ocupar até à linha média (incl. marca central). O adversário fica a uma margem mínima do meio.
   */
  private enforceKickoffHoldOwnHalves(): void {
    const half = this.matchClock.state.half as MatchHalf;
    const mid = FIELD_LENGTH / 2;
    const marginNonKicking = 1.5;
    const kickingSide = this.simState.possession;

    for (const ag of [...this.homeAgents, ...this.awayAgents]) {
      const dg = getDefendingGoalX(ag.side, half);
      const defendsWest = dg < mid;
      const isKickingTeam = ag.side === kickingSide;
      let x = ag.vehicle.position.x;
      if (ag.slotId === 'gol' || ag.role === 'gk') {
        ag.vehicle.position.x = x;
        ag.arrive.target.x = x;
        continue;
      }
      if (defendsWest) {
        if (isKickingTeam) {
          x = Math.min(mid, Math.max(2, x));
        } else {
          x = Math.min(mid - marginNonKicking, Math.max(2, x));
        }
      } else if (isKickingTeam) {
        x = Math.max(mid, Math.min(FIELD_LENGTH - 2, x));
      } else {
        x = Math.max(mid + marginNonKicking, Math.min(FIELD_LENGTH - 2, x));
      }
      ag.vehicle.position.x = x;
      ag.arrive.target.x = x;
    }
  }

  /** Pontapé de saída do 2.º tempo: prioriza atacante (slot `ata` ou `role === 'attack'`). */
  private assignBallToSecondHalfKickoffTaker(): AgentEx | null {
    const kickTeam = this.simState.possession === 'home' ? this.homeAgents : this.awayAgents;
    const taker =
      kickTeam.find((a) => a.role === 'attack')
      ?? kickTeam.find((a) => a.slotId === 'ata')
      ?? kickTeam.find((a) => a.role === 'mid')
      ?? kickTeam[0];
    if (!taker) return null;
    const cx = FIELD_LENGTH / 2;
    const cz = FIELD_WIDTH / 2;
    taker.vehicle.position.x = cx;
    taker.vehicle.position.z = cz;
    taker.vehicle.velocity.set(0, 0, 0);
    this.ballSys.giveTo(taker.id, cx, cz);
    this.simState.carrierId = taker.id;
    return taker;
  }

  /**
   * Passe de saída no meio-campo após bola morta no centro (2.º tempo ou apito inicial).
   */
  private executeCenterKickoffStyleOpeningPass(
    L: ReturnType<typeof createCausalBatch>,
    variant: 'second_half' | 'match_opening',
  ): void {
    const carrier = this.assignBallToSecondHalfKickoffTaker();
    if (!carrier) {
      this.fsm.resumeLive();
      return;
    }

    const selfSnap = this.toAgentSnapshot(carrier);
    const teamSnaps =
      carrier.side === 'home'
        ? this.homeAgents.map((a) => this.toAgentSnapshot(a))
        : this.awayAgents.map((a) => this.toAgentSnapshot(a));
    const oppSnaps =
      carrier.side === 'home'
        ? this.awayAgents.map((a) => this.toAgentSnapshot(a))
        : this.homeAgents.map((a) => this.toAgentSnapshot(a));
    const attackDir = getSideAttackDir(carrier.side, this.matchClock.state.half);
    const teammates = teamSnaps.filter((t) => t.id !== carrier.id && t.role !== 'gk');
    const baseSeed = this.simState.simulationSeed;
    const tickK = Math.floor(this.world.simTime * 60);
    const press01 = nearestOpponentPressure01(selfSnap, oppSnaps);
    const disorg01 = this.tacticalDisorgFacingCarrier(carrier.side);
    const passOpts = findPassOptions(selfSnap, teammates, oppSnaps, attackDir);
    const ranked = [...passOpts]
      .filter((p) => p.successProb >= 0.44)
      .sort(
        (a, b) =>
          b.progressionGain - a.progressionGain
          || b.spaceAtTarget - a.spaceAtTarget
          || b.successProb - a.successProb,
      );
    let opt = ranked[0] ?? passOpts[0];
    if (variant === 'match_opening' && this.matchOpeningPartnerId) {
      const toPartner = passOpts.find((p) => p.targetId === this.matchOpeningPartnerId);
      if (toPartner && toPartner.successProb >= 0.38) {
        opt = toPartner;
      }
      this.matchOpeningPartnerId = null;
    }

    const cx = FIELD_LENGTH / 2;
    const cz = FIELD_WIDTH / 2;
    const str = selfSnap.fisico / 100;
    const speed = Math.max(14, Math.min(42, 17 + selfSnap.passeCurto * 0.11 + str * 0.9));
    const m = this.simState.minute;
    const interceptReason =
      variant === 'second_half' ? 'second_half_kickoff_intercept' : 'match_opening_kickoff_intercept';
    const rngTag = variant === 'second_half' ? '2h-kick' : 'open-kick';

    if (opt) {
      const stats = getOrCreateStats(this.simState, carrier.id);
      stats.passesAttempt++;
      const passRes = resolvePassForPossession(
        baseSeed,
        tickK,
        selfSnap,
        opt,
        press01,
        oppSnaps,
        disorg01,
        this.stepManagerParams?.homeStaffMatch ?? null,
      );
      if (passRes.completed) stats.passesOk++;
      if (passRes.interceptPlayerId) {
        const intr = this.findAgent(passRes.interceptPlayerId);
        if (intr) {
          const stealX = carrier.vehicle.position.x;
          const stealZ = carrier.vehicle.position.z;
          const contact = this.clampedPassInterceptContactPoint(
            selfSnap.x,
            selfSnap.z,
            passRes.x,
            passRes.z,
            intr.vehicle.position.x,
            intr.vehicle.position.z,
          );
          const flyDist = Math.hypot(contact.x - selfSnap.x, contact.z - selfSnap.z);
          const spd = Math.max(11, speed);
          const tFly = flyDist / spd;
          this.pendingPassIntercept = {
            interceptorId: intr.id,
            passerId: carrier.id,
            stealX,
            stealZ,
            possessionBefore: this.simState.possession,
            contactX: contact.x,
            contactZ: contact.z,
            deadlineSimTime: this.world.simTime + Math.min(4.2, Math.max(0.55, tFly + 0.45)),
            icKey: `${carrier.id}:${intr.id}:${tickK}`,
            narrativeLine:
              variant === 'second_half'
                ? `${m}' — Interceptação no reinício do 2.º tempo.`
                : `${m}' — Início: interceptação no primeiro toque.`,
            causalReason: interceptReason,
          };
          this.scheduleGkReleaseChaseSuppressionFromFlight(selfSnap.x, selfSnap.z, contact.x, contact.z, speed);
          this.ballSys.registerLastTouch(carrier.id);
          this.ballSys.startFlight(
            { x: selfSnap.x, z: selfSnap.z },
            { x: contact.x, z: contact.z },
            speed,
            'pass',
          );
          this.simState.carrierId = null;
        }
    } else if (passRes.completed) {
  this.ballSys.registerLastTouch(carrier.id);
        this.ballSys.startFlight(
          { x: selfSnap.x, z: selfSnap.z },
          { x: passRes.x, z: passRes.z },
          speed,
          'pass',
          opt.targetId,
        );
        this.simState.carrierId = null;
        pushLastAction(carrier.matchRuntime, 'short_pass_safety');
        pushSimEvent(
          this.simState,
          variant === 'second_half'
            ? `${m}' — 2.º tempo: saída com passe ao meio-campo.`
            : `${m}' — Início: saída com passe.`,
        );
      } else {
  this.ballSys.registerLastTouch(carrier.id);
  this.ballSys.setLoose(passRes.x, passRes.z);
        this.simState.carrierId = null;
        pushSimEvent(
          this.simState,
          variant === 'second_half'
            ? `${m}' — 2.º tempo: toque de saída — segunda bola.`
            : `${m}' — Início: toque de saída — segunda bola.`,
        );
      }
    } else {
      const r = rngFromSeed(baseSeed, `${rngTag}:${carrier.id}:${tickK}`).nextUnit();
      const toX = Math.min(FIELD_LENGTH - 4, Math.max(4, cx + attackDir * (16 + r * 10)));
      const toZ = Math.min(FIELD_WIDTH - 4, Math.max(4, cz + (r - 0.5) * 18));
      const c = clampToPitch(toX, toZ, 0.55);
      this.ballSys.startFlight({ x: cx, z: cz }, { x: c.x, z: c.z }, speed, 'pass');
      this.simState.carrierId = null;
      pushSimEvent(
        this.simState,
        variant === 'second_half'
          ? `${m}' — 2.º tempo: pontapé de saída à frente.`
          : `${m}' — Início: pontapé de saída à frente.`,
      );
    }

    this.gkReleaseChaseSuppressionUntil = this.world.simTime + 0.32;
    this.fsm.resumeLive();
  }

  /** Após `SECOND_HALF_KICKOFF_WAIT_SEC` com bola morta no centro: atacante (ou fallback) inicia com passe. */
  private executeSecondHalfOpeningPass(L: ReturnType<typeof createCausalBatch>): void {
    this.executeCenterKickoffStyleOpeningPass(L, 'second_half');
  }

  /** Após o apito inicial: primeiro toque é passe (nunca remate directo do centro). */
  private executeMatchOpeningKickoffPass(L: ReturnType<typeof createCausalBatch>): void {
    this.executeCenterKickoffStyleOpeningPass(L, 'match_opening');
  }

  /** Teleporta todos os agentes para as posições de kickoff estrutural imediatamente (sem animação de caminhada). */
  private snapAgentsToKickoffPositions(): void {
    const homeScheme: FormationSchemeId = (this.liveRef?.homeFormationScheme ?? '4-3-3') as FormationSchemeId;
    const awayScheme: FormationSchemeId = (this.liveRef?.awayFormationScheme ?? homeScheme) as FormationSchemeId;
    const targets = this.structuralSys.getGoalRestartPlayerTargets(
      this.homeAgents,
      this.awayAgents,
      this.matchClock.state.half,
      homeScheme,
      awayScheme,
    );
    for (const ag of [...this.homeAgents, ...this.awayAgents]) {
      if (!targets.has(ag.id)) continue;
      const raw = targets.get(ag.id)!;
      const s = structuralKickoffAnchorWorld(raw);
      ag.vehicle.position.x = s.x;
      ag.vehicle.position.z = s.z;
      ag.vehicle.velocity.set(0, 0, 0);
      ag.arrive.target.x = s.x;
      ag.arrive.target.z = s.z;
    }
  }

  /**
   * Após golo: bola morta no centro, executor no círculo; FSM fica em `kickoff` durante
   * {@link KICKOFF_TO_LIVE_SEC} para as âncoras estruturais convergirem (sem `resumeLive` aqui).
   */
  private prepareCenterKickoffAfterGoal(): void {
    this.ballSys.placeForKickoff();

    const kickTeam = this.simState.possession === 'home' ? this.homeAgents : this.awayAgents;
    const taker =
      kickTeam.find((a) => a.role === 'attack')
      ?? kickTeam.find((a) => a.slotId === 'ata')
      ?? kickTeam.find((a) => a.role === 'mid')
      ?? kickTeam[0];
    if (!taker) {
      this.pendingPostGoalCenterKickoff = false;
      this.structuralSys.clearGoalRestart();
      this.fsm.resumeLive();
      return;
    }

    const cx = FIELD_LENGTH / 2;
    const cz = FIELD_WIDTH / 2;
    taker.vehicle.position.x = cx;
    taker.vehicle.position.z = cz;
    taker.vehicle.velocity.set(0, 0, 0);
    taker.arrive.target.x = cx;
    taker.arrive.target.z = cz;
    this.ballSys.giveTo(taker.id, cx, cz);
    this.simState.carrierId = taker.id;
    this.pendingPostGoalCenterKickoff = true;
  }

  /** Chamado na transição FSM `kickoff`→`live` após golo: primeiro toque (passe), já em jogo. */
  private fireGoalKickoffOpeningPass(L: ReturnType<typeof createCausalBatch>): void {
    const takerId = this.simState.carrierId;
    const taker = takerId ? this.findAgent(takerId) : null;
    if (!taker) {
      this.pendingPostGoalCenterKickoff = false;
      return;
    }

    const selfSnap = this.toAgentSnapshot(taker);
    const teamSnaps =
      taker.side === 'home'
        ? this.homeAgents.map((a) => this.toAgentSnapshot(a))
        : this.awayAgents.map((a) => this.toAgentSnapshot(a));
    const oppSnaps =
      taker.side === 'home'
        ? this.awayAgents.map((a) => this.toAgentSnapshot(a))
        : this.homeAgents.map((a) => this.toAgentSnapshot(a));
    const attackDir = getSideAttackDir(taker.side, this.matchClock.state.half);
    const teammates = teamSnaps.filter((t) => t.id !== taker.id && t.role !== 'gk');
    const baseSeed = this.simState.simulationSeed;
    const tickK = Math.floor(this.world.simTime * 60);
    const press01 = nearestOpponentPressure01(selfSnap, oppSnaps);
    const disorg01 = this.tacticalDisorgFacingCarrier(taker.side);
    const passOpts = findPassOptions(selfSnap, teammates, oppSnaps, attackDir);
    const ranked = [...passOpts]
      .filter((p) => p.successProb >= 0.44)
      .sort(
        (a, b) =>
          b.progressionGain - a.progressionGain
          || b.spaceAtTarget - a.spaceAtTarget
          || b.successProb - a.successProb,
      );
    const opt = ranked[0] ?? passOpts[0];

    const str = selfSnap.fisico / 100;
    const speed = Math.max(14, Math.min(42, 17 + selfSnap.passeCurto * 0.11 + str * 0.9));
    const cx = FIELD_LENGTH / 2;
    const cz = FIELD_WIDTH / 2;

    if (opt) {
      const stats = getOrCreateStats(this.simState, taker.id);
      stats.passesAttempt++;
      const passRes = resolvePassForPossession(
        baseSeed,
        tickK,
        selfSnap,
        opt,
        press01,
        oppSnaps,
        disorg01,
        this.stepManagerParams?.homeStaffMatch ?? null,
      );
      if (passRes.completed) stats.passesOk++;
      if (passRes.interceptPlayerId) {
        const intr = this.findAgent(passRes.interceptPlayerId);
        if (intr) {
          const stealX = taker.vehicle.position.x;
          const stealZ = taker.vehicle.position.z;
          const contact = this.clampedPassInterceptContactPoint(
            selfSnap.x,
            selfSnap.z,
            passRes.x,
            passRes.z,
            intr.vehicle.position.x,
            intr.vehicle.position.z,
          );
          const flyDist = Math.hypot(contact.x - selfSnap.x, contact.z - selfSnap.z);
          const spd = Math.max(11, speed);
          const tFly = flyDist / spd;
          this.pendingPassIntercept = {
            interceptorId: intr.id,
            passerId: taker.id,
            stealX,
            stealZ,
            possessionBefore: this.simState.possession,
            contactX: contact.x,
            contactZ: contact.z,
            deadlineSimTime: this.world.simTime + Math.min(4.2, Math.max(0.55, tFly + 0.45)),
            icKey: `${taker.id}:${intr.id}:${tickK}`,
            narrativeLine: `${this.simState.minute}' — Interceptação no reinício após golo.`,
            causalReason: 'goal_kickoff_intercept',
          };
          this.scheduleGkReleaseChaseSuppressionFromFlight(selfSnap.x, selfSnap.z, contact.x, contact.z, speed);
          this.ballSys.startFlight(
            { x: selfSnap.x, z: selfSnap.z },
            { x: contact.x, z: contact.z },
            speed,
            'pass',
          );
          this.simState.carrierId = null;
        }
      } else if (passRes.completed) {
        this.ballSys.startFlight(
          { x: selfSnap.x, z: selfSnap.z },
          { x: passRes.x, z: passRes.z },
          speed,
          'pass',
          opt.targetId,
        );
        this.simState.carrierId = null;
        pushLastAction(taker.matchRuntime, 'short_pass_safety');
        pushSimEvent(this.simState, `${this.simState.minute}' — Reinício: passe de saída após golo.`);
    } else {
  this.ballSys.registerLastTouch(taker.id);
  this.ballSys.setLoose(passRes.x, passRes.z);
        this.simState.carrierId = null;
        pushSimEvent(this.simState, `${this.simState.minute}' — Reinício após golo: segunda bola.`);
      }
    } else {
      const r = rngFromSeed(baseSeed, `goal-kick:${taker.id}:${tickK}`).nextUnit();
      const toX = Math.min(FIELD_LENGTH - 4, Math.max(4, cx + attackDir * (16 + r * 10)));
      const toZ = Math.min(FIELD_WIDTH - 4, Math.max(4, cz + (r - 0.5) * 18));
      const c = clampToPitch(toX, toZ, 0.55);
      this.ballSys.startFlight({ x: cx, z: cz }, { x: c.x, z: c.z }, speed, 'pass');
      this.simState.carrierId = null;
      pushSimEvent(this.simState, `${this.simState.minute}' — Reinício: pontapé de saída após golo.`);
    }

    this.gkReleaseChaseSuppressionUntil = this.world.simTime + 0.32;
    this.pendingPostGoalCenterKickoff = false;
  }

  /**
   * IFAB: troca de campo no intervalo — recoloca ambas as equipas na formação de saída
   * (como no apito inicial), depois espelha em X para o 2.º tempo; posse para quem não
   * iniciou o 1.º tempo; par de saída no centro; espera opcional {@link SECOND_HALF_KICKOFF_WAIT_SEC}s.
   */
  private applySecondHalfSideSwapAndKickoff() {
    const live = this.liveRef;
    const homeScheme = (live?.homeFormationScheme ?? '4-3-3') as FormationSchemeId;
    const awayScheme = (live?.awayFormationScheme ?? '4-3-3') as FormationSchemeId;
    const inv = live ? invertLineup(live.matchLineupBySlot) : new Map<string, string>();

    for (const ag of this.homeAgents) {
      const slot = ag.slotId || inv.get(ag.id) || 'mc1';
      const w = kickoffWorldXZ('home', homeScheme, slot);
      ag.vehicle.position.x = w.x;
      ag.vehicle.position.z = w.z;
      ag.vehicle.velocity.set(0, 0, 0);
      ag.arrive.target.x = w.x;
      ag.arrive.target.z = w.z;
    }
    for (const ag of this.awayAgents) {
      const w = kickoffWorldXZ('away', awayScheme, ag.slotId);
      ag.vehicle.position.x = w.x;
      ag.vehicle.position.z = w.z;
      ag.vehicle.velocity.set(0, 0, 0);
      ag.arrive.target.x = w.x;
      ag.arrive.target.z = w.z;
    }

    const L = FIELD_LENGTH;
    for (const ag of [...this.homeAgents, ...this.awayAgents]) {
      ag.vehicle.position.x = L - ag.vehicle.position.x;
      ag.vehicle.velocity.x *= -1;
      ag.arrive.target.x = L - ag.arrive.target.x;
    }

    this.defensiveShapeBreakUntil = { home: -1e9, away: -1e9 };
    this.executionBoostUntil.clear();
    this.executionBoostImpact01.clear();
    this.turnoverPassBlock.clear();
    this.passReturnBlock.clear();
    this.passMobilityHint.clear();
    this.crossIncomingHint.clear();

    this.ballSys.placeForKickoff();
    this.simState.carrierId = null;

    /** Quem não teve o pontapé inicial no 1.º tempo sai no 2.º (IFAB / igualdade). */
    const first = this.firstKickoffPossessionSide;
    this.simState.possession = first === 'home' ? 'away' : 'home';
    this.placeMatchOpeningKickoffPair();
    this.secondHalfKickoffAt = this.world.simTime + SECOND_HALF_KICKOFF_WAIT_SEC;
    this.fsm.state = { phase: 'kickoff', goalSequenceTimer: 0 };
  }

  /** Alvo de movimento; GR em `live` fica ancorado à sua baliza. */
  private safeArrive(ag: AgentEx, x: number, z: number, mode: AgentMode) {
    const half = this.matchClock.state.half;
    let tx = x;
    if (this.simState.phase === 'live' && (ag.slotId === 'gol' || ag.role === 'gk')) {
      tx = clampGoalkeeperTargetX(ag.side, half, tx);
      z = clampGoalkeeperTargetZ(this.ballSys.state.z, z);
    }
    // Angular inertia: limit heading change based on speed and agility
    const speed = ag.vehicle.getSpeed();
    if (speed > 0.5) {
      const vx = ag.vehicle.velocity.x;
      const vz = ag.vehicle.velocity.z;
      const currentHeading = Math.atan2(vx, vz);
      const desiredHeading = Math.atan2(tx - ag.vehicle.position.x, z - ag.vehicle.position.z);
      const clampedHeading = clampHeadingChange(currentHeading, desiredHeading, speed, ag.matchAttrs.velocidade, 1 / 60);
      const dist = Math.hypot(tx - ag.vehicle.position.x, z - ag.vehicle.position.z);
      if (dist > 0.5) {
        tx = ag.vehicle.position.x + Math.sin(clampedHeading) * dist;
        const tz = ag.vehicle.position.z + Math.cos(clampedHeading) * dist;
        setArriveTarget(ag, tx, tz, mode);
        return;
      }
    }
    setArriveTarget(ag, tx, z, mode);
  }

  triggerPreset(phase: 'throw_in' | 'corner_kick' | 'goal_kick') {
    this.fsm.enterPreset(phase);
    this.fsm.state.resumeTimer = 0;
    this.structuralSys.beginSetPiece(
      phase,
      this.simState.possession,
      this.ballSys.state.x,
      this.ballSys.state.z,
    );
  }

  resumeDynamic() {
    this.fsm.resumeLive();
    this.structuralSys.clearSetPieceStructural();
  }

  private truthPhase(live: LiveMatchSnapshot | null): MatchTruthPhase {
    if (!live) return 'dead_ball';
    if (live.phase === 'pregame') return 'pregame_visual';
    if (live.phase === 'postgame') return 'dead_ball';
    return this.fsm.state.phase === 'live' ? 'live' : (this.fsm.state.phase as MatchTruthPhase);
  }

  private captureFrameStart() {
    this.frameStartBall.x = this.world.ball.x;
    this.frameStartBall.y = this.world.ball.y;
    this.frameStartBall.z = this.world.ball.z;
    this.frameStartBallVel.x = this.world.ballVel.x;
    this.frameStartBallVel.z = this.world.ballVel.z;
    this.frameStartBallVy = this.ballSys.state.vy;
    this.frameStartBallMode = this.ballSys.state.mode;
    this.frameStartPlayers.clear();
    for (const ag of this.homeAgents) {
      this.frameStartPlayers.set(ag.id, { x: ag.vehicle.position.x, z: ag.vehicle.position.z });
    }
    for (const ag of this.awayAgents) {
      this.frameStartPlayers.set(ag.id, { x: ag.vehicle.position.x, z: ag.vehicle.position.z });
    }
  }

  private syncBallVehicleFromWorld() {
    this.ballVehicle.position.set(this.world.ball.x, 0, this.world.ball.z);
    this.ballVehicle.velocity.set(this.world.ballVel.x, 0, this.world.ballVel.z);
  }

  /**
   * Lê o log causal recente e a densidade espacial perto da bola; se houver confusão,
   * fixa posse (quando o log está incoerente), reatribui portador se necessário e
   * manda cada jogador **voltar à formação deslocada pela bola só via locomotion** (Arrive),
   * sem teletransporte — o espaço que o atacante deixa continua real até ele o percorrer.
   */
  private tryConfusionRefereeIntegrateEnd(fsmPhaseAfter: MatchTruthPhase, ballStoppedRestart: boolean): void {
    const REF_COOLDOWN_SEC = 2.15;
    if (fsmPhaseAfter !== 'live' || ballStoppedRestart) return;
    if (this.shotPending) return;

    const gkHoldingRestart =
      this.gkRestart !== null
      && this.ballSys.state.mode === 'held'
      && this.simState.carrierId === this.gkRestart.gkId;
    /** Estado incoerente (ex.: posse roubada sem limpar `gkRestart`) destrava o árbitro em vez de abortar o frame. */
    if (this.gkRestart && !gkHoldingRestart) {
      this.gkRestart = null;
    }

    if (this.world.simTime - this.lastConfusionRefereeWorldTime < REF_COOLDOWN_SEC) return;
    if (this.ballSys.state.mode === 'flight') return;

    const ballX = this.ballSys.state.x;
    const ballZ = this.ballSys.state.z;
    const half = this.matchClock.state.half;

    let causalVerdict = scanCausalLogConfusion(this.simState.causalLog.entries);
    if (gkHoldingRestart) causalVerdict = null;

    const allPosRef = [
      ...this.homeAgents.map((a) => ({
        id: a.id,
        x: a.vehicle.position.x,
        z: a.vehicle.position.z,
        slotId: a.slotId,
        role: a.role,
        side: 'home' as const,
      })),
      ...this.awayAgents.map((a) => ({
        id: a.id,
        x: a.vehicle.position.x,
        z: a.vehicle.position.z,
        slotId: a.slotId,
        role: a.role,
        side: 'away' as const,
      })),
    ];
    const allPosForSwarm = allPosRef.map(({ x, z, slotId, role }) => ({ x, z, slotId, role }));

    let verdict = causalVerdict;
    if (!verdict && !gkHoldingRestart && this.ballSys.state.mode !== 'dead') {
      verdict = scanPenaltyAreaClumpRecovery(
        allPosRef,
        ballX,
        ballZ,
        this.ballSys.state.mode,
        this.simState.carrierId,
        half,
      );
    }
    if (!verdict && this.ballSys.state.mode !== 'dead') {
      verdict = scanSpatialSwarmConfusion(allPosForSwarm, ballX, ballZ, this.simState.possession);
    }
    if (!verdict) return;

    const homeScheme = this.liveRef?.homeFormationScheme ?? '4-3-3';
    const awayScheme: FormationSchemeId = (this.liveRef?.awayFormationScheme ?? '4-3-3') as FormationSchemeId;
    const maps = buildRefereeDispositionMaps(homeScheme, awayScheme, ballX, ballZ, half);

    if (
      (verdict.reason === 'box_clump_gk_foul' || verdict.reason === 'box_clump_attacker_foul')
      && verdict.foulFoulerId
      && verdict.foulFoulerSide
    ) {
      let victimId = verdict.foulVictimId ?? verdict.foulFoulerId;
      if (!verdict.foulVictimId) {
        let victimBestD = Infinity;
        for (const p of allPosRef) {
          if (p.side === verdict.foulFoulerSide) continue;
          if (p.role === 'gk' || p.slotId === 'gol') continue;
          const d = Math.hypot(p.x - ballX, p.z - ballZ);
          if (d < victimBestD) {
            victimBestD = d;
            victimId = p.id;
          }
        }
      }
      const foulKind = verdict.foulKind ?? 'gk_box_clump';
      const Lf = createCausalBatch(this.simState.minute, this.simState.causalLog.nextSeq);
      Lf.push({
        type: 'foul_committed',
        payload: {
          minute: this.simState.minute,
          foulerId: verdict.foulFoulerId,
          foulerSide: verdict.foulFoulerSide,
          victimId,
          kind: foulKind,
          dangerous: false,
        },
      });
      Lf.push({
        type: 'possession_change',
        payload: {
          to: verdict.awardedSide,
          reason: verdict.reason === 'box_clump_attacker_foul' ? 'attacker_box_clump_foul' : 'gk_box_clump_foul',
        },
      });
      appendSimCausal(this.simState, Lf.events);
      this.notePossessionEvents(Lf.events);
      this.simState.possession = verdict.awardedSide;

      if (verdict.reason === 'box_clump_attacker_foul') {
        const gkAg = this.findGoalkeeper(verdict.awardedSide);
        if (gkAg) {
          this.simState.carrierId = gkAg.id;
          this.ballSys.giveTo(gkAg.id, gkAg.vehicle.position.x, gkAg.vehicle.position.z);
          this.gkRestart = { gkId: gkAg.id, kickAt: this.world.simTime + GK_RESTART_KICK_DELAY_SEC };
        }
        pushSimEvent(
          this.simState,
          `${this.simState.minute}' — Falta do atacante na área: contacto ilegal com o guarda-redes. Bola para a defesa.`,
        );
      } else {
        this.gkRestart = null;
        const poolAwarded = verdict.awardedSide === 'home' ? this.homeAgents : this.awayAgents;
        const hasOutfieldAwarded = poolAwarded.some((o) => o.role !== 'gk' && o.slotId !== 'gol');
        let bestAwarded: AgentEx | null = null;
        let bestAwardedD = Infinity;
        for (const ag of poolAwarded) {
          if (hasOutfieldAwarded && (ag.role === 'gk' || ag.slotId === 'gol')) continue;
          const d = Math.hypot(ag.vehicle.position.x - ballX, ag.vehicle.position.z - ballZ);
          if (d < bestAwardedD) {
            bestAwardedD = d;
            bestAwarded = ag;
          }
        }
        if (bestAwarded) {
          this.simState.carrierId = bestAwarded.id;
          this.ballSys.giveTo(bestAwarded.id, ballX, ballZ);
        }
        pushSimEvent(
          this.simState,
          `${this.simState.minute}' — Falta do guarda-redes na área (aglomerado). Bola para o adversário.`,
        );
      }
    } else if (verdict.reason === 'causal_whirlwind') {
      this.simState.possession = verdict.awardedSide;
      const car = this.simState.carrierId ? this.findAgent(this.simState.carrierId) : null;
      if (!car || car.side !== verdict.awardedSide) {
        const pool = verdict.awardedSide === 'home' ? this.homeAgents : this.awayAgents;
        const hasOutfield = pool.some((o) => o.role !== 'gk' && o.slotId !== 'gol');
        let best: AgentEx | null = null;
        let bestD = Infinity;
        for (const ag of pool) {
          if (hasOutfield && (ag.role === 'gk' || ag.slotId === 'gol')) continue;
          const d = Math.hypot(ag.vehicle.position.x - ballX, ag.vehicle.position.z - ballZ);
          if (d < bestD) {
            bestD = d;
            best = ag;
          }
        }
        if (best) {
          this.simState.carrierId = best.id;
          this.ballSys.giveTo(best.id, ballX, ballZ);
        }
      }
    }

    const shapeRecoveryArrive = (ag: AgentEx, m: Map<string, { x: number; z: number }>) => {
      const held = this.ballSys.state.mode === 'held' && this.simState.carrierId === ag.id;
      if (held) {
        const bx = this.ballSys.state.x;
        const bz = this.ballSys.state.z;
        ag.vehicle.position.set(bx, 0, bz);
        ag.vehicle.velocity.set(0, 0, 0);
        setArriveTarget(ag, bx, bz, 'reforming');
        return;
      }
      const t = m.get(ag.slotId) ?? clampToPitch(ag.vehicle.position.x, ag.vehicle.position.z);
      /** Só Arrive — locomotion contínua; ritmo corrido vs mais lento vem de `urgeShapeReturn` + modo reforming no speed tuning. */
      setArriveTarget(ag, t.x, t.z, 'reforming');
    };

    for (const ag of this.homeAgents) shapeRecoveryArrive(ag, maps.home);
    for (const ag of this.awayAgents) shapeRecoveryArrive(ag, maps.away);

    const LShape = createCausalBatch(this.simState.minute, this.simState.causalLog.nextSeq);
    LShape.push({
      type: 'referee_shape_reset',
      payload: {
        minute: this.simState.minute,
        reason: verdict.reason,
        awardedSide: verdict.awardedSide,
      },
    });
    appendSimCausal(this.simState, LShape.events);

    this.lastConfusionRefereeWorldTime = this.world.simTime;
    rebuildNeighbors(this.homeAgents);
    rebuildNeighbors(this.awayAgents);
    this.world.ball.x = this.ballSys.state.x;
    this.world.ball.y = this.ballSys.state.height;
    this.world.ball.z = this.ballSys.state.z;
    this.syncBallVehicleFromWorld();
  }

  private allVehicles(): Vehicle[] {
    return [...this.homeAgents, ...this.awayAgents].map((a) => a.vehicle);
  }

  private toAgentSnapshot(a: AgentEx): AgentSnapshot {
    const m = a.matchAttrs;
    const p = a.personality;
    // Heading a partir da velocidade do veículo (convenção: atan2(vx, vz)).
    // Em parado, omite heading → scorePass usa fallback sem penalidade de cone.
    const vx = a.vehicle.velocity.x;
    const vz = a.vehicle.velocity.z;
    const speedSq = vx * vx + vz * vz;
    const heading = speedSq > 0.04 ? Math.atan2(vx, vz) : undefined;
    return {
      id: a.id,
      slotId: a.slotId,
      side: a.side,
      x: a.vehicle.position.x,
      z: a.vehicle.position.z,
      speed: a.vehicle.getSpeed(),
      role: a.role,
      heading,
      passe: compositePasse(m),
      passeCurto: m.passeCurto,
      passeLongo: m.passeLongo,
      cruzamento: m.cruzamento,
      marcacao: m.marcacao,
      drible: m.drible,
      finalizacao: m.finalizacao,
      velocidade: m.velocidade,
      fisico: m.fisico,
      fairPlay: m.fairPlay,
      tatico: m.tatico,
      mentalidade: m.mentalidade,
      confianca: m.confianca,
      aggressiveness: p.aggressiveness,
      loyalty: p.loyalty,
      bigGameMentality: p.bigGameMentality,
      ego: p.ego,
      teamMorale: a.side === 'home' ? this.homeMorale?.confidence : this.awayMorale?.confidence,
      teamPressure: a.side === 'home' ? this.homeMorale?.pressure : this.awayMorale?.pressure,
      cognitiveArchetype: a.cognitiveArchetype,
      confidenceRuntime: a.matchRuntime.confidenceRuntime,
      stamina: a.matchRuntime.stamina,
      strongFoot: a.strongFoot,
      archetype: a.archetype,
    };
  }

  private applyVehicleSpeedFromAttrs(
    ag: AgentEx,
    fixedDt: number,
    ctx: LocomotionSteeringContext | null,
  ): void {
    const vel01 = normalizeSpeedAttr01(ag.matchAttrs.velocidade);
    const stamina01 = ag.matchRuntime.stamina / 100;
    const fisico01 = ag.matchAttrs.fisico / 100;
    const fatigueMul = fatigueSpeedMultiplier(stamina01, fisico01);
    const vWalk = locomotionWalkSpeed(vel01, fatigueMul);
    const vJog = locomotionJogSpeed(vel01, fatigueMul);
    const vSprint = locomotionSprintSpeed(vel01, fatigueMul);
    if (ctx === null) {
      ag.locomotionRunBlendSmoothed = 0.35;
    } else {
      ag.locomotionRunBlendSmoothed = smoothRunBlend(
        ag.locomotionRunBlendSmoothed,
        targetRunBlendFromSteering(ctx),
        fixedDt,
      );
    }
    const effort = ag.locomotionRunBlendSmoothed;
    ag.vehicle.maxSpeed = clampVehicleMaxSpeed(
      blendThreeLocomotionCaps(vWalk, vJog, vSprint, effort),
    );
    // Higher effort (sprinting) gives higher top speed but reduces
    // maneuverability (maxForce) so players can't accelerate/turn unrealistically.
    // baseForce tuned to keep walking/jog responsive while sprinting feels heavier.
  const baseForce = Math.max(88, 100 + vel01 * 38);
  // Reduce how much maxForce is penalized at high sprint effort. Previously the
  // penalty could drop maxForce very low which made vehicles unable to accelerate
  // or turn properly when sprinting and produced freezing/stuttering.
  // Cap the penalty and ensure a speed-proportional floor so faster players keep
  // a reasonable maneuverability budget.
  const penaltyCap = Math.min(0.5, effort * 0.6); // at effort=1 -> 0.5
  const maneuverMultiplier = 1 - penaltyCap; // between 0.5 and 1
  const computedForce = Math.round(baseForce * maneuverMultiplier + effort * 18);
  const speedBasedFloor = Math.round(48 + ag.vehicle.maxSpeed * 1.8);
  ag.vehicle.maxForce = Math.min(320, Math.max(speedBasedFloor, computedForce));
    // Discrete locomotion state for renderer/animation (3 níveis — mantido pra compatibilidade).
    if (effort < 0.28) ag.locomotionState = 'walk';
    else if (effort < 0.68) ag.locomotionState = 'jog';
    else ag.locomotionState = 'sprint';

    // 5 níveis narrativos consumidos pela UI/feed.
    ag.locomotionTier = classifyLocomotionTier(effort, Boolean(ag.injuredOnPitch));
    // Lesionado em campo: capa dura no maxSpeed — não consegue acompanhar.
    if (ag.injuredOnPitch) {
      ag.vehicle.maxSpeed = Math.min(
        ag.vehicle.maxSpeed,
        clampVehicleMaxSpeed(vWalk * INJURED_ON_PITCH_SPEED_MULT),
      );
    }
  }

  private bumpRuntimeConfidence(ag: AgentEx, delta: number): void {
    let d = delta;
    const mgr = this.stepManagerParams;
    if (ag.side === 'home' && mgr?.homeStaffMatch && mgr.isHomeFixture === false && d > 0) {
      d *= mgr.homeStaffMatch.coachAwayConfPositiveDeltaScale;
    }
    const mult = this.isTest2dLiveFeed() ? 1.22 : 1;
    const scaled = d * mult;
    ag.matchRuntime.confidenceRuntime = Math.max(
      0.48,
      Math.min(1.28, ag.matchRuntime.confidenceRuntime + scaled),
    );
  }

  /** Momentos “acerto/erro” no feed `test2d` com espaçamento mínimo. */
  private pushLive2dLearningLine(
    text: string,
    tone: NonNullable<MatchEventEntry['live2dMoment']>,
    opts?: { playerId?: string; minGapSec?: number },
  ): void {
    if (!this.isTest2dLiveFeed()) return;
    const gap = opts?.minGapSec ?? 2.15;
    if (this.world.simTime < this.live2dLearningCooldownUntil) return;
    this.live2dLearningCooldownUntil = this.world.simTime + gap;
    pushSimEvent(this.simState, text, 'narrative', tone, opts?.playerId);
  }

  /** Marca um momento forte (sem cooldown) — interceptações, rupturas, etc. */
  private tagLive2dMoment(
    text: string,
    tone: NonNullable<MatchEventEntry['live2dMoment']>,
    playerId?: string,
  ): void {
    if (!this.isTest2dLiveFeed()) return;
    pushSimEvent(this.simState, text, 'narrative', tone, playerId);
  }

  /** Lado que defende contra `carrierSide`: 0–1 se o bloco ainda está “partido”. */
  private tacticalDisorgFacingCarrier(carrierSide: PossessionSide): number {
    const defSide: PossessionSide = carrierSide === 'home' ? 'away' : 'home';
    return this.world.simTime < this.defensiveShapeBreakUntil[defSide] ? 0.52 : 0;
  }

  private decisionExecutionBoost01For(playerId: string): number | undefined {
    const until = this.executionBoostUntil.get(playerId);
    if (until === undefined || this.world.simTime >= until) return undefined;
    const imp = this.executionBoostImpact01.get(playerId) ?? 0.75;
    return Math.max(0.22, Math.min(1, (imp + 1) / 2));
  }

  /**
   * Aplica modificadores de encadeamento (desorganização defensiva, boost de decisão)
   * a partir do outcome unificado do motor.
   */
  private recordMotorTelemetry(
    actorId: string,
    targetId: string | undefined,
    phaseTag: MotorTelemetryPhaseTag,
    outcome: MotorActionOutcome,
  ): void {
    pushMotorTelemetry(this.simState, {
      simTime: this.world.simTime,
      minute: this.simState.minute,
      actorId,
      targetId,
      phaseTag,
      outcome,
    });
  }

  private applyMotorExecutionChain(
    ag: AgentEx,
    kind: MotorActionCanonicalKind,
    tier: ActionExecutionTier,
    impact01: number,
    passReceiverId?: string,
  ): void {
    const needChain =
      tier === 'critical_hit'
      || (tier === 'excellent' && kind === 'dribble');
    if (!needChain) return;

    const { next_state_modifier: m } = buildMotorActionOutcome(kind, tier, impact01);
    const defSide: PossessionSide = ag.side === 'home' ? 'away' : 'home';
    const mgr = this.stepManagerParams;

    if (tier === 'critical_hit' && kind === 'pass' && passReceiverId) {
      if (m.defensiveDisorgBoostSec > 0) {
        let dur = m.defensiveDisorgBoostSec;
        if (defSide === 'home' && mgr?.homeStaffMatch) {
          dur *= mgr.homeStaffMatch.homeDefShapeBreakSecMul;
        }
        this.defensiveShapeBreakUntil[defSide] = this.world.simTime + dur;
      }
      if (m.offensiveExecutionBoostSec > 0) {
        this.executionBoostUntil.set(passReceiverId, this.world.simTime + m.offensiveExecutionBoostSec);
        this.executionBoostImpact01.set(passReceiverId, impact01);
      }
      return;
    }

    if (tier === 'critical_hit' && kind === 'dribble') {
      if (m.defensiveDisorgBoostSec > 0) {
        let dur = m.defensiveDisorgBoostSec;
        if (defSide === 'home' && mgr?.homeStaffMatch) {
          dur *= mgr.homeStaffMatch.homeDefShapeBreakSecMul;
        }
        this.defensiveShapeBreakUntil[defSide] = this.world.simTime + dur;
      }
      const boostSec = Math.max(1.05, m.offensiveExecutionBoostSec);
      this.executionBoostUntil.set(ag.id, this.world.simTime + boostSec);
      this.executionBoostImpact01.set(ag.id, impact01);
      return;
    }

    if (tier === 'excellent' && kind === 'dribble' && m.offensiveExecutionBoostSec > 0) {
      this.executionBoostUntil.set(ag.id, this.world.simTime + m.offensiveExecutionBoostSec);
      this.executionBoostImpact01.set(ag.id, impact01 * 0.88);
    }
  }

  private consumeShotBudgetAfterAttempt(side: PossessionSide): void {
    this.lastShotAttemptSimTime[side] = this.world.simTime;
    if (this.shotBudgetArmed[side]) {
      this.shotBudgetArmed[side] = false;
      this.lastShotBudgetCoolSimTime[side] = this.world.simTime;
      this.simState.shotTelemetry.shotBudgetForcesUsed++;
    }
  }

  private logShotTelemetryMatchSummary(): void {
    const t = this.simState.shotTelemetry;
    const tail = this.simState.carrierDebugLog.slice(0, 10);
    const line =
      `[shot-telemetry] attempts=${t.attempts} onTarget=${t.onTarget} goals=${t.goals} saves=${t.saves} offTarget=${t.offTarget} ` +
      `shootCandidates=${t.shootCandidatesAsCarrier} shootChosen=${t.shootChosen} budgetForces=${t.shotBudgetForcesUsed} ` +
      `carrierTail=${JSON.stringify(tail.map((e) => ({ t: e.simTime.toFixed(1), a: e.pickedAction, z: e.zoneTags })))}`;
    if ((globalThis as { __OF_SHOT_TELEMETRY_LOG__?: boolean }).__OF_SHOT_TELEMETRY_LOG__ === true) {
      console.info(line);
    }
  }

  private tickAgentPhysiology(ag: AgentEx, fixedDt: number, highIntensity: boolean): void {
    const f = ag.matchAttrs.fisico / 100;
    let drain =
      FATIGUE_RATE_BASE
      * fixedDt
      * (highIntensity ? 1 : 0.38)
      * (1.12 - f * 0.38);
    if (ag.side === 'home' && this.stepManagerParams?.homeStaffMatch) {
      drain *= this.stepManagerParams.homeStaffMatch.staminaDrainMulHome;
    }
    let s = ag.matchRuntime.stamina - drain;
    if (!highIntensity) {
      s += STAMINA_RECOVERY_BASE * fixedDt * (0.35 + f * 0.5);
    }
    ag.matchRuntime.stamina = Math.max(22, Math.min(100, s));

    const scheme: FormationSchemeId = ag.side === 'home'
      ? (this.liveRef?.homeFormationScheme ?? '4-3-3') as FormationSchemeId
      : (this.liveRef?.awayFormationScheme ?? '4-3-3') as FormationSchemeId;

    // Disciplina tática: mede distância ao arrive.target (destino tático dinâmico),
    // não ao anchor estático do SmartField — o anchor não acompanha o deslocamento do bloco,
    // causando isOutOfShape=true quase sempre e disciplina colapsando para ~4%.
    const distToTarget = Math.hypot(
      ag.vehicle.position.x - ag.arrive.target.x,
      ag.vehicle.position.z - ag.arrive.target.z,
    );
    // Tolerância: 8m = jogador está executando o movimento tático corretamente
    const isOutOfShape = distToTarget > 8;
    tickTacticalDiscipline(ag.matchRuntime, isOutOfShape, fixedDt);
  }

  private integrateFixed(fixedDt: number, manager: TacticalManagerParams) {
    const live = this.liveRef;
    if (!live || live.phase !== 'playing' || !this.initialized) return;

    this.stepManagerParams = manager;

    for (const [pid, v] of [...this.turnoverPassBlock.entries()]) {
      if (this.world.simTime >= v.until) this.turnoverPassBlock.delete(pid);
    }
    for (const [pid, v] of [...this.passReturnBlock.entries()]) {
      if (this.world.simTime >= v.until) this.passReturnBlock.delete(pid);
    }
    for (const [pid, v] of [...this.passMobilityHint.entries()]) {
      if (this.world.simTime >= v.until) this.passMobilityHint.delete(pid);
    }
    // PR2 — expira cross_incoming hints depois da janela de antecipação.
    for (const [pid, v] of [...this.crossIncomingHint.entries()]) {
      if (this.world.simTime >= v.until) this.crossIncomingHint.delete(pid);
    }

    this.matchClock.tick(fixedDt);
    const clock = this.matchClock.state;
    this.simState.minute = clock.minute;

    if (clock.fullTime) {
      if (this.simState.phase !== 'fulltime') {
        this.logShotTelemetryMatchSummary();
      }
      this.simState.phase = 'fulltime';
      return;
    }

    const period = clock.period;

    if (period === 'halftime') {
      this.simState.clockPeriod = 'halftime';
      if (this.prevClockPeriod !== 'halftime') {
        pushSimEvent(this.simState, `45' — Intervalo.`, 'whistle');
        this.prevClockPeriod = 'halftime';
      }
      this.simState.phase = 'halftime';
      return;
    }

    if (period === 'second_half' && this.prevClockPeriod === 'halftime') {
      this.applySecondHalfSideSwapAndKickoff();
      pushSimEvent(this.simState, `45' — Início do 2.º tempo (troca de campo).`, 'whistle');
      const liveKick = this.liveRef;
      if (liveKick) {
        const who = this.simState.possession === 'home' ? liveKick.homeShort : liveKick.awayShort;
        pushSimEvent(
          this.simState,
          `45' — Pontapé de saída: ${who} (igualdade: não iniciaram o 1.º tempo).`,
        );
      }
      this.matchEngine.reset();
      this.prevClockPeriod = 'second_half';
    } else if (period === 'first_half' || period === 'second_half') {
      this.prevClockPeriod = period;
    }

    this.simState.clockPeriod = period === 'first_half' ? 'first_half' : 'second_half';

    this.structuralSys.update(fixedDt);

    // Deadball handling: if a throw-in is active, check fetcher arrival or timeout and
    // give ball then force a short pass to nearest teammate. This allows manager
    // substitutions to be applied during the dead window (syncLive will be called
    // independently by the host with new lineup snapshots).
    if (this.deadBallUntil > this.world.simTime) {
      if (this.pendingThrowIn) {
        const fetcher = this.findAgent(this.pendingThrowIn.fetcherId);
        if (fetcher) {
          const dx = fetcher.vehicle.position.x - this.pendingThrowIn.x;
          const dz = fetcher.vehicle.position.z - this.pendingThrowIn.z;
          const d = Math.hypot(dx, dz);
          // If fetcher is close enough or time expired, hand ball and force pass.
          if (d < 1.1 || this.world.simTime >= this.deadBallUntil) {
            // Give ball to fetcher at the dead location
            this.ballSys.giveTo(fetcher.id, this.pendingThrowIn.x, this.pendingThrowIn.z);
            this.simState.carrierId = fetcher.id;

            // Find target teammate: for goal kicks pick a midfielder/forward further upfield;
            // for other set pieces pick nearest teammate.
            const team = fetcher.side === 'home' ? this.homeAgents : this.awayAgents;
            const isGoalKick = this.pendingThrowIn.restartType === 'goal_kick';
            let best: AgentEx | null = null;
            let bestScore = isGoalKick ? -Infinity : Infinity;
            // Attack direction: home attacks toward FIELD_LENGTH (positive x), away toward 0.
            const atkDir = fetcher.side === 'home' ? 1 : -1;
            for (const ag of team) {
              if (ag.id === fetcher.id || ag.role === 'gk') continue;
              if (isGoalKick) {
                // Prefer midfielders/forwards (non-defenders) that are furthest in attack direction.
                const isDefender = ag.role === 'cb' || ag.role === 'lb' || ag.role === 'rb';
                const score = (ag.vehicle.position.x * atkDir) - (isDefender ? 30 : 0);
                if (score > bestScore) { bestScore = score; best = ag; }
              } else {
                const dd = Math.hypot(ag.vehicle.position.x - this.pendingThrowIn!.x, ag.vehicle.position.z - this.pendingThrowIn!.z);
                if (dd < bestScore) { bestScore = dd; best = ag; }
              }
            }
            if (best) {
              const toX = best.vehicle.position.x;
              const toZ = best.vehicle.position.z;
              // Goal kicks use a strong clearance-style kick; other restarts use a short pass.
              const speed = isGoalKick ? 22 : 14;
              const flightType = isGoalKick ? 'clearance' : 'pass';
              this.ballSys.startFlight({ x: this.pendingThrowIn.x, z: this.pendingThrowIn.z }, { x: toX, z: toZ }, speed, flightType as any, best.id);
              this.simState.carrierId = null;
              pushLastAction(fetcher.matchRuntime, 'pass_ok');
            }

            this.pendingThrowIn = null;
            this.deadBallUntil = -1;
          }
        } else {
          // Fetcher not found (e.g., substituted out) — clear pending.
          this.pendingThrowIn = null;
        }
      }
      // While deadball active, skip normal play updates (ball is dead); continue ticking clock
      // and allow substitutions via syncLive from host.
    }

    const fsmPhaseBefore = this.fsm.state.phase;
    const freezeFsmForCenterKickoffHold =
      (this.secondHalfKickoffAt !== null && this.world.simTime < this.secondHalfKickoffAt)
      || (this.matchOpeningKickoffAt !== null && this.world.simTime < this.matchOpeningKickoffAt);
    if (!freezeFsmForCenterKickoffHold) {
      this.fsm.tick(fixedDt);
    }
    let fsmPhaseAfter = this.fsm.state.phase;

    if (fsmPhaseBefore === 'kickoff' && fsmPhaseAfter === 'live' && this.pendingPostGoalCenterKickoff) {
      const LKick = createCausalBatch(this.simState.minute, this.simState.causalLog.nextSeq);
      this.fireGoalKickoffOpeningPass(LKick);
      if (LKick.events.length > 0) {
        appendSimCausal(this.simState, [...LKick.events]);
        this.notePossessionEvents(LKick.events);
        for (const ev of LKick.events) {
          emitCausalMatchEvent(this.eventBus, ev, this.world.simTime);
        }
      }
      this.structuralSys.clearGoalRestart();
      fsmPhaseAfter = this.fsm.state.phase;
    }

    if (fsmPhaseBefore === 'goal_restart' && fsmPhaseAfter === 'kickoff') {
      if (this.skipKickoffBallAssign) {
        this.skipKickoffBallAssign = false;
        this.pendingPostGoalCenterKickoff = false;
        this.structuralSys.clearGoalRestart();
      } else {
        this.prepareCenterKickoffAfterGoal();
      }
      fsmPhaseAfter = this.fsm.state.phase;
    }
    if (
      fsmPhaseAfter === 'live'
      && (fsmPhaseBefore === 'kickoff' || fsmPhaseBefore === 'goal_restart')
      && !this.pendingPostGoalCenterKickoff
    ) {
      this.structuralSys.clearGoalRestart();
    }

    if (fsmPhaseAfter === 'live') {
      this.simState.phase = 'live';
      // If FSM just returned from a set piece, clear any remaining deadball window so play resumes.
      const wasSetPiece = fsmPhaseBefore === 'throw_in' || fsmPhaseBefore === 'corner_kick' || fsmPhaseBefore === 'goal_kick';
      if (wasSetPiece) {
        this.deadBallUntil = -1;
        this.pendingFreeKickTakerId = null;
      }
    } else if (fsmPhaseAfter === 'goal_restart') {
      this.simState.phase = 'goal_restart';
    } else if (fsmPhaseAfter === 'kickoff') {
      this.simState.phase = 'kickoff';
    } else {
      this.simState.phase = 'stopped';
    }

    if (this.secondHalfKickoffAt !== null && this.world.simTime >= this.secondHalfKickoffAt) {
      this.secondHalfKickoffAt = null;
      const LOpen = createCausalBatch(this.simState.minute, this.simState.causalLog.nextSeq);
      this.executeSecondHalfOpeningPass(LOpen);
      if (LOpen.events.length > 0) {
        appendSimCausal(this.simState, [...LOpen.events]);
        this.notePossessionEvents(LOpen.events);
        for (const ev of LOpen.events) {
          emitCausalMatchEvent(this.eventBus, ev, this.world.simTime);
        }
      }
      if (this.fsm.state.phase === 'live') {
        this.simState.phase = 'live';
      }
    }

    if (this.matchOpeningKickoffAt !== null && this.world.simTime >= this.matchOpeningKickoffAt) {
      this.matchOpeningKickoffAt = null;
      const LOpen = createCausalBatch(this.simState.minute, this.simState.causalLog.nextSeq);
      this.executeMatchOpeningKickoffPass(LOpen);
      if (LOpen.events.length > 0) {
        appendSimCausal(this.simState, [...LOpen.events]);
        this.notePossessionEvents(LOpen.events);
        for (const ev of LOpen.events) {
          emitCausalMatchEvent(this.eventBus, ev, this.world.simTime);
        }
      }
      if (this.fsm.state.phase === 'live') {
        this.simState.phase = 'live';
      }
    }

    // Deadball active (throw-in / corner / goal kick): clock and FSM keep ticking above;
    // players walk to set piece positions while ball stays frozen. Skip full play logic.
    if (this.deadBallUntil > this.world.simTime) {
      for (const a of [...this.homeAgents, ...this.awayAgents]) {
        this.applyVehicleSpeedFromAttrs(a, fixedDt, null);
        stepVehicle(a, fixedDt);
        stepAgentBodyYaw(a, fixedDt);
      }
      this.world.ball.x = this.ballSys.state.x;
      this.world.ball.y = this.ballSys.state.height;
      this.world.ball.z = this.ballSys.state.z;
      this.world.ballVel.x = 0;
      this.world.ballVel.z = 0;
      this.world.simTime += fixedDt;
      this.prevCarrierId = this.simState.carrierId;
      this.turnoverCtx = null;
      return;
    }

    /**
     * 2.º tempo ou apito inicial: relógio/simTime avançam; jogadores e bola parados até ao primeiro passe
     * curto do meio-campo.
     */
    const centerKickoffHold =
      (this.secondHalfKickoffAt !== null && this.world.simTime < this.secondHalfKickoffAt)
      || (this.matchOpeningKickoffAt !== null && this.world.simTime < this.matchOpeningKickoffAt);
    if (centerKickoffHold) {
      this.enforceKickoffHoldOwnHalves();
      for (const ag of [...this.homeAgents, ...this.awayAgents]) {
        ag.vehicle.velocity.set(0, 0, 0);
      }
      const bx = this.ballSys.state.x;
      const bz = this.ballSys.state.z;
      this.world.ball.x = bx;
      this.world.ball.y = this.ballSys.state.height;
      this.world.ball.z = bz;
      this.world.ballVel.x = 0;
      this.world.ballVel.z = 0;
      this.syncBallVehicleFromWorld();
      this.world.simTime += fixedDt;
      this.prevCarrierId = this.simState.carrierId;
      this.turnoverCtx = null;
      return;
    }

    const ballPhysX = this.ballSys.state.x;
    const ballPhysZ = this.ballSys.state.z;
    const tactBall = this.tacticalBallXYForRunningSlots(ballPhysX, ballPhysZ);
    const ballX = tactBall.x;
    const ballZ = tactBall.z;

    this.world.ball.x = ballPhysX;
    this.world.ball.y = this.ballSys.state.height;
    this.world.ball.z = ballPhysZ;

    const half = this.matchClock.state.half;
    const attackDirHome = getSideAttackDir('home', half);
    const attackDirAway = getSideAttackDir('away', half);

    // Bloco D — Linha tática dinâmica: modula `defensiveLine` por modo + contexto.
    // Mantém `manager` original via clone raso pra não vazar mutação entre ticks.
    let effectiveDefensiveLine = manager.defensiveLine;
    const dlm = manager.defensiveLineMode ?? 'fixed';
    if (dlm === 'high') {
      effectiveDefensiveLine = Math.min(100, manager.defensiveLine + 18);
    } else if (dlm === 'low') {
      effectiveDefensiveLine = Math.max(0, manager.defensiveLine - 18);
    } else if (dlm === 'reactive') {
      const scoreDelta = this.simState.homeScore - this.simState.awayScore;
      const scoreBias = Math.max(-1, Math.min(1, scoreDelta / 2));
      const spirit = this.liveRef?.spiritMomentumClamp01 ?? 0.5;
      // Ganhando + spirit favorável → sobe linha; perdendo → continua avançando pra pressionar.
      // Spirit baixo + perdendo no fim → recua para não sofrer contra-ataque.
      const minute = Math.floor(this.world.simTime / 60);
      const lateAndLosing = minute >= 75 && scoreDelta < 0;
      const reactiveBias = lateAndLosing
        ? -8 + scoreBias * 4
        : (spirit - 0.5) * 24 + scoreBias * 6;
      effectiveDefensiveLine = Math.max(0, Math.min(100, manager.defensiveLine + reactiveBias));
    }
    const effectiveManager = effectiveDefensiveLine !== manager.defensiveLine
      ? { ...manager, defensiveLine: effectiveDefensiveLine }
      : manager;

    const tactx: TacticalContext = {
      defensiveLineDepth: effectiveManager.defensiveLine,
      mentality: effectiveManager.tacticalMentality,
      ballX,
      ballZ,
      half,
    };

    const homeScheme: FormationSchemeId = this.liveRef?.homeFormationScheme ?? '4-3-3';
    const awayScheme: FormationSchemeId = (this.liveRef?.awayFormationScheme ?? '4-3-3') as FormationSchemeId;
    const homePlayers = this.homeAgents.map((a) => ({ id: a.id, x: a.vehicle.position.x, z: a.vehicle.position.z }));
    const awayPlayers = this.awayAgents.map((a) => ({ id: a.id, x: a.vehicle.position.x, z: a.vehicle.position.z }));

    const isSecondHalf = half === 2;
    const engineBallX = isSecondHalf ? FIELD_LENGTH - ballX : ballX;

    const engineFrame = this.matchEngine.step({
      dt: fixedDt,
      ballX: engineBallX, ballZ,
      livePossession: this.simState.possession,
      onBallPlayerId: this.simState.carrierId ?? undefined,
      contestCarrierId: this.simState.carrierId,
      homePlayers, awayPlayers, manager: effectiveManager,
      homeScheme,
      awayScheme,
    });

    const worldHomeSide: 'home' | 'away' = isSecondHalf ? 'away' : 'home';
    const worldAwaySide: 'home' | 'away' = isSecondHalf ? 'home' : 'away';

    const dynamicHome = new Map<string, { x: number; z: number }>();
    for (const [slot, intent] of engineFrame.homeSlots) {
      dynamicHome.set(slot, slotToWorld(worldHomeSide, { nx: intent.nx, nz: intent.nz }));
    }
    const dynamicAway = new Map<string, { x: number; z: number }>();
    for (const [slot, intent] of engineFrame.awaySlots) {
      dynamicAway.set(slot, slotToWorld(worldAwaySide, { nx: intent.nx, nz: intent.nz }));
    }

    const dynamicHomeForAgents = new Map(dynamicHome);
    const dynamicAwayForAgents = new Map(dynamicAway);

    if (this.prevLoopPossession !== null && this.prevLoopPossession !== this.simState.possession) {
      this.transitionCompaction = 1;
      this.transitionLoserSide = this.prevLoopPossession;
    }
    this.prevLoopPossession = this.simState.possession;

    if (this.transitionCompaction > 0.001 && this.transitionLoserSide === 'home') {
      applyTransitionCompactionToSlots(dynamicHomeForAgents, 'home', this.transitionCompaction);
    } else if (this.transitionCompaction > 0.001 && this.transitionLoserSide === 'away') {
      applyTransitionCompactionToSlots(dynamicAwayForAgents, 'away', this.transitionCompaction);
    }
    this.transitionCompaction = Math.max(0, this.transitionCompaction - fixedDt / TRANSITION_COMPACTION_DECAY_SEC);

    /** Com bola nas mãos do GR na saída de baliza: não puxar slots dinâmicos para a grande área. */
    /** Bola às mãos do GR em reposição (qualquer variante): não puxar o bloco para a bola nem espalhar slots. */
    const gkBallInHandRestart =
      this.gkRestart !== null
      && this.ballSys.state.mode === 'held'
      && this.simState.carrierId === this.gkRestart.gkId;
    const dampBallFollowGk =
      gkBallInHandRestart || this.world.simTime < this.gkReleaseChaseSuppressionUntil;
    const ballCentricStrength = dampBallFollowGk ? 0 : 0.12;
    applyBallCentricShiftToSlotMap(dynamicHomeForAgents, {
      ballX,
      ballZ,
      side: 'home',
      half,
      strength: ballCentricStrength,
    });
    applyBallCentricShiftToSlotMap(dynamicAwayForAgents, {
      ballX,
      ballZ,
      side: 'away',
      half,
      strength: ballCentricStrength,
    });

    const phase = this.truthPhase(live);
    let presetHome: Map<string, { x: number; z: number }> | null = null;
    if (phase === 'throw_in' || phase === 'corner_kick' || phase === 'goal_kick') {
      presetHome = applyFormationPreset(phase, ballX, ballZ);
    }

    const homeSnaps = this.homeAgents.map((a) => this.toAgentSnapshot(a));
    const awaySnaps = this.awayAgents.map((a) => this.toAgentSnapshot(a));

    const memTimeMs = this.world.simTime * 1000;
    const allAgentsForMemory = [...this.homeAgents, ...this.awayAgents].map(a => {
      const ui = worldToUiPercent(a.vehicle.position.x, a.vehicle.position.z);
      return {
        playerId: a.id,
        team: a.side as 'home' | 'away',
        x: ui.ux,
        y: ui.uy,
        vx: a.vehicle.velocity.x,
        vy: a.vehicle.velocity.z,
        role: a.role,
      };
    });
    this.homeSpatialMemory.update(allAgentsForMemory, memTimeMs);
    this.awaySpatialMemory.update(allAgentsForMemory, memTimeMs);

    const cidPoss = this.simState.carrierId;
    const carrierSide = cidPoss ? this.findAgent(cidPoss)?.side : undefined;
    const homeHasBall = carrierSide === 'home';
    const awayHasBall = carrierSide === 'away';
    const modeHome: AgentMode = this.fsm.isReforming()
      ? 'reforming'
      : !homeHasBall && manager.tacticalMentality > 78
        ? 'pressing'
        : 'in_play';
    const modeAway: AgentMode = this.fsm.isReforming()
      ? 'reforming'
      : !awayHasBall && manager.tacticalMentality > 78
        ? 'pressing'
        : 'in_play';

    /** GR com bola em saída de baliza: adversários sem press/pursuit à bola (até soltar / voo). */
    const gkHeldWait =
      this.gkRestart !== null
      && this.ballSys.state.mode === 'held'
      && this.simState.carrierId === this.gkRestart.gkId;
    let modeHomeEffective: AgentMode = modeHome;
    let modeAwayEffective: AgentMode = modeAway;
    /** Com o GR a segurar na reposição, todo o campo em modo “reformação” até soltar (evita atacante em cima do GR). */
    if (gkHeldWait) {
      modeHomeEffective = 'reforming';
      modeAwayEffective = 'reforming';
    }

    // -- Compute goal threat for both teams BEFORE decisions --
    const homeCarrier = (this.simState.carrierId && this.findAgent(this.simState.carrierId)?.side === 'home')
      ? homeSnaps.find(s => s.id === this.simState.carrierId) ?? null
      : null;
    const awayCarrier = (this.simState.carrierId && this.findAgent(this.simState.carrierId)?.side === 'away')
      ? awaySnaps.find(s => s.id === this.simState.carrierId) ?? null
      : null;

    this.homeThreat = computeGoalThreat({
      ballX,
      ballZ,
      attackDir: attackDirHome,
      carrier: homeCarrier,
      attackers: homeSnaps,
      defenders: awaySnaps,
      prevThreatLevel: this.homeThreat.level,
    });
    this.awayThreat = computeGoalThreat({
      ballX,
      ballZ,
      attackDir: attackDirAway,
      carrier: awayCarrier,
      attackers: awaySnaps,
      defenders: homeSnaps,
      prevThreatLevel: this.awayThreat.level,
    });

    const L = createCausalBatch(this.simState.minute, this.simState.causalLog.nextSeq);

    let structuralByPlayer: StructuralTargetMap | null = null;
    const goalRestartStructural = shouldApplyGoalRestartStructuralMap(
      phase,
      this.structuralSys.hasGoalRestart(),
    );
    if (goalRestartStructural) {
      structuralByPlayer = this.structuralSys.getGoalRestartPlayerTargets(
        this.homeAgents,
        this.awayAgents,
        this.matchClock.state.half,
        homeScheme,
        awayScheme,
      );
    } else if (
      this.structuralSys.hasSetPieceStructural()
      && (phase === 'throw_in' || phase === 'corner_kick' || phase === 'goal_kick')
    ) {
      structuralByPlayer = this.structuralSys.getSetPiecePlayerTargets(
        this.homeAgents,
        this.awayAgents,
        this.matchClock.state.half,
      );
    }

    const presetAway = presetHome ? mirrorPresetToAway(presetHome) : null;
    const halfForZones = tactx.half ?? this.matchClock.state.half;
    const slotTargetFor = (a: AgentEx): { x: number; z: number } => {
      const schemeZ: FormationSchemeId = a.side === 'home' ? homeScheme : awayScheme;
      const clamp18 = (wx: number, wz: number) =>
        clampWorldToOperativeTactical18(
          wx,
          wz,
          a.slotId ?? 'mc1',
          a.role,
          schemeZ,
          a.side,
          halfForZones,
          0.72,
        );
      const cxHold = FIELD_LENGTH / 2;
      const czHold = FIELD_WIDTH / 2;
      if (
        this.pendingPostGoalCenterKickoff
        && this.simState.carrierId === a.id
        && this.ballSys.state.mode === 'held'
      ) {
        return clamp18(cxHold, czHold);
      }
      if (structuralByPlayer?.has(a.id)) {
        const raw = structuralByPlayer.get(a.id)!;
        if (
          this.structuralSys.hasGoalRestart()
          && !this.structuralSys.isGoalKickWideRestart()
          && (this.fsm.state.phase === 'goal_restart' || this.fsm.state.phase === 'kickoff')
        ) {
          const s = structuralKickoffAnchorWorld(raw);
          return clamp18(s.x, s.z);
        }
        const agentTactx = { ...tactx, teamHasBall: a.side === carrierSide };
        const cr = clampTargetToRoleZone({ side: a.side, role: a.role, slotId: a.slotId }, raw.x, raw.z, agentTactx);
        return clamp18(cr.x, cr.z);
      }
      const dynamic = a.side === 'home' ? dynamicHomeForAgents : dynamicAwayForAgents;
      const preset = a.side === 'home' ? presetHome : presetAway;
      let slotTarget: { x: number; z: number };
      if (preset?.has(a.slotId)) {
        slotTarget = preset.get(a.slotId)!;
      } else {
        const d = dynamic.get(a.slotId);
        slotTarget = d ?? { x: a.vehicle.position.x, z: a.vehicle.position.z };
      }
      const agentTactx = { ...tactx, teamHasBall: a.side === carrierSide };
      const cr = clampTargetToRoleZone(
        { side: a.side, role: a.role, slotId: a.slotId },
        slotTarget.x,
        slotTarget.z,
        agentTactx,
      );
      const coll = a.side === 'home' ? this.homeCollective : this.awayCollective;
      if (coll && a.role !== 'gk') {
        const teamBall = a.side === carrierSide;
        const lcd = computeLineCohesionDelta(cr.x, cr.z, a.role, coll, teamBall);
        return clamp18(cr.x + lcd.dx, cr.z + lcd.dz);
      }
      return clamp18(cr.x, cr.z);
    };

    this.turnoverCtx = { manager, slotTargetFor };

    const carrierForBallSync = this.findAgent(this.simState.carrierId);
    if (this.ballSys.state.mode === 'held' && carrierForBallSync) {
      this.ballSys.syncHeldToCarrier(carrierForBallSync.vehicle.position.x, carrierForBallSync.vehicle.position.z);
    }
    if (this.gkRestart && this.ballSys.state.mode === 'held' && this.simState.carrierId !== this.gkRestart.gkId) {
      this.gkRestart = null;
    }

    const hHalf = this.matchClock.state.half;
    for (const s of ['home', 'away'] as const) {
      if (
        this.world.simTime - this.lastShotAttemptSimTime[s] > SHOT_BUDGET_NO_ATTEMPT_SEC
        && this.world.simTime - this.lastShotBudgetCoolSimTime[s] > SHOT_BUDGET_COOLDOWN_AFTER_FORCE_SEC
      ) {
        this.shotBudgetArmed[s] = true;
      }
    }
    const cidStall = this.simState.carrierId;
    const stallBx = ballPhysX;
    const stallBz = ballPhysZ;
    if (cidStall) {
      const caSt = this.findAgent(cidStall);
      if (caSt) {
        const b3 = getThird({ x: stallBx, z: stallBz }, { team: caSt.side, half: hHalf });
        if (b3 === 'attacking') {
          this.offensiveStallAccum[caSt.side] += fixedDt;
        } else {
          this.offensiveStallAccum[caSt.side] *= 0.9;
        }
      }
    } else {
      this.offensiveStallAccum.home *= 0.88;
      this.offensiveStallAccum.away *= 0.88;
    }

    this.homeCollective = deriveTeamCollectiveState(
      homeSnaps, awaySnaps, ballX, ballZ, attackDirHome, homeHasBall,
      this.simState.carrierId, this.passChainCount.home,
    );
    this.awayCollective = deriveTeamCollectiveState(
      awaySnaps, homeSnaps, ballX, ballZ, attackDirAway, awayHasBall,
      this.simState.carrierId, this.passChainCount.away,
    );

    // Sprint L5 — Moral coletiva. Recomputa a cada ~2 segundos simulados.
    const tickK = Math.floor(this.world.simTime * 60);
    if (tickK - this.moraleLastComputedTick >= 120) {
      this.moraleLastComputedTick = tickK;
      const minute = this.simState.minute;
      const homeFatigue =
        this.homeAgents.reduce((acc, a) => acc + (100 - a.matchRuntime.stamina), 0) /
        Math.max(1, this.homeAgents.length);
      const awayFatigue =
        this.awayAgents.reduce((acc, a) => acc + (100 - a.matchRuntime.stamina), 0) /
        Math.max(1, this.awayAgents.length);
      this.homeMorale = deriveTeamMorale({
        scoreDelta: this.simState.homeScore - this.simState.awayScore,
        minute,
        avgFatigue: homeFatigue,
        hasPossession: homeHasBall,
      });
      this.awayMorale = deriveTeamMorale({
        scoreDelta: this.simState.awayScore - this.simState.homeScore,
        minute,
        avgFatigue: awayFatigue,
        hasPossession: awayHasBall,
      });
      // Tick momentum buffs and apply confidence boost if active
      tickMomentumBuff(this.homeMomentumBuff, this.world.simTime);
      tickMomentumBuff(this.awayMomentumBuff, this.world.simTime);
      if (isMomentumBuffActive(this.homeMomentumBuff, this.world.simTime) && this.homeMorale) {
        this.homeMorale = { ...this.homeMorale, confidence: Math.min(100, this.homeMorale.confidence * this.homeMomentumBuff.confidenceBoost) };
      }
      if (isMomentumBuffActive(this.awayMomentumBuff, this.world.simTime) && this.awayMorale) {
        this.awayMorale = { ...this.awayMorale, confidence: Math.min(100, this.awayMorale.confidence * this.awayMomentumBuff.confidenceBoost) };
      }
      // Recompute tactical adaptation anchors
      recomputeAnchorAdjustment(this.homeAdaptation);
      recomputeAnchorAdjustment(this.awayAdaptation);
    }

    this.runAgentDecisions(
      this.homeAgents, homeSnaps, awaySnaps, dynamicHomeForAgents, presetHome, structuralByPlayer,
      modeHomeEffective, attackDirHome, manager, tactx, L, fixedDt, this.homeThreat, this.awayThreat,
      ballX,
      ballZ,
    );
    this.runAgentDecisions(
      this.awayAgents, awaySnaps, homeSnaps, dynamicAwayForAgents,
      presetHome ? mirrorPresetToAway(presetHome) : null, structuralByPlayer,
      modeAwayEffective, attackDirAway, manager, tactx, L, fixedDt, this.awayThreat, this.homeThreat,
      ballX,
      ballZ,
    );

    const ballStoppedRestart = this.ballSys.state.mode === 'dead'
      && (fsmPhaseAfter === 'goal_restart' || fsmPhaseAfter === 'kickoff');
    if (!ballStoppedRestart) {
      this.resolveTackles(this.homeAgents, awaySnaps, L, manager, slotTargetFor);
      this.resolveTackles(this.awayAgents, homeSnaps, L, manager, slotTargetFor);
    }

    const carrier = this.findAgent(this.simState.carrierId);
    const carrierPos = carrier ? { x: carrier.vehicle.position.x, z: carrier.vehicle.position.z } : undefined;

    const flightBeforeTick = this.ballSys.state.flight
      ? { ...this.ballSys.state.flight }
      : null;
    const flightDone = this.ballSys.tick(fixedDt, carrierPos);

    if (flightDone && flightBeforeTick) {
      this.handleFlightCompletion(L, flightBeforeTick, manager, slotTargetFor);
    }

    if (this.pendingPassIntercept && this.world.simTime >= this.pendingPassIntercept.deadlineSimTime) {
      const pend = this.pendingPassIntercept;
      this.ballSys.state.x = pend.contactX;
      this.ballSys.state.z = pend.contactZ;
      this.ballSys.state.height = 0;
      this.ballSys.state.vx = 0;
      this.ballSys.state.vz = 0;
      this.ballSys.state.vy = 0;
      this.ballSys.state.mode = 'loose';
      this.ballSys.state.flight = null;
      this.world.ball.x = pend.contactX;
      this.world.ball.y = 0;
      this.world.ball.z = pend.contactZ;
      this.world.ballVel.x = 0;
      this.world.ballVel.z = 0;
      this.finalizePassInterceptFlight(L);
    }

    // Q5 — Intercepção contínua frame-by-frame. Antes, bola atravessava o
    // campo passando por adversários sem encostar (intercept era reativo no
    // start). Agora a cada tick em flight, varre defensores próximos da bola
    // (raio dinâmico baseado em altura: bola alta = mais difícil cabecear).
    if (
      this.ballSys.state.mode === 'flight'
      && this.ballSys.state.flight
      && (this.ballSys.state.flight.kind === 'pass' || this.ballSys.state.flight.kind === 'clearance')
      && !this.pendingPassIntercept
    ) {
      const bx = this.ballSys.state.x;
      const bz = this.ballSys.state.z;
      const bh = this.ballSys.state.height;
      // Raio: 2.0m no chão, sobe para 3.2m em alturas até 1.8m, depois decai
      // (bola muito alta — quase impossível parar a não ser GR).
      const reachR = bh < 0.4 ? 2.0 : bh < 1.8 ? 2.0 + (bh - 0.4) / 1.4 * 1.2 : Math.max(1.2, 3.2 - (bh - 1.8) * 1.2);
      // Não intercepta o destinatário pretendido (recipientId no pass) nem
      // o passador (lastTouchPlayerId).
      const flight = this.ballSys.state.flight;
      const recipientId = (flight as { recipientId?: string }).recipientId;
      const passerId = this.ballSys.getLastTouchPlayerId();
      let interceptor: AgentEx | null = null;
      let bestDist = reachR;
      for (const ag of [...this.homeAgents, ...this.awayAgents]) {
        if (ag.id === recipientId || ag.id === passerId) continue;
        const dx = ag.vehicle.position.x - bx;
        const dz = ag.vehicle.position.z - bz;
        const d = Math.hypot(dx, dz);
        if (d < bestDist) {
          // GK ganha bonus de raio dentro da própria área
          bestDist = d;
          interceptor = ag;
        }
      }
      if (interceptor) {
        // Probabilidade de capturar: ~85% para perto, escala com marcacao + velocidade
        const sn = this.toAgentSnapshot(interceptor);
        const skill = (sn.marcacao + sn.velocidade) / 200;
        const captureP = 0.55 + skill * 0.40;
        const tickKey = Math.floor(this.world.simTime * 60);
        const rng = rngFromSeed(this.simState.simulationSeed, `flight_intercept:${interceptor.id}:${tickKey}`);
        if (rng.nextUnit() < captureP) {
          // Captura: bola pra defensor, ganha posse imediatamente.
          this.ballSys.giveTo(interceptor.id, interceptor.vehicle.position.x, interceptor.vehicle.position.z);
          this.simState.possession = interceptor.side;
          this.simState.carrierId = interceptor.id;
          this.pendingPassIntercept = null;
          L.push({
            type: 'possession_change',
            payload: { to: interceptor.side, reason: 'flight_intercept' },
          });
          pushSimEvent(
            this.simState,
            `${this.simState.minute}' — Interceptação no ar — bola dominada.`,
            'narrative',
            this.isTest2dLiveFeed() ? 'good' : undefined,
            this.isTest2dLiveFeed() ? interceptor.id : undefined,
          );
        }
      }
    }

    if (this.ballSys.state.mode === 'loose' && !ballStoppedRestart) {
      this.pickUpLooseBall(L, manager, slotTargetFor);
    }

    // When ball is loose or in flight, nearest players should chase it
    if ((this.ballSys.state.mode === 'loose' || this.ballSys.state.mode === 'flight') && !ballStoppedRestart) {
      this.directPlayersToChaseBall(slotTargetFor);
    }

    if (L.events.length > 0) {
      appendSimCausal(this.simState, [...L.events]);
      this.notePossessionEvents(L.events);
      for (const ev of L.events) {
        emitCausalMatchEvent(this.eventBus, ev, this.world.simTime);
        if (
          ev.type === 'shot_result'
          && (ev.payload.outcome === 'goal' || ev.payload.outcome === 'post_in')
        ) {
          this.cueQueue.push({ kind: 'goal_shake', intensity: 0.9, at: this.world.simTime });
        }
      }
    }

    rebuildNeighbors(this.homeAgents);
    rebuildNeighbors(this.awayAgents);
    this.syncBallVehicleFromWorld();
    const allV = this.allVehicles();

  // Update team intent every ~2s (throttled by regulator)
  const simTimeMs = this.world.simTime * 1000;
  if (this.teamIntentRegulator.ready(simTimeMs)) {
    const minute = this.matchClock.state.minute;
    const homeScore = this.simState.homeScore;
    const awayScore = this.simState.awayScore;
    const homeAvgFatigue = this.homeAgents.length > 0
      ? this.homeAgents.reduce((s, a) => s + (100 - (a.matchRuntime?.stamina ?? 100)), 0) / this.homeAgents.length
      : 0;
    const awayAvgFatigue = this.awayAgents.length > 0
      ? this.awayAgents.reduce((s, a) => s + (100 - (a.matchRuntime?.stamina ?? 100)), 0) / this.awayAgents.length
      : 0;
    this.homeTeamIntent = resolveTeamIntent({
      minute,
      homeScore,
      awayScore,
      possession: this.simState.possession ?? 'home',
      teamStrength: 50,
      opponentStrength: 50,
      averageFatigue: homeAvgFatigue,
    });
    this.awayTeamIntent = resolveTeamIntent({
      minute,
      homeScore: awayScore,
      awayScore: homeScore,
      possession: this.simState.possession === 'away' ? 'home' : 'away',
      teamStrength: 50,
      opponentStrength: 50,
      averageFatigue: awayAvgFatigue,
    });
  }

  // Update rhythm based on recent turnover / possession / threat
  this.updateRhythm();
  // Smoothly lerp timeScale toward target for gentle slow-motion
  const alpha = 0.08; // smoothing factor per tick (tuneable)
  this.timeScale += (this.timeScaleTarget - this.timeScale) * alpha;

    const cid = this.simState.carrierId;
    const looseOrFlightBall =
      !ballStoppedRestart
      && (this.ballSys.state.mode === 'loose' || this.ballSys.state.mode === 'flight');
    for (const ag of this.homeAgents) {
      const near = Math.hypot(ag.vehicle.position.x - ballX, ag.vehicle.position.z - ballZ);
      this.tickAgentPhysiology(ag, fixedDt, near < 16 || ag.id === cid);
    }
    for (const ag of this.awayAgents) {
      const near = Math.hypot(ag.vehicle.position.x - ballX, ag.vehicle.position.z - ballZ);
      this.tickAgentPhysiology(ag, fixedDt, near < 16 || ag.id === cid);
    }

    const gkWideFreeze = this.isGkRestartBallInHandFreeze();
    for (const ag of this.homeAgents) {
      if (gkWideFreeze && this.gkRestart && ag.id !== this.gkRestart.gkId) {
        ag.vehicle.velocity.set(0, 0, 0);
        continue;
      }
      const dx = ag.vehicle.position.x - ballX;
      const dz = ag.vehicle.position.z - ballZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const others = allV.filter((v) => v !== ag.vehicle);
      const ballUI = worldToUiPercent(ballX, ballZ);
      const playerUI = worldToUiPercent(ag.vehicle.position.x, ag.vehicle.position.z);
      applySteeringForPhase(ag, this.ballVehicle, others, modeHomeEffective, dist, homeHasBall, ballUI.ux, playerUI.ux, ag.matchRuntime.stamina / 100);
    }
    for (const ag of this.awayAgents) {
      if (gkWideFreeze && this.gkRestart && ag.id !== this.gkRestart.gkId) {
        ag.vehicle.velocity.set(0, 0, 0);
        continue;
      }
      const dx = ag.vehicle.position.x - ballX;
      const dz = ag.vehicle.position.z - ballZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const others = allV.filter((v) => v !== ag.vehicle);
      const ballUI = worldToUiPercent(ballX, ballZ);
      const playerUI = worldToUiPercent(ag.vehicle.position.x, ag.vehicle.position.z);
      applySteeringForPhase(ag, this.ballVehicle, others, modeAwayEffective, dist, awayHasBall, ballUI.ux, playerUI.ux, ag.matchRuntime.stamina / 100);
    }

    for (const ag of this.homeAgents) {
      if (gkWideFreeze && this.gkRestart && ag.id !== this.gkRestart.gkId) continue;
      const dx = ag.vehicle.position.x - ballX;
      const dz = ag.vehicle.position.z - ballZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const distToArriveM = Math.hypot(
        ag.vehicle.position.x - ag.arrive.target.x,
        ag.vehicle.position.z - ag.arrive.target.z,
      );
      const urgeShapeReturn =
        modeHomeEffective === 'reforming'
        && ag.id !== cid
        && ag.matchRuntime.tacticalDisciplineScore >= 0.42
        && distToArriveM > 7.5;
      this.applyVehicleSpeedFromAttrs(ag, fixedDt, {
        mode: modeHomeEffective,
        pursuitWeight: ag.pursuit.weight,
        arriveWeight: ag.arrive.weight,
        distToBall: dist,
        teamHasBall: homeHasBall,
        isCarrier: ag.id === cid,
        attackProximity01: attackProximity01(ag.vehicle.position.x, attackDirHome),
        stamina01: ag.matchRuntime.stamina / 100,
        looseOrFlightBall,
        urgeShapeReturn,
        distToArriveTargetM: distToArriveM,
      });
    }
    for (const ag of this.awayAgents) {
      if (gkWideFreeze && this.gkRestart && ag.id !== this.gkRestart.gkId) continue;
      const dx = ag.vehicle.position.x - ballX;
      const dz = ag.vehicle.position.z - ballZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const distToArriveM = Math.hypot(
        ag.vehicle.position.x - ag.arrive.target.x,
        ag.vehicle.position.z - ag.arrive.target.z,
      );
      const urgeShapeReturn =
        modeAwayEffective === 'reforming'
        && ag.id !== cid
        && ag.matchRuntime.tacticalDisciplineScore >= 0.42
        && distToArriveM > 7.5;
      this.applyVehicleSpeedFromAttrs(ag, fixedDt, {
        mode: modeAwayEffective,
        pursuitWeight: ag.pursuit.weight,
        arriveWeight: ag.arrive.weight,
        distToBall: dist,
        teamHasBall: awayHasBall,
        isCarrier: ag.id === cid,
        attackProximity01: attackProximity01(ag.vehicle.position.x, attackDirAway),
        stamina01: ag.matchRuntime.stamina / 100,
        looseOrFlightBall,
        urgeShapeReturn,
        distToArriveTargetM: distToArriveM,
      });
    }

    const halfPhys = this.matchClock.state.half;
    // Cooperative nudge: blend arrive.target toward operative zone BEFORE YUKA integration.
    // This lets YUKA execute the convergence naturally instead of overwriting position post-physics.
    const nudgeArriveTargetToZone = (a: AgentEx) => {
      if (a.id === this.simState.carrierId) return;
      const schemeN: FormationSchemeId = a.side === 'home' ? homeScheme : awayScheme;
      const ctxZ = { team: a.side, half: halfPhys };
      const model = buildSlotZoneProfile(a.slotId ?? 'mc1', a.role, schemeN, a.side, halfPhys);
      const curTargetZ = worldPosToTactical18Zone(a.arrive.target.x, a.arrive.target.z, ctxZ);
      if (operativeZoneIdSet18(model).has(curTargetZ)) return;
      const t = clampWorldToOperativeTactical18(
        a.arrive.target.x,
        a.arrive.target.z,
        a.slotId ?? 'mc1',
        a.role,
        schemeN,
        a.side,
        halfPhys,
        0.55,
      );
      const k = 0.28;
      a.arrive.target.x += (t.x - a.arrive.target.x) * k;
      a.arrive.target.z += (t.z - a.arrive.target.z) * k;

      // SMARTFIELD: secondary shape correction toward role anchor (recovery_priority weighted)
      const sfRole = sfRoleFromSlot(a.slotId ?? 'mc1', schemeN);
      const sfCorr = sfShapeCorrection(a.arrive.target.x, a.arrive.target.z, sfRole, a.side);
      if (sfCorr.isOutOfShape) {
        const sfK = 0.18 * Math.min(1, sfCorr.distFromAnchor / 20);
        a.arrive.target.x += sfCorr.correctionDx * sfK;
        a.arrive.target.z += sfCorr.correctionDz * sfK;
      }
    };
    const skipNudge = this.fsm.isReforming();

    const applyAdvancedSteering = (a: AgentEx, teammates: AgentEx[], opponents: AgentEx[], teamHasBall: boolean, attackDir: 1 | -1) => {
      if (a.id === cid || a.role === 'gk') return;
      const pos = a.vehicle.position;
      const isDefender = a.slotId === 'zag1' || a.slotId === 'zag2' || a.slotId === 'zag3';
      const isAttacker = a.slotId === 'ata' || a.slotId === 'pe' || a.slotId === 'pd';

      if (isDefender && !teamHasBall) {
        let nearestThreat: AgentEx | null = null;
        let nearestDist = Infinity;
        for (const opp of opponents) {
          const d = Math.hypot(pos.x - opp.vehicle.position.x, pos.z - opp.vehicle.position.z);
          if (d < nearestDist) { nearestDist = d; nearestThreat = opp; }
        }
        if (nearestThreat && nearestDist < 30) {
          const goalX = attackDir === 1 ? 0 : FIELD_LENGTH;
          const goalZ = FIELD_WIDTH / 2;
          const interpose = computeInterpose(pos.x, pos.z, nearestThreat.vehicle.position.x, nearestThreat.vehicle.position.z, goalX, goalZ);
          if (interpose.weight > 0) {
            a.arrive.target.x += interpose.fx * interpose.weight * 1.8;
            a.arrive.target.z += interpose.fz * interpose.weight * 1.8;
          }
        }
        const linemates = teammates.filter(t => t.slotId === 'zag1' || t.slotId === 'zag2' || t.slotId === 'zag3');
        if (linemates.length > 0) {
          const cohesion = computeDefensiveLineCohesion(pos.x, pos.z, linemates.map(t => ({ x: t.vehicle.position.x, z: t.vehicle.position.z })));
          if (cohesion.weight > 0) {
            a.arrive.target.x += cohesion.fx * cohesion.weight * 1.2;
            a.arrive.target.z += cohesion.fz * cohesion.weight * 1.2;
          }
        }
      }

      if (isAttacker && teamHasBall && cid) {
        const carrier = teammates.find(t => t.id === cid);
        if (carrier) {
          const offset = getSupportOffset(a.slotId, carrier.slotId, attackDir);
          const support = computeOffsetSupport(pos.x, pos.z, carrier.vehicle.position.x, carrier.vehicle.position.z, offset.offsetX, offset.offsetZ);
          if (support.weight > 0) {
            a.arrive.target.x += support.fx * support.weight * 1.5;
            a.arrive.target.z += support.fz * support.weight * 1.5;
          }
        }
      }
    };

    for (const a of this.homeAgents) {
      if (gkWideFreeze && this.gkRestart && a.id !== this.gkRestart.gkId) continue;
      if (!skipNudge) nudgeArriveTargetToZone(a);
      applyAdvancedSteering(a, this.homeAgents, this.awayAgents, homeHasBall, attackDirHome);
      stepVehicle(a, fixedDt);
      stepAgentBodyYaw(a, fixedDt);
    }
    for (const a of this.awayAgents) {
      if (gkWideFreeze && this.gkRestart && a.id !== this.gkRestart.gkId) continue;
      if (!skipNudge) nudgeArriveTargetToZone(a);
      applyAdvancedSteering(a, this.awayAgents, this.homeAgents, awayHasBall, attackDirAway);
      stepVehicle(a, fixedDt);
      stepAgentBodyYaw(a, fixedDt);
    }

    // Hard clamp físico do GK: garante que nenhum path de código deixa o goleiro fora da área.
    // Aplicado após stepVehicle para ser a última palavra sobre a posição física.
    if (this.simState.phase === 'live') {
      const half = this.matchClock.state.half;
      const bz = this.ballSys.state.z;
      for (const a of [...this.homeAgents, ...this.awayAgents]) {
        if (a.role !== 'gk' && a.slotId !== 'gol') continue;
        a.vehicle.position.x = clampGoalkeeperTargetX(a.side, half, a.vehicle.position.x);
        a.vehicle.position.z = clampGoalkeeperTargetZ(bz, a.vehicle.position.z);
      }
    }

    this.tryConfusionRefereeIntegrateEnd(fsmPhaseAfter, ballStoppedRestart);

    this.world.ball.x = this.ballSys.state.x;
    this.world.ball.y = this.ballSys.state.height;
    this.world.ball.z = this.ballSys.state.z;
    this.world.ballVel.x = this.ballSys.state.vx;
    this.world.ballVel.z = this.ballSys.state.vz;
    this.world.simTime += fixedDt;

    // Track pass chain: carrier changed within the same team = successful pass
    if (this.simState.carrierId && this.simState.carrierId !== this.prevCarrierId) {
      const newSide = this.findAgent(this.simState.carrierId)?.side;
      const oldSide = this.prevCarrierId ? this.findAgent(this.prevCarrierId)?.side : null;
      if (newSide && newSide === oldSide) {
        this.passChainCount[newSide as PossessionSide]++;
      } else if (newSide) {
        this.passChainCount[newSide as PossessionSide] = 1;
        if (oldSide) this.passChainCount[oldSide as PossessionSide] = 0;
      }
    }
    this.prevCarrierId = this.simState.carrierId;
    this.turnoverCtx = null;
  }

  private runAgentDecisions(
    agents: AgentEx[],
    teamSnaps: AgentSnapshot[],
    oppSnaps: AgentSnapshot[],
    dynamicSlots: Map<string, { x: number; z: number }>,
    presetSlots: Map<string, { x: number; z: number }> | null,
    structuralByPlayer: StructuralTargetMap | null,
    mode: AgentMode,
    attackDir: 1 | -1,
    manager: TacticalManagerParams,
    tactx: TacticalContext,
    L: ReturnType<typeof createCausalBatch>,
    dt: number,
    ownThreat: GoalThreat,
    oppThreat: GoalThreat,
    /** Bola usada em decisões colectivas (pode ser amortecida no chutão do GR). */
    decisionBallX?: number,
    decisionBallZ?: number,
  ) {
    const side = agents[0]?.side ?? 'home';
    const ballXDec = decisionBallX ?? this.ballSys.state.x;
    const ballZDec = decisionBallZ ?? this.ballSys.state.z;
    const teamPhase = detectTeamPhase(
      ballXDec,
      attackDir,
      this.simState.carrierId ? (this.findAgent(this.simState.carrierId)?.side ?? null) : null,
      side,
      this.simState.carrierId,
    );

    const carrierJustChanged = this.simState.carrierId !== this.prevCarrierId;
    const ballSector = computeBallSector(this.ballSys.state.z);

    for (const ag of agents) {
      if (
        this.pendingPostGoalCenterKickoff
        && this.simState.carrierId === ag.id
        && this.ballSys.state.mode === 'held'
      ) {
        const cx = FIELD_LENGTH / 2;
        const cz = FIELD_WIDTH / 2;
        ag.vehicle.velocity.set(0, 0, 0);
        this.safeArrive(ag, cx, cz, mode);
        continue;
      }

      let slotTarget: { x: number; z: number };
      if (structuralByPlayer?.has(ag.id)) {
        slotTarget = structuralByPlayer.get(ag.id)!;
      } else if (presetSlots && presetSlots.has(ag.slotId)) {
        slotTarget = presetSlots.get(ag.slotId)!;
      } else {
        const d = dynamicSlots.get(ag.slotId);
        slotTarget = d ?? { x: ag.vehicle.position.x, z: ag.vehicle.position.z };
      }
      const agTactx = { ...tactx, teamHasBall: this.simState.possession === ag.side };
      const clamped = clampTargetToRoleZone({ side: ag.side, role: ag.role, slotId: ag.slotId }, slotTarget.x, slotTarget.z, agTactx);

      if (this.isGkRestartBallInHandFreeze() && this.gkRestart && ag.id !== this.gkRestart.gkId) {
        const bx = this.ballSys.state.x;
        const bz = this.ballSys.state.z;
        const px = ag.vehicle.position.x;
        const pz = ag.vehicle.position.z;
        const gkAg = this.findAgent(this.gkRestart.gkId);
        const hHalfGk = this.matchClock.state.half;
        const kickEnd =
          gkAg
            ? defendingPenaltyEndForTeam(gkAg.side, hHalfGk)
            : goalKickEndFromBallPosition(bx, bz) ?? 'west';

        /**
         * Afastamento mínimo: partir da posição ACTUAL do jogador e empurrar
         * apenas para fora da grande área (margem de ~1,2 m já incluída em
         * clampWorldOutsidePenaltyAreaAtEnd).  Sem empurrão radial largo que
         * arrastava o bloco para o meio-campo / lado oposto.
         */
        let outX = px;
        let outZ = pz;
        const penOut = clampWorldOutsidePenaltyAreaAtEnd(outX, outZ, kickEnd);
        outX = penOut.x;
        outZ = penOut.z;

        const GK_RESTART_MIN_BALL_M = 2.5;
        const dbx = outX - bx;
        const dbz = outZ - bz;
        const dBall = Math.hypot(dbx, dbz);
        if (dBall < GK_RESTART_MIN_BALL_M && dBall > 0.01) {
          const sc = (GK_RESTART_MIN_BALL_M + 0.1) / dBall;
          outX = bx + dbx * sc;
          outZ = bz + dbz * sc;
          const reclamp = clampWorldOutsidePenaltyAreaAtEnd(outX, outZ, kickEnd);
          outX = reclamp.x;
          outZ = reclamp.z;
        } else if (dBall <= 0.01) {
          const tcx = FIELD_LENGTH * 0.5 - bx;
          const tcz = FIELD_WIDTH * 0.5 - bz;
          const tl = Math.hypot(tcx, tcz) || 1;
          outX = bx + (tcx / tl) * (GK_RESTART_MIN_BALL_M + 0.1);
          outZ = bz + (tcz / tl) * (GK_RESTART_MIN_BALL_M + 0.1);
          const reclamp = clampWorldOutsidePenaltyAreaAtEnd(outX, outZ, kickEnd);
          outX = reclamp.x;
          outZ = reclamp.z;
        }

        const odx = outX - px;
        const odz = outZ - pz;
        const odist = Math.hypot(odx, odz);
        const maxStep = 22 * dt;
        if (odist > 0.06) {
          const s = Math.min(odist, maxStep) / odist;
          const cp = clampToPitch(px + odx * s, pz + odz * s, 0.9);
          ag.vehicle.position.x = cp.x;
          ag.vehicle.position.z = cp.z;
        }
        ag.vehicle.velocity.set(0, 0, 0);
        this.safeArrive(ag, outX, outZ, 'reforming');
        continue;
      }

      // Structural reorganisation: drive arrive directly (skip role clamp — targets are authored for the event).
      if (structuralByPlayer?.has(ag.id)) {
        const skipStructForGkRestart =
          this.gkRestart
          && ag.id === this.gkRestart.gkId
          && this.simState.carrierId === ag.id;
        if (!skipStructForGkRestart) {
          const raw = structuralByPlayer.get(ag.id)!;
          const sx = Math.min(FIELD_LENGTH - 2, Math.max(2, raw.x));
          const sz = Math.min(FIELD_WIDTH - 2, Math.max(2, raw.z));
          this.safeArrive(ag, sx, sz, mode);
          continue;
        }
      }

      const isCarrier = this.simState.carrierId === ag.id;
      const isReceiver = this.ballSys.state.mode === 'flight' && this.ballSys.state.flight?.targetPlayerId === ag.id;
      const selfSnap = this.toAgentSnapshot(ag);
      // Propagate transient nudges from agent binding (set by FanFrustration events)
      if ((ag as any)._nudgeAdvance) {
        (selfSnap as any)._nudgeAdvance = (ag as any)._nudgeAdvance;
        // decay the nudge so it doesn't persist forever
        (ag as any)._nudgeAdvance = Math.max(0, (ag as any)._nudgeAdvance - 1);
      }
      if ((ag as any)._nudgeAvoidKeeperPass) {
        (selfSnap as any)._nudgeAvoidKeeperPass = true;
        // one-shot
        delete (ag as any)._nudgeAvoidKeeperPass;
      }
      if ((ag as any)._nudgePreferFinish) {
        (selfSnap as any)._nudgePreferFinish = true;
        delete (ag as any)._nudgePreferFinish;
      }
      if ((ag as any)._nudgeAttack1v1) {
        (selfSnap as any)._nudgeAttack1v1 = true;
        delete (ag as any)._nudgeAttack1v1;
      }

      if (
        this.gkRestart
        && ag.id === this.gkRestart.gkId
        && this.simState.carrierId === ag.id
        && this.ballSys.state.mode === 'held'
      ) {
        const halfGk = this.matchClock.state.half;
        if (this.world.simTime < this.gkRestart.kickAt) {
          const dg = getDefendingGoalX(ag.side, halfGk);
          const maxAdvance = dg < FIELD_LENGTH / 2 ? GOAL_AREA_DEPTH_M + 2.5 : FIELD_LENGTH - GOAL_AREA_DEPTH_M - 2.5;
          const stepX = clampGoalkeeperTargetX(ag.side, halfGk, dg < FIELD_LENGTH / 2
            ? Math.min(maxAdvance, ag.vehicle.position.x + 2.0)
            : Math.max(maxAdvance, ag.vehicle.position.x - 2.0));
          this.safeArrive(ag, stepX, ag.vehicle.position.z, mode);
          continue;
        }
        this.executeGkRestartDistribution(ag, selfSnap, teamSnaps, oppSnaps, attackDir, L, manager);
        this.gkRestart = null;
        continue;
      }

      const flightProgress = (this.ballSys.state.mode === 'flight' && this.ballSys.state.flight)
        ? this.ballSys.state.flight.progress
        : 0;

      // For the team with ball: use own threat (how close we are to scoring)
      // For the team without ball: use opponent's threat (how much danger we're in)
      const teamHasBall = this.simState.carrierId
        ? (this.findAgent(this.simState.carrierId)?.side === side)
        : false;
      const activeThreat = teamHasBall ? ownThreat : oppThreat;

      const block = this.turnoverPassBlock.get(ag.id);
      const returnBl = this.passReturnBlock.get(ag.id);
      const passBlocklistParts: string[] = [];
      if (block && block.peerId && this.world.simTime < block.until) passBlocklistParts.push(block.peerId);
      if (returnBl && this.world.simTime < returnBl.until) passBlocklistParts.push(returnBl.fromId);
      const passBlocklist = passBlocklistParts.length > 0 ? passBlocklistParts : undefined;

      const pm = this.passMobilityHint.get(ag.id);
      let offensivePassMobility: { forward: boolean } | undefined;
      if (pm && this.world.simTime < pm.until) {
        const flightTo = this.ballSys.state.mode === 'flight' ? this.ballSys.state.flight?.targetPlayerId : undefined;
        const receiverHasBall = this.simState.carrierId === pm.carrierId;
        const ballFlyingToReceiver = flightTo === pm.carrierId;
        if (receiverHasBall || ballFlyingToReceiver) {
          offensivePassMobility = { forward: pm.forward };
        }
      }

      // PR2 — Cross telegraphing: atacante recebeu sinal do lateral.
      const ci = this.crossIncomingHint.get(ag.id);
      const incomingCross = ci && this.world.simTime < ci.until
        ? { x: ci.expectedX, z: ci.expectedZ }
        : undefined;

      let rollSalt = 0;
      const tickKey = Math.floor(this.world.simTime * 1000);
      const roll01 = () =>
        unitFromParts(this.simState.simulationSeed, ['dec', ag.id, tickKey, rollSalt++]);

      const decCtx: DecisionContext = {
        self: selfSnap,
        teammates: teamSnaps.filter((t) => t.id !== ag.id),
        opponents: oppSnaps,
        ballX: ballXDec,
        ballZ: ballZDec,
        isCarrier,
        isReceiver,
        ballFlightProgress: flightProgress,
        possession: this.simState.carrierId
          ? (this.findAgent(this.simState.carrierId)?.side ?? null)
          : null,
        attackDir,
        clockHalf: this.matchClock.state.half,
        slotX: clamped.x,
        slotZ: clamped.z,
        scoreDiff: side === 'home'
          ? this.simState.homeScore - this.simState.awayScore
          : this.simState.awayScore - this.simState.homeScore,
        minute: this.simState.minute,
        mentality: manager.tacticalMentality,
        tacticalDefensiveLine: manager.defensiveLine,
        tacticalPressing: manager.tacticalMentality,
        tacticalWidth: 50,
        tacticalTempo: manager.tempo,
        tacticalStyle: manager.tacticalStyle,
        // Sprint L4 — pressing context + marking
        pressingZone: manager.pressing?.zone,
        pressingIntensity: manager.pressing?.intensity,
        markingAssignment: side === 'home'
          ? manager.markingAssignments?.[(ag as any).playerId ?? ag.id]
          : undefined,
        // Bloco B — fase ofensiva derivada da posição da bola na perspectiva deste agente
        attackPhase: computeAttackPhase(ballXDec, ballZDec, attackDir),
        // Q3 — Se este jogador é o cobrador de bola parada, expõe contexto pra
        // OnBallDecision avaliar chute direto / cruzamento em vez de passe seguro.
        setPieceContext: (() => {
          if (ag.id !== this.pendingFreeKickTakerId) return undefined;
          if (this.deadBallUntil <= this.world.simTime) return undefined;
          const goalX = attackDir === 1 ? FIELD_LENGTH : 0;
          const goalZ = FIELD_WIDTH / 2;
          const distanceToGoal = Math.hypot(goalX - ballXDec, goalZ - ballZDec);
          return { kind: 'free_kick' as const, distanceToGoal };
        })(),
        stamina: ag.matchRuntime.stamina,
        teamIntentBias: getTeamIntentBias(side === 'home' ? this.homeTeamIntent : this.awayTeamIntent),
        spatialMemory: side === 'home' ? this.homeSpatialMemory : this.awaySpatialMemory,
        simTimeMs: this.world.simTime * 1000,
        decisionDebug: DECISION_DEBUG,
        profile: ag.profile,
        agentProfile: this.agentProfileCache.get(ag.id),
        teamIntent: side === 'home' ? this.homeTeamIntent : this.awayTeamIntent,
        teamPhase,
        carrierId: this.simState.carrierId,
        carrierJustChanged,
        ballSector,
        sfSubzone: sfGetSubzone(selfSnap.x, selfSnap.z),
        sfBallSubzone: sfGetSubzone(ballXDec, ballZDec),
        threatLevel: activeThreat.level,
        threatTrend: activeThreat.trend,
        passBlocklist,
        offensivePassMobility,
        incomingCross,
        goalContext: buildGoalContext(
          selfSnap.x, selfSnap.z,
          ag.side as 'home' | 'away',
          this.matchClock.state.half,
          oppSnaps,
        ),
        shootBudgetForce: isCarrier && this.shotBudgetArmed[ag.side],
        offensiveStallShotBoost: isCarrier && this.offensiveStallAccum[ag.side] > SHOOT_OFFENSIVE_STALL_SEC,
        noteShootChosen: isCarrier
          ? () => {
              this.simState.shotTelemetry.shootChosen++;
            }
          : undefined,
        noteShootCandidate: isCarrier
          ? () => {
              this.simState.shotTelemetry.shootCandidatesAsCarrier++;
            }
          : undefined,
        noteCarrierDecisionDebug: isCarrier
          ? (p) => {
              const log = this.simState.carrierDebugLog;
              log.unshift({
                simTime: this.world.simTime,
                playerId: ag.id,
                pickedAction: p.pickedId,
                zoneTags: p.zoneTags,
                top3: p.top3,
              });
              if (log.length > 14) log.pop();
            }
          : undefined,
        roll01,
        decisionExecutionBoost01: this.decisionExecutionBoost01For(ag.id),
        cognitiveArchetype: ag.cognitiveArchetype,
        gameSpiritHomeMomentum01: this.liveRef?.spiritMomentumClamp01 ?? null,
        voiceBias: (() => {
          const cmd = this.liveRef?.voiceCommands?.[ag.id];
          if (!cmd || !isCommandActive(cmd, Date.now())) return undefined;
          return commandDecisionBias(cmd.intent, cmd.payload);
        })(),
  collective: side === 'home' ? this.homeCollective : this.awayCollective,
  // Ball attributes to influence reception and execution
  // @ts-ignore - dynamic extension for richer context consumption
  ballMass: this.ballSys.mass,
  // @ts-ignore
  ballDrag: this.ballSys.drag,
  // @ts-ignore
  ballControlDifficulty: this.ballSys.controlDifficulty,
  // Nudges from FanFrustration system propagated via transient snapshot fields
  // @ts-ignore
  _nudgeAdvance: (selfSnap as any)._nudgeAdvance,
  // @ts-ignore
  _nudgeAvoidKeeperPass: (selfSnap as any)._nudgeAvoidKeeperPass,
  // @ts-ignore
  _nudgePreferFinish: (selfSnap as any)._nudgePreferFinish,
  // @ts-ignore
  _nudgeAttack1v1: (selfSnap as any)._nudgeAttack1v1,
  // current match rhythm and time scale for decision tempo
  // @ts-ignore
  matchRhythm: this.matchRhythm ?? 'normal',
  // @ts-ignore
  timeScale: this.timeScale ?? 1,
      };

      // Captain influence: boost pressing and defensive line for agents near the captain
      try {
        const captainId = side === 'home' ? this.homeCaptainId : null;
        const captain = captainId ? agents.find((a) => a.id === captainId || (a as any).playerId === captainId) : null;
        if (captain && captain.id !== ag.id) {
          const captainState = createCaptainInfluenceState(captain.id);
          const influences = applyCaptainInfluence(captainState, captain.vehicle.position.x, captain.vehicle.position.z, [{ id: ag.id, x: ag.vehicle.position.x, z: ag.vehicle.position.z }]);
          const inf = influences.get(ag.id);
          if (inf) {
            (decCtx as any).pressingIntensity = Math.min(100, ((decCtx as any).pressingIntensity ?? manager.pressing?.intensity ?? 50) + inf.pressingBoost);
            (decCtx as any).tacticalDefensiveLine = Math.min(100, ((decCtx as any).tacticalDefensiveLine ?? manager.defensiveLine ?? 50) + inf.defensiveLineBoost);
          }
        }
      } catch (e) {
        // non-blocking
      }

      // attach a lightweight memory/emotional snapshot for decision consumers
      try {
        const runtime = ag.matchRuntime as PlayerMatchRuntime | undefined;
        if (runtime) {
          (decCtx as any).playerMemory = (runtime as any).memory ?? undefined;
          (decCtx as any).playerEmotional = (runtime as any).emotional ?? undefined;
        }
      } catch (e) {
        // non-blocking
      }

      attachGameSpiritPhase1Hint(decCtx, ag.id);
      const gsTrigger = detectGameSpiritPhase1Trigger(ag.id, isReceiver, isCarrier, flightProgress);
      if (gsTrigger) {
        scheduleGameSpiritPhase1Request({
          playerId: ag.id,
          decCtx,
          simTime: this.world.simTime,
          trigger: gsTrigger,
          shirtNumber: this.shirtNumbers.get(ag.id),
          onNarration: (text) => {
            pushSimEvent(this.simState, text, 'narrative');
          },
        });
      }

      // ── Tactical Archetype Intention ─────────────────────────────────────
      // Deriva a intenção do arquétipo tático e injeta no decCtx.
      // Não-bloqueante: falha silenciosa se o jogador não tem tacticalArchetypeId.
      try {
        const pitchState = (ag as any).pitchState as import('@/engine/types').PitchPlayerState | undefined;
        const archetypeId = pitchState?.tacticalArchetypeId ?? (ag as any).tacticalArchetypeId;
        if (archetypeId) {
          const agX = ag.vehicle.position.x;
          const agZ = ag.vehicle.position.z;
          const { ux: nx, uy: ny } = worldToUiPercent(agX, agZ);
          const zone = getZoneFromNormalizedPosition({ x: nx, y: ny });
          const teamHasPossession = this.simState.possession === ag.side;
          const activeTriggers: import('@/tactical').ArchetypeTrigger[] = [];
          if (teamHasPossession) activeTriggers.push('team_in_possession');
          else activeTriggers.push('team_out_of_possession');
          if (decCtx.attackPhase === 'final_third' || decCtx.attackPhase === 'box_entry') activeTriggers.push('ball_in_final_third');
          if (decCtx.attackPhase === 'build_up') activeTriggers.push('ball_in_own_half');
          if ((decCtx as any).pressingIntensity > 65) activeTriggers.push('high_press_active');
          if (decCtx.scoreDiff < 0 && decCtx.minute > 75) activeTriggers.push('space_behind_defense');
          const intentionResult = getPlayerIntention(
            { tacticalArchetypeId: archetypeId, currentZone: (zone?.id ?? 'MDC') as FieldZoneId },
            {
              currentZone: (zone?.id ?? 'MDC') as FieldZoneId,
              teamHasPossession,
              isCarrier,
              activeTriggers,
              pressureLevel: (decCtx as any).pressingIntensity ?? 50,
              minute: decCtx.minute,
              scoreDiff: decCtx.scoreDiff,
              phase: teamHasPossession
                ? (decCtx.attackPhase === 'final_third' || decCtx.attackPhase === 'box_entry' ? 'attack' : 'buildup')
                : 'defense',
            },
          );
          decCtx.tacticalIntention = intentionResult;
        }
      } catch (_e) {
        // non-blocking — never break the sim loop
      }

      const playerAction = ag.decision.tick(decCtx, this.world.simTime);
      // record attempted action into player memory (non-blocking)
      try {
        const runtime = ag.matchRuntime as PlayerMatchRuntime | undefined;
        if (runtime) {
          let label = (playerAction.kind as unknown) as string;
          if ((playerAction as any).action && (playerAction as any).action.type) label = `${playerAction.kind}:${(playerAction as any).action.type}` as unknown as string;
          if ((playerAction as any).reception) label = `${playerAction.kind}:reception` as unknown as string;
          if ((playerAction as any).intent) label = `${playerAction.kind}:pre_receive` as unknown as string;
          pushMemoryAction(runtime, label, Math.floor(this.world.simTime * 1000));
        }
      } catch (e) {
        // swallow
      }
      // lightweight highlight triggers for dramatic moments
      if (playerAction.kind === 'on_ball') {
        const a = playerAction.action as any;
        if ((a.type === 'shoot' || a.type === 'shoot_long_range')) {
          const zone = identifyFieldZone(ag.vehicle.position.x, attackDir);
          if (zone === 'opp_box' || zone === 'att_third') this.triggerHighlight('goalChance', 0.96, 1000);
        }
        if (a.type === 'through_ball' && a.option && a.option.linesBroken >= 1 && a.option.progressionGain > 0.12) {
          this.triggerHighlight('danger', 0.9, 850);
        }
      }
      this.executePlayerAction(ag, playerAction, selfSnap, oppSnaps, attackDir, clamped, mode, L);
    }
  }

  private executePlayerAction(
    ag: AgentEx,
    playerAction: PlayerAction,
    selfSnap: AgentSnapshot,
    oppSnaps: AgentSnapshot[],
    attackDir: 1 | -1,
    slotTarget: { x: number; z: number },
    mode: AgentMode,
    L: ReturnType<typeof createCausalBatch>,
  ) {
    // GK aerial intercept: when a high ball (> 1.5 m) is landing inside the penalty box,
    // override the normal decision and rush toward the landing point.
    if (
      (ag.role === 'gk' || ag.slotId === 'gol') &&
      playerAction.kind !== 'on_ball' &&
      this.simState.carrierId !== ag.id &&
      this.simState.phase === 'live'
    ) {
      const flight = this.ballSys.state.flight;
      const bHeight = this.ballSys.state.height;
      if (flight && bHeight > 1.5) {
        const half = this.matchClock.state.half;
        const goalX = getDefendingGoalX(ag.side, half);
        const penBoxDepth = 16.5; // penalty area depth in metres
        const penBoxHalfWidth = 20.15;
        const pitchCenZ = FIELD_WIDTH / 2;
        const landX = flight.toX;
        const landZ = flight.toZ;
        const inBox =
          Math.abs(landX - goalX) < penBoxDepth &&
          Math.abs(landZ - pitchCenZ) < penBoxHalfWidth;
        if (inBox) {
          this.safeArrive(ag, landX, landZ, 'pressing');
          return;
        }
      }
    }

    switch (playerAction.kind) {
      case 'on_ball':
        this.executeOnBallAction(ag, playerAction.action, selfSnap, oppSnaps, attackDir, slotTarget, mode, L);
        break;
      case 'off_ball':
        this.executeOffBallAction(ag, playerAction.action, slotTarget, mode);
        break;
      case 'pre_receiving':
        // Move TOWARD the ball — player attacks the pass, not waiting
        if (this.ballSys.state.flight) {
          this.safeArrive(ag, this.ballSys.state.flight.toX, this.ballSys.state.flight.toZ, 'in_play');
        }
        break;
      case 'receiving': {
        // Handle fumble — ball escapes with residual velocity from the error
        if (!playerAction.reception.success) {
          const bx = this.ballSys.state.x + playerAction.reception.errorDisplacement.dx;
          const bz = this.ballSys.state.z + playerAction.reception.errorDisplacement.dz;
          if (this.simState.carrierId === ag.id) {
            const errDx = playerAction.reception.errorDisplacement.dx;
            const errDz = playerAction.reception.errorDisplacement.dz;
            const errLen = Math.hypot(errDx, errDz);
            const fumbleSpeed = Math.min(12, errLen * 3.5);
            const fvx = errLen > 0.01 ? (errDx / errLen) * fumbleSpeed : 0;
            const fvz = errLen > 0.01 ? (errDz / errLen) * fumbleSpeed : 0;
            const fvy = errLen > 3 ? 1.8 : 0;
            this.ballSys.registerLastTouch(ag.id);
            this.ballSys.setLoose(bx, bz, fvx, fvz, fvy);
            this.simState.carrierId = null;
            if (this.isTest2dLiveFeed()) {
              const vk = `${ag.id}:${Math.floor(this.world.simTime * 30)}`;
              this.pushLive2dLearningLine(test2dReceptionFumbleLine(this.simState.minute, vk), 'bad', {
                playerId: ag.id,
                minGapSec: 1.4,
              });
            }
          }
        } else {
          // Successful reception: player moves in the attack direction
          // during the (very short) reception window — never freezes
          const carryX = ag.vehicle.position.x + attackDir * 2;
          const carryZ = ag.vehicle.position.z;
          this.safeArrive(ag, carryX, carryZ, 'in_play');
        }
        break;
      }
      case 'idle':
      default:
        // Should rarely reach here with the new engine, but ensure movement
        this.safeArrive(
          ag,
          slotTarget.x,
          clampWorldTargetToSlotFlankCorridor(ag.slotId, slotTarget.z, slotTarget.z),
          mode,
        );
        break;
    }
  }

  private executeOnBallAction(
    ag: AgentEx,
    action: OnBallAction,
    selfSnap: AgentSnapshot,
    oppSnaps: AgentSnapshot[],
    attackDir: 1 | -1,
    slotTarget: { x: number; z: number },
    mode: AgentMode,
    L: ReturnType<typeof createCausalBatch>,
  ) {
    if (this.simState.carrierId !== ag.id) return;

    // Track ação para telemetria
    const minute = this.matchClock.state.minute;
    const uiPos = worldToUiPercent(ag.vehicle.position.x, ag.vehicle.position.z);
    const zone = `${uiPos.ux.toFixed(0)},${uiPos.uy.toFixed(0)}`;
    const isForward = (action as any).option?.isForward;
    // trackAction removido (telemetria desativada)

    if (
      mode === 'reforming'
      && this.structuralSys.hasGoalRestart()
      && (this.fsm.state.phase === 'goal_restart' || this.fsm.state.phase === 'kickoff')
      && (action.type === 'shoot' || action.type === 'shoot_long_range')
    ) {
      this.safeArrive(ag, slotTarget.x, slotTarget.z, mode);
      return;
    }

    const half = this.matchClock.state.half;
    const tickK = Math.floor(this.world.simTime * 60);
    const baseSeed = this.simState.simulationSeed;
    const zoneTags = getZoneTags({ x: selfSnap.x, z: selfSnap.z }, { team: ag.side, half });

    switch (action.type) {
      // All pass types
      case 'short_pass_safety':
      case 'lateral_pass':
      case 'vertical_pass':
      case 'switch_play':
      case 'long_ball':
      case 'one_two':
      case 'through_ball': {
        const opt = action.option;
        const press01 = nearestOpponentPressure01(selfSnap, oppSnaps);
        const possBefore = this.simState.possession;
        const disorg01 = this.tacticalDisorgFacingCarrier(ag.side);
        const passRes = resolvePassForPossession(
          baseSeed,
          tickK,
          selfSnap,
          opt,
          press01,
          oppSnaps,
          disorg01,
          this.stepManagerParams?.homeStaffMatch ?? null,
        );
        logActionResolverDebug({
          playerId: ag.id,
          action: `pass:${action.type}`,
          zoneTags,
          roll: passRes.roll,
          threshold: passRes.pSuccess,
          outcome: passRes.completed ? 'completed' : passRes.interceptPlayerId ? 'intercept' : 'loose',
          possessionBefore: possBefore,
          possessionAfter: this.simState.possession,
          reason: passRes.reason,
        });
        const stats = getOrCreateStats(this.simState, ag.id);
        stats.passesAttempt++;
        if (passRes.completed) stats.passesOk++;

        const str = selfSnap.fisico / 100;
        let speed: number;
        if (action.type === 'long_ball' || action.type === 'switch_play') {
          speed = 30 + selfSnap.passe * 0.16 + str * 2.8;
        } else if (action.type === 'through_ball') {
          speed = 27 + selfSnap.passe * 0.15 + str * 1.4;
        } else if (action.type === 'lateral_pass') {
          speed = 18 + selfSnap.passe * 0.1;
        } else if (action.type === 'short_pass_safety') {
          speed = 16.5 + selfSnap.passe * 0.11;
        } else {
          speed = 22 + selfSnap.passe * 0.12 + str * 0.9;
        }
        speed = Math.max(14, Math.min(46, speed));

        if (passRes.interceptPlayerId) {
          const intr = this.findAgent(passRes.interceptPlayerId);
          if (intr) {
            this.recordMotorTelemetry(
              ag.id,
              opt.targetId,
              'pass',
              buildMotorActionOutcome('pass', passRes.executionTier, passRes.impact01),
            );
            this.recordMotorTelemetry(
              intr.id,
              ag.id,
              'intercept',
              buildMotorActionOutcome('defense', 'excellent', 0.62),
            );
            const stealX = ag.vehicle.position.x;
            const stealZ = ag.vehicle.position.z;
            const contact = this.clampedPassInterceptContactPoint(
              selfSnap.x,
              selfSnap.z,
              passRes.x,
              passRes.z,
              intr.vehicle.position.x,
              intr.vehicle.position.z,
            );
            const flyDist = Math.hypot(contact.x - selfSnap.x, contact.z - selfSnap.z);
            const spd = Math.max(11, speed);
            const tFly = flyDist / spd;
            const deadlinePad = 0.45;
            this.pendingPassIntercept = {
              interceptorId: intr.id,
              passerId: ag.id,
              stealX,
              stealZ,
              possessionBefore: possBefore,
              contactX: contact.x,
              contactZ: contact.z,
              deadlineSimTime: this.world.simTime + Math.min(4.2, Math.max(0.55, tFly + deadlinePad)),
              icKey: `${ag.id}:${intr.id}:${tickK}`,
            };
            this.scheduleGkReleaseChaseSuppressionFromFlight(selfSnap.x, selfSnap.z, contact.x, contact.z, speed);
            this.ballSys.registerLastTouch(ag.id);
            this.ballSys.startFlight(
              { x: selfSnap.x, z: selfSnap.z },
              { x: contact.x, z: contact.z },
              speed,
              'pass',
            );
            this.simState.carrierId = null;
          }
          break;
        }

        this.recordMotorTelemetry(
          ag.id,
          opt.targetId,
          'pass',
          buildMotorActionOutcome('pass', passRes.executionTier, passRes.impact01),
        );

        if (passRes.completed) {
          if (passRes.executionTier === 'critical_hit') {
            this.applyMotorExecutionChain(ag, 'pass', passRes.executionTier, passRes.impact01, opt.targetId);
            pushSimEvent(
              this.simState,
              `${this.simState.minute}' — Passe de ruptura — linha adversária desorganizada.`,
              'narrative',
              this.isTest2dLiveFeed() ? 'good' : undefined,
              this.isTest2dLiveFeed() ? ag.id : undefined,
            );
            this.bumpRuntimeConfidence(ag, CONFIDENCE_DELTA_GOOD * 0.22);
          } else if (passRes.executionTier === 'excellent' && this.isTest2dLiveFeed()) {
            const vk = `${ag.id}:${opt.targetId}:${tickK}`;
            this.pushLive2dLearningLine(test2dPassSolidLine(this.simState.minute, vk), 'good', {
              playerId: ag.id,
              minGapSec: 2.35,
            });
          }
          const forwardPass =
            opt.isForward
            || action.type === 'through_ball'
            || action.type === 'vertical_pass'
            || action.type === 'long_ball'
            || action.type === 'switch_play'
            || action.type === 'one_two';
          if (action.type !== 'one_two') {
            this.passReturnBlock.set(opt.targetId, {
              fromId: ag.id,
              until: this.world.simTime + 1.35,
            });
          }
          this.passMobilityHint.set(ag.id, {
            carrierId: opt.targetId,
            until: this.world.simTime + (forwardPass ? 2.65 : 1.55),
            forward: forwardPass,
          });
          this.ballSys.startFlight(
            { x: selfSnap.x, z: selfSnap.z },
            { x: passRes.x, z: passRes.z },
            speed,
            'pass',
            opt.targetId,
          );
        } else {
          const pdx = passRes.x - selfSnap.x;
          const pdz = passRes.z - selfSnap.z;
          const pDist = Math.hypot(pdx, pdz);
          const rollSpeed = Math.min(8, speed * 0.2);
          const pvx = pDist > 0.01 ? (pdx / pDist) * rollSpeed : 0;
          const pvz = pDist > 0.01 ? (pdz / pDist) * rollSpeed : 0;
          this.ballSys.setLoose(passRes.x, passRes.z, pvx, pvz);
          if (this.isTest2dLiveFeed()) {
            const vk = `${ag.id}:${tickK}`;
            this.pushLive2dLearningLine(test2dPassIncompleteLine(this.simState.minute, vk), 'bad', {
              playerId: ag.id,
              minGapSec: 1.55,
            });
          }
        }
        this.simState.carrierId = null;
        pushLastAction(ag.matchRuntime, passRes.completed ? 'pass_ok' : 'pass_fail');
        this.bumpRuntimeConfidence(
          ag,
          passRes.completed ? CONFIDENCE_DELTA_GOOD * 0.28 : -CONFIDENCE_DELTA_BAD * 0.22,
        );
        break;
      }

      // Shooting — resolução lógica imediata; causal `shot_result` + efeitos após trajetória (sem teletransporte).
      case 'shoot':
      case 'shoot_long_range': {
        const longRange = action.type === 'shoot_long_range';
        const shotDisorg = this.tacticalDisorgFacingCarrier(ag.side);
        const spiritClamp = this.liveRef?.spiritMomentumClamp01;
        const shotRes = resolveShotForPossession(
          baseSeed,
          tickK,
          selfSnap,
          attackDir,
          oppSnaps,
          zoneTags,
          longRange,
          shotDisorg,
          spiritClamp,
          this.stepManagerParams?.homeStaffMatch ?? null,
        );
        const shotOutcome = shotRes.outcome;
        const strike = shotRes.strikeProfile;
        const possBefore = this.simState.possession;
        const causalOutcome =
          shotOutcome === 'miss' && strike === 'power' ? 'wide' : shotOutcome;
        const defSide: PossessionSide = ag.side === 'home' ? 'away' : 'home';
        const plan = this.shotPlanFromResolution(shotRes);
        const primary = this.computeShotPrimaryFlight(
          selfSnap,
          attackDir,
          shotRes,
          plan,
          ag.id,
          defSide,
        );

        L.push({
          type: 'shot_attempt',
          payload: {
            side: ag.side,
            shooterId: ag.id,
            zone: selfSnap.x > FIELD_LENGTH * 0.66 ? 'att' : selfSnap.x > FIELD_LENGTH * 0.33 ? 'mid' : 'def',
            minute: this.simState.minute,
            target: { x: (shotRes.goalX / FIELD_LENGTH) * 100, y: (shotRes.goalZ / FIELD_WIDTH) * 100 },
            strike,
          },
        });
        {
          const who = this.shirtNumbers.get(ag.id) ? `#${this.shirtNumbers.get(ag.id)}` : ag.id;
          const shotKey = `${ag.id}:${Math.floor(this.world.simTime * 1000)}`;
          // Emit "chance created" narrative for high-xG shots in live 2D.
          if (this.isTest2dLiveFeed() && shotRes.xGOnTarget >= 0.18) {
            this.pushLive2dLearningLine(test2dChanceCreatedLine(this.simState.minute, shotKey), 'good', {
              playerId: ag.id,
              minGapSec: 3,
            });
          }
          const shotLine = this.isTest2dLiveFeed()
            ? test2dShotWindupLine(this.simState.minute, who, shotKey)
            : `${this.simState.minute}' — Remate de ${who}!`;
          pushSimEvent(
            this.simState,
            shotLine,
            'narrative',
            this.isTest2dLiveFeed() ? 'info' : undefined,
            this.isTest2dLiveFeed() ? ag.id : undefined,
          );
        }

        logActionResolverDebug({
          playerId: ag.id,
          action: longRange ? 'shoot_long' : 'shoot',
          zoneTags,
          roll: shotRes.rollOnTarget,
          threshold: shotRes.pOnTarget,
          outcome: shotOutcome,
          possessionBefore: possBefore,
          possessionAfter: '',
          reason: shotRes.reason,
        });

        const stats = getOrCreateStats(this.simState, ag.id);
        stats.shots++;
        if (shotOutcome === 'goal') stats.goals++;

        const tel = this.simState.shotTelemetry;
        tel.attempts++;
        if (shotOutcome === 'miss') tel.offTarget++;
        else tel.onTarget++;
        if (shotOutcome === 'goal') tel.goals++;
        if (shotOutcome === 'save') tel.saves++;
        this.consumeShotBudgetAfterAttempt(ag.side);

        if (shotRes.executionTier === 'critical_hit') {
          this.bumpRuntimeConfidence(ag, CONFIDENCE_DELTA_GOOD * 0.12);
        }

        this.simState.carrierId = null;
        this.shotPending = {
          phase: 'primary',
          plan,
          shooterId: ag.id,
          shooterSide: ag.side,
          defSide,
          longRange,
          shotRes,
          causalOutcome,
          rebound: primary.rebound,
        };
        this.ballSys.startFlight(primary.from, primary.to, primary.speed, 'shot');
        break;
      }

      // Crossing
      case 'low_cross':
      case 'high_cross': {
        const stats = getOrCreateStats(this.simState, ag.id);
        stats.passesAttempt++;
        const possBefore = this.simState.possession;
        const cRes = resolveCrossForPossession(
          baseSeed,
          tickK,
          selfSnap,
          oppSnaps,
          action.targetX,
          action.targetZ,
          action.type === 'high_cross',
          this.stepManagerParams?.homeStaffMatch ?? null,
        );
        logActionResolverDebug({
          playerId: ag.id,
          action: action.type,
          zoneTags,
          roll: cRes.roll,
          threshold: cRes.pSuccess,
          outcome: cRes.success ? 'cross_ok' : 'cross_fail',
          possessionBefore: possBefore,
          possessionAfter: this.simState.possession,
          reason: cRes.reason,
        });
        if (cRes.success) stats.passesOk++;
        // PR3 — Telemetria: só credita quando lateral telegrafou nos últimos 1.5s.
        recordCrossConcluded({
          senderId: ag.id,
          senderSlot: ag.slotId,
          senderSide: ag.side as 'home' | 'away',
          minute: this.simState.minute,
          outcome: cRes.success ? 'cross_ok' : 'cross_fail',
        });
        if (cRes.success && cRes.executionTier === 'critical_hit') {
          pushSimEvent(
            this.simState,
            `${this.simState.minute}' — Cruzamento de ruptura!`,
            'narrative',
            this.isTest2dLiveFeed() ? 'good' : undefined,
            this.isTest2dLiveFeed() ? ag.id : undefined,
          );
          this.bumpRuntimeConfidence(ag, CONFIDENCE_DELTA_GOOD * 0.18);
        } else if (!cRes.success && this.isTest2dLiveFeed()) {
          const vk = `${ag.id}:${tickK}`;
          this.pushLive2dLearningLine(test2dCrossFailLine(this.simState.minute, vk), 'bad', {
            playerId: ag.id,
            minGapSec: 1.8,
          });
        }
        const cr = selfSnap.cruzamento / 100;
        const speed = action.type === 'high_cross' ? 26 + cr * 4 : 22 + cr * 3;
        this.ballSys.startFlight(
          { x: selfSnap.x, z: selfSnap.z },
          { x: cRes.targetX, z: cRes.targetZ },
          speed,
          'cross',
        );
        this.simState.carrierId = null;
        pushLastAction(ag.matchRuntime, cRes.success ? 'cross_ok' : 'cross_poor');
        this.bumpRuntimeConfidence(
          ag,
          cRes.success ? CONFIDENCE_DELTA_GOOD * 0.2 : -CONFIDENCE_DELTA_BAD * 0.16,
        );
        break;
      }

      case 'aggressive_carry':
      case 'progressive_dribble':
      case 'beat_marker': {
        const press01 = nearestOpponentPressure01(selfSnap, oppSnaps);
        const possBefore = this.simState.possession;
        const dr = resolveDribbleBeat(
          baseSeed,
          tickK,
          selfSnap,
          press01,
          this.stepManagerParams?.homeStaffMatch ?? null,
        );
        logActionResolverDebug({
          playerId: ag.id,
          action: `dribble:${action.type}`,
          zoneTags,
          roll: dr.roll,
          threshold: dr.pSuccess,
          outcome: dr.success ? 'ok' : 'fail',
          possessionBefore: possBefore,
          possessionAfter: this.simState.possession,
          reason: dr.reason,
        });
        if (dr.success) {
          const drStats = getOrCreateStats(this.simState, ag.id);
          drStats.dribblesOk += 1;
          this.applyMotorExecutionChain(ag, 'dribble', dr.executionTier, dr.impact01);
          if (dr.executionTier === 'critical_hit') {
            pushSimEvent(
              this.simState,
              `${this.simState.minute}' — Drible de elite — linha ultrapassada!`,
              'narrative',
              this.isTest2dLiveFeed() ? 'good' : undefined,
              this.isTest2dLiveFeed() ? ag.id : undefined,
            );
            this.bumpRuntimeConfidence(ag, CONFIDENCE_DELTA_GOOD * 0.2);
          }
        }
        if (!dr.success) {
          const stealX = ag.vehicle.position.x;
          const stealZ = ag.vehicle.position.z;
          let best: AgentSnapshot | undefined;
          let bd = 999;
          for (const o of oppSnaps) {
            const d = Math.hypot(o.x - selfSnap.x, o.z - selfSnap.z);
            if (d < bd) {
              bd = d;
              best = o;
            }
          }
          if (best && bd < 3.2) {
            const defA = this.findAgent(best.id);
            if (defA) {
              L.push({ type: 'possession_change', payload: { to: defA.side, reason: 'dribble_fail' } });
              this.simState.possession = defA.side;
              this.ballSys.giveTo(defA.id, defA.vehicle.position.x, defA.vehicle.position.z);
              this.simState.carrierId = defA.id;
              this.bumpRuntimeConfidence(defA, CONFIDENCE_DELTA_GOOD * 0.3);
              this.bumpRuntimeConfidence(ag, -CONFIDENCE_DELTA_BAD * 0.28);
              if (this.turnoverCtx) {
                this.applyTurnoverPlay(
                  defA,
                  ag.id,
                  stealX,
                  stealZ,
                  'dribble_fail',
                  L,
                  this.turnoverCtx.manager,
                  this.turnoverCtx.slotTargetFor,
                );
              }
              if (this.isTest2dLiveFeed()) {
                const vk = `${ag.id}:${defA.id}:${tickK}`;
                this.tagLive2dMoment(test2dDribbleStrippedLine(this.simState.minute, vk), 'bad', ag.id);
              }
              break;
            }
          }
          {
            const dsx = stealX - ag.vehicle.position.x;
            const dsz = stealZ - ag.vehicle.position.z;
            const dLen = Math.hypot(dsx, dsz);
            const tackleRollSpeed = Math.min(10, 4 + dLen * 0.6);
            const tvx = dLen > 0.01 ? (dsx / dLen) * tackleRollSpeed : 0;
            const tvz = dLen > 0.01 ? (dsz / dLen) * tackleRollSpeed : 0;
            this.ballSys.setLoose(stealX, stealZ, tvx, tvz, 0.8);
          }
          this.simState.carrierId = null;
          if (this.isTest2dLiveFeed()) {
            const vk = `${ag.id}:${tickK}`;
            this.pushLive2dLearningLine(test2dDribbleLooseLine(this.simState.minute, vk), 'bad', {
              playerId: ag.id,
              minGapSec: 1.5,
            });
          }
          break;
        }
        this.safeArrive(ag, action.targetX, action.targetZ, 'pressing');
        break;
      }

      // Dribble / carry variants (baixo risco)
      case 'simple_carry':
      case 'cut_inside':
      case 'run_to_byline':
      case 'enter_box':
      case 'turn_on_marker': {
        this.safeArrive(ag, action.targetX, action.targetZ, 'in_play');
        if (this.isTest2dLiveFeed() && (action.type === 'cut_inside' || action.type === 'enter_box' || action.type === 'turn_on_marker')) {
          const vk = `${ag.id}:${action.type}:${tickK}`;
          this.pushLive2dLearningLine(test2dDribbleSuccessLine(this.simState.minute, vk), 'good', {
            playerId: ag.id,
            minGapSec: 4,
          });
        }
        break;
      }

      // Hold / shield
      case 'hold_ball':
      case 'shield_ball':
        break;

      // Retreat
      case 'retreat_reorganize':
        this.safeArrive(ag, action.targetX, action.targetZ, 'reforming');
        break;

      // Draw foul — atacante força contacto; falta com seed (cartão ocasional).
      case 'draw_foul': {
        let nearest: AgentSnapshot | undefined;
        let bd = 999;
        for (const o of oppSnaps) {
          const d = Math.hypot(o.x - selfSnap.x, o.z - selfSnap.z);
          if (d < bd) {
            bd = d;
            nearest = o;
          }
        }
        if (!nearest || bd > DRAW_FOUL_MAX_DIST) break;
        const defA = this.findAgent(nearest.id);
        if (!defA) break;
        const foulRng = rngFromSeed(baseSeed, `draw_foul:${ag.id}:${nearest.id}:${tickK}`);
        let p =
          DRAW_FOUL_SUCCESS_BASE
          + ((selfSnap.mentalidade + selfSnap.confianca) / 200) * DRAW_FOUL_MENTAL_BONUS;
        if (nearestOpponentPressure01(selfSnap, oppSnaps) > 0.55) p += 0.08;
        p = Math.min(0.52, p);
        if (foulRng.nextUnit() >= p) break;
        const sevRoll = foulRng.nextUnit();
        const foulSeverity: 'light' | 'firm' | 'ugly' =
          sevRoll < 0.58 ? 'light' : sevRoll < 0.86 ? 'firm' : 'ugly';
        this.appendLiveDisciplineAfterFoul(L, foulRng, defA, ag.id, 'draw_foul', foulSeverity, ag);
        break;
      }

      // Clearance
      case 'clearance': {
        this.ballSys.startFlight(
          { x: selfSnap.x, z: selfSnap.z },
          { x: action.targetX, z: action.targetZ },
          32,
          'clearance',
        );
        this.simState.carrierId = null;
        pushLastAction(ag.matchRuntime, 'clearance');
        break;
      }

      default:
        this.safeArrive(
          ag,
          slotTarget.x,
          clampWorldTargetToSlotFlankCorridor(ag.slotId, slotTarget.z, slotTarget.z),
          mode,
        );
        break;
    }
  }

  private isPassOnBallType(t: string): boolean {
    return (
      t === 'short_pass_safety'
      || t === 'lateral_pass'
      || t === 'vertical_pass'
      || t === 'switch_play'
      || t === 'long_ball'
      || t === 'one_two'
      || t === 'through_ball'
    );
  }

  private notePossessionEvents(events: CausalMatchEvent[]) {
    for (const ev of events) {
      if (ev.type === 'possession_change') {
        this.simState.possessionChangesTotal++;
        this.simState.possessionChangeMinutes.push(this.simState.minute);
        if (this.simState.possessionChangeMinutes.length > 48) this.simState.possessionChangeMinutes.shift();
        const to = (ev as { payload?: { to?: string } }).payload?.to as PossessionSide | undefined;
        if (to) {
          const other: PossessionSide = to === 'home' ? 'away' : 'home';
          this.passChainCount[other] = 0;
        }
      }
    }
  }

  /**
   * Saída de baliza: após um breve tick de encosto, escolhe passe (só com espaço real),
   * lançamento ou chutão — sempre com voo contínuo.
   */
  private executeGkRestartDistribution(
    gk: AgentEx,
    selfSnap: AgentSnapshot,
    teamSnaps: AgentSnapshot[],
    oppSnaps: AgentSnapshot[],
    attackDir: 1 | -1,
    L: ReturnType<typeof createCausalBatch>,
    _manager: TacticalManagerParams,
  ): void {
    const half = this.matchClock.state.half;
    const ctx = { team: gk.side, half };
    const tickK = Math.floor(this.world.simTime * 60);
    const baseSeed = this.simState.simulationSeed;
    const teammatesField = teamSnaps.filter((t) => t.id !== gk.id && t.role !== 'gk');
    const press01 = nearestOpponentPressure01(selfSnap, oppSnaps);
    const disorg01 = this.tacticalDisorgFacingCarrier(gk.side);
    const rng = rngFromSeed(baseSeed, `gk-out:${gk.id}:${tickK}`);

    const minOppDist = (wx: number, wz: number) => {
      let m = 999;
      for (const o of oppSnaps) {
        m = Math.min(m, Math.hypot(o.x - wx, o.z - wz));
      }
      return m;
    };

    const passOpts = findPassOptions(selfSnap, teammatesField, oppSnaps, attackDir);
    const openPass = passOpts
      .filter((p) => minOppDist(p.targetX, p.targetZ) >= 3.35 && p.successProb >= 0.56)
      .sort(
        (a, b) =>
          minOppDist(b.targetX, b.targetZ) - minOppDist(a.targetX, a.targetZ)
          || b.spaceAtTarget - a.spaceAtTarget,
      );

    let closestOppToGk = 999;
    for (const o of oppSnaps) {
      closestOppToGk = Math.min(closestOppToGk, Math.hypot(o.x - selfSnap.x, o.z - selfSnap.z));
    }

    const r = rng.nextUnit();
    const passSafeEnough =
      openPass.length > 0
      && closestOppToGk >= 4.1
      && press01 < 0.32;
    if (r < 0.36 && passSafeEnough) {
      const opt = openPass[0]!;
      const passRes = resolvePassForPossession(
        baseSeed,
        tickK,
        selfSnap,
        opt,
        press01,
        oppSnaps,
        disorg01,
        this.stepManagerParams?.homeStaffMatch ?? null,
      );
      const stats = getOrCreateStats(this.simState, gk.id);
      stats.passesAttempt++;
      if (passRes.completed) stats.passesOk++;

      if (passRes.interceptPlayerId) {
        const intr = this.findAgent(passRes.interceptPlayerId);
        if (intr) {
          const stealX = gk.vehicle.position.x;
          const stealZ = gk.vehicle.position.z;
          const contact = this.clampedPassInterceptContactPoint(
            selfSnap.x,
            selfSnap.z,
            passRes.x,
            passRes.z,
            intr.vehicle.position.x,
            intr.vehicle.position.z,
          );
          const speedGk = Math.max(14, Math.min(42, 17 + selfSnap.passeCurto * 0.11 + (selfSnap.fisico / 100) * 0.9));
          const flyDist = Math.hypot(contact.x - selfSnap.x, contact.z - selfSnap.z);
          const tFly = flyDist / Math.max(11, speedGk);
          this.pendingPassIntercept = {
            interceptorId: intr.id,
            passerId: gk.id,
            stealX,
            stealZ,
            possessionBefore: this.simState.possession,
            contactX: contact.x,
            contactZ: contact.z,
            deadlineSimTime: this.world.simTime + Math.min(4.2, Math.max(0.55, tFly + 0.45)),
            icKey: `${gk.id}:${intr.id}:${tickK}`,
            narrativeLine: `${this.simState.minute}' — Interceptação na saída do GR.`,
            causalReason: 'gk_restart_intercept',
          };
          this.scheduleGkReleaseChaseSuppressionFromFlight(selfSnap.x, selfSnap.z, contact.x, contact.z, speedGk);
          this.ballSys.startFlight(
            { x: selfSnap.x, z: selfSnap.z },
            { x: contact.x, z: contact.z },
            speedGk,
            'pass',
          );
          this.simState.carrierId = null;
        }
        return;
      }

      const str = selfSnap.fisico / 100;
      const speed = Math.max(14, Math.min(42, 17 + selfSnap.passeCurto * 0.11 + str * 0.9));
      if (passRes.completed) {
        this.scheduleGkReleaseChaseSuppressionFromFlight(selfSnap.x, selfSnap.z, passRes.x, passRes.z, speed);
        this.ballSys.startFlight(
          { x: selfSnap.x, z: selfSnap.z },
          { x: passRes.x, z: passRes.z },
          speed,
          'pass',
          opt.targetId,
        );
      } else {
        this.scheduleGkReleaseChaseSuppressionFromFlight(selfSnap.x, selfSnap.z, passRes.x, passRes.z, speed);
        this.ballSys.setLoose(passRes.x, passRes.z);
      }
      this.simState.carrierId = null;
      pushLastAction(gk.matchRuntime, 'gk_distribution_pass');
      pushSimEvent(this.simState, `${this.simState.minute}' — Saída do guarda-redes: passe ao colega livre.`);
      return;
    }

    /** Chutão realista: avanço moderado para zonas adequadas (build_up / press). */
    const isLong = r < 0.72;
    const forwardMet = isLong ? (20 + rng.nextUnit() * 22) : (12 + rng.nextUnit() * 14);
    let toX = selfSnap.x + attackDir * forwardMet;
    let toZ = FIELD_WIDTH / 2 + (rng.nextUnit() - 0.5) * 28;
    const out = clampWorldOutsideBothPenaltyAreas(toX, toZ);
    toX = out.x;
    toZ = out.z;
    if (isInsideOwnPenaltyArea({ x: toX, z: toZ }, ctx)) {
      const dg = getDefendingGoalX(gk.side, half);
      toX =
        dg < FIELD_LENGTH / 2
          ? PENALTY_AREA_DEPTH_M + 4
          : FIELD_LENGTH - PENALTY_AREA_DEPTH_M - 4;
      toZ = Math.min(FIELD_WIDTH - 4, Math.max(4, toZ));
    }
    toX = Math.min(FIELD_LENGTH - 4, Math.max(4, toX));
    toZ = Math.min(FIELD_WIDTH - 4, Math.max(4, toZ));

    const str = selfSnap.fisico / 100;
    const spd = isLong ? Math.min(44, 24 + str * 2.1 + rng.nextUnit() * 5) : Math.min(46, 30 + str * 2.4);
    this.scheduleGkReleaseChaseSuppressionFromFlight(selfSnap.x, selfSnap.z, toX, toZ, spd);
    this.ballSys.startFlight({ x: selfSnap.x, z: selfSnap.z }, { x: toX, z: toZ }, spd, 'clearance');
    this.simState.carrierId = null;
    pushLastAction(gk.matchRuntime, isLong ? 'gk_distribution_long' : 'gk_distribution_clear');
    pushSimEvent(
      this.simState,
      isLong
        ? `${this.simState.minute}' — Pontapé do GR ao meio-campo.`
        : `${this.simState.minute}' — Guarda-redes manda um chutão longo.`,
    );
  }

  private findGoalkeeper(side: PossessionSide): AgentEx | undefined {
    const team = side === 'home' ? this.homeAgents : this.awayAgents;
    if (team.length === 0) return undefined;
    const tagged = team.find((a) => a.slotId === 'gol' || a.role === 'gk');
    if (tagged) return tagged;
    const gx = getDefendingGoalX(side, this.matchClock.state.half);
    let best = team[0]!;
    let bestD = Infinity;
    for (const a of team) {
      const d = Math.abs(a.vehicle.position.x - gx);
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return best;
  }

  /**
   * Bola às mãos do GR durante `gkRestart` (fora, defesa, etc.): campo parado até passe/chuto.
   * Não depende só de `goal_kick_wide` — o mesmo bug ocorria após defesa com atacante a pressionar.
   */
  private isGkRestartBallInHandFreeze(): boolean {
    return (
      this.gkRestart !== null
      && this.ballSys.state.mode === 'held'
      && this.simState.carrierId === this.gkRestart.gkId
    );
  }

  private assignBallToDefendingGoalkeeper(
    defendingSide: PossessionSide,
    shooterSide: PossessionSide,
    L: ReturnType<typeof createCausalBatch>,
    reason: string,
  ) {
    const gk = this.findGoalkeeper(defendingSide);
    if (gk) {
      this.ballSys.giveTo(gk.id, gk.vehicle.position.x, gk.vehicle.position.z);
      this.simState.carrierId = gk.id;
      this.gkRestart = { gkId: gk.id, kickAt: this.world.simTime + GK_RESTART_KICK_DELAY_SEC };
      if (this.simState.possession !== defendingSide) {
        this.simState.possession = defendingSide;
        L.push({ type: 'possession_change', payload: { to: defendingSide, reason } });
      }
      {
        const gkKey = `${defendingSide}|${shooterSide}|${reason}|${Math.floor(this.world.simTime * 1000)}`;
        const gkLine = this.isTest2dLiveFeed()
          ? test2dGkBallFromShotLine(
              this.simState.minute,
              shooterSide === defendingSide,
              reason,
              gkKey,
            )
          : `${this.simState.minute}' — ${shooterSide === defendingSide ? 'Defesa' : 'Remate'}: bola com GR (${reason}).`;
        pushSimEvent(this.simState, gkLine);
      }
    } else {
      const gx = defendingSide === 'home' ? 6 : FIELD_LENGTH - 6;
      this.ballSys.setLoose(gx, FIELD_WIDTH / 2);
      this.simState.carrierId = null;
      if (this.simState.possession !== defendingSide) {
        this.simState.possession = defendingSide;
        L.push({ type: 'possession_change', payload: { to: defendingSide, reason: `${reason}_loose` } });
      }
    }
  }

  private applyTurnoverPlay(
    carrier: AgentEx,
    exCarrierId: string | null,
    stealX: number,
    stealZ: number,
    reason: 'tackle' | 'loose_ball_recovery' | 'intercept' | 'dribble_fail',
    L: ReturnType<typeof createCausalBatch>,
    manager: TacticalManagerParams,
    slotTargetFor: (a: AgentEx) => { x: number; z: number },
  ) {
    if (this.simState.carrierId !== carrier.id) return;
    if (this.ballSys.state.mode !== 'held') return;
    if (this.applyTurnoverDepth > 2) return;

    if (exCarrierId) {
      this.turnoverPassBlock.set(carrier.id, {
        peerId: exCarrierId,
        until: this.world.simTime + POSSESSION_LOCK_SEC,
      });
    }

    const attackDir = getSideAttackDir(carrier.side, this.matchClock.state.half);
    // Record possession loss zone for tactical adaptation
    const lossZone = carrier.vehicle.position.x < FIELD_LENGTH * 0.33 ? 'def_third'
      : carrier.vehicle.position.x < FIELD_LENGTH * 0.67 ? 'center'
      : carrier.vehicle.position.z < FIELD_WIDTH * 0.33 ? 'right_flank'
      : carrier.vehicle.position.z > FIELD_WIDTH * 0.67 ? 'left_flank'
      : 'center';
    const adaptation = carrier.side === 'home' ? this.homeAdaptation : this.awayAdaptation;
    recordPossessionLoss(adaptation, lossZone, this.world.simTime);
    const teamSnaps =
      carrier.side === 'home'
        ? this.homeAgents.map((a) => this.toAgentSnapshot(a))
        : this.awayAgents.map((a) => this.toAgentSnapshot(a));
    const oppSnaps =
      carrier.side === 'home'
        ? this.awayAgents.map((a) => this.toAgentSnapshot(a))
        : this.homeAgents.map((a) => this.toAgentSnapshot(a));
    const selfSnap = this.toAgentSnapshot(carrier);
    const teammates = teamSnaps.filter((t) => t.id !== carrier.id);

    const seed = hashTurnoverSeed([
      carrier.id,
      String(Math.floor(this.world.simTime * 1000)),
      exCarrierId ?? '_',
      reason,
    ]);
    const rng = createSeededRng(seed);

    const action = pickPlayAfterTurnover(selfSnap, teammates, oppSnaps, {
      rng,
      mentality: manager.tacticalMentality,
      risk: carrier.profile.riskAppetite,
      exCarrierId,
      attackDir,
      stealX,
      stealZ,
      reason,
      livelyTurnoverFeed: this.isTest2dLiveFeed(),
    });

    {
      const trans = transitionOutcomeFromSteal(selfSnap, stealX, attackDir, reason, rng());
      if (trans.recovery_profile === 'recovery_critical_chance') {
        pushSimEvent(
          this.simState,
          `${this.simState.minute}' — Recuperação em zona de perigo — contra-ataque armado.`,
        );
      } else if (trans.loss_profile === 'loss_critical_exposed') {
        pushSimEvent(
          this.simState,
          `${this.simState.minute}' — Perda de posse com bloco defensivo exposto.`,
        );
      }
    }

    const slotTarget = slotTargetFor(carrier);
    this.applyTurnoverDepth++;
    try {
      this.executeOnBallAction(carrier, action, selfSnap, oppSnaps, attackDir, slotTarget, 'in_play', L);
    } finally {
      this.applyTurnoverDepth--;
    }
    carrier.decision.syncAfterTurnoverImmediateAction(action, this.world.simTime);

    const tag: Test2dTurnoverTag =
      reason === 'tackle' ? 'desarme'
      : reason === 'intercept' ? 'interceptação'
      : reason === 'dribble_fail' ? 'perda'
      : 'recuperação';
    const narrKey = `${seed}|${carrier.id}|${action.type}`;
    if (this.isPassOnBallType(action.type)) {
      const line = this.isTest2dLiveFeed()
        ? test2dPassAfterTurnoverLine(this.simState.minute, tag, narrKey)
        : `${this.simState.minute}' — Passe após ${tag}.`;
      pushSimEvent(this.simState, line);
    } else if (
      action.type === 'simple_carry'
      || action.type === 'aggressive_carry'
      || action.type === 'progressive_dribble'
    ) {
      const line = this.isTest2dLiveFeed()
        ? test2dCarryAfterTurnoverLine(this.simState.minute, tag, narrKey)
        : `${this.simState.minute}' — Condução após ${tag}.`;
      pushSimEvent(this.simState, line);
    }
  }

  /**
   * Mistura o alvo da decisão off-ball com a âncora dinâmica do slot (forma viva),
   * para evitar colapso na bola e manter bloco tático.
   */
  private blendOffBallArriveTarget(
    ag: AgentEx,
    desired: { x: number; z: number },
    anchor: { x: number; z: number },
    actionType: OffBallAction['type'],
    mode: AgentMode,
  ): { x: number; z: number } {
    if (actionType === 'idle') return anchor;
    if (mode === 'reforming') return anchor;
    const ball = { x: this.ballSys.state.x, z: this.ballSys.state.z };
    const carrier = this.simState.carrierId ? this.findAgent(this.simState.carrierId) : undefined;
    const teamHasBall = carrier?.side === ag.side;
    const half = this.matchClock.state.half;
    const scheme: FormationSchemeId = ag.side === 'home'
      ? (this.liveRef?.homeFormationScheme ?? '4-3-3') as FormationSchemeId
      : (this.liveRef?.awayFormationScheme ?? '4-3-3') as FormationSchemeId;
    const zoneModel = buildSlotZoneProfile(ag.slotId, ag.role, scheme, ag.side, half);
    const engagement = resolveZoneEngagement(ball.x, ball.z, zoneModel, { team: ag.side, half });
    let radii = tacticalRadiiFor(ag.role, ag.slotId);
    radii = scaleRadiiForTeamPossession(radii, teamHasBall);
    radii = scaleRadiiForZoneEngagement(radii, engagement, zoneModel.behaviorProfile);
    const overlapDepth = Math.abs(ag.vehicle.position.x - anchor.x);
    radii = scaleRadiiForOverlapReturn(radii, overlapDepth, teamHasBall);
    const isPress = actionType === 'press_carrier';
    const anchorPullScale = anchorPullScaleForOffBallAction(actionType, teamHasBall, isPress);
    const blended = blendOffBallDestination(
      desired,
      anchor,
      { x: ag.vehicle.position.x, z: ag.vehicle.position.z },
      ball,
      radii,
      { isPressingCarrier: isPress, anchorPullScale },
    );
    const mates = new Map<string, { x: number; z: number }>();
    const teamList = ag.side === 'home' ? this.homeAgents : this.awayAgents;
    for (const m of teamList) {
      mates.set(m.slotId, { x: m.vehicle.position.x, z: m.vehicle.position.z });
    }
    const coll = ag.side === 'home' ? this.homeCollective : this.awayCollective;
    const pair = computeSlotPairWorldDelta({
      slotId: ag.slotId ?? 'mc1',
      side: ag.side,
      selfX: ag.vehicle.position.x,
      selfZ: ag.vehicle.position.z,
      ballX: ball.x,
      ballZ: ball.z,
      teammatesBySlot: mates,
      teamHasBall,
      half,
      scheme,
      collectivePhase: coll?.phase,
    });
    const shifted = { x: blended.x + pair.dx, z: blended.z + pair.dz };

    // Line-breaking actions: player intentionally leaves their operative zone.
    // Skip the 18-zone clamp so overlap runs and box infiltrations actually reach their target.
    const LINE_BREAK_ACTIONS = new Set<OffBallAction['type']>(['overlap_run', 'infiltrate', 'attack_depth']);
    if (LINE_BREAK_ACTIONS.has(actionType)) {
      return clampToPitch(shifted.x, shifted.z, 1);
    }

    const clamped = clampWorldToOperativeTactical18(
      shifted.x,
      shifted.z,
      ag.slotId ?? 'mc1',
      ag.role,
      scheme,
      ag.side,
      half,
      0.52,
    );
    if (this.simState.phase === 'live' && (ag.slotId === 'gol' || ag.role === 'gk')) {
      return {
        x: clampGoalkeeperTargetX(ag.side, half, clamped.x),
        z: clampGoalkeeperTargetZ(this.ballSys.state.z, clamped.z),
      };
    }
    return clamped;
  }

  private executeOffBallAction(
    ag: AgentEx,
    action: OffBallAction,
    slotTarget: { x: number; z: number },
    mode: AgentMode,
  ) {
    const arriveBlended = (x: number, z: number, arriveMode: AgentMode) => {
      const b = this.blendOffBallArriveTarget(ag, { x, z }, slotTarget, action.type, arriveMode);
      const zc = clampWorldTargetToSlotFlankCorridor(ag.slotId, b.z, slotTarget.z);
      this.safeArrive(ag, b.x, zc, arriveMode);
    };

    switch (action.type) {
      case 'press_carrier':
        arriveBlended(action.targetX, action.targetZ, 'pressing');
        if (this.isTest2dLiveFeed()) {
          const vk = `${ag.id}:press:${Math.floor(this.world.simTime * 10)}`;
          this.pushLive2dLearningLine(test2dHighPressLine(this.simState.minute, vk), 'info', {
            playerId: ag.id,
            minGapSec: 8,
          });
        }
        break;
      case 'delay_press':
      case 'close_passing_lane':
      case 'cover_central':
      case 'recover_behind_ball':
      case 'defensive_cover':
      case 'mark_zone':
      case 'mark_man':
        arriveBlended(action.targetX, action.targetZ, 'in_play');
        break;
      case 'offer_short_line':
      case 'offer_diagonal_line':
      case 'open_width':
      case 'attack_depth':
      case 'infiltrate':
      case 'overlap_run':
      case 'drop_to_create_space':
      case 'drag_marker':
      case 'anticipate_second_ball':
      case 'prepare_rebound':
        arriveBlended(action.targetX, action.targetZ, 'in_play');
        // PR2 — Cross telegraphing: lateral em terço final disparando overlap_run
        // sinaliza atacantes para antecipar a chegada na área (~0.3s antes da bola).
        if (action.type === 'overlap_run' && (ag.slotId === 'le' || ag.slotId === 'ld')) {
          this.broadcastCrossIncoming(ag);
        }
        break;
      case 'move_to_slot':
        arriveBlended(action.targetX, action.targetZ, mode);
        break;
      case 'idle':
      default:
        this.safeArrive(
          ag,
          slotTarget.x,
          clampWorldTargetToSlotFlankCorridor(ag.slotId, slotTarget.z, slotTarget.z),
          mode,
        );
        break;
    }
  }

  /**
   * PR2 — Lateral telegrafa cruzamento para atacantes do mesmo time.
   * Só dispara se o lateral já está no terço ofensivo (proximidade > 0.66).
   * Calcula ponto esperado de entrega (entre 1º pau e ponto-de-pênalti, lado oposto)
   * e seta hint para atacantes (role==='attack' OU slot 'ata'/'pe'/'pd') por 1.2s.
   * Atacantes leem o hint via DecisionContext.incomingCross e antecipam a chegada.
   */
  private broadcastCrossIncoming(sender: AgentEx): void {
    const half = this.matchClock.state.half;
    const attackDir = getSideAttackDir(sender.side, half);
    const senderProximity = attackProximity01(sender.vehicle.position.x, attackDir);
    if (senderProximity < 0.66) return;

    // Ponto esperado de entrega: ~6m antes da linha de fundo, lado oposto ao do lateral.
    const goalX = attackDir === 1 ? FIELD_LENGTH : 0;
    const expectedX = goalX - attackDir * 6;
    const senderIsLeftSide = sender.vehicle.position.z < FIELD_WIDTH / 2;
    // 2º pau = lado oposto ao do cruzador. Lateral esquerda → entrega na direita do gol.
    const expectedZ = senderIsLeftSide ? FIELD_WIDTH * 0.62 : FIELD_WIDTH * 0.38;

    const teamAgents = sender.side === 'home' ? this.homeAgents : this.awayAgents;
    const until = this.world.simTime + 1.2;
    const receiverIds: string[] = [];
    for (const mate of teamAgents) {
      if (mate.id === sender.id) continue;
      const isAttacker =
        mate.role === 'attack'
        || mate.slotId === 'ata'
        || mate.slotId === 'pe'
        || mate.slotId === 'pd';
      if (!isAttacker) continue;
      this.crossIncomingHint.set(mate.id, {
        senderId: sender.id,
        expectedX,
        expectedZ,
        until,
      });
      receiverIds.push(mate.id);
    }

    // PR3 — Telemetria observacional (DEV only).
    recordCrossTelegraphed({
      senderId: sender.id,
      senderSlot: sender.slotId,
      senderSide: sender.side as 'home' | 'away',
      minute: this.simState.minute,
      expectedX,
      expectedZ,
      receiverIds,
    });
  }

  /**
   * Falta + cartão opcional no loop contínuo. Feed via `pushSimEvent`; causal para histórico/replay.
   */
  public setOnPenaltyAwarded(cb: typeof this.onPenaltyAwardedCallback): void {
    this.onPenaltyAwardedCallback = cb;
  }

  /** Q6 — Subscribe a corner award (abre SetPieceModal interativo). */
  public setOnCornerAwarded(cb: typeof this.onCornerAwardedCallback): void {
    this.onCornerAwardedCallback = cb;
  }

  private appendLiveDisciplineAfterFoul(
    L: ReturnType<typeof createCausalBatch>,
    foulRng: RngDraw,
    fouler: AgentEx,
    victimId: string,
    foulKind: string,
    foulSeverity: 'light' | 'firm' | 'ugly',
    victim?: AgentEx,
  ) {
    const m = this.simState.minute;
    const dangerous = foulSeverity !== 'light';

    // Penalty check — falta dentro da grande área DEFENDIDA pelo fouler (= área atacada
    // pela vítima). Só firm/ugly vira pênalti; leve fica na marca comum.
    if (victim && dangerous && this.onPenaltyAwardedCallback) {
      const half = this.matchClock.state.half;
      const inBox = isInsideOwnPenaltyArea(
        { x: victim.vehicle.position.x, z: victim.vehicle.position.z },
        { team: fouler.side, half },
      );
      if (inBox) {
        const attackingSide: PossessionSide = fouler.side === 'home' ? 'away' : 'home';
        pushSimEvent(this.simState, `${m}' — PÊNALTI! Falta dentro da área — marca-se a cal.`, 'whistle');
        // takerName resolvido pelo caller (tem acesso ao playersById).
        this.onPenaltyAwardedCallback({
          attackingSide,
          foulerId: fouler.id,
          foulerSide: fouler.side,
          victimId,
          takerName: 'Cobrador',
          takerId: victim.id,
          minute: m,
        });
      }
    }
    L.push({
      type: 'foul_committed',
      payload: {
        minute: m,
        foulerId: fouler.id,
        foulerSide: fouler.side,
        victimId,
        kind: foulKind,
        dangerous,
        severity: foulSeverity,
      },
    });
    const line =
      foulSeverity === 'ugly'
        ? `${m}' — Entrada feia! O árbitro corta o lance com autoridade.`
        : foulSeverity === 'firm'
          ? `${m}' — Falta seca — impacto visível; jogo parado.`
          : `${m}' — Falta leve de marcação — respira o jogo.`;
    pushSimEvent(this.simState, line);

    // Foul argument: nearby agents move toward the foul point
    try {
      const foulX = fouler.vehicle.position.x;
      const foulZ = fouler.vehicle.position.z;
      const allAgents = [...this.homeAgents, ...this.awayAgents].map((a) => ({
        id: a.id, x: a.vehicle.position.x, z: a.vehicle.position.z, side: a.side, role: a.role,
      }));
      const argPositions = computeFoulArgumentPositions(foulX, foulZ, allAgents);
      for (const p of argPositions) {
        const argAg = this.findAgent(p.agentId);
        if (argAg) this.safeArrive(argAg, p.targetX, p.targetZ, 'in_play');
      }
    } catch (e) {
      // non-blocking
    }

    const redP =
      foulSeverity === 'ugly'
        ? FOUL_CARD_RED_P_UGLY
        : foulSeverity === 'firm'
          ? FOUL_CARD_RED_P_FIRM
          : FOUL_CARD_RED_P_LIGHT;
    const yellowP =
      foulSeverity === 'ugly'
        ? FOUL_CARD_YELLOW_P_UGLY
        : foulSeverity === 'firm'
          ? FOUL_CARD_YELLOW_P_FIRM
          : FOUL_CARD_YELLOW_P_LIGHT;

    const uCard = foulRng.nextUnit();
    const anyCard = redP + yellowP;
    if (uCard < redP) {
      L.push({
        type: 'card_shown',
        payload: {
          minute: m,
          playerId: fouler.id,
          side: fouler.side,
          card: 'red',
          reason: foulKind,
        },
      });
      const k = fouler.side === 'home' ? 'red_home' : 'red_away';
      pushSimEvent(this.simState, `${m}' — Cartão vermelho — expulsão.`, k);
    } else if (uCard < anyCard) {
      L.push({
        type: 'card_shown',
        payload: {
          minute: m,
          playerId: fouler.id,
          side: fouler.side,
          card: 'yellow',
          reason: foulKind,
        },
      });
      const k = fouler.side === 'home' ? 'yellow_home' : 'yellow_away';
      pushSimEvent(this.simState, `${m}' — Amarelo — advertência ao jogador.`, k);
    }

    // ─── Pausa de 3s + transferência de posse pro time que sofreu ───
    // Árbitro interrompe o jogo; bola é colocada pra quem tomou a falta.
    const victimSide: PossessionSide = fouler.side === 'home' ? 'away' : 'home';
    const victimTeam = victimSide === 'home' ? this.homeAgents : this.awayAgents;
    // Companheiro da vítima mais próximo da bola cobra.
    const ballX = this.ballSys.state.x;
    const ballZ = this.ballSys.state.z;
    let taker: AgentEx | null = null;
    let bestD = Infinity;
    for (const ag of victimTeam) {
      if (ag.role === 'gk') continue;
      const d = Math.hypot(ag.vehicle.position.x - ballX, ag.vehicle.position.z - ballZ);
      if (d < bestD) {
        bestD = d;
        taker = ag;
      }
    }
    if (taker) {
      this.ballSys.setDeadAt(ballX, ballZ);
      this.simState.possession = victimSide;
      this.simState.carrierId = taker.id;
      // Q3 — marca cobrador para OnBallDecision avaliar chute direto.
      this.pendingFreeKickTakerId = taker.id;
      // 3 segundos de dead ball — árbitro pausa, narração flutua.
      this.deadBallUntil = this.world.simTime + 3;
      pushSimEvent(this.simState, `${m}' — Falta ${foulSeverity === 'ugly' ? 'dura' : foulSeverity === 'firm' ? 'cometida' : 'leve'} — jogo parado 3s. Reinício ${victimSide === 'home' ? (this.liveRef?.homeShort ?? 'Casa') : (this.liveRef?.awayShort ?? 'Fora')}.`, 'whistle');
      const uiPos = worldToUiPercent(ballX, ballZ);
      L.push({ type: 'ball_state', payload: { x: uiPos.ux, y: uiPos.uy, reason: 'foul_restart' } });
      L.push({ type: 'possession_change', payload: { to: victimSide, reason: 'foul_awarded' } });
    }
  }

  private shotPlanFromResolution(sr: ShotPossessionResult): ShotPlanKind {
    if (sr.outcome === 'goal') return 'goal';
    if (sr.outcome === 'miss') return 'miss_wide';
    if (sr.outcome === 'block') return 'block_rebound';
    return sr.saveKind === 'hold' ? 'hold' : 'parry';
  }

  private computeShotReboundTarget(
    contactX: number,
    contactZ: number,
    attackDir: 1 | -1,
    strike: ShotStrikeProfile,
    salt: string,
  ): { toX: number; toZ: number; speed: number } {
    const r = rngFromSeed(
      this.simState.simulationSeed,
      `shot-rbd:${salt}:${Math.floor(this.world.simTime * 1000)}`,
    );
    const away = attackDir === 1 ? -1 : 1;
    const lateral = (r.nextUnit() - 0.5) * 20;
    const back = 7 + r.nextUnit() * 11;
    let toX = contactX + away * back;
    let toZ = contactZ + lateral;
    const c = clampToPitch(toX, toZ, 0.55);
    toX = c.x;
    toZ = c.z;
    const sp = strike === 'power' ? 26 : strike === 'weak' ? 16 : 21;
    return { toX, toZ, speed: Math.min(44, sp + r.nextUnit() * 9) };
  }

  private computeShotPrimaryFlight(
    selfSnap: AgentSnapshot,
    attackDir: 1 | -1,
    shotRes: ShotPossessionResult,
    plan: ShotPlanKind,
    shooterId: string,
    defSide: PossessionSide,
  ): {
    from: { x: number; z: number };
    to: { x: number; z: number };
    speed: number;
    rebound?: { toX: number; toZ: number; speed: number };
  } {
    const strike = shotRes.strikeProfile;
    const gx = shotRes.goalX;
    const gz = shotRes.goalZ;
    const margin = 1.15;
    const goalMouthX = attackDir === 1 ? FIELD_LENGTH - margin : margin;
    const zc = FIELD_WIDTH / 2;
    const zLo = zc - GOAL_MOUTH_HALF_WIDTH_M + 0.05;
    const zHi = zc + GOAL_MOUTH_HALF_WIDTH_M - 0.05;
    const goalMouthZ = Math.min(FIELD_WIDTH - margin, Math.max(margin, Math.min(zHi, Math.max(zLo, gz))));
    const dist = Math.hypot(gx - selfSnap.x, gz - selfSnap.z);
    let speed =
      strike === 'power' ? 36 + dist * 0.07 : strike === 'weak' ? 20 + dist * 0.05 : 28 + dist * 0.06;
    speed = Math.max(17, Math.min(52, speed));
    const from = { x: selfSnap.x, z: selfSnap.z };

    if (plan === 'goal') {
      return { from, to: { x: goalMouthX, z: goalMouthZ }, speed };
    }
    if (plan === 'miss_wide') {
      const r = rngFromSeed(
        this.simState.simulationSeed,
        `shot-misswidez:${shooterId}:${Math.floor(this.world.simTime * 1000)}`,
      );
      const zc = FIELD_WIDTH / 2;
      const pastPost = 0.35 + r.nextUnit() * 1.15;
      const side = r.nextUnit() < 0.5 ? -1 : 1;
      const wideZ = Math.min(
        FIELD_WIDTH - margin,
        Math.max(margin, zc + side * (GOAL_MOUTH_HALF_WIDTH_M + pastPost)),
      );
      return {
        from,
        to: { x: goalMouthX, z: wideZ },
        speed: Math.min(52, speed * 1.05),
      };
    }
    if (plan === 'block_rebound') {
      const bc = shotRes.blockContact ?? {
        x: (selfSnap.x + gx) * 0.62,
        z: (selfSnap.z + gz) * 0.62,
        deflectorId: null as string | null,
      };
      const rebound = this.computeShotReboundTarget(bc.x, bc.z, attackDir, strike, `blk:${shooterId}`);
      return { from, to: { x: bc.x, z: bc.z }, speed, rebound };
    }

    const gkAg = this.findGoalkeeper(defSide);
    const gkx = gkAg?.vehicle.position.x ?? (attackDir === 1 ? FIELD_LENGTH - 5.5 : 5.5);
    const gkz = gkAg?.vehicle.position.z ?? FIELD_WIDTH / 2;

    if (plan === 'hold') {
      return {
        from,
        to: { x: gkx, z: gkz },
        speed: Math.min(48, speed * 0.9),
      };
    }

    const tMeet = 0.8;
    const px = selfSnap.x + (gx - selfSnap.x) * tMeet;
    const pz = selfSnap.z + (gz - selfSnap.z) * tMeet;
    const qx = px * 0.58 + gkx * 0.42;
    const qz = pz * 0.55 + gkz * 0.45;
    const rebound = this.computeShotReboundTarget(qx, qz, attackDir, strike, `pry:${shooterId}`);
    return { from, to: { x: qx, z: qz }, speed, rebound };
  }

  /** Causal + placar + posse após a bola chegar ao ponto do desfecho (ou ao contacto antes do rebote). */
  private emitShotSequenceOutcome(L: ReturnType<typeof createCausalBatch>, pend: ShotPendingResolution) {
    const ag = this.findAgent(pend.shooterId);
    const shotOutcome = pend.shotRes.outcome;
    const strike = pend.shotRes.strikeProfile;
    const causalOutcome = pend.causalOutcome;

    L.push({
      type: 'shot_result',
      payload: {
        side: pend.shooterSide,
        shooterId: pend.shooterId,
        outcome: causalOutcome,
        strike,
        saveKind: shotOutcome === 'save' ? pend.shotRes.saveKind : undefined,
        gkHighlight: pend.shotRes.gkHighlight,
      },
    });

    // Stats agregados do finalizador (chute no alvo vs fora).
    {
      const shooterStats = getOrCreateStats(this.simState, pend.shooterId);
      const outStr = String(causalOutcome);
      const onTarget =
        outStr === 'goal' ||
        outStr === 'save' ||
        outStr === 'post_in' ||
        outStr === 'block';
      shooterStats.shots += 1;
      if (onTarget) shooterStats.shotsOn += 1;
      else shooterStats.shotsOff += 1;

      // Defesa: GK adversário é quem defende. Bump em `saves` no goleiro do lado oposto.
      if (outStr === 'save' || outStr === 'block') {
        const defSide = pend.shooterSide === 'home' ? 'away' : 'home';
        const gkTeam = defSide === 'home' ? this.homeAgents : this.awayAgents;
        const gk = gkTeam.find((a) => a.role === 'gk');
        if (gk) {
          const gkStats = getOrCreateStats(this.simState, gk.id);
          gkStats.saves += 1;
        }
      }
    }

    if (
      pend.shotRes.executionTier === 'critical_hit'
      && (shotOutcome === 'save' || shotOutcome === 'block')
      && pend.shotRes.gkHighlight !== 'spectacular_save'
    ) {
      pushSimEvent(
        this.simState,
        `${this.simState.minute}' — Remate de elite — defesa/queda física em grande plano.`,
      );
    }

    if (shotOutcome === 'goal') {
      const scoringSide = pend.shooterSide;
      const otherSide: PossessionSide = scoringSide === 'home' ? 'away' : 'home';
      // Activate momentum buff for the scoring team
      activateMomentumBuff(scoringSide === 'home' ? this.homeMomentumBuff : this.awayMomentumBuff, this.world.simTime);
      // Goal celebration reaction signals
      try {
        const scorerId = pend.shooterId;
        const scoringAgents = (scoringSide === 'home' ? this.homeAgents : this.awayAgents)
          .filter((a) => a.id !== scorerId)
          .map((a) => ({ id: a.id, x: a.vehicle.position.x, z: a.vehicle.position.z }));
        triggerGoalCelebration(scorerId, scoringAgents, this.world.simTime);
      } catch (e) {
        // non-blocking
      }
      if (ag) {
        this.bumpRuntimeConfidence(ag, CONFIDENCE_DELTA_GOOD * 0.95);
        pushLastAction(ag.matchRuntime, 'goal');
      }
      if (scoringSide === 'away') {
        const b = this.stepManagerParams?.homeStaffMatch?.coachConfAfterConcedeBonus01 ?? 0;
        if (b > 0) {
          for (const h of this.homeAgents) {
            this.bumpRuntimeConfidence(h, b);
          }
        }
      }
      L.push({ type: 'phase_change', payload: { from: 'LIVE', to: 'GOAL_RESTART', reason: 'goal' } });
      const net = worldToUiPercent(this.ballSys.state.x, this.ballSys.state.z);
      L.push({ type: 'ball_state', payload: { x: net.ux, y: net.uy, reason: 'post_goal_net' } });
      L.push({ type: 'possession_change', payload: { to: otherSide, reason: 'kickoff' } });
      const name = ag && this.shirtNumbers.get(ag.id) ? `#${this.shirtNumbers.get(ag.id)}` : pend.shooterId;
      const gh = pend.shotRes.gkHighlight;
      const goalLine =
        gh === 'gk_blunder_goal'
          ? `${this.simState.minute}' — GOL! Frango do guarda-redes — ${name} aproveita!`
          : gh === 'world_class_goal'
            ? `${this.simState.minute}' — GOLAÇO! ${name} com remate irrepreensível!`
            : `${this.simState.minute}' — GOL! ${name} marca!`;
      pushSimEvent(
        this.simState,
        goalLine,
        scoringSide === 'home' ? 'goal_home' : 'goal_away',
      );
      this.simState.possession = otherSide;
      this.ballSys.setDeadAt(this.ballSys.state.x, this.ballSys.state.z);
      this.simState.carrierId = null;
      this.fsm.enterGoalRestart();
      this.structuralSys.beginGoalRestart(otherSide);
      this.snapAgentsToKickoffPositions();
      return;
    }

    if (shotOutcome === 'miss') {
      if (ag) {
        pushLastAction(ag.matchRuntime, `shot_${shotOutcome}`);
        this.bumpRuntimeConfidence(ag, -CONFIDENCE_DELTA_BAD * 0.18);
        // Missed goal reaction: teammates show frustration
        try {
          const shooterSide = pend.shooterSide;
          const teammates = (shooterSide === 'home' ? this.homeAgents : this.awayAgents)
            .filter((a) => a.id !== ag!.id)
            .map((a) => ({ id: a.id, x: a.vehicle.position.x, z: a.vehicle.position.z }));
          triggerMissedGoalReaction(ag.id, teammates, this.ballSys.state.x, this.ballSys.state.z, this.world.simTime);
        } catch (e) {
          // non-blocking
        }
      }
      this.assignBallToDefendingGoalkeeper(pend.defSide, pend.shooterSide, L, `shot_${shotOutcome}`);
      this.skipKickoffBallAssign = true;
      this.structuralSys.beginGoalRestart(pend.defSide, 'goal_kick_wide');
      this.snapAgentsToKickoffPositions();
      this.fsm.enterGoalRestart();
      L.push({
        type: 'phase_change',
        payload: { from: 'LIVE', to: 'GOAL_RESTART', reason: 'shot_wide_reposition' },
      });
      pushSimEvent(
        this.simState,
        `${this.simState.minute}' — Bola para fora. Equipas na saída de bola; o GR coloca em jogo.`,
      );
      const strikeKind = strike === 'power' ? 'power' : strike === 'weak' ? 'weak' : 'placed';
      const missKey = `${pend.shooterId}|${strike}|${Math.floor(this.world.simTime * 1000)}`;
      const missLine = this.isTest2dLiveFeed()
        ? test2dShotMissDetailLine(this.simState.minute, strikeKind, missKey)
        : `${this.simState.minute}' — ${
            strike === 'power'
              ? 'Remate forte para fora.'
              : strike === 'weak'
                ? 'Remate fraco — longe da baliza.'
                : 'Remate ao lado.'
          }`;
      pushSimEvent(
        this.simState,
        missLine,
        'narrative',
        this.isTest2dLiveFeed() ? 'bad' : undefined,
        this.isTest2dLiveFeed() ? pend.shooterId : undefined,
      );
      return;
    }

    if (shotOutcome === 'block') {
      if (ag) {
        pushLastAction(ag.matchRuntime, `shot_${shotOutcome}`);
        this.bumpRuntimeConfidence(ag, CONFIDENCE_DELTA_GOOD * 0.08);
      }
      pushSimEvent(
        this.simState,
        `${this.simState.minute}' — Remate bloqueado — segunda bola viva.`,
        'narrative',
        this.isTest2dLiveFeed() ? 'info' : undefined,
        this.isTest2dLiveFeed() ? pend.shooterId : undefined,
      );
      return;
    }

    if (ag) {
      pushLastAction(ag.matchRuntime, `shot_${shotOutcome}`);
      this.bumpRuntimeConfidence(ag, CONFIDENCE_DELTA_GOOD * 0.08);
    }
    const sk = pend.shotRes.saveKind ?? 'parry';
    const spec = pend.shotRes.gkHighlight === 'spectacular_save';
    if (sk === 'hold') {
      this.assignBallToDefendingGoalkeeper(pend.defSide, pend.shooterSide, L, 'shot_save_hold');
      const saveLine = spec
        ? 'Defesa em grande plano — reflexo e segurança total.'
        : strike === 'power'
          ? 'Guarda-redes segura remate forte.'
          : strike === 'weak'
            ? 'Guarda-redes segura remate fraco.'
            : 'Guarda-redes agarra o remate colocado.';
      pushSimEvent(
        this.simState,
        `${this.simState.minute}' — ${saveLine}`,
        'narrative',
        this.isTest2dLiveFeed() ? 'good' : undefined,
        undefined,
      );
      return;
    }

    // PARRY real: GR espalma a bola em vez de segurar. Duas sub-resoluções:
    //  (30% spec / 40% normal) → canto: lança a bola pra linha de fundo lateral
    //                                    → BallSystem dispara out-of-bounds → escanteio
    //  restante                → rebote: bola fica viva na área pra segunda jogada
    const gkTeam = pend.defSide === 'home' ? this.homeAgents : this.awayAgents;
    const gk = gkTeam.find((a) => a.role === 'gk');
    const pCorner = spec ? 0.3 : 0.4;
    const doCorner = gk && Math.random() < pCorner;
    if (doCorner && gk) {
      // Direção do gol defendido (linha de fundo).
      const goalLineX =
        pend.defSide === 'home' ? 0 : FIELD_LENGTH;
      // Lado do deflete: escolhe o lado mais próximo da posição atual da bola.
      const ballZ = this.ballSys.state.z;
      const cornerZ = ballZ < FIELD_WIDTH / 2 ? 0.5 : FIELD_WIDTH - 0.5;
      const fromX = gk.vehicle.position.x;
      const fromZ = gk.vehicle.position.z;
      this.ballSys.startFlight(
        { x: fromX, z: fromZ },
        { x: goalLineX, z: cornerZ },
        14,
        'clearance',
        gk.id,
      );
      this.ballSys.registerLastTouch(gk.id);
      pushSimEvent(
        this.simState,
        spec
          ? `${this.simState.minute}' — Defesa espetacular! Espalma para escanteio — linha salva.`
          : `${this.simState.minute}' — Guarda-redes espalma para escanteio — bola viva pela ponta.`,
        'narrative',
        this.isTest2dLiveFeed() ? 'good' : undefined,
        undefined,
      );
      return;
    }

    // Rebote: não segura; solta a bola próximo à posição atual, viva na área.
    this.ballSys.state.mode = 'loose';
    // leve velocidade residual pra bola escapar da linha
    const reboundSign = pend.defSide === 'home' ? 1 : -1;
    this.ballSys.state.vx = reboundSign * 3;
    this.ballSys.state.vz = (Math.random() - 0.5) * 4;
    this.simState.carrierId = null;
    pushSimEvent(
      this.simState,
      spec
        ? `${this.simState.minute}' — Defesaça — bola rebate e fica viva na área!`
        : `${this.simState.minute}' — Espalma pra frente! Bola viva — disputa de rebote.`,
      'narrative',
      this.isTest2dLiveFeed() ? 'good' : undefined,
      undefined,
    );
  }

  private resolveTackles(
    defenders: AgentEx[],
    carrierSnaps: AgentSnapshot[],
    L: ReturnType<typeof createCausalBatch>,
    manager: TacticalManagerParams,
    slotTargetFor: (a: AgentEx) => { x: number; z: number },
  ) {
    if (!this.simState.carrierId) return;
    const carrier = this.findAgent(this.simState.carrierId);
    if (!carrier) return;
    if (defenders[0]?.side === carrier.side) return;

    // Bola nas mãos do GR na saída: não há desarme “na pequena área” até soltar.
    if (
      this.gkRestart
      && this.ballSys.state.mode === 'held'
      && carrier.id === this.gkRestart.gkId
      && (carrier.role === 'gk' || carrier.slotId === 'gol')
    ) {
      return;
    }

    const carrierSnap = this.toAgentSnapshot(carrier);
    const stealX = carrier.vehicle.position.x;
    const stealZ = carrier.vehicle.position.z;

    // Sprint L4 — pressing context modula raio de tackle.
    //   intensidade alta + zona alta = defensores fecham mais cedo (raio maior)
    //   intensidade baixa = bloco recuado, raio menor
    let tackleRadius = 2.65;
    if (manager.pressing && def_pressingApplies(carrierSnap, manager.pressing, this.simState)) {
      // Bonus por intensidade: -25 a +25%
      const intensityBonus = ((manager.pressing.intensity - 50) / 100) * 0.6;
      // Bonus por zona alta quando defendendo no campo adversário
      const zoneBonus = manager.pressing.zone === 'high' ? 0.25 : manager.pressing.zone === 'low' ? -0.20 : 0;
      tackleRadius = Math.max(1.5, Math.min(3.5, 2.65 * (1 + intensityBonus + zoneBonus)));
    }

    for (const def of defenders) {
      const dist = Math.hypot(def.vehicle.position.x - carrier.vehicle.position.x, def.vehicle.position.z - carrier.vehicle.position.z);
      if (dist > tackleRadius) continue;

      const defSnap = this.toAgentSnapshot(def);
      const tickK = Math.floor(this.world.simTime * 60);
      const tackleRng = rngFromSeed(this.simState.simulationSeed, `tackle:${def.id}:${carrier.id}:${tickK}`);
      const tackleSucceeded = resolveTackle(defSnap, carrierSnap, dist, tackleRng);
      if (!tackleSucceeded) {
        // Bloco A + Q3 — Reckless foul: relaxado pra acontecer mais. Hoje
        // dist<2m + aggr>55 era combo raro. Agora dist<3m + aggr>40 e prob
        // base maior. Fair play fraco também sobe consideravelmente.
        if (dist < 3.0) {
          const aggr = defSnap.aggressiveness ?? 50;
          const fp = defSnap.fairPlay / 100;
          // Probabilidade base maior + threshold mais permissivo.
          const recklessP = Math.max(
            0,
            ((aggr - 40) / 100) * 0.28 + (0.55 - fp) * 0.22,
          );
          if (recklessP > 0.001) {
            const recklessRng = rngFromSeed(
              this.simState.simulationSeed,
              `tackle_reckless:${def.id}:${carrier.id}:${tickK}`,
            );
            if (recklessRng.nextUnit() < recklessP) {
              const sevRoll = recklessRng.nextUnit();
              const foulSeverity: 'light' | 'firm' | 'ugly' =
                sevRoll < 0.40 ? 'light' : sevRoll < 0.78 ? 'firm' : 'ugly';
              this.appendLiveDisciplineAfterFoul(
                L,
                recklessRng,
                def,
                carrier.id,
                'reckless_tackle',
                foulSeverity,
                carrier,
              );
              return;
            }
          }
        }
        continue;
      }
      {
        const foulRng = rngFromSeed(
          this.simState.simulationSeed,
          `tackle_foul:${def.id}:${carrier.id}:${tickK}`,
        );
        let foulP = TACKLE_FOUL_PROB_BASE + ((100 - defSnap.fairPlay) / 100) * TACKLE_FOUL_FAIRPLAY_WEIGHT;
        // Sprint L2 — Personalidade: agressividade soma até +10pp de prob de falta
        // (jogador agressivo entra firme mesmo com fair play decente)
        const aggr = defSnap.aggressiveness ?? 50;
        foulP += ((aggr - 50) / 100) * 0.10;
        // Sprint L2 — Big game: nos minutos finais (75'+) a tensão sobe pros mentalmente fortes
        // bigGameMentality alto = MENOS faltas idiotas em momentos críticos
        const bgm = defSnap.bigGameMentality ?? 60;
        const minute = Math.floor(this.world.simTime / 60);
        if (minute >= 75) {
          foulP -= ((bgm - 50) / 100) * 0.06; // até -6pp pros mentalmente fortes
        }
        foulP = Math.max(0.02, Math.min(TACKLE_FOUL_PROB_CAP, foulP));
        if (foulRng.nextUnit() < foulP) {
          const sevRoll = foulRng.nextUnit();
          const foulSeverity: 'light' | 'firm' | 'ugly' =
            sevRoll < 0.52 ? 'light' : sevRoll < 0.82 ? 'firm' : 'ugly';
          this.appendLiveDisciplineAfterFoul(L, foulRng, def, carrier.id, 'tackle', foulSeverity, carrier);
          return;
        }

        const stats = getOrCreateStats(this.simState, def.id);
        stats.tackles++;

        const tierRng = rngFromSeed(
          this.simState.simulationSeed,
          `tackle-tier:${def.id}:${carrier.id}:${tickK}`,
        );
        const tkTier = resolveTackleExecutionTier({
          defender: defSnap,
          carrier: carrierSnap,
          rng: tierRng,
        });
        this.recordMotorTelemetry(
          def.id,
          carrier.id,
          'tackle',
          buildMotorActionOutcome('defense', tkTier.tier, tkTier.impact01),
        );
        if (tkTier.tier === 'critical_hit') {
          pushSimEvent(
            this.simState,
            `${this.simState.minute}' — Desarme de classe — bola recuperada com autoridade.`,
            'narrative',
            this.isTest2dLiveFeed() ? 'good' : undefined,
            this.isTest2dLiveFeed() ? def.id : undefined,
          );
          this.bumpRuntimeConfidence(def, CONFIDENCE_DELTA_GOOD * 0.2);
        }

        // Shielding: carrier may protect the ball and cancel the tackle — check BEFORE emitting possession_change
        const shieldRng = rngFromSeed(this.simState.simulationSeed, `shield:${carrier.id}:${def.id}:${tickK}`);
        if (shouldShieldBall(carrierSnap, defSnap, carrierSnap.drible, defSnap.marcacao, () => shieldRng.nextUnit())) {
          const shieldOffset = computeShieldPosition(carrier.vehicle.position.x, carrier.vehicle.position.z, def.vehicle.position.x, def.vehicle.position.z);
          carrier.vehicle.position.x = Math.max(1, Math.min(FIELD_LENGTH - 1, carrier.vehicle.position.x + shieldOffset.dx));
          carrier.vehicle.position.z = Math.max(1, Math.min(FIELD_WIDTH - 1, carrier.vehicle.position.z + shieldOffset.dz));
          // Shield succeeded — no possession change
          return;
        }

        L.push({ type: 'possession_change', payload: { to: def.side, reason: 'tackle' } });

        this.simState.possession = def.side;
        this.ballSys.giveTo(def.id, def.vehicle.position.x, def.vehicle.position.z);
        this.simState.carrierId = def.id;

        this.bumpRuntimeConfidence(def, CONFIDENCE_DELTA_GOOD * 0.45);
        this.bumpRuntimeConfidence(carrier, -CONFIDENCE_DELTA_BAD * 0.5);
        pushLastAction(def.matchRuntime, 'tackle_won');
        pushLastAction(carrier.matchRuntime, 'tackle_lost');

        pushSimEvent(
          this.simState,
          `${this.simState.minute}' — Desarme limpo!`,
          'narrative',
          this.isTest2dLiveFeed() ? 'good' : undefined,
          this.isTest2dLiveFeed() ? def.id : undefined,
        );
        this.applyTurnoverPlay(def, carrier.id, stealX, stealZ, 'tackle', L, manager, slotTargetFor);
        return;
      }
    }
  }

  /** Ponto na linha passe→destino junto ao interceptor, clampado ao relvado. */
  private clampedPassInterceptContactPoint(
    passerX: number,
    passerZ: number,
    landX: number,
    landZ: number,
    interceptorX: number,
    interceptorZ: number,
  ): { x: number; z: number } {
    const { t } = passInterceptLineMetrics(interceptorX, interceptorZ, passerX, passerZ, landX, landZ);
    const tc = Math.max(0.05, Math.min(0.95, t));
    const x = passerX + tc * (landX - passerX);
    const z = passerZ + tc * (landZ - passerZ);
    const c = clampToPitch(x, z, 0.55);
    return { x: c.x, z: c.z };
  }

  private finalizePassInterceptFlight(L: ReturnType<typeof createCausalBatch>) {
    const pend = this.pendingPassIntercept;
    if (!pend) return;
    this.pendingPassIntercept = null;

    const intr = this.findAgent(pend.interceptorId);
    const passer = this.findAgent(pend.passerId);
    const bx = this.ballSys.state.x;
    const bz = this.ballSys.state.z;
    if (!intr || !passer) return;

    const reachM = 6.2;
    const dIntercept = Math.hypot(intr.vehicle.position.x - bx, intr.vehicle.position.z - bz);
    if (dIntercept > reachM) {
      this.ballSys.setLoose(bx, bz, 0, 0);
      this.simState.carrierId = null;
      this.simState.possession = pend.possessionBefore;
      pushSimEvent(this.simState, `${this.simState.minute}' — Corte na linha — bola dividida.`);
      return;
    }

    const reason = pend.causalReason ?? 'intercept';
    L.push({ type: 'possession_change', payload: { to: intr.side, reason } });
    this.simState.possession = intr.side;
    this.ballSys.giveTo(intr.id, bx, bz);
    this.simState.carrierId = intr.id;
    this.bumpRuntimeConfidence(intr, CONFIDENCE_DELTA_GOOD * 0.35);
    this.bumpRuntimeConfidence(passer, -CONFIDENCE_DELTA_BAD * 0.25);
    pushLastAction(intr.matchRuntime, 'intercept');
    pushLastAction(passer.matchRuntime, 'pass_intercepted');
    const icLine =
      pend.narrativeLine
      ?? (this.isTest2dLiveFeed()
        ? test2dInterceptCutPassLine(this.simState.minute, pend.icKey)
        : `${this.simState.minute}' — Interceptação corta o passe.`);
    pushSimEvent(
      this.simState,
      icLine,
      'narrative',
      this.isTest2dLiveFeed() ? 'good' : undefined,
      this.isTest2dLiveFeed() ? intr.id : undefined,
    );
    if (this.turnoverCtx) {
      this.applyTurnoverPlay(
        intr,
        pend.passerId,
        pend.stealX,
        pend.stealZ,
        'intercept',
        L,
        this.turnoverCtx.manager,
        this.turnoverCtx.slotTargetFor,
      );
    }
  }

  private handleFlightCompletion(
    L: ReturnType<typeof createCausalBatch>,
    flight: BallFlight,
    _manager: TacticalManagerParams,
    _slotTargetFor: (a: AgentEx) => { x: number; z: number },
  ) {
    void _manager;
    void _slotTargetFor;
    if (flight.kind === 'pass' && this.pendingPassIntercept) {
      this.finalizePassInterceptFlight(L);
      return;
    }
    if (flight.kind === 'shot' && this.shotPending) {
      const sp = this.shotPending;
      if (sp.phase === 'rebound') {
        this.shotPending = null;
        this.simState.carrierId = null;
        return;
      }
      const wantsRebound =
        (sp.plan === 'block_rebound' || sp.plan === 'parry') && sp.rebound !== undefined;
      if (wantsRebound && sp.rebound) {
        sp.phase = 'rebound';
        this.emitShotSequenceOutcome(L, sp);
        this.ballSys.startFlight(
          { x: this.ballSys.state.x, z: this.ballSys.state.z },
          { x: sp.rebound.toX, z: sp.rebound.toZ },
          sp.rebound.speed,
          'shot',
        );
        return;
      }
      this.emitShotSequenceOutcome(L, sp);
      this.shotPending = null;
      /** Não limpar `carrierId` aqui: `miss` / `save hold` atribuem GR em `emitShotSequenceOutcome`. */
      return;
    }

    if (flight.kind === 'shot') {
      this.simState.carrierId = null;
      return;
    }

    const bx = this.ballSys.state.x;
    const bz = this.ballSys.state.z;

    if (flight.targetPlayerId) {
      const receiver = this.findAgent(flight.targetPlayerId);
      if (receiver) {
        const dist = Math.hypot(receiver.vehicle.position.x - bx, receiver.vehicle.position.z - bz);
        if (dist < 8) {
          this.ballSys.giveTo(receiver.id, bx, bz);
          this.simState.carrierId = receiver.id;
          this.simState.possession = receiver.side;
          return;
        }
      }
    }

    // No target or receiver too far — find nearest player to the landing point
    let best: AgentEx | null = null;
    let bestDist = 8;
    for (const a of [...this.homeAgents, ...this.awayAgents]) {
      const d = Math.hypot(a.vehicle.position.x - bx, a.vehicle.position.z - bz);
      if (d < bestDist) {
        bestDist = d;
        best = a;
      }
    }
    if (best) {
      this.ballSys.giveTo(best.id, bx, bz);
      this.simState.carrierId = best.id;
      if (this.simState.possession !== best.side) {
        this.simState.possession = best.side;
        L.push({ type: 'possession_change', payload: { to: best.side, reason: 'flight_pickup' } });
      }
    }
  }

  private pickUpLooseBall(
    L: ReturnType<typeof createCausalBatch>,
    manager: TacticalManagerParams,
    slotTargetFor: (a: AgentEx) => { x: number; z: number },
  ) {
    /** `gkRestart` com bola solta = estado quebrado — devolver ao GR e sair antes de qualquer recuperação. */
    if (this.gkRestart) {
      const gkHeal = this.findAgent(this.gkRestart.gkId);
      if (gkHeal) {
        this.ballSys.giveTo(gkHeal.id, gkHeal.vehicle.position.x, gkHeal.vehicle.position.z);
        this.simState.carrierId = gkHeal.id;
        if (this.simState.possession !== gkHeal.side) {
          this.simState.possession = gkHeal.side;
          L.push({ type: 'possession_change', payload: { to: gkHeal.side, reason: 'gk_restart_heal_loose' } });
        }
      }
      this.gkRestart = null;
      return;
    }

    let best: AgentEx | null = null;
    let bestDist = 6;

    const halfLb = this.matchClock.state.half;
    const bx = this.ballSys.state.x;
    for (const a of [...this.homeAgents, ...this.awayAgents]) {
      if (a.role === 'gk') {
        const dgx = getDefendingGoalX(a.side, halfLb);
        if (Math.abs(bx - dgx) > 36) continue;
      }
      const d = Math.hypot(a.vehicle.position.x - bx, a.vehicle.position.z - this.ballSys.state.z);
      if (d < bestDist) {
        bestDist = d;
        best = a;
      }
    }

    if (best) {
      const stealX = this.ballSys.state.x;
      const stealZ = this.ballSys.state.z;
      // Loose ball resolution: role-aware decision (attacker shoots, defender clears)
      try {
        const attackDirLb = getSideAttackDir(best.side, this.matchClock.state.half);
        const allSnaps = [...this.homeAgents, ...this.awayAgents].map((a) => this.toAgentSnapshot(a));
        const lbRng = rngFromSeed(this.simState.simulationSeed, `loose_ball:${stealX.toFixed(1)}:${stealZ.toFixed(1)}:${Math.floor(this.world.simTime * 10)}`);
        const lbDecisions = resolveLooseBall(stealX, stealZ, allSnaps, attackDirLb, () => lbRng.nextUnit());
        const bestDecision = lbDecisions.find((d) => d.agentId === best!.id);
        if (bestDecision?.action === 'clear') {
          // Defender clears — give ball but steer away from goal
          const clearDir = attackDirLb === 1 ? -1 : 1;
          const clearX = Math.max(5, Math.min(FIELD_LENGTH - 5, stealX + clearDir * 20));
          const clearZ = FIELD_WIDTH / 2 + (lbRng.nextUnit() - 0.5) * 30;
          this.safeArrive(best, clearX, clearZ, 'in_play');
        }
      } catch (e) {
        // non-blocking
      }
      const possChanged = this.simState.possession !== best.side;
      this.ballSys.giveTo(best.id, stealX, stealZ);
      this.simState.carrierId = best.id;
      if (possChanged) {
        this.simState.possession = best.side;
        L.push({ type: 'possession_change', payload: { to: best.side, reason: 'loose_ball_recovery' } });
      }
      this.applyTurnoverPlay(best, null, stealX, stealZ, 'loose_ball_recovery', L, manager, slotTargetFor);
    }
  }

  /**
   * Bola solta ou em voo: poucos jogadores por equipa perseguem; o resto permanece ancorado ao bloco.
   */
  private directPlayersToChaseBall(slotTargetFor: (a: AgentEx) => { x: number; z: number }) {
    if (this.world.simTime < this.gkReleaseChaseSuppressionUntil) return;
    const targetX = this.ballSys.state.flight
      ? this.ballSys.state.flight.toX
      : this.ballSys.state.x;
    const targetZ = this.ballSys.state.flight
      ? this.ballSys.state.flight.toZ
      : this.ballSys.state.z;

    const clearanceFlight =
      this.ballSys.state.mode === 'flight' && this.ballSys.state.flight?.kind === 'clearance';
    const chasersPerTeam = clearanceFlight ? 1 : 2;
    const ballPt = { x: targetX, z: targetZ };

    const forwardSlot = (slot: string) =>
      slot === 'ata' || slot === 'pe' || slot === 'pd' || slot.startsWith('ata');

    const halfChase = this.matchClock.state.half;
    const rankAndChase = (team: AgentEx[]) => {
      const ranked = team
        .filter((a) => a.id !== this.simState.carrierId && a.role !== 'gk')
        .map((a) => {
          const d = Math.hypot(a.vehicle.position.x - targetX, a.vehicle.position.z - targetZ);
          const rankDist = d + (forwardSlot(a.slotId) ? 9 : 0) + (a.role === 'attack' && !forwardSlot(a.slotId) ? 5 : 0);
          return { ag: a, dist: d, rankDist };
        })
        .sort((a, b) => a.rankDist - b.rankDist);

      let taken = 0;
      for (let j = 0; j < ranked.length && taken < chasersPerTeam; j++) {
        const r = ranked[j]!;
        const schemeCh: FormationSchemeId = r.ag.side === 'home'
          ? (this.liveRef?.homeFormationScheme ?? '4-3-3') as FormationSchemeId
          : (this.liveRef?.awayFormationScheme ?? '4-3-3') as FormationSchemeId;
        const zModel = buildSlotZoneProfile(r.ag.slotId, r.ag.role, schemeCh, r.ag.side, halfChase);
        const zoneEng = resolveZoneEngagement(targetX, targetZ, zModel, { team: r.ag.side, half: halfChase });
        const anchor = slotTargetFor(r.ag);
        const anchorToBall = Math.hypot(anchor.x - targetX, anchor.z - targetZ);
        const sameStructuralBand = anchorToBall < (clearanceFlight ? 28 : 46);
        const veryClose = r.dist < 20;
        const fwd = forwardSlot(r.ag.slotId) || r.ag.slotId.startsWith('mc');
        const distCap = clearanceFlight ? 26 : 41;
        if (r.dist >= distCap) continue;
        if (zoneEng === 'structure' && r.dist > (clearanceFlight ? 16 : 22)) continue;
        if (taken > 0 && !sameStructuralBand && !veryClose && !fwd) continue;

        let radii = tacticalRadiiFor(r.ag.role, r.ag.slotId);
        radii = scaleRadiiForZoneEngagement(radii, zoneEng, zModel.behaviorProfile);
        const agOverlap = Math.abs(r.ag.vehicle.position.x - anchor.x);
        const chaseTeamBall = this.simState.possession === r.ag.side;
        radii = scaleRadiiForOverlapReturn(radii, agOverlap, chaseTeamBall);
        const ar = clearanceFlight ? 7 : 20;
        const sr = clearanceFlight ? 9 : 24;
        const md = clearanceFlight ? 5 : 16;
        radii = {
          actionRadius: radii.actionRadius + ar,
          supportRadius: radii.supportRadius + sr,
          returnBias: radii.returnBias * (clearanceFlight ? 0.92 : 0.82),
          maxDeviationInAction: radii.maxDeviationInAction + md,
        };
        const blended = blendOffBallDestination(
          ballPt,
          anchor,
          { x: r.ag.vehicle.position.x, z: r.ag.vehicle.position.z },
          ballPt,
          radii,
        );
        // Dois chasers com o mesmo blend colapsavam no mesmo ponto; desvia faixas em Z.
        const chaseZSeparationM = 3.8;
        const zWithLane = blended.z + (taken === 0 ? chaseZSeparationM : -chaseZSeparationM);
        const spread = clampToPitch(blended.x, zWithLane, 2.2);
        this.safeArrive(r.ag, spread.x, spread.z, 'pressing');
        taken++;
      }
    };

    rankAndChase(this.homeAgents);
    rankAndChase(this.awayAgents);
  }

  private findAgent(id: string | null): AgentEx | undefined {
    if (!id) return undefined;
    return this.homeAgents.find((a) => a.id === id) ?? this.awayAgents.find((a) => a.id === id);
  }

  step(dt: number, manager: TacticalManagerParams): void {
    const live = this.liveRef;
    if (!live || live.phase !== 'playing') return;

    const truth = this.truthPhase(live);
    this.lastSimPhase = emitPhaseIfChanged(
      this.eventBus,
      this.lastSimPhase,
      truth,
      live.phase,
      this.world.simTime,
    );

    this.accumulator += Math.min(dt, 0.08);
    this.captureFrameStart();
    while (this.accumulator >= FIXED_DT) {
      this.integrateFixed(FIXED_DT, manager);
      this.accumulator -= FIXED_DT;
    }
    this.renderBlend = this.accumulator / FIXED_DT;
  }

  private lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
  }

  /** Interpolação cúbica de Hermite (posição + tangente em cada extremo) — suaviza trajetória da bola entre ticks 60 Hz. */
  private hermiteScalar(p0: number, p1: number, m0: number, m1: number, t: number): number {
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    return h00 * p0 + h10 * m0 + h01 * p1 + h11 * m1;
  }

  /** Returns the current simulation match state for syncing back to store. */
  getSimState(): SimMatchState {
    return this.simState;
  }

  getExpertMetrics(): {
    homeMorale: TeamMoraleState | null;
    awayMorale: TeamMoraleState | null;
    homeTacticalDiscipline: number;
    awayTacticalDiscipline: number;
  } {
    const avgDiscipline = (agents: { matchRuntime: { tacticalDisciplineScore: number }; role: string }[]) => {
      const field = agents.filter(a => a.role !== 'gk');
      if (field.length === 0) return 0.5;
      return field.reduce((sum, a) => sum + a.matchRuntime.tacticalDisciplineScore, 0) / field.length;
    };
    return {
      homeMorale: this.homeMorale,
      awayMorale: this.awayMorale,
      homeTacticalDiscipline: avgDiscipline(this.homeAgents),
      awayTacticalDiscipline: avgDiscipline(this.awayAgents),
    };
  }

  /**
   * Ativa o buff de momentum do Legacy Mode para o time da casa.
   * durationSec: duração base em segundos de simulação (default 300 = 5min).
   * Escalonado externamente por sessionsCompleted antes de chamar.
   */
  activateLegacyModeBuff(durationSec = 300): void {
    this.homeMomentumBuff.durationSec = durationSec;
    activateMomentumBuff(this.homeMomentumBuff, this.world.simTime);
  }

  /**
   * Sincroniza spiritMomentum (GameSpirit, -1..+1) com MomentumBuffState (TacticalSimLoop).
   * Chamado por runMatchMinute após cada tick do GameSpirit.
   * Threshold 0.4: momentum forte → ativa buff de confiança/morale no loop 2D.
   */
  syncSpiritMomentum(spiritMomentum: { home: number; away: number }): void {
    const THRESHOLD = 0.4;
    if (spiritMomentum.home >= THRESHOLD && !isMomentumBuffActive(this.homeMomentumBuff, this.world.simTime)) {
      activateMomentumBuff(this.homeMomentumBuff, this.world.simTime);
    }
    if (spiritMomentum.away >= THRESHOLD && !isMomentumBuffActive(this.awayMomentumBuff, this.world.simTime)) {
      activateMomentumBuff(this.awayMomentumBuff, this.world.simTime);
    }
  }

  /**
   * Fase 3.2 — Injeta boost de decisão baseado no positionKnowledge de cada agente.
   * Chamado pelo useLegacyMatchEngine ao ativar Legacy Mode.
   * playersById: mapa de PlayerEntity com positionKnowledge real.
   * boostDurationSec: duração do boost (alinhada ao buff de momentum).
   *
   * Converte os actionWeights da lenda num impact01 (0–1) e registra nos mapas
   * executionBoostUntil/Impact01 que já alimentam o DecisionContext de cada agente.
   */
  applyLegacyKnowledgeBoosts(
    playersById: Record<string, { positionKnowledge?: { actionWeights: Record<string, { weight: number }>; sessionsCompleted: number } }>,
    boostDurationSec: number,
  ): void {
    const until = this.world.simTime + boostDurationSec;

    for (const ag of this.homeAgents) {
      const entity = playersById[ag.id];
      const pk = entity?.positionKnowledge;
      if (!pk || pk.sessionsCompleted === 0) continue;

      // Calcula impact01 como média dos pesos acima de 1.0 (só os que superam o neutro)
      const weights = Object.values(pk.actionWeights);
      const aboveNeutral = weights.filter((w) => w.weight > 1.0);
      if (aboveNeutral.length === 0) continue;

      const avgBoost = aboveNeutral.reduce((sum, w) => sum + (w.weight - 1.0), 0) / aboveNeutral.length;
      // Escala: avgBoost 0.5 → impact01 0.75; cap em 0.95
      const impact01 = Math.min(0.95, 0.5 + avgBoost * 0.5);
      // Sessões amplificam levemente: +2% por sessão, máximo +20%
      const sessionMult = Math.min(1.2, 1 + pk.sessionsCompleted * 0.02);

      this.executionBoostUntil.set(ag.id, until);
      this.executionBoostImpact01.set(ag.id, Math.min(0.95, impact01 * sessionMult));
    }
  }

  /**
   * Injeta traits do positionKnowledge diretamente no PlayerProfile de cada agente home.
   * Converte riskTaking/offensiveRuns/buildUpPreference (0–2, neutro=1) para os campos
   * equivalentes do PlayerProfile (0–1), de forma que decisões TypeScript locais os usem
   * sem depender do modelo de IA.
   * Chamado na inicialização do match e ao ativar Legacy Mode.
   */
  applyPositionKnowledgeTraits(
    playersById: Record<string, { positionKnowledge?: { traits: { pressIntensity: number; offensiveRuns: number; riskTaking: number; buildUpPreference: number }; sessionsCompleted: number } }>,
  ): void {
    for (const ag of this.homeAgents) {
      const pk = playersById[ag.id]?.positionKnowledge;
      if (!pk || pk.sessionsCompleted === 0) continue;
      const t = pk.traits;
      // Mapeia 0–2 (neutro=1) para 0–1 (neutro=0.5) com clamp
      const toProfile = (v: number) => Math.max(0, Math.min(1, v / 2));
      ag.profile = {
        ...ag.profile,
        riskAppetite: toProfile(t.riskTaking),
        verticality: toProfile(t.offensiveRuns),
        possessionBias: toProfile(2 - t.buildUpPreference), // buildUp alto → menos posse-bias
      };
      ag.decision = new PlayerDecisionEngine(ag.profile);
    }
  }

  /**
   * Popula o cache de AgentProfile para todos os jogadores home.
   * Chamado pelo useLive2dTacticalSim na inicialização do match.
   * playersById: mapa de PlayerEntity completo (com atributos, skills, arquétipo).
   */
  applyAgentProfiles(
    playersById: Record<string, import('@/entities/types').PlayerEntity>,
  ): void {
    for (const ag of [...this.homeAgents, ...this.awayAgents]) {
      const entity = playersById[ag.id];
      if (!entity) continue;
      this.agentProfileCache.set(ag.id, createAgentProfile(entity));
    }
  }

  /** Returns home player IDs whose stamina is critically low (≤ threshold). Used for auto-sub hints. */
  getCriticallyFatiguedHomeIds(threshold = 30): string[] {
    return this.homeAgents
      .filter((a) => a.role !== 'gk' && a.matchRuntime.stamina <= threshold)
      .map((a) => a.id);
  }

  /** True while a deadball window is active (set piece in progress). */
  isDeadBallActive(): boolean {
    return this.deadBallUntil > this.world.simTime;
  }

  /**
   * Segundos de relógio de jogo (0–5400) alinhados ao `MatchClock` interno —
   * para UI 2D sem interpolar como `TICK_MATCH_MINUTE`.
   */
  getFootballElapsedSecApprox(): number {
    const s = this.matchClock.state;
    if (s.fullTime || s.period === 'full_time') {
      return FOOTBALL_TOTAL_SECONDS;
    }
    const pe = s.periodElapsed;
    switch (s.period) {
      case 'first_half':
        return Math.min(45 * 60 - 1e-6, (pe / FIRST_HALF_DURATION_SEC) * (45 * 60));
      case 'halftime':
        return 45 * 60;
      case 'second_half':
        return Math.min(FOOTBALL_TOTAL_SECONDS, 45 * 60 + (pe / SECOND_HALF_DURATION_SEC) * (45 * 60));
      default:
        return Math.min(FOOTBALL_TOTAL_SECONDS, s.minute * 60);
    }
  }

  getSnapshot(): import('@/bridge/matchTruthSchema').MatchTruthSnapshot {
    const live = this.liveRef;
    if (!live) {
      return this.world.buildSnapshot([], 'dead_ball', undefined, FIELD_SCHEMA_VERSION);
    }
    const phase = this.truthPhase(live);
    if (live.phase === 'pregame') {
      return this.world.buildSnapshot([], phase, undefined, FIELD_SCHEMA_VERSION);
    }
    const canShowAgents =
      (live.phase === 'playing' || live.phase === 'postgame') &&
      this.homeAgents.length > 0 &&
      this.awayAgents.length > 0;
    if (!canShowAgents) {
      return this.world.buildSnapshot([], phase, undefined, FIELD_SCHEMA_VERSION);
    }

    const rb = Math.max(0, Math.min(1, this.renderBlend));

    // If ball mode changed this frame (e.g. flight→dead, loose→held) or position jumped
    // discontinuously, skip interpolation to avoid a "zip" across the field.
    const ballModeChanged = this.ballSys.state.mode !== this.frameStartBallMode;
    const ballPosDelta = Math.hypot(
      this.world.ball.x - this.frameStartBall.x,
      this.world.ball.z - this.frameStartBall.z,
    );
    const useBallLerp = !ballModeChanged && ballPosDelta < 3.5;

    let bx: number, by: number, bz: number;
    if (useBallLerp) {
      const m0x = this.frameStartBallVel.x * FIXED_DT;
      const m1x = this.world.ballVel.x * FIXED_DT;
      const m0z = this.frameStartBallVel.z * FIXED_DT;
      const m1z = this.world.ballVel.z * FIXED_DT;
      const m0y = this.frameStartBallVy * FIXED_DT;
      const m1y = this.ballSys.state.vy * FIXED_DT;
      bx = this.hermiteScalar(this.frameStartBall.x, this.world.ball.x, m0x, m1x, rb);
      by = this.hermiteScalar(this.frameStartBall.y, this.world.ball.y, m0y, m1y, rb);
      bz = this.hermiteScalar(this.frameStartBall.z, this.world.ball.z, m0z, m1z, rb);
    } else {
      // Snap to end position — no interpolation across discontinuities.
      bx = this.world.ball.x;
      by = this.world.ball.y;
      bz = this.world.ball.z;
    }
    const bClamped = clampToPitch(bx, bz, 0.5);
    bx = bClamped.x;
    bz = bClamped.z;
    by = Math.max(0, Math.min(by, 8));

    const buildPlayer = (a: AgentEx): MatchTruthPlayer => {
      const prev = this.frameStartPlayers.get(a.id);
      let px: number, pz: number;
      if (prev) {
        const pdelta = Math.hypot(a.vehicle.position.x - prev.x, a.vehicle.position.z - prev.z);
        if (pdelta < 2.5) {
          px = this.lerp(prev.x, a.vehicle.position.x, rb);
          pz = this.lerp(prev.z, a.vehicle.position.z, rb);
        } else {
          // Teleport detected — snap to avoid visual zip
          px = a.vehicle.position.x;
          pz = a.vehicle.position.z;
        }
      } else {
        px = a.vehicle.position.x;
        pz = a.vehicle.position.z;
      }
      const face = a.bodyYaw;
      const pre = a.decision.getPrethinkingState ? a.decision.getPrethinkingState() : null;
      const intent = pre ? { type: pre.prethinkingIntent, confidence: pre.conviction01, targetX: pre.anchorX, targetZ: pre.anchorZ } : undefined;
      return {
        id: a.id,
        side: a.side,
        x: px,
        y: a.vehicle.position.y,
        z: pz,
        heading: face,
        facingYaw: face,
        speed: a.vehicle.getSpeed(),
        role: a.role,
        shirtNumber: this.shirtNumbers.get(a.id),
        matchStamina: a.matchRuntime.stamina,
        intent,
        locomotionState: a.locomotionState,
      };
    };

    const players: MatchTruthPlayer[] = [
      ...this.homeAgents.map(buildPlayer),
      ...this.awayAgents.map(buildPlayer),
    ];

    const cues =
      live.phase === 'playing' && this.cueQueue.length ? [...this.cueQueue] : undefined;
    if (live.phase === 'playing') this.cueQueue = [];

    const snap = this.world.buildSnapshot(players, phase, cues, FIELD_SCHEMA_VERSION);
    snap.ball = {
      x: bx,
      y: by,
      z: bz,
      vx: this.world.ballVel.x,
      vz: this.world.ballVel.z,
    };
    snap.kits = {
      home: { primaryColor: '#E6DC23', secondaryColor: '#235E23', accent: '#F2F2F2' },
      away: { primaryColor: '#3358C7', secondaryColor: '#6B707A', accent: '#F24038' },
    };
    if (
      live.phase === 'playing'
      && this.secondHalfKickoffAt !== null
      && this.world.simTime < this.secondHalfKickoffAt
    ) {
      const rem = this.secondHalfKickoffAt - this.world.simTime;
      snap.secondHalfResumeCountdownSec = Math.max(1, Math.ceil(rem));
    }
    if (
      live.phase === 'playing'
      && this.matchOpeningKickoffAt !== null
      && this.world.simTime < this.matchOpeningKickoffAt
    ) {
      const rem = this.matchOpeningKickoffAt - this.world.simTime;
      snap.matchOpeningKickoffCountdownSec = Math.max(1, Math.ceil(rem));
    }
    return snap;
  }
}
