/**
 * Camada de **awareness espacial** que conecta o SmartField (Python-generated
 * snapshot) ao motor de decisão (GameSpirit + PlayerDecisionEngine).
 *
 * O SmartField tem 36 zonas (15 macro + 21 sub) com semântica real do futebol:
 * pequena área, grande área, zona criativa, lateral esquerda, etc.
 * Este módulo expõe essas zonas em coordenadas UI (0–100) que o Spirit usa,
 * e helpers semânticos que `pickAction` + Skills consomem em `when` clauses.
 */

import { uiPercentToWorld, FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';
import { sfGetZone, sfGetSubzone } from '@/smartfield/smartfieldBridge';

export interface ZoneInfo {
  /** Zona macro (15 ids: 'attacking_center', 'middle_left_wing', ...). */
  macro: string | null;
  /** Sub-zona granular (21 ids: 'box_center', 'six_yard_left', 'creation_*', ...). */
  subzone: string | null;
  /** Coords originais (UI 0–100), conveniência. */
  ux: number;
  uy: number;
}

/**
 * Resolve zona da posição UI. Para o lado 'away' espelha o eixo X (away ataca
 * na direção oposta — simétrico).
 */
export function zoneAtUI(ux: number, uy: number, side: 'home' | 'away' = 'home'): ZoneInfo {
  const wx = side === 'home' ? ux : 100 - ux;
  const w = uiPercentToWorld(wx, uy);
  return {
    macro: sfGetZone(w.x, w.z),
    subzone: sfGetSubzone(w.x, w.z),
    ux,
    uy,
  };
}

// ── Predicados semânticos ─────────────────────────────────────────

export function isBox(z: ZoneInfo): boolean {
  return z.subzone?.startsWith('box_') ?? false;
}
export function isSixYard(z: ZoneInfo): boolean {
  return z.subzone?.startsWith('six_yard_') ?? false;
}
export function isGoalmouth(z: ZoneInfo): boolean {
  return z.subzone?.startsWith('goalmouth_') ?? false;
}
export function isCreationZone(z: ZoneInfo): boolean {
  return z.subzone?.startsWith('creation_') ?? false;
}
export function isPressZone(z: ZoneInfo): boolean {
  return z.subzone?.startsWith('press_') ?? false;
}
export function isBuildUpZone(z: ZoneInfo): boolean {
  return z.subzone?.startsWith('build_up_') ?? false;
}
export function isRecoveryZone(z: ZoneInfo): boolean {
  return z.subzone?.startsWith('recovery_') ?? false;
}

export function isFinalThird(z: ZoneInfo): boolean {
  return z.macro?.startsWith('attacking_') ?? false;
}
export function isMidThird(z: ZoneInfo): boolean {
  return z.macro?.startsWith('middle_') ?? false;
}
export function isDefThird(z: ZoneInfo): boolean {
  return z.macro?.startsWith('defensive_') ?? false;
}

export function isWing(z: ZoneInfo): boolean {
  return z.macro?.endsWith('_wing') ?? false;
}
export function isHalfspace(z: ZoneInfo): boolean {
  return z.macro?.endsWith('_halfspace') ?? false;
}
export function isCentralLane(z: ZoneInfo): boolean {
  return z.macro?.endsWith('_center') ?? false;
}

// ── Lateral ───────────────────────────────────────────────────────

export type Lane = 'left' | 'center' | 'right';

export function laneOf(z: ZoneInfo): Lane | null {
  const id = z.subzone ?? z.macro;
  if (!id) return null;
  if (/_(left|left_wing|left_halfspace)$/.test(id)) return 'left';
  if (/_(right|right_wing|right_halfspace)$/.test(id)) return 'right';
  if (/_center$/.test(id)) return 'center';
  return null;
}

// ── Distâncias úteis ──────────────────────────────────────────────

/**
 * Distância ao gol adversário em **metros** (não UI), pra cálculos de xG/skills.
 * Side='home' → gol é em x=105; 'away' → gol é em x=0.
 */
export function distToOppGoalMeters(ux: number, uy: number, side: 'home' | 'away' = 'home'): number {
  const w = uiPercentToWorld(ux, uy);
  const goalX = side === 'home' ? FIELD_LENGTH : 0;
  const goalY = FIELD_WIDTH / 2;
  return Math.hypot(w.x - goalX, w.z - goalY);
}

/**
 * "Perigo de gol": 0..1, 1 = bola colada ao gol adversário.
 * Usado pra modular probabilidade de pênalti, intensidade de pressing, etc.
 */
export function dangerToOppGoal01(ux: number, uy: number, side: 'home' | 'away' = 'home'): number {
  const d = distToOppGoalMeters(ux, uy, side);
  // 0m = 1.0, 30m = ~0.0
  return Math.max(0, Math.min(1, 1 - d / 30));
}
