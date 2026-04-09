/**
 * Níveis 1–25: EXP vitalício mínimo para **estar** nesse nível.
 * Índice i = nível (i+1): EXP_FOR_LEVEL[i] = mínimo de exp_lifetime_earned para ser nível i+1.
 * Nível 1 sempre disponível com 0 EXP.
 */
export const EXP_FOR_LEVEL: readonly number[] = [
  0, // nível 1
  120, // 2
  320, // 3
  620, // 4
  1050, // 5
  1600, // 6
  2300, // 7
  3200, // 8
  4300, // 9
  5700, // 10
  7400, // 11
  9500, // 12
  12000, // 13
  15000, // 14
  18600, // 15
  22900, // 16
  28000, // 17
  34000, // 18
  41000, // 19
  49200, // 20
  58800, // 21
  70000, // 22
  83000, // 23
  98500, // 24
  116000, // 25 — teto de nível
];

export const MAX_MANAGER_LEVEL = 25;

export function getManagerLevel(expLifetimeEarned: number): number {
  let level = 1;
  for (let L = 2; L <= MAX_MANAGER_LEVEL; L++) {
    if (expLifetimeEarned >= EXP_FOR_LEVEL[L - 1]) level = L;
    else break;
  }
  return level;
}

/** EXP vitalício necessário para alcançar o próximo nível (ou null se já 25). */
export function expToNextLevel(expLifetimeEarned: number): { current: number; next: number | null; intoLevel: number } {
  const level = getManagerLevel(expLifetimeEarned);
  if (level >= MAX_MANAGER_LEVEL) {
    return {
      current: expLifetimeEarned - EXP_FOR_LEVEL[MAX_MANAGER_LEVEL - 1],
      next: null,
      intoLevel: expLifetimeEarned - EXP_FOR_LEVEL[MAX_MANAGER_LEVEL - 1],
    };
  }
  const floor = EXP_FOR_LEVEL[level - 1];
  const ceil = EXP_FOR_LEVEL[level];
  return {
    current: expLifetimeEarned - floor,
    next: ceil,
    intoLevel: ceil - floor,
  };
}
