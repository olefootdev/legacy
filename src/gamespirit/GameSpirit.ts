import type { PitchPlayerState, PitchPoint, PossessionSide } from '@/engine/types';
import { overallFromAttributes } from '@/entities/player';
import type { BallZone, SpiritContext, SpiritOutcome, ProposedAction, SpiritSnapshotMeta } from './types';
import { applyPositionKnowledgeBias } from '@/gamespirit/legacy/positionKnowledgeTypes';
import { PRE_GOAL_DURATION_MS, SECONDS_PER_TICK, type GoalBuildUp } from '@/engine/types';
import {
  adjustHomeShotWeights,
  causalOutcomeFromHomeShot,
  createGoalOverlay,
  DANGEROUS_FOUL_PROB,
  DEFAULT_HOME_SHOT_WEIGHTS,
  initialPenaltyState,
  patchAfterAwayShotWide,
  patchAfterHomeShot,
  penaltyOverlayForStage,
  PENALTY_FROM_FOUL_PROB,
  rollHomeShotLogicalOutcome,
  rollGkSaveSubtype,
  rollTackleOutcome,
} from './spiritStateMachine';
import * as T from './narrativeTemplates';
import { pickLine } from './narrationSeed';
import type { PlayerEntity } from '@/entities/types';
import { crowdSpiritFromSupport } from '@/systems/crowdSpirit';
import { createCausalBatch, type CausalMatchEvent } from '@/match/causal/matchCausalTypes';
import { normalizeStyle } from '@/tactics/playingStyle';
import { updateMomentum as updateMomentumFromTick } from '@/gamespirit/momentum';
import { weightedOverall, roleFromSlotId } from '@/match/positionWeights';
import { zoneAtUI, isBox, isFinalThird, isCreationZone, dangerToOppGoal01 } from '@/match/spatialZones';
import { applyContextModifiers } from '@/match/contextFactors';
import { FIELD_WIDTH, GOAL_MOUTH_HALF_WIDTH_M } from '@/simulation/field';
import { computeSituationalModifiers, type SituationalModifiers } from '@/gamespirit/situationalIntelligence';
import { doesLooseControl } from '@/behaviorAI/firstTouchErrors';
import {
  createTeamPressingState,
  detectPressingTrigger,
  activatePressingTrap,
  tickPressingTrap,
  isPressingTrapActive,
  type TeamPressingState,
} from '@/behaviorAI/pressingTrap';
import { evaluateTacticalFoul } from '@/behaviorAI/tacticalFoul';
import { getFatigueState } from '@/match/fatigueState';
import { agentShotBiasFromProfile } from '@/match/agentBias';
import type { AgentSnapshot } from '@/simulation/InteractionResolver';
import { resolveSkills, tickSkillCooldowns } from '@/skills/skillEngine';
import { enrichNarrative } from './contextualNarrative';
import { detectSpecialEvent, applySpecialEventEffect } from '@/match/specialEvents';
import { buildPlayerNarrativeProfile, buildSquadNarrativeProfiles } from '@/gamespirit/playerNarrativeProfile';
import { PlayerProgressionManager, SIGNATURE_MOVES, type SignatureMoveType } from '@/progression/playerProgression';
import {
  applyIntensityToShotChance,
  applyIntensityToDefense,
  getCounterAttackChance,
  getPressureIntensity,
  type TacticalIntensityLevel
} from '@/match/quickTacticalIntensity';

function dist(a: PitchPoint, b: PitchPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function zoneFromBallX(x: number): BallZone {
  if (x < 38) return 'def';
  if (x < 68) return 'mid';
  return 'att';
}

/** Alvo UI (0–100) junto à boca real da baliza — coerente com coreografia test2d. */
function spiritShotTargetUI(side: 'home' | 'away', shooter?: PitchPlayerState): PitchPoint {
  const halfUy = (GOAL_MOUTH_HALF_WIDTH_M / FIELD_WIDTH) * 100;
  // ângulo proxy: 0 = central, 1 = lateral extremo. Reduz janela e viesa pro canto curto.
  const lateralBias = shooter ? Math.min(1, Math.abs(shooter.y - 50) / 35) : 0;
  const usable = 0.88 * (1 - lateralBias * 0.55);
  const sideBias = shooter ? Math.sign(shooter.y - 50) * lateralBias * halfUy * 0.45 : 0;
  const y = 50 + sideBias + (Math.random() - 0.5) * (2 * halfUy * usable);
  if (side === 'home') return { x: 96.4 + Math.random() * 2.6, y };
  return { x: 1 + Math.random() * 2.6, y };
}

/** Remate com desfecho pleno (golo/defesa/bloqueio): só com bola na zona final (≥68 m no eixo 0–100). */
function homeMayRegisterShot(ctx: SpiritContext): boolean {
  if (ctx.possession !== 'home' || !ctx.onBall) return false;
  if (ctx.ballZone !== 'att') return false;
  const r = ctx.onBall.role;
  return r === 'attack' || r === 'mid';
}

function nearestTeammateDistance(onBall: PitchPlayerState | undefined, mates: PitchPlayerState[]): number {
  if (!onBall) return 50;
  let best = 1e9;
  for (const m of mates) {
    if (m.playerId === onBall.playerId) continue;
    const d = dist({ x: onBall.x, y: onBall.y }, { x: m.x, y: m.y });
    if (d < best) best = d;
  }
  return best > 1e8 ? 40 : best;
}

/**
 * Devolve o jogador da casa mais próximo da bola e a distância (UI 0–100).
 * Usado pra "snapar" a bola num jogador real depois de turnover/clear, evitando
 * que ela fique parada em zona vazia.
 */
function nearestHomeToBall(
  ball: PitchPoint,
  homePlayers: PitchPlayerState[] | undefined,
): { player: PitchPlayerState; dist: number } | null {
  if (!homePlayers || homePlayers.length === 0) return null;
  let best: { player: PitchPlayerState; dist: number } | null = null;
  for (const p of homePlayers) {
    const d = dist(ball, { x: p.x, y: p.y });
    if (!best || d < best.dist) best = { player: p, dist: d };
  }
  return best;
}

/**
 * Detecta se a bola caiu numa zona morta (longe de qualquer jogador OU encostada
 * nas linhas — fora do campo). Devolve um restart se for o caso, senão null.
 */
type OutOfPlayRestart =
  | { kind: 'throw_in'; awardedTo: 'home' | 'away'; ball: PitchPoint; zone: 'def' | 'mid' | 'att' }
  | { kind: 'goal_kick'; awardedTo: 'home' | 'away'; ball: PitchPoint }
  | { kind: 'corner_kick'; forSide: 'home' | 'away'; ball: PitchPoint };

function detectOutOfPlay(
  ball: PitchPoint,
  carrier: 'home' | 'away',
  homePlayers: PitchPlayerState[] | undefined,
): OutOfPlayRestart | null {
  // Linha lateral (saiu pelo Y).
  if (ball.y <= 4 || ball.y >= 96) {
    const zone: 'def' | 'mid' | 'att' = ball.x < 38 ? 'def' : ball.x < 68 ? 'mid' : 'att';
    const awardedTo: 'home' | 'away' = carrier === 'home' ? 'away' : 'home';
    return {
      kind: 'throw_in',
      awardedTo,
      zone,
      ball: { x: Math.min(98, Math.max(2, ball.x)), y: ball.y <= 4 ? 5 : 95 },
    };
  }
  // Linha de fundo defendida pela CASA (x próximo de 0).
  if (ball.x <= 3) {
    if (carrier === 'away') {
      // Atacante visitante chutou pra fora → tiro de meta da casa.
      return { kind: 'goal_kick', awardedTo: 'home', ball: { x: 6, y: 50 } };
    }
    // Casa cortou pra trás (rebote do zagueiro casa) → escanteio do visitante.
    return { kind: 'corner_kick', forSide: 'away', ball: { x: 1.5, y: ball.y < 50 ? 6 : 94 } };
  }
  // Linha de fundo defendida pelo VISITANTE (x próximo de 100).
  if (ball.x >= 97) {
    if (carrier === 'home') {
      // Atacante da casa chutou pra fora → tiro de meta do visitante.
      return { kind: 'goal_kick', awardedTo: 'away', ball: { x: 94, y: 50 } };
    }
    return { kind: 'corner_kick', forSide: 'home', ball: { x: 98.5, y: ball.y < 50 ? 6 : 94 } };
  }

  // Zona morta no meio (longe de todo jogador conhecido). Só tem dado da casa,
  // mas se a casa tem posse e o nearest > 12 dá pra arrastar a bola até ele.
  const near = nearestHomeToBall(ball, homePlayers);
  if (carrier === 'home' && near && near.dist > 12) {
    // Arrastar pro jogador casa mais próximo (pisa na bola).
    return null; // Tratado fora; caller usa snap.
  }
  return null;
}

function densityNearBall(ball: PitchPoint, mates: PitchPlayerState[], radius = 18): number {
  let c = 0;
  for (const m of mates) {
    if (dist(ball, { x: m.x, y: m.y }) < radius) c += 1;
  }
  return c;
}

function countOpponentsWithin(
  ball: PitchPoint,
  opps: PitchPlayerState[] | undefined,
  radius = 8,
): number {
  if (!opps) return 0;
  let c = 0;
  for (const o of opps) if (dist(ball, { x: o.x, y: o.y }) < radius) c += 1;
  return c;
}

function findFreeForwardTeammate(
  onBall: PitchPlayerState | undefined,
  mates: PitchPlayerState[] | undefined,
  opps: PitchPlayerState[] | undefined,
  side: 'home' | 'away',
): PitchPlayerState | null {
  if (!onBall || !mates) return null;
  const forwardSign = side === 'home' ? 1 : -1;
  let best: PitchPlayerState | null = null;
  let bestAdvance = 0;
  for (const m of mates) {
    if (m.playerId === onBall.playerId) continue;
    const advance = (m.x - onBall.x) * forwardSign;
    if (advance < 4) continue;
    const marked = (opps ?? []).some((o) => dist({ x: m.x, y: m.y }, { x: o.x, y: o.y }) < 4);
    if (marked) continue;
    if (advance > bestAdvance) { bestAdvance = advance; best = m; }
  }
  return best;
}

function pickAction(ctx: SpiritContext): ProposedAction {
  // Escanteio pendente — resolve cabeçada na hora, consome hint depois no tick.
  if (ctx.pendingCornerForSide === 'home' && ctx.possession === 'home') {
    return 'shot';
  }
  // Cobrança de falta pendente — força chute direto ao gol, não deixa tocar pra trás.
  if (ctx.pendingFreeKickForSide === 'home' && ctx.possession === 'home' && ctx.ballZone === 'att') {
    return 'shot';
  }
  // SmartField hint (high-confidence): prioriza decisão posicional vinda de
  // `getBestAction`. Mapa SmartField → Spirit:
  //   SHOOT/FREE_KICK_DIRECT → 'shot'
  //   PASS/CROSS             → 'progress'
  //   CLEAR                  → 'clear'
  //   PRESS                  → 'press'
  //   HOLD/RECOVER_*/DRIBBLE → cai no fluxo normal
  if (ctx.possession === 'home' && ctx.smartfieldActionHint) {
    const h = ctx.smartfieldActionHint;
    if (h === 'SHOOT' || h === 'FREE_KICK_DIRECT') return 'shot';
    if (h === 'PASS' || h === 'CROSS') return 'progress';
    if (h === 'CLEAR') return 'clear';
    if (h === 'PRESS') return 'press';
    // demais (HOLD/RECOVER_POSITION/DRIBBLE): segue heurística normal abaixo
  }
  const style = normalizeStyle(ctx.tacticalStyle);
  const losingHome = ctx.possession === 'home' && ctx.homeScore < ctx.awayScore;
  const highPress = ctx.tacticalMentality > 72;
  const deepDefense = ctx.ballZone === 'def';
  const isolated = ctx.nearestTeammateDist > 22;
  const crowded = ctx.homeDensityNearBall >= 3;
  const m = ctx.test2dTickModifiers;
  const st = ctx.live2dStagnationTicks ?? 0;

  // URGÊNCIA POR PLACAR/TEMPO: times perdendo nos minutos finais atacam mais
  const scoreDiff = ctx.homeScore - ctx.awayScore;
  const lateGame = ctx.minute >= 75;
  const desperateTime = ctx.minute >= 85;
  const urgencyByContext =
    (scoreDiff < 0 && desperateTime) ? 0.35 :  // Perdendo nos acréscimos → urgência máxima
    (scoreDiff < 0 && lateGame) ? 0.22 :       // Perdendo após 75' → urgência alta
    (scoreDiff < -1 && ctx.minute >= 65) ? 0.14 : // Perdendo por 2+ após 65' → urgência moderada
    (scoreDiff > 0 && lateGame) ? -0.18 :      // Vencendo no final → menos risco
    0;

  // FANTASY V6 (2026-06-02): fadiga entra na DECISÃO, não só na execução.
  // Portador exausto (>80%) prefere passe seguro a tentar chute / drible.
  // Antes: jogador a 95% decidia chutar igual a um fresco; só executava pior.
  // Agora: cansaço empurra recycle/progress sobre shot (reduz shotBias).
  const onBallFatigue = ctx.onBall?.fatigue ?? 0;
  const fatigueShotPenalty =
    onBallFatigue >= 90 ? -0.18 :  // Crítico: quase não arrisca
    onBallFatigue >= 80 ? -0.12 :  // Exausto: prefere passe
    onBallFatigue >= 70 ? -0.06 :  // Cansado: levemente mais conservador
    0;

  // Awareness local: adversários no raio 8 + colega livre adiantado.
  // FANTASY V3 FIX (2026-05-27): o proxy `nearbyOpponentDist` era calculado
  // como `dist(ball, mirrorAttack)` que dá 0 quando ball.x=50 (centro do
  // campo) → underPressure SEMPRE TRUE → recycle eterno em modo Quick.
  // Sem awayPlayers, assume SEM pressão (deixa o jogo fluir).
  const oppsNear = ctx.awayPlayers ? countOpponentsWithin(ctx.ball, ctx.awayPlayers, 8) : 0;
  const underPressure = ctx.awayPlayers ? oppsNear >= 2 : false;
  const freeFwd = findFreeForwardTeammate(ctx.onBall, ctx.homePlayers, ctx.awayPlayers, 'home');

  /** live2d: após N recycles seguidos, obrigar avanço (condução/passe longo). */
  if (ctx.possession === 'home' && st >= 2) {
    return 'progress';
  }
  if (ctx.possession === 'home' && st >= 1 && ctx.onBall?.role === 'def' && ctx.ballZone === 'def') {
    // Zagueiro: só recicla se realmente pressionado E sem colega livre adiantado.
    if (underPressure && !freeFwd) return 'recycle';
    return 'progress';
  }

  if (ctx.possession === 'away' && deepDefense && highPress) {
    if (!m) return 'press';
    // Pressing trap: se armadilha ativa, pressão é garantida (ignora gate aleatório).
    const simTime = ctx.minute * 60;
    tickPressingTrap(_homePressing, simTime);
    const trapBonus = isPressingTrapActive(_homePressing, simTime) ? 0.12 : 0;
    const carrierPressResist = ctx.onBallKnowledge ? (ctx.onBallKnowledge.traits.pressIntensity - 1) * 0.06 : 0;
    if (Math.random() < Math.min(0.96, 0.88 * m.awayPressMult + trapBonus - carrierPressResist)) return 'press';
  }
  if (ctx.possession === 'home' && ctx.ballZone === 'att' && (ctx.onBall?.role === 'attack' || ctx.onBall?.role === 'mid')) {
    if (isolated && ctx.crowdPressure.longPassStress > 1.05) return 'recycle';
    const momentumBias = (ctx.momentum?.home ?? 0) * 0.10;
    // Bias adicional por zona granular: dentro da área (+0.30) ou criativa (+0.12)
    // empurra a decisão pra chute. Resolve "tocava pra trás na cara do gol".
    const zi = ctx.ballZoneInfo;
    const zoneShotBias = zi
      ? (isBox(zi) ? 0.30 : 0) + (isCreationZone(zi) ? 0.12 : 0)
      : 0;
    const inDangerZone = zi ? (isBox(zi) || isCreationZone(zi)) : false;
    // Awareness bias: portador sob pressão E sem colega livre → chuta (evita recycle suicida).
    const awarenessShotBias = (underPressure && !freeFwd && inDangerZone) ? 0.20 : 0;
    // Inverso: portador livre + colega livre adiantado fora da box → passa em vez de chutar.
    const passOverShot = (!underPressure && freeFwd && zi && !isBox(zi)) ? -0.18 : 0;
    // DNA de lenda: riskTaking do portador empurra decisão de chute (0–2, neutro=1).
    const dnaRiskBias = ctx.onBallKnowledge
      ? (ctx.onBallKnowledge.traits.riskTaking - 1) * 0.10
      : 0;
    const shotBias =
      style.shootingProfile * 0.25 +
      style.riskTaking * 0.18 +
      (m?.shotInAttThirdBias ?? 0) +
      momentumBias +
      zoneShotBias +
      awarenessShotBias +
      passOverShot +
      dnaRiskBias +
      urgencyByContext +  // Urgência por placar/tempo
      fatigueShotPenalty; // Cansaço empurra pra passe seguro
    // FANTASY V5 (2026-05-27): 0.20 → 0.28 — V4 chutava demais em sequência.
    return Math.random() > 0.28 - shotBias ? 'shot' : 'progress';
  }
  // Build-up: só joga longo (clear) se realmente sem opção curta.
  // Urgência: quando perdendo no final, evita clear (prefere progress mesmo sem colega livre).
  // Traits do portador (positionKnowledge) escalam as probabilidades base.
  const pkTraits = ctx.onBallKnowledge?.traits;
  const clearThreshold = pkTraits ? Math.max(0.10, 0.22 - (pkTraits.offensiveRuns - 1) * 0.04) : 0.22;
  const progressThreshold = pkTraits ? Math.min(0.38, 0.24 + (pkTraits.offensiveRuns - 1) * 0.05) : 0.24;
  const recycleThreshold = pkTraits ? Math.max(0.14, 0.28 - (pkTraits.buildUpPreference - 1) * 0.04) : 0.28;
  if (ctx.possession === 'home' && style.buildUp > 0.72 && !freeFwd && urgencyByContext <= 0 && Math.random() < clearThreshold) return 'clear';
  if (ctx.possession === 'home' && style.verticality > 0.72 && freeFwd) return 'progress';
  if (ctx.possession === 'home' && style.verticality > 0.72 && Math.random() < progressThreshold) return 'progress';
  // Urgência: quando perdendo, reduz recycle (prefere avançar mesmo sob pressão moderada).
  if (ctx.possession === 'home' && style.verticality < 0.28 && !underPressure && urgencyByContext <= 0 && Math.random() < recycleThreshold) return 'recycle';
  /** Sem remate “milagre” do meio-campo: em desespero só remata quem já chegou à zona final. */
  if (ctx.possession === 'home' && losingHome && ctx.minute > 70) {
    // Urgência extrema: aceita chute mesmo sem estar tão aglomerado.
    const urgentShot = desperateTime && ctx.ballZone === 'att' && (ctx.onBall?.role === 'attack' || ctx.onBall?.role === 'mid');
    return (crowded || urgentShot) && ctx.ballZone === 'att' && (ctx.onBall?.role === 'attack' || ctx.onBall?.role === 'mid')
      ? 'shot'
      : 'progress';
  }
  if (ctx.possession === 'away' && ctx.ballZone === 'def') return 'clear';
  if (ctx.possession === 'home' && ctx.ballZone === 'mid') {
    if (freeFwd) return 'progress';
    // Urgência: quando perdendo no final, reduz recycle sob pressão (prefere arriscar).
    if (underPressure && urgencyByContext <= 0.14) return 'recycle';
    // FANTASY V3 (2026-05-27): bola PRECISA chegar à área. Antes 35% progress
    // → bola girava em mid 90% da partida (zero chutes). Agora 70% progress.
    const progressThreshold = urgencyByContext > 0 ? 0.20 : 0.30;
    if (Math.random() > progressThreshold) return 'progress';
  }
  // FANTASY V3: fallback default deve PROGREDIR mais que retroceder.
  // Antes: 28% progress / 72% recycle → bola fica parada.
  // Agora: 60% progress / 40% recycle quando sem colega livre.
  const base: ProposedAction = freeFwd ? 'progress' : (Math.random() > 0.40 ? 'progress' : 'recycle');

  // DNA de lenda: aplica pesos de posição sobre a decisão base (zero tokens, local).
  if (ctx.possession === 'home' && ctx.onBallKnowledge) {
    return applyPositionKnowledgeBias(base, ctx.onBallKnowledge, ctx.ballZone);
  }
  return base;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(Math.floor(seed * 9973)) % arr.length]!;
}

/** Pick a teammate different from `excludeId`, nearest to ball, for two-player interactions. */
function secondaryMate(ctx: SpiritContext, excludeId?: string): string | undefined {
  const others = (ctx.homePlayers ?? []).filter(
    (p) => p.playerId !== excludeId && p.name,
  );
  if (others.length === 0) return undefined;
  if (!ctx.ball) return others[0]!.name;
  let best = others[0]!;
  let bestD = 1e9;
  for (const o of others) {
    const d = Math.hypot(o.x - ctx.ball.x, o.y - ctx.ball.y);
    if (d < bestD) { bestD = d; best = o; }
  }
  return best.name;
}

const SEED_ACTION_MAP: Partial<Record<ProposedAction, string | string[]>> = {
  shot: ['shot_strong', 'long_shot'],
  progress: ['build_up', 'pass_long', 'wing_play', 'dribble_success'],
  recycle: ['pass_short', 'possession_switch'],
  press: ['pressure_high', 'tackle_clean', 'interception'],
  clear: 'clearance',
  counter: 'counter_attack',
};

function narrativeFor(
  action: ProposedAction,
  name: string,
  minute: number,
  _pressure: import('@/systems/crowdSpirit').CrowdSpiritPressure,
  homeShort: string,
  _zone: import('./types').BallZone,
  ctx?: SpiritContext,
): string {
  const mate = ctx ? secondaryMate(ctx, ctx.onBall?.playerId) : undefined;
  const profile = ctx?.onBallNarrativeProfile;

  // Enriquece o nome com traço de personalidade quando o perfil está disponível
  const richName = profile
    ? enrichNameWithProfile(name, profile, action, minute, ctx)
    : name;

  const sit = SEED_ACTION_MAP[action];
  if (sit) {
    const line = pickLine(sit, { min: minute, from: richName, to: mate, team: homeShort }, minute);
    if (line) return line;
  }
  switch (action) {
    case 'shot':
      return narrativeShotRich(minute, richName, profile);
    case 'progress':
      return narrativeProgressRich(minute, richName, mate, profile);
    case 'recycle':
      return T.recycle({ min: minute, passer: richName, receiver: mate });
    case 'press':
      return T.press({ min: minute, team: homeShort, recoverer: mate });
    case 'clear':
      return narrativeClearRich(minute, mate, profile);
    case 'counter':
      return narrativeCounterRich(minute, richName, profile);
    default:
      return T.recycle({ min: minute, passer: richName });
  }
}

/** Enriquece o nome com contexto do perfil narrativo para frases mais ricas. */
function enrichNameWithProfile(
  name: string,
  profile: import('@/gamespirit/playerNarrativeProfile').PlayerNarrativeProfile,
  action: ProposedAction,
  minute: number,
  ctx?: SpiritContext,
): string {
  const { trait, mood, isLegacy } = profile;

  // Lenda sempre ganha destaque
  if (isLegacy) return `${name} (lenda)`;

  // Momentos decisivos com sangue frio
  if (trait === 'sangue_frio' && (action === 'shot' || action === 'counter') && minute > 70) {
    return `${name}, gelado`;
  }
  // Finalizador em posição de chute
  if (trait === 'finalizador' && action === 'shot') {
    return `${name}, o finalizador`;
  }
  // Em chamas — qualquer ação
  if (mood === 'em_chamas') {
    return `${name} (em chamas)`;
  }
  // Destruidor recuperando bola
  if (trait === 'destruidor' && action === 'press') {
    return `${name}, o destruidor`;
  }
  // Criativo em progressão
  if (trait === 'criativo' && action === 'progress') {
    return `${name}, com visão`;
  }
  // Guerreiro cansado mas lutando
  if (trait === 'guerreiro' && mood === 'pressionado') {
    return `${name}, no limite`;
  }

  return name;
}

function narrativeShotRich(
  minute: number,
  name: string,
  profile?: import('@/gamespirit/playerNarrativeProfile').PlayerNarrativeProfile | null,
): string {
  if (!profile) return T.shot({ min: minute, shooter: name });
  const { trait, attrs, mood } = profile;

  if (trait === 'finalizador' && attrs.finalizacao >= 82) {
    return `${minute}' — ${name} finaliza com a precisão que é sua marca!`;
  }
  if (trait === 'sangue_frio') {
    return `${minute}' — ${name} arrisca sem hesitar — frieza total!`;
  }
  if (trait === 'criativo' && attrs.tatico >= 75) {
    return `${minute}' — ${name} cria o espaço do nada e finaliza!`;
  }
  if (mood === 'em_chamas') {
    return `${minute}' — ${name} está em chamas — chuta com tudo!`;
  }
  if (mood === 'pressionado' && attrs.mentalidade >= 70) {
    return `${minute}' — ${name} cansado, mas não desiste — finaliza!`;
  }
  return T.shot({ min: minute, shooter: name });
}

function narrativeProgressRich(
  minute: number,
  name: string,
  mate: string | undefined,
  profile?: import('@/gamespirit/playerNarrativeProfile').PlayerNarrativeProfile | null,
): string {
  if (!profile) return T.progress({ min: minute, carrier: name, receiver: mate });
  const { trait, attrs } = profile;

  if (trait === 'criativo' && attrs.passe >= 78) {
    return mate
      ? `${minute}' — ${name} enxerga o corredor e lança ${mate} em profundidade!`
      : `${minute}' — ${name} conduz com visão e abre o jogo!`;
  }
  if (trait === 'guerreiro' && attrs.velocidade >= 75) {
    return mate
      ? `${minute}' — ${name} não para de correr — serve ${mate} no espaço!`
      : `${minute}' — ${name} avança com determinação!`;
  }
  if (trait === 'imprevisivel') {
    return mate
      ? `${minute}' — ${name} surpreende todo mundo e acha ${mate}!`
      : `${minute}' — ${name} conduz de forma imprevisível!`;
  }
  return T.progress({ min: minute, carrier: name, receiver: mate });
}

function narrativeClearRich(
  minute: number,
  mate: string | undefined,
  profile?: import('@/gamespirit/playerNarrativeProfile').PlayerNarrativeProfile | null,
): string {
  if (!profile) return T.clear({ min: minute, defender: mate });
  const { trait } = profile;

  if (trait === 'destruidor') {
    return `${minute}' — ${profile.name} corta com autoridade — perigo eliminado!`;
  }
  if (trait === 'experiente') {
    return `${minute}' — ${profile.name} lê a jogada antes de todo mundo e afasta!`;
  }
  return T.clear({ min: minute, defender: mate });
}

function narrativeCounterRich(
  minute: number,
  name: string,
  profile?: import('@/gamespirit/playerNarrativeProfile').PlayerNarrativeProfile | null,
): string {
  if (!profile) return T.counter({ min: minute, leader: name });
  const { trait, attrs } = profile;

  if (trait === 'finalizador' && attrs.velocidade >= 72) {
    return `${minute}' — ${name} explode em velocidade no contra-ataque!`;
  }
  if (trait === 'guerreiro') {
    return `${minute}' — ${name} lidera a transição — motor que não para!`;
  }
  if (trait === 'sangue_frio') {
    return `${minute}' — ${name} conduz o contra-ataque com frieza cirúrgica!`;
  }
  return T.counter({ min: minute, leader: name });
}

export function buildSpiritContext(input: {
  minute: number;
  homeScore: number;
  awayScore: number;
  possession: PossessionSide;
  ball: PitchPoint;
  onBall?: PitchPlayerState;
  crowdSupport: number;
  tacticalMentality: number;
  tacticalStyle?: import('@/tactics/playingStyle').TeamTacticalStyle;
  opponentStrength: number;
  awayMentality?: number;
  homeRoster: PlayerEntity[];
  homePlayers: PitchPlayerState[];
  homeShort?: string;
  recentFeedLines?: string[];
  awayRoster?: { id: string; num: number; name: string; pos: string }[];
  /**
   * Visitante sintético com atributos individuais. Em Quick Mode é montado
   * por `synthesizeAwayPitchPlayers` (atributos derivados de OVR+pos); em
   * Live2D vem do `awayPitchPlayers` real. Habilita awareness de marcação
   * adversária, GK individualizado e pGoalAway baseado no artilheiro.
   */
  awayPlayers?: PitchPlayerState[];
  test2dTickModifiers?: SpiritContext['test2dTickModifiers'];
  live2dStagnationTicks?: number;
  motorTelemetryTail?: SpiritContext['motorTelemetryTail'];
  penaltyCooldownTicks?: number;
  momentum?: SpiritContext['momentum'];
  pendingCornerForSide?: SpiritContext['pendingCornerForSide'];
  pendingFreeKickForSide?: SpiritContext['pendingFreeKickForSide'];
  smartfieldActionHint?: SpiritContext['smartfieldActionHint'];
  tacticalIntensity?: TacticalIntensityLevel;
  situational?: SpiritContext['situational'];
  /**
   * Fase 3 — Fatores Contextuais. Quando presente, os 4 inputs do peso da
   * partida (homeTeamAvg, crowdSupport, avgHomeFatigue, tacticalMentality)
   * passam por applyContextModifiers antes de irem ao SpiritContext.
   */
  contextModifiers?: import('@/match/contextFactors').MatchContextModifiers;
  /** Fase 1 — RNG seedável. Propagado pro SpiritContext (consumo é futuro). */
  rng?: import('../../shared/gamespirit/SpiritRng').SpiritRng;
}): SpiritContext {
  // Overall do time ponderado por role (atacantes pesam ataque, zagueiros pesam defesa).
  // Usa `homePlayers` (MatchPlayerAttributes) quando disponível; fallback pro overall do roster.
  const avg = (() => {
    if (input.homePlayers.length > 0) {
      let sum = 0;
      for (const hp of input.homePlayers) {
        const role = roleFromSlotId(hp.slotId);
        sum += weightedOverall(hp.attributes, role);
      }
      return sum / input.homePlayers.length;
    }
    if (input.homeRoster.length === 0) return 78;
    return input.homeRoster.reduce((s, p) => s + overallFromAttributes(p.attrs), 0) / input.homeRoster.length;
  })();
  const avgHomeFatigueRaw =
    input.homePlayers.length === 0
      ? 48
      : input.homePlayers.reduce((s, p) => s + p.fatigue, 0) / input.homePlayers.length;
  const mirrorAttack: PitchPoint = { x: 100 - input.ball.x, y: input.ball.y };
  const ballZone = zoneFromBallX(input.ball.x);
  const nearestTeammateDist = nearestTeammateDistance(input.onBall, input.homePlayers);
  const homeDensityNearBall = densityNearBall(input.ball, input.homePlayers);

  // ── Fase 3: aplica fatores contextuais nos 4 inputs de peso da partida ────
  // homeTeamAvg ← homeAdvantage × squadDepletion
  // crowdSupport ← homeAdvantage × derbyIntensity
  // avgHomeFatigue ← /restMultiplier
  // tacticalMentality ← × importance
  // Quando ausente, valores ficam idênticos ao histórico (motor neutro).
  const ctxApplied = input.contextModifiers
    ? applyContextModifiers(
        {
          homeTeamAvg: avg,
          crowdSupport: input.crowdSupport,
          avgHomeFatigue: avgHomeFatigueRaw,
          tacticalMentality: input.tacticalMentality,
        },
        input.contextModifiers,
      )
    : null;

  const homeTeamAvgFinal = ctxApplied?.homeTeamAvg ?? avg;
  const crowdSupportFinal = ctxApplied?.crowdSupport ?? input.crowdSupport;
  const avgHomeFatigue = ctxApplied?.avgHomeFatigue ?? avgHomeFatigueRaw;
  const tacticalMentalityFinal = ctxApplied?.tacticalMentality ?? input.tacticalMentality;

  const crowdPressure = crowdSpiritFromSupport(crowdSupportFinal);

  // Extrai positionKnowledge do jogador com a bola (quando em posse da casa)
  const onBallEntity =
    input.possession === 'home' && input.onBall
      ? input.homeRoster.find((p) => p.id === input.onBall!.playerId)
      : undefined;
  const onBallKnowledge = onBallEntity?.positionKnowledge;
  // AgentProfile do portador — só injeta se a flag estiver ativa (default true).
  // Permite alternar "jogador simples vs agente" sem mudar engine.
  const onBallAgentProfile =
    onBallEntity && onBallEntity.agentProfileEnabled !== false
      ? (onBallEntity.agentProfile ?? null)
      : null;

  // LegacyDNA: soma o team_booster dos legacies titulares (em `homePlayers`).
  let legacyTeamBooster: Record<string, number> | undefined;
  for (const pitch of input.homePlayers) {
    const entity = input.homeRoster.find((p) => p.id === pitch.playerId);
    if (!entity?.isLegacy || !entity.legacyTeamBooster) continue;
    if (!legacyTeamBooster) legacyTeamBooster = {};
    for (const [k, v] of Object.entries(entity.legacyTeamBooster)) {
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      legacyTeamBooster[k] = (legacyTeamBooster[k] ?? 0) + v;
    }
  }

  // Perfis narrativos — extraídos dos agentes, zero tokens
  const squadNarrativeProfiles = buildSquadNarrativeProfiles(input.homePlayers, input.homeRoster);
  const onBallNarrativeProfile = input.onBall
    ? (squadNarrativeProfiles.get(input.onBall.playerId) ??
       buildPlayerNarrativeProfile(input.onBall, input.homeRoster.find((e) => e.id === input.onBall!.playerId)))
    : null;

  return {
    minute: input.minute,
    homeScore: input.homeScore,
    awayScore: input.awayScore,
    possession: input.possession,
    onBall: input.onBall,
    ball: input.ball,
    crowdSupport: crowdSupportFinal,
    tacticalMentality: tacticalMentalityFinal,
    tacticalStyle: input.tacticalStyle,
    opponentStrength: input.opponentStrength,
    awayMentality: input.awayMentality,
    awayPlayers: input.awayPlayers,
    homeTeamAvg: homeTeamAvgFinal,
    nearbyOpponentDist: dist(input.ball, mirrorAttack),
    ballZone,
    ballZoneInfo: zoneAtUI(input.ball.x, input.ball.y, input.possession),
    nearestTeammateDist,
    homeDensityNearBall,
    crowdPressure,
    recentFeedLines: input.recentFeedLines,
    avgHomeFatigue,
    homeShort: input.homeShort,
    homePlayers: input.homePlayers,
    awayRoster: input.awayRoster,
    test2dTickModifiers: input.test2dTickModifiers,
    live2dStagnationTicks: input.live2dStagnationTicks,
    motorTelemetryTail: input.motorTelemetryTail,
    onBallKnowledge,
    onBallAgentProfile,
    penaltyCooldownTicks: input.penaltyCooldownTicks,
    legacyTeamBooster,
    momentum: input.momentum,
    pendingCornerForSide: input.pendingCornerForSide,
    pendingFreeKickForSide: input.pendingFreeKickForSide,
    smartfieldActionHint: input.smartfieldActionHint,
    tacticalIntensity: input.tacticalIntensity,
    onBallNarrativeProfile,
    squadNarrativeProfiles,
    situational: input.situational,
    contextModifiers: input.contextModifiers,
    rng: input.rng,
  };
}

function postGoalRestart(L: ReturnType<typeof createCausalBatch>, ball: PitchPoint, nextPossession: PossessionSide) {
  L.push({
    type: 'phase_change',
    payload: { from: 'LIVE', to: 'GOAL_RESTART', reason: 'goal' },
  });
  L.push({
    type: 'ball_state',
    payload: { ...ball, reason: 'post_goal_center' },
  });
  L.push({
    type: 'possession_change',
    payload: { to: nextPossession, reason: 'kickoff' },
  });
  L.push({
    type: 'phase_change',
    payload: { from: 'GOAL_RESTART', to: 'KICKOFF_PENDING', reason: 'await_restart' },
  });
  L.push({
    type: 'phase_change',
    payload: { from: 'KICKOFF_PENDING', to: 'LIVE', reason: 'play_resumes' },
  });
}

/**
 * Detecta contra-ataque: posse no arranque do tick != lado que marcou,
 * OU último causal inclui turnover/recuperação recente para o marcador.
 */
function detectCounter(
  possessionAtTickStart: PossessionSide,
  scorerSide: PossessionSide,
  recentCausal: readonly CausalMatchEvent[],
): boolean {
  if (possessionAtTickStart !== scorerSide) return true;
  const last4 = recentCausal.slice(-4);
  for (const e of last4) {
    if (e.type === 'possession_change') {
      const p = e.payload as { to?: PossessionSide; reason?: string } | undefined;
      if (!p) continue;
      const reason = p.reason ?? '';
      if (
        p.to === scorerSide &&
        /turnover|recovery|press_win|high_press/.test(reason)
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Narrativa de gol enriquecida com o perfil do marcador.
 * Usa traço, humor, arquétipo cognitivo e contexto da partida para frases únicas.
 */
function buildRichGoalNarrative(
  minute: number,
  scorerName: string,
  profile: import('@/gamespirit/playerNarrativeProfile').PlayerNarrativeProfile,
  buildUp: GoalBuildUp,
  ctx: SpiritContext,
): string | null {
  const { trait, mood, cognitiveArchetype, attrs, isLegacy, cardArchetype } = profile;
  const scoreDiff = ctx.homeScore - ctx.awayScore; // antes do gol
  const isDecisive = minute > 75 && Math.abs(scoreDiff) <= 1;
  const isComeback = scoreDiff < 0;
  const isCounter = buildUp === 'counter';

  // Lenda marcando
  if (isLegacy) {
    return `${minute}' — A LENDA FALA! ${scorerName} mostra por que é diferente — GOOOOOL!`;
  }

  // Gol decisivo nos minutos finais
  if (isDecisive && trait === 'sangue_frio') {
    return `${minute}' — Nos momentos que importam, ${scorerName} não treme. GOOOOOL!`;
  }
  if (isDecisive && mood === 'em_chamas') {
    return `${minute}' — ${scorerName} está em chamas e decide o jogo! GOOOOOL!`;
  }
  if (isDecisive) {
    return `${minute}' — GOOOOOL! ${scorerName} decide nos minutos finais!`;
  }

  // Virada / empate
  if (isComeback) {
    if (trait === 'guerreiro') {
      return `${minute}' — ${scorerName} não desiste nunca — GOOOOOL! O time acredita!`;
    }
    return `${minute}' — GOOOOOL! ${scorerName} empata — a partida está viva!`;
  }

  // Contra-ataque
  if (isCounter) {
    if (trait === 'finalizador' && attrs.velocidade >= 72) {
      return `${minute}' — Velocidade e frieza — ${scorerName} explode no contra-ataque! GOOOOOL!`;
    }
    return `${minute}' — Transição fulminante! ${scorerName} não perdoa — GOOOOOL!`;
  }

  // Por arquétipo cognitivo
  if (cognitiveArchetype === 'finalizador') {
    return `${minute}' — ${scorerName} estava esperando esse momento. GOOOOOL — instinto puro!`;
  }
  if (cognitiveArchetype === 'criador' && attrs.tatico >= 75) {
    return `${minute}' — ${scorerName} criou e finalizou — inteligência total! GOOOOOL!`;
  }
  if (cognitiveArchetype === 'executor') {
    return `${minute}' — ${scorerName} executou com perfeição — GOOOOOL!`;
  }

  // Por traço
  if (trait === 'imprevisivel') {
    return `${minute}' — Ninguém esperava! ${scorerName} surpreende todo mundo — GOOOOOL!`;
  }
  if (trait === 'agressivo' && attrs.fisico >= 75) {
    return `${minute}' — Na força e na raça — ${scorerName} empurra para o gol! GOOOOOL!`;
  }

  // Carta especial
  if (cardArchetype === 'meme') {
    return `${minute}' — ATÉ ELE! ${scorerName} marca e a torcida vai à loucura! GOOOOOL!`;
  }
  if (cardArchetype === 'novo_talento') {
    return `${minute}' — O jovem ${scorerName} mostra que veio para ficar! GOOOOOL!`;
  }

  return null; // fallback para o sistema padrão
}

interface CommitGoalInput {
  scorerSide: PossessionSide;
  minute: number;
  buildUp: GoalBuildUp;
  scorerName: string;
  homeShort: string;
  awayShort: string;
  /** Variante textual: post_in, penalty, etc. */
  variant?: 'post_in' | 'keeper_error';
  nowMs: number;
  /** Batch de eventos causais já em construção. */
  L: ReturnType<typeof createCausalBatch>;
  shooterId: string;
  ctx: SpiritContext;
}

/**
 * Ponto único para todo golo no `gameSpiritTick`.
 * Retorna fragmentos para compor o `SpiritOutcome` final.
 */
function commitGoal(input: CommitGoalInput): {
  narrative: string;
  goalFor: PossessionSide;
  goalScorerPlayerId: string;
  goalBuildUp: GoalBuildUp;
  threatBar01: number;
  spiritMeta: SpiritSnapshotMeta;
  ball: PitchPoint;
  nextPossession: PossessionSide;
} {
  const { scorerSide, minute, buildUp, scorerName, homeShort, awayShort, variant, nowMs, L, ctx } = input;

  const nextPossession: PossessionSide = scorerSide === 'home' ? 'away' : 'home';
  const ball: PitchPoint = { x: 50, y: 50 };

  postGoalRestart(L, ball, nextPossession);

  const threat01Target = scorerSide === 'home' ? 0.98 : 0.02;

  const gTeam = scorerSide === 'home' ? homeShort : awayShort;
  const gParams = { min: minute, from: scorerName, team: gTeam };
  const profile = ctx.onBallNarrativeProfile;

  let narrative: string;
  if (variant === 'post_in') {
    narrative = pickLine('goal_rebound', gParams, minute)
      ?? T.goalPostIn({ min: minute, scorer: scorerName });
  } else if (variant === 'keeper_error') {
    narrative = `${minute}' — Falha clamorosa do goleiro! ${scorerName} aproveita e empurra para o gol.`;
  } else {
    // Narrativa de gol enriquecida com perfil do marcador
    const richGoalNarrative = profile && scorerSide === 'home'
      ? buildRichGoalNarrative(minute, scorerName, profile, buildUp, ctx)
      : null;

    narrative = richGoalNarrative
      ?? pickLine(['goal_simple', 'goal_beautiful'], gParams, minute)
      ?? (scorerSide === 'home'
        ? T.goalPositional({ min: minute, scorer: scorerName })
        : T.goalAwayPositional({ min: minute, scorer: scorerName, team: awayShort }));
  }

  const { overlay, spiritMomentumClamp01 } = createGoalOverlay({
    nowMs: nowMs + PRE_GOAL_DURATION_MS,
    narrativeLine: narrative,
    scorerSide,
  });

  return {
    narrative,
    goalFor: scorerSide,
    goalScorerPlayerId: input.shooterId,
    goalBuildUp: buildUp,
    threatBar01: threat01Target,
    spiritMeta: {
      spiritPhase: 'celebration_goal',
      spiritOverlay: overlay,
      spiritMomentumClamp01,
      spiritBuildupGkTicksRemaining: 0,
      preGoalHint: {
        side: scorerSide,
        threat01Target,
        startedAtMs: nowMs,
        durationMs: PRE_GOAL_DURATION_MS,
      },
    },
    ball,
    nextPossession,
  };
}

// Estado de pressing compartilhado entre ticks (módulo-nível, reset por partida via resetPressingState).
const _homePressing: TeamPressingState = createTeamPressingState('home');
const _awayPressing: TeamPressingState = createTeamPressingState('away');

/** Reseta o estado de pressing (chamar no início de cada partida). */
export function resetPressingState(): void {
  Object.assign(_homePressing, createTeamPressingState('home'));
  Object.assign(_awayPressing, createTeamPressingState('away'));
}

/** Ciclo: contexto → decisão → consequência → narrativa + log causal (A1–A3). */
export function gameSpiritTick(
  ctx: SpiritContext,
  awayShort: string,
  causalSeqStart: number,
  nowMs: number = Date.now(),
): SpiritOutcome {
  const L = createCausalBatch(ctx.minute, causalSeqStart);
  tickSkillCooldowns();

  if (ctx.possession === 'home' && !ctx.onBall) {
    const nb = { x: 44 + Math.random() * 12, y: 30 + Math.random() * 40 };
    L.push({
      type: 'possession_change',
      payload: { to: 'away', reason: 'no_home_carrier' },
    });
    L.push({
      type: 'ball_state',
      payload: { ...nb, reason: 'turnover_reorganize' },
    });
    return {
      narrative: pickLine('possession_switch', { min: ctx.minute, team: ctx.homeShort ?? 'Casa' }, ctx.minute)
        ?? T.noCarrierRecycle({ min: ctx.minute, team: ctx.homeShort ?? 'Casa' }),
      action: 'recycle',
      nextPossession: 'away',
      ball: nb,
      causalEvents: [...L.events],
    };
  }

  /**
   * Falta perigosa: usa awareness espacial (SmartField) — não só `ballZone === 'att'`.
   * `isFinalThird` cobre attacking_*; `isCreationZone` casa creation_* (zona criativa);
   * `isBox` casa box_* / six_yard_* (área); `dangerToOppGoal01` modula prob de pênalti.
   */
  const ballZi = ctx.ballZoneInfo;
  const inAttackingArea = ballZi
    ? isFinalThird(ballZi) || isBox(ballZi) || isCreationZone(ballZi)
    : ctx.ballZone === 'att';
  const danger01 = ballZi ? dangerToOppGoal01(ctx.ball.x, ctx.ball.y, 'home') : 0.5;
  // Perfil do defensor mais próximo: fairPlay alto reduz, aggression alto aumenta.
  // Sem ctx.awayPlayers, mult fica neutro (1.0).
  const nearestDefender = (ctx.awayPlayers ?? [])
    .map((p) => ({ p, d: dist(ctx.ball, { x: p.x, y: p.y }) }))
    .sort((a, b) => a.d - b.d)[0]?.p;
  // ── Inteligência Situacional: modifica probabilidades baseado no contexto ──
  const sitMods: SituationalModifiers = ctx.situational
    ? computeSituationalModifiers(ctx.situational)
    : { goalChanceMult: 1, foulChanceMult: 1, penaltyChanceMult: 1, homeMomentumBoost: 0, awayMomentumBoost: 0 };

  const fairPlay = (nearestDefender?.attributes as any)?.fairPlay ?? 60;
  const aggression = (nearestDefender?.attributes as any)?.aggression ?? 50;
  const profileMult = Math.max(0.55, Math.min(1.65, 1 + (aggression - 50) / 100 - (fairPlay - 60) / 120));
  // FANTASY V6 (2026-06-02): mentalidade do visitante puxa prob de falta perigosa.
  // Time bunker (vencendo no final) marca mais limpo; time agressivo dá pancada.
  const awayMentFoulMult = 1 + ((ctx.awayMentality ?? 50) - 50) / 200; // 0.85..1.18
  // Boost da prob de falta perigosa quando bola está mais perto do gol. Aumentado 67%: 0.6 → 1.0
  let dangerousFoulProbAdj = DANGEROUS_FOUL_PROB * (1 + danger01 * 1.0) * profileMult * sitMods.foulChanceMult * awayMentFoulMult;
  // SkillEngine — DEFEND: zagueiro habilidoso reduz prob da falta (tackle limpo).
  if (nearestDefender) {
    const defendRes = resolveSkills({
      player: nearestDefender,
      type: 'DEFEND',
      zone: ctx.ballZoneInfo,
    });
    if (defendRes.fired) dangerousFoulProbAdj *= (1 - defendRes.finalEffect);
  }
  if (
    ctx.possession === 'home' &&
    inAttackingArea &&
    ctx.onBall &&
    !(ctx.penaltyCooldownTicks && ctx.penaltyCooldownTicks > 0) &&
    Math.random() < dangerousFoulProbAdj
  ) {
    // Se a bola está dentro da área (box ou six-yard), todo foul vira pênalti.
    const insideBox = ballZi ? isBox(ballZi) : false;
    const toPenalty = insideBox || Math.random() < PENALTY_FROM_FOUL_PROB * sitMods.penaltyChanceMult;
    const takerName = ctx.onBall.name;
    if (toPenalty) {
      L.push({
        type: 'phase_change',
        payload: { from: 'LIVE', to: 'PENALTY' as 'LIVE', reason: 'foul_in_box' },
      });
      const penaltyTakerId = ctx.onBall!.playerId;
      return {
        narrative: pickLine('foul_hard', { min: ctx.minute, from: takerName, to: takerName, team: ctx.homeShort ?? 'Casa' }, ctx.minute)
          ?? T.foulPenalty({ min: ctx.minute, fouled: takerName }),
        action: 'recycle',
        nextPossession: ctx.possession,
        ball: { ...ctx.ball },
        causalEvents: [...L.events],
        spiritMeta: {
          spiritPhase: 'penalty',
          penalty: initialPenaltyState('home', takerName, penaltyTakerId),
          spiritOverlay: penaltyOverlayForStage(
            'banner',
            takerName,
            ctx.homeShort ?? 'Casa',
            awayShort,
            nowMs,
            2000,
          ),
        },
      };
    }
    return {
      narrative: pickLine(['foul_soft', 'free_kick'], { min: ctx.minute, from: takerName, to: takerName, team: ctx.homeShort ?? 'Casa' }, ctx.minute)
        ?? T.foulFreeKick({ min: ctx.minute, fouled: takerName }),
      action: 'recycle',
      nextPossession: ctx.possession,
      ball: {
        x: Math.min(88, ctx.ball.x + 4 + Math.random() * 6),
        y: Math.min(78, Math.max(22, ctx.ball.y + (Math.random() * 10 - 5))),
      },
      causalEvents: [...L.events],
      spiritMeta: {
        spiritPhase: 'set_piece',
        // Hint: próximo tick deve resolver em chute direto, não em recycle.
        pendingFreeKickForSide: 'home',
      },
    };
  }

  let action = pickAction(ctx);
  if (action === 'shot' && ctx.possession === 'home' && !homeMayRegisterShot(ctx)) {
    action = 'progress';
  }
  const name = ctx.possession === 'home' ? ctx.onBall?.name ?? ctx.homeShort ?? 'Casa' : awayShort;
  let narrative = narrativeFor(action, name, ctx.minute, ctx.crowdPressure, ctx.homeShort ?? 'Casa', ctx.ballZone, ctx);
  let next: PossessionSide = ctx.possession;
  let ball: PitchPoint = { ...ctx.ball };
  let goalFor: PossessionSide | undefined;
  let goalScorerPlayerId: string | undefined;
  let goalBuildUp: GoalBuildUp | undefined;
  let threatBar01: number | undefined;

  const cp = ctx.crowdPressure;
  const homeStat =
    ctx.possession === 'home' && ctx.onBall
      ? {
          playerId: ctx.onBall.playerId,
          passesOk: 0,
          passesAttempt: 0,
          tackles: 0,
          km: 0.02 + Math.random() * 0.05,
        }
      : undefined;

  const legacyBooster = ctx.legacyTeamBooster ?? {};
  const legacyAttack01 = (legacyBooster.attack_pct ?? 0) / 100;
  const legacyDefense01 = (legacyBooster.defense_pct ?? 0) / 100;
  const legacyMorale01 = (legacyBooster.morale ?? 0) / 100;
  // BUG 1 fix: shotSkill agora é dominado pela finalização INDIVIDUAL do batedor
  // (peso 65%) — antes usava só média do time, fazendo todo mundo chutar com
  // a mesma nota. Atributos individuais não influenciavam o resultado.
  // Mistura com média do time (25%) pra preservar efeito de força coletiva,
  // mais um toque de confiança (10%) que reflete momentum mental.
  const shooterFin01 = (ctx.onBall?.attributes?.finalizacao ?? 60) / 100;
  const shooterConf01 = (ctx.onBall?.attributes?.confianca ?? 60) / 100;
  const teamAvg01 = ctx.homeTeamAvg / 100;
  const shotSkill = Math.min(
    1,
    shooterFin01 * 0.65 + teamAvg01 * 0.25 + shooterConf01 * 0.10 + legacyAttack01,
  );
  const errorTax = Math.max(0, cp.errorPenalty - legacyDefense01 * 0.5 + (ctx.nearestTeammateDist > 26 ? 0.04 : 0));
  const supportBoost = cp.supportBoost + legacyMorale01;
  let spiritMeta: SpiritSnapshotMeta | undefined;
  let lastShotPreview: SpiritSnapshotMeta['lastShotPreview'] = null;
  const consumedCorner = ctx.pendingCornerForSide === 'home' && ctx.possession === 'home' && action === 'shot';
  const consumedFreeKick = ctx.pendingFreeKickForSide === 'home' && ctx.possession === 'home' && action === 'shot';

  if (ctx.possession === 'home') {
    const shooterId = ctx.onBall!.playerId;
    if (action === 'shot') {
      homeStat!.passesAttempt += 1;
      const fromCorner = ctx.pendingCornerForSide === 'home';
      const fromFreeKick = ctx.pendingFreeKickForSide === 'home';
      L.push({
        type: 'shot_attempt',
        payload: {
          side: 'home',
          shooterId,
          zone: ctx.ballZone,
          minute: ctx.minute,
          target: spiritShotTargetUI('home', ctx.onBall),
          ...(fromCorner ? { strike: 'header' as const } : fromFreeKick ? { strike: 'placed' as const } : {}),
        },
      });

      // SkillEngine: resolve skill apropriada (SHOOT/HEADER/FREEKICK) — máx 1 por evento.
      const shotSkillType = fromCorner ? 'HEADER' : fromFreeKick ? 'FREEKICK' : 'SHOOT';
      const skillRes = ctx.onBall
        ? resolveSkills({
            player: ctx.onBall,
            type: shotSkillType,
            zone: ctx.ballZoneInfo,
            legacyTeamBooster: ctx.legacyTeamBooster,
          })
        : null;

      // Fase 2 — Core Gameplay #3: Detecta eventos especiais raros
      const specialEvent = ctx.onBall ? detectSpecialEvent('shot', ctx.onBall, ctx) : null;

      // Fadiga real do PORTADOR (não média do time): aplica attrMultiplier
      // ao shotSkill efetivo. Atacante a 95% renderá ~85% num chute;
      // a tabela alinhada à UI mata o ghost antigo de `attrMultiplier`.
      const shooterFatigue = ctx.onBall?.fatigue ?? 0;
      const fatMul = getFatigueState(shooterFatigue).attrMultiplier;
      // AgentProfile bias: jogador com DNA rico (campeão tokenizado) ganha
      // boost proporcional à `criticalProfile.finishingConfidence`. Sem profile
      // ou flag off → bias neutro (1.0).
      const agentBias = agentShotBiasFromProfile(ctx.onBallAgentProfile);
      const adjustedShotSkill = Math.min(
        1,
        (skillRes ? shotSkill * skillRes.modifier : shotSkill) * fatMul * agentBias,
      );
      // FANTASY V6 (2026-06-02): defesa adversária individualizada modula xG.
      // Cada defensor visitante (def/gk) dentro de raio 22 da bola contribui
      // (marcacao + fisico*0.4) / 100 × decaimento_distância. Soma normalizada
      // para [0,1]. Antes: chute em cima do Araújo = chute em cima de zagueiro
      // de várzea, contanto que o OVR do clube fosse parecido.
      let awayDefensePress01: number | undefined;
      if (ctx.awayPlayers && ctx.awayPlayers.length > 0) {
        const ballPt = { x: ctx.ball.x, y: ctx.ball.y };
        let pressSum = 0;
        let coverContributors = 0;
        for (const opp of ctx.awayPlayers) {
          if (opp.role !== 'def' && opp.role !== 'gk' && opp.role !== 'mid') continue;
          const d = dist(ballPt, { x: opp.x, y: opp.y });
          if (d > 22) continue;
          const proximity = Math.max(0, 1 - d / 22);
          const marc = (opp.attributes?.marcacao ?? 55) / 100;
          const phys = (opp.attributes?.fisico ?? 55) / 100;
          const tat = (opp.attributes?.tatico ?? 55) / 100;
          const defenderQuality = marc * 0.55 + phys * 0.25 + tat * 0.20;
          pressSum += defenderQuality * proximity;
          coverContributors += proximity;
        }
        // Normaliza por "cobertura efetiva". 1 defensor elite colado = ~0.8;
        // 2 defensores médios cobrindo = ~0.7; ninguém perto = 0.
        const denominator = Math.max(0.8, coverContributors);
        awayDefensePress01 = Math.min(1, pressSum / denominator);
      }

      // GK adversário individualizado: extrai do roster sintético. Skill =
      // mistura de mentalidade (reflexos) + tatico (posicionamento) + fisico
      // (alcance). Quando ausente, cai pro gkFactor01 (OVR do clube).
      let awayGkSkill01: number | undefined;
      const awayGk = ctx.awayPlayers?.find((p) => p.role === 'gk');
      if (awayGk?.attributes) {
        const mental = (awayGk.attributes.mentalidade ?? 60) / 100;
        const tat = (awayGk.attributes.tatico ?? 60) / 100;
        const phys = (awayGk.attributes.fisico ?? 60) / 100;
        awayGkSkill01 = Math.min(1, mental * 0.5 + tat * 0.3 + phys * 0.2);
      }

      const weights = adjustHomeShotWeights(DEFAULT_HOME_SHOT_WEIGHTS, {
        shotSkill01: adjustedShotSkill,
        zoneAtt: ctx.ballZone === 'att',
        zoneMid: ctx.ballZone === 'mid',
        denseNearBall: ctx.homeDensityNearBall >= 4,
        supportBoost,
        gkFactor01: ctx.opponentStrength / 120,
        errorTax,
        awayDefensePress01,
        awayGkSkill01,
      });

      // Inteligência situacional: boost na chance de gol
      if (sitMods.goalChanceMult !== 1) {
        weights.goal *= sitMods.goalChanceMult;
        weights.post_in *= sitMods.goalChanceMult;
      }

      // Aplica bônus de evento especial (bicicleta, bomba, etc.)
      if (specialEvent?.effect?.xGBonus) {
        weights.goal = applySpecialEventEffect(specialEvent, weights.goal);
        weights.post_in = applySpecialEventEffect(specialEvent, weights.post_in);
      }

      // META-PROGRESSÃO: Signature Moves
      // Verifica se jogador tem moves desbloqueados e aplica xGBoost
      let usedSignatureMove: SignatureMoveType | null = null;
      if (ctx.onBall) {
        const progression = PlayerProgressionManager.getProgression(ctx.onBall.playerId);

        // Filtra moves desbloqueados (apenas verifica se estão desbloqueados, sem validação de atributos)
        const availableMoves = progression.unlockedMoves.filter((moveId) => {
          // Verifica apenas se o move está desbloqueado
          return progression.unlockedMoves.includes(moveId);
        });

        // 15% chance de usar signature move se disponível
        if (availableMoves.length > 0 && Math.random() < 0.15) {
          // Escolhe move aleatório dos disponíveis
          usedSignatureMove = availableMoves[Math.floor(Math.random() * availableMoves.length)]!;
          const move = SIGNATURE_MOVES[usedSignatureMove];

          // Aplica xGBoost do move
          weights.goal *= move.xGBoost;
          weights.post_in *= move.xGBoost;

          // Registra uso
          PlayerProgressionManager.recordMoveUsage(ctx.onBall.playerId, usedSignatureMove);

          // Adiciona ao log causal
          L.push({
            type: 'signature_move_used',
            payload: {
              playerId: ctx.onBall.playerId,
              playerName: ctx.onBall.name,
              moveId: usedSignatureMove,
              moveName: move.name,
              xGBoost: move.xGBoost,
              minute: ctx.minute,
            },
          });
        }
      }

      // Cabeçada de escanteio: +18% xG se físico do cabeceador ≥ 75 (mandante alto);
      // sempre sobrescreve zona pra att e adiciona bônus fixo por bola parada.
      if (fromCorner) {
        const physHigh = (ctx.onBall?.attributes?.fisico ?? 50) >= 75;
        const headerBonus = physHigh ? 1.18 : 1.08;
        weights.goal *= headerBonus;
        weights.post_in *= headerBonus;
      }
      // Cobrança de falta: batedor com finalização alta coloca no canto (+xG).
      // Barreira reduz ángulo: +save weight levemente.
      if (fromFreeKick) {
        const finHigh = (ctx.onBall?.attributes?.finalizacao ?? 50) >= 78;
        const fkBonus = finHigh ? 1.22 : 1.06;
        weights.goal *= fkBonus;
        weights.post_in *= fkBonus;
        weights.save *= 1.12; // barreira aumenta chance de GK pegar
        weights.block *= 0.6; // menos bloqueio (barreira, não adversário solto)
      }
      const homeOnPitch = Math.max(0, ctx.homePlayers?.length ?? 11);
      const homeNumericRatio = Math.max(0.55, homeOnPitch / 11);
      weights.goal *= homeNumericRatio;
      weights.post_in *= homeNumericRatio;

      // TACTICAL INTENSITY: Aplica modificadores baseados na tática escolhida
      if (ctx.tacticalIntensity) {
        const baseGoalChance = weights.goal / (weights.goal + weights.save + weights.block + weights.wide + weights.miss_far);
        const modifiedChance = applyIntensityToShotChance(baseGoalChance, ctx.tacticalIntensity);
        const intensityMultiplier = modifiedChance / Math.max(0.01, baseGoalChance);
        weights.goal *= intensityMultiplier;
        weights.post_in *= intensityMultiplier;

        // Bônus defensivo reduz chances do adversário (aplicado em defesas)
        const defenseBonus = applyIntensityToDefense(1.0, ctx.tacticalIntensity);
        weights.save *= defenseBonus;
        weights.block *= defenseBonus;
      }

      // FIX H: momentum alimenta xG. Time dominando (momentum >+25) ganha
      // boost no chute; time apagado (momentum <-25) tem chute mais nervoso.
      // Magnitude moderada (±18%) pra não dominar finalização individual.
      const momHomeRaw = ctx.momentum?.home ?? 0;
      if (Math.abs(momHomeRaw) > 8) {
        const momBoost = Math.max(-0.18, Math.min(0.18, momHomeRaw / 100 * 0.7));
        weights.goal *= 1 + momBoost;
        weights.post_in *= 1 + momBoost;
        if (momBoost < 0) {
          // Time apagado: GK adversário vê mais bolas
          weights.save *= 1 + Math.abs(momBoost) * 0.5;
        }
      }

      // Radical transparency: agrega em 3 buckets pra barra de preview.
      const sumW = Math.max(
        0.0001,
        weights.goal + weights.post_in + weights.save + weights.block + weights.wide + weights.post_out + weights.miss_far,
      );
      lastShotPreview = {
        side: 'home',
        ts: nowMs,
        probs: {
          goal: (weights.goal + weights.post_in) / sumW,
          save: weights.save / sumW,
          out: (weights.block + weights.wide + weights.post_out + weights.miss_far) / sumW,
        },
      };
      let logical = rollHomeShotLogicalOutcome(Math.random(), weights);
      /** Rede de segurança: golo só com bola na zona final (coerente com buildup / 2D). */
      if ((logical === 'goal' || logical === 'post_in') && ctx.ballZone !== 'att') {
        logical = 'wide';
      }
      const causalOut = causalOutcomeFromHomeShot(logical);
      L.push({
        type: 'shot_result',
        payload: { side: 'home', shooterId, outcome: causalOut },
      });

      const yNorm = Math.random();

      if (logical === 'goal' || logical === 'post_in') {
        const isCounter = detectCounter(ctx.possession, 'home', [...L.events]);
        const gol = commitGoal({
          scorerSide: 'home',
          minute: ctx.minute,
          buildUp: isCounter ? 'counter' : 'positional',
          scorerName: ctx.onBall?.name ?? ctx.homeShort ?? 'Casa',
          homeShort: ctx.homeShort ?? 'Casa',
          awayShort,
          variant: logical === 'post_in' ? 'post_in' : undefined,
          nowMs,
          L,
          shooterId,
          ctx,
        });
        goalFor = gol.goalFor;
        goalScorerPlayerId = gol.goalScorerPlayerId;
        narrative = gol.narrative;
        ball = gol.ball;
        next = gol.nextPossession;
        spiritMeta = gol.spiritMeta;
        goalBuildUp = gol.goalBuildUp;
        threatBar01 = gol.threatBar01;
      } else if (logical === 'block') {
        const patch = patchAfterHomeShot(logical, yNorm);
        L.push({
          type: 'ball_state',
          payload: { ...patch.ball, reason: 'defensive_clearance' },
        });
        // 35% de bloqueios viram escanteio (em vez de posse pro rival). Mantém narrativa do block.
        const isCorner = Math.random() < 0.35;
        if (isCorner) {
          L.push({ type: 'corner_kick', payload: { minute: ctx.minute, side: 'home' } });
          next = 'home';
        } else {
          L.push({ type: 'possession_change', payload: { to: 'away', reason: 'after_block' } });
          next = patch.possession;
        }
        narrative = pickLine('shot_blocked', { min: ctx.minute, from: ctx.onBall?.name ?? 'Atacante' }, ctx.minute)
          ?? T.shotBlock({ min: ctx.minute, shooter: ctx.onBall?.name ?? 'Atacante' });
        ball = patch.ball;
        spiritMeta = {
          spiritPhase: patch.spiritPhase,
          spiritBuildupGkTicksRemaining: patch.spiritBuildupGkTicksRemaining,
          pendingCornerForSide: isCorner ? 'home' : null,
        };
      } else if (logical === 'save') {
        // Crítico do goleiro: defende, falha (gol), espalma pra frente ou pra escanteio.
        // FANTASY V6: prefere skill individualizada do GK (reflexos + posicionamento)
        // sobre o OVR do clube. GK ruim erra mais; GK elite quase nunca falha.
        const gkSkill01 = awayGkSkill01 ?? Math.min(1, Math.max(0, ctx.opponentStrength / 100));
        // Fadiga do GK também conta (>70% amplifica erros). Quick mode: GK
        // adversário não acumula fadiga, então 0; live2D pode passar real.
        const gkFatigue01 = (awayGk?.fatigue ?? 0) / 100;
        const subtype = rollGkSaveSubtype(Math.random(), gkSkill01, gkFatigue01);
        const shooterName = ctx.onBall?.name ?? 'Atacante';

        if (subtype === 'error_goal') {
          // Falha do GK — vira gol da casa com narração própria.
          const isCounter = detectCounter(ctx.possession, 'home', [...L.events]);
          const gol = commitGoal({
            scorerSide: 'home',
            minute: ctx.minute,
            buildUp: isCounter ? 'counter' : 'positional',
            scorerName: shooterName,
            homeShort: ctx.homeShort ?? 'Casa',
            awayShort,
            variant: 'keeper_error',
            nowMs,
            L,
            shooterId,
            ctx,
          });
          goalFor = gol.goalFor;
          goalScorerPlayerId = gol.goalScorerPlayerId;
          narrative = gol.narrative;
          ball = gol.ball;
          next = gol.nextPossession;
          spiritMeta = gol.spiritMeta;
          goalBuildUp = gol.goalBuildUp;
          threatBar01 = gol.threatBar01;
        } else if (subtype === 'parry_corner') {
          // Espalma pra fora da linha de fundo → escanteio.
          const patch = patchAfterHomeShot(logical, yNorm);
          L.push({
            type: 'ball_state',
            payload: { ...patch.ball, reason: 'keeper_parry_corner' },
          });
          // Bola volta pra casa no canto pra executar o escanteio.
          L.push({ type: 'possession_change', payload: { to: 'home', reason: 'after_save_corner' } });
          narrative = `${ctx.minute}' — O goleiro espalma com as pontas dos dedos para escanteio! Boa chance para ${shooterName}.`;
          next = 'home';
          ball = { x: 95, y: Math.random() < 0.5 ? 8 : 92 };
          spiritMeta = {
            spiritPhase: 'set_piece',
            spiritBuildupGkTicksRemaining: 0,
          };
        } else if (subtype === 'parry_forward') {
          // Espalma pra frente — rebote, casa pega a sobra perto da área.
          L.push({
            type: 'ball_state',
            payload: { x: 82, y: 50, reason: 'keeper_parry_forward' },
          });
          L.push({ type: 'possession_change', payload: { to: 'home', reason: 'after_save_rebound' } });
          narrative = `${ctx.minute}' — O goleiro espalma para frente, a bola fica viva na área — rebote perigoso para ${ctx.homeShort ?? 'Casa'}!`;
          next = 'home';
          ball = { x: 82, y: 50 };
          spiritMeta = {
            spiritPhase: 'open_play',
            spiritBuildupGkTicksRemaining: 0,
          };
        } else {
          // hold — comportamento anterior.
          const patch = patchAfterHomeShot(logical, yNorm);
          L.push({
            type: 'ball_state',
            payload: { ...patch.ball, reason: 'keeper_save' },
          });
          L.push({ type: 'possession_change', payload: { to: 'away', reason: 'after_save' } });
          narrative = pickLine('shot_save', { min: ctx.minute, from: shooterName }, ctx.minute)
            ?? T.shotSave({ min: ctx.minute, shooter: shooterName });
          next = patch.possession;
          ball = patch.ball;
          spiritMeta = {
            spiritPhase: patch.spiritPhase,
            spiritBuildupGkTicksRemaining: patch.spiritBuildupGkTicksRemaining,
          };
        }
      } else {
        const patch = patchAfterHomeShot(logical, yNorm);
        L.push({
          type: 'ball_state',
          payload: { ...patch.ball, reason: 'shot_wide_goal_kick' },
        });
        L.push({ type: 'possession_change', payload: { to: 'away', reason: 'after_shot_wide' } });
        narrative = pickLine('shot_out', { min: ctx.minute, from: ctx.onBall?.name ?? 'Atacante' }, ctx.minute)
          ?? T.shotWide({ min: ctx.minute, shooter: ctx.onBall?.name ?? 'Atacante', recoverer: awayShort });
        next = patch.possession;
        ball = patch.ball;
        spiritMeta = {
          spiritPhase: patch.spiritPhase,
          spiritBuildupGkTicksRemaining: patch.spiritBuildupGkTicksRemaining,
        };
        if (logical === 'wide' || logical === 'post_out' || logical === 'miss_far') {
          homeStat!.passesOk += 1;
        }
      }
    } else if (action === 'progress') {
      homeStat!.passesOk += 1;
      homeStat!.passesAttempt += 1;
      // FANTASY V3 (2026-05-27): lossChance era 0.14 + tax → bola perdia
      // 50% das vezes e voltava pra zona mid. Reduzido pra 0.07 + tax (cap 0.25).
      let lossChance = Math.min(0.25, 0.07 + errorTax * 0.30 + (ctx.crowdPressure.longPassStress - 1) * 0.05);
      if (ctx.test2dTickModifiers && ctx.possession === 'home') {
        lossChance *= ctx.test2dTickModifiers.progressLossMult;
      }
      // FANTASY V3: pushX em mid aumentado pra GARANTIR chegada à zona att.
      // Mid antes 8-22 → 14-28 (média 21, chega à zona att em ~2 progress)
      const pushX =
        ctx.ballZone === 'mid'
          ? 14 + Math.random() * 14
          : ctx.ballZone === 'def'
            ? 8 + Math.random() * 14
            : 4 + Math.random() * 10;
      ball = {
        x: Math.min(90, ctx.ball.x + pushX),
        y: Math.min(82, Math.max(18, ctx.ball.y + (Math.random() * 12 - 6))),
      };
      L.push({
        type: 'ball_state',
        payload: { ...ball, reason: 'progress_carry' },
      });

      // Eventos discretos de drible (estatísticas pós-jogo) — ~30% dos progress viram dribble_attempt.
      const carrierDrible = ctx.onBall?.attributes?.drible ?? 50;
      const dribbleUrge = 0.22 + Math.max(0, (carrierDrible - 55) / 200); // 22% base, até ~45% em Driblador top
      if (Math.random() < dribbleUrge && ctx.onBall?.playerId) {
        const trapPenalty = isPressingTrapActive(_awayPressing, ctx.minute * 60) ? 0.08 : 0;
        const succ = Math.random() < 0.38 + (carrierDrible - 50) / 200 - trapPenalty; // drible>=90 → ~58% sucesso; pressing trap -8%
        L.push({
          type: 'dribble_attempt',
          payload: {
            minute: ctx.minute,
            carrierId: ctx.onBall.playerId,
            carrierSide: 'home',
            defenderId: null,
            success: succ,
          },
        });
      }

      // Perda de posse: usa firstTouchErrors para modular por técnica do portador.
      // Velocidade estimada da bola em condução: ~8 m/s base.
      const carrierTechnique = ctx.onBall?.attributes?.drible ?? 50;
      const lostControl = doesLooseControl(carrierTechnique, 8, Math.random.bind(Math));
      if (lostControl || Math.random() < lossChance * 0.6) {
        next = 'away';
        // Perda de posse ativa pressing trap do adversário (passe ruim = trigger).
        const simTime = ctx.minute * 60;
        const trigger = detectPressingTrigger(
          lostControl ? 0.2 : lossChance,
          true,
          (ctx.ball?.y ?? 34) * (FIELD_WIDTH / 100),
        );
        activatePressingTrap(_awayPressing, trigger, simTime);
        // 40% das perdas são interceptação (vs. simples perda de bola).
        if (Math.random() < 0.4) {
          L.push({
            type: 'interception',
            payload: {
              minute: ctx.minute,
              defenderId: `away:${awayShort}`,
              defenderSide: 'away',
              zone: ctx.ballZone === 'att' ? 'def' : ctx.ballZone === 'mid' ? 'mid' : 'att',
            },
          });
        }
        L.push({ type: 'possession_change', payload: { to: 'away', reason: 'progress_loss' } });
        // FANTASY V3: turnover natural — bola volta DEVAGAR pra atrás (não
        // reset pra mid). Mantém pressão ofensiva da casa quando recuperar.
        ball = {
          x: Math.max(20, ctx.ball.x - 12 - Math.random() * 10),
          y: 25 + Math.random() * 50,
        };
        L.push({ type: 'ball_state', payload: { ...ball, reason: 'turnover_after_carry' } });
        narrative = pickLine('pass_missed', { min: ctx.minute, from: ctx.onBall?.name ?? 'Casa' }, ctx.minute)
          ?? T.progressLoss({ min: ctx.minute, loser: ctx.onBall?.name ?? 'Casa', winner: awayShort });
      }
    } else {
      homeStat!.passesOk += 1;
      homeStat!.passesAttempt += 1;
      ball = {
        x: Math.min(82, ctx.ball.x + 2 + Math.random() * 8),
        y: Math.min(85, Math.max(15, ctx.ball.y + (Math.random() * 10 - 5))),
      };
      L.push({
        type: 'ball_state',
        payload: { ...ball, reason: 'recycle_keep' },
      });
    }
  } else {
    const awayZone = zoneFromBallX(100 - ctx.ball.x);
    const awayAttackers = (ctx.awayRoster ?? []).filter((p) => /ATA|PD|PE/i.test(p.pos));
    const awayScorer = awayAttackers.length > 0
      ? awayAttackers[Math.floor(Math.random() * awayAttackers.length)]!
      : (ctx.awayRoster ?? [])[Math.floor(Math.random() * (ctx.awayRoster?.length || 1))] ?? { id: `away:${awayShort}`, name: awayShort };
    const awayShooterId = awayScorer.id;
    // Roubada de bola — 3 níveis + crítico de erro (miss).
    // Só tenta desarme quando o motor seleciona 'press' + passa no gate de probabilidade.
    // evaluateTacticalFoul decide se o defensor comete falta tática ou tenta o desarme limpo.
    const tacklerName = secondaryMate(ctx);
    const tackler = ctx.homePlayers?.find((p) => p.name === tacklerName);
    const tacklerId = tackler?.playerId ?? 'home:unknown';
    const fairPlay01 = tackler ? (tackler.attributes?.fairPlay ?? 70) / 100 : 0.7;
    const distToGoal = ctx.ball ? (100 - ctx.ball.x) * 1.05 : 52; // aprox em metros
    const isLastDefender = (ctx.homePlayers ?? []).filter((p) => p.role === 'def').length <= 1;
    const foulDecision = action === 'press'
      ? evaluateTacticalFoul(
          { id: tacklerId, x: ctx.ball?.x ?? 50, z: ctx.ball?.y ?? 34, speed: 0, yellowCards: 0 } as unknown as AgentSnapshot & { yellowCards?: number },
          { id: ctx.onBall?.playerId ?? 'away', x: ctx.ball?.x ?? 50, z: ctx.ball?.y ?? 34, speed: 1 } as unknown as AgentSnapshot,
          isLastDefender,
          distToGoal,
          tackler?.attributes?.marcacao ?? 60,
          Math.random.bind(Math),
        )
      : null;
    const willTackle = action === 'press' && (
      foulDecision?.shouldFoul ||
      Math.random() < 0.42 + (ctx.tacticalMentality - 50) / 250
    );
    if (willTackle) {
      const tackleOut = rollTackleOutcome(Math.random(), {
        tacticalMentality: ctx.tacticalMentality,
        fairPlay01,
        defenderMarcacao: tackler?.attributes?.marcacao,
        defenderVelocidade: tackler?.attributes?.velocidade,
        attackerDrible: ctx.onBall?.attributes?.drible,
      });

      const victimName = ctx.onBall?.name ?? awayShort;
      const victimId = ctx.onBall?.playerId ?? `away:${awayShort}`;

      if (tackleOut === 'clean') {
        // Roubada limpa — inicia contra-ataque.
        next = 'home';
        ball = { x: 58 + Math.random() * 10, y: 32 + Math.random() * 36 };
        L.push({ type: 'possession_change', payload: { to: 'home', reason: 'tackle_clean' } });
        L.push({ type: 'ball_state', payload: { ...ball, reason: 'recovery_attack' } });
        narrative =
          pickLine(['pressure_high', 'tackle_clean'], { min: ctx.minute, from: tacklerName, team: ctx.homeShort ?? 'Casa' }, ctx.minute)
          ?? `${ctx.minute}' — ${tacklerName} rouba na divida limpa e ${ctx.homeShort ?? 'Casa'} sai no contra-ataque.`;
      } else if (tackleOut === 'miss') {
        // Erro crítico — marcador passou batido, atacante segue.
        next = 'away';
        ball = { x: ctx.ball.x, y: ctx.ball.y };
        narrative = `${ctx.minute}' — ${tacklerName} tenta o desarme, falha feio e ${victimName} escapa com a bola!`;
      } else if (tackleOut === 'foul_soft') {
        // Falta forte — árbitro para o jogo, adversário reinicia na bola parada.
        next = 'away';
        ball = { x: ctx.ball.x, y: ctx.ball.y };
        L.push({
          type: 'foul_committed',
          payload: {
            minute: ctx.minute,
            foulerSide: 'home',
            foulerId: tacklerId,
            victimId,
            kind: 'tackle',
            dangerous: false,
            severity: 'firm',
          },
        });
        L.push({ type: 'ball_state', payload: { ...ball, reason: 'free_kick_against' } });
        narrative =
          pickLine(['foul_soft'], { min: ctx.minute, from: tacklerName, to: victimName, team: ctx.homeShort ?? 'Casa' }, ctx.minute)
          ?? `${ctx.minute}' — ${tacklerName} faz falta forte em ${victimName}. O árbitro para a partida.`;
      } else {
        // foul_hard — agressão, falta grave. Vermelho/amarelo + chance de lesão narrada.
        next = 'away';
        ball = { x: ctx.ball.x, y: ctx.ball.y };
        L.push({
          type: 'foul_committed',
          payload: {
            minute: ctx.minute,
            foulerSide: 'home',
            foulerId: tacklerId,
            victimId,
            kind: 'tackle',
            dangerous: true,
            severity: 'ugly',
          },
        });
        L.push({ type: 'ball_state', payload: { ...ball, reason: 'dangerous_foul' } });
        narrative =
          pickLine(['foul_hard'], { min: ctx.minute, from: tacklerName, to: victimName, team: ctx.homeShort ?? 'Casa' }, ctx.minute)
          ?? `${ctx.minute}' — Entrada agressiva de ${tacklerName}! Falta grave em ${victimName}, o árbitro já busca o cartão.`;

        // BUG FIX: pênalti pro away — antes só home gerava pênalti, away parecia
        // "cone" porque nunca era contemplado em foul perigoso na sua área.
        // Detecta foul_hard quando bola está perto do gol do home (ctx.ball.x ≤ 17 ≈ grande área).
        const awayInsideHomeBox = ctx.ball.x <= 17;
        const penaltyCooldownOk = !(ctx.penaltyCooldownTicks && ctx.penaltyCooldownTicks > 0);
        if (awayInsideHomeBox && penaltyCooldownOk && Math.random() < 0.85) {
          L.push({
            type: 'phase_change',
            payload: { from: 'LIVE', to: 'PENALTY' as 'LIVE', reason: 'foul_in_box' },
          });
          // Pega o melhor batedor disponível do away (atacante com pos ATA/PD/PE)
          const awayTaker = awayScorer;
          return {
            narrative: `${ctx.minute}' — Pênalti pro ${awayShort}! ${tacklerName} derrubou ${awayTaker.name} na área.`,
            action: 'recycle',
            nextPossession: 'away',
            ball: { ...ctx.ball },
            causalEvents: [...L.events],
            spiritMeta: {
              spiritPhase: 'penalty',
              penalty: initialPenaltyState('away', awayTaker.name, awayTaker.id),
              spiritOverlay: penaltyOverlayForStage(
                'banner',
                awayTaker.name,
                ctx.homeShort ?? 'Casa',
                awayShort,
                nowMs,
                2000,
              ),
            },
          };
        }
      }
    } else {
      const rShot = Math.random();
      const awayOnPitch = Math.max(1, ctx.awayRoster?.length ?? 11);
      const awayNumericRatio = Math.max(0.55, awayOnPitch / 11);
      // FANTASY V6 (2026-06-02): pGoalAway agora pondera artilheiro real do
      // visitante (finalizacao do atacante sintético) + mentalidade tática do
      // visitante. Time agressivo (perdendo, ou clube elite no embalo) chuta
      // mais; time bunker (vencendo no final) raramente arrisca.
      const awayShooterFin01 = (() => {
        const shooterPitch = ctx.awayPlayers?.find((p) => p.playerId === awayShooterId);
        return (shooterPitch?.attributes?.finalizacao ?? 60) / 100;
      })();
      const awayMent = ctx.awayMentality ?? 50;
      // -0.06 (bunker) a +0.08 (agressivo): mentalidade modula chance de chute.
      const awayMentMod = (awayMent - 50) / 350;
      // Atacante elite (fin ≥ 80) ganha +30% no pGoalAway base; medíocre (≤60) perde 10%.
      const finBonus = (awayShooterFin01 - 0.6) * 0.45;
      // FANTASY V5 (2026-05-27): 0.32 → 0.24 — V4 dava 3 gols seguidos do away.
      const pGoalAway =
        awayZone === 'att'
          ? (0.24 + ctx.opponentStrength / 700 + errorTax * 0.18 + finBonus + awayMentMod) * awayNumericRatio
          : 0;
      const pWideAway = 0.10;
      if (awayZone === 'att' && rShot < pGoalAway) {
        L.push({
          type: 'shot_attempt',
          payload: {
            side: 'away',
            shooterId: awayShooterId,
            zone: awayZone,
            minute: ctx.minute,
            target: spiritShotTargetUI('away', ctx.awayPlayers?.find((p) => p.playerId === awayShooterId)),
          },
        });
        L.push({
          type: 'shot_result',
          payload: { side: 'away', shooterId: awayShooterId, outcome: 'goal' },
        });
        const isCounter = detectCounter(ctx.possession, 'away', [...L.events]);
        const gol = commitGoal({
          scorerSide: 'away',
          minute: ctx.minute,
          buildUp: isCounter ? 'counter' : 'positional',
          scorerName: awayScorer.name,
          homeShort: ctx.homeShort ?? 'Casa',
          awayShort,
          nowMs,
          L,
          shooterId: awayShooterId,
          ctx,
        });
        goalFor = gol.goalFor;
        goalScorerPlayerId = gol.goalScorerPlayerId;
        narrative = gol.narrative;
        ball = gol.ball;
        next = gol.nextPossession;
        spiritMeta = gol.spiritMeta;
        goalBuildUp = gol.goalBuildUp;
        threatBar01 = gol.threatBar01;
      } else if (awayZone === 'att' && rShot < pGoalAway + pWideAway) {
        L.push({
          type: 'shot_attempt',
          payload: {
            side: 'away',
            shooterId: awayShooterId,
            zone: awayZone,
            minute: ctx.minute,
            target: spiritShotTargetUI('away', ctx.awayPlayers?.find((p) => p.playerId === awayShooterId)),
          },
        });
        L.push({
          type: 'shot_result',
          payload: { side: 'away', shooterId: awayShooterId, outcome: 'wide' },
        });
        const yN = Math.random();
        const patch = patchAfterAwayShotWide(yN);
        L.push({
          type: 'ball_state',
          payload: { ...patch.ball, reason: 'away_shot_wide' },
        });
        L.push({ type: 'possession_change', payload: { to: 'home', reason: 'after_away_shot_wide' } });
        narrative = pickLine('shot_out', { min: ctx.minute, from: awayScorer.name, team: awayShort }, ctx.minute)
          ?? T.awayShotWide({ min: ctx.minute, shooter: awayScorer.name, team: awayShort });
        next = patch.possession;
        ball = patch.ball;
        spiritMeta = {
          spiritPhase: patch.spiritPhase,
          spiritBuildupGkTicksRemaining: patch.spiritBuildupGkTicksRemaining,
        };
      } else {
        if (awayZone !== 'att') {
          const pushLeft = awayZone === 'mid' ? 7 + Math.random() * 14 : 5 + Math.random() * 11;
          ball = {
            x: Math.max(14, ctx.ball.x - pushLeft),
            y: Math.min(82, Math.max(18, ctx.ball.y + (Math.random() * 14 - 7))),
          };
        } else {
          ball = {
            x: 25 + Math.random() * 40,
            y: 20 + Math.random() * 60,
          };
        }
        L.push({
          type: 'ball_state',
          payload: { ...ball, reason: 'away_build' },
        });
        if (Math.random() < 0.35) {
          next = 'home';
          L.push({ type: 'possession_change', payload: { to: 'home', reason: 'away_turnover' } });
          narrative = pickLine('possession_switch', { min: ctx.minute, team: ctx.homeShort ?? 'Casa' }, ctx.minute)
            ?? T.turnover({ min: ctx.minute, team: ctx.homeShort ?? 'Casa' });
        }
      }
    }
  }

  // ── Validação de bola viva ────────────────────────────────────
  // Evita que a bola termine o tick em zona morta. Casos:
  //   • saiu pela linha → emitir throw_in / goal_kick / corner_kick
  //   • zona vazia (sem jogador casa por perto) com posse casa → snap pro mais próximo
  // Skip se já estamos num overlay (golo, pênalti) ou bola já é set-piece pendente.
  const skipBallValidator =
    spiritMeta?.spiritOverlay ||
    spiritMeta?.spiritPhase === 'celebration_goal' ||
    spiritMeta?.spiritPhase === 'penalty' ||
    spiritMeta?.pendingCornerForSide ||
    spiritMeta?.pendingFreeKickForSide;
  if (!skipBallValidator) {
    const restart = detectOutOfPlay(ball, next, ctx.homePlayers);
    if (restart) {
      if (restart.kind === 'throw_in') {
        L.push({
          type: 'throw_in',
          payload: { minute: ctx.minute, awardedTo: restart.awardedTo, zone: restart.zone },
        });
        L.push({ type: 'ball_state', payload: { ...restart.ball, reason: 'throw_in_restart' } });
        ball = restart.ball;
        next = restart.awardedTo;
      } else if (restart.kind === 'goal_kick') {
        L.push({
          type: 'goal_kick',
          payload: { minute: ctx.minute, awardedTo: restart.awardedTo },
        });
        L.push({ type: 'ball_state', payload: { ...restart.ball, reason: 'goal_kick_restart' } });
        ball = restart.ball;
        next = restart.awardedTo;
      } else if (restart.kind === 'corner_kick') {
        L.push({
          type: 'corner_kick',
          payload: { minute: ctx.minute, side: restart.forSide },
        });
        L.push({ type: 'ball_state', payload: { ...restart.ball, reason: 'corner_kick_restart' } });
        ball = restart.ball;
        next = restart.forSide;
        // Se for casa cobrando, preparar hint de cabeçada igual fluxo do block→corner.
        if (restart.forSide === 'home') {
          spiritMeta = { ...(spiritMeta ?? {}), pendingCornerForSide: 'home' };
        }
      }
    } else if (next === 'home') {
      // Sem restart, mas se posse casa e jogador mais próximo > 12 → snap.
      // FANTASY V3 FIX (2026-05-27): NÃO snapar quando a bola já está em
      // zona mid alta / att (x >= 55) — o snap pega o jogador mais próximo
      // (geralmente MEI/MC fixo em x=50) e ZERA o avanço da bola pra zona
      // de chute. Resultado anterior: 0 chutes em 90% das partidas.
      const near = nearestHomeToBall(ball, ctx.homePlayers);
      if (near && near.dist > 12 && ball.x < 55) {
        ball = { x: near.player.x, y: near.player.y };
        L.push({ type: 'ball_state', payload: { ...ball, reason: 'snap_to_carrier' } });
      }
    }
  }

  // Atualiza momentum a partir dos eventos deste tick e expõe no meta.
  const nextMomentum = updateMomentumFromTick(ctx.momentum, [...L.events]);
  const spiritMetaWithMomentum: SpiritSnapshotMeta = {
    ...(spiritMeta ?? {}),
    momentum: nextMomentum,
    // Se este tick consumiu o corner (cabeçada executada), limpa o hint.
    // Senão preserva o que spiritMeta já tiver definido (ex.: novo corner emitido agora).
    ...(consumedCorner && spiritMeta?.pendingCornerForSide === undefined
      ? { pendingCornerForSide: null }
      : {}),
    // V5 (2026-05-27): SEMPRE limpa pendingFreeKickForSide quando consumido
    // (mesmo que spiritMeta tenha set novo). Evita loop do relógio em 29:00
    // quando uma falta encadeia outra e o estado fica preso.
    ...(consumedFreeKick ? { pendingFreeKickForSide: null } : {}),
    ...(lastShotPreview ? { lastShotPreview } : {}),
  };

  // Enriquece narrativa com contexto emocional (Fase 1 — Quick Win #6)
  const enrichedNarrative = enrichNarrative(
    {
      narrative,
      action,
      nextPossession: next,
      ball,
      goalFor,
      goalScorerPlayerId,
      goalBuildUp,
      threatBar01,
      statDeltas: homeStat,
      causalEvents: [...L.events],
      spiritMeta: spiritMetaWithMomentum,
    },
    ctx,
    awayShort,
    narrative,
  );

  return {
    narrative: enrichedNarrative,
    action,
    nextPossession: next,
    ball,
    goalFor,
    goalScorerPlayerId,
    goalBuildUp,
    threatBar01,
    statDeltas: homeStat,
    causalEvents: [...L.events],
    spiritMeta: spiritMetaWithMomentum,
  };
}
