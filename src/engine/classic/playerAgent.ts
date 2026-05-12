/**
 * Player Agent — Sistema de agentes autônomos para o Classic Mode.
 *
 * Cada jogador é um agente com percepção, decisão e movimento direto.
 * Sem grids, sem células, sem intermediários.
 *
 * Inspirado em Craig Reynolds (1987) — steering behaviors compostos.
 * Modulado por role + archetype + mental state.
 */

import type { ClassicPlayer, ArchetypeId } from './types';
import { zoneFromRole } from './types';
import { ARCHETYPES } from './archetypes';
import { FIELD_W_LOGIC, FIELD_H_LOGIC } from './formations';

// ─── Vec2 ───────────────────────────────────────────────────────────────────

type Vec2 = { x: number; y: number };

function vec(x: number, y: number): Vec2 { return { x, y }; }
function add(a: Vec2, b: Vec2): Vec2 { return { x: a.x + b.x, y: a.y + b.y }; }
function sub(a: Vec2, b: Vec2): Vec2 { return { x: a.x - b.x, y: a.y - b.y }; }
function scale(v: Vec2, s: number): Vec2 { return { x: v.x * s, y: v.y * s }; }
function mag(v: Vec2): number { return Math.hypot(v.x, v.y); }
function normalize(v: Vec2): Vec2 {
  const m = mag(v);
  return m < 0.001 ? { x: 0, y: 0 } : { x: v.x / m, y: v.y / m };
}
function clampMag(v: Vec2, max: number): Vec2 {
  const m = mag(v);
  return m <= max ? v : scale(normalize(v), max);
}
function lerp2(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
function dist(a: Vec2, b: Vec2): number { return Math.hypot(a.x - b.x, a.y - b.y); }

// ─── Constants ──────────────────────────────────────────────────────────────

const FW = FIELD_W_LOGIC;  // 600
const FH = FIELD_H_LOGIC;  // 400
const CENTER = vec(FW / 2, FH / 2);

/** Velocidade máxima por tick (px). Calibrado para 15fps (~66ms/tick). */
const MAX_SPEED = 4.5;

/** Raio de separação entre companheiros (px). */
const SEPARATION_RADIUS = 55;

/** Raio de percepção de adversários (px). */
const OPPONENT_AWARENESS = 100;

/** Força de ancoragem à basePosition (0-1). */
const ANCHOR_BASE = 0.25;

/** Inércia: quanto da velocidade anterior se mantém (0-1). */
const INERTIA = 0.7;

// ─── Perception ─────────────────────────────────────────────────────────────

type Lane = 'left' | 'center' | 'right';

interface AgentPerception {
  ball: Vec2;
  myTeamHasBall: boolean;
  iAmCarrier: boolean;
  carrierIsTeammate: boolean;
  ballInMyZone: boolean;
  nearestOpponentDist: number;
  nearestTeammateDist: number;
  spaceAhead: number;
  distToOwnGoal: number;
  distToOpponentGoal: number;
  teammatesNearby: number;
  opponentsNearby: number;
  /** Progresso da bola no eixo de ataque (0=nosso gol, 1=gol deles). */
  ballProgress: number;

  // ─── Percepções espaciais avançadas ─────────────────────────────────────
  /** Corredor onde o agente está. */
  myLane: Lane;
  /** Corredor onde a bola está. */
  ballLane: Lane;
  /** Vetor de pressão: direção média dos adversários próximos (normalizado). */
  pressureDirection: Vec2;
  /** Intensidade da pressão (0=livre, 1=cercado). */
  pressureIntensity: number;
  /** X médio da linha defensiva adversária (últimos 2-4 defensores). */
  opponentDefLineX: number;
  /** Há espaço atrás da linha defensiva adversária? */
  gapBehindDefense: boolean;
  /** Limites da minha zona de responsabilidade. */
  myZone: { minX: number; maxX: number };
  /** Distância até a borda da minha zona (negativo = fora da zona). */
  distToZoneEdge: number;
}

function getLane(y: number): Lane {
  if (y < FH * 0.33) return 'left';
  if (y > FH * 0.67) return 'right';
  return 'center';
}

function perceive(
  agent: ClassicPlayer,
  allPlayers: ClassicPlayer[],
  ball: Vec2,
  possession: 'home' | 'away' | null,
  carrierId: number | null,
): AgentPerception {
  const dir = agent.team === 'home' ? 1 : -1;
  const ownGoalX = agent.team === 'home' ? 0 : FW;
  const oppGoalX = agent.team === 'home' ? FW : 0;

  const teammates = allPlayers.filter(p => p.team === agent.team && p.id !== agent.id);
  const opponents = allPlayers.filter(p => p.team !== agent.team);

  let nearestOppDist = 9999;
  let nearestTmDist = 9999;
  let tmNearby = 0;
  let oppNearby = 0;

  // Vetor de pressão: soma dos vetores dos adversários próximos
  let pressX = 0;
  let pressY = 0;
  let pressCount = 0;

  for (const opp of opponents) {
    const d = dist(agent.position, opp.position);
    if (d < nearestOppDist) nearestOppDist = d;
    if (d < OPPONENT_AWARENESS) {
      oppNearby++;
      // Direção de onde vem a pressão (opp → agent)
      pressX += (opp.position.x - agent.position.x);
      pressY += (opp.position.y - agent.position.y);
      pressCount++;
    }
  }
  for (const tm of teammates) {
    const d = dist(agent.position, tm.position);
    if (d < nearestTmDist) nearestTmDist = d;
    if (d < 80) tmNearby++;
  }

  // Normaliza vetor de pressão
  const pressureDirection = pressCount > 0
    ? normalize(vec(pressX / pressCount, pressY / pressCount))
    : vec(0, 0);
  const pressureIntensity = Math.min(1, pressCount / 4);

  // Espaço à frente: quantos adversários no cone de 120° à frente
  let blockersAhead = 0;
  for (const opp of opponents) {
    const dx = (opp.position.x - agent.position.x) * dir;
    if (dx > 0 && dx < 150) {
      const dy = Math.abs(opp.position.y - agent.position.y);
      if (dy < 80) blockersAhead++;
    }
  }
  const spaceAhead = Math.max(0, 1 - blockersAhead / 3);

  // Linha defensiva adversária: média X dos 3-4 defensores mais recuados
  const oppDefenders = opponents
    .filter(p => {
      const r = p.role.toUpperCase();
      return r === 'CB' || r === 'LB' || r === 'RB' || r === 'GK';
    })
    .map(p => p.position.x);
  const opponentDefLineX = oppDefenders.length > 0
    ? oppDefenders.reduce((a, b) => a + b, 0) / oppDefenders.length
    : oppGoalX;

  // Gap atrás da defesa: espaço entre último defensor e gol adversário
  const lastDefX = dir > 0
    ? Math.max(...oppDefenders, oppGoalX - 100)
    : Math.min(...oppDefenders, oppGoalX + 100);
  const gapBehindDefense = dir > 0
    ? (oppGoalX - lastDefX) > 60
    : (lastDefX - oppGoalX) > 60;

  // Bola na minha zona de responsabilidade?
  const zone = zoneFromRole(agent.role);
  const ballRelX = agent.team === 'home' ? ball.x / FW : 1 - ball.x / FW;
  const ballInMyZone =
    (zone === 'defense' && ballRelX < 0.4) ||
    (zone === 'creative' && ballRelX >= 0.25 && ballRelX <= 0.75) ||
    (zone === 'attack' && ballRelX > 0.6);

  // Limites da minha zona (em coordenadas absolutas)
  const myZone = getZoneLimits(zone, agent.team);
  const agentRelX = agent.team === 'home' ? agent.position.x : FW - agent.position.x;
  const distToZoneEdge = Math.min(
    agentRelX - myZone.minX,
    myZone.maxX - agentRelX,
  );

  const ballProgress = agent.team === 'home' ? ball.x / FW : 1 - ball.x / FW;

  const iAmCarrier = carrierId === agent.id;
  const carrier = carrierId != null ? allPlayers.find(p => p.id === carrierId) : null;
  const carrierIsTeammate = carrier != null && carrier.team === agent.team && !iAmCarrier;

  return {
    ball,
    myTeamHasBall: possession === agent.team,
    iAmCarrier,
    carrierIsTeammate,
    ballInMyZone,
    nearestOpponentDist: nearestOppDist,
    nearestTeammateDist: nearestTmDist,
    spaceAhead,
    distToOwnGoal: Math.abs(agent.position.x - ownGoalX),
    distToOpponentGoal: Math.abs(agent.position.x - oppGoalX),
    teammatesNearby: tmNearby,
    opponentsNearby: oppNearby,
    ballProgress,
    // Avançadas
    myLane: getLane(agent.position.y),
    ballLane: getLane(ball.y),
    pressureDirection,
    pressureIntensity,
    opponentDefLineX,
    gapBehindDefense,
    myZone,
    distToZoneEdge,
  };
}

/** Limites de zona em coordenadas relativas (0=nosso gol, FW=gol deles). */
function getZoneLimits(zone: 'defense' | 'creative' | 'attack', team: string): { minX: number; maxX: number } {
  // Valores em % do campo, convertidos para px
  switch (zone) {
    case 'defense': return { minX: 0, maxX: FW * 0.4 };
    case 'creative': return { minX: FW * 0.25, maxX: FW * 0.75 };
    case 'attack': return { minX: FW * 0.55, maxX: FW };
  }
}

// ─── Target Decision ────────────────────────────────────────────────────────

function decideTarget(
  agent: ClassicPlayer,
  perc: AgentPerception,
  basePos: Vec2,
): Vec2 {
  const dir = agent.team === 'home' ? 1 : -1;
  const role = agent.role.toUpperCase();
  const arch = ARCHETYPES[agent.archetype];
  const attacking = perc.myTeamHasBall;

  // ─── GK: sempre perto do gol, acompanha bola em Y ─────────────────────
  if (role === 'GK') {
    const gkX = agent.team === 'home' ? 30 : FW - 30;
    const gkY = clampNum(perc.ball.y, FH * 0.3, FH * 0.7);
    return vec(gkX, gkY);
  }

  // ─── PORTADOR: mantém posição, não foge da bola ────────────────────────
  if (perc.iAmCarrier) {
    // Portador avança levemente na direção de ataque
    return vec(
      clampNum(agent.position.x + dir * 8, 30, FW - 30),
      clampNum(agent.position.y, 20, FH - 20),
    );
  }

  // ─── ATACANDO ──────────────────────────────────────────────────────────
  if (attacking) {
    const ballProg = perc.ballProgress;

    // Companheiro do portador: oferece linha de passe (se afasta do portador)
    if (perc.carrierIsTeammate) {
      return attackSupportTarget(agent, perc, basePos, dir, ballProg, arch);
    }

    return attackTarget(agent, perc, basePos, dir, ballProg, arch);
  }

  // ─── DEFENDENDO ────────────────────────────────────────────────────────
  return defendTarget(agent, perc, basePos, dir, arch);
}

// ─── Attack: suporte ao portador (oferecer linha de passe) ───────────────────

function attackSupportTarget(
  agent: ClassicPlayer,
  perc: AgentPerception,
  basePos: Vec2,
  dir: number,
  ballProg: number,
  arch: typeof ARCHETYPES[keyof typeof ARCHETYPES],
): Vec2 {
  const role = agent.role.toUpperCase();

  // Se sob pressão, mover na direção oposta à pressão (buscar espaço)
  const escapeX = perc.pressureIntensity > 0.5 ? -perc.pressureDirection.x * 15 : 0;
  const escapeY = perc.pressureIntensity > 0.5 ? -perc.pressureDirection.y * 15 : 0;

  switch (role) {
    case 'CB': {
      // CB fica atrás, oferece opção de recuo
      const safeX = basePos.x + dir * (ballProg * 30);
      return vec(clampNum(safeX + escapeX, dir > 0 ? 50 : FW - 200, dir > 0 ? 180 : FW - 50), basePos.y + escapeY);
    }
    case 'LB':
    case 'RB': {
      // Lateral sobe pela ala — overlap. Mais agressivo se espaço atrás da defesa.
      const overlapBonus = perc.gapBehindDefense ? 110 : 70;
      const overlapX = basePos.x + dir * (ballProg * overlapBonus);
      return vec(clampNum(overlapX + escapeX, 40, FW - 40), clampNum(basePos.y + escapeY, 15, FH - 15));
    }
    case 'DM': {
      // DM oferece opção curta atrás da bola
      const dmX = perc.ball.x - dir * 40;
      const pullY = (perc.ball.y - basePos.y) * 0.2;
      return vec(clampNum(dmX + escapeX, 80, FW - 80), clampNum(basePos.y + pullY + escapeY, 60, FH - 60));
    }
    case 'CM': {
      // CM se posiciona entre linhas, lateral à bola. Foge da pressão.
      const offsetY = (basePos.y > FH / 2 ? 1 : -1) * 50;
      const cmX = perc.ball.x + dir * 30;
      return vec(clampNum(cmX + escapeX, 100, FW - 100), clampNum(perc.ball.y + offsetY + escapeY, 40, FH - 40));
    }
    case 'AM':
    case 'MEI': {
      // AM busca espaço à frente do portador, entre linhas adversárias
      const amX = perc.ball.x + dir * 60;
      const offsetY = (basePos.y > FH / 2 ? -1 : 1) * 30;
      return vec(clampNum(amX + escapeX, 120, FW - 120), clampNum(perc.ball.y + offsetY + escapeY, 40, FH - 40));
    }
    case 'LW':
    case 'RW': {
      // Ponta abre na ala, estica a defesa. Se gap atrás, faz corrida diagonal.
      let wingX = perc.ball.x + dir * 80;
      let wingY = basePos.y;
      if (perc.gapBehindDefense && ballProg > 0.5) {
        // Corrida diagonal atrás da defesa
        wingX = perc.opponentDefLineX + dir * 30;
        wingY = basePos.y + (basePos.y > FH / 2 ? -20 : 20); // corta pra dentro
      }
      return vec(clampNum(wingX, 50, FW - 50), clampNum(wingY, 15, FH - 15));
    }
    case 'ST': {
      // ST faz corrida de profundidade. Se gap, explora.
      let stX = perc.ball.x + dir * 100;
      if (perc.gapBehindDefense) {
        stX = perc.opponentDefLineX + dir * 40; // corre atrás da linha
      }
      const pullY = (perc.ball.y - FH / 2) * 0.2;
      return vec(clampNum(stX, dir > 0 ? 300 : 40, dir > 0 ? FW - 30 : 300), clampNum(FH / 2 + pullY, 100, FH - 100));
    }
    default:
      return basePos;
  }
}

// ─── Attack: sem portador identificado como companheiro ──────────────────────

function attackTarget(
  agent: ClassicPlayer,
  perc: AgentPerception,
  basePos: Vec2,
  dir: number,
  ballProg: number,
  arch: typeof ARCHETYPES[keyof typeof ARCHETYPES],
): Vec2 {
  const role = agent.role.toUpperCase();

  switch (role) {
    case 'CB': {
      const advanceX = basePos.x + dir * (ballProg * 40);
      return vec(clampNum(advanceX, dir > 0 ? 60 : FW - 200, dir > 0 ? 200 : FW - 60), basePos.y);
    }
    case 'LB':
    case 'RB': {
      const overlapBonus = arch.stamina > 0.85 ? 80 : 40;
      const advanceX = basePos.x + dir * (ballProg * overlapBonus);
      const pullY = (perc.ball.y - basePos.y) * 0.2;
      return vec(clampNum(advanceX, 40, FW - 40), clampNum(basePos.y + pullY, 20, FH - 20));
    }
    case 'DM': {
      const dmX = basePos.x + dir * (ballProg * 50);
      const pullY = (perc.ball.y - basePos.y) * 0.3;
      return vec(clampNum(dmX, 80, FW - 80), clampNum(basePos.y + pullY, 60, FH - 60));
    }
    case 'CM': {
      const cmAdvance = arch.passFreq > 0.8 ? 60 : 80;
      const cmX = basePos.x + dir * (ballProg * cmAdvance);
      const offsetY = (basePos.y > FH / 2 ? 1 : -1) * 30;
      const pullY = (perc.ball.y - basePos.y) * 0.25 + offsetY;
      return vec(clampNum(cmX, 100, FW - 100), clampNum(basePos.y + pullY, 40, FH - 40));
    }
    case 'AM':
    case 'MEI': {
      const amX = basePos.x + dir * (ballProg * 90);
      const pullY = (perc.ball.y - basePos.y) * 0.35;
      return vec(clampNum(amX, 150, FW - 150), clampNum(basePos.y + pullY, 50, FH - 50));
    }
    case 'LW':
    case 'RW': {
      const wingX = basePos.x + dir * (ballProg * 120);
      let wingY = basePos.y;
      if (agent.archetype === 'BOX_INVADER' && ballProg > 0.7) {
        wingY = FH / 2 + (basePos.y > FH / 2 ? -60 : 60);
      }
      return vec(clampNum(wingX, 60, FW - 60), clampNum(wingY, 15, FH - 15));
    }
    case 'ST': {
      const stX = basePos.x + dir * (ballProg * 100);
      const pullY = (perc.ball.y - FH / 2) * 0.3;
      const targetX = clampNum(stX, dir > 0 ? 250 : 40, dir > 0 ? FW - 40 : 350);
      return vec(targetX, clampNum(FH / 2 + pullY, 100, FH - 100));
    }
    default:
      return basePos;
  }
}

// ─── Defend: posicionamento defensivo por zona ───────────────────────────────

function defendTarget(
  agent: ClassicPlayer,
  perc: AgentPerception,
  basePos: Vec2,
  dir: number,
  arch: typeof ARCHETYPES[keyof typeof ARCHETYPES],
): Vec2 {
  const role = agent.role.toUpperCase();
  const ballThreat = 1 - perc.ballProgress; // 1 = bola no nosso gol

  // Pressão: se bola na minha zona, mover em direção à bola (pressionar)
  const shouldPress = perc.ballInMyZone && perc.nearestOpponentDist < 80;
  const pressTowardBall = shouldPress ? 0.15 : 0;

  switch (role) {
    case 'CB': {
      // Fecha linha, comprime vertical quando bola perto
      const retreatX = basePos.x - dir * (ballThreat * 30);
      const compressY = (FH / 2 - basePos.y) * (ballThreat * 0.15);
      // Se bola na ala, desloca lateralmente pra cobrir
      const coverY = perc.ballLane !== 'center' ? (perc.ball.y - basePos.y) * 0.15 : 0;
      const pressX = pressTowardBall * (perc.ball.x - agent.position.x);
      return vec(
        clampNum(retreatX + pressX, 30, FW - 30),
        clampNum(basePos.y + compressY + coverY, 80, FH - 80),
      );
    }
    case 'LB':
    case 'RB': {
      const retreatX = basePos.x - dir * (ballThreat * 25);
      // Acompanha bola em Y se bola na ala dele
      const isMyWing = (role === 'LB' && perc.ballLane === 'left') ||
                       (role === 'RB' && perc.ballLane === 'right');
      const pullY = isMyWing ? (perc.ball.y - basePos.y) * 0.4 : 0;
      const pressX = (isMyWing && shouldPress) ? (perc.ball.x - agent.position.x) * 0.1 : 0;
      return vec(clampNum(retreatX + pressX, 30, FW - 30), clampNum(basePos.y + pullY, 15, FH - 15));
    }
    case 'DM': {
      // Escudo da defesa. Fica entre bola e CBs. Pressiona se bola na zona.
      const shieldX = basePos.x - dir * (ballThreat * 20);
      const pullY = (perc.ball.y - basePos.y) * 0.4;
      const pressX = pressTowardBall * (perc.ball.x - agent.position.x) * 0.8;
      return vec(clampNum(shieldX + pressX, 60, FW - 60), clampNum(basePos.y + pullY, 60, FH - 60));
    }
    case 'CM': {
      // Recua pra formar bloco. HUNTER pressiona mais.
      const pressBonus = agent.archetype === 'HUNTER' ? 25 : 0;
      const cmX = basePos.x - dir * (ballThreat * 40) + dir * pressBonus;
      const pullY = (perc.ball.y - basePos.y) * 0.3;
      // Se bola na minha zona, pressiono ativamente
      const activePress = perc.ballInMyZone ? (perc.ball.x - agent.position.x) * 0.12 : 0;
      return vec(clampNum(cmX + activePress, 80, FW - 80), clampNum(basePos.y + pullY, 50, FH - 50));
    }
    case 'AM':
    case 'MEI': {
      // Recua até o meio. Corta linhas de passe.
      const amX = basePos.x - dir * (ballThreat * 50);
      const cutLaneY = (perc.ball.y - basePos.y) * 0.2;
      return vec(clampNum(amX, 120, FW - 120), clampNum(basePos.y + cutLaneY, 50, FH - 50));
    }
    case 'LW':
    case 'RW': {
      // Pontas NÃO recuam além da linha da ZC. Fazem pressão alta na ala.
      const zaLineX = dir > 0 ? FW * 0.55 : FW * 0.45; // não recua além de 55%
      const wingX = Math.max(basePos.x - dir * (ballThreat * 20), dir > 0 ? zaLineX : 0);
      const wingXClamped = dir > 0 ? Math.max(wingX, zaLineX) : Math.min(wingX, zaLineX);
      const isMyWing = (role === 'LW' && perc.ballLane === 'left') ||
                       (role === 'RW' && perc.ballLane === 'right');
      const helpY = isMyWing ? (perc.ball.y - basePos.y) * 0.2 : 0;
      return vec(clampNum(wingXClamped, 50, FW - 50), clampNum(basePos.y + helpY, 15, FH - 15));
    }
    case 'ST': {
      // ST NUNCA recua além da linha da ZA. Faz pressão alta, corta saída de bola.
      const zaLineXSt = dir > 0 ? FW * 0.60 : FW * 0.40; // fica no terço final
      const stRetreat = arch.shotFreq > 0.7 ? 10 : 20;
      const stX = basePos.x - dir * (ballThreat * stRetreat);
      const stXClamped = dir > 0 ? Math.max(stX, zaLineXSt) : Math.min(stX, zaLineXSt);
      const cutY = (perc.ball.y - FH / 2) * 0.15;
      return vec(clampNum(stXClamped, 50, FW - 50), clampNum(FH / 2 + cutY, 120, FH - 120));
    }
    default:
      return basePos;
  }
}

// ─── Steering Forces ────────────────────────────────────────────────────────

function seek(from: Vec2, to: Vec2): Vec2 {
  const d = sub(to, from);
  const m = mag(d);
  if (m < 2) return vec(0, 0); // já chegou
  return normalize(d);
}

function separation(agent: ClassicPlayer, teammates: ClassicPlayer[]): Vec2 {
  let force = vec(0, 0);
  let count = 0;
  for (const tm of teammates) {
    const d = dist(agent.position, tm.position);
    if (d > 0 && d < SEPARATION_RADIUS) {
      const away = normalize(sub(agent.position, tm.position));
      const strength = 1 - d / SEPARATION_RADIUS; // mais forte quanto mais perto
      force = add(force, scale(away, strength));
      count++;
    }
  }
  return count > 0 ? normalize(force) : vec(0, 0);
}

// ─── Wander: micro-movimento que mantém jogadores "vivos" ────────────────────

/** Estado de wander por jogador (ângulo atual). */
const wanderAngles = new Map<number, number>();

function wander(playerId: number): Vec2 {
  let angle = wanderAngles.get(playerId) ?? (Math.random() * Math.PI * 2);
  // Jitter: muda o ângulo levemente a cada tick
  angle += (Math.random() - 0.5) * 0.8;
  wanderAngles.set(playerId, angle);
  return vec(Math.cos(angle), Math.sin(angle));
}

// ─── Profile Weights: perfil do jogador modula comportamento ─────────────────

interface ProfileWeights {
  anchorMod: number;      // multiplica anchor (disciplina tática)
  advanceSpeedMod: number; // multiplica velocidade de avanço (runTiming)
  creativityOffset: number; // offset lateral aleatório (criatividade)
  wanderStrength: number;  // amplitude do wander (spatialAwareness inverso)
  egoAdvance: number;      // avanço extra por ego
}

function getProfileWeights(agent: ClassicPlayer): ProfileWeights {
  const arch = ARCHETYPES[agent.archetype];

  // Mapeia archetype → perfil aproximado (sem depender de AgentProfile externo)
  // tacticalDiscipline: VETERAN/MAESTRO alto, WILD baixo
  const discipline = arch.slowsRhythm ? 0.9 : arch.unpredictable ? 0.4 : 0.7;
  // runTiming: ENGINE/HUNTER alto, VETERAN baixo
  const runTiming = arch.stamina > 0.85 ? 0.9 : arch.stamina < 0.7 ? 0.5 : 0.7;
  // creativity: MAESTRO/WILD alto, DESTROYER baixo
  const creativity = arch.passFreq > 0.8 ? 0.8 : arch.unpredictable ? 0.9 : arch.tackleFreq > 0.7 ? 0.2 : 0.5;
  // spatialAwareness: MAESTRO/VETERAN alto, WILD baixo
  const awareness = arch.slowsRhythm ? 0.9 : arch.unpredictable ? 0.5 : 0.7;
  // ego: FINISHER/WILD alto, ENGINE baixo
  const ego = arch.shotFreq > 0.7 ? 0.8 : arch.unpredictable ? 0.7 : 0.3;

  return {
    anchorMod: 0.7 + discipline * 0.6,        // 0.7 - 1.3x
    advanceSpeedMod: 0.7 + runTiming * 0.6,   // 0.7 - 1.3x
    creativityOffset: creativity * 12,          // 0 - 12px offset lateral
    wanderStrength: (1 - awareness) * 1.5 + 0.5, // 0.5 - 2.0 amplitude
    egoAdvance: ego * 15,                       // 0 - 15px extra pra frente
  };
}

function computeSteering(
  agent: ClassicPlayer,
  target: Vec2,
  allPlayers: ClassicPlayer[],
  perc: AgentPerception,
  basePos: Vec2,
): Vec2 {
  const teammates = allPlayers.filter(p => p.team === agent.team && p.id !== agent.id);
  const profile = getProfileWeights(agent);

  // Pesos adaptativos (modulados por perfil)
  const zone = zoneFromRole(agent.role);
  const baseAnchor = zone === 'defense' ? 0.35 : zone === 'creative' ? 0.20 : 0.10;
  const anchorWeight = baseAnchor * profile.anchorMod;
  const separationWeight = 0.7;
  const seekWeight = 1.0;

  // Força de seek ao target
  const seekForce = scale(seek(agent.position, target), seekWeight);

  // Separação de companheiros
  const sepForce = scale(separation(agent, teammates), separationWeight);

  // Âncora à base (modulada por disciplina tática)
  const anchorForce = scale(seek(agent.position, basePos), anchorWeight * (1 - perc.ballProgress * 0.5));

  // Wander: micro-movimento quando perto do target (jogador "vivo")
  const distToTarget = dist(agent.position, target);
  const wanderWeight = distToTarget < 20 ? profile.wanderStrength * 0.4 : profile.wanderStrength * 0.1;
  const wanderForce = scale(wander(agent.id), wanderWeight);

  // Soma ponderada
  let total = add(add(add(seekForce, sepForce), anchorForce), wanderForce);

  // Creativity: offset lateral imprevisível (jogadores criativos buscam posições inesperadas)
  if (profile.creativityOffset > 0 && perc.myTeamHasBall) {
    const creativeAngle = (wanderAngles.get(agent.id) ?? 0) * 0.3;
    total = add(total, vec(0, Math.sin(creativeAngle) * profile.creativityOffset * 0.05));
  }

  // Ego: atacantes com ego alto avançam mais
  if (zone === 'attack' && perc.myTeamHasBall) {
    const dir = agent.team === 'home' ? 1 : -1;
    total = add(total, vec(dir * profile.egoAdvance * 0.02, 0));
  }

  // Mental modifiers
  if (agent.onFire) {
    const dir = agent.team === 'home' ? 1 : -1;
    total = add(total, vec(dir * 0.3, 0));
  }
  const mental = agent.mental;
  if (mental && mental.anxiousScore > 60) {
    const dir = agent.team === 'home' ? -1 : 1;
    total = add(total, vec(dir * 0.2, 0));
  }

  // Fatigue: reduz velocidade máxima
  const fatigueMultiplier = agent.fatigue > 80 ? 0.6 : agent.fatigue > 60 ? 0.8 : 1.0;

  // RunTiming: modula velocidade geral de deslocamento
  const speedMod = profile.advanceSpeedMod;

  return clampMag(total, MAX_SPEED * fatigueMultiplier * speedMod);
}

// ─── Tick ───────────────────────────────────────────────────────────────────

interface TickContext {
  ball: Vec2;
  possession: 'home' | 'away' | null;
  minute: number;
  carrierId: number | null;
}

/** Velocidades persistentes por jogador (sobrevive a spreads do React state). */
const velocities = new Map<number, Vec2>();

/**
 * Atualiza todos os agentes em um tick.
 * Chamado a cada 66ms pelo movement loop.
 * Retorna novos players com posições atualizadas.
 */
export function tickAllAgents(
  players: ClassicPlayer[],
  ctx: TickContext,
  basePositions: Map<number, Vec2>,
): ClassicPlayer[] {
  return players.map(player => {
    const basePos = basePositions.get(player.id) ?? player.position;

    // 1. Percepção
    const perc = perceive(player, players, ctx.ball, ctx.possession, ctx.carrierId);

    // 2. Decisão: onde quero ir
    const target = decideTarget(player, perc, basePos);

    // 3. Steering: como chego lá
    const steering = computeSteering(player, target, players, perc, basePos);

    // 4. Movimento com inércia
    const prevVel = velocities.get(player.id) ?? vec(0, 0);
    const newVel = lerp2(prevVel, steering, 1 - INERTIA);
    velocities.set(player.id, newVel);

    // 5. Nova posição (clamped ao campo)
    const newPos = {
      x: clampNum(player.position.x + newVel.x, 15, FW - 15),
      y: clampNum(player.position.y + newVel.y, 15, FH - 15),
    };

    return { ...player, position: newPos };
  });
}

/**
 * Extrai basePositions dos slots iniciais da formação.
 * Chamado uma vez no início da partida.
 */
export function extractBasePositions(players: ClassicPlayer[]): Map<number, Vec2> {
  const map = new Map<number, Vec2>();
  for (const p of players) {
    map.set(p.id, { x: p.position.x, y: p.position.y });
  }
  return map;
}

/**
 * Reseta jogadores para suas posições de formação (base).
 * Usado após gol (todos voltam) e no intervalo.
 * Também limpa velocidades acumuladas.
 */
export function resetPlayersToBase(
  players: ClassicPlayer[],
  basePositions: Map<number, Vec2>,
): ClassicPlayer[] {
  velocities.clear(); // limpa inércia
  return players.map(p => {
    const base = basePositions.get(p.id);
    if (!base) return p;
    return { ...p, position: { x: base.x, y: base.y } };
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function clampNum(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
