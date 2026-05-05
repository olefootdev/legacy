/**
 * FIELD_ZONES — 12 zonas táticas canônicas do Olefoot.
 *
 * Sistema de coordenadas normalizado (0–100):
 *   x: largura do campo  — 0 = esquerda, 100 = direita
 *   y: profundidade      — 0 = gol Home (baixo), 100 = gol Away (cima)
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

export type FieldZoneId =
  | 'DE'  | 'DC'  | 'DD'
  | 'MDE' | 'MDC' | 'MDD'
  | 'MOE' | 'MOC' | 'MOD'
  | 'OE'  | 'OC'  | 'OD';

export type FieldZoneSector = 'D' | 'MD' | 'MO' | 'O';
export type FieldZoneCorridor = 'E' | 'C' | 'D';

export interface FieldZoneBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface FieldZone {
  id: FieldZoneId;
  label: string;
  sector: FieldZoneSector;
  corridor: FieldZoneCorridor;
  bounds: FieldZoneBounds;
}

export const FIELD_ZONES: FieldZone[] = [
  {
    id: 'DE',
    label: 'Defensivo Esquerdo',
    sector: 'D',
    corridor: 'E',
    bounds: { xMin: 0, xMax: 33.33, yMin: 0, yMax: 25 },
  },
  {
    id: 'DC',
    label: 'Defensivo Central',
    sector: 'D',
    corridor: 'C',
    bounds: { xMin: 33.33, xMax: 66.66, yMin: 0, yMax: 25 },
  },
  {
    id: 'DD',
    label: 'Defensivo Direito',
    sector: 'D',
    corridor: 'D',
    bounds: { xMin: 66.66, xMax: 100, yMin: 0, yMax: 25 },
  },
  {
    id: 'MDE',
    label: 'Médio Defensivo Esquerdo',
    sector: 'MD',
    corridor: 'E',
    bounds: { xMin: 0, xMax: 33.33, yMin: 25, yMax: 50 },
  },
  {
    id: 'MDC',
    label: 'Médio Defensivo Central',
    sector: 'MD',
    corridor: 'C',
    bounds: { xMin: 33.33, xMax: 66.66, yMin: 25, yMax: 50 },
  },
  {
    id: 'MDD',
    label: 'Médio Defensivo Direito',
    sector: 'MD',
    corridor: 'D',
    bounds: { xMin: 66.66, xMax: 100, yMin: 25, yMax: 50 },
  },
  {
    id: 'MOE',
    label: 'Médio Ofensivo Esquerdo',
    sector: 'MO',
    corridor: 'E',
    bounds: { xMin: 0, xMax: 33.33, yMin: 50, yMax: 75 },
  },
  {
    id: 'MOC',
    label: 'Médio Ofensivo Central',
    sector: 'MO',
    corridor: 'C',
    bounds: { xMin: 33.33, xMax: 66.66, yMin: 50, yMax: 75 },
  },
  {
    id: 'MOD',
    label: 'Médio Ofensivo Direito',
    sector: 'MO',
    corridor: 'D',
    bounds: { xMin: 66.66, xMax: 100, yMin: 50, yMax: 75 },
  },
  {
    id: 'OE',
    label: 'Ofensivo Esquerdo',
    sector: 'O',
    corridor: 'E',
    bounds: { xMin: 0, xMax: 33.33, yMin: 75, yMax: 100 },
  },
  {
    id: 'OC',
    label: 'Ofensivo Central',
    sector: 'O',
    corridor: 'C',
    bounds: { xMin: 33.33, xMax: 66.66, yMin: 75, yMax: 100 },
  },
  {
    id: 'OD',
    label: 'Ofensivo Direito',
    sector: 'O',
    corridor: 'D',
    bounds: { xMin: 66.66, xMax: 100, yMin: 75, yMax: 100 },
  },
];

/** Lookup rápido por ID. */
export const FIELD_ZONE_BY_ID: Record<FieldZoneId, FieldZone> = Object.fromEntries(
  FIELD_ZONES.map((z) => [z.id, z]),
) as Record<FieldZoneId, FieldZone>;

/** Retorna a zona que contém o ponto (x, y) em coordenadas 0–100. */
export function getZoneAtPoint(x: number, y: number): FieldZone | undefined {
  return FIELD_ZONES.find(
    (z) =>
      x >= z.bounds.xMin && x <= z.bounds.xMax &&
      y >= z.bounds.yMin && y <= z.bounds.yMax,
  );
}

/** Todas as zonas de um setor. */
export function getZonesBySector(sector: FieldZoneSector): FieldZone[] {
  return FIELD_ZONES.filter((z) => z.sector === sector);
}

/** Todas as zonas de um corredor. */
export function getZonesByCorridor(corridor: FieldZoneCorridor): FieldZone[] {
  return FIELD_ZONES.filter((z) => z.corridor === corridor);
}

/** Cor canônica por setor (para visualização). */
export const ZONE_SECTOR_COLOR: Record<FieldZoneSector, string> = {
  D:  '#3b82f6', // azul
  MD: '#8b5cf6', // roxo
  MO: '#f59e0b', // âmbar
  O:  '#22c55e', // verde
};

// ═══════════════════════════════════════════════════════════════════════════════
// FUNÇÕES DE CONVERSÃO E CONSULTA
// Sistema de coordenadas: x=largura 0-100, y=profundidade 0-100
// SVG Legacy First View: 720×1100px, home=baixo(y=0), away=cima(y=100)
// ═══════════════════════════════════════════════════════════════════════════════

export interface NormalizedPosition {
  x: number; // largura 0–100
  y: number; // profundidade 0–100
}

export interface SvgPosition {
  svgX: number; // pixels no SVG (0–720)
  svgY: number; // pixels no SVG (0–1100)
}

const SVG_W = 720;
const SVG_H = 1100;

/**
 * Converte coordenadas normalizadas (0–100) para pixels SVG do Legacy First View.
 * x=0 → svgX=0 (esquerda), x=100 → svgX=720 (direita)
 * y=0 → svgY=1100 (home/baixo), y=100 → svgY=0 (away/cima)
 */
export function normalizedToSvg(x: number, y: number): SvgPosition {
  return {
    svgX: (x / 100) * SVG_W,
    svgY: SVG_H - (y / 100) * SVG_H,
  };
}

/**
 * Converte pixels SVG do Legacy First View para coordenadas normalizadas (0–100).
 */
export function svgToNormalized(svgX: number, svgY: number): NormalizedPosition {
  return {
    x: (svgX / SVG_W) * 100,
    y: ((SVG_H - svgY) / SVG_H) * 100,
  };
}

/**
 * Retorna a zona que contém o ponto (x, y) em coordenadas normalizadas 0–100.
 * Alias semântico de getZoneAtPoint com retorno tipado.
 */
export function getZoneFromPosition(x: number, y: number): FieldZone | undefined {
  return FIELD_ZONES.find(
    (z) =>
      x >= z.bounds.xMin && x < z.bounds.xMax &&
      y >= z.bounds.yMin && y < z.bounds.yMax,
  );
}

/**
 * Retorna o centro geométrico de uma zona em coordenadas normalizadas (0–100).
 */
export function getZoneCenter(zoneId: FieldZoneId): NormalizedPosition {
  const z = FIELD_ZONE_BY_ID[zoneId];
  return {
    x: (z.bounds.xMin + z.bounds.xMax) / 2,
    y: (z.bounds.yMin + z.bounds.yMax) / 2,
  };
}

/**
 * Verifica se uma posição normalizada está dentro de uma zona específica.
 */
export function isPositionInsideZone(
  position: NormalizedPosition,
  zoneId: FieldZoneId,
): boolean {
  const z = FIELD_ZONE_BY_ID[zoneId];
  return (
    position.x >= z.bounds.xMin && position.x < z.bounds.xMax &&
    position.y >= z.bounds.yMin && position.y < z.bounds.yMax
  );
}
