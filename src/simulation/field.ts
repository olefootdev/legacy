/**
 * @/simulation/field — COMPATIBILIDADE
 *
 * Este arquivo re-exporta de @/tactical, que é a FONTE ÚNICA DE VERDADE.
 * Não adicione lógica aqui. Importe de @/tactical diretamente em código novo.
 *
 * Mantido para compatibilidade com os ~90 arquivos que importam daqui.
 */
export {
  FIELD_LENGTH,
  FIELD_WIDTH,
  CENTER_CIRCLE_RADIUS_M,
  GOAL_INNER_WIDTH_M,
  GOAL_INNER_WIDTH_IFAB_M,
  GOAL_CROSSBAR_HEIGHT_M,
  GOAL_MOUTH_HALF_WIDTH_M,
  clampToPitch,
  uiPercentToWorld,
  worldToUiPercent,
  computeAttackPhase,
} from '@/tactical';
