/**
 * Mapa tático: papel × zona → viés de decisão (com bola / sem bola).
 * Complementa collectiveIndividualDecision (roleActionFit).
 */

import type { TacticalRole, DecisionActionId } from '@/playerDecision/collectiveIndividualDecision';

/** Zonas sem bola com maior peso por papel (prioridades textuais). */
export const ROLE_OFF_BALL_PRIORITY_ZONES: Record<TacticalRole, string[]> = {
  zagueiro: ['own_box', 'defensive_third', 'central_corridor'],
  lateral: ['defensive_third', 'lane_left', 'lane_right', 'half_space'],
  volante: ['central_corridor', 'middle_third', 'defensive_third'],
  meia: ['middle_third', 'central_corridor', 'attacking_third'],
  ponta: ['attacking_third', 'half_space', 'opp_half'],
  atacante: ['opp_box', 'attacking_third', 'half_space'],
  goleiro: ['own_box', 'defensive_third'],
};

/** Com bola: zonas onde ações arriscadas são penalizadas. */
export const ROLE_PENALIZED_ACTION_IN_ZONE: Partial<
  Record<TacticalRole, Partial<Record<DecisionActionId, string[]>>>
> = {
  zagueiro: {
    shoot: ['own_half', 'defensive_third', 'middle_third'],
    dribble_risk: ['own_box', 'defensive_third'],
    pass_progressive: ['own_box'],
  },
  volante: {
    shoot: ['defensive_third', 'own_box', 'own_half'],
  },
  lateral: {
    shoot: ['defensive_third', 'own_box', 'own_half'],
  },
  meia: {
    shoot: ['own_half', 'defensive_third'],
  },
  ponta: {
    shoot: ['own_half', 'defensive_third'],
  },
  atacante: {
    shoot: ['own_half', 'defensive_third'],
  },
};

/**
 * Score aditivo leve para chooseAction (multiplicado por constante na função chamadora).
 * Conservadorismo na área própria; último terço favorece finalização/progressivo.
 */
export function scoreActionZoneBias(tags: readonly string[], action: DecisionActionId): number {
  const set = new Set(tags);
  const inAttackingThird = set.has('attacking_third');
  const inOppBox = set.has('opp_box');
  let w = 0;
  if (set.has('own_box')) {
    if (action === 'clearance' || action === 'pass_safe' || action === 'hold_position') w += 0.28;
    if (action === 'shoot' || action === 'dribble_risk' || action === 'pass_progressive') w -= 0.32;
  }
  if (set.has('defensive_third') && !set.has('own_box')) {
    if (action === 'pass_safe' || action === 'hold_position' || action === 'cover') w += 0.08;
    if (action === 'shoot') w -= 0.18;
  }
  if (set.has('central_corridor') && set.has('defensive_third')) {
    if (action === 'pass_safe' || action === 'cover') w += 0.1;
  }
  if (set.has('own_half') && !inAttackingThird) {
    if (action === 'shoot') w -= 0.42;
    if (action === 'pass_progressive' || action === 'carry') w += 0.08;
  }
  if (set.has('middle_third') && !inAttackingThird && !inOppBox) {
    if (action === 'shoot') w -= 0.22;
    if (action === 'pass_progressive' || action === 'carry') w += 0.06;
  }
  if (inAttackingThird) {
    if (action === 'shoot' || action === 'pass_progressive') w += 0.28;
    if (action === 'pass_safe') w -= 0.12;
  }
  if (set.has('half_space') || set.has('lane_left') || set.has('lane_right')) {
    if (action === 'cross' || action === 'dribble_risk') w += 0.12;
  }
  if (inOppBox) {
    if (action === 'shoot') w += 0.38;
    if (action === 'pass_safe') w -= 0.08;
  }
  return w;
}

export function roleZonePenalty(role: TacticalRole, action: DecisionActionId, tags: readonly string[]): number {
  const table = ROLE_PENALIZED_ACTION_IN_ZONE[role]?.[action];
  if (!table) return 0;
  let p = 0;
  for (const t of table) {
    if (tags.includes(t)) p += 0.14;
  }
  return Math.min(0.45, p);
}
