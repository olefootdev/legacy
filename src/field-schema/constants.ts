/**
 * Versão única do sistema de coordenadas + catálogo de zonas.
 * Admin, CDN e cliente de partida devem concordar neste identificador.
 */
export const FIELD_SCHEMA_VERSION = 'olefoot-field-v1' as const;

export type FieldSchemaVersion = typeof FIELD_SCHEMA_VERSION;
