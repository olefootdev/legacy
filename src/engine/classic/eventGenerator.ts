import type { ClassicPlayer, MatchEvent, EventType, MatchScore, ManagerSkillId, EventChainContext, PassStyle } from './types';
import { ARCHETYPES } from './archetypes';
import { generateNarration } from './narration';
import { FIELD_W_LOGIC, FIELD_H_LOGIC } from './formations';

let _eventCounter = 0;

function rng(): number { return Math.random(); }

function pickPlayer(players: ClassicPlayer[]): ClassicPlayer {
  const weights = players.map(p => 0.5 + (p.confidence / 100) * 0.5);
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rng() * total;
  for (let i = 0; i < players.length; i++) {
    r -= weights[i];
    if (r <= 0) return players[i];
  }
  return players[players.length - 1];
}

// ── Zonas do campo (AP-FOOTBALL-KNOWLEDGE seção 3) ───────────────────────────
// Zona 1=Defensiva, 2=Construção, 3=Criação, 4=Finalização
// Corredores: C=Central, E=Esquerdo, D=Direito, HS=Half-space
const ZONE_POS: Record<string, { x: number; y: number }> = {
  // Zona 1 — Defensiva (0–25%)
  Z1C:  { x: 60,  y: 200 },
  Z1E:  { x: 60,  y: 60  },
  Z1D:  { x: 60,  y: 340 },
  // Zona 2 — Construção (25–50%)
  Z2C:  { x: 180, y: 200 },
  Z2E:  { x: 180, y: 60  },
  Z2D:  { x: 180, y: 340 },
  Z2HS: { x: 200, y: 130 },
  // Zona 3 — Criação (50–75%) — half-spaces são a zona mais perigosa
  Z3C:  { x: 360, y: 200 },
  Z3E:  { x: 360, y: 60  },
  Z3D:  { x: 360, y: 340 },
  Z3HS: { x: 340, y: 130 },
  // Zona 4 — Finalização (75–100%) — Zona 14 = corredor central à frente da área
  Z4C:  { x: 500, y: 200 }, // Zona 14
  Z4E:  { x: 500, y: 60  },
  Z4D:  { x: 500, y: 340 },
  Z4HS: { x: 480, y: 130 },
};

// Sequências de progressão por PassStyle — baseadas nos princípios do AP-FOOTBALL-KNOWLEDGE
// TIKTAK: circulação curta, aciona todos os jogadores zona a zona (Circulação + Apoio)
// LONGO: bola direta, pula zonas (Profundidade + Desmarque de ruptura)
// LATERAL: amplitude nos corredores (Amplitude + Overlap lateral)
// COUNTER: transição ofensiva rápida após recuperação (Transição Ofensiva)
const PASS_SEQUENCES: Record<PassStyle, string[][]> = {
  TIKTAK: [
    ['Z1C', 'Z2C', 'Z2HS', 'Z3C', 'Z3HS', 'Z4C'],   // construção central com half-spaces
    ['Z1C', 'Z2E', 'Z2C', 'Z3C', 'Z3HS', 'Z4C'],    // saída pela esquerda, centraliza
    ['Z1C', 'Z2D', 'Z2C', 'Z3C', 'Z3HS', 'Z4C'],    // saída pela direita, centraliza
    ['Z2C', 'Z2HS', 'Z3HS', 'Z3C', 'Z4HS', 'Z4C'],  // half-space dominante
  ],
  LONGO: [
    ['Z1C', 'Z4C'],           // lançamento direto ao ST
    ['Z1C', 'Z3C', 'Z4C'],   // longo com apoio no meio
    ['Z2C', 'Z4E'],           // diagonal longa para a ponta
    ['Z2C', 'Z4D'],           // diagonal longa para a ponta direita
  ],
  LATERAL: [
    ['Z2C', 'Z2E', 'Z3E', 'Z3C', 'Z4C'],   // amplitude esquerda → centraliza
    ['Z2C', 'Z2D', 'Z3D', 'Z3C', 'Z4C'],   // amplitude direita → centraliza
    ['Z3C', 'Z3E', 'Z4E', 'Z4C'],           // cruzamento da esquerda
    ['Z3C', 'Z3D', 'Z4D', 'Z4C'],           // cruzamento da direita
    ['Z2E', 'Z2D', 'Z3D', 'Z4C'],           // mudança de corredor (basculamento)
  ],
  COUNTER: [
    ['Z2C', 'Z3C', 'Z4C'],   // transição rápida central
    ['Z1C', 'Z3E', 'Z4C'],   // contra-ataque pela esquerda
    ['Z1C', 'Z3D', 'Z4C'],   // contra-ataque pela direita
    ['Z2C', 'Z4HS', 'Z4C'],  // profundidade direta ao half-space
  ],
};

// Roles por zona — quem deve receber a bola em cada zona (seção 7 AP-FOOTBALL-KNOWLEDGE)
const ZONE_ROLES: Record<string, string[]> = {
  Z1C:  ['GK', 'CB'],
  Z1E:  ['GK', 'LB'],
  Z1D:  ['GK', 'RB'],
  Z2C:  ['CB', 'DM', 'CM'],
  Z2E:  ['LB', 'LW', 'CM'],
  Z2D:  ['RB', 'RW', 'CM'],
  Z2HS: ['CM', 'DM'],
  Z3C:  ['CM', 'DM', 'ST'],
  Z3E:  ['LW', 'LB', 'CM'],
  Z3D:  ['RW', 'RB', 'CM'],
  Z3HS: ['CM', 'ST', 'LW', 'RW'],
  Z4C:  ['ST', 'CM', 'LW', 'RW'],  // Zona 14
  Z4E:  ['LW', 'ST'],
  Z4D:  ['RW', 'ST'],
  Z4HS: ['ST', 'LW', 'RW', 'CM'],
};

function zoneToBallPos(zone: string, team: 'home' | 'away'): { x: number; y: number } {
  const base = ZONE_POS[zone] ?? { x: FIELD_W_LOGIC / 2, y: FIELD_H_LOGIC / 2 };
  const x = team === 'away' ? FIELD_W_LOGIC - base.x : base.x;
  const jitter = 20;
  return {
    x: Math.max(20, Math.min(FIELD_W_LOGIC - 20, x + (rng() - 0.5) * jitter)),
    y: Math.max(20, Math.min(FIELD_H_LOGIC - 20, base.y + (rng() - 0.5) * jitter)),
  };
}

function goalMouthPos(team: 'home' | 'away'): { x: number; y: number } {
  return {
    x: team === 'home' ? FIELD_W_LOGIC - 30 : 30,
    y: FIELD_H_LOGIC / 2 + (rng() - 0.5) * 60,
  };
}

// Escolhe o jogador mais adequado para a zona atual da sequência
function pickPlayerForZone(
  players: ClassicPlayer[],
  zone: string,
  team: 'home' | 'away',
  excludeId?: number,
): ClassicPlayer {
  const teamPlayers = players.filter(p => p.team === team && p.id !== excludeId);
  const preferredRoles = ZONE_ROLES[zone] ?? [];
  const preferred = teamPlayers.filter(p => preferredRoles.includes(p.role));
  const pool = preferred.length > 0 ? preferred : teamPlayers;
  return pickPlayer(pool);
}

function chooseEventType(
  player: ClassicPlayer,
  minute: number,
  score: MatchScore,
  activeSkills: ManagerSkillId[],
  chain: EventChainContext | null,
  passStyle: PassStyle,
  zoneIndex: number,   // posição na sequência (0=início, último=finalização)
  sequenceLen: number,
): EventType {
  const cfg = ARCHETYPES[player.archetype];
  const tension = minute > 70 ? 1.4 : 1.0;
  const fatigueFactor = player.fatigue > 70 ? 0.7 : player.fatigue > 85 ? 0.5 : 1.0;
  const foulBoost = player.fatigue > 70 ? 1.5 : 1.0;
  const confBoost = player.onFire ? 1.35 : 1.0;

  const pressBoost   = activeSkills.includes('press')   ? 1.6 : 1.0;
  const crossBoost   = activeSkills.includes('cross')   ? 1.6 : 1.0;
  const offensBoost  = activeSkills.includes('offens')  ? 1.4 : 1.0;

  // Chained events
  let chainShotBoost = 1.0, chainPassBoost = 1.0, chainTackleBoost = 1.0;
  if (chain) {
    if (chain.lastType === 'corner')       chainShotBoost = 2.5;
    if (chain.lastType === 'cross')        chainShotBoost = 2.0;
    if (chain.lastType === 'tackle')       chainPassBoost = 1.8;
    if (chain.lastType === 'interception') chainPassBoost = 2.0;
    if (chain.lastType === 'foul')         chainShotBoost = 1.6;
    if (chain.lastType === 'pressure')     chainTackleBoost = 1.5;
  }

  // Na última zona da sequência → muito mais chance de chute
  const isFinalizingZone = zoneIndex >= sequenceLen - 1;
  const shotZoneBoost = isFinalizingZone ? 3.0 : 0.4;

  // PassStyle modifica o tipo de evento em cada zona
  const stylePassBoost = passStyle === 'TIKTAK' ? 1.8
    : passStyle === 'LATERAL' ? 1.4
    : passStyle === 'COUNTER' ? 0.8  // counter prefere chute rápido
    : 1.0;

  const styleCrossBoost = passStyle === 'LATERAL' ? 2.0 : 1.0;

  const r = rng();
  const weights: Array<[EventType, number]> = [
    ['shot',         cfg.shotFreq * tension * 0.25 * fatigueFactor * confBoost * offensBoost * chainShotBoost * shotZoneBoost],
    ['pass',         cfg.passFreq * 0.35 * chainPassBoost * stylePassBoost],
    ['tackle',       cfg.tackleFreq * 0.2 * chainTackleBoost],
    ['interception', cfg.interceptionFreq * 0.15 * pressBoost],
    ['cross',        0.1 * crossBoost * styleCrossBoost],
    ['pressure',     cfg.pressureFreq * 0.1 * pressBoost],
    ['foul',         cfg.foulFreq * 0.1 * foulBoost],
    ['corner',       0.04],
    ['danger',       isFinalizingZone ? 0.12 : 0.02],
  ];

  const total = weights.reduce((s, [, w]) => s + w, 0);
  let acc = 0;
  for (const [type, w] of weights) {
    acc += w / total;
    if (r < acc) return type;
  }
  return 'pass';
}

function isGoal(player: ClassicPlayer, type: EventType, score: MatchScore, minute: number): boolean {
  if (type !== 'shot') return false;
  const cfg = ARCHETYPES[player.archetype];
  const base = 0.18;
  const confBonus = player.onFire ? 0.08 : 0;
  const urgencyBonus = (score.home !== score.away && minute > 75) ? 0.04 : 0;
  const bonus = cfg.shotFreq * 0.12 + (cfg.stressImmune ? 0.04 : 0) + confBonus + urgencyBonus;
  return rng() < base + bonus;
}

export interface GenerateEventOptions {
  activeSkills?: ManagerSkillId[];
  chain?: EventChainContext | null;
  passStyle?: PassStyle;
  // Sequência em andamento — se fornecida, continua a jogada
  sequence?: { zones: string[]; index: number };
}

export interface GenerateEventResult {
  event: MatchEvent;
  // Próxima sequência a continuar (se a jogada não terminou)
  nextSequence: { zones: string[]; index: number } | null;
  // Jogador que recebeu (para conexão visual)
  receiverId: number | null;
}

export function generateEvent(
  allPlayers: ClassicPlayer[],
  minute: number,
  score: MatchScore,
  possession: 'home' | 'away',
  opts: GenerateEventOptions = {},
): GenerateEventResult {
  const { activeSkills = [], chain = null, passStyle = 'TIKTAK' } = opts;

  const counterActive = activeSkills.includes('counter');
  const possessionBias = counterActive ? 0.45 : 0.55;
  const team = rng() < possessionBias ? possession : (possession === 'home' ? 'away' : 'home');

  // ── Progressão por sequência ──────────────────────────────────────────────
  let sequence = opts.sequence;
  let zoneIndex = 0;

  if (!sequence || sequence.index >= sequence.zones.length) {
    // Inicia nova sequência baseada no PassStyle
    const styleKey: PassStyle = counterActive ? 'COUNTER' : passStyle;
    const options = PASS_SEQUENCES[styleKey];
    const zones = options[Math.floor(rng() * options.length)];
    sequence = { zones, index: 0 };
  }

  zoneIndex = sequence.index;
  const currentZone = sequence.zones[zoneIndex];
  const isLastZone = zoneIndex >= sequence.zones.length - 1;

  // Portador: jogador na zona atual (quem tem a bola agora)
  const player = pickPlayerForZone(allPlayers, currentZone, team);
  const eventType = chooseEventType(player, minute, score, activeSkills, chain, passStyle, zoneIndex, sequence.zones.length);

  let type = eventType;
  let ballPos: { x: number; y: number };
  let receiverId: number | null = null;

  if (type === 'shot' && isGoal(player, type, score, minute)) {
    type = 'goal';
    // Bola vai para a boca do gol adversário
    ballPos = goalMouthPos(team);
  } else if (type === 'shot' || type === 'cross' || type === 'danger') {
    ballPos = goalMouthPos(team);
  } else if (type === 'pass' && !isLastZone) {
    // CORREÇÃO PRINCIPAL: bola vai para a zona do RECEPTOR, não do portador
    const nextZone = sequence.zones[zoneIndex + 1];
    const receiver = pickPlayerForZone(allPlayers, nextZone, team, player.id);
    receiverId = receiver.id;
    // A bola vai para onde o receptor está — posição real do jogador
    ballPos = {
      x: receiver.position.x + (rng() - 0.5) * 15,
      y: receiver.position.y + (rng() - 0.5) * 15,
    };
  } else {
    // tackle, interception, foul, pressure — bola fica perto do portador
    ballPos = {
      x: Math.max(20, Math.min(FIELD_W_LOGIC - 20, player.position.x + (rng() - 0.5) * 25)),
      y: Math.max(20, Math.min(FIELD_H_LOGIC - 20, player.position.y + (rng() - 0.5) * 25)),
    };
  }

  const teamName = team === 'home' ? 'Tigres' : 'Alvorada';
  const text = generateNarration(type, player.archetype, player.shortName, teamName, minute, score);

  const event: MatchEvent = {
    id: `evt_${++_eventCounter}`,
    minute,
    type,
    team,
    playerId: player.id,
    playerName: player.shortName,
    archetype: player.archetype,
    text,
    ballX: ballPos.x,
    ballY: ballPos.y,
    receiverPlayerId: receiverId ?? undefined,
  };

  // Avança a sequência se foi um passe, senão reseta
  const sequenceEnded = type === 'goal' || type === 'shot' || type === 'tackle' ||
    type === 'interception' || type === 'foul' || isLastZone;

  const nextSequence = sequenceEnded
    ? null
    : { zones: sequence.zones, index: zoneIndex + 1 };

  return { event, nextSequence, receiverId };
}

export function applyEventToPlayers(
  players: ClassicPlayer[],
  evt: MatchEvent,
): ClassicPlayer[] {
  return players.map(p => {
    if (p.id !== evt.playerId) return p;

    let fatigue = Math.min(100, p.fatigue + (evt.type === 'pressure' || evt.type === 'tackle' ? 3 : 1));
    let confidence = p.confidence;

    if (evt.type === 'goal')       confidence = Math.min(100, confidence + 20);
    else if (evt.type === 'interception' || evt.type === 'tackle') confidence = Math.min(100, confidence + 8);
    else if (evt.type === 'shot')  confidence = Math.min(100, confidence + 4);
    else if (evt.type === 'pass' && p.archetype === 'FINISHER' && evt.minute > 80) confidence = Math.max(0, confidence - 8);

    if (fatigue > 80) confidence = Math.max(0, confidence - 3);

    const onFire = confidence > 85;
    return { ...p, fatigue, confidence, onFire };
  });
}
