import type { PlayIntention, DecisionContext, ContextReading } from './types';
import { buildContextReading } from './ContextScanner';
import { classifyThreat, type ThreatTier } from './ThreatModel';

/**
 * Derive the play intention from the threat model.
 *
 * Core principle: football is a continuous contest between
 * BUILDING chances (increasing threat) and DESTROYING chances (reducing threat).
 *
 * The intention maps this contest into actionable purpose:
 *  - Low threat  → build (maintain possession, progress, reorganize)
 *  - Rising threat → accelerate (break lines, attack space)
 *  - High threat → convert (create chance, finish)
 *  - Falling/stalling → adapt (reorganize, switch play, relieve pressure)
 *
 * MOVEMENT → PERCEPTION → **INTENTION** → ACTION
 */
export function deriveIntention(ctx: DecisionContext): PlayIntention {
  const reading = buildContextReading(ctx);
  return deriveFromReading(ctx, reading);
}

export function deriveFromReading(ctx: DecisionContext, reading: ContextReading): PlayIntention {
  const { profile, scoreDiff, minute, mentality } = ctx;
  const tier = classifyThreat(reading.threatLevel);
  const trend = reading.threatTrend;

  // -- Extreme pressure: relieve regardless of threat
  if (reading.pressure.intensity === 'extreme') {
    return 'relieve_pressure';
  }

  // -- URGENCY: in the box or very close to goal → finish, always
  if (reading.distToGoal < 16 && reading.pressure.opponentsInZone < 3) {
    return 'finish';
  }

  // -- URGENCY: attacking third with open teammate → create chance
  if ((reading.fieldZone === 'att_third' || reading.fieldZone === 'opp_box')
      && reading.availableTeammates.some(t => t.isForward && t.isOpen)) {
    return 'create_chance';
  }

  // -- Protecting a lead late in the game: throttle threat-building
  if (scoreDiff > 0 && minute > 75 && mentality < 60) {
    return 'protect_result';
  }

  // -- THREAT-DRIVEN INTENTION
  return deriveFromThreat(tier, trend, reading, profile, scoreDiff, minute, mentality);
}

function deriveFromThreat(
  tier: ThreatTier,
  trend: 'rising' | 'stable' | 'falling',
  reading: ContextReading,
  profile: { verticality: number; riskAppetite: number; dribbleTendency: number; composure: number },
  scoreDiff: number,
  minute: number,
  mentality: number,
): PlayIntention {

  // -----------------------------------------------------------------------
  // CRITICAL threat (0.7+): the team is very close to scoring
  // -----------------------------------------------------------------------
  if (tier === 'critical') {
    if (reading.distToGoal < 18 && reading.pressure.opponentsInZone < 3) return 'finish';
    if (reading.availableTeammates.some(t => t.isForward && t.isOpen)) return 'create_chance';
    // Threat is critical but falling → defense is recovering, try to finish fast
    if (trend === 'falling') return 'accelerate';
    return 'create_chance';
  }

  // -----------------------------------------------------------------------
  // DANGEROUS threat (0.45–0.7): building into a real opportunity
  // -----------------------------------------------------------------------
  if (tier === 'dangerous') {
    // Trend rising → play is maturing, keep pushing
    if (trend === 'rising') {
      if (reading.availableTeammates.some(t => t.isForward && t.isOpen)) return 'break_line';
      return 'attack_space';
    }
    // Trend stable → look for the key pass or space
    if (reading.space.canConductForward && profile.dribbleTendency > 0.4) return 'attack_space';
    if (reading.availableTeammates.some(t => t.isForward)) return 'break_line';
    // Trend falling → play is being neutralized, recirculate
    if (trend === 'falling') return 'reorganize';
    return 'progress';
  }

  // -----------------------------------------------------------------------
  // BUILDING threat (0.2–0.45): constructing the attack
  // -----------------------------------------------------------------------
  if (tier === 'building') {
    // Trend rising → momentum, keep progressing
    if (trend === 'rising') {
      if (profile.verticality > 0.5 || mentality > 60) return 'progress';
      return 'progress';
    }
    // Stable → look for the right moment
    if (reading.space.canConductForward && profile.verticality > 0.4) return 'progress';
    if (reading.pressure.opponentsInZone >= 3) return 'reorganize';
    return 'maintain_possession';
  }

  // -----------------------------------------------------------------------
  // DORMANT threat (0–0.2): ball in safe/deep areas
  // -----------------------------------------------------------------------

  // Urgency: losing late → must take risks
  if (scoreDiff < 0 && minute > 70) return 'accelerate';

  // High pressure in own half → relieve
  if (reading.pressure.intensity === 'high') return 'relieve_pressure';

  // Default: build patiently
  if (reading.space.canConductForward && profile.composure > 0.5) return 'progress';
  return 'maintain_possession';
}
