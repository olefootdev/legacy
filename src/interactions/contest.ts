import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';

export interface ContestEntity {
  id: string;
  x: number;
  z: number;
  /** 0–100 */
  reach: number;
}

/** Disputa simplificada: quem está mais perto da bola com peso de atributo. */
export function contestBallPossession(ballX: number, ballZ: number, candidates: ContestEntity[]): string | null {
  if (candidates.length === 0) return null;
  let best: ContestEntity | null = null;
  let bestScore = -1e9;
  for (const c of candidates) {
    const dx = c.x - ballX;
    const dz = c.z - ballZ;
    const d = Math.hypot(dx, dz);
    if (d > 6) continue;
    const score = c.reach - d * 8;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best?.id ?? null;
}

export function lineOfSightRough(x0: number, z0: number, x1: number, z1: number, blockers: ContestEntity[], width = 2.5): boolean {
  const steps = 6;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const z = z0 + (z1 - z0) * t;
    for (const b of blockers) {
      if (Math.hypot(b.x - x, b.z - z) < width) return false;
    }
  }
  return true;
}

export function randomPassRisk(): number {
  return 0.12 + Math.random() * 0.1;
}
