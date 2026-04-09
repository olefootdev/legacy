import type { FieldSchemaVersion } from './constants';

/** ID estável no catálogo da fieldSchemaVersion (não usar coordenadas soltas sem id). */
export type FieldZoneId = string;

/**
 * Polígono no plano do campo, normalizado 0–1:
 * nx = ao longo do eixo de comprimento (0 = linha de fundo “casa” defensiva, 1 = ataque casa)
 * nz = largura (0 = um lado, 1 = outro)
 */
export type NormalizedPoint2 = { nx: number; nz: number };

export interface FieldZone {
  id: FieldZoneId;
  label?: string;
  /** Terço / corredor / finalização — livre para UI e regras */
  tags?: string[];
  polygon: NormalizedPoint2[];
}

export interface FieldZoneCatalog {
  fieldSchemaVersion: FieldSchemaVersion;
  zones: FieldZone[];
}
