import type { LiveMatchSnapshot, PossessionSide, MatchEventEntry } from '@/engine/types';
import { FOOTBALL_TOTAL_SECONDS } from '@/engine/types';
import type { MatchTruthPhase, MatchTruthPlayer, CameraCue } from '@/bridge/matchTruthSchema';
import { Vehicle } from 'yuka';
import { MatchTruthWorld } from './MatchTruthWorld';
import { MatchPlayFsm, SECOND_HALF_KICKOFF_WAIT_SEC } from '@/matchState/matchPlayFsm';
import { MatchEngine } from '@/match-engine/MatchEngine';
import { slotsForScheme } from '@/match-engine/formations/catalog';
import { kickoffWorldXZ } from '@/engine/kickoffFormationLayout';
import type { FormationSchemeId } from '@/match-engine/types';
import { slotToWorld } from '@/formation/layout433';
import { applyFormationPreset, mirrorPresetToAway } from '@/formation/presets';
import { StructuralReorganizationSystem, type StructuralTargetMap } from '@/simulation/StructuralReorganization';
import {
  applyTransitionCompactionToSlots,
  TRANSITION_COMPACTION_DECAY_SEC,
} from '@/simulation/transitionCompaction';
import { clampTargetToRoleZone, type TacticalContext } from '@/tactics/zones';
import {
  applySteeringForPhase,
  createAgentBinding,
  rebuildNeighbors,
  setArriveTarget,
  stepVehicle,
  type AgentBinding,
  type AgentMode,
} from '@/agents/yukaAgents';
import { FIELD_SCHEMA_VERSION } from '@/field-schema/constants';
import {
  clampToPitch,
  FIELD_LENGTH,
  FIELD_WIDTH,
  GOAL_MOUTH_HALF_WIDTH_M,
  uiPercentToWorld,
  worldToUiPercent,
} from './field';
import {
  buildRefereeDispositionMaps,
  scanCausalLogConfusion,
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
  resolveTackle,
  nearestOpponentPressure01,
  findPassOptions,
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
  clampWorldOutsideBothPenaltyAreas,
  getDefendingGoalX,
  getSideAttackDir,
  getThird,
  getZoneTags,
  isInsideOwnPenaltyArea,
  PENALTY_AREA_DEPTH_M,
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
  FOUL_AFTER_TACKLE_YELLOW_PROB,
  FOUL_AFTER_TACKLE_RED_PROB,
  DRAW_FOUL_SUCCESS_BASE,
  DRAW_FOUL_MENTAL_BONUS,
  DRAW_FOUL_MAX_DIST,
} from '@/match/tacticalLiveDisciplineTuning';
import {
  normalizeMatchAttributes,
  createPlayerMatchRuntimeFromPitch,
  compositePasse,
  pushLastAction,
  awayCognitiveArchetypeForSlot,
  defaultAwayMatchAttributes,
  type MatchPlayerAttributes,
  type PlayerMatchRuntime,
  type MatchCognitiveArchetype,
} from '@/match/playerInMatch';
import {
  blendThreeLocomotionCaps,
  clampVehicleMaxSpeed,
  fatigueSpeedMultiplier,
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
import { createSeededRng, hashTurnoverSeed, pickPlayAfterTurnover } from './pickPlayAfterTurnover';
import {
  createCausalBatch,
  type CausalMatchEvent,
  type ShotStrikeProfile,
} from '@/match/causal/matchCausalTypes';
import {
  blendOffBallDestination,
  scaleRadiiForTeamPossession,
  scaleRadiiForZoneEngagement,
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
import { computeGoalThreat, type GoalThreat, type ThreatTrend } from '@/playerDecision/ThreatModel';
import { buildGoalContext } from '@/match/goalContext';
import type { TeamTacticalStyle } from '@/tactics/playingStyle';
const FIXED_DT = 1 / 60;
/**
 * Tempo mínimo com bola nas mãos do GR antes do pontapé (s).
 * Valores ~FIXED_DT*3 (~50 ms) faziam `gkHeldWait` quase invisível e a pressão voltava logo.
 */
const GK_RESTART_KICK_DELAY_SEC = 0.58;
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
  matchRuntime: PlayerMatchRuntime;
  cognitiveArchetype: MatchCognitiveArchetype;
  /** Esforço locomotor suavizado (0 ≈ andar, 1 ≈ sprint). */
  locomotionRunBlendSmoothed: number;
}

interface TacticalManagerParams {
  tacticalMentality: number;
  defensiveLine: number;
  tempo: number;
  tacticalStyle?: TeamTacticalStyle;
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
  private frameStartPlayers = new Map<string, { x: number; z: number }>();
  private lastSimPhase: SimulationMatchPhase | null = null;
  private shirtNumbers = new Map<string, number>();
  /** New carrier → cannot pass back to this peer until `until` sim time */
  private turnoverPassBlock = new Map<string, { peerId: string; until: number }>();
  /** Receptor não devolve logo ao passe (mobilidade / terceiro homem — E. Barros). */
  private passReturnBlock = new Map<string, { fromId: string; until: number }>();
  /** Passador deve trocar de setor após combinar com o novo portador. */
  private passMobilityHint = new Map<string, { carrierId: string; until: number; forward: boolean }>();
  /** Defesa deste lado desorganizada até `simTime` (passe crítico recente do adversário). */
  private defensiveShapeBreakUntil: Record<PossessionSide, number> = { home: -1e9, away: -1e9 };
  /** Receptor com passe crítico: decisão mais rápida até `simTime`. */
  private executionBoostUntil = new Map<string, number>();
  private executionBoostImpact01 = new Map<string, number>();
  /** Equipa que saiu no 1.º tempo — o 2.º saída de bola é a outra (IFAB). */
  private firstKickoffPossessionSide: PossessionSide = 'home';
  private initialized = false;
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
  /** Evita recursão infinita interceptação → passe → interceptação no mesmo tick. */
  private applyTurnoverDepth = 0;
  /** Goal threat levels: each team's attacking threat from the previous tick */
  private homeThreat: GoalThreat = { level: 0, trend: 'stable', factors: { ballZone: 0, openShooters: 0, defensiveDisorganization: 0, numericalAdvantage: 0, progressionSpeed: 0, carrierDanger: 0 } };
  private awayThreat: GoalThreat = { level: 0, trend: 'stable', factors: { ballZone: 0, openShooters: 0, defensiveDisorganization: 0, numericalAdvantage: 0, progressionSpeed: 0, carrierDanger: 0 } };

  /** Possession last frame — pulse compaction for team that lost the ball. */
  private prevLoopPossession: PossessionSide | null = null;
  private transitionCompaction = 0;
  private transitionLoserSide: PossessionSide | null = null;
  /** Após remate para fora: reformação tipo saída de bola sem roubar a bola ao GR no kickoff intermédio. */
  private skipKickoffBallAssign = false;
  /** Sequência física do remate (primário ± rebote); causal `shot_result` na conclusão da perna certa. */
  private shotPending: ShotPendingResolution | null = null;
  /** Após bola com o GR (saída de baliza): avanço curto + pontapé (passe livre / meio / chutão) fora da área. */
  private gkRestart: { gkId: string; kickAt: number } | null = null;
  /** Após saída do GR: não puxar `directPlayersToChaseBall` até este instante (evita colapso na área). */
  private gkReleaseChaseSuppressionUntil = -1e9;
  /** 2.º tempo: após troca de campo, instante em que o atacante executa o pontapé de saída (bola ainda ao centro). */
  private secondHalfKickoffAt: number | null = null;
  /** Cooldown do árbitro lógico (confusão causal / ajuntamento espacial). */
  private lastConfusionRefereeWorldTime = -1e9;
  // #region agent log
  private _dbgGkSteerLogSimTime = -1e9;
  private _dbgIntegrateTick = 0;
  private _dbgSnapTick = 0;
  // #endregion

  constructor() {
    this.ballVehicle.boundingRadius = 0.42;
    this.ballVehicle.maxSpeed = 48;
    this.ballVehicle.maxForce = 200;
    this.ballVehicle.mass = 0.3;
  }

  /**
   * Initialize agents from LiveMatchSnapshot roster.
   * Called once when roster changes. Does NOT set ball from snapshot each frame.
   */
  syncLive(live: LiveMatchSnapshot | null, manager: TacticalManagerParams) {
    this.liveRef = live;
    if (!live) return;

    if (live.phase !== 'playing') return;

    const inv = invertLineup(live.matchLineupBySlot);
    /** Inclui `slotId` para que trocas de posição reinicializem agentes com papéis corretos. */
    const sig = [...live.homePlayers]
      .sort((a, b) => a.playerId.localeCompare(b.playerId))
      .map((p) => `${p.playerId}:${p.slotId}`)
      .join('|');

    if (sig !== this.homeRosterSig || this.homeAgents.length !== live.homePlayers.length) {
      this.homeRosterSig = sig;
      this.homeAgents = [];
      this.awayAgents = [];
      this.shirtNumbers.clear();

      for (const hp of live.homePlayers) {
        const slot = hp.slotId || inv.get(hp.playerId) || 'mc1';
        const w = uiPercentToWorld(hp.x, hp.y);
        const base = createAgentBinding(hp.playerId, slot, 'home', hp.role, w.x, w.z, 14 + manager.tempo * 0.04);
        const prof = profileForSlot(slot, hp.role);
        const attrs = normalizeMatchAttributes(hp.attributes);
        const rt = createPlayerMatchRuntimeFromPitch(hp.fatigue, attrs);
        const cog: MatchCognitiveArchetype = hp.cognitiveArchetype ?? 'construtor';
        const agEx: AgentEx = {
          ...base,
          decision: new PlayerDecisionEngine(prof),
          profile: prof,
          matchAttrs: attrs,
          matchRuntime: rt,
          cognitiveArchetype: cog,
          locomotionRunBlendSmoothed: 0.35,
        };
        this.applyVehicleSpeedFromAttrs(agEx, FIXED_DT, null);
        this.homeAgents.push(agEx);
        if (hp.num) this.shirtNumbers.set(hp.playerId, hp.num);
      }

      this.matchEngine.reset();

      const awayScheme = live.homeFormationScheme ?? '4-3-3';
      let awayNum = 1;
      for (const slot of slotsForScheme(awayScheme)) {
        const w = kickoffWorldXZ('away', awayScheme, slot);
        const aid = `away-${slot}`;
        const role = roleFromSlotId(slot);
        const base = createAgentBinding(aid, slot, 'away', role, w.x, w.z, 13);
        const prof = profileForSlot(slot, role);
        const attrs = defaultAwayMatchAttributes(awayNum);
        const rt = createPlayerMatchRuntimeFromPitch(14, attrs);
        const cog = awayCognitiveArchetypeForSlot(slot);
        const agEx: AgentEx = {
          ...base,
          decision: new PlayerDecisionEngine(prof),
          profile: prof,
          matchAttrs: attrs,
          matchRuntime: rt,
          cognitiveArchetype: cog,
          locomotionRunBlendSmoothed: 0.35,
        };
        this.applyVehicleSpeedFromAttrs(agEx, FIXED_DT, null);
        this.awayAgents.push(agEx);
        this.shirtNumbers.set(aid, awayNum++);
      }

      this.simState = createSimMatchState();
      this.skipKickoffBallAssign = false;
      this.shotPending = null;
      this.gkRestart = null;
      this.gkReleaseChaseSuppressionUntil = -1e9;
      this.secondHalfKickoffAt = null;
      this.lastShotAttemptSimTime = { home: -1e9, away: -1e9 };
      this.lastShotBudgetCoolSimTime = { home: -1e9, away: -1e9 };
      this.shotBudgetArmed = { home: false, away: false };
      this.offensiveStallAccum = { home: 0, away: 0 };
      this.defensiveShapeBreakUntil = { home: -1e9, away: -1e9 };
      this.executionBoostUntil.clear();
      this.executionBoostImpact01.clear();
      this.applyTurnoverDepth = 0;
      this.simState.simulationSeed =
        live.simulationSeed ?? hashStringSeed(`${live.homeShort}|${live.awayShort}|${live.homePlayers.length}`);
      this.matchClock.reset();
      this.matchClock.start();
      this.prevClockPeriod = null;
      this.ballSys.placeForKickoff();

      this.simState.possession = live.possession ?? 'home';
      this.firstKickoffPossessionSide = this.simState.possession;
      this.kickoffGiveBall();
      this.initialized = true;
    }

    const top = live.events[0];
    if (top && top.id !== this.lastEventId) {
      this.lastEventId = top.id;
      emitFromMatchEventEntry(this.eventBus, top, this.world.simTime);
    }

  }

  private kickoffGiveBall() {
    this.assignBallToRestartTeam();
    this.simState.phase = 'live';
  }

  /** After goal: ball to restarting side without forcing sim phase (FSM controls kickoff → live). */
  private giveBallForKickoffRestart() {
    this.assignBallToRestartTeam();
  }

  private assignBallToRestartTeam() {
    const kickTeam = this.simState.possession === 'home' ? this.homeAgents : this.awayAgents;
    const mid = kickTeam.find((a) => a.role === 'attack' || a.role === 'mid') ?? kickTeam[0];
    if (mid) {
      this.ballSys.giveTo(mid.id, mid.vehicle.position.x, mid.vehicle.position.z);
      this.simState.carrierId = mid.id;
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
   * Após `SECOND_HALF_KICKOFF_WAIT_SEC` com bola morta no centro: atacante (ou fallback) inicia com passe.
   */
  private executeSecondHalfOpeningPass(L: ReturnType<typeof createCausalBatch>): void {
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
    const opt = ranked[0] ?? passOpts[0];

    const cx = FIELD_LENGTH / 2;
    const cz = FIELD_WIDTH / 2;
    const str = selfSnap.fisico / 100;
    const speed = Math.max(14, Math.min(42, 17 + selfSnap.passeCurto * 0.11 + str * 0.9));

    if (opt) {
      const stats = getOrCreateStats(this.simState, carrier.id);
      stats.passesAttempt++;
      const passRes = resolvePassForPossession(baseSeed, tickK, selfSnap, opt, press01, oppSnaps, disorg01);
      if (passRes.completed) stats.passesOk++;
      if (passRes.interceptPlayerId) {
        const intr = this.findAgent(passRes.interceptPlayerId);
        if (intr) {
          L.push({ type: 'possession_change', payload: { to: intr.side, reason: 'second_half_kickoff_intercept' } });
          this.simState.possession = intr.side;
          this.ballSys.giveTo(intr.id, intr.vehicle.position.x, intr.vehicle.position.z);
          this.simState.carrierId = intr.id;
          pushLastAction(intr.matchRuntime, 'intercept');
          pushLastAction(carrier.matchRuntime, 'pass_intercepted');
          pushSimEvent(this.simState, `${this.simState.minute}' — Interceptação no reinício do 2.º tempo.`);
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
        pushLastAction(carrier.matchRuntime, 'short_pass_safety');
        pushSimEvent(this.simState, `${this.simState.minute}' — 2.º tempo: saída com passe ao meio-campo.`);
      } else {
        this.ballSys.setLoose(passRes.x, passRes.z);
        this.simState.carrierId = null;
        pushSimEvent(this.simState, `${this.simState.minute}' — 2.º tempo: toque de saída — segunda bola.`);
      }
    } else {
      const r = rngFromSeed(baseSeed, `2h-kick:${carrier.id}:${tickK}`).nextUnit();
      const toX = Math.min(FIELD_LENGTH - 4, Math.max(4, cx + attackDir * (16 + r * 10)));
      const toZ = Math.min(FIELD_WIDTH - 4, Math.max(4, cz + (r - 0.5) * 18));
      const c = clampToPitch(toX, toZ, 0.55);
      this.ballSys.startFlight({ x: cx, z: cz }, { x: c.x, z: c.z }, speed, 'pass');
      this.simState.carrierId = null;
      pushSimEvent(this.simState, `${this.simState.minute}' — 2.º tempo: pontapé de saída à frente.`);
    }

    this.gkReleaseChaseSuppressionUntil = this.world.simTime + 0.32;
    this.fsm.resumeLive();
  }

  /**
   * IFAB: troca de campo no intervalo — espelha posições em X antes do apito do 2.º tempo.
   * Posse para a equipa que não iniciou o 1.º tempo; bola morta no centro durante
   * {@link SECOND_HALF_KICKOFF_WAIT_SEC}s, depois o atacante inicia com passe.
   */
  private applySecondHalfSideSwapAndKickoff() {
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

    this.ballSys.placeForKickoff();
    this.simState.carrierId = null;

    const first = this.firstKickoffPossessionSide;
    this.simState.possession = first === 'home' ? 'away' : 'home';
    this.secondHalfKickoffAt = this.world.simTime + SECOND_HALF_KICKOFF_WAIT_SEC;
    this.fsm.state = { phase: 'kickoff', goalSequenceTimer: 0 };
  }

  /** Alvo de movimento; GR em `live` fica ancorado à sua baliza. */
  private safeArrive(ag: AgentEx, x: number, z: number, mode: AgentMode) {
    const half = this.matchClock.state.half;
    let tx = x;
    if (this.simState.phase === 'live' && (ag.slotId === 'gol' || ag.role === 'gk')) {
      tx = clampGoalkeeperTargetX(ag.side, half, tx);
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
   * teletransporta suavemente o bloco para formação deslocada pela bola (sem linha na UI).
   */
  private tryConfusionRefereeIntegrateEnd(fsmPhaseAfter: MatchTruthPhase, ballStoppedRestart: boolean): void {
    const REF_COOLDOWN_SEC = 3.2;
    if (fsmPhaseAfter !== 'live' || ballStoppedRestart) return;
    if (this.shotPending) return;

    const gkHoldingRestart =
      this.gkRestart !== null
      && this.ballSys.state.mode === 'held'
      && this.simState.carrierId === this.gkRestart.gkId;
    /** Estado incoerente (ex.: posse roubada sem limpar `gkRestart`) destrava o árbitro em vez de abortar o frame. */
    if (this.gkRestart && !gkHoldingRestart) {
      // #region agent log
      fetch('http://127.0.0.1:7569/ingest/813b0eb5-3788-4dcf-a782-9114cfd985ed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e8aa67' },
        body: JSON.stringify({
          sessionId: 'e8aa67',
          hypothesisId: 'C',
          location: 'TacticalSimLoop.ts:tryConfusion_clear_gkRestart',
          message: 'cleared gkRestart (incoherent vs holding)',
          data: {
            simT: this.world.simTime,
            carrierId: this.simState.carrierId,
            gkIdWas: this.gkRestart.gkId,
            ballMode: this.ballSys.state.mode,
            gkHoldingRestart,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      this.gkRestart = null;
    }

    if (this.world.simTime - this.lastConfusionRefereeWorldTime < REF_COOLDOWN_SEC) return;
    if (this.ballSys.state.mode === 'flight') return;

    const ballX = this.ballSys.state.x;
    const ballZ = this.ballSys.state.z;

    let causalVerdict = scanCausalLogConfusion(this.simState.causalLog.entries);
    if (gkHoldingRestart) causalVerdict = null;
    const allPos = [
      ...this.homeAgents.map((a) => ({
        x: a.vehicle.position.x,
        z: a.vehicle.position.z,
        slotId: a.slotId,
        role: a.role,
      })),
      ...this.awayAgents.map((a) => ({
        x: a.vehicle.position.x,
        z: a.vehicle.position.z,
        slotId: a.slotId,
        role: a.role,
      })),
    ];
    let verdict = causalVerdict;
    if (!verdict && this.ballSys.state.mode !== 'dead') {
      verdict = scanSpatialSwarmConfusion(allPos, ballX, ballZ, this.simState.possession);
    }
    if (!verdict) return;

    const homeScheme = this.liveRef?.homeFormationScheme ?? '4-3-3';
    const awayScheme: FormationSchemeId = '4-3-3';
    const half = this.matchClock.state.half;
    const maps = buildRefereeDispositionMaps(homeScheme, awayScheme, ballX, ballZ, half);

    if (verdict.reason === 'causal_whirlwind') {
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

    const snap = (ag: AgentEx, m: Map<string, { x: number; z: number }>) => {
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
      ag.vehicle.position.set(t.x, 0, t.z);
      ag.vehicle.velocity.set(0, 0, 0);
      setArriveTarget(ag, t.x, t.z, 'reforming');
    };

    for (const ag of this.homeAgents) snap(ag, maps.home);
    for (const ag of this.awayAgents) snap(ag, maps.away);

    appendSimCausal(this.simState, [
      {
        seq: this.simState.causalLog.nextSeq,
        simTime: this.simState.minute + 0.997,
        type: 'referee_shape_reset',
        payload: {
          minute: this.simState.minute,
          reason: verdict.reason,
          awardedSide: verdict.awardedSide,
        },
      },
    ]);

    // #region agent log
    if (gkHoldingRestart && verdict.reason === 'spatial_swarm') {
      fetch('http://127.0.0.1:7569/ingest/813b0eb5-3788-4dcf-a782-9114cfd985ed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e8aa67' },
        body: JSON.stringify({
          sessionId: 'e8aa67',
          hypothesisId: 'C2',
          location: 'TacticalSimLoop.ts:tryConfusionRefereeIntegrateEnd',
          message: 'referee_spatial_applied_during_gk_hold',
          data: { minute: this.simState.minute, simTime: this.world.simTime },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    }
    // #endregion

    this.lastConfusionRefereeWorldTime = this.world.simTime;
    rebuildNeighbors(this.homeAgents);
    rebuildNeighbors(this.awayAgents);
    this.world.ball.x = this.ballSys.state.x;
    this.world.ball.z = this.ballSys.state.z;
    this.syncBallVehicleFromWorld();
  }

  private allVehicles(): Vehicle[] {
    return [...this.homeAgents, ...this.awayAgents].map((a) => a.vehicle);
  }

  private toAgentSnapshot(a: AgentEx): AgentSnapshot {
    const m = a.matchAttrs;
    return {
      id: a.id,
      slotId: a.slotId,
      side: a.side,
      x: a.vehicle.position.x,
      z: a.vehicle.position.z,
      speed: a.vehicle.getSpeed(),
      role: a.role,
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
      cognitiveArchetype: a.cognitiveArchetype,
      confidenceRuntime: a.matchRuntime.confidenceRuntime,
      stamina: a.matchRuntime.stamina,
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
    ag.vehicle.maxForce = Math.min(
      228,
      Math.max(88, 100 + effort * 62 + vel01 * 38),
    );
  }

  private bumpRuntimeConfidence(ag: AgentEx, delta: number): void {
    ag.matchRuntime.confidenceRuntime = Math.max(
      0.48,
      Math.min(1.28, ag.matchRuntime.confidenceRuntime + delta),
    );
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

    if (tier === 'critical_hit' && kind === 'pass' && passReceiverId) {
      if (m.defensiveDisorgBoostSec > 0) {
        this.defensiveShapeBreakUntil[defSide] = this.world.simTime + m.defensiveDisorgBoostSec;
      }
      if (m.offensiveExecutionBoostSec > 0) {
        this.executionBoostUntil.set(passReceiverId, this.world.simTime + m.offensiveExecutionBoostSec);
        this.executionBoostImpact01.set(passReceiverId, impact01);
      }
      return;
    }

    if (tier === 'critical_hit' && kind === 'dribble') {
      if (m.defensiveDisorgBoostSec > 0) {
        this.defensiveShapeBreakUntil[defSide] = this.world.simTime + m.defensiveDisorgBoostSec;
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
    const drain =
      FATIGUE_RATE_BASE
      * fixedDt
      * (highIntensity ? 1 : 0.38)
      * (1.12 - f * 0.38);
    let s = ag.matchRuntime.stamina - drain;
    if (!highIntensity) {
      s += STAMINA_RECOVERY_BASE * fixedDt * (0.35 + f * 0.5);
    }
    ag.matchRuntime.stamina = Math.max(22, Math.min(100, s));
  }

  private integrateFixed(fixedDt: number, manager: TacticalManagerParams) {
    const live = this.liveRef;
    if (!live || live.phase !== 'playing' || !this.initialized) return;

    // #region agent log
    this._dbgIntegrateTick += 1;
    if (this._dbgIntegrateTick % 40 === 0) {
      fetch('http://127.0.0.1:7569/ingest/813b0eb5-3788-4dcf-a782-9114cfd985ed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e8aa67' },
        body: JSON.stringify({
          sessionId: 'e8aa67',
          hypothesisId: 'P0',
          location: 'TacticalSimLoop.ts:integrateFixed_heartbeat',
          message: 'integrateFixed running',
          data: {
            tick: this._dbgIntegrateTick,
            simT: this.world.simTime,
            ballMode: this.ballSys.state.mode,
            carrierId: this.simState.carrierId,
            gkRestart: this.gkRestart?.gkId ?? null,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    }
    // #endregion

    for (const [pid, v] of [...this.turnoverPassBlock.entries()]) {
      if (this.world.simTime >= v.until) this.turnoverPassBlock.delete(pid);
    }
    for (const [pid, v] of [...this.passReturnBlock.entries()]) {
      if (this.world.simTime >= v.until) this.passReturnBlock.delete(pid);
    }
    for (const [pid, v] of [...this.passMobilityHint.entries()]) {
      if (this.world.simTime >= v.until) this.passMobilityHint.delete(pid);
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
      this.matchEngine.reset();
      this.prevClockPeriod = 'second_half';
    } else if (period === 'first_half' || period === 'second_half') {
      this.prevClockPeriod = period;
    }

    this.simState.clockPeriod = period === 'first_half' ? 'first_half' : 'second_half';

    this.structuralSys.update(fixedDt);

    const fsmPhaseBefore = this.fsm.state.phase;
    const freezeFsmForSecondHalfKickoffHold =
      this.secondHalfKickoffAt !== null && this.world.simTime < this.secondHalfKickoffAt;
    if (!freezeFsmForSecondHalfKickoffHold) {
      this.fsm.tick(fixedDt);
    }
    const fsmPhaseAfter = this.fsm.state.phase;

    if (fsmPhaseBefore === 'goal_restart' && fsmPhaseAfter === 'kickoff') {
      if (this.skipKickoffBallAssign) {
        this.skipKickoffBallAssign = false;
      } else {
        this.giveBallForKickoffRestart();
      }
    }
    if (fsmPhaseAfter === 'live' && (fsmPhaseBefore === 'kickoff' || fsmPhaseBefore === 'goal_restart')) {
      this.structuralSys.clearGoalRestart();
    }

    if (fsmPhaseAfter === 'live') {
      this.simState.phase = 'live';
    } else if (fsmPhaseAfter === 'goal_restart' || fsmPhaseAfter === 'kickoff') {
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

    const ballX = this.ballSys.state.x;
    const ballZ = this.ballSys.state.z;

    this.world.ball.x = ballX;
    this.world.ball.z = ballZ;

    const half = this.matchClock.state.half;
    const attackDirHome = getSideAttackDir('home', half);
    const attackDirAway = getSideAttackDir('away', half);

    const tactx: TacticalContext = {
      defensiveLineDepth: manager.defensiveLine,
      mentality: manager.tacticalMentality,
      ballX,
      ballZ,
      half,
    };

    const homeScheme: FormationSchemeId = this.liveRef?.homeFormationScheme ?? '4-3-3';
    const awayScheme: FormationSchemeId = '4-3-3';
    const homePlayers = this.homeAgents.map((a) => ({ id: a.id, x: a.vehicle.position.x, z: a.vehicle.position.z }));
    const awayPlayers = this.awayAgents.map((a) => ({ id: a.id, x: a.vehicle.position.x, z: a.vehicle.position.z }));

    const engineFrame = this.matchEngine.step({
      dt: fixedDt,
      ballX, ballZ,
      livePossession: this.simState.possession,
      onBallPlayerId: this.simState.carrierId ?? undefined,
      contestCarrierId: this.simState.carrierId,
      homePlayers, awayPlayers, manager,
      homeScheme,
      awayScheme,
    });

    const dynamicHome = new Map<string, { x: number; z: number }>();
    for (const [slot, intent] of engineFrame.homeSlots) {
      dynamicHome.set(slot, slotToWorld('home', { nx: intent.nx, nz: intent.nz }));
    }
    const dynamicAway = new Map<string, { x: number; z: number }>();
    for (const [slot, intent] of engineFrame.awaySlots) {
      dynamicAway.set(slot, slotToWorld('away', { nx: intent.nx, nz: intent.nz }));
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
    const ballCentricStrength = gkBallInHandRestart ? 0 : 0.04;
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
      ballX: this.ballSys.state.x,
      ballZ: this.ballSys.state.z,
      attackDir: attackDirHome,
      carrier: homeCarrier,
      attackers: homeSnaps,
      defenders: awaySnaps,
      prevThreatLevel: this.homeThreat.level,
    });
    this.awayThreat = computeGoalThreat({
      ballX: this.ballSys.state.x,
      ballZ: this.ballSys.state.z,
      attackDir: attackDirAway,
      carrier: awayCarrier,
      attackers: awaySnaps,
      defenders: homeSnaps,
      prevThreatLevel: this.awayThreat.level,
    });

    const L = createCausalBatch(this.simState.minute, this.simState.causalLog.nextSeq);

    let structuralByPlayer: StructuralTargetMap | null = null;
    const goalRestartStructural =
      this.structuralSys.hasGoalRestart()
      && (phase === 'goal_restart' || (phase === 'kickoff' && this.structuralSys.isGoalKickWideRestart()));
    if (goalRestartStructural) {
      structuralByPlayer = this.structuralSys.getGoalRestartPlayerTargets(
        this.homeAgents,
        this.awayAgents,
        this.matchClock.state.half,
      );
    } else if (
      this.structuralSys.hasSetPieceStructural()
      && (phase === 'throw_in' || phase === 'corner_kick' || phase === 'goal_kick')
    ) {
      structuralByPlayer = this.structuralSys.getSetPiecePlayerTargets(this.homeAgents, this.awayAgents);
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
      if (structuralByPlayer?.has(a.id)) {
        const raw = structuralByPlayer.get(a.id)!;
        const cr = clampTargetToRoleZone({ side: a.side, role: a.role, slotId: a.slotId }, raw.x, raw.z, tactx);
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
      const cr = clampTargetToRoleZone(
        { side: a.side, role: a.role, slotId: a.slotId },
        slotTarget.x,
        slotTarget.z,
        tactx,
      );
      return clamp18(cr.x, cr.z);
    };

    this.turnoverCtx = { manager, slotTargetFor };

    const carrierForBallSync = this.findAgent(this.simState.carrierId);
    if (this.ballSys.state.mode === 'held' && carrierForBallSync) {
      this.ballSys.syncHeldToCarrier(carrierForBallSync.vehicle.position.x, carrierForBallSync.vehicle.position.z);
    }
    if (this.gkRestart && this.ballSys.state.mode === 'held' && this.simState.carrierId !== this.gkRestart.gkId) {
      // #region agent log
      fetch('http://127.0.0.1:7569/ingest/813b0eb5-3788-4dcf-a782-9114cfd985ed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e8aa67' },
        body: JSON.stringify({
          sessionId: 'e8aa67',
          hypothesisId: 'C',
          location: 'TacticalSimLoop.ts:gkRestart_sanitize_pre_decisions',
          message: 'cleared gkRestart (held but carrier not gk)',
          data: {
            simT: this.world.simTime,
            carrierId: this.simState.carrierId,
            gkId: this.gkRestart.gkId,
            ballMode: this.ballSys.state.mode,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      this.gkRestart = null;
    }

    // #region agent log
    {
      const c = this.findAgent(this.simState.carrierId);
      const held = this.ballSys.state.mode === 'held';
      const wantLog = this.gkRestart !== null || (held && !!c);
      if (wantLog && c) {
        const d = Math.hypot(this.ballSys.state.x - c.vehicle.position.x, this.ballSys.state.z - c.vehicle.position.z);
        const sampleHeld = held && this._dbgIntegrateTick % 24 === 0;
        if (d > 0.08 || this.gkRestart || sampleHeld) {
          fetch('http://127.0.0.1:7569/ingest/813b0eb5-3788-4dcf-a782-9114cfd985ed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e8aa67' },
            body: JSON.stringify({
              sessionId: 'e8aa67',
              hypothesisId: 'A',
              location: 'TacticalSimLoop.ts:after_sync_pre_decisions',
              message: 'ball vs carrier after syncHeld',
              data: {
                simT: this.world.simTime,
                d,
                ballMode: this.ballSys.state.mode,
                carrierId: this.simState.carrierId,
                role: c.role,
                slotId: c.slotId,
                bx: this.ballSys.state.x,
                bz: this.ballSys.state.z,
                px: c.vehicle.position.x,
                pz: c.vehicle.position.z,
                gkRestart: this.gkRestart?.gkId ?? null,
                sampleHeld,
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
        }
      }
    }
    // #endregion

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
    const stallBx = this.ballSys.state.x;
    const stallBz = this.ballSys.state.z;
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

    this.runAgentDecisions(
      this.homeAgents, homeSnaps, awaySnaps, dynamicHomeForAgents, presetHome, structuralByPlayer,
      modeHomeEffective, attackDirHome, manager, tactx, L, fixedDt, this.homeThreat, this.awayThreat,
    );
    this.runAgentDecisions(
      this.awayAgents, awaySnaps, homeSnaps, dynamicAwayForAgents,
      presetHome ? mirrorPresetToAway(presetHome) : null, structuralByPlayer,
      modeAwayEffective, attackDirAway, manager, tactx, L, fixedDt, this.awayThreat, this.homeThreat,
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
      this.handleFlightCompletion(L, flightBeforeTick);
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
      applySteeringForPhase(ag, this.ballVehicle, others, modeHomeEffective, dist, homeHasBall);
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
      applySteeringForPhase(ag, this.ballVehicle, others, modeAwayEffective, dist, awayHasBall);
    }

    // #region agent log
    if (
      this.gkRestart
      && this.ballSys.state.mode === 'held'
      && this.simState.carrierId === this.gkRestart.gkId
    ) {
      const wst = this.world.simTime;
      if (wst - this._dbgGkSteerLogSimTime > 0.32) {
        this._dbgGkSteerLogSimTime = wst;
        const gk = this.findAgent(this.gkRestart.gkId);
        const gkSide = gk?.side;
        const opp = gkSide === 'home' ? this.awayAgents : this.homeAgents;
        const sample = opp.find((a) => a.slotId !== 'gol' && a.role !== 'gk');
        const oppMode = gkSide === 'home' ? modeAwayEffective : modeHomeEffective;
        const oppHasBall = gkSide === 'home' ? awayHasBall : homeHasBall;
        let pursuitW = 0;
        let distS = 0;
        if (sample) {
          pursuitW = sample.pursuit.weight;
          distS = Math.hypot(sample.vehicle.position.x - ballX, sample.vehicle.position.z - ballZ);
        }
        fetch('http://127.0.0.1:7569/ingest/813b0eb5-3788-4dcf-a782-9114cfd985ed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e8aa67' },
          body: JSON.stringify({
            sessionId: 'e8aa67',
            hypothesisId: 'H2',
            location: 'TacticalSimLoop.ts:after_applySteeringForPhase',
            message: 'gk_restart_held_steering_sample',
            data: {
              gkSide,
              oppMode,
              oppHasBall,
              sampleId: sample?.id,
              pursuitW,
              distSampleToBall: Math.round(distS * 100) / 100,
              mentality: manager.tacticalMentality,
              untilKick: this.gkRestart ? Math.round((this.gkRestart.kickAt - wst) * 1000) / 1000 : null,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
      }
    }
    // #endregion

    for (const ag of this.homeAgents) {
      if (gkWideFreeze && this.gkRestart && ag.id !== this.gkRestart.gkId) continue;
      const dx = ag.vehicle.position.x - ballX;
      const dz = ag.vehicle.position.z - ballZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
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
      });
    }
    for (const ag of this.awayAgents) {
      if (gkWideFreeze && this.gkRestart && ag.id !== this.gkRestart.gkId) continue;
      const dx = ag.vehicle.position.x - ballX;
      const dz = ag.vehicle.position.z - ballZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
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
      });
    }

    const halfPhys = this.matchClock.state.half;
    const nudgeTowardOperative18 = (a: AgentEx) => {
      if (a.id === this.simState.carrierId) return;
      const schemeN: FormationSchemeId = a.side === 'home' ? homeScheme : awayScheme;
      const ctxZ = { team: a.side, half: halfPhys };
      const model = buildSlotZoneProfile(a.slotId ?? 'mc1', a.role, schemeN, a.side, halfPhys);
      const curZ = worldPosToTactical18Zone(a.vehicle.position.x, a.vehicle.position.z, ctxZ);
      if (operativeZoneIdSet18(model).has(curZ)) return;
      const t = clampWorldToOperativeTactical18(
        a.vehicle.position.x,
        a.vehicle.position.z,
        a.slotId ?? 'mc1',
        a.role,
        schemeN,
        a.side,
        halfPhys,
        0.55,
      );
      const k = 0.14;
      a.vehicle.position.x += (t.x - a.vehicle.position.x) * k;
      a.vehicle.position.z += (t.z - a.vehicle.position.z) * k;
    };
    for (const a of this.homeAgents) {
      if (gkWideFreeze && this.gkRestart && a.id !== this.gkRestart.gkId) continue;
      stepVehicle(a, fixedDt);
      nudgeTowardOperative18(a);
    }
    for (const a of this.awayAgents) {
      if (gkWideFreeze && this.gkRestart && a.id !== this.gkRestart.gkId) continue;
      stepVehicle(a, fixedDt);
      nudgeTowardOperative18(a);
    }

    this.tryConfusionRefereeIntegrateEnd(fsmPhaseAfter, ballStoppedRestart);

    // #region agent log
    {
      const c = this.findAgent(this.simState.carrierId);
      const held = this.ballSys.state.mode === 'held';
      const wantLog = this.gkRestart !== null || (held && !!c);
      if (wantLog && c) {
        const d = Math.hypot(this.ballSys.state.x - c.vehicle.position.x, this.ballSys.state.z - c.vehicle.position.z);
        const sampleHeld = held && this._dbgIntegrateTick % 24 === 3;
        if (d > 0.08 || this.gkRestart || sampleHeld) {
          fetch('http://127.0.0.1:7569/ingest/813b0eb5-3788-4dcf-a782-9114cfd985ed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e8aa67' },
            body: JSON.stringify({
              sessionId: 'e8aa67',
              hypothesisId: 'B',
              location: 'TacticalSimLoop.ts:pre_world_ball_copy',
              message: 'ball vs carrier before world.ball sync',
              data: {
                simT: this.world.simTime,
                d,
                ballMode: this.ballSys.state.mode,
                carrierId: this.simState.carrierId,
                role: c.role,
                slotId: c.slotId,
                bx: this.ballSys.state.x,
                bz: this.ballSys.state.z,
                px: c.vehicle.position.x,
                pz: c.vehicle.position.z,
                gkRestart: this.gkRestart?.gkId ?? null,
                sampleHeld,
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
        }
      }
    }
    // #endregion

    this.world.ball.x = this.ballSys.state.x;
    this.world.ball.z = this.ballSys.state.z;
    this.world.ballVel.x = 0;
    this.world.ballVel.z = 0;
    this.world.simTime += fixedDt;

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
  ) {
    const side = agents[0]?.side ?? 'home';
    const teamPhase = detectTeamPhase(
      this.ballSys.state.x,
      attackDir,
      this.simState.carrierId ? (this.findAgent(this.simState.carrierId)?.side ?? null) : null,
      side,
      this.simState.carrierId,
    );

    const carrierJustChanged = this.simState.carrierId !== this.prevCarrierId;
    const ballSector = computeBallSector(this.ballSys.state.z);

    for (const ag of agents) {
      if (this.isGkRestartBallInHandFreeze() && this.gkRestart && ag.id !== this.gkRestart.gkId) {
        const px = ag.vehicle.position.x;
        const pz = ag.vehicle.position.z;
        this.safeArrive(ag, px, pz, 'reforming');
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
      const clamped = clampTargetToRoleZone({ side: ag.side, role: ag.role, slotId: ag.slotId }, slotTarget.x, slotTarget.z, tactx);

      // Structural reorganisation: drive arrive directly (skip role clamp — targets are authored for the event).
      if (structuralByPlayer?.has(ag.id)) {
        const skipStructForGkRestart =
          this.gkRestart
          && ag.id === this.gkRestart.gkId
          && (ag.role === 'gk' || ag.slotId === 'gol')
          && this.simState.carrierId === ag.id;
        if (!skipStructForGkRestart) {
          const raw = structuralByPlayer.get(ag.id)!;
          const sx = Math.min(FIELD_LENGTH - 2, Math.max(2, raw.x));
          const sz = Math.min(FIELD_WIDTH - 2, Math.max(2, raw.z));
          this.safeArrive(ag, sx, sz, mode);
          continue;
        }
      }

      // GR com bola à espera de repor: todo o campo (exceto o GR) sai da grande área.
      if (
        this.gkRestart
        && this.ballSys.state.mode === 'held'
        && this.simState.carrierId === this.gkRestart.gkId
        && !(ag.id === this.gkRestart.gkId && (ag.role === 'gk' || ag.slotId === 'gol'))
      ) {
        const out = clampWorldOutsideBothPenaltyAreas(clamped.x, clamped.z);
        this.safeArrive(ag, out.x, out.z, mode);
        continue;
      }

      const isCarrier = this.simState.carrierId === ag.id;
      const isReceiver = this.ballSys.state.mode === 'flight' && this.ballSys.state.flight?.targetPlayerId === ag.id;
      const selfSnap = this.toAgentSnapshot(ag);

      if (
        this.gkRestart
        && ag.id === this.gkRestart.gkId
        && (ag.role === 'gk' || ag.slotId === 'gol')
        && this.simState.carrierId === ag.id
        && this.ballSys.state.mode === 'held'
      ) {
        const halfGk = this.matchClock.state.half;
        if (this.world.simTime < this.gkRestart.kickAt) {
          const stepX = clampGoalkeeperTargetX(ag.side, halfGk, ag.vehicle.position.x + attackDir * 2.85);
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

      let rollSalt = 0;
      const tickKey = Math.floor(this.world.simTime * 1000);
      const roll01 = () =>
        unitFromParts(this.simState.simulationSeed, ['dec', ag.id, tickKey, rollSalt++]);

      const decCtx: DecisionContext = {
        self: selfSnap,
        teammates: teamSnaps.filter((t) => t.id !== ag.id),
        opponents: oppSnaps,
        ballX: this.ballSys.state.x,
        ballZ: this.ballSys.state.z,
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
        stamina: ag.matchRuntime.stamina,
        decisionDebug: DECISION_DEBUG,
        profile: ag.profile,
        teamPhase,
        carrierId: this.simState.carrierId,
        carrierJustChanged,
        ballSector,
        threatLevel: activeThreat.level,
        threatTrend: activeThreat.trend,
        passBlocklist,
        offensivePassMobility,
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
      };

      const playerAction = ag.decision.tick(decCtx, this.world.simTime);
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
        // Handle fumble
        if (!playerAction.reception.success) {
          const bx = this.ballSys.state.x + playerAction.reception.errorDisplacement.dx;
          const bz = this.ballSys.state.z + playerAction.reception.errorDisplacement.dz;
          if (this.simState.carrierId === ag.id) {
            this.ballSys.setLoose(bx, bz);
            this.simState.carrierId = null;
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
            L.push({ type: 'possession_change', payload: { to: intr.side, reason: 'intercept' } });
            this.simState.possession = intr.side;
            this.ballSys.giveTo(intr.id, intr.vehicle.position.x, intr.vehicle.position.z);
            this.simState.carrierId = intr.id;
            this.bumpRuntimeConfidence(intr, CONFIDENCE_DELTA_GOOD * 0.35);
            this.bumpRuntimeConfidence(ag, -CONFIDENCE_DELTA_BAD * 0.25);
            pushLastAction(intr.matchRuntime, 'intercept');
            pushLastAction(ag.matchRuntime, 'pass_intercepted');
            pushSimEvent(this.simState, `${this.simState.minute}' — Interceptação corta o passe.`);
            if (this.turnoverCtx) {
              this.applyTurnoverPlay(
                intr,
                ag.id,
                stealX,
                stealZ,
                'intercept',
                L,
                this.turnoverCtx.manager,
                this.turnoverCtx.slotTargetFor,
              );
            }
          }
          break;
        }

        this.recordMotorTelemetry(
          ag.id,
          opt.targetId,
          'pass',
          buildMotorActionOutcome('pass', passRes.executionTier, passRes.impact01),
        );

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

        if (passRes.completed) {
          if (passRes.executionTier === 'critical_hit') {
            this.applyMotorExecutionChain(ag, 'pass', passRes.executionTier, passRes.impact01, opt.targetId);
            pushSimEvent(
              this.simState,
              `${this.simState.minute}' — Passe de ruptura — linha adversária desorganizada.`,
            );
            this.bumpRuntimeConfidence(ag, CONFIDENCE_DELTA_GOOD * 0.22);
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
          this.ballSys.setLoose(passRes.x, passRes.z);
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
          pushSimEvent(this.simState, `${this.simState.minute}' — Remate de ${who}!`);
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
        if (cRes.success && cRes.executionTier === 'critical_hit') {
          pushSimEvent(this.simState, `${this.simState.minute}' — Cruzamento de ruptura!`);
          this.bumpRuntimeConfidence(ag, CONFIDENCE_DELTA_GOOD * 0.18);
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
        const dr = resolveDribbleBeat(baseSeed, tickK, selfSnap, press01);
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
          this.applyMotorExecutionChain(ag, 'dribble', dr.executionTier, dr.impact01);
          if (dr.executionTier === 'critical_hit') {
            pushSimEvent(this.simState, `${this.simState.minute}' — Drible de elite — linha ultrapassada!`);
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
              break;
            }
          }
          this.ballSys.setLoose(stealX, stealZ);
          this.simState.carrierId = null;
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
        const dangerous = foulRng.nextUnit() < 0.3;
        this.appendLiveDisciplineAfterFoul(L, foulRng, defA, ag.id, 'draw_foul', dangerous);
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
    const suppressChaseAfterGkBallLeaves = () => {
      this.gkReleaseChaseSuppressionUntil = this.world.simTime + 0.34;
    };
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
      const passRes = resolvePassForPossession(baseSeed, tickK, selfSnap, opt, press01, oppSnaps, disorg01);
      const stats = getOrCreateStats(this.simState, gk.id);
      stats.passesAttempt++;
      if (passRes.completed) stats.passesOk++;

      if (passRes.interceptPlayerId) {
        const intr = this.findAgent(passRes.interceptPlayerId);
        if (intr) {
          const stealX = gk.vehicle.position.x;
          const stealZ = gk.vehicle.position.z;
          L.push({ type: 'possession_change', payload: { to: intr.side, reason: 'gk_restart_intercept' } });
          this.simState.possession = intr.side;
          this.ballSys.giveTo(intr.id, intr.vehicle.position.x, intr.vehicle.position.z);
          this.simState.carrierId = intr.id;
          this.bumpRuntimeConfidence(intr, CONFIDENCE_DELTA_GOOD * 0.32);
          this.bumpRuntimeConfidence(gk, -CONFIDENCE_DELTA_BAD * 0.2);
          pushLastAction(intr.matchRuntime, 'intercept');
          pushLastAction(gk.matchRuntime, 'pass_intercepted');
          pushSimEvent(this.simState, `${this.simState.minute}' — Interceptação na saída do GR.`);
          if (this.turnoverCtx) {
            this.applyTurnoverPlay(
              intr,
              gk.id,
              stealX,
              stealZ,
              'intercept',
              L,
              this.turnoverCtx.manager,
              this.turnoverCtx.slotTargetFor,
            );
          }
        }
        return;
      }

      const str = selfSnap.fisico / 100;
      const speed = Math.max(14, Math.min(42, 17 + selfSnap.passeCurto * 0.11 + str * 0.9));
      if (passRes.completed) {
        this.ballSys.startFlight(
          { x: selfSnap.x, z: selfSnap.z },
          { x: passRes.x, z: passRes.z },
          speed,
          'pass',
          opt.targetId,
        );
      } else {
        this.ballSys.setLoose(passRes.x, passRes.z);
      }
      this.simState.carrierId = null;
      suppressChaseAfterGkBallLeaves();
      pushLastAction(gk.matchRuntime, 'gk_distribution_pass');
      pushSimEvent(this.simState, `${this.simState.minute}' — Saída do guarda-redes: passe ao colega livre.`);
      return;
    }

    const depthPunt = 42 + rng.nextUnit() * 22;
    let toX = selfSnap.x + attackDir * depthPunt;
    let toZ = selfSnap.z + (rng.nextUnit() - 0.5) * 24;
    const out = clampWorldOutsideBothPenaltyAreas(toX, toZ);
    toX = out.x;
    toZ = out.z;
    if (isInsideOwnPenaltyArea({ x: toX, z: toZ }, ctx)) {
      const dg = getDefendingGoalX(gk.side, half);
      toX =
        dg < FIELD_LENGTH / 2
          ? PENALTY_AREA_DEPTH_M + 2.6
          : FIELD_LENGTH - PENALTY_AREA_DEPTH_M - 2.6;
      toZ = Math.min(FIELD_WIDTH - 2, Math.max(2, toZ));
    }

    const str = selfSnap.fisico / 100;
    const isLong = r < 0.72;
    const spd = isLong ? Math.min(48, 28 + str * 2.4 + rng.nextUnit() * 6) : Math.min(52, 36 + str * 2.9);
    this.ballSys.startFlight({ x: selfSnap.x, z: selfSnap.z }, { x: toX, z: toZ }, spd, 'clearance');
    this.simState.carrierId = null;
    suppressChaseAfterGkBallLeaves();
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
    return team.find((a) => a.slotId === 'gol' || a.role === 'gk') ?? team[0];
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
      pushSimEvent(
        this.simState,
        `${this.simState.minute}' — ${shooterSide === defendingSide ? 'Defesa' : 'Remate'}: bola com GR (${reason}).`,
      );
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

    const tag =
      reason === 'tackle' ? 'desarme'
      : reason === 'intercept' ? 'interceptação'
      : reason === 'dribble_fail' ? 'perda'
      : 'recuperação';
    if (this.isPassOnBallType(action.type)) {
      pushSimEvent(this.simState, `${this.simState.minute}' — Passe após ${tag}.`);
    } else if (
      action.type === 'simple_carry'
      || action.type === 'aggressive_carry'
      || action.type === 'progressive_dribble'
    ) {
      pushSimEvent(this.simState, `${this.simState.minute}' — Condução após ${tag}.`);
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
      ? (this.liveRef?.homeFormationScheme ?? '4-3-3')
      : '4-3-3';
    const zoneModel = buildSlotZoneProfile(ag.slotId, ag.role, scheme, ag.side, half);
    const engagement = resolveZoneEngagement(ball.x, ball.z, zoneModel, { team: ag.side, half });
    let radii = tacticalRadiiFor(ag.role, ag.slotId);
    radii = scaleRadiiForTeamPossession(radii, teamHasBall);
    radii = scaleRadiiForZoneEngagement(radii, engagement, zoneModel.behaviorProfile);
    const blended = blendOffBallDestination(
      desired,
      anchor,
      { x: ag.vehicle.position.x, z: ag.vehicle.position.z },
      ball,
      radii,
      { isPressingCarrier: actionType === 'press_carrier' },
    );
    const clamped = clampWorldToOperativeTactical18(
      blended.x,
      blended.z,
      ag.slotId ?? 'mc1',
      ag.role,
      scheme,
      ag.side,
      half,
      0.52,
    );
    if (this.simState.phase === 'live' && (ag.slotId === 'gol' || ag.role === 'gk')) {
      return { ...clamped, x: clampGoalkeeperTargetX(ag.side, half, clamped.x) };
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
   * Falta + cartão opcional no loop contínuo. Feed via `pushSimEvent`; causal para histórico/replay.
   */
  private appendLiveDisciplineAfterFoul(
    L: ReturnType<typeof createCausalBatch>,
    foulRng: RngDraw,
    fouler: AgentEx,
    victimId: string,
    foulKind: string,
    dangerous: boolean,
  ) {
    const m = this.simState.minute;
    L.push({
      type: 'foul_committed',
      payload: {
        minute: m,
        foulerId: fouler.id,
        foulerSide: fouler.side,
        victimId,
        kind: foulKind,
        dangerous,
      },
    });
    const line = dangerous
      ? `${m}' — Falta dura! O árbitro corta o lance.`
      : `${m}' — Falta marcada — respira o jogo.`;
    pushSimEvent(this.simState, line);

    const u = foulRng.nextUnit();
    if (u < FOUL_AFTER_TACKLE_RED_PROB) {
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
    } else if (u < FOUL_AFTER_TACKLE_RED_PROB + FOUL_AFTER_TACKLE_YELLOW_PROB) {
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
      const rz = rngFromSeed(
        this.simState.simulationSeed,
        `shot-misswidez:${shooterId}:${Math.floor(this.world.simTime * 1000)}`,
      ).nextUnit();
      const wideZ = rz < 0.5 ? margin + 0.4 : FIELD_WIDTH - margin - 0.4;
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
      },
    });

    if (
      pend.shotRes.executionTier === 'critical_hit'
      && (shotOutcome === 'save' || shotOutcome === 'block')
    ) {
      pushSimEvent(
        this.simState,
        `${this.simState.minute}' — Remate de elite — defesa/queda física em grande plano.`,
      );
    }

    if (shotOutcome === 'goal') {
      const scoringSide = pend.shooterSide;
      const otherSide: PossessionSide = scoringSide === 'home' ? 'away' : 'home';
      if (ag) {
        this.bumpRuntimeConfidence(ag, CONFIDENCE_DELTA_GOOD * 0.95);
        pushLastAction(ag.matchRuntime, 'goal');
      }
      L.push({ type: 'phase_change', payload: { from: 'LIVE', to: 'GOAL_RESTART', reason: 'goal' } });
      const net = worldToUiPercent(this.ballSys.state.x, this.ballSys.state.z);
      L.push({ type: 'ball_state', payload: { x: net.ux, y: net.uy, reason: 'post_goal_net' } });
      L.push({ type: 'possession_change', payload: { to: otherSide, reason: 'kickoff' } });
      const name = ag && this.shirtNumbers.get(ag.id) ? `#${this.shirtNumbers.get(ag.id)}` : pend.shooterId;
      pushSimEvent(
        this.simState,
        `${this.simState.minute}' — GOL! ${name} marca!`,
        scoringSide === 'home' ? 'goal_home' : 'goal_away',
      );
      this.simState.possession = otherSide;
      this.ballSys.setDeadAt(this.ballSys.state.x, this.ballSys.state.z);
      this.simState.carrierId = null;
      this.fsm.enterGoalRestart();
      this.structuralSys.beginGoalRestart(otherSide);
      return;
    }

    if (shotOutcome === 'miss') {
      if (ag) {
        pushLastAction(ag.matchRuntime, `shot_${shotOutcome}`);
        this.bumpRuntimeConfidence(ag, -CONFIDENCE_DELTA_BAD * 0.18);
      }
      this.assignBallToDefendingGoalkeeper(pend.defSide, pend.shooterSide, L, `shot_${shotOutcome}`);
      this.skipKickoffBallAssign = true;
      this.structuralSys.beginGoalRestart(pend.defSide, 'goal_kick_wide');
      this.fsm.enterGoalRestart();
      L.push({
        type: 'phase_change',
        payload: { from: 'LIVE', to: 'GOAL_RESTART', reason: 'shot_wide_reposition' },
      });
      pushSimEvent(
        this.simState,
        `${this.simState.minute}' — Bola para fora. Equipas na saída de bola; o GR coloca em jogo.`,
      );
      const missLine =
        strike === 'power'
          ? 'Remate forte para fora.'
          : strike === 'weak'
            ? 'Remate fraco — longe da baliza.'
            : 'Remate ao lado.';
      pushSimEvent(this.simState, `${this.simState.minute}' — ${missLine}`);
      return;
    }

    if (shotOutcome === 'block') {
      if (ag) {
        pushLastAction(ag.matchRuntime, `shot_${shotOutcome}`);
        this.bumpRuntimeConfidence(ag, CONFIDENCE_DELTA_GOOD * 0.08);
      }
      pushSimEvent(this.simState, `${this.simState.minute}' — Remate bloqueado — segunda bola viva.`);
      return;
    }

    if (ag) {
      pushLastAction(ag.matchRuntime, `shot_${shotOutcome}`);
      this.bumpRuntimeConfidence(ag, CONFIDENCE_DELTA_GOOD * 0.08);
    }
    const sk = pend.shotRes.saveKind ?? 'parry';
    if (sk === 'hold') {
      this.assignBallToDefendingGoalkeeper(pend.defSide, pend.shooterSide, L, 'shot_save_hold');
      const saveLine =
        strike === 'power'
          ? 'Guarda-redes segura remate forte.'
          : strike === 'weak'
            ? 'Guarda-redes segura remate fraco.'
            : 'Guarda-redes agarra o remate colocado.';
      pushSimEvent(this.simState, `${this.simState.minute}' — ${saveLine}`);
      return;
    }
    pushSimEvent(
      this.simState,
      `${this.simState.minute}' — Espalma! Bola viva na área — disputa segunda bola.`,
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

    for (const def of defenders) {
      const dist = Math.hypot(def.vehicle.position.x - carrier.vehicle.position.x, def.vehicle.position.z - carrier.vehicle.position.z);
      if (dist > 2.65) continue;

      const defSnap = this.toAgentSnapshot(def);
      const tickK = Math.floor(this.world.simTime * 60);
      const tackleRng = rngFromSeed(this.simState.simulationSeed, `tackle:${def.id}:${carrier.id}:${tickK}`);
      if (resolveTackle(defSnap, carrierSnap, dist, tackleRng)) {
        const foulRng = rngFromSeed(
          this.simState.simulationSeed,
          `tackle_foul:${def.id}:${carrier.id}:${tickK}`,
        );
        let foulP = TACKLE_FOUL_PROB_BASE + ((100 - defSnap.fairPlay) / 100) * TACKLE_FOUL_FAIRPLAY_WEIGHT;
        foulP = Math.min(TACKLE_FOUL_PROB_CAP, foulP);
        if (foulRng.nextUnit() < foulP) {
          const dangerous = foulRng.nextUnit() < 0.34;
          this.appendLiveDisciplineAfterFoul(L, foulRng, def, carrier.id, 'tackle', dangerous);
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
          );
          this.bumpRuntimeConfidence(def, CONFIDENCE_DELTA_GOOD * 0.2);
        }

        L.push({ type: 'possession_change', payload: { to: def.side, reason: 'tackle' } });

        this.simState.possession = def.side;
        this.ballSys.giveTo(def.id, def.vehicle.position.x, def.vehicle.position.z);
        this.simState.carrierId = def.id;

        this.bumpRuntimeConfidence(def, CONFIDENCE_DELTA_GOOD * 0.45);
        this.bumpRuntimeConfidence(carrier, -CONFIDENCE_DELTA_BAD * 0.5);
        pushLastAction(def.matchRuntime, 'tackle_won');
        pushLastAction(carrier.matchRuntime, 'tackle_lost');

        pushSimEvent(this.simState, `${this.simState.minute}' — Desarme limpo!`);
        this.applyTurnoverPlay(def, carrier.id, stealX, stealZ, 'tackle', L, manager, slotTargetFor);
        return;
      }
    }
  }

  private handleFlightCompletion(L: ReturnType<typeof createCausalBatch>, flight: BallFlight) {
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
      this.simState.carrierId = null;
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
      // #region agent log
      fetch('http://127.0.0.1:7569/ingest/813b0eb5-3788-4dcf-a782-9114cfd985ed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e8aa67' },
        body: JSON.stringify({
          sessionId: 'e8aa67',
          hypothesisId: 'D',
          location: 'TacticalSimLoop.ts:pickUpLooseBall_gk_heal',
          message: 'gkRestart heal path (loose ball while restart pending)',
          data: {
            simT: this.world.simTime,
            gkId: this.gkRestart.gkId,
            carrierId: this.simState.carrierId,
            ballMode: this.ballSys.state.mode,
            bx: this.ballSys.state.x,
            bz: this.ballSys.state.z,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
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

    const chasersPerTeam = 2;
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
          ? (this.liveRef?.homeFormationScheme ?? '4-3-3')
          : '4-3-3';
        const zModel = buildSlotZoneProfile(r.ag.slotId, r.ag.role, schemeCh, r.ag.side, halfChase);
        const zoneEng = resolveZoneEngagement(targetX, targetZ, zModel, { team: r.ag.side, half: halfChase });
        const anchor = slotTargetFor(r.ag);
        const anchorToBall = Math.hypot(anchor.x - targetX, anchor.z - targetZ);
        const sameStructuralBand = anchorToBall < 46;
        const veryClose = r.dist < 20;
        const fwd = forwardSlot(r.ag.slotId) || r.ag.slotId.startsWith('mc');
        if (r.dist >= 41) continue;
        if (zoneEng === 'structure' && r.dist > 22) continue;
        if (taken > 0 && !sameStructuralBand && !veryClose && !fwd) continue;

        let radii = tacticalRadiiFor(r.ag.role, r.ag.slotId);
        radii = scaleRadiiForZoneEngagement(radii, zoneEng, zModel.behaviorProfile);
        radii = {
          actionRadius: radii.actionRadius + 20,
          supportRadius: radii.supportRadius + 24,
          returnBias: radii.returnBias * 0.82,
          maxDeviationInAction: radii.maxDeviationInAction + 16,
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

    this.captureFrameStart();
    this.accumulator += Math.min(dt, 0.08);
    while (this.accumulator >= FIXED_DT) {
      this.integrateFixed(FIXED_DT, manager);
      this.accumulator -= FIXED_DT;
    }
    this.renderBlend = 1 - this.accumulator / FIXED_DT;
  }

  private lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
  }

  /** Returns the current simulation match state for syncing back to store. */
  getSimState(): SimMatchState {
    return this.simState;
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

    const bx = this.lerp(this.frameStartBall.x, this.world.ball.x, rb);
    const by = this.lerp(this.frameStartBall.y, this.world.ball.y, rb);
    const bz = this.lerp(this.frameStartBall.z, this.world.ball.z, rb);

    const buildPlayer = (a: AgentBinding): MatchTruthPlayer => {
      const prev = this.frameStartPlayers.get(a.id);
      const px = prev ? this.lerp(prev.x, a.vehicle.position.x, rb) : a.vehicle.position.x;
      const pz = prev ? this.lerp(prev.z, a.vehicle.position.z, rb) : a.vehicle.position.z;
      const vx = a.vehicle.velocity.x;
      const vz = a.vehicle.velocity.z;
      return {
        id: a.id,
        side: a.side,
        x: px,
        y: a.vehicle.position.y,
        z: pz,
        heading: Math.atan2(vx, vz),
        speed: a.vehicle.getSpeed(),
        role: a.role,
        shirtNumber: this.shirtNumbers.get(a.id),
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
    // #region agent log
    {
      const cid = this.simState.carrierId;
      const held = this.ballSys.state.mode === 'held';
      if (cid && (this.gkRestart !== null || held)) {
        const ag = [...this.homeAgents, ...this.awayAgents].find((a) => a.id === cid);
        if (ag) {
          this._dbgSnapTick += 1;
          const prev = this.frameStartPlayers.get(ag.id);
          const pxL = prev ? this.lerp(prev.x, ag.vehicle.position.x, rb) : ag.vehicle.position.x;
          const pzL = prev ? this.lerp(prev.z, ag.vehicle.position.z, rb) : ag.vehicle.position.z;
          const dSnap = Math.hypot(bx - pxL, bz - pzL);
          const sampleSnap = held && this._dbgSnapTick % 10 === 0;
          if (dSnap > 0.12 || this.gkRestart || sampleSnap) {
            fetch('http://127.0.0.1:7569/ingest/813b0eb5-3788-4dcf-a782-9114cfd985ed', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e8aa67' },
              body: JSON.stringify({
                sessionId: 'e8aa67',
                hypothesisId: 'E',
                location: 'TacticalSimLoop.ts:getSnapshot_ball_carrier_lerp',
                message: 'lerped ball vs lerped carrier in truth snapshot',
                data: {
                  simT: this.world.simTime,
                  dSnap,
                  rb,
                  bx,
                  bz,
                  pxL,
                  pzL,
                  carrierId: cid,
                  role: ag.role,
                  slotId: ag.slotId,
                  ballMode: this.ballSys.state.mode,
                  gkRestart: this.gkRestart?.gkId ?? null,
                  sampleSnap,
                },
                timestamp: Date.now(),
              }),
            }).catch(() => {});
          }
        }
      }
    }
    // #endregion
    snap.kits = {
      home: { primaryColor: '#E6DC23', secondaryColor: '#235E23', accent: '#F2F2F2' },
      away: { primaryColor: '#3358C7', secondaryColor: '#6B707A', accent: '#F24038' },
    };
    return snap;
  }
}
