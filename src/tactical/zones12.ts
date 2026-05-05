/**
 * /src/tactical/zones12.ts
 *
 * 12 zonas táticas canônicas do Olefoot — camada neutra reutilizável.
 * Consumida pelo Field Lab, pelo Legacy Mode e pelo motor real.
 * NÃO importa nada de UI, páginas ou componentes.
 *
 * Sistema de coordenadas normalizadas (0–100):
 *   x: 0=esquerda → 100=direita  (largura)
 *   y: 0=home/baixo → 100=away/cima  (profundidade)
 *
 * Setores por profundidade (eixo Y):
 *   D  = Defensivo       y 0–25
 *   MD = Médio Defensivo y 25–50
 *   MO = Médio Ofensivo  y 50–75
 *   O  = Ofensivo        y 75–100
 *
 * Corredores por largura (eixo X):
 *   E = Esquerdo  x 0–33.33
 *   C = Central   x 33.33–66.66
 *   D = Direito   x 66.66–100
 */

import {
  normalizedToMeters,
  metersToNormalized,
  type NormalizedPos,
  type MetersPos,
} from './fieldGeometry';

// ── Tipos ─────────────────────────────────────────────────────────────────────
export type FieldZoneId =
  | 'DE'  | 'DC'  | 'DD'
  | 'MDE' | 'MDC' | 'MDD'
  | 'MOE' | 'MOC' | 'MOD'
  | 'OE'  | 'OC'  | 'OD';

export type FieldZoneSector   = 'D' | 'MD' | 'MO' | 'O';
export type FieldZoneCorridor = 'E' | 'C' | 'D';

export interface ZoneBoundsNormalized {
  xMin: number; xMax: number;
  yMin: number; yMax: number;
}

export interface ZoneBoundsMeters {
  xMinM: number; xMaxM: number; // largura em metros (0–68m)
  yMinM: number; yMaxM: number; // profundidade em metros (0–105m)
}

export interface FieldZone {
  id: FieldZoneId;
  label: string;
  sector: FieldZoneSector;
  corridor: FieldZoneCorridor;
  boundsNormalized: ZoneBoundsNormalized;
  boundsMeters: ZoneBoundsMeters;
}

// ── Cores canônicas por setor ─────────────────────────────────────────────────
export const ZONE_SECTOR_COLOR: Record<FieldZoneSector, string> = {
  D:  '#3b82f6', // azul
  MD: '#8b5cf6', // roxo
  MO: '#f59e0b', // âmbar
  O:  '#22c55e', // verde
};

// ── Definição das 12 zonas ────────────────────────────────────────────────────
function makeZone(
  id: FieldZoneId,
  label: string,
  sector: FieldZoneSector,
  corridor: FieldZoneCorridor,
  xMin: number, xMax: number,
  yMin: number, yMax: number,
): FieldZone {
  const bl = normalizedToMeters({ x: xMin, y: yMin });
  const tr = normalizedToMeters({ x: xMax, y: yMax });
  return {
    id, label, sector, corridor,
    boundsNormalized: { xMin, xMax, yMin, yMax },
    boundsMeters: {
      xMinM: bl.xMeters, xMaxM: tr.xMeters,
      yMinM: bl.yMeters, yMaxM: tr.yMeters,
    },
  };
}

export const FIELD_ZONES: FieldZone[] = [
  makeZone('DE',  'Defensivo Esquerdo',         'D',  'E', 0,     33.33, 0,  25),
  makeZone('DC',  'Defensivo Central',           'D',  'C', 33.33, 66.66, 0,  25),
  makeZone('DD',  'Defensivo Direito',           'D',  'D', 66.66, 100,   0,  25),
  makeZone('MDE', 'Médio Defensivo Esquerdo',    'MD', 'E', 0,     33.33, 25, 50),
  makeZone('MDC', 'Médio Defensivo Central',     'MD', 'C', 33.33, 66.66, 25, 50),
  makeZone('MDD', 'Médio Defensivo Direito',     'MD', 'D', 66.66, 100,   25, 50),
  makeZone('MOE', 'Médio Ofensivo Esquerdo',     'MO', 'E', 0,     33.33, 50, 75),
  makeZone('MOC', 'Médio Ofensivo Central',      'MO', 'C', 33.33, 66.66, 50, 75),
  makeZone('MOD', 'Médio Ofensivo Direito',      'MO', 'D', 66.66, 100,   50, 75),
  makeZone('OE',  'Ofensivo Esquerdo',           'O',  'E', 0,     33.33, 75, 100),
  makeZone('OC',  'Ofensivo Central',            'O',  'C', 33.33, 66.66, 75, 100),
  makeZone('OD',  'Ofensivo Direito',            'O',  'D', 66.66, 100,   75, 100),
];

// ── Lookup rápido ─────────────────────────────────────────────────────────────
export const FIELD_ZONE_BY_ID: Record<FieldZoneId, FieldZone> =
  Object.fromEntries(FIELD_ZONES.map((z) => [z.id, z])) as Record<FieldZoneId, FieldZone>;

// ── Funções de consulta — coordenadas normalizadas ────────────────────────────

/** Retorna a zona que contém o ponto normalizado (x, y). */
export function getZoneFromNormalizedPosition(pos: NormalizedPos): FieldZone | undefined {
  return FIELD_ZONES.find((z) => {
    const b = z.boundsNormalized;
    return pos.x >= b.xMin && pos.x < b.xMax && pos.y >= b.yMin && pos.y < b.yMax;
  });
}

/** Centro geométrico de uma zona em coordenadas normalizadas. */
export function getZoneCenterNormalized(id: FieldZoneId): NormalizedPos {
  const b = FIELD_ZONE_BY_ID[id].boundsNormalized;
  return { x: (b.xMin + b.xMax) / 2, y: (b.yMin + b.yMax) / 2 };
}

/** Verifica se uma posição normalizada está dentro de uma zona. */
export function isNormalizedPositionInsideZone(pos: NormalizedPos, id: FieldZoneId): boolean {
  const b = FIELD_ZONE_BY_ID[id].boundsNormalized;
  return pos.x >= b.xMin && pos.x < b.xMax && pos.y >= b.yMin && pos.y < b.yMax;
}

// ── Funções de consulta — metros ──────────────────────────────────────────────

/** Retorna a zona que contém o ponto em metros. */
export function getZoneFromMetersPosition(pos: MetersPos): FieldZone | undefined {
  return FIELD_ZONES.find((z) => {
    const b = z.boundsMeters;
    return pos.xMeters >= b.xMinM && pos.xMeters < b.xMaxM &&
           pos.yMeters >= b.yMinM && pos.yMeters < b.yMaxM;
  });
}

/** Centro geométrico de uma zona em metros. */
export function getZoneCenterMeters(id: FieldZoneId): MetersPos {
  const b = FIELD_ZONE_BY_ID[id].boundsMeters;
  return { xMeters: (b.xMinM + b.xMaxM) / 2, yMeters: (b.yMinM + b.yMaxM) / 2 };
}

/** Verifica se uma posição em metros está dentro de uma zona. */
export function isMetersPositionInsideZone(pos: MetersPos, id: FieldZoneId): boolean {
  const b = FIELD_ZONE_BY_ID[id].boundsMeters;
  return pos.xMeters >= b.xMinM && pos.xMeters < b.xMaxM &&
         pos.yMeters >= b.yMinM && pos.yMeters < b.yMaxM;
}

// ── Filtros utilitários ───────────────────────────────────────────────────────

/** Todas as zonas de um setor. */
export function getZonesBySector(sector: FieldZoneSector): FieldZone[] {
  return FIELD_ZONES.filter((z) => z.sector === sector);
}

/** Todas as zonas de um corredor. */
export function getZonesByCorridor(corridor: FieldZoneCorridor): FieldZone[] {
  return FIELD_ZONES.filter((z) => z.corridor === corridor);
}
