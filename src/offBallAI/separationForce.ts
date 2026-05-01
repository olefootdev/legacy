import type { AntiChaosAgent } from '@/engine/test2d/antiChaosEngine';

/**
 * Steering Behaviors (Reynolds): Separation.
 * Aplica como vetor de repulsão se 2 mates do mesmo time entram em raio < 3m.
 *
 * CRÍTICO: aplicar APÓS decisão (não antes), só ajusta posição final.
 * Retorna mapa de forças { dx, dz } por agente id.
 *
 * Nota: AntiChaosAgent usa coordenadas x/y (0-100 %). Este módulo opera
 * nas mesmas coordenadas — o caller é responsável por converter se necessário.
 * O campo `dz` mapeia ao eixo `y` do AntiChaosAgent para consistência interna.
 */
export function computeSeparationForces(
  agents: AntiChaosAgent[],
  separationRadius = 3,
  maxForce = 1.5,
): Map<string, { dx: number; dz: number }> {
  const forces = new Map<string, { dx: number; dz: number }>();

  // Initialize all forces to zero
  for (const agent of agents) {
    forces.set(agent.id, { dx: 0, dz: 0 });
  }

  const n = agents.length;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = agents[i]!;
      const b = agents[j]!;

      const dx = a.x - b.x;
      const dy = a.y - b.y; // y in AntiChaosAgent = z in world
      const dist = Math.hypot(dx, dy);

      if (dist >= separationRadius || dist < 1e-9) continue;

      // Repulsion magnitude: stronger when closer
      const magnitude = (separationRadius - dist) / separationRadius;

      // Unit vector from b to a
      const nx = dx / dist;
      const ny = dy / dist;

      // Apply equal and opposite forces
      const fa = forces.get(a.id)!;
      const fb = forces.get(b.id)!;

      fa.dx += nx * magnitude * maxForce;
      fa.dz += ny * magnitude * maxForce;

      fb.dx -= nx * magnitude * maxForce;
      fb.dz -= ny * magnitude * maxForce;
    }
  }

  // Clamp each force to maxForce magnitude
  for (const [id, force] of forces) {
    const len = Math.hypot(force.dx, force.dz);
    if (len > maxForce) {
      const scale = maxForce / len;
      forces.set(id, { dx: force.dx * scale, dz: force.dz * scale });
    }
  }

  return forces;
}
