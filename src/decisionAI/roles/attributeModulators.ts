// ---------------------------------------------------------------------------
// Attribute Modulators — derive cognitive inputs from MatchPlayerAttributes
// ---------------------------------------------------------------------------
// All outputs are normalised 0-1 unless stated otherwise.
// Formulas use the 0-100 attribute scale; division by 100 normalises.

import type { MatchPlayerAttributes } from '@/match/playerInMatch';

// ---------------------------------------------------------------------------
// 2.2 — Cognitive derivations
// ---------------------------------------------------------------------------

/**
 * Vision: ability to perceive and select quality pass options.
 * tatico * 0.5 + passeLongo * 0.3 + mentalidade * 0.2 → 0-1
 */
export function deriveVision(attrs: MatchPlayerAttributes): number {
  return (attrs.tatico * 0.5 + attrs.passeLongo * 0.3 + attrs.mentalidade * 0.2) / 100;
}

/**
 * Decisions: quality of in-game decision-making under pressure.
 * tatico * 0.6 + mentalidade * 0.4 → 0-1
 */
export function deriveDecisions(attrs: MatchPlayerAttributes): number {
  return (attrs.tatico * 0.6 + attrs.mentalidade * 0.4) / 100;
}

/**
 * Off-the-ball movement: intelligent runs, positioning without the ball.
 * velocidade * 0.4 + tatico * 0.3 + mentalidade * 0.3 → 0-1
 */
export function deriveOffTheBall(attrs: MatchPlayerAttributes): number {
  return (attrs.velocidade * 0.4 + attrs.tatico * 0.3 + attrs.mentalidade * 0.3) / 100;
}

/**
 * Composure: ability to stay calm and execute under pressure.
 * confianca * 0.6 + mentalidade * 0.4 → 0-1
 */
export function deriveComposure(attrs: MatchPlayerAttributes): number {
  return (attrs.confianca * 0.6 + attrs.mentalidade * 0.4) / 100;
}

/**
 * Flair: unpredictability, creativity, and individual brilliance.
 * drible * 0.5 + confianca * 0.3 + finalizacao * 0.2 → 0-1
 */
export function deriveFlair(attrs: MatchPlayerAttributes): number {
  return (attrs.drible * 0.5 + attrs.confianca * 0.3 + attrs.finalizacao * 0.2) / 100;
}

/**
 * Anticipation: reading the game before it happens.
 * tatico * 0.5 + velocidade * 0.3 + mentalidade * 0.2 → 0-1
 */
export function deriveAnticipation(attrs: MatchPlayerAttributes): number {
  return (attrs.tatico * 0.5 + attrs.velocidade * 0.3 + attrs.mentalidade * 0.2) / 100;
}

/**
 * Teamwork: willingness to work for the team, press, cover, support.
 * fairPlay * 0.5 + tatico * 0.3 + mentalidade * 0.2 → 0-1
 */
export function deriveTeamwork(attrs: MatchPlayerAttributes): number {
  return (attrs.fairPlay * 0.5 + attrs.tatico * 0.3 + attrs.mentalidade * 0.2) / 100;
}

// ---------------------------------------------------------------------------
// 2.3 — Reaction delay
// ---------------------------------------------------------------------------

/**
 * Reaction delay in seconds based on Anticipation.
 * High anticipation (0.9) → ~0.05s; low (0.1) → ~0.35s.
 * Linear interpolation: delay = 0.35 - anticipation * 0.333
 */
export function deriveReactionDelaySec(attrs: MatchPlayerAttributes): number {
  const anticipation = deriveAnticipation(attrs);
  // clamp to [0.05, 0.35]
  return Math.max(0.05, Math.min(0.35, 0.35 - anticipation * 0.333));
}

// ---------------------------------------------------------------------------
// 2.4 — Cognitive fatigue
// ---------------------------------------------------------------------------

/**
 * Cognitive fatigue multiplier: degrades Vision and Decisions with low stamina.
 * stamina 0-100; returns multiplier 0.6-1.0.
 * Full stamina (100) → 1.0; empty (0) → 0.6.
 */
export function cognitiveFatigueMultiplier(stamina: number): number {
  const s = Math.max(0, Math.min(100, stamina));
  // linear: 0.6 + (s / 100) * 0.4
  return 0.6 + (s / 100) * 0.4;
}

// ---------------------------------------------------------------------------
// 2.5 — Psychological pressure
// ---------------------------------------------------------------------------

/**
 * Psychological pressure multiplier on decision quality.
 * Combines late-game pressure, score deficit, and spirit momentum.
 *
 * - minute: 0-90 (late game = more pressure)
 * - scoreDiff: -5 to +5 (negative = losing, increases pressure)
 * - spiritMomentum: 0-1 (high = team in flow, reduces pressure)
 *
 * Returns multiplier 0.7-1.1 (can boost slightly when in momentum).
 */
export function psychologicalPressureMultiplier(
  minute: number,
  scoreDiff: number,
  spiritMomentum: number,
): number {
  // Late-game pressure: ramps up after minute 70
  const latePressure = minute > 70 ? (minute - 70) / 20 : 0; // 0-1

  // Score deficit pressure: losing by 1+ increases pressure
  const deficitPressure = scoreDiff < 0 ? Math.min(1, Math.abs(scoreDiff) / 3) : 0;

  // Combined raw pressure (0-1)
  const rawPressure = latePressure * 0.4 + deficitPressure * 0.6;

  // Spirit momentum reduces pressure (team in flow = calmer decisions)
  const momentumRelief = spiritMomentum * 0.15;

  // Map to multiplier: high pressure → lower quality, momentum → slight boost
  // Base 1.0, pressure pulls down to 0.7, momentum pushes up to 1.1
  const multiplier = 1.0 - rawPressure * 0.3 + momentumRelief;

  return Math.max(0.7, Math.min(1.1, multiplier));
}

// ---------------------------------------------------------------------------
// 2.6 — Ego / pass penalty
// ---------------------------------------------------------------------------

/**
 * Ego pass penalty: high flair + low teamwork = ignores obvious passes.
 * Returns a negative weight modifier for PASS action (0 to -0.3).
 *
 * A pure egoist (flair=1, teamwork=0) returns -0.3.
 * A team player (flair=0, teamwork=1) returns 0.
 */
export function egoPassPenalty(attrs: MatchPlayerAttributes): number {
  const flair = deriveFlair(attrs);
  const teamwork = deriveTeamwork(attrs);

  // Ego score: high flair and low teamwork drives selfish behaviour
  const egoScore = Math.max(0, flair - teamwork);

  // Scale to -0.3 range
  return -(egoScore * 0.3);
}

// ---------------------------------------------------------------------------
// 2.7 — Preferred foot multiplier
// ---------------------------------------------------------------------------

/**
 * Preferred foot penalty for crossing/shooting on the wrong side.
 *
 * - preferredFoot: player's dominant foot
 * - attackDir: 1 = home attacking right→left, -1 = away attacking left→right
 * - playerX: engine coordinate 0-100 (0 = home goal, 100 = away goal)
 *
 * A left-footed player on the right side (playerX > 52, attackDir=1) is on
 * their weaker foot for crosses/shots — returns 0.7-0.85.
 * A right-footed player on the left side (playerX < 48, attackDir=1) same.
 * Both-footed players always return 1.0.
 *
 * Returns multiplier 0.7-1.0.
 */
export function preferredFootMultiplier(
  preferredFoot: 'left' | 'right' | 'both',
  attackDir: 1 | -1,
  playerX: number,
): number {
  if (preferredFoot === 'both') return 1.0;

  // Determine which side the player is on relative to the centre (50)
  // attackDir=1: home team attacks toward high X (away goal at 100)
  //   right side = playerX > 52
  //   left side  = playerX < 48
  const isRightSide = playerX > 52;
  const isLeftSide = playerX < 48;

  // Wrong foot = left-footed on right side, or right-footed on left side
  // (mirrored for attackDir=-1: away team attacks toward low X)
  let onWrongFoot = false;

  if (attackDir === 1) {
    onWrongFoot =
      (preferredFoot === 'left' && isRightSide) ||
      (preferredFoot === 'right' && isLeftSide);
  } else {
    // Away team: field is mirrored
    onWrongFoot =
      (preferredFoot === 'right' && isRightSide) ||
      (preferredFoot === 'left' && isLeftSide);
  }

  if (!onWrongFoot) return 1.0;

  // Penalty: 0.7 at the extreme flank (playerX near 0 or 100), 0.85 near centre
  const distFromCentre = Math.abs(playerX - 50) / 50; // 0-1
  return Math.max(0.7, 1.0 - distFromCentre * 0.3);
}
