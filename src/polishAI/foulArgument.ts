/**
 * Argumentação em faltas: agentes próximos ao juiz se juntam.
 * Retorna lista de agentes que devem se mover para perto do ponto da falta.
 */

/** Raio máximo para participar da discussão (metros) */
const ARGUMENT_SCAN_RADIUS_M = 30;
/** Distância de chegada ao ponto da falta (metros) — não ficam todos no mesmo ponto */
const ARGUMENT_SPREAD_RADIUS_M = 2.5;
/** Máximo de participantes por time */
const DEFAULT_MAX_PER_TEAM = 2;

export interface ArgumentParticipant {
  agentId: string;
  targetX: number;
  targetZ: number;
  team: 'home' | 'away';
  role: 'protester' | 'peacemaker';
}

/**
 * Computa posições de argumentação ao redor do ponto da falta.
 * - Time que sofreu a falta: protestantes (protestam contra o árbitro)
 * - Time que cometeu a falta: pacificadores (tentam acalmar)
 * Seleciona os agentes mais próximos do ponto da falta por time.
 */
export function computeFoulArgumentPositions(
  foulX: number,
  foulZ: number,
  agents: Array<{ id: string; x: number; z: number; side: string; role?: string }>,
  maxParticipants: number = DEFAULT_MAX_PER_TEAM * 2,
): ArgumentParticipant[] {
  const maxPerTeam = Math.floor(maxParticipants / 2);

  // Separa por time e filtra por raio
  const homeAgents = agents
    .filter(a => a.side === 'home' && Math.hypot(a.x - foulX, a.z - foulZ) <= ARGUMENT_SCAN_RADIUS_M)
    .sort((a, b) => Math.hypot(a.x - foulX, a.z - foulZ) - Math.hypot(b.x - foulX, b.z - foulZ))
    .slice(0, maxPerTeam);

  const awayAgents = agents
    .filter(a => a.side === 'away' && Math.hypot(a.x - foulX, a.z - foulZ) <= ARGUMENT_SCAN_RADIUS_M)
    .sort((a, b) => Math.hypot(a.x - foulX, a.z - foulZ) - Math.hypot(b.x - foulX, b.z - foulZ))
    .slice(0, maxPerTeam);

  const participants: ArgumentParticipant[] = [];

  // Distribui posições ao redor do ponto da falta em arco
  const allGroups: Array<{ agents: typeof homeAgents; team: 'home' | 'away'; role: 'protester' | 'peacemaker' }> = [
    { agents: homeAgents, team: 'home', role: 'protester' },
    { agents: awayAgents, team: 'away', role: 'peacemaker' },
  ];

  let angleOffset = 0;
  for (const group of allGroups) {
    for (let i = 0; i < group.agents.length; i++) {
      const agent = group.agents[i];
      // Distribui em arco ao redor do ponto da falta
      const angle = angleOffset + (i / Math.max(1, group.agents.length - 1)) * Math.PI * 0.6 - Math.PI * 0.3;
      const targetX = foulX + Math.cos(angle) * ARGUMENT_SPREAD_RADIUS_M;
      const targetZ = foulZ + Math.sin(angle) * ARGUMENT_SPREAD_RADIUS_M;

      participants.push({
        agentId: agent.id,
        targetX,
        targetZ,
        team: group.team,
        role: group.role,
      });
    }
    angleOffset += Math.PI; // Time adversário fica do lado oposto
  }

  return participants;
}
