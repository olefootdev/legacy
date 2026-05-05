/**
 * /src/tactical/roles.ts
 *
 * Catálogo completo de roles táticas do Olefoot.
 * Importa tipos de roleTypes.ts e exporta TACTICAL_ROLES + TACTICAL_ROLE_BY_ID.
 */

import type { TacticalRole, TacticalRoleId } from './roleTypes';

// ── GOLEIROS ──────────────────────────────────────────────────────────────────

const GK_CLASSIC: TacticalRole = {
  roleId: 'GK_CLASSIC',
  label: 'GK',
  basePosition: 'GK',
  family: 'goalkeeper',
  attackShape: ['DC'],
  defenseShape: ['DC'],
  allowedZones: ['DE', 'DC', 'DD'],
  forbiddenZones: ['MOE', 'MOC', 'MOD', 'OE', 'OC', 'OD'],
  behaviorProfile: { aggression: 30, discipline: 90, creativity: 20, support: 25, risk: 10 },
};

const GK_SWEEPER: TacticalRole = {
  roleId: 'GK_SWEEPER',
  label: 'SK',
  basePosition: 'GK',
  family: 'goalkeeper',
  attackShape: ['DC', 'MDC'],
  defenseShape: ['DC', 'MDC'],
  allowedZones: ['DE', 'DC', 'DD', 'MDE', 'MDC', 'MDD'],
  forbiddenZones: ['MOE', 'MOC', 'MOD', 'OE', 'OC', 'OD'],
  behaviorProfile: { aggression: 45, discipline: 75, creativity: 50, support: 40, risk: 35 },
};

// ── ZAGUEIROS ─────────────────────────────────────────────────────────────────

const CB_STOPPER: TacticalRole = {
  roleId: 'CB_STOPPER',
  label: 'CB',
  basePosition: 'CB',
  family: 'defender',
  attackShape: ['DC'],
  defenseShape: ['DC', 'MDC'],
  allowedZones: ['DE', 'DC', 'DD', 'MDE', 'MDC', 'MDD'],
  forbiddenZones: ['MOE', 'MOC', 'MOD', 'OE', 'OC', 'OD'],
  behaviorProfile: { aggression: 80, discipline: 85, creativity: 20, support: 30, risk: 15 },
};

const CB_LEFT: TacticalRole = {
  roleId: 'CB_LEFT',
  label: 'LCB',
  basePosition: 'CB',
  family: 'defender',
  attackShape: ['DE', 'DC'],
  defenseShape: ['DE', 'DC'],
  allowedZones: ['DE', 'DC', 'DD', 'MDE', 'MDC'],
  forbiddenZones: ['MOE', 'MOC', 'MOD', 'OE', 'OC', 'OD'],
  behaviorProfile: { aggression: 70, discipline: 85, creativity: 25, support: 35, risk: 15 },
};

const CB_RIGHT: TacticalRole = {
  roleId: 'CB_RIGHT',
  label: 'RCB',
  basePosition: 'CB',
  family: 'defender',
  attackShape: ['DC', 'DD'],
  defenseShape: ['DC', 'DD'],
  allowedZones: ['DE', 'DC', 'DD', 'MDC', 'MDD'],
  forbiddenZones: ['MOE', 'MOC', 'MOD', 'OE', 'OC', 'OD'],
  behaviorProfile: { aggression: 70, discipline: 85, creativity: 25, support: 35, risk: 15 },
};

const CB_SWEEPER: TacticalRole = {
  roleId: 'CB_SWEEPER',
  label: 'SW',
  basePosition: 'SW',
  family: 'defender',
  attackShape: ['DC', 'MDC'],
  defenseShape: ['DE', 'DC', 'DD'],
  allowedZones: ['DE', 'DC', 'DD', 'MDE', 'MDC', 'MDD'],
  forbiddenZones: ['MOE', 'MOC', 'MOD', 'OE', 'OC', 'OD'],
  behaviorProfile: { aggression: 55, discipline: 80, creativity: 55, support: 45, risk: 25 },
};

const CB_BUILDER: TacticalRole = {
  roleId: 'CB_BUILDER',
  label: 'BPD',
  basePosition: 'BPD',
  family: 'defender',
  attackShape: ['DC', 'MDC'],
  defenseShape: ['DC'],
  allowedZones: ['DE', 'DC', 'DD', 'MDE', 'MDC', 'MDD'],
  forbiddenZones: ['MOE', 'MOC', 'MOD', 'OE', 'OC', 'OD'],
  behaviorProfile: { aggression: 50, discipline: 75, creativity: 65, support: 70, risk: 35 },
};

// ── LATERAIS ──────────────────────────────────────────────────────────────────

const LB_CLASSIC: TacticalRole = {
  roleId: 'LB_CLASSIC',
  label: 'LB',
  basePosition: 'LB',
  family: 'fullback',
  attackShape: ['MDE', 'MOE'],
  defenseShape: ['DE', 'MDE'],
  allowedZones: ['DE', 'MDE', 'MOE', 'OE'],
  forbiddenZones: ['DC', 'DD', 'MDC', 'MDD', 'OC', 'OD'],
  behaviorProfile: { aggression: 55, discipline: 75, creativity: 40, support: 60, risk: 40 },
};

const RB_CLASSIC: TacticalRole = {
  roleId: 'RB_CLASSIC',
  label: 'RB',
  basePosition: 'RB',
  family: 'fullback',
  attackShape: ['MDD', 'MOD'],
  defenseShape: ['DD', 'MDD'],
  allowedZones: ['DD', 'MDD', 'MOD', 'OD'],
  forbiddenZones: ['DC', 'DE', 'MDC', 'MDE', 'OC', 'OE'],
  behaviorProfile: { aggression: 55, discipline: 75, creativity: 40, support: 60, risk: 40 },
};

const LWB_ATTACK: TacticalRole = {
  roleId: 'LWB_ATTACK',
  label: 'LWB',
  basePosition: 'LWB',
  family: 'fullback',
  attackShape: ['MOE', 'OE'],
  defenseShape: ['DE', 'MDE'],
  allowedZones: ['DE', 'MDE', 'MOE', 'OE'],
  forbiddenZones: ['DC', 'DD', 'MDC', 'MDD', 'OC', 'OD'],
  behaviorProfile: { aggression: 60, discipline: 65, creativity: 55, support: 80, risk: 60 },
};

const RWB_ATTACK: TacticalRole = {
  roleId: 'RWB_ATTACK',
  label: 'RWB',
  basePosition: 'RWB',
  family: 'fullback',
  attackShape: ['MOD', 'OD'],
  defenseShape: ['DD', 'MDD'],
  allowedZones: ['DD', 'MDD', 'MOD', 'OD'],
  forbiddenZones: ['DC', 'DE', 'MDC', 'MDE', 'OC', 'OE'],
  behaviorProfile: { aggression: 60, discipline: 65, creativity: 55, support: 80, risk: 60 },
};

const IWB_LEFT: TacticalRole = {
  roleId: 'IWB_LEFT',
  label: 'IWB',
  basePosition: 'IWB',
  family: 'fullback',
  attackShape: ['MDC', 'MOC'],
  defenseShape: ['DE', 'MDE'],
  allowedZones: ['DE', 'MDE', 'MDC', 'MOE', 'MOC'],
  forbiddenZones: ['OE', 'OC', 'OD'],
  behaviorProfile: { aggression: 55, discipline: 70, creativity: 60, support: 70, risk: 45 },
};

const IWB_RIGHT: TacticalRole = {
  roleId: 'IWB_RIGHT',
  label: 'IWB',
  basePosition: 'IWB',
  family: 'fullback',
  attackShape: ['MDC', 'MOC'],
  defenseShape: ['DD', 'MDD'],
  allowedZones: ['DD', 'MDD', 'MDC', 'MOD', 'MOC'],
  forbiddenZones: ['OE', 'OC', 'OD'],
  behaviorProfile: { aggression: 55, discipline: 70, creativity: 60, support: 70, risk: 45 },
};

const FB_CONSERVATIVE: TacticalRole = {
  roleId: 'FB_CONSERVATIVE',
  label: 'FB',
  basePosition: 'FB',
  family: 'fullback',
  attackShape: ['MDE', 'MDD'],
  defenseShape: ['DE', 'DD'],
  allowedZones: ['DE', 'DD', 'MDE', 'MDD'],
  forbiddenZones: ['MOE', 'MOC', 'MOD', 'OE', 'OC', 'OD'],
  behaviorProfile: { aggression: 50, discipline: 88, creativity: 25, support: 40, risk: 15 },
};

const WB_AGGRESSIVE: TacticalRole = {
  roleId: 'WB_AGGRESSIVE',
  label: 'WB',
  basePosition: 'WB',
  family: 'fullback',
  attackShape: ['MOE', 'MOD', 'OE', 'OD'],
  defenseShape: ['DE', 'DD', 'MDE', 'MDD'],
  allowedZones: ['DE', 'DD', 'MDE', 'MDD', 'MOE', 'MOD', 'OE', 'OD'],
  forbiddenZones: ['DC', 'MDC', 'MOC', 'OC'],
  behaviorProfile: { aggression: 75, discipline: 60, creativity: 50, support: 80, risk: 55 },
};

// ── VOLANTES ──────────────────────────────────────────────────────────────────

const CDM_ANCHOR: TacticalRole = {
  roleId: 'CDM_ANCHOR',
  label: 'CDM',
  basePosition: 'CDM',
  family: 'midfielder',
  attackShape: ['MDC'],
  defenseShape: ['MDC', 'DC'],
  allowedZones: ['MDE', 'MDC', 'MDD', 'DE', 'DC', 'DD'],
  forbiddenZones: ['MOE', 'MOC', 'MOD', 'OE', 'OC', 'OD'],
  behaviorProfile: { aggression: 65, discipline: 92, creativity: 25, support: 50, risk: 10 },
};

const CDM_DESTROYER: TacticalRole = {
  roleId: 'CDM_DESTROYER',
  label: 'CDM',
  basePosition: 'CDM',
  family: 'midfielder',
  attackShape: ['MDC'],
  defenseShape: ['MDC', 'MDE', 'MDD'],
  allowedZones: ['MDE', 'MDC', 'MDD', 'DE', 'DC', 'DD'],
  forbiddenZones: ['MOE', 'MOC', 'MOD', 'OE', 'OC', 'OD'],
  behaviorProfile: { aggression: 95, discipline: 80, creativity: 15, support: 35, risk: 20 },
};

const CDM_REGISTA: TacticalRole = {
  roleId: 'CDM_REGISTA',
  label: 'DM',
  basePosition: 'DM',
  family: 'midfielder',
  attackShape: ['MDC', 'MOC'],
  defenseShape: ['MDC'],
  allowedZones: ['MDE', 'MDC', 'MDD', 'MOE', 'MOC', 'MOD'],
  forbiddenZones: ['DE', 'DC', 'DD', 'OE', 'OC', 'OD'],
  behaviorProfile: { aggression: 40, discipline: 70, creativity: 85, support: 80, risk: 50 },
};

const CDM_HALFBACK: TacticalRole = {
  roleId: 'CDM_HALFBACK',
  label: 'CDM',
  basePosition: 'CDM',
  family: 'midfielder',
  attackShape: ['MDC'],
  defenseShape: ['DC', 'MDC'],
  allowedZones: ['DE', 'DC', 'DD', 'MDE', 'MDC', 'MDD'],
  forbiddenZones: ['MOE', 'MOC', 'MOD', 'OE', 'OC', 'OD'],
  behaviorProfile: { aggression: 60, discipline: 93, creativity: 30, support: 55, risk: 12 },
};

// ── MEIO-CAMPISTAS ────────────────────────────────────────────────────────────

const CM_CLASSIC: TacticalRole = {
  roleId: 'CM_CLASSIC',
  label: 'CM',
  basePosition: 'CM',
  family: 'midfielder',
  attackShape: ['MDC', 'MOC'],
  defenseShape: ['MDC'],
  allowedZones: ['MDE', 'MDC', 'MDD', 'MOE', 'MOC', 'MOD'],
  forbiddenZones: ['DE', 'DC', 'DD', 'OE', 'OC', 'OD'],
  behaviorProfile: { aggression: 55, discipline: 70, creativity: 55, support: 65, risk: 40 },
};

const CM_BOX2BOX: TacticalRole = {
  roleId: 'CM_BOX2BOX',
  label: 'CM',
  basePosition: 'CM',
  family: 'midfielder',
  attackShape: ['MOC', 'OC'],
  defenseShape: ['MDC', 'MDE', 'MDD'],
  allowedZones: ['MDE', 'MDC', 'MDD', 'MOE', 'MOC', 'MOD', 'OC'],
  forbiddenZones: ['DE', 'DC', 'DD', 'OE', 'OD'],
  behaviorProfile: { aggression: 75, discipline: 65, creativity: 55, support: 80, risk: 50 },
};

const CM_DLP: TacticalRole = {
  roleId: 'CM_DLP',
  label: 'CM',
  basePosition: 'CM',
  family: 'midfielder',
  attackShape: ['MDC', 'MOC'],
  defenseShape: ['MDC'],
  allowedZones: ['MDE', 'MDC', 'MDD', 'MOC'],
  forbiddenZones: ['DE', 'DC', 'DD', 'OE', 'OC', 'OD'],
  behaviorProfile: { aggression: 35, discipline: 72, creativity: 85, support: 80, risk: 25 },
};

const CM_MEZZALA: TacticalRole = {
  roleId: 'CM_MEZZALA',
  label: 'LCM',
  basePosition: 'LCM',
  family: 'midfielder',
  attackShape: ['MOE', 'MOC', 'OC'],
  defenseShape: ['MDC', 'MDE'],
  allowedZones: ['MDE', 'MDC', 'MOE', 'MOC', 'OE', 'OC'],
  forbiddenZones: ['DE', 'DC', 'DD', 'MDD', 'MOD', 'OD'],
  behaviorProfile: { aggression: 60, discipline: 60, creativity: 80, support: 70, risk: 65 },
};

const CM_CARRILERO: TacticalRole = {
  roleId: 'CM_CARRILERO',
  label: 'CM',
  basePosition: 'CM',
  family: 'midfielder',
  attackShape: ['MDC', 'MDE', 'MDD'],
  defenseShape: ['MDC', 'MDE', 'MDD'],
  allowedZones: ['MDE', 'MDC', 'MDD', 'MOE', 'MOC', 'MOD'],
  forbiddenZones: ['DE', 'DC', 'DD', 'OE', 'OC', 'OD'],
  behaviorProfile: { aggression: 60, discipline: 82, creativity: 40, support: 65, risk: 30 },
};

// ── MEIAS OFENSIVOS ───────────────────────────────────────────────────────────

const CAM_CLASSIC: TacticalRole = {
  roleId: 'CAM_CLASSIC',
  label: 'CAM',
  basePosition: 'CAM',
  family: 'attacking_mid',
  attackShape: ['MOC', 'OC'],
  defenseShape: ['MOC', 'MDC'],
  allowedZones: ['MDC', 'MOE', 'MOC', 'MOD', 'OC'],
  forbiddenZones: ['DE', 'DC', 'DD', 'OE', 'OD'],
  behaviorProfile: { aggression: 50, discipline: 60, creativity: 78, support: 75, risk: 55 },
};

const CAM_ENGANCHE: TacticalRole = {
  roleId: 'CAM_ENGANCHE',
  label: 'AM',
  basePosition: 'AM',
  family: 'attacking_mid',
  attackShape: ['MOC'],
  defenseShape: ['MOC'],
  allowedZones: ['MDC', 'MOC'],
  forbiddenZones: ['DE', 'DC', 'DD', 'MDE', 'MDD', 'MOE', 'MOD', 'OE', 'OC', 'OD'],
  behaviorProfile: { aggression: 30, discipline: 55, creativity: 95, support: 85, risk: 45 },
};

const CAM_SHADOW: TacticalRole = {
  roleId: 'CAM_SHADOW',
  label: 'CAM',
  basePosition: 'CAM',
  family: 'attacking_mid',
  attackShape: ['MOC', 'OC'],
  defenseShape: ['MOC'],
  allowedZones: ['MOE', 'MOC', 'MOD', 'OE', 'OC', 'OD'],
  forbiddenZones: ['DE', 'DC', 'DD', 'MDE', 'MDC', 'MDD'],
  behaviorProfile: { aggression: 80, discipline: 55, creativity: 65, support: 60, risk: 75 },
};

const CAM_ADVANCED: TacticalRole = {
  roleId: 'CAM_ADVANCED',
  label: 'CAM',
  basePosition: 'CAM',
  family: 'attacking_mid',
  attackShape: ['MOC', 'OC'],
  defenseShape: ['MOC', 'MDC'],
  allowedZones: ['MDC', 'MOE', 'MOC', 'MOD', 'OC'],
  forbiddenZones: ['DE', 'DC', 'DD', 'OE', 'OD'],
  behaviorProfile: { aggression: 55, discipline: 58, creativity: 88, support: 82, risk: 60 },
};

// ── PONTAS E EXTREMOS ─────────────────────────────────────────────────────────

const LW_CLASSIC: TacticalRole = {
  roleId: 'LW_CLASSIC',
  label: 'LW',
  basePosition: 'LW',
  family: 'winger',
  attackShape: ['MOE', 'OE'],
  defenseShape: ['MOE', 'MDE'],
  allowedZones: ['MDE', 'MOE', 'OE'],
  forbiddenZones: ['DE', 'DC', 'DD', 'MDC', 'MDD', 'OC', 'OD'],
  behaviorProfile: { aggression: 55, discipline: 55, creativity: 70, support: 60, risk: 72 },
};

const RW_CLASSIC: TacticalRole = {
  roleId: 'RW_CLASSIC',
  label: 'RW',
  basePosition: 'RW',
  family: 'winger',
  attackShape: ['MOD', 'OD'],
  defenseShape: ['MOD', 'MDD'],
  allowedZones: ['MDD', 'MOD', 'OD'],
  forbiddenZones: ['DE', 'DC', 'DD', 'MDC', 'MDE', 'OC', 'OE'],
  behaviorProfile: { aggression: 55, discipline: 55, creativity: 70, support: 60, risk: 72 },
};

const LM_WIDE: TacticalRole = {
  roleId: 'LM_WIDE',
  label: 'LM',
  basePosition: 'LM',
  family: 'winger',
  attackShape: ['MDE', 'MOE'],
  defenseShape: ['MDE'],
  allowedZones: ['MDE', 'MOE', 'OE'],
  forbiddenZones: ['DE', 'DC', 'DD', 'MDC', 'MDD', 'OC', 'OD'],
  behaviorProfile: { aggression: 55, discipline: 65, creativity: 60, support: 65, risk: 55 },
};

const RM_WIDE: TacticalRole = {
  roleId: 'RM_WIDE',
  label: 'RM',
  basePosition: 'RM',
  family: 'winger',
  attackShape: ['MDD', 'MOD'],
  defenseShape: ['MDD'],
  allowedZones: ['MDD', 'MOD', 'OD'],
  forbiddenZones: ['DE', 'DC', 'DD', 'MDC', 'MDE', 'OC', 'OE'],
  behaviorProfile: { aggression: 55, discipline: 65, creativity: 60, support: 65, risk: 55 },
};

const IF_LEFT: TacticalRole = {
  roleId: 'IF_LEFT',
  label: 'LW',
  basePosition: 'LW',
  family: 'winger',
  attackShape: ['MOC', 'OC', 'OE'],
  defenseShape: ['MOE', 'MDE'],
  allowedZones: ['MDE', 'MOE', 'MOC', 'OE', 'OC'],
  forbiddenZones: ['DE', 'DC', 'DD', 'MDC', 'MDD', 'MOD', 'OD'],
  behaviorProfile: { aggression: 60, discipline: 55, creativity: 80, support: 65, risk: 70 },
};

const IF_RIGHT: TacticalRole = {
  roleId: 'IF_RIGHT',
  label: 'RW',
  basePosition: 'RW',
  family: 'winger',
  attackShape: ['MOC', 'OC', 'OD'],
  defenseShape: ['MOD', 'MDD'],
  allowedZones: ['MDD', 'MOD', 'MOC', 'OD', 'OC'],
  forbiddenZones: ['DE', 'DC', 'DD', 'MDC', 'MDE', 'MOE', 'OE'],
  behaviorProfile: { aggression: 60, discipline: 55, creativity: 80, support: 65, risk: 70 },
};

const WINGER_LEFT: TacticalRole = {
  roleId: 'WINGER_LEFT',
  label: 'LW',
  basePosition: 'LW',
  family: 'winger',
  attackShape: ['MOE', 'OE'],
  defenseShape: ['MDE', 'MOE'],
  allowedZones: ['MDE', 'MOE', 'OE'],
  forbiddenZones: ['DE', 'DC', 'DD', 'MDC', 'MDD', 'MOC', 'MOD', 'OC', 'OD'],
  behaviorProfile: { aggression: 50, discipline: 60, creativity: 65, support: 55, risk: 68 },
};

const WINGER_RIGHT: TacticalRole = {
  roleId: 'WINGER_RIGHT',
  label: 'RW',
  basePosition: 'RW',
  family: 'winger',
  attackShape: ['MOD', 'OD'],
  defenseShape: ['MDD', 'MOD'],
  allowedZones: ['MDD', 'MOD', 'OD'],
  forbiddenZones: ['DE', 'DC', 'DD', 'MDC', 'MDE', 'MOC', 'MOE', 'OC', 'OE'],
  behaviorProfile: { aggression: 50, discipline: 60, creativity: 65, support: 55, risk: 68 },
};

const WPM_LEFT: TacticalRole = {
  roleId: 'WPM_LEFT',
  label: 'LM',
  basePosition: 'LM',
  family: 'winger',
  attackShape: ['MOE', 'MOC'],
  defenseShape: ['MDE'],
  allowedZones: ['MDE', 'MOE', 'MOC', 'OE'],
  forbiddenZones: ['DE', 'DC', 'DD', 'MDD', 'MOD', 'OC', 'OD'],
  behaviorProfile: { aggression: 40, discipline: 60, creativity: 85, support: 78, risk: 55 },
};

const WPM_RIGHT: TacticalRole = {
  roleId: 'WPM_RIGHT',
  label: 'RM',
  basePosition: 'RM',
  family: 'winger',
  attackShape: ['MOD', 'MOC'],
  defenseShape: ['MDD'],
  allowedZones: ['MDD', 'MOD', 'MOC', 'OD'],
  forbiddenZones: ['DE', 'DC', 'DD', 'MDE', 'MOE', 'OC', 'OE'],
  behaviorProfile: { aggression: 40, discipline: 60, creativity: 85, support: 78, risk: 55 },
};

const WM_LEFT: TacticalRole = {
  roleId: 'WM_LEFT',
  label: 'LM',
  basePosition: 'LM',
  family: 'winger',
  attackShape: ['MDE', 'MOE'],
  defenseShape: ['MDE'],
  allowedZones: ['MDE', 'MOE', 'OE'],
  forbiddenZones: ['DE', 'DC', 'DD', 'MDC', 'MDD', 'MOC', 'MOD', 'OC', 'OD'],
  behaviorProfile: { aggression: 52, discipline: 68, creativity: 58, support: 62, risk: 48 },
};

const WM_RIGHT: TacticalRole = {
  roleId: 'WM_RIGHT',
  label: 'RM',
  basePosition: 'RM',
  family: 'winger',
  attackShape: ['MDD', 'MOD'],
  defenseShape: ['MDD'],
  allowedZones: ['MDD', 'MOD', 'OD'],
  forbiddenZones: ['DE', 'DC', 'DD', 'MDC', 'MDE', 'MOC', 'MOE', 'OC', 'OE'],
  behaviorProfile: { aggression: 52, discipline: 68, creativity: 58, support: 62, risk: 48 },
};

// ── ATACANTES ─────────────────────────────────────────────────────────────────

const ST_CLASSIC: TacticalRole = {
  roleId: 'ST_CLASSIC',
  label: 'ST',
  basePosition: 'ST',
  family: 'forward',
  attackShape: ['OC'],
  defenseShape: ['MOC', 'OC'],
  allowedZones: ['MOE', 'MOC', 'MOD', 'OE', 'OC', 'OD'],
  forbiddenZones: ['DE', 'DC', 'DD', 'MDE', 'MDC', 'MDD'],
  behaviorProfile: { aggression: 78, discipline: 55, creativity: 55, support: 50, risk: 70 },
};

const CF_MOBILE: TacticalRole = {
  roleId: 'CF_MOBILE',
  label: 'CF',
  basePosition: 'CF',
  family: 'forward',
  attackShape: ['MOC', 'OC'],
  defenseShape: ['MOC'],
  allowedZones: ['MOE', 'MOC', 'MOD', 'OE', 'OC', 'OD'],
  forbiddenZones: ['DE', 'DC', 'DD', 'MDE', 'MDC', 'MDD'],
  behaviorProfile: { aggression: 65, discipline: 58, creativity: 75, support: 72, risk: 60 },
};

const SS_SECOND: TacticalRole = {
  roleId: 'SS_SECOND',
  label: 'SS',
  basePosition: 'SS',
  family: 'forward',
  attackShape: ['MOC', 'OC'],
  defenseShape: ['MOC'],
  allowedZones: ['MDC', 'MOE', 'MOC', 'MOD', 'OC'],
  forbiddenZones: ['DE', 'DC', 'DD', 'MDE', 'MDD', 'OE', 'OD'],
  behaviorProfile: { aggression: 60, discipline: 58, creativity: 80, support: 78, risk: 58 },
};

const FW_POACHER: TacticalRole = {
  roleId: 'FW_POACHER',
  label: 'ST',
  basePosition: 'ST',
  family: 'forward',
  attackShape: ['OC'],
  defenseShape: ['OC'],
  allowedZones: ['MOC', 'OE', 'OC', 'OD'],
  forbiddenZones: ['DE', 'DC', 'DD', 'MDE', 'MDC', 'MDD', 'MOE', 'MOD'],
  behaviorProfile: { aggression: 90, discipline: 50, creativity: 20, support: 30, risk: 65 },
};

const FW_TARGET: TacticalRole = {
  roleId: 'FW_TARGET',
  label: 'ST',
  basePosition: 'ST',
  family: 'forward',
  attackShape: ['OC'],
  defenseShape: ['MOC', 'OC'],
  allowedZones: ['MOC', 'OE', 'OC', 'OD'],
  forbiddenZones: ['DE', 'DC', 'DD', 'MDE', 'MDC', 'MDD'],
  behaviorProfile: { aggression: 82, discipline: 60, creativity: 22, support: 45, risk: 30 },
};

const FW_FALSE9: TacticalRole = {
  roleId: 'FW_FALSE9',
  label: 'CF',
  basePosition: 'CF',
  family: 'forward',
  attackShape: ['MOC', 'MDC'],
  defenseShape: ['MOC'],
  allowedZones: ['MDC', 'MOE', 'MOC', 'MOD', 'OC'],
  forbiddenZones: ['DE', 'DC', 'DD', 'MDE', 'MDD', 'OE', 'OD'],
  behaviorProfile: { aggression: 45, discipline: 60, creativity: 92, support: 90, risk: 55 },
};

const FW_PRESSING: TacticalRole = {
  roleId: 'FW_PRESSING',
  label: 'ST',
  basePosition: 'ST',
  family: 'forward',
  attackShape: ['MOC', 'OC'],
  defenseShape: ['MOC', 'MOE', 'MOD'],
  allowedZones: ['MOE', 'MOC', 'MOD', 'OE', 'OC', 'OD'],
  forbiddenZones: ['DE', 'DC', 'DD', 'MDE', 'MDC', 'MDD'],
  behaviorProfile: { aggression: 95, discipline: 80, creativity: 40, support: 55, risk: 50 },
};

const FW_COMPLETE: TacticalRole = {
  roleId: 'FW_COMPLETE',
  label: 'ST',
  basePosition: 'ST',
  family: 'forward',
  attackShape: ['MOC', 'OC'],
  defenseShape: ['MOC'],
  allowedZones: ['MOE', 'MOC', 'MOD', 'OE', 'OC', 'OD'],
  forbiddenZones: ['DE', 'DC', 'DD', 'MDE', 'MDC', 'MDD'],
  behaviorProfile: { aggression: 78, discipline: 70, creativity: 75, support: 72, risk: 65 },
};

// ── EXPORTS ───────────────────────────────────────────────────────────────────

export const TACTICAL_ROLES: TacticalRole[] = [
  // Goleiros
  GK_CLASSIC, GK_SWEEPER,
  // Zagueiros
  CB_STOPPER, CB_LEFT, CB_RIGHT, CB_SWEEPER, CB_BUILDER,
  // Laterais
  LB_CLASSIC, RB_CLASSIC,
  LWB_ATTACK, RWB_ATTACK,
  IWB_LEFT, IWB_RIGHT,
  FB_CONSERVATIVE, WB_AGGRESSIVE,
  // Volantes
  CDM_ANCHOR, CDM_DESTROYER, CDM_REGISTA, CDM_HALFBACK,
  // Meio-campistas
  CM_CLASSIC, CM_BOX2BOX, CM_DLP, CM_MEZZALA, CM_CARRILERO,
  // Meias ofensivos
  CAM_CLASSIC, CAM_ENGANCHE, CAM_SHADOW, CAM_ADVANCED,
  // Pontas
  LW_CLASSIC, RW_CLASSIC,
  LM_WIDE, RM_WIDE,
  IF_LEFT, IF_RIGHT,
  WINGER_LEFT, WINGER_RIGHT,
  WPM_LEFT, WPM_RIGHT,
  WM_LEFT, WM_RIGHT,
  // Atacantes
  ST_CLASSIC, CF_MOBILE, SS_SECOND,
  FW_POACHER, FW_TARGET, FW_FALSE9,
  FW_PRESSING, FW_COMPLETE,
];

export const TACTICAL_ROLE_BY_ID: Record<TacticalRoleId, TacticalRole> = Object.fromEntries(
  TACTICAL_ROLES.map((r) => [r.roleId, r])
) as Record<TacticalRoleId, TacticalRole>;
