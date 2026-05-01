/**
 * Lightweight fuzzy logic module for steering weight computation.
 *
 * Replaces binary IF/ELSE thresholds in applySteeringForPhase() with
 * smooth membership functions and fuzzy rules.
 *
 * Three fuzzy variables per agent evaluation:
 * - distanceToBall: close / medium / far
 * - fatigue: fresh / tired / exhausted
 * - roleAttackBias: defensive / balanced / offensive
 *
 * Output variables:
 * - pursuitWeight: none / light / strong
 * - arriveWeight: relaxed / normal / dominant
 * - separationWeight: loose / moderate / tight
 */

// ── Membership functions ──────────────────────────────────────────

/** Left shoulder: 1.0 at ≤a, slopes to 0.0 at b */
function leftShoulder(x: number, a: number, b: number): number {
  if (x <= a) return 1;
  if (x >= b) return 0;
  return (b - x) / (b - a);
}

/** Right shoulder: 0.0 at ≤a, slopes to 1.0 at b */
function rightShoulder(x: number, a: number, b: number): number {
  if (x <= a) return 0;
  if (x >= b) return 1;
  return (x - a) / (b - a);
}

/** Triangular: 0 at a, 1 at b, 0 at c */
function triangular(x: number, a: number, b: number, c: number): number {
  if (x <= a || x >= c) return 0;
  if (x <= b) return (x - a) / (b - a);
  return (c - x) / (c - b);
}

// ── Fuzzy input variables ─────────────────────────────────────────

export interface FuzzyDistanceToBall {
  close: number;
  medium: number;
  far: number;
}

export function fuzzifyDistance(distM: number): FuzzyDistanceToBall {
  return {
    close: leftShoulder(distM, 5, 14),
    medium: triangular(distM, 8, 18, 30),
    far: rightShoulder(distM, 22, 40),
  };
}

export interface FuzzyFatigue {
  fresh: number;
  tired: number;
  exhausted: number;
}

export function fuzzifyFatigue(fatigue01: number): FuzzyFatigue {
  return {
    fresh: leftShoulder(fatigue01, 0.2, 0.5),
    tired: triangular(fatigue01, 0.35, 0.6, 0.82),
    exhausted: rightShoulder(fatigue01, 0.7, 0.9),
  };
}

export interface FuzzyRole {
  defensive: number;
  balanced: number;
  offensive: number;
}

export function fuzzifyRole(
  isDefender: boolean,
  isForward: boolean,
  isLateral: boolean,
): FuzzyRole {
  if (isDefender) return { defensive: 1, balanced: 0.2, offensive: 0 };
  if (isForward) return { defensive: 0, balanced: 0.2, offensive: 1 };
  if (isLateral) return { defensive: 0.4, balanced: 0.5, offensive: 0.3 };
  return { defensive: 0.2, balanced: 0.8, offensive: 0.2 };
}

// ── Fuzzy rules → output ──────────────────────────────────────────

export interface FuzzySteeringOutput {
  pursuitWeight: number;
  arriveWeight: number;
  separationWeight: number;
}

/**
 * Evaluate fuzzy steering weights given fuzzified inputs.
 * Rules are applied as weighted sum (Mamdani-style centroid approximation).
 */
export function evaluateFuzzySteering(
  dist: FuzzyDistanceToBall,
  fatigue: FuzzyFatigue,
  role: FuzzyRole,
  teamHasBall: boolean,
): FuzzySteeringOutput {
  if (teamHasBall) {
    return {
      pursuitWeight: 0,
      arriveWeight: 1.0,
      separationWeight: 0.74 + fatigue.tired * 0.08,
    };
  }

  // Rule strengths (firing levels)
  const rules: Array<{ strength: number; pursuit: number; arrive: number; separation: number }> = [];

  // R1: close + defensive → strong pursuit, normal arrive
  rules.push({
    strength: Math.min(dist.close, role.defensive),
    pursuit: 0.42,
    arrive: 0.85,
    separation: 1.0,
  });

  // R2: close + offensive → moderate pursuit (forwards don't overcommit defensively)
  rules.push({
    strength: Math.min(dist.close, role.offensive),
    pursuit: 0.24,
    arrive: 0.90,
    separation: 1.04,
  });

  // R3: close + balanced → standard pursuit
  rules.push({
    strength: Math.min(dist.close, role.balanced),
    pursuit: 0.36,
    arrive: 0.80,
    separation: 1.0,
  });

  // R4: medium + defensive → light pursuit
  rules.push({
    strength: Math.min(dist.medium, role.defensive),
    pursuit: 0.12,
    arrive: 1.1,
    separation: 0.90,
  });

  // R5: medium + balanced → very light pursuit
  rules.push({
    strength: Math.min(dist.medium, role.balanced),
    pursuit: 0.08,
    arrive: 1.0,
    separation: 0.88,
  });

  // R6: medium + offensive → no pursuit, hold position
  rules.push({
    strength: Math.min(dist.medium, role.offensive),
    pursuit: 0.0,
    arrive: 1.0,
    separation: 0.94,
  });

  // R7: far → no pursuit at all
  rules.push({
    strength: dist.far,
    pursuit: 0.0,
    arrive: 1.0,
    separation: 0.88,
  });

  // R8: exhausted → reduce pursuit, hold position
  rules.push({
    strength: fatigue.exhausted,
    pursuit: 0.0,
    arrive: 1.15,
    separation: 0.75,
  });

  // R9: tired + close → reduced but present pursuit
  rules.push({
    strength: Math.min(fatigue.tired, dist.close),
    pursuit: 0.20,
    arrive: 0.95,
    separation: 0.92,
  });

  // Defuzzify via weighted average
  let totalWeight = 0;
  let sumPursuit = 0;
  let sumArrive = 0;
  let sumSeparation = 0;

  for (const r of rules) {
    if (r.strength < 0.001) continue;
    totalWeight += r.strength;
    sumPursuit += r.strength * r.pursuit;
    sumArrive += r.strength * r.arrive;
    sumSeparation += r.strength * r.separation;
  }

  if (totalWeight < 0.001) {
    return { pursuitWeight: 0, arriveWeight: 1.0, separationWeight: 0.88 };
  }

  return {
    pursuitWeight: sumPursuit / totalWeight,
    arriveWeight: sumArrive / totalWeight,
    separationWeight: sumSeparation / totalWeight,
  };
}
