/**
 * Anti-chaos: deslocamentos visuais para evitar sobreposição de tokens no plano 0–100%
 * (mesma escala que `pitchPlanePercent` em Live2dMatchShell). Não altera posições de simulação.
 */

export interface AntiChaosAgent {
  id: string;
  /** Mesmas coordenadas que `PitchPlayerState.x` / `.y` (0–1 ou 0–100). */
  x: number;
  y: number;
}

export interface AntiChaosOptions {
  /** Distância mínima entre centros de tokens, em % do campo. */
  minSeparation?: number;
  /** Passos de relaxação par-a-par. */
  iterations?: number;
  /** Teto base de desvio (%); em zonas densas o motor aumenta por jogador até ~42%. */
  maxOffset?: number;
  /** Bola em coords de pitch (mesma escala que os agentes). */
  ball?: { x: number; y: number };
  /** Distância mínima jogador–bola (%). */
  minFromBall?: number;
}

function toPlanePercent(v: number): number {
  if (!Number.isFinite(v)) return 50;
  if (v >= 0 && v <= 1) return Math.min(100, Math.max(0, v * 100));
  return Math.min(100, Math.max(0, v));
}

function clampOffset(dx: number, dy: number, max: number): { dx: number; dy: number } {
  const len = Math.hypot(dx, dy);
  if (len <= max || len < 1e-9) return { dx, dy };
  const s = max / len;
  return { dx: dx * s, dy: dy * s };
}

/** Raio (% do campo) para contar vizinhos e subir o teto de desvio só onde há amontoado. */
const DENSITY_NEIGHBOR_RADIUS = 9.25;

/**
 * Tetos de desvio por agente: zonas densas (muitos vizinhos na posição real) precisam de mais margem
 * para o mesmo `minSeparation` — o teto global único deixava tokens sobrepostos no meio-campo.
 */
function perAgentMaxOffsets(
  n: number,
  baseX: Float64Array,
  baseY: Float64Array,
  baseMax: number,
): Float64Array {
  const maxPer = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let neighbors = 0;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const d = Math.hypot(baseX[i]! - baseX[j]!, baseY[i]! - baseY[j]!);
      if (d < DENSITY_NEIGHBOR_RADIUS) neighbors++;
    }
    maxPer[i] = Math.min(42, baseMax + neighbors * 1.95);
  }
  return maxPer;
}

function clampAgentOffsetToMax(
  i: number,
  offX: Float64Array,
  offY: Float64Array,
  maxPer: Float64Array,
): void {
  const max = maxPer[i]!;
  const len = Math.hypot(offX[i]!, offY[i]!);
  if (len <= max || len < 1e-9) return;
  const s = max / len;
  offX[i] = offX[i]! * s;
  offY[i] = offY[i]! * s;
}

/**
 * Calcula deslocamentos `{ dx, dy }` em pontos percentuais para somar a `left`/`top` dos tokens.
 */
export function computePitchTokenSeparation(
  agents: AntiChaosAgent[],
  opts: AntiChaosOptions = {},
): Map<string, { dx: number; dy: number }> {
  const out = new Map<string, { dx: number; dy: number }>();
  if (!agents.length) return out;

  const minSep = opts.minSeparation ?? 4.05;
  const n = agents.length;
  const iterations = opts.iterations ?? (n > 16 ? 24 : 18);
  const baseMaxOffset = opts.maxOffset ?? 14;
  const minFromBall = opts.minFromBall ?? 2.9;
  const eps = 1e-4;

  const baseX = new Float64Array(n);
  const baseY = new Float64Array(n);
  const offX = new Float64Array(n);
  const offY = Float64Array.from({ length: n }, () => 0);

  for (let i = 0; i < n; i++) {
    baseX[i] = toPlanePercent(agents[i]!.x);
    baseY[i] = toPlanePercent(agents[i]!.y);
  }

  const maxPerAgent = perAgentMaxOffsets(n, baseX, baseY, baseMaxOffset);

  let ballPx = 50;
  let ballPy = 50;
  let ballActive = false;
  if (opts.ball) {
    ballPx = toPlanePercent(opts.ball.x);
    ballPy = toPlanePercent(opts.ball.y);
    ballActive = Number.isFinite(ballPx) && Number.isFinite(ballPy);
  }

  const separatePair = (i: number, j: number, needDist: number) => {
    let ax = baseX[i]! + offX[i]!;
    let ay = baseY[i]! + offY[i]!;
    let bx = baseX[j]! + offX[j]!;
    let by = baseY[j]! + offY[j]!;
    let dx = bx - ax;
    let dy = by - ay;
    let dist = Math.hypot(dx, dy);
    if (dist < eps) {
      const seed = (i * 7919 + j * 5023) % 1000;
      const ang = (seed / 1000) * Math.PI * 2;
      dx = Math.cos(ang);
      dy = Math.sin(ang);
      dist = eps;
    }
    if (dist >= needDist) return;
    const nx = dx / dist;
    const ny = dy / dist;
    const push = (needDist - dist) * 0.5;
    offX[i] = offX[i]! - nx * push;
    offY[i] = offY[i]! - ny * push;
    offX[j] = offX[j]! + nx * push;
    offY[j] = offY[j]! + ny * push;
  };

  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        separatePair(i, j, minSep);
      }
    }
    for (let i = 0; i < n; i++) {
      clampAgentOffsetToMax(i, offX, offY, maxPerAgent);
    }
  }

  if (ballActive) {
    const ballPasses = Math.max(8, Math.min(16, iterations));
    for (let it = 0; it < ballPasses; it++) {
      for (let i = 0; i < n; i++) {
        const ax = baseX[i]! + offX[i]!;
        const ay = baseY[i]! + offY[i]!;
        let dx = ax - ballPx;
        let dy = ay - ballPy;
        let dist = Math.hypot(dx, dy);
        if (dist < eps) {
          const seed = (i * 5023) % 1000;
          const ang = (seed / 1000) * Math.PI * 2;
          dx = Math.cos(ang);
          dy = Math.sin(ang);
          dist = eps;
        }
        if (dist >= minFromBall) continue;
        const nx = dx / dist;
        const ny = dy / dist;
        const push = minFromBall - dist;
        offX[i] = offX[i]! + nx * push;
        offY[i] = offY[i]! + ny * push;
      }
    }
    for (let it = 0; it < 5; it++) {
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          separatePair(i, j, minSep);
        }
      }
    }
  }

  const polishPasses = 10;
  for (let pass = 0; pass < polishPasses; pass++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        separatePair(i, j, minSep);
      }
    }
    for (let i = 0; i < n; i++) {
      clampAgentOffsetToMax(i, offX, offY, maxPerAgent);
    }
  }

  for (let i = 0; i < n; i++) {
    const c = clampOffset(offX[i]!, offY[i]!, maxPerAgent[i]!);
    out.set(agents[i]!.id, { dx: c.dx, dy: c.dy });
  }

  return out;
}
