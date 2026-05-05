/**
 * /src/tactical/archetypesCatalog.ts
 *
 * Catálogo canônico de arquétipos táticos do Olefoot.
 * 25 arquétipos base — FONTE ÚNICA DE VERDADE para comportamento de jogadores.
 */

import type { FieldZoneId } from './zones12';

export type ArchetypeId =
  // Goleiros
  | 'GK_CLASSIC' | 'GK_SWEEPER' | 'GK_BUILD_UP'
  // Zagueiros
  | 'CB_DEFENDER' | 'CB_AGGRESSIVE' | 'CB_BALL_PLAYING' | 'CB_COVER'
  // Laterais
  | 'FB_CONSERVATIVE' | 'FB_ATTACKING' | 'FB_INVERTED' | 'WB_OVERLAP'
  // Volantes
  | 'DM_ANCHOR' | 'DM_DESTROYER' | 'DM_PLAYMAKER' | 'DM_BOX'
  // Meio-campo
  | 'CM_BOX_TO_BOX' | 'CM_CONTROLLER' | 'CM_MEZZALA' | 'CM_PROGRESSOR'
  // Meias ofensivos
  | 'AM_PLAYMAKER' | 'AM_SHADOW' | 'AM_FREE'
  // Pontas
  | 'WINGER_CLASSIC' | 'WINGER_INVERTED' | 'WINGER_CREATOR'
  // Atacantes
  | 'ST_FINISHER' | 'ST_TARGET' | 'ST_FALSE_9' | 'ST_PRESSING';

export type ArchetypeFamily =
  | 'goalkeeper'
  | 'defender'
  | 'fullback'
  | 'defensive_mid'
  | 'midfielder'
  | 'attacking_mid'
  | 'winger'
  | 'forward';

export type ArchetypeBasePosition =
  | 'GK'
  | 'CB'
  | 'LB' | 'RB' | 'LWB' | 'RWB'
  | 'CDM' | 'DM'
  | 'CM'
  | 'CAM' | 'AM'
  | 'LW' | 'RW'
  | 'ST' | 'CF' | 'SS';

export type ArchetypeIntention =
  | 'hold_position'
  | 'sweep_behind'
  | 'build_from_back'
  | 'man_mark'
  | 'press_high'
  | 'cover_space'
  | 'hold_width_defense'
  | 'overlap_attack'
  | 'support_inside'
  | 'invert_midfield'
  | 'anchor_midfield'
  | 'break_up_play'
  | 'dictate_tempo'
  | 'box_to_box'
  | 'progress_ball'
  | 'half_space_run'
  | 'link_play'
  | 'create_chances'
  | 'shadow_striker'
  | 'free_roam'
  | 'hug_touchline'
  | 'cut_inside'
  | 'combine_wide'
  | 'finish_chances'
  | 'hold_up_play'
  | 'drop_deep'
  | 'press_defenders'
  | 'run_in_behind';

export type ArchetypeTrigger =
  | 'ball_in_own_half'
  | 'ball_in_final_third'
  | 'ball_in_left_side'
  | 'ball_in_right_side'
  | 'ball_in_center'
  | 'team_in_possession'
  | 'team_out_of_possession'
  | 'high_press_active'
  | 'low_block_active'
  | 'winger_holding_width'
  | 'striker_dropping_deep'
  | 'midfield_overload'
  | 'space_behind_defense'
  | 'set_piece'
  | 'counter_attack';

export interface ArchetypeProfile {
  discipline: number;
  aggression: number;
  creativity: number;
  risk: number;
}

export interface PlayerArchetype {
  id: ArchetypeId;
  basePosition: ArchetypeBasePosition;
  family: ArchetypeFamily;
  attackZones: FieldZoneId[];
  defenseZones: FieldZoneId[];
  allowedZones: FieldZoneId[];
  forbiddenZones: FieldZoneId[];
  intentions: ArchetypeIntention[];
  triggers: ArchetypeTrigger[];
  profile: ArchetypeProfile;
}

// ── Goleiros ──────────────────────────────────────────────────────────────────

const GK_CLASSIC: PlayerArchetype = {
  id: 'GK_CLASSIC',
  basePosition: 'GK',
  family: 'goalkeeper',
  attackZones: ['DC'],
  defenseZones: ['DC'],
  allowedZones: ['DC', 'DE', 'DD'],
  forbiddenZones: ['MOC', 'MOE', 'MOD', 'OC', 'OE', 'OD'],
  intentions: ['hold_position'],
  triggers: ['ball_in_final_third', 'set_piece'],
  profile: { discipline: 90, aggression: 40, creativity: 20, risk: 15 },
};

const GK_SWEEPER: PlayerArchetype = {
  id: 'GK_SWEEPER',
  basePosition: 'GK',
  family: 'goalkeeper',
  attackZones: ['DC', 'MDC'],
  defenseZones: ['DC'],
  allowedZones: ['DC', 'DE', 'DD', 'MDC'],
  forbiddenZones: ['MOC', 'MOE', 'MOD', 'OC', 'OE', 'OD'],
  intentions: ['hold_position', 'sweep_behind'],
  triggers: ['space_behind_defense', 'high_press_active'],
  profile: { discipline: 80, aggression: 55, creativity: 30, risk: 35 },
};

const GK_BUILD_UP: PlayerArchetype = {
  id: 'GK_BUILD_UP',
  basePosition: 'GK',
  family: 'goalkeeper',
  attackZones: ['DC', 'MDC'],
  defenseZones: ['DC'],
  allowedZones: ['DC', 'DE', 'DD', 'MDC'],
  forbiddenZones: ['MOC', 'MOE', 'MOD', 'OC', 'OE', 'OD'],
  intentions: ['hold_position', 'build_from_back'],
  triggers: ['team_in_possession', 'ball_in_own_half'],
  profile: { discipline: 85, aggression: 35, creativity: 50, risk: 40 },
};

// ── Zagueiros ─────────────────────────────────────────────────────────────────

const CB_DEFENDER: PlayerArchetype = {
  id: 'CB_DEFENDER',
  basePosition: 'CB',
  family: 'defender',
  attackZones: ['DC'],
  defenseZones: ['DC', 'DE', 'DD'],
  allowedZones: ['DC', 'DE', 'DD', 'MDC'],
  forbiddenZones: ['OC', 'OE', 'OD'],
  intentions: ['hold_position', 'man_mark'],
  triggers: ['ball_in_final_third', 'team_out_of_possession'],
  profile: { discipline: 90, aggression: 65, creativity: 20, risk: 20 },
};

const CB_AGGRESSIVE: PlayerArchetype = {
  id: 'CB_AGGRESSIVE',
  basePosition: 'CB',
  family: 'defender',
  attackZones: ['DC', 'MDC'],
  defenseZones: ['DC', 'DE', 'DD'],
  allowedZones: ['DC', 'DE', 'DD', 'MDC', 'MDE', 'MDD'],
  forbiddenZones: ['OC', 'OE', 'OD'],
  intentions: ['hold_position', 'man_mark', 'press_high'],
  triggers: ['ball_in_final_third', 'high_press_active', 'team_out_of_possession'],
  profile: { discipline: 75, aggression: 85, creativity: 25, risk: 40 },
};

const CB_BALL_PLAYING: PlayerArchetype = {
  id: 'CB_BALL_PLAYING',
  basePosition: 'CB',
  family: 'defender',
  attackZones: ['DC', 'MDC'],
  defenseZones: ['DC'],
  allowedZones: ['DC', 'DE', 'DD', 'MDC'],
  forbiddenZones: ['OC', 'OE', 'OD'],
  intentions: ['hold_position', 'build_from_back', 'progress_ball'],
  triggers: ['team_in_possession', 'ball_in_own_half'],
  profile: { discipline: 80, aggression: 50, creativity: 60, risk: 45 },
};

const CB_COVER: PlayerArchetype = {
  id: 'CB_COVER',
  basePosition: 'CB',
  family: 'defender',
  attackZones: ['DC'],
  defenseZones: ['DC', 'DE', 'DD'],
  allowedZones: ['DC', 'DE', 'DD'],
  forbiddenZones: ['MOC', 'MOE', 'MOD', 'OC', 'OE', 'OD'],
  intentions: ['hold_position', 'cover_space', 'sweep_behind'],
  triggers: ['space_behind_defense', 'team_out_of_possession', 'ball_in_final_third'],
  profile: { discipline: 95, aggression: 45, creativity: 15, risk: 10 },
};

// ── Laterais ──────────────────────────────────────────────────────────────────

const FB_CONSERVATIVE: PlayerArchetype = {
  id: 'FB_CONSERVATIVE',
  basePosition: 'RB',
  family: 'fullback',
  attackZones: ['MDE', 'MDD'],
  defenseZones: ['DE', 'DD'],
  allowedZones: ['DE', 'DD', 'MDE', 'MDD'],
  forbiddenZones: ['OC', 'OE', 'OD'],
  intentions: ['hold_width_defense', 'hold_position'],
  triggers: ['team_out_of_possession', 'ball_in_own_half'],
  profile: { discipline: 88, aggression: 55, creativity: 25, risk: 20 },
};

const FB_ATTACKING: PlayerArchetype = {
  id: 'FB_ATTACKING',
  basePosition: 'RB',
  family: 'fullback',
  attackZones: ['MDE', 'MDD', 'MOE', 'MOD'],
  defenseZones: ['DE', 'DD'],
  allowedZones: ['DE', 'DD', 'MDE', 'MDD', 'MOE', 'MOD'],
  forbiddenZones: ['OC'],
  intentions: ['overlap_attack', 'hold_width_defense'],
  triggers: ['team_in_possession', 'ball_in_right_side', 'ball_in_left_side'],
  profile: { discipline: 70, aggression: 65, creativity: 55, risk: 60 },
};

const FB_INVERTED: PlayerArchetype = {
  id: 'FB_INVERTED',
  basePosition: 'RB',
  family: 'fullback',
  attackZones: ['MDD', 'MDC'],
  defenseZones: ['DD', 'MDD'],
  allowedZones: ['MOD'],
  forbiddenZones: ['OE', 'OC'],
  intentions: ['support_inside', 'hold_width_defense', 'invert_midfield'],
  triggers: ['ball_in_right_side', 'winger_holding_width', 'midfield_overload'],
  profile: { discipline: 80, aggression: 50, creativity: 60, risk: 55 },
};

const WB_OVERLAP: PlayerArchetype = {
  id: 'WB_OVERLAP',
  basePosition: 'RWB',
  family: 'fullback',
  attackZones: ['MDE', 'MDD', 'MOE', 'MOD', 'OE', 'OD'],
  defenseZones: ['DE', 'DD', 'MDE', 'MDD'],
  allowedZones: ['DE', 'DD', 'MDE', 'MDD', 'MOE', 'MOD', 'OE', 'OD'],
  forbiddenZones: ['OC'],
  intentions: ['overlap_attack', 'hold_width_defense', 'hug_touchline'],
  triggers: ['team_in_possession', 'ball_in_right_side', 'ball_in_left_side', 'counter_attack'],
  profile: { discipline: 65, aggression: 70, creativity: 50, risk: 65 },
};

// ── Volantes ──────────────────────────────────────────────────────────────────

const DM_ANCHOR: PlayerArchetype = {
  id: 'DM_ANCHOR',
  basePosition: 'CDM',
  family: 'defensive_mid',
  attackZones: ['MDC'],
  defenseZones: ['MDC', 'DC'],
  allowedZones: ['MDE', 'MDC', 'MDD'],
  forbiddenZones: ['OC', 'OE', 'OD'],
  intentions: ['anchor_midfield', 'hold_position', 'cover_space'],
  triggers: ['team_out_of_possession', 'ball_in_own_half', 'midfield_overload'],
  profile: { discipline: 92, aggression: 55, creativity: 30, risk: 20 },
};

const DM_DESTROYER: PlayerArchetype = {
  id: 'DM_DESTROYER',
  basePosition: 'CDM',
  family: 'defensive_mid',
  attackZones: ['MDC'],
  defenseZones: ['MDC', 'MDE', 'MDD', 'DC'],
  allowedZones: ['MDE', 'MDC', 'MDD', 'DC'],
  forbiddenZones: ['OC', 'OE', 'OD'],
  intentions: ['anchor_midfield', 'break_up_play', 'man_mark', 'press_high'],
  triggers: ['team_out_of_possession', 'high_press_active', 'ball_in_center'],
  profile: { discipline: 80, aggression: 90, creativity: 20, risk: 35 },
};

const DM_PLAYMAKER: PlayerArchetype = {
  id: 'DM_PLAYMAKER',
  basePosition: 'CDM',
  family: 'defensive_mid',
  attackZones: ['MDC', 'MOC'],
  defenseZones: ['MDC', 'DC'],
  allowedZones: ['MDE', 'MDC', 'MDD', 'MOC'],
  forbiddenZones: ['OE', 'OD'],
  intentions: ['anchor_midfield', 'dictate_tempo', 'build_from_back', 'progress_ball'],
  triggers: ['team_in_possession', 'ball_in_own_half', 'ball_in_center'],
  profile: { discipline: 82, aggression: 40, creativity: 75, risk: 50 },
};

const DM_BOX: PlayerArchetype = {
  id: 'DM_BOX',
  basePosition: 'DM',
  family: 'defensive_mid',
  attackZones: ['MDC', 'MOC'],
  defenseZones: ['MDC', 'DC'],
  allowedZones: ['MDE', 'MDC', 'MDD', 'MOC', 'MOE', 'MOD'],
  forbiddenZones: [],
  intentions: ['anchor_midfield', 'box_to_box', 'break_up_play'],
  triggers: ['team_in_possession', 'team_out_of_possession', 'ball_in_center'],
  profile: { discipline: 75, aggression: 72, creativity: 45, risk: 45 },
};

// ── Meio-campo ────────────────────────────────────────────────────────────────

const CM_BOX_TO_BOX: PlayerArchetype = {
  id: 'CM_BOX_TO_BOX',
  basePosition: 'CM',
  family: 'midfielder',
  attackZones: ['MDC', 'MOC', 'OC'],
  defenseZones: ['MDC', 'DC'],
  allowedZones: ['MDE', 'MDC', 'MDD', 'MOE', 'MOC', 'MOD'],
  forbiddenZones: [],
  intentions: ['box_to_box', 'break_up_play', 'run_in_behind'],
  triggers: ['team_in_possession', 'team_out_of_possession', 'counter_attack'],
  profile: { discipline: 72, aggression: 70, creativity: 55, risk: 55 },
};

const CM_CONTROLLER: PlayerArchetype = {
  id: 'CM_CONTROLLER',
  basePosition: 'CM',
  family: 'midfielder',
  attackZones: ['MDC'],
  defenseZones: ['MDC'],
  allowedZones: ['MDE', 'MDC', 'MDD'],
  forbiddenZones: ['OC', 'OE', 'OD'],
  intentions: ['dictate_tempo', 'link_play', 'anchor_midfield'],
  triggers: ['team_in_possession', 'ball_in_center'],
  profile: { discipline: 88, aggression: 45, creativity: 65, risk: 35 },
};

const CM_MEZZALA: PlayerArchetype = {
  id: 'CM_MEZZALA',
  basePosition: 'CM',
  family: 'midfielder',
  attackZones: ['MOE', 'MOD', 'MOC'],
  defenseZones: ['MDC', 'MDE', 'MDD'],
  allowedZones: ['MDE', 'MDC', 'MDD', 'MOE', 'MOC', 'MOD'],
  forbiddenZones: [],
  intentions: ['half_space_run', 'invert_midfield', 'create_chances'],
  triggers: ['ball_in_left_side', 'ball_in_right_side', 'winger_holding_width'],
  profile: { discipline: 68, aggression: 55, creativity: 78, risk: 65 },
};

const CM_PROGRESSOR: PlayerArchetype = {
  id: 'CM_PROGRESSOR',
  basePosition: 'CM',
  family: 'midfielder',
  attackZones: ['MDC', 'MOC'],
  defenseZones: ['MDC'],
  allowedZones: ['MDE', 'MDC', 'MDD', 'MOE', 'MOC', 'MOD'],
  forbiddenZones: [],
  intentions: ['progress_ball', 'link_play', 'build_from_back'],
  triggers: ['team_in_possession', 'ball_in_own_half', 'ball_in_center'],
  profile: { discipline: 80, aggression: 48, creativity: 68, risk: 50 },
};

// ── Meias ofensivos ───────────────────────────────────────────────────────────

const AM_PLAYMAKER: PlayerArchetype = {
  id: 'AM_PLAYMAKER',
  basePosition: 'CAM',
  family: 'attacking_mid',
  attackZones: ['MOC', 'OC'],
  defenseZones: ['MDC', 'MOC'],
  allowedZones: ['MDC', 'MOE', 'MOC', 'MOD', 'OC'],
  forbiddenZones: ['DC', 'DE', 'DD'],
  intentions: ['create_chances', 'dictate_tempo', 'link_play'],
  triggers: ['team_in_possession', 'ball_in_center', 'ball_in_final_third'],
  profile: { discipline: 70, aggression: 40, creativity: 88, risk: 60 },
};

const AM_SHADOW: PlayerArchetype = {
  id: 'AM_SHADOW',
  basePosition: 'CAM',
  family: 'attacking_mid',
  attackZones: ['MOC', 'OC'],
  defenseZones: ['MOC', 'MDC'],
  allowedZones: ['MOE', 'MOC', 'MOD', 'OC', 'OE', 'OD'],
  forbiddenZones: ['DC', 'DE', 'DD'],
  intentions: ['shadow_striker', 'run_in_behind', 'create_chances'],
  triggers: ['striker_dropping_deep', 'space_behind_defense', 'ball_in_final_third'],
  profile: { discipline: 65, aggression: 60, creativity: 75, risk: 70 },
};

const AM_FREE: PlayerArchetype = {
  id: 'AM_FREE',
  basePosition: 'AM',
  family: 'attacking_mid',
  attackZones: ['MOC', 'MOE', 'MOD', 'OC'],
  defenseZones: ['MOC'],
  allowedZones: ['MOE', 'MOC', 'MOD', 'OC', 'OE', 'OD'],
  forbiddenZones: ['DC', 'DE', 'DD'],
  intentions: ['free_roam', 'create_chances', 'half_space_run'],
  triggers: ['team_in_possession', 'ball_in_final_third', 'midfield_overload'],
  profile: { discipline: 55, aggression: 50, creativity: 92, risk: 75 },
};

// ── Pontas ────────────────────────────────────────────────────────────────────

const WINGER_CLASSIC: PlayerArchetype = {
  id: 'WINGER_CLASSIC',
  basePosition: 'LW',
  family: 'winger',
  attackZones: ['MOE', 'MOD', 'OE', 'OD'],
  defenseZones: ['MDE', 'MDD'],
  allowedZones: ['MDE', 'MDD', 'MOE', 'MOD', 'OE', 'OD'],
  forbiddenZones: ['DC', 'DE', 'DD'],
  intentions: ['hug_touchline', 'overlap_attack', 'combine_wide'],
  triggers: ['team_in_possession', 'ball_in_left_side', 'ball_in_right_side'],
  profile: { discipline: 65, aggression: 55, creativity: 70, risk: 60 },
};

const WINGER_INVERTED: PlayerArchetype = {
  id: 'WINGER_INVERTED',
  basePosition: 'LW',
  family: 'winger',
  attackZones: ['MOC', 'OC', 'MOE', 'MOD'],
  defenseZones: ['MDE', 'MDD'],
  allowedZones: ['MOE', 'MOC', 'MOD', 'OE', 'OC', 'OD'],
  forbiddenZones: ['DC', 'DE', 'DD'],
  intentions: ['cut_inside', 'create_chances', 'finish_chances'],
  triggers: ['ball_in_left_side', 'ball_in_right_side', 'winger_holding_width'],
  profile: { discipline: 62, aggression: 55, creativity: 82, risk: 70 },
};

const WINGER_CREATOR: PlayerArchetype = {
  id: 'WINGER_CREATOR',
  basePosition: 'LW',
  family: 'winger',
  attackZones: ['MOE', 'MOD', 'MOC', 'OE', 'OD'],
  defenseZones: ['MDE', 'MDD'],
  allowedZones: ['MDE', 'MDD', 'MOE', 'MOC', 'MOD', 'OE', 'OD'],
  forbiddenZones: ['DC', 'DE', 'DD'],
  intentions: ['create_chances', 'combine_wide', 'hug_touchline', 'cut_inside'],
  triggers: ['team_in_possession', 'ball_in_final_third', 'midfield_overload'],
  profile: { discipline: 60, aggression: 48, creativity: 88, risk: 65 },
};

// ── Atacantes ─────────────────────────────────────────────────────────────────

const ST_FINISHER: PlayerArchetype = {
  id: 'ST_FINISHER',
  basePosition: 'ST',
  family: 'forward',
  attackZones: ['OC', 'MOC'],
  defenseZones: ['MOC'],
  allowedZones: ['MOC', 'MOE', 'MOD', 'OC', 'OE', 'OD'],
  forbiddenZones: ['DC', 'DE', 'DD', 'MDC'],
  intentions: ['finish_chances', 'run_in_behind'],
  triggers: ['space_behind_defense', 'ball_in_final_third', 'counter_attack'],
  profile: { discipline: 65, aggression: 60, creativity: 55, risk: 55 },
};

const ST_TARGET: PlayerArchetype = {
  id: 'ST_TARGET',
  basePosition: 'ST',
  family: 'forward',
  attackZones: ['OC', 'MOC'],
  defenseZones: ['MOC'],
  allowedZones: ['MOC', 'OC'],
  forbiddenZones: ['DC', 'DE', 'DD', 'MDC', 'MDE', 'MDD'],
  intentions: ['hold_up_play', 'finish_chances', 'man_mark'],
  triggers: ['ball_in_final_third', 'set_piece', 'team_in_possession'],
  profile: { discipline: 70, aggression: 75, creativity: 35, risk: 40 },
};

const ST_FALSE_9: PlayerArchetype = {
  id: 'ST_FALSE_9',
  basePosition: 'CF',
  family: 'forward',
  attackZones: ['MOC', 'OC'],
  defenseZones: ['MOC', 'MDC'],
  allowedZones: ['MDC', 'MOE', 'MOC', 'MOD', 'OC'],
  forbiddenZones: ['DC', 'DE', 'DD'],
  intentions: ['drop_deep', 'create_chances', 'link_play', 'free_roam'],
  triggers: ['team_in_possession', 'striker_dropping_deep', 'midfield_overload'],
  profile: { discipline: 60, aggression: 45, creativity: 88, risk: 65 },
};

const ST_PRESSING: PlayerArchetype = {
  id: 'ST_PRESSING',
  basePosition: 'ST',
  family: 'forward',
  attackZones: ['OC', 'MOC'],
  defenseZones: ['OC', 'MOC', 'MOE', 'MOD'],
  allowedZones: ['MOC', 'MOE', 'MOD', 'OC', 'OE', 'OD'],
  forbiddenZones: ['DC', 'DE', 'DD'],
  intentions: ['press_defenders', 'press_high', 'finish_chances'],
  triggers: ['high_press_active', 'team_out_of_possession', 'ball_in_own_half'],
  profile: { discipline: 72, aggression: 82, creativity: 45, risk: 50 },
};

// ── Catálogo ──────────────────────────────────────────────────────────────────

export const ARCHETYPES: PlayerArchetype[] = [
  GK_CLASSIC, GK_SWEEPER, GK_BUILD_UP,
  CB_DEFENDER, CB_AGGRESSIVE, CB_BALL_PLAYING, CB_COVER,
  FB_CONSERVATIVE, FB_ATTACKING, FB_INVERTED, WB_OVERLAP,
  DM_ANCHOR, DM_DESTROYER, DM_PLAYMAKER, DM_BOX,
  CM_BOX_TO_BOX, CM_CONTROLLER, CM_MEZZALA, CM_PROGRESSOR,
  AM_PLAYMAKER, AM_SHADOW, AM_FREE,
  WINGER_CLASSIC, WINGER_INVERTED, WINGER_CREATOR,
  ST_FINISHER, ST_TARGET, ST_FALSE_9, ST_PRESSING,
];

export const ARCHETYPE_BY_ID: Record<ArchetypeId, PlayerArchetype> =
  Object.fromEntries(ARCHETYPES.map(a => [a.id, a])) as Record<ArchetypeId, PlayerArchetype>;

export function getArchetypesByFamily(family: ArchetypeFamily): PlayerArchetype[] {
  return ARCHETYPES.filter(a => a.family === family);
}
