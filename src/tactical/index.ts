/**
 * /src/tactical/index.ts
 *
 * Re-exports públicos da camada tática neutra.
 * Importe sempre de '@/tactical' — nunca dos arquivos internos diretamente.
 *
 * Consumidores:
 *   Field Lab  → visualização e teste
 *   Legacy Mode → renderização final
 *   Motor real → decisão tática, movimento, IA
 */

// Geometria e projeção SVG
export {
  // Constantes IFAB
  FIELD_WIDTH_M,
  FIELD_LENGTH_M,
  // Constantes SVG First View
  FV_SVG_W,
  FV_SVG_H,
  FV_CX,
  FV_TOP_Y,
  FV_BOTTOM_Y,
  FV_TOP_HALF_W,
  FV_BOTTOM_HALF_W,
  FIELD_POLYGON,
  // Funções
  lerp,
  normalizedToMeters,
  metersToNormalized,
  normalizedToFirstViewSvg,
  zoneBoundsToPolygonPoints,
  // Tipos
  type NormalizedPos,
  type MetersPos,
} from './fieldGeometry';

// Zonas táticas
export {
  // Dados
  FIELD_ZONES,
  FIELD_ZONE_BY_ID,
  ZONE_SECTOR_COLOR,
  // Consulta normalizada
  getZoneFromNormalizedPosition,
  getZoneCenterNormalized,
  isNormalizedPositionInsideZone,
  // Consulta metros
  getZoneFromMetersPosition,
  getZoneCenterMeters,
  isMetersPositionInsideZone,
  // Filtros
  getZonesBySector,
  getZonesByCorridor,
  // Tipos
  type FieldZoneId,
  type FieldZoneSector,
  type FieldZoneCorridor,
  type ZoneBoundsNormalized,
  type ZoneBoundsMeters,
  type FieldZone,
} from './zones12';
