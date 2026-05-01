/**
 * Prediz onde a bola estará em `t` segundos dado posição + velocidade.
 * Atacante corre para esse ponto, não para onde a bola está agora.
 */
export function predictBallPosition(
  ballX: number,
  ballZ: number,
  ballVx: number,
  ballVz: number,
  t: number,
): { x: number; z: number } {
  return {
    x: ballX + ballVx * t,
    z: ballZ + ballVz * t,
  };
}

/**
 * Calcula o tempo ótimo de sprint para interceptar a bola.
 * Usa busca iterativa: testa t em [0, maxTime] com passo fino.
 * Retorna null se o jogador não consegue alcançar.
 * playerSpeed em m/s (típico: 6-9 m/s).
 */
export function computeInterceptionPoint(
  playerX: number,
  playerZ: number,
  playerSpeed: number,
  ballX: number,
  ballZ: number,
  ballVx: number,
  ballVz: number,
): { x: number; z: number; timeToReach: number } | null {
  const maxTime = 5; // seconds
  const steps = 100;
  const dt = maxTime / steps;

  let bestResult: { x: number; z: number; timeToReach: number } | null = null;
  let bestGap = Infinity;

  for (let i = 1; i <= steps; i++) {
    const t = i * dt;
    const bx = ballX + ballVx * t;
    const bz = ballZ + ballVz * t;

    const distToPoint = Math.hypot(bx - playerX, bz - playerZ);
    const distPlayerCanCover = playerSpeed * t;

    const gap = distToPoint - distPlayerCanCover;

    // Player can reach this point in time
    if (gap <= 0) {
      // Prefer earliest interception
      if (t < (bestResult?.timeToReach ?? Infinity)) {
        bestResult = { x: bx, z: bz, timeToReach: t };
      }
      break;
    }

    // Track closest gap for diagnostics (not used in return)
    if (gap < bestGap) {
      bestGap = gap;
    }
  }

  return bestResult;
}

/**
 * Surfa linha do último zagueiro: retorna X da linha defensiva adversária.
 * O atacante não ultrapassa esse X (evita impedimento).
 *
 * "Último defensor" = o defensor mais recuado em relação ao gol que defende.
 * attackDir = +1 → home ataca para +X, defensores adversários protegem X=105.
 *   Linha defensiva = menor X entre os defensores adversários (mais recuados = menor X).
 * attackDir = -1 → away ataca para -X, defensores adversários protegem X=0.
 *   Linha defensiva = maior X entre os defensores adversários.
 */
export function getLastDefenderLine(
  opponents: Array<{ x: number; z: number; role?: string }>,
  attackDir: 1 | -1,
): number {
  if (opponents.length === 0) {
    // No defenders: return goal line
    return attackDir === 1 ? 105 : 0;
  }

  // Prefer actual defenders/GK, fall back to all opponents
  const defenders = opponents.filter(
    (o) =>
      o.role === 'GK' ||
      o.role === 'CB' ||
      o.role === 'LB' ||
      o.role === 'RB' ||
      o.role === 'SW' ||
      o.role === 'DEF',
  );
  const pool = defenders.length > 0 ? defenders : opponents;

  if (attackDir === 1) {
    // Home attacks toward +X. Last defender = smallest X (deepest toward home goal side)
    // But we want the line the attacker must stay behind = the most advanced defender
    // (the one closest to the attacking goal, i.e. largest X among defenders)
    let maxX = -Infinity;
    for (const d of pool) {
      if (d.x > maxX) maxX = d.x;
    }
    return maxX;
  } else {
    // Away attacks toward -X. Last defender = largest X (deepest toward away goal side)
    // Most advanced = smallest X
    let minX = Infinity;
    for (const d of pool) {
      if (d.x < minX) minX = d.x;
    }
    return minX;
  }
}
