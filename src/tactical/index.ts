/**
 * /src/tactical/index.ts
 *
 * Re-exports públicos da camada tática — FONTE ÚNICA DE VERDADE.
 * Importe sempre de '@/tactical' — nunca dos arquivos internos diretamente.
 *
 * Consumidores:
 *   @/simulation/field   → re-exporta daqui (compatibilidade com 90 arquivos)
 *   Field Lab            → visualização e teste
 *   Legacy Mode          → renderização cinematográfica
 *   Motor real           → decisão tática, movimento, IA
 */

export {
  // Dimensões IFAB
  FIELD_WIDTH_M,
  FIELD_LENGTH_M,
  FIELD_LENGTH,
  FIELD_WIDTH,
  // Gol
  GOAL_INNER_WIDTH_M,
  GOAL_INNER_WIDTH_IFAB_M,
  GOAL_CROSSBAR_HEIGHT_M,
  GOAL_MOUTH_HALF_WIDTH_M,
  // Marcações em metros
  CENTER_CIRCLE_RADIUS_M,
  PENALTY_SPOT_M,
  PENALTY_AREA_DEPTH_M,
  PENALTY_AREA_HALF_W_M,
  GOAL_AREA_DEPTH_M,
  GOAL_AREA_HALF_W_M,
  GOAL_WIDTH_M,
  GOAL_HALF_W_M,
  // Marcações normalizadas (0–100)
  N_PENALTY_SPOT_HOME,
  N_PENALTY_SPOT_AWAY,
  N_BOX_DEPTH,
  N_SIX_DEPTH,
  N_MIDFIELD,
  N_BOX_HALF_W,
  N_SIX_HALF_W,
  N_GOAL_HALF_W,
  // Bounds normalizados das áreas
  BOX_HOME,
  BOX_AWAY,
  SIX_HOME,
  SIX_AWAY,
  GOAL_HOME,
  GOAL_AWAY,
  // Conversões
  normalizedToMeters,
  metersToNormalized,
  worldToNormalized,
  normalizedToWorld,
  uiPercentToWorld,
  worldToUiPercent,
  clampToPitch,
  computeAttackPhase,
  // Predicados
  isInsideBox,
  isInFinalThird,
  // SVG First View
  FV_SVG_W,
  FV_SVG_H,
  FV_CX,
  FV_TOP_Y,
  FV_BOTTOM_Y,
  FV_TOP_HALF_W,
  FV_BOTTOM_HALF_W,
  FIELD_POLYGON,
  lerp,
  normalizedToFirstViewSvg,
  zoneBoundsToPolygonPoints,
  // Tipos
  type NormalizedPos,
  type MetersPos,
  type WorldPos,
} from './fieldGeometry';

export {
  FIELD_ZONES,
  FIELD_ZONE_BY_ID,
  ZONE_SECTOR_COLOR,
  getZoneFromNormalizedPosition,
  getZoneCenterNormalized,
  isNormalizedPositionInsideZone,
  getZoneFromMetersPosition,
  getZoneCenterMeters,
  isMetersPositionInsideZone,
  getZonesBySector,
  getZonesByCorridor,
  type FieldZoneId,
  type FieldZoneSector,
  type FieldZoneCorridor,
  type ZoneBoundsNormalized,
  type ZoneBoundsMeters,
  type FieldZone,
} from './zones12';
