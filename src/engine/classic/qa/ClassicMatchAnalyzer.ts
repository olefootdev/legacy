/**
 * ClassicMatchAnalyzer — collects per-position metrics from simulated matches.
 */

import type { MatchEvent } from '../types';
import { zoneFromRole } from '../types';
import type { SimulatedMatch } from './ClassicAutoSimulator';

export type RoleGroup = 'ST' | 'LW' | 'RW' | 'CAM' | 'CM' | 'DM' | 'LB' | 'RB' | 'CB' | 'GK';

export interface PositionMetrics {
  shots: number;
  goals: number;
  passes: number;
  crosses: number;
  chancesCreated: number;
}

export interface CommandStyleMetrics {
  matches: number;
  passes: number;
  crosses: number;
  shots: number;
  longPasses: number;
  quickPasses: number;
  plannedPasses: number;
  midfielderTouches: number;
}

export interface MatchAnalysis {
  totalMatches: number;
  totalGoals: number;
  totalShots: number;
  avgGoalsPerMatch: number;
  avgShotsPerMatch: number;

  shotsByPosition: Record<RoleGroup, number>;
  goalsByPosition: Record<RoleGroup, number>;
  crossesByPosition: Record<RoleGroup, number>;

  invalidShots: number;
  invalidGoals: number;
  goalsWithoutChanceCreated: number;
  goalsWithoutBuildUp: number;
  defenderOpenPlayGoals: number;
  fullbackShots: number;
  fullbackGoals: number;

  strikerShotZoneRate: number;
  strikerBoxShotRate: number; // backwards-compatible alias for strikerShotZoneRate
  strikerReceiveThenShotRate: number;
  strikerReceivedInBoxAndShot: number;
  strikerReceivedInBoxTotal: number;

  duelEvents: number;
  duelsPerMatch: number;
  skillEvents: number;
  timelineEligibleEvents: number;
  timelineEligibleEventsPerMatch: number;
  commandStyleMetrics: Record<string, CommandStyleMetrics>;

  buildUpChainAvg: number;
  chanceCreatedBeforeGoalPct: number;
}

function normalizeRole(role: string | undefined): RoleGroup {
  if (!role) return 'CM';
  const r = role.toUpperCase();
  if (r === 'ST' || r === 'CF') return 'ST';
  if (r === 'LW') return 'LW';
  if (r === 'RW') return 'RW';
  if (r === 'AM' || r === 'CAM' || r === 'MEI') return 'CAM';
  if (r === 'CM') return 'CM';
  if (r === 'DM' || r === 'CDM') return 'DM';
  if (r === 'LB' || r === 'LWB') return 'LB';
  if (r === 'RB' || r === 'RWB') return 'RB';
  if (r === 'CB') return 'CB';
  if (r === 'GK') return 'GK';
  return 'CM';
}

function emptyPositionMap(): Record<RoleGroup, number> {
  return { ST: 0, LW: 0, RW: 0, CAM: 0, CM: 0, DM: 0, LB: 0, RB: 0, CB: 0, GK: 0 };
}

function emptyCommandMetrics(): CommandStyleMetrics {
  return {
    matches: 0,
    passes: 0,
    crosses: 0,
    shots: 0,
    longPasses: 0,
    quickPasses: 0,
    plannedPasses: 0,
    midfielderTouches: 0,
  };
}

function isTimelineEligible(evt: MatchEvent): boolean {
  return ['goal', 'save', 'wide', 'post', 'shot', 'danger', 'interception', 'duel', 'cross', 'blocked'].includes(evt.type) ||
    !!evt.skillActivated || !!evt.chanceCreated;
}

function isDefenderRole(role: RoleGroup): boolean {
  return role === 'CB' || role === 'LB' || role === 'RB';
}

function isFullbackRole(role: RoleGroup): boolean {
  return role === 'LB' || role === 'RB';
}

function isSetPieceContext(events: MatchEvent[], goalIdx: number): boolean {
  for (let i = Math.max(0, goalIdx - 3); i < goalIdx; i++) {
    const t = events[i].type;
    if (t === 'corner' || t === 'foul') return true;
  }
  return false;
}

export function analyzeMatches(matches: SimulatedMatch[]): MatchAnalysis {
  const shotsByPos = emptyPositionMap();
  const goalsByPos = emptyPositionMap();
  const crossesByPos = emptyPositionMap();

  let totalGoals = 0;
  let totalShots = 0;
  let invalidShots = 0;
  let invalidGoals = 0;
  let goalsWithoutChanceCreated = 0;
  let goalsWithoutBuildUp = 0;
  let defenderOpenPlayGoals = 0;
  let fullbackShots = 0;
  let fullbackGoals = 0;
  let strikerBoxShots = 0;
  let strikerTotalShots = 0;
  let strikerReceivedInBoxAndShot = 0;
  let strikerReceivedInBoxTotal = 0;
  let buildUpChainTotal = 0;
  let goalCount = 0;
  let goalsWithChanceCreated = 0;
  let duelEvents = 0;
  let skillEvents = 0;
  let timelineEligibleEvents = 0;
  const commandStyleMetrics: Record<string, CommandStyleMetrics> = {};

  for (const match of matches) {
    const { events } = match;
    const styleKey = match.passStyle ?? 'UNKNOWN';
    commandStyleMetrics[styleKey] ??= emptyCommandMetrics();
    commandStyleMetrics[styleKey].matches++;

    for (let idx = 0; idx < events.length; idx++) {
      const evt = events[idx];
      const role = normalizeRole(findRoleForEvent(evt, match));
      const styleMetrics = commandStyleMetrics[styleKey];

      if (evt.type === 'duel') duelEvents++;
      if (evt.skillActivated) skillEvents++;
      if (isTimelineEligible(evt)) timelineEligibleEvents++;
      if (role === 'CM' || role === 'DM' || role === 'CAM') styleMetrics.midfielderTouches++;

      if (evt.type === 'shot' || evt.type === 'goal' || evt.type === 'save' ||
          evt.type === 'post' || evt.type === 'wide' || evt.type === 'blocked' ||
          evt.type === 'rebound') {
        totalShots++;
        shotsByPos[role]++;
        styleMetrics.shots++;

        if (isFullbackRole(role)) fullbackShots++;

        if (role === 'ST') {
          strikerTotalShots++;
          const xRel = computeXRel(evt);
          if (xRel >= 0.78) strikerBoxShots++;
        }

        const xRel = computeXRel(evt);
        if (xRel < 0.65) invalidShots++;
      }

      if (evt.type === 'cross') {
        crossesByPos[role]++;
        styleMetrics.crosses++;
      }

      if (evt.type === 'pass' || evt.type === 'cross') {
        styleMetrics.passes++;
        if (evt.passSubtype === 'planejado') styleMetrics.plannedPasses++;
        if (evt.passSubtype === 'rapido') styleMetrics.quickPasses++;
        if ((evt.rationale ?? '').includes('long') || evt.tacticalTrigger === 'long_ball') {
          styleMetrics.longPasses++;
        }
      }

      if (evt.type === 'goal') {
        totalGoals++;
        goalCount++;
        goalsByPos[role]++;

        if (isFullbackRole(role)) fullbackGoals++;

        if (isDefenderRole(role) && !isSetPieceContext(events, idx)) {
          defenderOpenPlayGoals++;
        }

        const xRel = computeXRel(evt);
        if (xRel < 0.65) invalidGoals++;

        // Check for chance_created before goal
        let hasChanceCreated = false;
        let buildUpCount = 0;
        for (let j = Math.max(0, idx - 6); j < idx; j++) {
          const prev = events[j];
          if (prev.team === evt.team) {
            buildUpCount++;
            if (prev.chanceCreated ||
                prev.type === 'cross' || prev.type === 'danger' ||
                prev.type === 'pass' || prev.type === 'rebound' ||
                prev.type === 'corner' ||
                prev.rationale?.includes('create_chance') ||
                prev.rationale?.includes('attack_box') ||
                prev.rationale?.includes('through_ball')) {
              hasChanceCreated = true;
            }
          }
        }
        if (hasChanceCreated) goalsWithChanceCreated++;
        else goalsWithoutChanceCreated++;

        if (buildUpCount < 2) goalsWithoutBuildUp++;
        buildUpChainTotal += buildUpCount;
      }
    }

    // Striker in-box reception analysis
    for (let idx = 0; idx < events.length - 1; idx++) {
      const evt = events[idx];
      if (evt.type === 'pass' || evt.type === 'cross') {
        // Check if receiver is a ST and in the box
        if (evt.receiverPlayerId != null) {
          const receiver = match.players.find(p => p.id === evt.receiverPlayerId);
          if (receiver && normalizeRole(receiver.role) === 'ST') {
            const nextEvt = events[idx + 1];
            // The next event should involve the same team in the attacking zone
            if (nextEvt && nextEvt.team === evt.team) {
              const xRel = computeXRel(nextEvt);
              if (xRel >= 0.75) {
                strikerReceivedInBoxTotal++;
                const nextRole = normalizeRole(findRoleForEvent(nextEvt, match));
                if (nextRole === 'ST' && (nextEvt.type === 'shot' || nextEvt.type === 'goal' ||
                    nextEvt.type === 'save' || nextEvt.type === 'wide' || nextEvt.type === 'post' ||
                    nextEvt.type === 'blocked')) {
                  strikerReceivedInBoxAndShot++;
                }
              }
            }
          }
        }
      }
    }
  }

  const totalMatches = matches.length;
  const strikerShotZoneRate = strikerBoxShots / Math.max(1, strikerTotalShots);
  const strikerReceiveThenShotRate = strikerReceivedInBoxAndShot / Math.max(1, strikerReceivedInBoxTotal);

  return {
    totalMatches,
    totalGoals,
    totalShots,
    avgGoalsPerMatch: totalGoals / Math.max(1, totalMatches),
    avgShotsPerMatch: totalShots / Math.max(1, totalMatches),
    shotsByPosition: shotsByPos,
    goalsByPosition: goalsByPos,
    crossesByPosition: crossesByPos,
    invalidShots,
    invalidGoals,
    goalsWithoutChanceCreated,
    goalsWithoutBuildUp,
    defenderOpenPlayGoals,
    fullbackShots,
    fullbackGoals,
    strikerShotZoneRate,
    strikerBoxShotRate: strikerShotZoneRate,
    strikerReceiveThenShotRate,
    strikerReceivedInBoxAndShot,
    strikerReceivedInBoxTotal,
    duelEvents,
    duelsPerMatch: duelEvents / Math.max(1, totalMatches),
    skillEvents,
    timelineEligibleEvents,
    timelineEligibleEventsPerMatch: timelineEligibleEvents / Math.max(1, totalMatches),
    commandStyleMetrics,
    buildUpChainAvg: buildUpChainTotal / Math.max(1, goalCount),
    chanceCreatedBeforeGoalPct: goalsWithChanceCreated / Math.max(1, goalCount),
  };
}

function findRoleForEvent(evt: MatchEvent, match: SimulatedMatch): string | undefined {
  // Look up player by ID from the match roster
  if (evt.playerId != null) {
    const player = match.players.find(p => p.id === evt.playerId);
    if (player) return player.role;
  }
  // Fallback: try to match by name
  if (evt.playerName) {
    const player = match.players.find(p => p.shortName === evt.playerName);
    if (player) return player.role;
  }
  return undefined;
}

function guessRoleFromName(evt: MatchEvent): string | undefined {
  return undefined;
}

function computeXRel(evt: MatchEvent): number {
  // Approximate xRel from ballX. Field is 600 wide.
  // Home attacks right (higher x = more advanced), Away attacks left.
  const fieldW = 600;
  if (evt.team === 'home') return evt.ballX / fieldW;
  return 1 - evt.ballX / fieldW;
}
