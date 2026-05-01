import type { AgentSnapshot, PassOption } from '@/simulation/InteractionResolver';

/**
 * Distância de um ponto P ao segmento AB (2D, eixos x/z).
 */
function pointToSegmentDist(
  px: number, pz: number,
  ax: number, az: number,
  bx: number, bz: number,
): number {
  const abx = bx - ax;
  const abz = bz - az;
  const lenSq = abx * abx + abz * abz;
  if (lenSq < 1e-10) return Math.hypot(px - ax, pz - az);

  // Project P onto AB, clamped to [0,1]
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (pz - az) * abz) / lenSq));
  const closestX = ax + t * abx;
  const closestZ = az + t * abz;
  return Math.hypot(px - closestX, pz - closestZ);
}

/**
 * Raycast 2D: verifica se um defensor pode interceptar o passe.
 * Usa distância ponto-segmento (carrier→target) com raio de intercepção 2.5m.
 * Retorna true se o passe é seguro (nenhum defensor no corredor).
 */
export function isPassSafe(
  carrier: AgentSnapshot,
  target: AgentSnapshot,
  opponents: AgentSnapshot[],
  interceptRadius = 2.5,
): boolean {
  for (const opp of opponents) {
    const dist = pointToSegmentDist(
      opp.x, opp.z,
      carrier.x, carrier.z,
      target.x, target.z,
    );
    if (dist <= interceptRadius) return false;
  }
  return true;
}

/**
 * Filtra PassOptions descartando passes matematicamente interceptáveis.
 * Substitui heurística de blockCount do InteractionResolver com geometria exata.
 */
export function filterSafePasses(
  carrier: AgentSnapshot,
  options: PassOption[],
  allTeammates: AgentSnapshot[],
  opponents: AgentSnapshot[],
): PassOption[] {
  return options.filter((opt) => {
    // Find the teammate snapshot for this pass option
    const target = allTeammates.find((t) => t.id === opt.targetId);
    if (!target) return false;
    return isPassSafe(carrier, target, opponents);
  });
}

/**
 * Retorna o melhor passe seguro (maior successProb × progressionGain entre os seguros).
 */
export function getBestSafePass(
  carrier: AgentSnapshot,
  options: PassOption[],
  allTeammates: AgentSnapshot[],
  opponents: AgentSnapshot[],
): PassOption | null {
  const safe = filterSafePasses(carrier, options, allTeammates, opponents);
  if (safe.length === 0) return null;

  let best: PassOption | null = null;
  let bestScore = -Infinity;

  for (const opt of safe) {
    const score = opt.successProb * opt.progressionGain;
    if (score > bestScore) {
      bestScore = score;
      best = opt;
    }
  }

  return best;
}
