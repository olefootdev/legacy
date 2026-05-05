/**
 * /src/tactical/archetypesCatalog.ts
 *
 * Catálogo canônico de arquétipos táticos do Olefoot.
 * 25 arquétipos base — FONTE ÚNICA DE VERDADE para comportamento de jogadores.
 */

import type { FieldZoneId } from './zones12';

export type ArchetypeId =
  // Goleiros base
  | 'GK_CLASSIC' | 'GK_SWEEPER' | 'GK_BUILD_UP'
  // Goleiros premium
  | 'GK_COMMANDER' | 'GK_RISK_PLAYER'
  // Zagueiros base
  | 'CB_DEFENDER' | 'CB_AGGRESSIVE' | 'CB_BALL_PLAYING' | 'CB_COVER'
  // Zagueiros premium
  | 'CB_LINE_BREAKER' | 'CB_STEP_OUT' | 'CB_ORCHESTRATOR' | 'CB_LAST_MAN' | 'CB_DUELIST'
  // Laterais base
  | 'FB_CONSERVATIVE' | 'FB_ATTACKING' | 'FB_INVERTED' | 'WB_OVERLAP'
  // Laterais premium
  | 'FB_UNDERLAP' | 'FB_SWITCHER' | 'FB_SUPPORTER' | 'WB_CROSSER' | 'FB_RECOVERY'
  // Volantes base
  | 'DM_ANCHOR' | 'DM_DESTROYER' | 'DM_PLAYMAKER' | 'DM_BOX'
  // Volantes premium
  | 'DM_SCREEN' | 'DM_PRESS_TRIGGER' | 'DM_LINKER' | 'DM_SPACE_CONTROLLER'
  // Meio-campo base
  | 'CM_BOX_TO_BOX' | 'CM_CONTROLLER' | 'CM_MEZZALA' | 'CM_PROGRESSOR'
  // Meio-campo premium
  | 'CM_TEMPO_SETTER' | 'CM_SPACE_ATTACKER' | 'CM_ROTATOR' | 'CM_SUPPORT_ENGINE'
  // Meias ofensivos base
  | 'AM_PLAYMAKER' | 'AM_SHADOW' | 'AM_FREE'
  // Meias ofensivos premium
  | 'AM_GHOST' | 'AM_DRIFTER' | 'AM_LINK_ATTACK'
  // Pontas base
  | 'WINGER_CLASSIC' | 'WINGER_INVERTED' | 'WINGER_CREATOR'
  // Pontas premium
  | 'WINGER_SPACE_EXPLOITER'
  // Atacantes base
  | 'ST_FINISHER' | 'ST_TARGET' | 'ST_FALSE_9' | 'ST_PRESSING'
  // Atacantes premium
  | 'ST_CHANNEL_RUNNER';

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
  | 'run_in_behind'
  | 'organize_defense'
  | 'carry_ball_forward'
  | 'step_out_press'
  | 'orchestrate_buildup'
  | 'underlap_run'
  | 'switch_flanks'
  | 'short_support'
  | 'deliver_cross'
  | 'recovery_run'
  | 'screen_defense'
  | 'trigger_press'
  | 'link_defense_attack'
  | 'close_spaces'
  | 'set_tempo'
  | 'exploit_space'
  | 'rotate_position'
  | 'offer_pass_option'
  | 'ghost_run'
  | 'drift_zones'
  | 'connect_wide_attack'
  | 'channel_run';

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
  | 'counter_attack'
  | 'defensive_line_high'
  | 'defensive_line_low'
  | 'fullback_inverted'
  | 'channel_available'
  | 'pressing_trap';

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
  tier: 'base' | 'premium';
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
  tier: 'base',
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
  tier: 'base',
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
  tier: 'base',
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
  tier: 'base',
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
  tier: 'base',
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
  tier: 'base',
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
  tier: 'base',
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
  tier: 'base',
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
  tier: 'base',
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
  tier: 'base',
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
  tier: 'base',
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
  tier: 'base',
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
  tier: 'base',
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
  tier: 'base',
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
  tier: 'base',
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
  tier: 'base',
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
  tier: 'base',
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
  tier: 'base',
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
  tier: 'base',
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
  tier: 'base',
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
  tier: 'base',
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
  tier: 'base',
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
  tier: 'base',
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
  tier: 'base',
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
  tier: 'base',
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
  tier: 'base',
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
  tier: 'base',
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
  tier: 'base',
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
  tier: 'base',
  attackZones: ['OC', 'MOC'],
  defenseZones: ['OC', 'MOC', 'MOE', 'MOD'],
  allowedZones: ['MOC', 'MOE', 'MOD', 'OC', 'OE', 'OD'],
  forbiddenZones: ['DC', 'DE', 'DD'],
  intentions: ['press_defenders', 'press_high', 'finish_chances'],
  triggers: ['high_press_active', 'team_out_of_possession', 'ball_in_own_half'],
  profile: { discipline: 72, aggression: 82, creativity: 45, risk: 50 },
};

// ── Catálogo ──────────────────────────────────────────────────────────────────
// ── Goleiros premium ──────────────────────────────────────────────────────────

const GK_COMMANDER: PlayerArchetype = {
  id: 'GK_COMMANDER', basePosition: 'GK', family: 'goalkeeper', tier: 'premium',
  attackZones: ['DC'], defenseZones: ['DC', 'DE', 'DD'],
  allowedZones: ['DC', 'DE', 'DD'], forbiddenZones: ['MOC', 'MOE', 'MOD', 'OC', 'OE', 'OD'],
  intentions: ['hold_position', 'organize_defense'],
  triggers: ['team_out_of_possession', 'set_piece', 'ball_in_final_third'],
  profile: { discipline: 92, aggression: 50, creativity: 30, risk: 20 },
};

const GK_RISK_PLAYER: PlayerArchetype = {
  id: 'GK_RISK_PLAYER', basePosition: 'GK', family: 'goalkeeper', tier: 'premium',
  attackZones: ['DC', 'MDC'], defenseZones: ['DC'],
  allowedZones: ['DC', 'DE', 'DD', 'MDC'], forbiddenZones: ['OC', 'OE', 'OD'],
  intentions: ['build_from_back', 'carry_ball_forward'],
  triggers: ['team_in_possession', 'high_press_active', 'ball_in_own_half'],
  profile: { discipline: 65, aggression: 45, creativity: 70, risk: 80 },
};

// ── Zagueiros premium ─────────────────────────────────────────────────────────

const CB_LINE_BREAKER: PlayerArchetype = {
  id: 'CB_LINE_BREAKER', basePosition: 'CB', family: 'defender', tier: 'premium',
  attackZones: ['MDC', 'MOC'], defenseZones: ['DC'],
  allowedZones: ['DC', 'MDC', 'MOC'], forbiddenZones: ['OE', 'OD'],
  intentions: ['carry_ball_forward', 'progress_ball', 'build_from_back'],
  triggers: ['team_in_possession', 'space_behind_defense', 'defensive_line_high'],
  profile: { discipline: 70, aggression: 55, creativity: 72, risk: 68 },
};

const CB_STEP_OUT: PlayerArchetype = {
  id: 'CB_STEP_OUT', basePosition: 'CB', family: 'defender', tier: 'premium',
  attackZones: ['DC', 'MDC'], defenseZones: ['DC', 'MDC'],
  allowedZones: ['DC', 'DE', 'DD', 'MDC'], forbiddenZones: ['OC', 'OE', 'OD'],
  intentions: ['step_out_press', 'man_mark', 'press_high'],
  triggers: ['high_press_active', 'pressing_trap', 'ball_in_own_half'],
  profile: { discipline: 75, aggression: 80, creativity: 30, risk: 50 },
};

const CB_ORCHESTRATOR: PlayerArchetype = {
  id: 'CB_ORCHESTRATOR', basePosition: 'CB', family: 'defender', tier: 'premium',
  attackZones: ['DC', 'MDC'], defenseZones: ['DC'],
  allowedZones: ['DC', 'DE', 'DD', 'MDC'], forbiddenZones: ['OC', 'OE', 'OD'],
  intentions: ['orchestrate_buildup', 'build_from_back', 'dictate_tempo'],
  triggers: ['team_in_possession', 'ball_in_own_half', 'defensive_line_high'],
  profile: { discipline: 85, aggression: 40, creativity: 80, risk: 45 },
};

const CB_LAST_MAN: PlayerArchetype = {
  id: 'CB_LAST_MAN', basePosition: 'CB', family: 'defender', tier: 'premium',
  attackZones: ['DC'], defenseZones: ['DC', 'DE', 'DD'],
  allowedZones: ['DC', 'DE', 'DD'], forbiddenZones: ['MDC', 'MOC', 'OC', 'OE', 'OD'],
  intentions: ['hold_position', 'cover_space', 'sweep_behind'],
  triggers: ['defensive_line_low', 'space_behind_defense', 'team_out_of_possession'],
  profile: { discipline: 98, aggression: 40, creativity: 10, risk: 5 },
};

const CB_DUELIST: PlayerArchetype = {
  id: 'CB_DUELIST', basePosition: 'CB', family: 'defender', tier: 'premium',
  attackZones: ['DC'], defenseZones: ['DC', 'DE', 'DD'],
  allowedZones: ['DC', 'DE', 'DD', 'MDC'], forbiddenZones: ['OC', 'OE', 'OD'],
  intentions: ['man_mark', 'press_high', 'hold_position'],
  triggers: ['team_out_of_possession', 'ball_in_final_third', 'high_press_active'],
  profile: { discipline: 80, aggression: 92, creativity: 20, risk: 45 },
};

// ── Laterais premium ──────────────────────────────────────────────────────────

const FB_UNDERLAP: PlayerArchetype = {
  id: 'FB_UNDERLAP', basePosition: 'RB', family: 'fullback', tier: 'premium',
  attackZones: ['MDD', 'MDC', 'MOD'], defenseZones: ['DD', 'MDD'],
  allowedZones: ['DD', 'MDD', 'MDC', 'MOD'], forbiddenZones: ['OE', 'OC'],
  intentions: ['underlap_run', 'support_inside', 'link_play'],
  triggers: ['winger_holding_width', 'fullback_inverted', 'team_in_possession'],
  profile: { discipline: 75, aggression: 55, creativity: 65, risk: 58 },
};

const FB_SWITCHER: PlayerArchetype = {
  id: 'FB_SWITCHER', basePosition: 'RB', family: 'fullback', tier: 'premium',
  attackZones: ['MDE', 'MDD', 'MOE', 'MOD'], defenseZones: ['DE', 'DD'],
  allowedZones: ['DE', 'DD', 'MDE', 'MDD', 'MOE', 'MOD'], forbiddenZones: [],
  intentions: ['switch_flanks', 'overlap_attack', 'hug_touchline'],
  triggers: ['ball_in_left_side', 'ball_in_right_side', 'midfield_overload'],
  profile: { discipline: 68, aggression: 60, creativity: 70, risk: 62 },
};

const FB_SUPPORTER: PlayerArchetype = {
  id: 'FB_SUPPORTER', basePosition: 'RB', family: 'fullback', tier: 'premium',
  attackZones: ['MDD', 'MDE'], defenseZones: ['DD', 'DE'],
  allowedZones: ['DE', 'DD', 'MDE', 'MDD'], forbiddenZones: ['OC', 'OE', 'OD'],
  intentions: ['short_support', 'hold_width_defense', 'offer_pass_option'],
  triggers: ['team_in_possession', 'ball_in_own_half', 'ball_in_center'],
  profile: { discipline: 85, aggression: 50, creativity: 45, risk: 30 },
};

const WB_CROSSER: PlayerArchetype = {
  id: 'WB_CROSSER', basePosition: 'RWB', family: 'fullback', tier: 'premium',
  attackZones: ['MOE', 'MOD', 'OE', 'OD'], defenseZones: ['DE', 'DD', 'MDE', 'MDD'],
  allowedZones: ['MDE', 'MDD', 'MOE', 'MOD', 'OE', 'OD'], forbiddenZones: ['OC'],
  intentions: ['deliver_cross', 'hug_touchline', 'overlap_attack'],
  triggers: ['team_in_possession', 'ball_in_final_third', 'ball_in_right_side', 'ball_in_left_side'],
  profile: { discipline: 68, aggression: 62, creativity: 60, risk: 60 },
};

const FB_RECOVERY: PlayerArchetype = {
  id: 'FB_RECOVERY', basePosition: 'RB', family: 'fullback', tier: 'premium',
  attackZones: ['MDD', 'MDE'], defenseZones: ['DD', 'DE', 'MDD', 'MDE'],
  allowedZones: ['DE', 'DD', 'MDE', 'MDD'], forbiddenZones: ['OC', 'OE', 'OD'],
  intentions: ['recovery_run', 'hold_width_defense', 'cover_space'],
  triggers: ['counter_attack', 'team_out_of_possession', 'space_behind_defense'],
  profile: { discipline: 88, aggression: 65, creativity: 20, risk: 15 },
};

// ── Volantes premium ──────────────────────────────────────────────────────────

const DM_SCREEN: PlayerArchetype = {
  id: 'DM_SCREEN', basePosition: 'CDM', family: 'defensive_mid', tier: 'premium',
  attackZones: ['MDC'], defenseZones: ['MDC', 'DC', 'MDE', 'MDD'],
  allowedZones: ['MDE', 'MDC', 'MDD'], forbiddenZones: ['OC', 'OE', 'OD'],
  intentions: ['screen_defense', 'anchor_midfield', 'close_spaces'],
  triggers: ['team_out_of_possession', 'defensive_line_low', 'low_block_active'],
  profile: { discipline: 95, aggression: 60, creativity: 20, risk: 15 },
};

const DM_PRESS_TRIGGER: PlayerArchetype = {
  id: 'DM_PRESS_TRIGGER', basePosition: 'CDM', family: 'defensive_mid', tier: 'premium',
  attackZones: ['MDC', 'MOC'], defenseZones: ['MDC', 'MDE', 'MDD'],
  allowedZones: ['MDE', 'MDC', 'MDD', 'MOC'], forbiddenZones: ['OE', 'OD'],
  intentions: ['trigger_press', 'press_high', 'break_up_play'],
  triggers: ['high_press_active', 'pressing_trap', 'ball_in_center'],
  profile: { discipline: 78, aggression: 88, creativity: 35, risk: 45 },
};

const DM_LINKER: PlayerArchetype = {
  id: 'DM_LINKER', basePosition: 'CDM', family: 'defensive_mid', tier: 'premium',
  attackZones: ['MDC', 'MOC'], defenseZones: ['MDC', 'DC'],
  allowedZones: ['MDE', 'MDC', 'MDD', 'MOC'], forbiddenZones: ['OE', 'OD'],
  intentions: ['link_defense_attack', 'progress_ball', 'dictate_tempo'],
  triggers: ['team_in_possession', 'ball_in_own_half', 'ball_in_center'],
  profile: { discipline: 82, aggression: 45, creativity: 72, risk: 48 },
};

const DM_SPACE_CONTROLLER: PlayerArchetype = {
  id: 'DM_SPACE_CONTROLLER', basePosition: 'CDM', family: 'defensive_mid', tier: 'premium',
  attackZones: ['MDC'], defenseZones: ['MDC', 'MDE', 'MDD', 'DC'],
  allowedZones: ['MDE', 'MDC', 'MDD'], forbiddenZones: ['OC', 'OE', 'OD'],
  intentions: ['close_spaces', 'anchor_midfield', 'cover_space'],
  triggers: ['team_out_of_possession', 'low_block_active', 'defensive_line_low'],
  profile: { discipline: 93, aggression: 50, creativity: 25, risk: 12 },
};

// ── Meio-campo premium ────────────────────────────────────────────────────────

const CM_TEMPO_SETTER: PlayerArchetype = {
  id: 'CM_TEMPO_SETTER', basePosition: 'CM', family: 'midfielder', tier: 'premium',
  attackZones: ['MDC', 'MOC'], defenseZones: ['MDC'],
  allowedZones: ['MDE', 'MDC', 'MDD', 'MOC'], forbiddenZones: ['OE', 'OD'],
  intentions: ['set_tempo', 'dictate_tempo', 'link_play'],
  triggers: ['team_in_possession', 'ball_in_center', 'ball_in_own_half'],
  profile: { discipline: 88, aggression: 42, creativity: 78, risk: 38 },
};

const CM_SPACE_ATTACKER: PlayerArchetype = {
  id: 'CM_SPACE_ATTACKER', basePosition: 'CM', family: 'midfielder', tier: 'premium',
  attackZones: ['MOC', 'MOE', 'MOD', 'OC'], defenseZones: ['MDC'],
  allowedZones: ['MDC', 'MOE', 'MOC', 'MOD', 'OC'], forbiddenZones: ['DC', 'DE', 'DD'],
  intentions: ['exploit_space', 'run_in_behind', 'half_space_run'],
  triggers: ['space_behind_defense', 'counter_attack', 'ball_in_final_third'],
  profile: { discipline: 65, aggression: 65, creativity: 75, risk: 72 },
};

const CM_ROTATOR: PlayerArchetype = {
  id: 'CM_ROTATOR', basePosition: 'CM', family: 'midfielder', tier: 'premium',
  attackZones: ['MDC', 'MOC', 'MOE', 'MOD'], defenseZones: ['MDC', 'MDE', 'MDD'],
  allowedZones: ['MDE', 'MDC', 'MDD', 'MOE', 'MOC', 'MOD'], forbiddenZones: [],
  intentions: ['rotate_position', 'box_to_box', 'link_play'],
  triggers: ['team_in_possession', 'midfield_overload', 'ball_in_center'],
  profile: { discipline: 70, aggression: 58, creativity: 72, risk: 55 },
};

const CM_SUPPORT_ENGINE: PlayerArchetype = {
  id: 'CM_SUPPORT_ENGINE', basePosition: 'CM', family: 'midfielder', tier: 'premium',
  attackZones: ['MDC', 'MOC'], defenseZones: ['MDC'],
  allowedZones: ['MDE', 'MDC', 'MDD', 'MOE', 'MOC', 'MOD'], forbiddenZones: [],
  intentions: ['offer_pass_option', 'short_support', 'link_play'],
  triggers: ['team_in_possession', 'ball_in_center', 'ball_in_own_half'],
  profile: { discipline: 85, aggression: 45, creativity: 65, risk: 35 },
};

// ── Meias ofensivos premium ───────────────────────────────────────────────────

const AM_GHOST: PlayerArchetype = {
  id: 'AM_GHOST', basePosition: 'CAM', family: 'attacking_mid', tier: 'premium',
  attackZones: ['OC', 'MOC'], defenseZones: ['MOC'],
  allowedZones: ['MOC', 'OC', 'OE', 'OD'], forbiddenZones: ['DC', 'DE', 'DD', 'MDC'],
  intentions: ['ghost_run', 'run_in_behind', 'finish_chances'],
  triggers: ['space_behind_defense', 'ball_in_final_third', 'striker_dropping_deep'],
  profile: { discipline: 60, aggression: 50, creativity: 85, risk: 75 },
};

const AM_DRIFTER: PlayerArchetype = {
  id: 'AM_DRIFTER', basePosition: 'AM', family: 'attacking_mid', tier: 'premium',
  attackZones: ['MOE', 'MOC', 'MOD', 'OC'], defenseZones: ['MOC', 'MDC'],
  allowedZones: ['MDC', 'MOE', 'MOC', 'MOD', 'OC', 'OE', 'OD'], forbiddenZones: ['DC', 'DE', 'DD'],
  intentions: ['drift_zones', 'free_roam', 'create_chances'],
  triggers: ['team_in_possession', 'midfield_overload', 'ball_in_final_third'],
  profile: { discipline: 52, aggression: 45, creativity: 90, risk: 78 },
};

const AM_LINK_ATTACK: PlayerArchetype = {
  id: 'AM_LINK_ATTACK', basePosition: 'CAM', family: 'attacking_mid', tier: 'premium',
  attackZones: ['MOC', 'MOE', 'MOD'], defenseZones: ['MOC', 'MDC'],
  allowedZones: ['MDC', 'MOE', 'MOC', 'MOD', 'OC'], forbiddenZones: ['DC', 'DE', 'DD'],
  intentions: ['connect_wide_attack', 'link_play', 'create_chances'],
  triggers: ['winger_holding_width', 'ball_in_final_third', 'team_in_possession'],
  profile: { discipline: 72, aggression: 45, creativity: 82, risk: 58 },
};

// ── Pontas premium ────────────────────────────────────────────────────────────

const WINGER_SPACE_EXPLOITER: PlayerArchetype = {
  id: 'WINGER_SPACE_EXPLOITER', basePosition: 'LW', family: 'winger', tier: 'premium',
  attackZones: ['MOE', 'MOD', 'MOC', 'OE', 'OD', 'OC'], defenseZones: ['MDE', 'MDD'],
  allowedZones: ['MDE', 'MDD', 'MOE', 'MOC', 'MOD', 'OE', 'OC', 'OD'], forbiddenZones: ['DC', 'DE', 'DD'],
  intentions: ['exploit_space', 'free_roam', 'run_in_behind'],
  triggers: ['space_behind_defense', 'channel_available', 'counter_attack'],
  profile: { discipline: 55, aggression: 58, creativity: 85, risk: 72 },
};

// ── Atacantes premium ─────────────────────────────────────────────────────────

const ST_CHANNEL_RUNNER: PlayerArchetype = {
  id: 'ST_CHANNEL_RUNNER', basePosition: 'ST', family: 'forward', tier: 'premium',
  attackZones: ['OC', 'OE', 'OD'], defenseZones: ['MOC'],
  allowedZones: ['MOC', 'MOE', 'MOD', 'OC', 'OE', 'OD'], forbiddenZones: ['DC', 'DE', 'DD', 'MDC'],
  intentions: ['channel_run', 'run_in_behind', 'finish_chances'],
  triggers: ['channel_available', 'space_behind_defense', 'counter_attack', 'defensive_line_high'],
  profile: { discipline: 62, aggression: 65, creativity: 60, risk: 68 },
};

export const ARCHETYPES: PlayerArchetype[] = [
  // base
  GK_CLASSIC, GK_SWEEPER, GK_BUILD_UP,
  CB_DEFENDER, CB_AGGRESSIVE, CB_BALL_PLAYING, CB_COVER,
  FB_CONSERVATIVE, FB_ATTACKING, FB_INVERTED, WB_OVERLAP,
  DM_ANCHOR, DM_DESTROYER, DM_PLAYMAKER, DM_BOX,
  CM_BOX_TO_BOX, CM_CONTROLLER, CM_MEZZALA, CM_PROGRESSOR,
  AM_PLAYMAKER, AM_SHADOW, AM_FREE,
  WINGER_CLASSIC, WINGER_INVERTED, WINGER_CREATOR,
  ST_FINISHER, ST_TARGET, ST_FALSE_9, ST_PRESSING,
  // premium
  GK_COMMANDER, GK_RISK_PLAYER,
  CB_LINE_BREAKER, CB_STEP_OUT, CB_ORCHESTRATOR, CB_LAST_MAN, CB_DUELIST,
  FB_UNDERLAP, FB_SWITCHER, FB_SUPPORTER, WB_CROSSER, FB_RECOVERY,
  DM_SCREEN, DM_PRESS_TRIGGER, DM_LINKER, DM_SPACE_CONTROLLER,
  CM_TEMPO_SETTER, CM_SPACE_ATTACKER, CM_ROTATOR, CM_SUPPORT_ENGINE,
  AM_GHOST, AM_DRIFTER, AM_LINK_ATTACK,
  WINGER_SPACE_EXPLOITER,
  ST_CHANNEL_RUNNER,
];


export const ARCHETYPE_BY_ID: Record<ArchetypeId, PlayerArchetype> =
  Object.fromEntries(ARCHETYPES.map(a => [a.id, a])) as Record<ArchetypeId, PlayerArchetype>;

export function getArchetypesByFamily(family: ArchetypeFamily): PlayerArchetype[] {
  return ARCHETYPES.filter(a => a.family === family);
}
