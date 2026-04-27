export interface QuickMatchStreak {
  current: number;
  best: number;
  lastMatchWon: boolean;
  multiplier: number;
}

export function calculateStreakMultiplier(streak: number): number {
  if (streak >= 10) return 3.0;
  if (streak >= 7) return 2.5;
  if (streak >= 5) return 2.0;
  if (streak >= 3) return 1.5;
  return 1.0;
}

export function updateStreak(
  current: QuickMatchStreak | undefined,
  matchWon: boolean,
): QuickMatchStreak {
  const prev = current || { current: 0, best: 0, lastMatchWon: false, multiplier: 1.0 };

  if (matchWon) {
    const newCurrent = prev.current + 1;
    const newBest = Math.max(newCurrent, prev.best);
    const multiplier = calculateStreakMultiplier(newCurrent);
    return { current: newCurrent, best: newBest, lastMatchWon: true, multiplier };
  } else {
    return { current: 0, best: prev.best, lastMatchWon: false, multiplier: 1.0 };
  }
}
