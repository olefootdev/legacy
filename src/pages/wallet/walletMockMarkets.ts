/**
 * Mock data para sparklines e 24h change.
 * Determinístico por ticker (seed estável → não pisca a cada render).
 * Substituir por feed real quando paridades existirem.
 */

function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function buildSpark(seed: number, base: number, volatility: number, points = 24): number[] {
  const rand = seededRand(seed);
  const out: number[] = [];
  let v = base;
  for (let i = 0; i < points; i++) {
    v += (rand() - 0.5) * volatility;
    out.push(v);
  }
  return out;
}

export type MarketTick = {
  change24h: number;
  spark: number[];
  /** Spot price em USD para o display de exchange. Null = stable/peg. */
  spotUsd?: number;
};

export const MOCK_MARKETS: Record<string, MarketTick> = {
  BTC: { change24h: 2.3, spark: buildSpark(101, 100, 4), spotUsd: 43250 },
  USDT: { change24h: 0.0, spark: buildSpark(202, 100, 0.2), spotUsd: 1.0 },
  BNB: { change24h: -1.4, spark: buildSpark(303, 100, 3), spotUsd: 318.4 },
  OLE: { change24h: 8.4, spark: buildSpark(404, 100, 5), spotUsd: 0.18 },
  SQUAD: { change24h: 5.2, spark: buildSpark(505, 100, 3.5) },
  PORTFOLIO: { change24h: 1.8, spark: buildSpark(606, 100, 2.5, 30) },
};

export function formatSpotUsd(price: number): string {
  if (price >= 1000) {
    return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  }
  if (price >= 1) {
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
}
