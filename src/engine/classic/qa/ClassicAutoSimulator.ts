/**
 * ClassicAutoSimulator — runs headless Classic matches for QA analysis.
 * No UI, no timers — pure event generation loop.
 *
 * Key insight: in the real game, players move toward the ball zone.
 * In headless mode we simulate this by advancing attacking players
 * toward the current sequence zone before each event.
 */

import { generateEvent, type GenerateEventResult, type GenerateEventOptions } from '../eventGenerator';
import { getHomePlayers, getAwayPlayers } from '../formations';
import type { ClassicPlayer, MatchEvent, MatchScore, EventChainContext, PassStyle } from '../types';
import { FIELD_W_LOGIC, FIELD_H_LOGIC } from '../formations';

export interface SimulatedMatch {
  id: number;
  events: MatchEvent[];
  score: MatchScore;
  homeFormation: string;
  awayFormation: string;
  players: ClassicPlayer[];
  passStyle: PassStyle;
}

export interface SimulationConfig {
  matchCount: number;
  eventsPerMatch: number;
  passStyles: PassStyle[];
}

const DEFAULT_SIM_CONFIG: SimulationConfig = {
  matchCount: 100,
  eventsPerMatch: 200,
  passStyles: ['TIKTAK', 'LONGO', 'LATERAL', 'COUNTER'],
};

const ZONE_POS: Record<string, { x: number; y: number }> = {
  Z1C: { x: 60, y: 200 }, Z1E: { x: 60, y: 60 }, Z1D: { x: 60, y: 340 },
  Z2C: { x: 180, y: 200 }, Z2E: { x: 180, y: 60 }, Z2D: { x: 180, y: 340 }, Z2HS: { x: 200, y: 130 },
  Z3C: { x: 360, y: 200 }, Z3E: { x: 360, y: 60 }, Z3D: { x: 360, y: 340 }, Z3HS: { x: 340, y: 130 },
  Z4C: { x: 500, y: 200 }, Z4E: { x: 500, y: 60 }, Z4D: { x: 500, y: 340 }, Z4HS: { x: 480, y: 130 },
};

function advancePlayersForZone(
  players: ClassicPlayer[],
  zone: string | undefined,
  attackingTeam: 'home' | 'away',
): void {
  if (!zone) return;
  const zonePos = ZONE_POS[zone];
  if (!zonePos) return;

  const zoneXRel = zonePos.x / FIELD_W_LOGIC;

  for (const p of players) {
    if (p.role === 'GK') continue;
    const isAttacking = p.team === attackingTeam;

    if (isAttacking) {
      // Advance attacking players toward the zone with some spread
      const baseX = p.team === 'home' ? zonePos.x : FIELD_W_LOGIC - zonePos.x;
      const roleOffset = p.role === 'ST' ? 40 : p.role === 'LW' || p.role === 'RW' ? 20 :
        p.role === 'CM' || p.role === 'DM' ? -60 : p.role === 'CB' ? -140 : -100;
      const targetX = Math.max(30, Math.min(FIELD_W_LOGIC - 30, baseX + roleOffset));
      // Blend toward target (simulate gradual movement)
      p.position.x = p.position.x * 0.3 + targetX * 0.7;
    } else {
      // Defending team compresses toward own goal
      const ownGoalX = p.team === 'home' ? 30 : FIELD_W_LOGIC - 30;
      const retreatTarget = ownGoalX + (p.team === 'home' ? 1 : -1) * (
        p.role === 'CB' ? 60 : p.role === 'LB' || p.role === 'RB' ? 80 :
        p.role === 'DM' ? 120 : p.role === 'CM' ? 150 : 200
      );
      p.position.x = p.position.x * 0.4 + retreatTarget * 0.6;
    }
    // Clamp
    p.position.x = Math.max(20, Math.min(FIELD_W_LOGIC - 20, p.position.x));
  }
}

function resetPositions(players: ClassicPlayer[], home: ClassicPlayer[], away: ClassicPlayer[]): void {
  for (let i = 0; i < players.length; i++) {
    const src = i < home.length ? home[i] : away[i - home.length];
    players[i].position.x = src.position.x;
    players[i].position.y = src.position.y;
  }
}

export function simulateMatch(matchId: number, config?: Partial<SimulationConfig>): SimulatedMatch {
  const eventsPerMatch = config?.eventsPerMatch ?? DEFAULT_SIM_CONFIG.eventsPerMatch;
  const passStyles = config?.passStyles ?? DEFAULT_SIM_CONFIG.passStyles;

  const homePlayers = getHomePlayers();
  const awayPlayers = getAwayPlayers();
  const allPlayers: ClassicPlayer[] = [...homePlayers, ...awayPlayers];

  // Store original positions for reset
  const homeOrig = homePlayers.map(p => ({ ...p, position: { ...p.position } }));
  const awayOrig = awayPlayers.map(p => ({ ...p, position: { ...p.position } }));

  const score: MatchScore = { home: 0, away: 0 };
  const events: MatchEvent[] = [];

  let possession: 'home' | 'away' = Math.random() < 0.5 ? 'home' : 'away';
  let chain: EventChainContext | null = null;
  let sequence: { zones: string[]; index: number } | null = null;
  const passStyle: PassStyle = passStyles[Math.floor(Math.random() * passStyles.length)];

  for (let i = 0; i < eventsPerMatch; i++) {
    const minute = Math.floor((i / eventsPerMatch) * 93) + 1;

    // Advance player positions based on current zone
    const currentZone = sequence ? sequence.zones[sequence.index] : undefined;
    advancePlayersForZone(allPlayers, currentZone, possession);

    const opts: GenerateEventOptions = {
      activeSkills: [],
      chain,
      passStyle,
      sequence: sequence ?? undefined,
    };

    const result: GenerateEventResult = generateEvent(allPlayers, minute, score, possession, opts);
    events.push(result.event);

    if (result.event.type === 'goal') {
      if (result.event.team === 'home') score.home++;
      else score.away++;
    }

    chain = {
      lastType: result.event.type,
      lastTeam: result.event.team,
      chainCount: chain ? chain.chainCount + 1 : 1,
    };

    sequence = result.nextSequence;

    const possessionChangers = ['tackle', 'interception', 'foul', 'goal', 'save', 'wide', 'corner', 'duel'];
    if (possessionChangers.includes(result.event.type)) {
      if (result.event.type === 'goal') {
        possession = result.event.team === 'home' ? 'away' : 'home';
      } else {
        possession = result.event.team === 'home' ? 'home' : 'away';
      }
      sequence = null;
      // Reset positions on possession change
      resetPositions(allPlayers, homeOrig as ClassicPlayer[], awayOrig as ClassicPlayer[]);
    }
  }

  return {
    id: matchId,
    events,
    score,
    homeFormation: '4-3-3',
    awayFormation: '4-3-3',
    players: allPlayers,
    passStyle,
  };
}

export function simulateBatch(config?: Partial<SimulationConfig>): SimulatedMatch[] {
  const matchCount = config?.matchCount ?? DEFAULT_SIM_CONFIG.matchCount;
  const matches: SimulatedMatch[] = [];

  for (let i = 0; i < matchCount; i++) {
    matches.push(simulateMatch(i, config));
  }

  return matches;
}
