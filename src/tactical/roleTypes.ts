/**
 * /src/tactical/roleTypes.ts
 *
 * Tipos base do sistema de roles táticas do Olefoot.
 * Cada jogador tem uma role que define zona + função + comportamento.
 * NÃO importa nada de UI, páginas ou componentes.
 */

import type { FieldZoneId } from './zones12';

// ── Famílias táticas ──────────────────────────────────────────────────────────
export type RoleFamily =
  | 'goalkeeper'
  | 'defender'
  | 'fullback'
  | 'midfielder'
  | 'attacking_mid'
  | 'winger'
  | 'forward';

// ── Posições base (slot canônico) ─────────────────────────────────────────────
export type BasePosition =
  | 'GK'
  | 'CB' | 'SW' | 'BPD'
  | 'LB' | 'RB' | 'LWB' | 'RWB' | 'IWB' | 'FB' | 'WB'
  | 'CDM' | 'DM'
  | 'CM' | 'LCM' | 'RCM'
  | 'CAM' | 'AM'
  | 'LW' | 'RW' | 'LM' | 'RM'
  | 'ST' | 'CF' | 'SS';

// ── IDs de todas as roles ─────────────────────────────────────────────────────
export type TacticalRoleId =
  // Goleiros
  | 'GK_CLASSIC' | 'GK_SWEEPER'
  // Zagueiros
  | 'CB_STOPPER' | 'CB_LEFT' | 'CB_RIGHT' | 'CB_SWEEPER' | 'CB_BUILDER'
  // Laterais e alas
  | 'LB_CLASSIC' | 'RB_CLASSIC'
  | 'LWB_ATTACK' | 'RWB_ATTACK'
  | 'IWB_LEFT' | 'IWB_RIGHT'
  | 'FB_CONSERVATIVE' | 'WB_AGGRESSIVE'
  // Volantes
  | 'CDM_ANCHOR' | 'CDM_DESTROYER' | 'CDM_REGISTA' | 'CDM_HALFBACK'
  // Meio-campistas
  | 'CM_CLASSIC' | 'CM_BOX2BOX' | 'CM_DLP' | 'CM_MEZZALA' | 'CM_CARRILERO'
  // Meias ofensivos
  | 'CAM_CLASSIC' | 'CAM_ENGANCHE' | 'CAM_SHADOW' | 'CAM_ADVANCED'
  // Pontas e extremos
  | 'LW_CLASSIC' | 'RW_CLASSIC'
  | 'LM_WIDE' | 'RM_WIDE'
  | 'IF_LEFT' | 'IF_RIGHT'
  | 'WINGER_LEFT' | 'WINGER_RIGHT'
  | 'WPM_LEFT' | 'WPM_RIGHT'
  | 'WM_LEFT' | 'WM_RIGHT'
  // Atacantes
  | 'ST_CLASSIC' | 'CF_MOBILE' | 'SS_SECOND'
  | 'FW_POACHER' | 'FW_TARGET' | 'FW_FALSE9'
  | 'FW_PRESSING' | 'FW_COMPLETE';

// ── Perfil de comportamento ───────────────────────────────────────────────────
export interface BehaviorProfile {
  /** Intensidade de pressão e duelos (0–100) */
  aggression: number;
  /** Respeito ao posicionamento tático (0–100) */
  discipline: number;
  /** Tendência a improvisar e criar (0–100) */
  creativity: number;
  /** Frequência de apoio ao portador (0–100) */
  support: number;
  /** Tolerância a passes/dribles arriscados (0–100) */
  risk: number;
}

// ── Role tática completa ──────────────────────────────────────────────────────
export interface TacticalRole {
  roleId: TacticalRoleId;
  /** Nome legível para UI */
  label: string;
  /** Posição base canônica */
  basePosition: BasePosition;
  /** Família tática */
  family: RoleFamily;
  /** Zonas ocupadas em fase ofensiva */
  attackShape: FieldZoneId[];
  /** Zonas ocupadas em fase defensiva */
  defenseShape: FieldZoneId[];
  /** Zonas onde pode atuar */
  allowedZones: FieldZoneId[];
  /** Zonas proibidas */
  forbiddenZones: FieldZoneId[];
  /** Perfil de comportamento base */
  behaviorProfile: BehaviorProfile;
}
