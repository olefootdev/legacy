// ---------------------------------------------------------------------------
// Attribute Axis Builder — bridges MatchPlayerAttributes into utility inputs
// ---------------------------------------------------------------------------
// Complements the geometric inputs already produced by the decision engine.
// Call this once per decision tick and merge the result into the input map
// passed to the utility engine.

import type { PlayerProfile } from '@/playerDecision/types';
import type { MatchPlayerAttributes } from '@/match/playerInMatch';
import {
  deriveVision,
  deriveDecisions,
  deriveOffTheBall,
  deriveComposure,
  deriveFlair,
  deriveAnticipation,
  deriveTeamwork,
  deriveReactionDelaySec,
  cognitiveFatigueMultiplier,
  psychologicalPressureMultiplier,
  egoPassPenalty,
} from './attributeModulators';

// ---------------------------------------------------------------------------
// Output shape
// ---------------------------------------------------------------------------

export interface AttributeInputs {
  /** 0-1: perceived pass option quality */
  vision: number;
  /** 0-1: in-game decision quality */
  decisions: number;
  /** 0-1: intelligent off-ball movement */
  offTheBall: number;
  /** 0-1: composure under pressure */
  composure: number;
  /** 0-1: creative unpredictability */
  flair: number;
  /** 0-1: reading the game ahead of time */
  anticipation: number;
  /** 0-1: willingness to work for the team */
  teamwork: number;
  /** seconds: how long before the player reacts to a new stimulus */
  reactionDelay: number;
  /** 0.6-1.0: cognitive degradation from fatigue */
  cognitiveFatigue: number;
  /** 0.7-1.1: decision quality modifier from psychological state */
  psychPressure: number;
  /** 0 to -0.3: negative weight on PASS for selfish players */
  egoPassPenalty: number;
  /** 0-1: effective pass quality (vision * fatigue * psychPressure) */
  passQualityMod: number;
  /** 0-1: effective shoot quality (composure * fatigue * psychPressure) */
  shootQualityMod: number;
  /** 0-1: effective dribble quality (flair * fatigue) */
  dribbleQualityMod: number;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Derives all attribute-based utility inputs for a single decision tick.
 *
 * @param profile       - PlayerProfile (personality tendencies 0-1)
 * @param attrs         - MatchPlayerAttributes (technical ratings 0-100); may be undefined for away AI
 * @param stamina       - current stamina 0-100
 * @param minute        - match minute 0-90
 * @param scoreDiff     - goals: positive = winning, negative = losing
 * @param spiritMomentum - GameSpirit momentum 0-1
 */
export function buildAttributeInputs(
  profile: PlayerProfile,
  attrs: MatchPlayerAttributes | undefined,
  stamina: number,
  minute: number,
  scoreDiff: number,
  spiritMomentum: number,
): AttributeInputs {
  // When no attributes are available (away AI fallback), derive from profile
  const effectiveAttrs: MatchPlayerAttributes = attrs ?? profileToFallbackAttrs(profile);

  // --- Base cognitive values ---
  const vision = deriveVision(effectiveAttrs);
  const decisions = deriveDecisions(effectiveAttrs);
  const offTheBall = deriveOffTheBall(effectiveAttrs);
  const composure = deriveComposure(effectiveAttrs);
  const flair = deriveFlair(effectiveAttrs);
  const anticipation = deriveAnticipation(effectiveAttrs);
  const teamwork = deriveTeamwork(effectiveAttrs);

  // --- Modifiers ---
  const reactionDelay = deriveReactionDelaySec(effectiveAttrs);
  const cognitiveFatigue = cognitiveFatigueMultiplier(stamina);
  const psychPressure = psychologicalPressureMultiplier(minute, scoreDiff, spiritMomentum);
  const egoPenalty = egoPassPenalty(effectiveAttrs);

  // --- Composite quality modifiers ---
  // Pass quality: vision degraded by fatigue and psychological state
  const passQualityMod = Math.max(0, Math.min(1, vision * cognitiveFatigue * psychPressure));

  // Shoot quality: composure degraded by fatigue and psychological state
  const shootQualityMod = Math.max(0, Math.min(1, composure * cognitiveFatigue * psychPressure));

  // Dribble quality: flair degraded by fatigue (less affected by psych pressure)
  const dribbleQualityMod = Math.max(0, Math.min(1, flair * cognitiveFatigue));

  return {
    vision,
    decisions,
    offTheBall,
    composure,
    flair,
    anticipation,
    teamwork,
    reactionDelay,
    cognitiveFatigue,
    psychPressure,
    egoPassPenalty: egoPenalty,
    passQualityMod,
    shootQualityMod,
    dribbleQualityMod,
  };
}

// ---------------------------------------------------------------------------
// Fallback: derive synthetic attributes from PlayerProfile when attrs absent
// ---------------------------------------------------------------------------

/**
 * Converts a PlayerProfile (0-1 tendencies) into a synthetic MatchPlayerAttributes
 * so the modulator functions always have something to work with.
 * Values are approximate — real attributes should always be preferred.
 */
function profileToFallbackAttrs(profile: PlayerProfile): MatchPlayerAttributes {
  const scale = (v: number): number => Math.round(Math.max(0, Math.min(100, v * 100)));

  return {
    passeCurto: scale(profile.possessionBias * 0.6 + profile.vision * 0.4),
    passeLongo: scale(profile.verticality * 0.5 + profile.vision * 0.5),
    cruzamento: scale(profile.dribbleTendency * 0.4 + profile.verticality * 0.6),
    marcacao: scale(profile.workRate * 0.7 + (1 - profile.riskAppetite) * 0.3),
    velocidade: scale(profile.workRate * 0.8 + profile.riskAppetite * 0.2),
    fairPlay: scale(1 - profile.riskAppetite * 0.5),
    drible: scale(profile.dribbleTendency * 0.7 + profile.riskAppetite * 0.3),
    finalizacao: scale(profile.riskAppetite * 0.5 + profile.verticality * 0.5),
    fisico: scale(profile.workRate * 0.9 + 0.1),
    tatico: scale(profile.vision * 0.5 + profile.composure * 0.5),
    mentalidade: scale(profile.composure * 0.6 + profile.workRate * 0.4),
    confianca: scale(profile.composure * 0.7 + profile.riskAppetite * 0.3),
  };
}
