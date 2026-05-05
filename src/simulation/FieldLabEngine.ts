/**
 * FieldLabEngine — motor tático do Field Lab + exportável para o jogo.
 *
 * Fase 2: toPitchPlayerState() — converte FLPlayer → PitchPlayerState (FieldView)
 * Fase 3: deriveTeamIntention() (teamShape.ts) + computePitchTokenSeparation() (antiChaosEngine)
 */

import { SPEED_WALK_BASE, SPEED_SPRINT_BASE } from '@/match/playerSpeedTuning';
import { FIELD_LENGTH_M } from '@/tactical';
import { FORMATION_BASES } from '@/match-engine/formations/catalog';
import type { FormationSchemeId } from '@/match-engine/types';
import type { PitchPlayerState } from '@/engine/types';
import { deriveTeamIntention, getShapeModifiers } from '@/engine/test2d/teamShape';
import { computePitchTokenSeparation } from '@/engine/test2d/antiChaosEngine';

// ── Constantes ────────────────────────────────────────────────────────────────
export const TICK_MS = 50;
const WALK_N   = (SPEED_WALK_BASE          / FIELD_LENGTH_M) * 100 * (TICK_MS / 1000);
const JOG_N    = (SPEED_WALK_BASE * 1.5    / FIELD_LENGTH_M) * 100 * (TICK_MS / 1000);
const RUN_N    = (SPEED_SPRINT_BASE * 0.7  / FIELD_LENGTH_M) * 100 * (TICK_MS / 1000);
const SPRINT_N = (SPEED_SPRINT_BASE        / FIELD_LENGTH_M) * 100 * (TICK_MS / 1000);

// ── Tipos ─────────────────────────────────────────────────────────────────────
export type TeamPhase = 'defending' | 'transition' | 'attacking';
export type LocomotionTier = 'idle' | 'walk' | 'jog' | 'run' | 'sprint';
export type BallActionKind = 'carry' | 'short_pass' | 'long_pass' | 'cross' | 'shoot' | 'clear';

export interface FLPlayer {
  id: string;
  slotId: string;
  label: string;
  side: 'home' | 'away';
  role: 'gk' | 'def' | 'mid' | 'att';
  x: number; y: number;
  baseX: number; baseY: number;
  targetX: number; targetY: number;
  locomotion: LocomotionTier;
  fatigue: number;
  hasBall: boolean;
  actionTimer: number;
  num: number;
  name: string;
  pos: string;
}

export interface FLBall {
  x: number; y: number;
  vx: number; vy: number;
  carrierId: string | null;
  action: BallActionKind | null;
  actionTimer: number;
}

export interface FLState {
  players: FLPlayer[];
  ball: FLBall;
  homePhase: TeamPhase;
  awayPhase: TeamPhase;
  possession: 'home' | 'away' | null;
  minute: number;
  homeScore: number;
  awayScore: number;
  playing: boolean;
  homeFormation: FormationSchemeId;
  awayFormation: FormationSchemeId;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

function moveToward(px: number, py: number, tx: number, ty: number, speed: number) {
  const d = dist(px, py, tx, ty);
  if (d < speed) return { x: tx, y: ty };
  const r = speed / d;
  return { x: px + (tx - px) * r, y: py + (ty - py) * r };
}

function speedForTier(tier: LocomotionTier): number {
  switch (tier) {
    case 'idle':   return 0;
    case 'walk':   return WALK_N;
    case 'jog':    return JOG_N;
    case 'run':    return RUN_N;
    case 'sprint': return SPRINT_N;
  }
}

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }
function rand(min: number, max: number) { return min + Math.random() * (max - min); }

function roleFromSlot(slotId: string, line: string): FLPlayer['role'] {
  if (slotId === 'gol') return 'gk';
  if (line === 'def') return 'def';
  if (line === 'att') return 'att';
  return 'mid';
}

const SLOT_LABELS: Record<string, string> = {
  gol: 'GOL', zag1: 'ZAG', zag2: 'ZAG', le: 'LE', ld: 'LD',
  vol: 'VOL', mc1: 'MC', mc2: 'MC', pe: 'PE', pd: 'PD', ata: 'ATA',
  ata1: 'ATA', ata2: 'ATA',
};

const SLOT_POS: Record<string, string> = {
  gol: 'GOL', zag1: 'ZAG', zag2: 'ZAG', le: 'LAT', ld: 'LAT',
  vol: 'VOL', mc1: 'MEI', mc2: 'MEI', pe: 'PE', pd: 'PD', ata: 'ATA',
  ata1: 'ATA', ata2: 'ATA',
};

const SLOT_NUMS: Record<string, number> = {
  gol: 1, zag1: 4, zag2: 5, le: 3, ld: 2,
  vol: 6, mc1: 8, mc2: 10, pe: 11, pd: 7, ata: 9,
  ata1: 9, ata2: 11,
};

// ── Fase tática ───────────────────────────────────────────────────────────────
function computePhase(side: 'home' | 'away', possession: FLState['possession']): TeamPhase {
  if (possession === side) return 'attacking';
  if (possession === null) return 'transition';
  return 'defending';
}

// Converte TeamPhase → BallZoneSimple para deriveTeamIntention
function ballZoneForTeam(ballY: number, side: 'home' | 'away'): 'def' | 'mid' | 'att' {
  // home ataca +y, away ataca -y
  const depth = side === 'home' ? ballY : 100 - ballY;
  if (depth < 33) return 'def';
  if (depth < 66) return 'mid';
  return 'att';
}

// ── Target por intenção tática (teamShape) ────────────────────────────────────
function intentionTarget(
  p: FLPlayer,
  phase: TeamPhase,
  ballX: number,
  ballY: number,
  formation: FormationSchemeId,
): { tx: number; ty: number; tier: LocomotionTier } {
  const possession = phase === 'attacking' ? p.side : (p.side === 'home' ? 'away' : 'home');
  const hasBall = phase === 'attacking';
  const bz = ballZoneForTeam(ballY, p.side);
  const intention = deriveTeamIntention(hasBall, bz, undefined, undefined, possession, p.side, 55);
  const shape = getShapeModifiers(intention, formation);

  const attackDir = p.side === 'home' ? 1 : -1;
  const midLine = 50;

  // GK — fica na área, segue bola lateralmente
  if (p.role === 'gk') {
    const gkY = p.side === 'home' ? rand(3, 8) : rand(92, 97);
    const gkX = clamp(ballX * 0.25 + 50 * 0.75 + rand(-3, 3), 30, 70);
    return { tx: gkX, ty: gkY, tier: 'walk' };
  }

  // Linha base ajustada por shape
  const lineShift = shape.lineHeight * 20 * attackDir;
  const widthSpread = shape.width * 8;
  const compactShift = (1 - shape.compactness) * 6;

  let ty = p.baseY + lineShift + rand(-compactShift, compactShift);
  let tx = p.baseX + rand(-widthSpread * 0.5, widthSpread * 0.5);

  // Defensores: não ultrapassam o meio campo
  if (p.role === 'def') {
    ty = p.side === 'home'
      ? clamp(ty, p.baseY - 5, midLine - 2)
      : clamp(ty, midLine + 2, p.baseY + 5);
  }

  // Atacantes: vão para área adversária em ataque
  if (p.role === 'att' && phase === 'attacking') {
    ty = p.side === 'home'
      ? clamp(ty, 60, 92)
      : clamp(ty, 8, 40);
    // Convergem para o centro perto da bola
    const dBall = dist(p.x, p.y, ballX, ballY);
    if (dBall < 30) tx = p.baseX + (50 - p.baseX) * 0.35 + rand(-5, 5);
  }

  // Pressing: jogador mais próximo da bola vai pressionar
  if (phase === 'defending' && shape.pressTrigger > 0.4) {
    const dBall = dist(p.x, p.y, ballX, ballY);
    if (dBall < 22) {
      tx = ballX + rand(-5, 5);
      ty = ballY + rand(-5, 5);
      const tier: LocomotionTier = dBall > 12 ? 'sprint' : 'run';
      return { tx: clamp(tx, 5, 95), ty: clamp(ty, 5, 95), tier };
    }
  }

  const dTarget = dist(p.x, p.y, tx, ty);
  const tier: LocomotionTier = dTarget > 22 ? 'run' : dTarget > 10 ? 'jog' : 'walk';
  return { tx: clamp(tx, 5, 95), ty: clamp(ty, 5, 95), tier };
}

// ── Decisão do portador ───────────────────────────────────────────────────────
function carrierDecision(
  carrier: FLPlayer,
  teammates: FLPlayer[],
  opponents: FLPlayer[],
): { action: BallActionKind; targetX: number; targetY: number } {
  const attackDir = carrier.side === 'home' ? 1 : -1;
  const goalY = carrier.side === 'home' ? 95 : 5;
  const dGoal = dist(carrier.x, carrier.y, 50, goalY);

  // Chute se perto do gol
  if (dGoal < 22 && Math.random() < 0.35) {
    return { action: 'shoot', targetX: clamp(50 + rand(-8, 8), 35, 65), targetY: goalY };
  }

  // Cruzamento se lateral e profundo
  const isWide = carrier.x < 22 || carrier.x > 78;
  const isDeep = carrier.side === 'home' ? carrier.y > 68 : carrier.y < 32;
  if (isWide && isDeep && Math.random() < 0.4) {
    return { action: 'cross', targetX: 50, targetY: goalY };
  }

  // Passe longo se defensor pressionado
  const nearOpp = opponents.find(o => dist(carrier.x, carrier.y, o.x, o.y) < 12);
  if (nearOpp && carrier.role === 'def' && Math.random() < 0.5) {
    const target = teammates.find(t => t.role === 'att' || t.role === 'mid');
    if (target) return { action: 'long_pass', targetX: target.x, targetY: target.y };
  }

  // Passe curto para companheiro mais avançado
  const advanced = teammates
    .filter(t => !t.hasBall)
    .filter(t => {
      const fwd = carrier.side === 'home' ? t.y > carrier.y - 5 : t.y < carrier.y + 5;
      return fwd && dist(carrier.x, carrier.y, t.x, t.y) < 35;
    })
    .sort((a, b) => {
      const sa = carrier.side === 'home' ? a.y : -a.y;
      const sb = carrier.side === 'home' ? b.y : -b.y;
      return sb - sa;
    });

  if (advanced.length > 0 && Math.random() < 0.6) {
    return { action: 'short_pass', targetX: advanced[0].x, targetY: advanced[0].y };
  }

  // Carry para frente
  return {
    action: 'carry',
    targetX: clamp(carrier.x + rand(-8, 8), 5, 95),
    targetY: clamp(carrier.y + attackDir * rand(5, 15), 5, 95),
  };
}

// ── Inicialização ─────────────────────────────────────────────────────────────
export function initFLState(
  homeFormation: FormationSchemeId,
  awayFormation: FormationSchemeId,
): FLState {
  const players: FLPlayer[] = [];
  let idx = 0;

  const homeSlots = FORMATION_BASES[homeFormation];
  Object.entries(homeSlots).forEach(([slotId, slot]) => {
    const x = slot.nz * 100;
    const y = slot.nx * 100;
    players.push({
      id: `home_${slotId}`, slotId, label: SLOT_LABELS[slotId] ?? slotId.toUpperCase(),
      side: 'home', role: roleFromSlot(slotId, slot.line),
      x, y, baseX: x, baseY: y, targetX: x, targetY: y,
      locomotion: 'idle', fatigue: 0, hasBall: false,
      actionTimer: Math.floor(rand(0, 15)),
      num: SLOT_NUMS[slotId] ?? (idx + 1),
      name: SLOT_LABELS[slotId] ?? slotId,
      pos: SLOT_POS[slotId] ?? slotId.toUpperCase(),
    });
    idx++;
  });

  const awaySlots = FORMATION_BASES[awayFormation];
  Object.entries(awaySlots).forEach(([slotId, slot]) => {
    const x = slot.nz * 100;
    const y = (1 - slot.nx) * 100;
    players.push({
      id: `away_${slotId}`, slotId, label: SLOT_LABELS[slotId] ?? slotId.toUpperCase(),
      side: 'away', role: roleFromSlot(slotId, slot.line),
      x, y, baseX: x, baseY: y, targetX: x, targetY: y,
      locomotion: 'idle', fatigue: 0, hasBall: false,
      actionTimer: Math.floor(rand(0, 15)),
      num: SLOT_NUMS[slotId] ?? (idx + 1),
      name: `ADV ${SLOT_LABELS[slotId] ?? slotId}`,
      pos: SLOT_POS[slotId] ?? slotId.toUpperCase(),
    });
    idx++;
  });

  return {
    players,
    ball: { x: 50, y: 50, vx: 0, vy: 0, carrierId: null, action: null, actionTimer: 0 },
    homePhase: 'attacking', awayPhase: 'defending',
    possession: null, minute: 0, homeScore: 0, awayScore: 0,
    playing: false, homeFormation, awayFormation,
  };
}

// ── Tick principal ────────────────────────────────────────────────────────────
export function tickFLState(prev: FLState): FLState {
  if (!prev.playing) return prev;

  const players = prev.players.map(p => ({ ...p }));
  const ball = { ...prev.ball };

  // 1. Sincroniza hasBall a partir de carrierId (fonte única de verdade)
  players.forEach(p => { p.hasBall = p.id === ball.carrierId; });

  // 2. Bola livre: jogador mais próximo pega
  if (ball.carrierId === null) {
    let closest: FLPlayer | null = null;
    let closestD = 999;
    for (const p of players) {
      const d = dist(p.x, p.y, ball.x, ball.y);
      if (d < closestD) { closestD = d; closest = p; }
    }
    if (closest && closestD < 8) {
      ball.carrierId = closest.id;
      ball.vx = 0; ball.vy = 0;
      closest.hasBall = true;
    }
  }

  const carrier = ball.carrierId ? players.find(p => p.id === ball.carrierId) ?? null : null;

  // 3. Posse e fases
  const possession: FLState['possession'] = carrier ? carrier.side : prev.possession;
  const homePhase = computePhase('home', possession);
  const awayPhase = computePhase('away', possession);

  // 4. Bola em voo
  if (!carrier) {
    ball.x = clamp(ball.x + ball.vx, 2, 98);
    ball.y = clamp(ball.y + ball.vy, 2, 98);
    ball.vx *= 0.88; ball.vy *= 0.88;
    if (Math.abs(ball.vx) < 0.05 && Math.abs(ball.vy) < 0.05) { ball.vx = 0; ball.vy = 0; }
    if (ball.x <= 2 || ball.x >= 98) ball.vx *= -0.6;
    if (ball.y <= 2 || ball.y >= 98) ball.vy *= -0.6;
  }

  // 5. Decisão do portador
  if (carrier) {
    carrier.actionTimer = Math.max(0, carrier.actionTimer - 1);
    if (carrier.actionTimer === 0) {
      const teammates = players.filter(p => p.side === carrier.side && p.id !== carrier.id);
      const opponents = players.filter(p => p.side !== carrier.side);
      const decision = carrierDecision(carrier, teammates, opponents);

      if (decision.action === 'carry') {
        carrier.targetX = decision.targetX;
        carrier.targetY = decision.targetY;
        carrier.locomotion = 'run';
        carrier.actionTimer = Math.floor(rand(10, 22));
      } else {
        const dx = decision.targetX - carrier.x;
        const dy = decision.targetY - carrier.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const speed = decision.action === 'shoot' ? rand(5, 8)
          : decision.action === 'long_pass' || decision.action === 'cross' ? rand(3.5, 5.5)
          : rand(2, 3.5);
        ball.vx = (dx / d) * speed;
        ball.vy = (dy / d) * speed;
        ball.carrierId = null;
        carrier.hasBall = false;
        carrier.locomotion = 'jog';
        carrier.actionTimer = Math.floor(rand(12, 25));
      }
    }
    if (carrier.hasBall) { ball.x = carrier.x; ball.y = carrier.y; }
  }

  // 6. Mover jogadores com intenção tática (teamShape)
  for (const p of players) {
    if (p.hasBall) {
      const { x, y } = moveToward(p.x, p.y, p.targetX, p.targetY, speedForTier(p.locomotion));
      p.x = x; p.y = y;
      continue;
    }
    p.actionTimer = Math.max(0, p.actionTimer - 1);
    if (p.actionTimer === 0) {
      const phase = p.side === 'home' ? homePhase : awayPhase;
      const formation = p.side === 'home' ? prev.homeFormation : prev.awayFormation;
      const { tx, ty, tier } = intentionTarget(p, phase, ball.x, ball.y, formation);
      p.targetX = tx; p.targetY = ty; p.locomotion = tier;
      p.actionTimer = Math.floor(rand(8, 20));
    }
    const { x, y } = moveToward(p.x, p.y, p.targetX, p.targetY, speedForTier(p.locomotion));
    p.x = x; p.y = y;
    if (p.locomotion === 'sprint') p.fatigue = Math.min(1, p.fatigue + 0.0002);
    else p.fatigue = Math.max(0, p.fatigue - 0.0001);
  }

  // 7. Anti-chaos: separação de tokens (Fase 3)
  try {
    const agents = players.map(p => ({ id: p.id, x: p.x, y: p.y }));
    const offsets = computePitchTokenSeparation(agents, {
      minSeparation: 5,
      iterations: 2,
      maxOffset: 3,
      ball: { x: ball.x, y: ball.y },
      minFromBall: 3,
    });
    for (const p of players) {
      const off = offsets.get(p.id);
      if (off) { p.x = clamp(p.x + off.dx, 2, 98); p.y = clamp(p.y + off.dy, 2, 98); }
    }
  } catch (_) { /* non-blocking */ }

  // 8. Gol
  let { homeScore, awayScore } = prev;
  const gw = 8;
  if (ball.y <= 2 && ball.x > 50 - gw && ball.x < 50 + gw) {
    awayScore++;
    ball.x = 50; ball.y = 50; ball.vx = 0; ball.vy = 0; ball.carrierId = null;
    players.forEach(p => { p.x = p.baseX; p.y = p.baseY; p.hasBall = false; p.actionTimer = Math.floor(rand(5, 15)); });
  }
  if (ball.y >= 98 && ball.x > 50 - gw && ball.x < 50 + gw) {
    homeScore++;
    ball.x = 50; ball.y = 50; ball.vx = 0; ball.vy = 0; ball.carrierId = null;
    players.forEach(p => { p.x = p.baseX; p.y = p.baseY; p.hasBall = false; p.actionTimer = Math.floor(rand(5, 15)); });
  }

  return { ...prev, players, ball, homePhase, awayPhase, possession, homeScore, awayScore };
}

// ── Fase 2: Conversão FLPlayer → PitchPlayerState ────────────────────────────
// ATENÇÃO: FieldView aerial usa x=profundidade (nx*100), y=largura (nz*100)
// FLPlayer usa x=largura (nz*100), y=profundidade (nx*100) — precisa inverter
export function toPitchPlayerState(p: FLPlayer): PitchPlayerState {
  return {
    playerId: p.id,
    slotId: p.slotId,
    name: p.name,
    num: p.num,
    pos: p.pos,
    x: p.y,   // profundidade → x do FieldView
    y: p.x,   // largura → y do FieldView
    heading: 0,
    fatigue: Math.round(p.fatigue * 100),
    role: p.role === 'att' ? 'attack' : p.role,
  };
}

export function flStateToPitchPlayers(state: FLState): {
  homePlayers: PitchPlayerState[];
  awayPlayers: PitchPlayerState[];
  ballX: number;
  ballY: number;
  onBallPlayerId: string | undefined;
} {
  const homePlayers = state.players.filter(p => p.side === 'home').map(toPitchPlayerState);
  const awayPlayers = state.players.filter(p => p.side === 'away').map(toPitchPlayerState);
  const carrier = state.players.find(p => p.hasBall);
  return {
    homePlayers,
    awayPlayers,
    ballX: state.ball.x,
    ballY: state.ball.y,
    onBallPlayerId: carrier?.id,
  };
}
