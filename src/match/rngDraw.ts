import { unitFromParts } from '@/match/seededRng';

export interface RngDraw {
  /** [0, 1) */
  nextUnit(): number;
}

export function rngFromMathRandom(): RngDraw {
  return { nextUnit: () => Math.random() };
}

export function rngFromSeed(baseSeed: number, stem: string): RngDraw {
  let i = 0;
  return {
    nextUnit: () => unitFromParts(baseSeed, [stem, i++]),
  };
}
