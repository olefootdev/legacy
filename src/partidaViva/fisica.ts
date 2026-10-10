/**
 * PARTIDA VIVA — física simples do coreógrafo: corpos, passo fixo, sorteio
 * por seed e o movimento natural (aceleração limitada, chegada suave,
 * separação entre fichas). Sem Math.random: tudo determinístico.
 */
import { FORMATION_BASES } from '@/match-engine/formations/catalog';
import type { FormationSchemeId } from '@/match-engine/types';
import type { Ficha } from './tipos';

export const DT = 0.1;
export const C = 105;
export const L = 68;

export interface Corpo {
  f: Ficha;
  x: number; z: number; vx: number; vz: number;
  px: number; pz: number; // posição no passo anterior (interpolação)
  ancora: { x: number; z: number };
  alvo: { x: number; z: number } | null;
  vmax: number;
}

/** `fixo`: a bola vai ao PONTO (jogada contada), não persegue o receptor. */
export interface Voo { x0: number; z0: number; x1: number; z1: number; t: number; dur: number; altura: number; para: Corpo | null; fixo?: boolean }

export function semente(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const lim = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function esquema(f: string): FormationSchemeId {
  return (f in FORMATION_BASES ? f : '4-3-3') as FormationSchemeId;
}

/** Um passo de movimento: vai pro alvo com inércia e se afasta de quem está colado. */
export function moverCorpo(c: Corpo, alvo: { x: number; z: number }, todos: readonly Corpo[]): void {
  const dx = alvo.x - c.x, dz = alvo.z - c.z;
  const d = Math.hypot(dx, dz) || 1e-6;
  const v = c.vmax * Math.min(1, d / 5);
  let ax = (dx / d) * v - c.vx, az = (dz / d) * v - c.vz;
  for (const o of todos) {
    if (o === c) continue;
    const ex = c.x - o.x, ez = c.z - o.z, e = Math.hypot(ex, ez);
    if (e < 2.2 && e > 0.01) { ax += (ex / e) * (2.2 - e) * 2.5; az += (ez / e) * (2.2 - e) * 2.5; }
  }
  const m = Math.hypot(ax, az), A = 10 * DT;
  if (m > A) { ax = (ax / m) * A; az = (az / m) * A; }
  c.vx += ax; c.vz += az;
  c.x = lim(c.x + c.vx * DT, -2, C + 2);
  c.z = lim(c.z + c.vz * DT, -2, L + 2);
}
