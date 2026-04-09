/** Metros virtuais — alinhado a `src/simulation/field.ts` */
export const FIELD_LENGTH = 105;
export const FIELD_WIDTH = 68;

/** Slots 4-3-3 normalizados (nx,nz) — casa ataca +X */
const BASE: { id: string; nx: number; nz: number }[] = [
  { id: 'gol', nx: 0.08, nz: 0.5 },
  { id: 'zag1', nx: 0.26, nz: 0.38 },
  { id: 'zag2', nx: 0.26, nz: 0.62 },
  { id: 'le', nx: 0.32, nz: 0.12 },
  { id: 'ld', nx: 0.32, nz: 0.88 },
  { id: 'vol', nx: 0.48, nz: 0.5 },
  { id: 'mc1', nx: 0.55, nz: 0.32 },
  { id: 'mc2', nx: 0.55, nz: 0.68 },
  { id: 'pe', nx: 0.72, nz: 0.2 },
  { id: 'ata', nx: 0.78, nz: 0.5 },
  { id: 'pd', nx: 0.72, nz: 0.8 },
];

export function demoPositions433(): {
  home: { id: string; x: number; z: number }[];
  away: { id: string; x: number; z: number }[];
} {
  const home = BASE.map((s) => ({
    id: `h-${s.id}`,
    x: s.nx * FIELD_LENGTH,
    z: s.nz * FIELD_WIDTH,
  }));
  const away = BASE.map((s) => ({
    id: `a-${s.id}`,
    x: FIELD_LENGTH - s.nx * FIELD_LENGTH,
    z: s.nz * FIELD_WIDTH,
  }));
  return { home, away };
}
