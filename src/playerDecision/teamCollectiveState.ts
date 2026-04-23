/**
 * Collective game state derived from existing per-tick data.
 * No new systems — reads from ball position, teammates, opponents, possession,
 * and smartfield to produce a shared tactical picture that individual decisions
 * can reference for coordinated behavior.
 */

import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';
import type { AgentSnapshot } from '@/simulation/InteractionResolver';

// ---------------------------------------------------------------------------
// Collective play phase
// ---------------------------------------------------------------------------

export type CollectivePlayPhase =
  | 'build_up'
  | 'progression'
  | 'final_third'
  | 'defensive_block'
  | 'transition_attack'
  | 'transition_defense';

export interface TeamCollectiveState {
  phase: CollectivePlayPhase;
  /** 0–1: how compact the team block is (1 = very tight). */
  compactness: number;
  /** Average X of the defensive line (world coords). */
  defLineX: number;
  /** Average X of the midfield line. */
  midLineX: number;
  /** Average X of the attack line. */
  attLineX: number;
  /** Gap between def and mid lines (meters). */
  defMidGap: number;
  /** Gap between mid and att lines (meters). */
  midAttGap: number;
  /** How many teammates are within 14m of the ball. */
  supportCount: number;
  /** 0–1: team width utilization (how spread laterally). */
  widthUtilization: number;
  /** Number of consecutive passes in current possession sequence (approx). */
  passChainLength: number;
}

/**
 * Derive the collective state for one team from raw agent snapshots.
 * Called once per team per tick in the sim loop — cheap O(n) scan.
 */
export function deriveTeamCollectiveState(
  teamSnaps: readonly AgentSnapshot[],
  opponents: readonly AgentSnapshot[],
  ballX: number,
  ballZ: number,
  attackDir: 1 | -1,
  teamHasBall: boolean,
  carrierId: string | null,
  passChainLength: number,
): TeamCollectiveState {
  let defSum = 0;
  let defN = 0;
  let midSum = 0;
  let midN = 0;
  let attSum = 0;
  let attN = 0;
  let supportCount = 0;
  let zMin = FIELD_WIDTH;
  let zMax = 0;

  for (const p of teamSnaps) {
    if (p.role === 'gk') continue;

    const depth = attackDir === 1 ? p.x : FIELD_LENGTH - p.x;

    if (p.role === 'def') {
      defSum += p.x;
      defN++;
    } else if (p.role === 'attack') {
      attSum += p.x;
      attN++;
    } else {
      midSum += p.x;
      midN++;
    }

    if (Math.hypot(p.x - ballX, p.z - ballZ) < 14) {
      supportCount++;
    }

    if (p.z < zMin) zMin = p.z;
    if (p.z > zMax) zMax = p.z;

    void depth;
  }

  const defLineX = defN > 0 ? defSum / defN : (attackDir === 1 ? 20 : FIELD_LENGTH - 20);
  const midLineX = midN > 0 ? midSum / midN : FIELD_LENGTH / 2;
  const attLineX = attN > 0 ? attSum / attN : (attackDir === 1 ? FIELD_LENGTH - 25 : 25);

  const defMidGap = Math.abs(midLineX - defLineX);
  const midAttGap = Math.abs(attLineX - midLineX);
  const totalSpread = Math.abs(attLineX - defLineX);
  const compactness = Math.max(0, Math.min(1, 1 - totalSpread / 55));

  const widthUtilization = Math.min(1, (zMax - zMin) / (FIELD_WIDTH * 0.75));

  const phase = derivePlayPhase(
    ballX, attackDir, teamHasBall, carrierId, teamSnaps, opponents, supportCount,
  );

  return {
    phase,
    compactness,
    defLineX,
    midLineX,
    attLineX,
    defMidGap,
    midAttGap,
    supportCount,
    widthUtilization,
    passChainLength,
  };
}

function derivePlayPhase(
  ballX: number,
  attackDir: 1 | -1,
  teamHasBall: boolean,
  carrierId: string | null,
  teamSnaps: readonly AgentSnapshot[],
  opponents: readonly AgentSnapshot[],
  supportCount: number,
): CollectivePlayPhase {
  const ballDepth = attackDir === 1 ? ballX / FIELD_LENGTH : 1 - ballX / FIELD_LENGTH;

  if (!teamHasBall) {
    const carrierInOurHalf = carrierId != null && opponents.some(
      (o) => o.id === carrierId && (attackDir === 1 ? o.x < FIELD_LENGTH * 0.55 : o.x > FIELD_LENGTH * 0.45),
    );
    if (carrierInOurHalf) return 'defensive_block';

    const justLost = supportCount >= 3;
    return justLost ? 'transition_defense' : 'defensive_block';
  }

  if (ballDepth > 0.68) return 'final_third';
  if (ballDepth > 0.40) return 'progression';

  const oppsNearBall = opponents.filter(
    (o) => Math.hypot(o.x - ballX, o.z - (FIELD_WIDTH / 2)) < 20,
  ).length;
  if (oppsNearBall <= 2 && ballDepth > 0.25) return 'transition_attack';

  return 'build_up';
}

// ---------------------------------------------------------------------------
// Line cohesion: correction forces to maintain block integrity
// ---------------------------------------------------------------------------

export interface LineCohesionDelta {
  dx: number;
  dz: number;
}

/**
 * For a given player, compute a small world-space nudge to maintain line cohesion.
 * Pulls players toward their line's average X with a soft force, preventing
 * gaps between def/mid/att that break the team shape.
 */
export function computeLineCohesionDelta(
  selfX: number,
  selfZ: number,
  role: string,
  collective: TeamCollectiveState,
  teamHasBall: boolean,
): LineCohesionDelta {
  // Com posse: o slot dinâmico + decisões já moldam o ataque; puxar a linha
  // média para trás gerava ioiô em desmarques e infiltrações.
  if (teamHasBall) return { dx: 0, dz: 0 };

  let targetLineX: number;
  let maxGapTolerance: number;

  if (role === 'def' || role === 'gk') {
    targetLineX = collective.defLineX;
    maxGapTolerance = 8;
  } else if (role === 'attack') {
    targetLineX = collective.attLineX;
    maxGapTolerance = 10;
  } else {
    targetLineX = collective.midLineX;
    maxGapTolerance = 9;
  }

  const diffX = targetLineX - selfX;
  const absDiff = Math.abs(diffX);

  if (absDiff < maxGapTolerance) return { dx: 0, dz: 0 };

  const excess = absDiff - maxGapTolerance;
  const strength = 0.25;
  const dx = Math.sign(diffX) * Math.min(excess * strength, 2.5);

  // Lateral: compress toward center when defending, widen when attacking
  let dz = 0;
  if (!teamHasBall && collective.widthUtilization > 0.7 && role === 'mid') {
    const centerDist = selfZ - FIELD_WIDTH / 2;
    if (Math.abs(centerDist) > 15) {
      dz = -Math.sign(centerDist) * 0.6;
    }
  }

  return { dx, dz };
}

// ---------------------------------------------------------------------------
// Support quality: "am I helping the play or just existing?"
// ---------------------------------------------------------------------------

export interface SupportQuality {
  /** 0–1: how useful this player's position is for the current play. */
  usefulness: number;
  /** Suggested adjustment type. */
  suggestion: 'stay' | 'offer_line' | 'create_width' | 'attack_space' | 'recycle';
}

/**
 * Evaluate how useful a player's current position is for the team play.
 * Uses existing data: ball position, carrier, teammates, pass angles.
 */
export function evaluateSupportQuality(
  self: AgentSnapshot,
  ballX: number,
  ballZ: number,
  attackDir: 1 | -1,
  teammates: readonly AgentSnapshot[],
  opponents: readonly AgentSnapshot[],
  collective: TeamCollectiveState,
): SupportQuality {
  const distToBall = Math.hypot(self.x - ballX, self.z - ballZ);
  const isAhead = (self.x - ballX) * attackDir > 0;
  const lateralOffset = Math.abs(self.z - ballZ);

  // Pass angle quality: am I in a position to receive?
  let passAngleQuality = 0;
  const toSelfX = self.x - ballX;
  const toSelfZ = self.z - ballZ;
  const toSelfDist = Math.hypot(toSelfX, toSelfZ);
  if (toSelfDist > 3 && toSelfDist < 45) {
    let blocked = false;
    for (const o of opponents) {
      const toOppX = o.x - ballX;
      const toOppZ = o.z - ballZ;
      const proj = (toOppX * toSelfX + toOppZ * toSelfZ) / (toSelfDist * toSelfDist);
      if (proj > 0.1 && proj < 0.9) {
        const perpDist = Math.abs(toOppX * toSelfZ - toOppZ * toSelfX) / toSelfDist;
        if (perpDist < 2.5) { blocked = true; break; }
      }
    }
    passAngleQuality = blocked ? 0.12 : 0.65;
    if (isAhead) passAngleQuality += 0.18;
    if (lateralOffset > 8 && lateralOffset < 28) passAngleQuality += 0.12;
  }

  // Clustering penalty: teammates too close to self OR too many near ball
  let nearestTeammateDist = Infinity;
  let teammatesNearBall = 0;
  for (const t of teammates) {
    if (t.id === self.id) continue;
    nearestTeammateDist = Math.min(nearestTeammateDist, Math.hypot(t.x - self.x, t.z - self.z));
    if (Math.hypot(t.x - ballX, t.z - ballZ) < 12) teammatesNearBall++;
  }
  let spacingPenalty = 0;
  if (nearestTeammateDist < 5) spacingPenalty += 0.35;
  else if (nearestTeammateDist < 7) spacingPenalty += 0.18;
  if (distToBall < 12 && teammatesNearBall >= 2) spacingPenalty += 0.28;

  let usefulness = passAngleQuality - spacingPenalty;

  // Bonus for being in optimal support range
  if (distToBall > 10 && distToBall < 24) usefulness += 0.15;
  // Penalty for being too close without being the closest supporter
  if (distToBall < 8 && teammatesNearBall >= 1) usefulness -= 0.15;
  // Penalty for being very far and not providing width
  if (distToBall > 35 && lateralOffset < 10) usefulness -= 0.1;

  usefulness = Math.max(0, Math.min(1, usefulness));

  let suggestion: SupportQuality['suggestion'] = 'stay';
  if (usefulness < 0.35) {
    if (distToBall < 14 && teammatesNearBall >= 2) {
      suggestion = lateralOffset < 12 ? 'create_width' : 'attack_space';
    } else if (collective.widthUtilization < 0.5 && lateralOffset < 12) {
      suggestion = 'create_width';
    } else if (isAhead && distToBall < 25) {
      suggestion = 'attack_space';
    } else if (!isAhead && distToBall > 20) {
      suggestion = 'recycle';
    } else {
      suggestion = 'offer_line';
    }
  }

  return { usefulness, suggestion };
}

// ---------------------------------------------------------------------------
// Play continuity score: should on-ball player continue the sequence?
// ---------------------------------------------------------------------------

/**
 * 0–1 score of how "alive" the current play is. High values mean the attack
 * is building well and shouldn't be interrupted by risky actions.
 * Low values mean the play is stalled and recycling/risk is warranted.
 */
export function playContinuityScore(
  threatLevel: number,
  threatTrend: 'rising' | 'stable' | 'falling',
  passChainLength: number,
  supportCount: number,
  phase: CollectivePlayPhase,
): number {
  let score = 0;

  // Threat momentum
  if (threatTrend === 'rising') score += 0.3;
  else if (threatTrend === 'stable') score += 0.1;

  // Pass chain: longer chains = more invested in the play
  score += Math.min(0.25, passChainLength * 0.05);

  // Support density
  if (supportCount >= 3) score += 0.15;
  else if (supportCount >= 2) score += 0.08;

  // Phase bonus
  if (phase === 'final_third') score += 0.15;
  else if (phase === 'progression') score += 0.08;

  // Threat level itself
  score += threatLevel * 0.15;

  return Math.max(0, Math.min(1, score));
}
