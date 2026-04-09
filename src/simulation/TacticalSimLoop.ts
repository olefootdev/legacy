import type { LiveMatchSnapshot, PossessionSide, MatchEventEntry } from '@/engine/types';
import type { MatchTruthPhase, MatchTruthPlayer, CameraCue } from '@/bridge/matchTruthSchema';
import { Vehicle } from 'yuka';
import { MatchTruthWorld } from './MatchTruthWorld';
import { MatchPlayFsm } from '@/matchState/matchPlayFsm';
import { MatchEngine } from '@/match-engine/MatchEngine';
import { FORMATION_BASES } from '@/match-engine/formations/catalog';
import type { FormationSchemeId } from '@/match-engine/types';
import { defaultSlotOrder, slotToWorld } from '@/formation/layout433';
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
import { clampToPitch, FIELD_LENGTH, FIELD_WIDTH, uiPercentToWorld } from './field';
import { MatchSimulationEventBus } from '@/match/events/matchSimulationEventBus';
import {
  emitCausalMatchEvent,
  emitFromMatchEventEntry,
  emitPhaseIfChanged,
} from '@/match/events/emitFromEngineBridge';
import type { SimulationMatchPhase } from '@/match/events/matchSimulationContract';

import { MatchClock, type MatchClockPeriod } from './MatchClock';
import { BallSystem, type BallFlight } from './BallSystem';
import {
  createSimMatchState,
  pushSimEvent,
  appendSimCausal,
  getOrCreateStats,
  type SimMatchState,
} from './SimMatchState';
import {
  resolveTackle,
  nearestOpponentPressure01,
  type AgentSnapshot,
} from './InteractionResolver';
import {
  resolvePassForPossession,
  resolveCrossForPossession,
  resolveDribbleBeat,
  resolveShotForPossession,
  logActionResolverDebug,
} from './ActionResolver';
import { getSideAttackDir, getThird, getZoneTags } from '@/match/fieldZones';
import {
  SHOT_BUDGET_COOLDOWN_AFTER_FORCE_SEC,
  SHOT_BUDGET_NO_ATTEMPT_SEC,
  SHOOT_OFFENSIVE_STALL_SEC,
} from '@/match/shootDecisionTuning';
import { hashStringSeed } from '@/match/seededRng';
import { rngFromSeed } from '@/match/rngDraw';
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
  blendWalkRunMaxSpeed,
  clampVehicleMaxSpeed,
  fatigueSpeedMultiplier,
  locomotionRunSpeed,
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
import { createCausalBatch, type CausalMatchEvent } from '@/match/causal/matchCausalTypes';
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

interface AgentEx extends AgentBinding {
  decision: PlayerDecisionEngine;
  profile: PlayerProfile;
  matchAttrs: MatchPlayerAttributes;
  matchRuntime: PlayerMatchRuntime;
  cognitiveArchetype: MatchCognitiveArchetype;
  /** Smoothed walk↔run blend after steering intent (0 = walk cap, 1 = run cap). */
  locomotionRunBlendSmoothed: number;
}

interface TacticalManagerParams {
  tacticalMentality: number;
  defensiveLine: number;
  tempo: number;
  tacticalStyle?: TeamTacticalStyle;
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
    const order = defaultSlotOrder();
    const sig = live.homePlayers.map((p) => p.playerId).join(',');

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

      const base433 = FORMATION_BASES['4-3-3'];
      let awayNum = 1;
      for (const slot of order) {
        const b = base433[slot] ?? { nx: 0.35, nz: 0.5, line: 'mid' as const };
        const w = slotToWorld('away', { nx: b.nx, nz: b.nz });
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
      this.lastShotAttemptSimTime = { home: -1e9, away: -1e9 };
      this.lastShotBudgetCoolSimTime = { home: -1e9, away: -1e9 };
      this.shotBudgetArmed = { home: false, away: false };
      this.offensiveStallAccum = { home: 0, away: 0 };
      this.applyTurnoverDepth = 0;
      this.simState.simulationSeed =
        live.simulationSeed ?? hashStringSeed(`${live.homeShort}|${live.awayShort}|${live.homePlayers.length}`);
      this.matchClock.reset();
      this.matchClock.start();
      this.prevClockPeriod = null;
      this.ballSys.placeForKickoff();

      this.simState.possession = live.possession ?? 'home';
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
    const vRun = locomotionRunSpeed(vel01, fatigueMul);
    if (ctx === null) {
      ag.locomotionRunBlendSmoothed = 0.35;
    } else {
      ag.locomotionRunBlendSmoothed = smoothRunBlend(
        ag.locomotionRunBlendSmoothed,
        targetRunBlendFromSteering(ctx),
        fixedDt,
      );
    }
    ag.vehicle.maxSpeed = clampVehicleMaxSpeed(
      blendWalkRunMaxSpeed(vWalk, vRun, ag.locomotionRunBlendSmoothed),
    );
  }

  private bumpRuntimeConfidence(ag: AgentEx, delta: number): void {
    ag.matchRuntime.confidenceRuntime = Math.max(
      0.48,
      Math.min(1.28, ag.matchRuntime.confidenceRuntime + delta),
    );
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

    for (const [pid, v] of [...this.turnoverPassBlock.entries()]) {
      if (this.world.simTime >= v.until) this.turnoverPassBlock.delete(pid);
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
      pushSimEvent(this.simState, `45' — Início do 2.º tempo.`, 'whistle');
      this.matchEngine.reset();
      this.fsm.resumeLive();
      this.prevClockPeriod = 'second_half';
    } else if (period === 'first_half' || period === 'second_half') {
      this.prevClockPeriod = period;
    }

    this.simState.clockPeriod = period === 'first_half' ? 'first_half' : 'second_half';

    this.structuralSys.update(fixedDt);

    const fsmPhaseBefore = this.fsm.state.phase;
    this.fsm.tick(fixedDt);
    const fsmPhaseAfter = this.fsm.state.phase;

    if (fsmPhaseBefore === 'goal_restart' && fsmPhaseAfter === 'kickoff') {
      this.giveBallForKickoffRestart();
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

    let mode: AgentMode = this.fsm.isReforming() ? 'reforming' : manager.tacticalMentality > 78 ? 'pressing' : 'in_play';

    const phase = this.truthPhase(live);
    let presetHome: Map<string, { x: number; z: number }> | null = null;
    if (phase === 'throw_in' || phase === 'corner_kick' || phase === 'goal_kick') {
      presetHome = applyFormationPreset(phase, ballX, ballZ);
    }

    const homeSnaps = this.homeAgents.map((a) => this.toAgentSnapshot(a));
    const awaySnaps = this.awayAgents.map((a) => this.toAgentSnapshot(a));

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
    if (phase === 'goal_restart' && this.structuralSys.hasGoalRestart()) {
      structuralByPlayer = this.structuralSys.getGoalRestartPlayerTargets(this.homeAgents, this.awayAgents);
    } else if (
      this.structuralSys.hasSetPieceStructural()
      && (phase === 'throw_in' || phase === 'corner_kick' || phase === 'goal_kick')
    ) {
      structuralByPlayer = this.structuralSys.getSetPiecePlayerTargets(this.homeAgents, this.awayAgents);
    }

    const presetAway = presetHome ? mirrorPresetToAway(presetHome) : null;
    const slotTargetFor = (a: AgentEx): { x: number; z: number } => {
      if (structuralByPlayer?.has(a.id)) {
        const raw = structuralByPlayer.get(a.id)!;
        return clampTargetToRoleZone({ side: a.side, role: a.role }, raw.x, raw.z, tactx);
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
      return clampTargetToRoleZone({ side: a.side, role: a.role }, slotTarget.x, slotTarget.z, tactx);
    };

    this.turnoverCtx = { manager, slotTargetFor };

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
      mode, attackDirHome, manager, tactx, L, fixedDt, this.homeThreat, this.awayThreat,
    );
    this.runAgentDecisions(
      this.awayAgents, awaySnaps, homeSnaps, dynamicAwayForAgents,
      presetHome ? mirrorPresetToAway(presetHome) : null, structuralByPlayer,
      mode === 'pressing' ? 'in_play' : mode, attackDirAway, manager, tactx, L, fixedDt, this.awayThreat, this.homeThreat,
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
      this.directPlayersToChaseBall();
    }

    if (L.events.length > 0) {
      appendSimCausal(this.simState, [...L.events]);
      this.notePossessionEvents(L.events);
      for (const ev of L.events) {
        emitCausalMatchEvent(this.eventBus, ev, this.world.simTime);
        if (ev.type === 'shot_result' && ev.payload.outcome === 'goal') {
          this.cueQueue.push({ kind: 'goal_shake', intensity: 0.9, at: this.world.simTime });
        }
      }
    }

    rebuildNeighbors(this.homeAgents);
    rebuildNeighbors(this.awayAgents);
    this.syncBallVehicleFromWorld();
    const allV = this.allVehicles();

    const cid = this.simState.carrierId;
    for (const ag of this.homeAgents) {
      const near = Math.hypot(ag.vehicle.position.x - ballX, ag.vehicle.position.z - ballZ);
      this.tickAgentPhysiology(ag, fixedDt, near < 16 || ag.id === cid);
    }
    for (const ag of this.awayAgents) {
      const near = Math.hypot(ag.vehicle.position.x - ballX, ag.vehicle.position.z - ballZ);
      this.tickAgentPhysiology(ag, fixedDt, near < 16 || ag.id === cid);
    }

    const homeHasBall = this.simState.carrierId
      ? (this.findAgent(this.simState.carrierId)?.side === 'home')
      : false;
    const awayHasBall = this.simState.carrierId
      ? (this.findAgent(this.simState.carrierId)?.side === 'away')
      : false;

    // Pressing mode only applies when DEFENDING (team does NOT have the ball)
    const modeHome: AgentMode = this.fsm.isReforming() ? 'reforming'
      : (!homeHasBall && manager.tacticalMentality > 78) ? 'pressing'
      : 'in_play';
    const modeAway: AgentMode = this.fsm.isReforming() ? 'reforming' : 'in_play';

    for (const ag of this.homeAgents) {
      const dx = ag.vehicle.position.x - ballX;
      const dz = ag.vehicle.position.z - ballZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const others = allV.filter((v) => v !== ag.vehicle);
      applySteeringForPhase(ag, this.ballVehicle, others, modeHome, dist, homeHasBall);
    }
    for (const ag of this.awayAgents) {
      const dx = ag.vehicle.position.x - ballX;
      const dz = ag.vehicle.position.z - ballZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const others = allV.filter((v) => v !== ag.vehicle);
      applySteeringForPhase(ag, this.ballVehicle, others, modeAway, dist, awayHasBall);
    }

    for (const ag of this.homeAgents) {
      const dx = ag.vehicle.position.x - ballX;
      const dz = ag.vehicle.position.z - ballZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      this.applyVehicleSpeedFromAttrs(ag, fixedDt, {
        mode: modeHome,
        pursuitWeight: ag.pursuit.weight,
        arriveWeight: ag.arrive.weight,
        distToBall: dist,
        teamHasBall: homeHasBall,
        isCarrier: ag.id === cid,
      });
    }
    for (const ag of this.awayAgents) {
      const dx = ag.vehicle.position.x - ballX;
      const dz = ag.vehicle.position.z - ballZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      this.applyVehicleSpeedFromAttrs(ag, fixedDt, {
        mode: modeAway,
        pursuitWeight: ag.pursuit.weight,
        arriveWeight: ag.arrive.weight,
        distToBall: dist,
        teamHasBall: awayHasBall,
        isCarrier: ag.id === cid,
      });
    }

    for (const a of this.homeAgents) stepVehicle(a, fixedDt);
    for (const a of this.awayAgents) stepVehicle(a, fixedDt);

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
      let slotTarget: { x: number; z: number };
      if (structuralByPlayer?.has(ag.id)) {
        slotTarget = structuralByPlayer.get(ag.id)!;
      } else if (presetSlots && presetSlots.has(ag.slotId)) {
        slotTarget = presetSlots.get(ag.slotId)!;
      } else {
        const d = dynamicSlots.get(ag.slotId);
        slotTarget = d ?? { x: ag.vehicle.position.x, z: ag.vehicle.position.z };
      }
      const clamped = clampTargetToRoleZone({ side: ag.side, role: ag.role }, slotTarget.x, slotTarget.z, tactx);

      // Structural reorganisation: drive arrive directly (skip role clamp — targets are authored for the event).
      if (structuralByPlayer?.has(ag.id)) {
        const raw = structuralByPlayer.get(ag.id)!;
        const sx = Math.min(FIELD_LENGTH - 2, Math.max(2, raw.x));
        const sz = Math.min(FIELD_WIDTH - 2, Math.max(2, raw.z));
        setArriveTarget(ag, sx, sz, mode);
        continue;
      }

      const isCarrier = this.simState.carrierId === ag.id;
      const isReceiver = this.ballSys.state.mode === 'flight' && this.ballSys.state.flight?.targetPlayerId === ag.id;
      const selfSnap = this.toAgentSnapshot(ag);

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
      const passBlocklist =
        block && block.peerId && this.world.simTime < block.until ? [block.peerId] : undefined;

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
          setArriveTarget(ag, this.ballSys.state.flight.toX, this.ballSys.state.flight.toZ, 'in_play');
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
          setArriveTarget(ag, carryX, carryZ, 'in_play');
        }
        break;
      }
      case 'idle':
      default:
        // Should rarely reach here with the new engine, but ensure movement
        setArriveTarget(ag, slotTarget.x, slotTarget.z, mode);
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
        const passRes = resolvePassForPossession(baseSeed, tickK, selfSnap, opt, press01, oppSnaps);
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

        const speed = action.type === 'long_ball' || action.type === 'switch_play'
          ? 28 + selfSnap.passe * 0.15
          : 22 + selfSnap.passe * 0.12;

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
        pushLastAction(ag.matchRuntime, passRes.completed ? 'pass_ok' : 'pass_fail');
        this.bumpRuntimeConfidence(
          ag,
          passRes.completed ? CONFIDENCE_DELTA_GOOD * 0.28 : -CONFIDENCE_DELTA_BAD * 0.22,
        );
        break;
      }

      // Shooting
      case 'shoot':
      case 'shoot_long_range': {
        const longRange = action.type === 'shoot_long_range';
        const shotRes = resolveShotForPossession(
          baseSeed,
          tickK,
          selfSnap,
          attackDir,
          oppSnaps,
          zoneTags,
          longRange,
        );
        const shotOutcome = shotRes.outcome;
        const goalX = shotRes.goalX;
        const goalZ = shotRes.goalZ;
        const possBefore = this.simState.possession;

        L.push({
          type: 'shot_attempt',
          payload: {
            side: ag.side,
            shooterId: ag.id,
            zone: selfSnap.x > FIELD_LENGTH * 0.66 ? 'att' : selfSnap.x > FIELD_LENGTH * 0.33 ? 'mid' : 'def',
            minute: this.simState.minute,
            target: { x: (goalX / FIELD_LENGTH) * 100, y: (goalZ / FIELD_WIDTH) * 100 },
          },
        });

        L.push({
          type: 'shot_result',
          payload: { side: ag.side, shooterId: ag.id, outcome: shotOutcome },
        });

        logActionResolverDebug({
          playerId: ag.id,
          action: longRange ? 'shoot_long' : 'shoot',
          zoneTags,
          roll: shotRes.rollOnTarget,
          threshold: shotRes.pOnTarget,
          outcome: shotOutcome,
          possessionBefore: possBefore,
          possessionAfter: shotOutcome === 'goal' ? this.simState.possession : '',
          reason: shotRes.reason,
        });

        const stats = getOrCreateStats(this.simState, ag.id);
        stats.shots++;

        const tel = this.simState.shotTelemetry;
        tel.attempts++;
        if (shotOutcome === 'miss') tel.offTarget++;
        else tel.onTarget++;
        if (shotOutcome === 'goal') tel.goals++;
        if (shotOutcome === 'save') tel.saves++;
        this.consumeShotBudgetAfterAttempt(ag.side);

        if (shotOutcome === 'goal') {
          stats.goals++;
          const scoringSide = ag.side;
          const otherSide: PossessionSide = scoringSide === 'home' ? 'away' : 'home';

          this.bumpRuntimeConfidence(ag, CONFIDENCE_DELTA_GOOD * 0.95);
          pushLastAction(ag.matchRuntime, 'goal');

          L.push({ type: 'phase_change', payload: { from: 'LIVE', to: 'GOAL_RESTART', reason: 'goal' } });
          L.push({ type: 'ball_state', payload: { x: 50, y: 50, reason: 'post_goal_center' } });
          L.push({ type: 'possession_change', payload: { to: otherSide, reason: 'kickoff' } });

          const name = this.shirtNumbers.get(ag.id) ? `#${this.shirtNumbers.get(ag.id)}` : ag.id;
          pushSimEvent(this.simState, `${this.simState.minute}' — GOL! ${name} marca!`, scoringSide === 'home' ? 'goal_home' : 'goal_away');

          this.simState.possession = otherSide;
          this.ballSys.placeForKickoff();
          this.simState.carrierId = null;
          this.fsm.enterGoalRestart();
          this.structuralSys.beginGoalRestart(otherSide);
        } else {
          const defSide: PossessionSide = ag.side === 'home' ? 'away' : 'home';
          this.assignBallToDefendingGoalkeeper(defSide, ag.side, L, `shot_${shotOutcome}`);
          pushLastAction(ag.matchRuntime, `shot_${shotOutcome}`);
          this.bumpRuntimeConfidence(
            ag,
            shotOutcome === 'miss' ? -CONFIDENCE_DELTA_BAD * 0.18 : CONFIDENCE_DELTA_GOOD * 0.08,
          );
          if (shotOutcome === 'save' || shotOutcome === 'block') {
            pushSimEvent(this.simState, `${this.simState.minute}' — Remate ${shotOutcome === 'save' ? 'defendido' : 'bloqueado'}.`);
          }
        }
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
        setArriveTarget(ag, action.targetX, action.targetZ, 'pressing');
        break;
      }

      // Dribble / carry variants (baixo risco)
      case 'simple_carry':
      case 'cut_inside':
      case 'run_to_byline':
      case 'enter_box':
      case 'turn_on_marker': {
        setArriveTarget(ag, action.targetX, action.targetZ, 'in_play');
        break;
      }

      // Hold / shield
      case 'hold_ball':
      case 'shield_ball':
        break;

      // Retreat
      case 'retreat_reorganize':
        setArriveTarget(ag, action.targetX, action.targetZ, 'reforming');
        break;

      // Draw foul — slow down near opponent
      case 'draw_foul':
        break;

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
        setArriveTarget(ag, slotTarget.x, slotTarget.z, mode);
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

  private findGoalkeeper(side: PossessionSide): AgentEx | undefined {
    const team = side === 'home' ? this.homeAgents : this.awayAgents;
    return team.find((a) => a.slotId === 'gol' || a.role === 'gk') ?? team[0];
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

  private executeOffBallAction(
    ag: AgentEx,
    action: OffBallAction,
    slotTarget: { x: number; z: number },
    mode: AgentMode,
  ) {
    switch (action.type) {
      case 'press_carrier':
        setArriveTarget(ag, action.targetX, action.targetZ, 'pressing');
        break;
      case 'delay_press':
      case 'close_passing_lane':
      case 'cover_central':
      case 'recover_behind_ball':
      case 'defensive_cover':
      case 'mark_zone':
      case 'mark_man':
        setArriveTarget(ag, action.targetX, action.targetZ, 'in_play');
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
        setArriveTarget(ag, action.targetX, action.targetZ, 'in_play');
        break;
      case 'move_to_slot':
        setArriveTarget(ag, action.targetX, action.targetZ, mode);
        break;
      case 'idle':
      default:
        setArriveTarget(ag, slotTarget.x, slotTarget.z, mode);
        break;
    }
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

    const carrierSnap = this.toAgentSnapshot(carrier);
    const stealX = carrier.vehicle.position.x;
    const stealZ = carrier.vehicle.position.z;

    for (const def of defenders) {
      const dist = Math.hypot(def.vehicle.position.x - carrier.vehicle.position.x, def.vehicle.position.z - carrier.vehicle.position.z);
      if (dist > 2.5) continue;

      const defSnap = this.toAgentSnapshot(def);
      const tickK = Math.floor(this.world.simTime * 60);
      const tackleRng = rngFromSeed(this.simState.simulationSeed, `tackle:${def.id}:${carrier.id}:${tickK}`);
      if (resolveTackle(defSnap, carrierSnap, dist, tackleRng)) {
        const stats = getOrCreateStats(this.simState, def.id);
        stats.tackles++;

        L.push({ type: 'possession_change', payload: { to: def.side, reason: 'tackle' } });

        this.simState.possession = def.side;
        this.ballSys.giveTo(def.id, def.vehicle.position.x, def.vehicle.position.z);
        this.simState.carrierId = def.id;

        this.bumpRuntimeConfidence(def, CONFIDENCE_DELTA_GOOD * 0.45);
        this.bumpRuntimeConfidence(carrier, -CONFIDENCE_DELTA_BAD * 0.5);
        pushLastAction(def.matchRuntime, 'tackle_won');
        pushLastAction(carrier.matchRuntime, 'tackle_lost');

        pushSimEvent(this.simState, `${this.simState.minute}' — Desarme!`);
        this.applyTurnoverPlay(def, carrier.id, stealX, stealZ, 'tackle', L, manager, slotTargetFor);
        return;
      }
    }
  }

  private handleFlightCompletion(L: ReturnType<typeof createCausalBatch>, flight: BallFlight) {
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
    let best: AgentEx | null = null;
    let bestDist = 6;

    for (const a of [...this.homeAgents, ...this.awayAgents]) {
      const d = Math.hypot(a.vehicle.position.x - this.ballSys.state.x, a.vehicle.position.z - this.ballSys.state.z);
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
   * When ball is loose or in flight, direct the nearest players from
   * each team to run toward the ball so they can actually reach it.
   */
  private directPlayersToChaseBall() {
    const targetX = this.ballSys.state.flight
      ? this.ballSys.state.flight.toX
      : this.ballSys.state.x;
    const targetZ = this.ballSys.state.flight
      ? this.ballSys.state.flight.toZ
      : this.ballSys.state.z;

    const chasersPerTeam = 3;

    const rankAndChase = (team: AgentEx[]) => {
      const ranked = team
        .filter((a) => a.id !== this.simState.carrierId && a.role !== 'gk')
        .map((a) => ({
          ag: a,
          dist: Math.hypot(a.vehicle.position.x - targetX, a.vehicle.position.z - targetZ),
        }))
        .sort((a, b) => a.dist - b.dist);

      for (let i = 0; i < Math.min(chasersPerTeam, ranked.length); i++) {
        const r = ranked[i]!;
        if (r.dist < 35) {
          setArriveTarget(r.ag, targetX, targetZ, 'pressing');
        }
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
    snap.kits = {
      home: { primaryColor: '#E6DC23', secondaryColor: '#235E23', accent: '#F2F2F2' },
      away: { primaryColor: '#3358C7', secondaryColor: '#6B707A', accent: '#F24038' },
    };
    return snap;
  }
}
