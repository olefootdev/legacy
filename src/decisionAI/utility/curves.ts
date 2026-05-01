import type { CurveKind } from './types';

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function linear(x: number, m: number, k: number, b: number, _c: number): number {
  return clamp01(m * (x - k) + b);
}

export function sigmoid(x: number, m: number, k: number, b: number, c: number): number {
  return clamp01(c / (1 + Math.exp(-m * (x - k))) + b);
}

export function quadratic_up(x: number, m: number, k: number, b: number, c: number): number {
  return clamp01(c * Math.pow(Math.max(0, x - k), 2) * m + b);
}

export function quadratic_down(x: number, m: number, k: number, b: number, c: number): number {
  return clamp01(c * (1 - Math.pow(Math.max(0, x - k), 2) * m) + b);
}

export function logit(x: number, m: number, k: number, b: number, c: number): number {
  const shifted = x - k;
  return clamp01(
    c * Math.log(Math.max(1e-6, shifted) / Math.max(1e-6, 1 - shifted)) * m + b,
  );
}

export function evaluateCurve(
  kind: CurveKind,
  x: number,
  m: number,
  k: number,
  b: number,
  c: number,
): number {
  switch (kind) {
    case 'linear':        return linear(x, m, k, b, c);
    case 'sigmoid':       return sigmoid(x, m, k, b, c);
    case 'quadratic_up':  return quadratic_up(x, m, k, b, c);
    case 'quadratic_down':return quadratic_down(x, m, k, b, c);
    case 'logit':         return logit(x, m, k, b, c);
  }
}
