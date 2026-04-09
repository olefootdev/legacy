import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';
import type { FieldZone, FieldZoneCatalog, NormalizedPoint2 } from './catalogTypes';

function pointInPolygon(nx: number, nz: number, poly: NormalizedPoint2[]): boolean {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const pi = poly[i]!;
    const pj = poly[j]!;
    const intersect =
      pi.nz > nz !== pj.nz > nz && nx < ((pj.nx - pi.nx) * (nz - pi.nz)) / (pj.nz - pi.nz + 1e-12) + pi.nx;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function worldToNormalized(homeAttacksPositiveX: boolean, x: number, z: number): { nx: number; nz: number } {
  const nx = homeAttacksPositiveX ? x / FIELD_LENGTH : 1 - x / FIELD_LENGTH;
  const nz = z / FIELD_WIDTH;
  return { nx, nz };
}

export function zonesContainingPoint(
  catalog: FieldZoneCatalog,
  nx: number,
  nz: number,
): FieldZone[] {
  return catalog.zones.filter((z) => pointInPolygon(nx, nz, z.polygon));
}

export function zonesContainingWorldPoint(
  catalog: FieldZoneCatalog,
  side: 'home' | 'away',
  x: number,
  z: number,
): FieldZone[] {
  const homeAttacksPositiveX = side === 'home';
  const { nx, nz } = worldToNormalized(homeAttacksPositiveX, x, z);
  return zonesContainingPoint(catalog, nx, nz);
}
