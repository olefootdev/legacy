/**
 * RNG seedável determinístico (xorshift32) para o onboarding.
 *
 * - Independente de `Math.random()` para que sorteios sejam reprodutíveis em testes.
 * - Estado interno mutável; `next()` retorna float [0, 1).
 *
 * Não usar para criptografia ou ranqueamento competitivo — só onboarding/UX.
 */
export interface SeededRng {
  next(): number;
  pickInt(maxExclusive: number): number;
  pickWeighted<T>(items: ReadonlyArray<{ weight: number; value: T }>): T;
  shuffleInPlace<T>(arr: T[]): void;
}

export function createSeededRng(seed: number): SeededRng {
  let s = (seed | 0) || 1;
  const next = (): number => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 0xffffffff) / 0xffffffff;
  };
  const pickInt = (maxExclusive: number): number => {
    if (maxExclusive <= 0) return 0;
    return Math.floor(next() * maxExclusive);
  };
  const pickWeighted = <T,>(items: ReadonlyArray<{ weight: number; value: T }>): T => {
    if (items.length === 0) throw new Error('pickWeighted: empty list');
    const total = items.reduce((sum, it) => sum + Math.max(0, it.weight), 0);
    if (total <= 0) throw new Error('pickWeighted: total weight is 0');
    const roll = next() * total;
    let acc = 0;
    for (const it of items) {
      acc += Math.max(0, it.weight);
      if (roll < acc) return it.value;
    }
    return items[items.length - 1]!.value;
  };
  const shuffleInPlace = <T,>(arr: T[]): void => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = pickInt(i + 1);
      const t = arr[i]!;
      arr[i] = arr[j]!;
      arr[j] = t;
    }
  };
  return { next, pickInt, pickWeighted, shuffleInPlace };
}
