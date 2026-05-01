/**
 * Loose ball caótica: bola viva na área sem dono predeterminado.
 * IAs tentam clearance ou finalização baseado no papel.
 */

import type { AgentSnapshot } from '@/simulation/InteractionResolver';
import { FIELD_LENGTH, FIELD_WIDTH } from '@/simulation/field';

export type LooseBallAction = 'clear' | 'shoot' | 'shield' | 'chase';

export interface LooseBallDecision {
  agentId: string;
  action: LooseBallAction;
  priority: number;  // 0-1, maior = age primeiro
}

/** Raio máximo para reagir à bola solta (metros) */
const LOOSE_BALL_REACT_RADIUS_M = 12;
/** Distância da área para considerar "dentro da área" */
const BOX_DEPTH_M = 16.5;
const BOX_WIDTH_HALF_M = 20.16;

/** Papéis ofensivos que tentam finalizar */
const SHOOTING_ROLES = new Set(['atacante', 'ponta', 'meia', 'attack', 'mid']);
/** Papéis defensivos que tentam afastar */
const CLEARING_ROLES = new Set(['zagueiro', 'lateral', 'goleiro', 'def', 'gk']);

function isInBox(x: number, z: number, attackDir: 1 | -1): boolean {
  const goalLineX = attackDir === 1 ? FIELD_LENGTH : 0;
  const distToGoalLine = Math.abs(x - goalLineX);
  const distFromCenter = Math.abs(z - FIELD_WIDTH / 2);
  return distToGoalLine <= BOX_DEPTH_M && distFromCenter <= BOX_WIDTH_HALF_M;
}

/**
 * Resolve disputa por bola solta.
 * Cada agente próximo recebe uma ação e prioridade baseadas em:
 * - Distância à bola (mais perto = maior prioridade)
 * - Papel tático (atacante chuta, defensor afasta)
 * - Posição no campo (dentro/fora da área)
 * - RNG para variância
 */
export function resolveLooseBall(
  ballX: number,
  ballZ: number,
  agents: AgentSnapshot[],
  attackDir: 1 | -1,
  rng01: () => number,
): LooseBallDecision[] {
  const decisions: LooseBallDecision[] = [];

  const ballInBox = isInBox(ballX, ballZ, attackDir);

  for (const agent of agents) {
    const dist = Math.hypot(agent.x - ballX, agent.z - ballZ);
    if (dist > LOOSE_BALL_REACT_RADIUS_M) continue;

    // Prioridade base: inversamente proporcional à distância
    const distPriority = Math.max(0, 1 - dist / LOOSE_BALL_REACT_RADIUS_M);
    // Variância RNG para evitar que todos ajam exatamente ao mesmo tempo
    const priority = Math.max(0, Math.min(1, distPriority * 0.7 + rng01() * 0.3));

    let action: LooseBallAction;

    if (ballInBox) {
      // Dentro da área: atacantes chutam, defensores afastam
      if (SHOOTING_ROLES.has(agent.role) && agent.side === (attackDir === 1 ? 'home' : 'away')) {
        // Atacante dentro da área — finaliza
        action = rng01() < 0.75 ? 'shoot' : 'shield';
      } else if (CLEARING_ROLES.has(agent.role)) {
        // Defensor dentro da área — afasta
        action = 'clear';
      } else {
        // Outros: perseguem
        action = 'chase';
      }
    } else {
      // Fora da área: todos perseguem ou protegem
      if (CLEARING_ROLES.has(agent.role)) {
        action = rng01() < 0.6 ? 'clear' : 'chase';
      } else if (SHOOTING_ROLES.has(agent.role)) {
        action = rng01() < 0.5 ? 'shield' : 'chase';
      } else {
        action = 'chase';
      }
    }

    decisions.push({ agentId: agent.id, action, priority });
  }

  // Ordena por prioridade decrescente
  return decisions.sort((a, b) => b.priority - a.priority);
}
