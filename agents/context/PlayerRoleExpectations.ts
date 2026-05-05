/**
 * /agents/context/PlayerRoleExpectations.ts
 *
 * Default PlayerIdentityContext for each of the 11 positions in a 4-4-2.
 * These are the canonical tactical briefings — loaded by PreMatchAgentLoader.
 *
 * Each position has a DIFFERENT mission. No two players behave the same.
 * Values are tuned for normalized field coords (0–100):
 *   x = width (0=left, 100=right)
 *   y = depth (0=home goal, 100=away goal)
 * Home team attacks toward y=100.
 */

import type { PlayerIdentityContext } from './PlayerIdentityContext';

/** Tipo canônico do briefing por posição — usado pelo DecisionContext.roleBriefing. */
export type RoleBriefing = Omit<PlayerIdentityContext, 'teamSide' | 'positionId' | 'archetypeId'>;

// ── GK ────────────────────────────────────────────────────────────────────────
export const GK_CONTEXT: RoleBriefing = {
  roleId: 'defensive',
  formationSlot: 'gk',
  zoneResponsibility: {
    primaryZone: 'DC',
    secondaryZone: 'DC',
    forbiddenZones: ['MOE','MOC','MOD','OE','OC','OD'],
    basePosition: { x: 50, y: 3 },
    maxRoamDistance: 8,
    recoveryTarget: { x: 50, y: 3 },
  },
  tacticalExpectations: {
    inPossession: 'Distribute short to CBs or long to flanks. Stay on goal line.',
    outOfPossession: 'Guard goal line. Command defensive line. Claim crosses.',
    transitionAttack: 'Restart quickly. Short pass to nearest CB.',
    transitionDefense: 'Return to goal line immediately. Do not advance.',
  },
  preferredActions: {
    passType: 'short',
    movementType: 'hold',
    defensiveAction: 'block',
    attackingAction: 'pass',
  },
  behavioralLimits: {
    dontChaseBallWhen: 'Ball is outside penalty area',
    holdPositionWhen: 'Always — unless claiming a cross',
    supportWhen: 'Never beyond own half',
    progressWhen: 'Never',
    shootWhen: 'Never',
    retreatWhen: 'Immediately after any forward movement',
    maxDistToChaseBall: 12,
    minDistToShoot: 999,
    recoveryPriority: 1.0,
  },
  matchMission: {
    summary: 'Guard the goal. Distribute calmly. Never leave the defensive zone.',
    tacticalPriority: 95,
    riskTolerance: 0.05,
    aggressionLevel: 0.1,
    supportResponsibility: 0.1,
  },
};

// ── LB ────────────────────────────────────────────────────────────────────────
export const LB_CONTEXT: Omit<PlayerIdentityContext, 'teamSide' | 'positionId' | 'archetypeId'> = {
  roleId: 'defensive',
  formationSlot: 'lb',
  zoneResponsibility: {
    primaryZone: 'DE',
    secondaryZone: 'MDE',
    forbiddenZones: ['OC','OD','MOD'],
    basePosition: { x: 22, y: 15 },
    maxRoamDistance: 28,
    recoveryTarget: { x: 22, y: 15 },
  },
  tacticalExpectations: {
    inPossession: 'Offer wide passing lane on left flank. Overlap LM when safe. Deliver cross.',
    outOfPossession: 'Protect left flank. Track opposing winger. Hold defensive line.',
    transitionAttack: 'Push forward on left side only. Stay wide.',
    transitionDefense: 'Sprint back to defensive position immediately.',
  },
  preferredActions: {
    passType: 'cross',
    movementType: 'overlap',
    defensiveAction: 'tackle',
    attackingAction: 'cross',
  },
  behavioralLimits: {
    dontChaseBallWhen: 'Ball is on right side and team is out of possession',
    holdPositionWhen: 'Opposite winger is making a run behind',
    supportWhen: 'Team has ball and LM is holding width',
    progressWhen: 'Team in possession and left flank is open',
    shootWhen: 'Never — pass or cross instead',
    retreatWhen: 'Team loses ball anywhere in midfield or attack',
    maxDistToChaseBall: 22,
    minDistToShoot: 999,
    recoveryPriority: 0.85,
  },
  matchMission: {
    summary: 'Protect left flank. Support LM. Overlap only when safe. Never abandon corridor.',
    tacticalPriority: 70,
    riskTolerance: 0.25,
    aggressionLevel: 0.4,
    supportResponsibility: 0.65,
  },
};

// ── CB_LEFT ───────────────────────────────────────────────────────────────────
export const CB_LEFT_CONTEXT: Omit<PlayerIdentityContext, 'teamSide' | 'positionId' | 'archetypeId'> = {
  roleId: 'defensive',
  formationSlot: 'cb_left',
  zoneResponsibility: {
    primaryZone: 'DE',
    secondaryZone: 'DC',
    forbiddenZones: ['MOE','MOC','MOD','OE','OC','OD'],
    basePosition: { x: 20, y: 35 },
    maxRoamDistance: 15,
    recoveryTarget: { x: 20, y: 35 },
  },
  tacticalExpectations: {
    inPossession: 'Hold defensive structure. Pass short to LB or CM. Progress only when completely free.',
    outOfPossession: 'Protect central-left zone. Block direct path to goal. Win aerial duels.',
    transitionAttack: 'Stay back. Let midfield carry. Offer safe pass option only.',
    transitionDefense: 'Drop immediately to defensive line. Do not press high.',
  },
  preferredActions: {
    passType: 'short',
    movementType: 'hold',
    defensiveAction: 'block',
    attackingAction: 'pass',
  },
  behavioralLimits: {
    dontChaseBallWhen: 'Ball is in midfield or attacking third',
    holdPositionWhen: 'Any time team is out of possession',
    supportWhen: 'Only when ball is in own defensive third',
    progressWhen: 'Only when completely unmarked and no opponent nearby',
    shootWhen: 'Never',
    retreatWhen: 'Immediately when ball enters midfield going forward',
    maxDistToChaseBall: 15,
    minDistToShoot: 999,
    recoveryPriority: 0.95,
  },
  matchMission: {
    summary: 'Anchor left side of defense. Pass safely. Never leave defensive third unnecessarily.',
    tacticalPriority: 90,
    riskTolerance: 0.1,
    aggressionLevel: 0.3,
    supportResponsibility: 0.2,
  },
};

// ── CB_RIGHT ──────────────────────────────────────────────────────────────────
export const CB_RIGHT_CONTEXT: Omit<PlayerIdentityContext, 'teamSide' | 'positionId' | 'archetypeId'> = {
  roleId: 'defensive',
  formationSlot: 'cb_right',
  zoneResponsibility: {
    primaryZone: 'DD',
    secondaryZone: 'DC',
    forbiddenZones: ['MOE','MOC','MOD','OE','OC','OD'],
    basePosition: { x: 20, y: 65 },
    maxRoamDistance: 15,
    recoveryTarget: { x: 20, y: 65 },
  },
  tacticalExpectations: {
    inPossession: 'Hold defensive structure. Pass short to RB or CM. Mirror CB_LEFT.',
    outOfPossession: 'Protect central-right zone. Block direct path to goal. Win aerial duels.',
    transitionAttack: 'Stay back. Mirror CB_LEFT behavior.',
    transitionDefense: 'Drop immediately. Hold line with CB_LEFT.',
  },
  preferredActions: {
    passType: 'short',
    movementType: 'hold',
    defensiveAction: 'block',
    attackingAction: 'pass',
  },
  behavioralLimits: {
    dontChaseBallWhen: 'Ball is in midfield or attacking third',
    holdPositionWhen: 'Any time team is out of possession',
    supportWhen: 'Only when ball is in own defensive third',
    progressWhen: 'Only when completely unmarked',
    shootWhen: 'Never',
    retreatWhen: 'Immediately when ball enters midfield going forward',
    maxDistToChaseBall: 15,
    minDistToShoot: 999,
    recoveryPriority: 0.95,
  },
  matchMission: {
    summary: 'Anchor right side of defense. Hold line with CB_LEFT. Never gamble.',
    tacticalPriority: 90,
    riskTolerance: 0.1,
    aggressionLevel: 0.3,
    supportResponsibility: 0.2,
  },
};

// ── RB ────────────────────────────────────────────────────────────────────────
export const RB_CONTEXT: Omit<PlayerIdentityContext, 'teamSide' | 'positionId' | 'archetypeId'> = {
  roleId: 'defensive',
  formationSlot: 'rb',
  zoneResponsibility: {
    primaryZone: 'DD',
    secondaryZone: 'MDD',
    forbiddenZones: ['OC','OE','MOE'],
    basePosition: { x: 22, y: 85 },
    maxRoamDistance: 28,
    recoveryTarget: { x: 22, y: 85 },
  },
  tacticalExpectations: {
    inPossession: 'Offer wide passing lane on right flank. Overlap RM when safe. Deliver cross.',
    outOfPossession: 'Protect right flank. Track opposing winger. Hold defensive line.',
    transitionAttack: 'Push forward on right side only. Stay wide.',
    transitionDefense: 'Sprint back to defensive position immediately.',
  },
  preferredActions: {
    passType: 'cross',
    movementType: 'overlap',
    defensiveAction: 'tackle',
    attackingAction: 'cross',
  },
  behavioralLimits: {
    dontChaseBallWhen: 'Ball is on left side and team is out of possession',
    holdPositionWhen: 'Opposite winger is making a run behind',
    supportWhen: 'Team has ball and RM is holding width',
    progressWhen: 'Team in possession and right flank is open',
    shootWhen: 'Never — pass or cross instead',
    retreatWhen: 'Team loses ball anywhere in midfield or attack',
    maxDistToChaseBall: 22,
    minDistToShoot: 999,
    recoveryPriority: 0.85,
  },
  matchMission: {
    summary: 'Protect right flank. Support RM. Overlap only when safe. Mirror LB on opposite side.',
    tacticalPriority: 70,
    riskTolerance: 0.25,
    aggressionLevel: 0.4,
    supportResponsibility: 0.65,
  },
};

// ── LM ────────────────────────────────────────────────────────────────────────
export const LM_CONTEXT: Omit<PlayerIdentityContext, 'teamSide' | 'positionId' | 'archetypeId'> = {
  roleId: 'support',
  formationSlot: 'lm',
  zoneResponsibility: {
    primaryZone: 'MDE',
    secondaryZone: 'MOE',
    forbiddenZones: ['DC','DD','MDD'],
    basePosition: { x: 44, y: 15 },
    maxRoamDistance: 30,
    recoveryTarget: { x: 42, y: 15 },
  },
  tacticalExpectations: {
    inPossession: 'Hold width on left. Receive from LB. Deliver crosses. Cut inside when space opens.',
    outOfPossession: 'Track opposing RB. Press high on left side. Prevent overlap.',
    transitionAttack: 'Sprint forward on left flank. Create width immediately.',
    transitionDefense: 'Track back to midfield line. Do not leave LB exposed.',
  },
  preferredActions: {
    passType: 'cross',
    movementType: 'run',
    defensiveAction: 'press',
    attackingAction: 'cross',
  },
  behavioralLimits: {
    dontChaseBallWhen: 'Ball is on right side and team is defending',
    holdPositionWhen: 'Team is defending and LB is pushing forward',
    supportWhen: 'Team has ball in central areas — offer wide outlet',
    progressWhen: 'Ball is on left side and space is open ahead',
    shootWhen: 'Only when inside attacking third with clear sight',
    retreatWhen: 'Team loses ball in attacking third',
    maxDistToChaseBall: 25,
    minDistToShoot: 30,
    recoveryPriority: 0.6,
  },
  matchMission: {
    summary: 'Own the left flank. Create width. Deliver crosses. Press opposing RB.',
    tacticalPriority: 65,
    riskTolerance: 0.45,
    aggressionLevel: 0.55,
    supportResponsibility: 0.7,
  },
};

// ── CM_LEFT ───────────────────────────────────────────────────────────────────
export const CM_LEFT_CONTEXT: Omit<PlayerIdentityContext, 'teamSide' | 'positionId' | 'archetypeId'> = {
  roleId: 'support',
  formationSlot: 'cm_left',
  zoneResponsibility: {
    primaryZone: 'MDC',
    secondaryZone: 'MDE',
    forbiddenZones: ['DE','DD','OE','OD'],
    basePosition: { x: 44, y: 38 },
    maxRoamDistance: 32,
    recoveryTarget: { x: 44, y: 38 },
  },
  tacticalExpectations: {
    inPossession: 'Dictate tempo. Receive from CBs. Distribute to flanks or striker. Progress when lane opens.',
    outOfPossession: 'Screen defensive line. Block central passing lanes. Anchor midfield.',
    transitionAttack: 'Push into half-space left. Support striker. Arrive late into box.',
    transitionDefense: 'Drop to midfield line immediately. Do not chase ball forward.',
  },
  preferredActions: {
    passType: 'short',
    movementType: 'walk',
    defensiveAction: 'intercept',
    attackingAction: 'pass',
  },
  behavioralLimits: {
    dontChaseBallWhen: 'Ball is in attacking third and team is out of possession',
    holdPositionWhen: 'Team is defending — anchor midfield block',
    supportWhen: 'Always — this player is the link between defense and attack',
    progressWhen: 'Space opens ahead and striker is making a run',
    shootWhen: 'Only from edge of box with clear sight',
    retreatWhen: 'Team loses ball in attacking third — drop to MDC immediately',
    maxDistToChaseBall: 20,
    minDistToShoot: 25,
    recoveryPriority: 0.75,
  },
  matchMission: {
    summary: 'Control the game. Link defense to attack. Anchor midfield when defending.',
    tacticalPriority: 85,
    riskTolerance: 0.3,
    aggressionLevel: 0.35,
    supportResponsibility: 0.9,
  },
};

// ── CM_RIGHT ──────────────────────────────────────────────────────────────────
export const CM_RIGHT_CONTEXT: Omit<PlayerIdentityContext, 'teamSide' | 'positionId' | 'archetypeId'> = {
  roleId: 'support',
  formationSlot: 'cm_right',
  zoneResponsibility: {
    primaryZone: 'MDC',
    secondaryZone: 'MDD',
    forbiddenZones: ['DE','DD','OE','OD'],
    basePosition: { x: 44, y: 62 },
    maxRoamDistance: 32,
    recoveryTarget: { x: 44, y: 62 },
  },
  tacticalExpectations: {
    inPossession: 'Box-to-box runs. Support striker. Arrive late into box from right half-space.',
    outOfPossession: 'Press with CM_LEFT. Cover right side of midfield. Track opposing CM.',
    transitionAttack: 'Run beyond striker on right half-space. Arrive late.',
    transitionDefense: 'Drop to midfield line. Mirror CM_LEFT.',
  },
  preferredActions: {
    passType: 'through',
    movementType: 'run',
    defensiveAction: 'press',
    attackingAction: 'run_behind',
  },
  behavioralLimits: {
    dontChaseBallWhen: 'CM_LEFT is already pressing the ball carrier',
    holdPositionWhen: 'Both strikers are pressing — hold midfield shape',
    supportWhen: 'Striker drops deep — fill the space ahead',
    progressWhen: 'Team has ball and right half-space is open',
    shootWhen: 'When arriving late into box unmarked',
    retreatWhen: 'Team loses ball and CM_LEFT is already forward',
    maxDistToChaseBall: 22,
    minDistToShoot: 22,
    recoveryPriority: 0.7,
  },
  matchMission: {
    summary: 'Box-to-box engine. Support attack from right half-space. Cover CM_LEFT when needed.',
    tacticalPriority: 80,
    riskTolerance: 0.45,
    aggressionLevel: 0.5,
    supportResponsibility: 0.75,
  },
};

// ── RM ────────────────────────────────────────────────────────────────────────
export const RM_CONTEXT: Omit<PlayerIdentityContext, 'teamSide' | 'positionId' | 'archetypeId'> = {
  roleId: 'support',
  formationSlot: 'rm',
  zoneResponsibility: {
    primaryZone: 'MDD',
    secondaryZone: 'MOD',
    forbiddenZones: ['DC','DE','MDE'],
    basePosition: { x: 44, y: 85 },
    maxRoamDistance: 30,
    recoveryTarget: { x: 42, y: 85 },
  },
  tacticalExpectations: {
    inPossession: 'Hold width on right. Receive from RB. Deliver crosses. Mirror LM on right side.',
    outOfPossession: 'Track opposing LB. Press high on right side. Prevent overlap.',
    transitionAttack: 'Sprint forward on right flank. Create width immediately.',
    transitionDefense: 'Track back to midfield line. Do not leave RB exposed.',
  },
  preferredActions: {
    passType: 'cross',
    movementType: 'run',
    defensiveAction: 'press',
    attackingAction: 'cross',
  },
  behavioralLimits: {
    dontChaseBallWhen: 'Ball is on left side and team is defending',
    holdPositionWhen: 'Team is defending and RB is pushing forward',
    supportWhen: 'Team has ball in central areas — offer wide outlet on right',
    progressWhen: 'Ball is on right side and space is open ahead',
    shootWhen: 'Only when inside attacking third with clear sight',
    retreatWhen: 'Team loses ball in attacking third',
    maxDistToChaseBall: 25,
    minDistToShoot: 30,
    recoveryPriority: 0.6,
  },
  matchMission: {
    summary: 'Own the right flank. Create width. Deliver crosses. Press opposing LB.',
    tacticalPriority: 65,
    riskTolerance: 0.45,
    aggressionLevel: 0.55,
    supportResponsibility: 0.7,
  },
};

// ── ST_LEFT ───────────────────────────────────────────────────────────────────
export const ST_LEFT_CONTEXT: Omit<PlayerIdentityContext, 'teamSide' | 'positionId' | 'archetypeId'> = {
  roleId: 'offensive',
  formationSlot: 'st_left',
  zoneResponsibility: {
    primaryZone: 'OC',
    secondaryZone: 'MOC',
    forbiddenZones: ['DE','DC','DD'],
    basePosition: { x: 70, y: 38 },
    maxRoamDistance: 35,
    recoveryTarget: { x: 62, y: 38 },
  },
  tacticalExpectations: {
    inPossession: 'Attack space behind defense. Receive forward passes. Finish in valid range. Hold up play.',
    outOfPossession: 'Press nearest CB. Force errors. Stay available between defensive lines.',
    transitionAttack: 'Sprint in behind immediately. Exploit space before defense resets.',
    transitionDefense: 'Press nearest ball carrier. Do not track back beyond midfield.',
  },
  preferredActions: {
    passType: 'through',
    movementType: 'sprint',
    defensiveAction: 'press',
    attackingAction: 'shoot',
  },
  behavioralLimits: {
    dontChaseBallWhen: 'Ball is in own defensive third',
    holdPositionWhen: 'Team is building from back — stay high to stretch defense',
    supportWhen: 'ST_RIGHT has ball — offer second striker option',
    progressWhen: 'Space opens behind defensive line',
    shootWhen: 'Inside attacking third with any sight of goal',
    retreatWhen: 'Never beyond midfield line',
    maxDistToChaseBall: 30,
    minDistToShoot: 30,
    recoveryPriority: 0.2,
  },
  matchMission: {
    summary: 'Hunt goals. Press defenders. Stay high. Exploit space in behind. Finish chances.',
    tacticalPriority: 88,
    riskTolerance: 0.8,
    aggressionLevel: 0.75,
    supportResponsibility: 0.35,
  },
};

// ── ST_RIGHT ──────────────────────────────────────────────────────────────────
export const ST_RIGHT_CONTEXT: Omit<PlayerIdentityContext, 'teamSide' | 'positionId' | 'archetypeId'> = {
  roleId: 'offensive',
  formationSlot: 'st_right',
  zoneResponsibility: {
    primaryZone: 'OC',
    secondaryZone: 'MOC',
    forbiddenZones: ['DE','DC','DD'],
    basePosition: { x: 70, y: 62 },
    maxRoamDistance: 35,
    recoveryTarget: { x: 62, y: 62 },
  },
  tacticalExpectations: {
    inPossession: 'Attack space. Combine with ST_LEFT. Aggressive runs in behind. Finish.',
    outOfPossession: 'Press aggressively. Force turnovers high up the pitch.',
    transitionAttack: 'Explosive run in behind on right channel. Demand the ball.',
    transitionDefense: 'Press nearest ball carrier. Do not track back beyond midfield.',
  },
  preferredActions: {
    passType: 'short',
    movementType: 'sprint',
    defensiveAction: 'press',
    attackingAction: 'shoot',
  },
  behavioralLimits: {
    dontChaseBallWhen: 'Ball is in own defensive third',
    holdPositionWhen: 'Team is building from back — stay high',
    supportWhen: 'ST_LEFT has ball — offer combination option',
    progressWhen: 'Right channel is open behind defense',
    shootWhen: 'Any time inside attacking third',
    retreatWhen: 'Never beyond midfield line',
    maxDistToChaseBall: 30,
    minDistToShoot: 28,
    recoveryPriority: 0.15,
  },
  matchMission: {
    summary: 'Aggressive striker. Press high. Combine with ST_LEFT. Shoot on sight.',
    tacticalPriority: 85,
    riskTolerance: 0.85,
    aggressionLevel: 0.85,
    supportResponsibility: 0.3,
  },
};

// ── Catalog ───────────────────────────────────────────────────────────────────

import type { PositionId } from '../core/AgentTypes';

export const ROLE_EXPECTATIONS: Record<PositionId, Omit<PlayerIdentityContext, 'teamSide' | 'positionId' | 'archetypeId'>> = {
  GK:   GK_CONTEXT,
  LB:   LB_CONTEXT,
  CB_L: CB_LEFT_CONTEXT,
  CB_R: CB_RIGHT_CONTEXT,
  RB:   RB_CONTEXT,
  LM:   LM_CONTEXT,
  CM_L: CM_LEFT_CONTEXT,
  CM_R: CM_RIGHT_CONTEXT,
  RM:   RM_CONTEXT,
  ST_L: ST_LEFT_CONTEXT,
  ST_R: ST_RIGHT_CONTEXT,
};
