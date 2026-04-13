/**
 * Perfil de movimento sem bola — mapeia ações existentes para níveis conceituais
 * (parado/apoio/aproximação/infiltração/ruptura/critical) sem alterar o tipo `OffBallAction`.
 */
import type { OffBallAction } from './types';

export type OffBallMovementProfile =
  | 'static_support'
  | 'support'
  | 'approach'
  | 'infiltration'
  | 'line_break'
  | 'critical_hit';

const MAP: Record<OffBallAction['type'], OffBallMovementProfile> = {
  move_to_slot: 'static_support',
  idle: 'static_support',
  offer_short_line: 'support',
  offer_diagonal_line: 'support',
  open_width: 'support',
  drop_to_create_space: 'support',
  drag_marker: 'approach',
  delay_press: 'approach',
  close_passing_lane: 'approach',
  mark_zone: 'approach',
  mark_man: 'approach',
  cover_central: 'approach',
  recover_behind_ball: 'approach',
  defensive_cover: 'approach',
  anticipate_second_ball: 'approach',
  prepare_rebound: 'approach',
  press_carrier: 'approach',
  attack_depth: 'line_break',
  overlap_run: 'line_break',
  infiltrate: 'infiltration',
};

/** Perfil táctico do movimento sem bola (para telemetria / narração futura). */
export function offBallMovementProfile(action: OffBallAction): OffBallMovementProfile {
  return MAP[action.type] ?? 'support';
}
