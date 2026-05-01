import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';
import type { AgentSnapshot } from '@/simulation/InteractionResolver';

export interface SupportSpot {
  x: number;
  z: number;
  score: number;
  reason: string;
}

/** Goal center X for each attack direction */
function oppGoalX(attackDir: 1 | -1): number {
  return attackDir === 1 ? FIELD_LENGTH : 0;
}

/** Angle (radians) from a point to the opponent goal mouth */
function shotAngleToGoal(x: number, z: number, attackDir: 1 | -1): number {
  const gx = oppGoalX(attackDir);
  const gz = FIELD_WIDTH / 2;
  const halfWidth = 5; // half of goal mouth ~10m
  const dx = gx - x;
  const dz = gz - z;
  const dist = Math.hypot(dx, dz);
  if (dist < 1e-6) return Math.PI / 2;
  // Approximate angle subtended by goal mouth
  return Math.atan2(halfWidth, dist);
}

/** Distance from point to nearest opponent */
function minDistToOpponents(
  x: number,
  z: number,
  opponents: AgentSnapshot[],
): number {
  let min = Infinity;
  for (const opp of opponents) {
    const d = Math.hypot(opp.x - x, opp.z - z);
    if (d < min) min = d;
  }
  return min === Infinity ? 99 : min;
}

/** Distance from point to nearest teammate (excluding carrier) */
function minDistToTeammates(
  x: number,
  z: number,
  teammates: AgentSnapshot[],
  excludeId: string,
): number {
  let min = Infinity;
  for (const tm of teammates) {
    if (tm.id === excludeId) continue;
    const d = Math.hypot(tm.x - x, tm.z - z);
    if (d < min) min = d;
  }
  return min === Infinity ? 99 : min;
}

/**
 * Computa 6-8 support spots dinâmicos para o time atacante.
 * Grid: 3 linhas × 3 colunas na metade ofensiva + 2 spots na área = 11 candidatos.
 * Retorna top 6-8 ordenados por score desc.
 */
export function computeSupportSpots(
  carrier: AgentSnapshot,
  teammates: AgentSnapshot[],
  opponents: AgentSnapshot[],
  attackDir: 1 | -1,
): SupportSpot[] {
  const candidates: Array<{ x: number; z: number }> = [];

  // Offensive half boundaries
  const halfLineX = FIELD_LENGTH / 2;
  const goalX = oppGoalX(attackDir);

  // 3×3 grid in offensive half
  // X: from halfLine to ~18m from goal (penalty area edge)
  const penAreaEdgeX = attackDir === 1 ? FIELD_LENGTH - 18 : 18;
  const xStart = attackDir === 1 ? halfLineX + 5 : penAreaEdgeX + 2;
  const xEnd = attackDir === 1 ? penAreaEdgeX - 2 : halfLineX - 5;

  const xStep = (xEnd - xStart) / 2;
  const zPositions = [FIELD_WIDTH * 0.2, FIELD_WIDTH * 0.5, FIELD_WIDTH * 0.8];

  for (let col = 0; col < 3; col++) {
    const cx = xStart + col * xStep;
    for (const cz of zPositions) {
      candidates.push({ x: cx, z: cz });
    }
  }

  // 2 spots inside the penalty box
  const boxX1 = attackDir === 1 ? FIELD_LENGTH - 10 : 10;
  const boxX2 = attackDir === 1 ? FIELD_LENGTH - 6 : 6;
  candidates.push({ x: boxX1, z: FIELD_WIDTH * 0.35 });
  candidates.push({ x: boxX2, z: FIELD_WIDTH * 0.65 });

  // Score each candidate
  const scored: SupportSpot[] = candidates.map(({ x, z }) => {
    const distToBall = Math.hypot(x - carrier.x, z - carrier.z);
    const distToController = distToBall; // same as distToBall here
    const passSafety = minDistToOpponents(x, z, opponents);
    const angle = shotAngleToGoal(x, z, attackDir);
    const crowdPenalty = minDistToTeammates(x, z, teammates, carrier.id);

    // distanceToBall: prefer 10-30m
    let distScore = 0;
    if (distToBall >= 10 && distToBall <= 30) {
      distScore = 1 - Math.abs(distToBall - 20) / 20;
    } else if (distToBall < 10) {
      distScore = distToBall / 10;
    } else {
      distScore = Math.max(0, 1 - (distToBall - 30) / 20);
    }

    // passSafety: 0-1 (saturates at 15m)
    const safetyScore = Math.min(passSafety / 15, 1);

    // shotAngle: normalize to 0-1 (max ~0.5 rad)
    const angleScore = Math.min(angle / 0.5, 1);

    // distanceToController penalty: > 35m is bad
    const controllerPenalty = distToController > 35 ? Math.max(0, 1 - (distToController - 35) / 15) : 1;

    // notCrowded: penalize if teammate within 5m
    const crowdScore = crowdPenalty < 5 ? crowdPenalty / 5 : 1;

    // Weighted sum
    const score =
      distScore * 0.25 +
      safetyScore * 0.30 +
      angleScore * 0.20 +
      controllerPenalty * 0.15 +
      crowdScore * 0.10;

    // Build reason string
    const reasons: string[] = [];
    if (safetyScore > 0.7) reasons.push('open');
    if (angleScore > 0.6) reasons.push('good-angle');
    if (distScore > 0.7) reasons.push('ideal-dist');
    if (crowdScore < 0.5) reasons.push('crowded');
    const reason = reasons.length > 0 ? reasons.join('+') : 'neutral';

    return { x, z, score, reason };
  });

  // Sort desc, return top 8
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 8);
}

/**
 * Retorna o melhor spot para um jogador específico (não ocupado por outro colega).
 */
export function getBestSupportSpotFor(
  player: AgentSnapshot,
  carrier: AgentSnapshot,
  teammates: AgentSnapshot[],
  opponents: AgentSnapshot[],
  attackDir: 1 | -1,
): SupportSpot | null {
  const spots = computeSupportSpots(carrier, teammates, opponents, attackDir);

  // Filter out spots already occupied by another teammate (within 4m), excluding the player itself
  const otherTeammates = teammates.filter((t) => t.id !== player.id && t.id !== carrier.id);

  for (const spot of spots) {
    const occupied = otherTeammates.some(
      (t) => Math.hypot(t.x - spot.x, t.z - spot.z) < 4,
    );
    if (!occupied) return spot;
  }

  // Fallback: return best spot even if occupied
  return spots[0] ?? null;
}
