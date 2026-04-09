import { hashStringSeed } from '@/match/seededRng';

export function idxFromSeed(seed: string, mod: number): number {
  if (mod <= 0) return 0;
  return Math.abs(hashStringSeed(seed)) % mod;
}
