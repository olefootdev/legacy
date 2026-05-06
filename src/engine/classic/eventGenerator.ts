import type { ClassicPlayer, MatchEvent, EventType, MatchScore } from './types';
import { ARCHETYPES } from './archetypes';
import { generateNarration } from './narration';
import { FIELD_W_LOGIC, FIELD_H_LOGIC } from './formations';

let _eventCounter = 0;

function rng(): number { return Math.random(); }

function pickPlayer(players: ClassicPlayer[]): ClassicPlayer {
  return players[Math.floor(rng() * players.length)];
}

function fieldPosNear(player: ClassicPlayer, spread = 60): { x: number; y: number } {
  return {
    x: Math.max(20, Math.min(FIELD_W_LOGIC - 20, player.position.x + (rng() - 0.5) * spread)),
    y: Math.max(20, Math.min(FIELD_H_LOGIC - 20, player.position.y + (rng() - 0.5) * spread)),
  };
}

function goalMouthPos(team: 'home' | 'away'): { x: number; y: number } {
  return {
    x: team === 'home' ? FIELD_W_LOGIC - 30 : 30,
    y: FIELD_H_LOGIC / 2 + (rng() - 0.5) * 60,
  };
}

function chooseEventType(player: ClassicPlayer, minute: number, score: MatchScore): EventType {
  const cfg = ARCHETYPES[player.archetype];
  const tension = minute > 70 ? 1.4 : 1.0;
  const r = rng();

  // Weight by archetype
  const weights: Array<[EventType, number]> = [
    ['shot',         cfg.shotFreq * tension * 0.25],
    ['pass',         cfg.passFreq * 0.35],
    ['tackle',       cfg.tackleFreq * 0.2],
    ['interception', cfg.interceptionFreq * 0.15],
    ['cross',        0.1],
    ['pressure',     cfg.pressureFreq * 0.1],
    ['foul',         cfg.foulFreq * 0.1],
    ['corner',       0.04],
  ];

  let total = weights.reduce((s, [, w]) => s + w, 0);
  let acc = 0;
  for (const [type, w] of weights) {
    acc += w / total;
    if (r < acc) return type;
  }
  return 'pass';
}

function isGoal(player: ClassicPlayer, type: EventType): boolean {
  if (type !== 'shot') return false;
  const cfg = ARCHETYPES[player.archetype];
  const base = 0.18;
  const bonus = cfg.shotFreq * 0.12 + (cfg.stressImmune ? 0.04 : 0);
  return rng() < base + bonus;
}

export function generateEvent(
  allPlayers: ClassicPlayer[],
  minute: number,
  score: MatchScore,
  possession: 'home' | 'away',
): MatchEvent {
  const team = rng() < 0.55 ? possession : (possession === 'home' ? 'away' : 'home');
  const teamPlayers = allPlayers.filter(p => p.team === team);
  const player = pickPlayer(teamPlayers);
  const eventType = chooseEventType(player, minute, score);

  let type = eventType;
  let ballPos: { x: number; y: number };

  if (type === 'shot' && isGoal(player, type)) {
    type = 'goal';
    ballPos = goalMouthPos(team);
  } else if (type === 'shot' || type === 'cross') {
    ballPos = goalMouthPos(team);
  } else {
    ballPos = fieldPosNear(player, 80);
  }

  const text = generateNarration(type, player.archetype, player.shortName, team === 'home' ? 'Tigres' : 'Alvorada');

  return {
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
  };
}
