/** Piso de EXP vitalício para estar no nível L (1–25). Monotônico. */
const FLOOR_FOR_LEVEL: number[] = [
  0, 80, 200, 400, 700, 1100, 1600, 2200, 2900, 3700, 4600, 5600, 6700, 7900, 9200, 10600, 12100, 13700,
  15400, 17200, 19100, 21100, 23200, 25400, 27800, 30400, 33200,
];

const MAX_LEVEL = 25;

/** Nível 1–25 a partir de EXP vitalício acumulado. */
export function getManagerLevel(expLifetimeEarned: number): number {
  for (let L = MAX_LEVEL; L >= 1; L--) {
    const floor = FLOOR_FOR_LEVEL[L - 1];
    if (floor !== undefined && expLifetimeEarned >= floor) return L;
  }
  return 1;
}

/** Barra até o próximo nível (segmento atual). */
export function expToNextLevel(expLifetimeEarned: number): {
  current: number;
  nextFloor: number;
  ratio: number;
  remaining: number;
} {
  const level = getManagerLevel(expLifetimeEarned);
  if (level >= MAX_LEVEL) {
    const cap = FLOOR_FOR_LEVEL[MAX_LEVEL - 1]!;
    return { current: expLifetimeEarned, nextFloor: cap, ratio: 1, remaining: 0 };
  }
  const floorNow = FLOOR_FOR_LEVEL[level - 1] ?? 0;
  const floorNext = FLOOR_FOR_LEVEL[level] ?? floorNow;
  const span = Math.max(1, floorNext - floorNow);
  const ratio = Math.min(1, Math.max(0, (expLifetimeEarned - floorNow) / span));
  const remaining = Math.max(0, Math.round(floorNext - expLifetimeEarned));
  return {
    current: expLifetimeEarned,
    nextFloor: floorNext,
    ratio,
    remaining,
  };
}
