/**
 * Reação a erros de terceiros: atacante perde gol, mates colocam mão na cabeça por 1s.
 * Retorna lista de agentes que devem exibir a animação de frustração.
 */

export interface ReactionSignal {
  agentId: string;
  kind: 'head_grab' | 'celebrate' | 'argue' | 'despair';
  durationSec: number;
  startedAt: number;
}

const DEFAULT_REACTION_RADIUS_M = 25;
const HEAD_GRAB_DURATION_SEC = 1.5;
const CELEBRATE_DURATION_SEC = 3.0;

/**
 * Computa distância euclidiana 2D entre dois pontos no campo (metros).
 */
function dist2d(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(ax - bx, az - bz);
}

/**
 * Reação a gol perdido: companheiros próximos ao ponto da chance perdida
 * exibem animação de frustração (mão na cabeça).
 */
export function triggerMissedGoalReaction(
  missedByAgentId: string,
  teammates: Array<{ id: string; x: number; z: number }>,
  missX: number,
  missZ: number,
  simTime: number,
  reactionRadius: number = DEFAULT_REACTION_RADIUS_M,
): ReactionSignal[] {
  const signals: ReactionSignal[] = [];

  // O próprio jogador que perdeu entra em desespero
  signals.push({
    agentId: missedByAgentId,
    kind: 'despair',
    durationSec: HEAD_GRAB_DURATION_SEC * 2,
    startedAt: simTime,
  });

  for (const tm of teammates) {
    if (tm.id === missedByAgentId) continue;
    const d = dist2d(tm.x, tm.z, missX, missZ);
    if (d <= reactionRadius) {
      signals.push({
        agentId: tm.id,
        kind: 'head_grab',
        durationSec: HEAD_GRAB_DURATION_SEC,
        startedAt: simTime,
      });
    }
  }

  return signals;
}

/**
 * Celebração de gol: todos os companheiros celebram.
 * Jogadores mais próximos do marcador correm em direção a ele (celebrate),
 * os demais exibem celebrate estático.
 */
export function triggerGoalCelebration(
  scorerAgentId: string,
  teammates: Array<{ id: string; x: number; z: number }>,
  simTime: number,
): ReactionSignal[] {
  const signals: ReactionSignal[] = [];

  // O marcador celebra por mais tempo
  signals.push({
    agentId: scorerAgentId,
    kind: 'celebrate',
    durationSec: CELEBRATE_DURATION_SEC * 1.5,
    startedAt: simTime,
  });

  for (const tm of teammates) {
    if (tm.id === scorerAgentId) continue;
    signals.push({
      agentId: tm.id,
      kind: 'celebrate',
      durationSec: CELEBRATE_DURATION_SEC,
      startedAt: simTime,
    });
  }

  return signals;
}

/**
 * Remove sinais expirados com base no simTime atual.
 */
export function tickReactionSignals(
  signals: ReactionSignal[],
  simTime: number,
): ReactionSignal[] {
  return signals.filter(s => simTime < s.startedAt + s.durationSec);
}

/**
 * Verifica se um agente específico está atualmente em reação.
 */
export function isAgentReacting(signals: ReactionSignal[], agentId: string): boolean {
  return signals.some(s => s.agentId === agentId);
}
