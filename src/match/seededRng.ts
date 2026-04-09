/** RNG determinístico para replay/debug (0 inclusive, 1 exclusive). */

export type SeedParts = readonly (string | number)[];

function fnv1a32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mistura seed base com partes variáveis (tick, jogador, ação). */
export function unitFromParts(baseSeed: number, parts: SeedParts): number {
  let h = (baseSeed >>> 0) ^ 0x9e3779b9;
  const head = `u:${h}`;
  for (const p of parts) {
    const s = typeof p === 'number' ? p.toFixed(6) : String(p);
    h = fnv1a32(`${head}|${s}`) ^ (h << 13);
  }
  return (h >>> 0) / 4294967296;
}

export function hashStringSeed(s: string): number {
  return fnv1a32(s);
}
