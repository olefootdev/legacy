/**
 * Sistema de Awareness Tático
 * Calcula raio de ação, conexões de passe e inteligência espacial
 */

import type { PitchPlayerState } from '@/engine/types';

export interface TacticalRadius {
  radiusCqw: number; // Raio em container query width
  radiusMeters: number; // Raio em metros reais
  opacity: number; // 0-1 baseado em atributos
  color: string; // Cor baseada em energia
}

export interface PassConnection {
  fromId: string;
  toId: string;
  distance: number;
  strength: number; // 0-1 (proximidade)
}

export interface PlayerAwareness {
  playerId: string;
  visibleTeammates: string[]; // IDs dos jogadores dentro do raio
  visibleOpponents: string[]; // IDs dos oponentes dentro do raio
  isIsolated: boolean; // Sem apoio próximo
  supportQuality: number; // 0-1 qualidade do suporte tático
}

/**
 * Calcula raio de ação baseado em role e atributos
 */
export function calculateTacticalRadius(
  player: PitchPlayerState,
  role: string,
): TacticalRadius {
  const tatico = player.attributes?.tatico ?? 50;
  const velocidade = player.attributes?.velocidade ?? 50;
  const fatigue = player.fatigue ?? 0;

  // Raio base por role (em metros)
  let baseRadiusMeters = 15;
  if (role === 'GK') baseRadiusMeters = 25;
  else if (role.includes('CB') || role.includes('LB') || role.includes('RB')) baseRadiusMeters = 18;
  else if (role.includes('CM') || role.includes('DM')) baseRadiusMeters = 20;
  else if (role.includes('AM') || role.includes('W')) baseRadiusMeters = 22;
  else if (role === 'ST') baseRadiusMeters = 20;

  // Bônus por atributos (até +8m)
  const attributeBonus = ((tatico * 0.06 + velocidade * 0.04) / 100) * 8;

  // Penalidade por fadiga (até -30%)
  const fatiguePenalty = Math.min(0.3, fatigue / 300);

  const finalRadiusMeters = Math.max(10, baseRadiusMeters + attributeBonus - (baseRadiusMeters * fatiguePenalty));

  // Converte metros para cqw (assumindo campo de 105m = 100cqw)
  const radiusCqw = (finalRadiusMeters / 105) * 100;

  // Opacidade baseada em tático (50-100 = 0.3-0.6)
  const opacity = 0.3 + (tatico / 100) * 0.3;

  // Cor baseada em energia (100 - fatigue)
  const energy = Math.max(0, 100 - fatigue);
  let color: string;
  if (energy > 70) color = '#10b981'; // Verde
  else if (energy > 50) color = '#fbbf24'; // Amarelo
  else if (energy > 30) color = '#f97316'; // Laranja
  else color = '#ef4444'; // Vermelho

  return {
    radiusCqw,
    radiusMeters: finalRadiusMeters,
    opacity,
    color,
  };
}

/**
 * Calcula distância entre dois jogadores em metros
 */
function distanceInMeters(p1: PitchPlayerState, p2: PitchPlayerState): number {
  // Coordenadas são 0-100, campo real é 105m x 68m
  const dx = ((p1.x - p2.x) / 100) * 105;
  const dy = ((p1.y - p2.y) / 100) * 68;
  return Math.hypot(dx, dy);
}

/**
 * Calcula conexões de passe entre jogadores próximos
 */
export function calculatePassConnections(
  players: PitchPlayerState[],
  maxDistanceMeters: number = 25,
): PassConnection[] {
  const connections: PassConnection[] = [];

  for (let i = 0; i < players.length; i++) {
    const p1 = players[i]!;
    for (let j = i + 1; j < players.length; j++) {
      const p2 = players[j]!;
      const distance = distanceInMeters(p1, p2);

      if (distance < maxDistanceMeters) {
        const strength = 1 - (distance / maxDistanceMeters);
        connections.push({
          fromId: p1.playerId,
          toId: p2.playerId,
          distance,
          strength,
        });
      }
    }
  }

  return connections;
}

/**
 * Calcula awareness espacial de cada jogador
 */
export function calculatePlayerAwareness(
  player: PitchPlayerState,
  teammates: PitchPlayerState[],
  opponents: PitchPlayerState[],
  tacticalRadius: TacticalRadius,
): PlayerAwareness {
  const visibleTeammates: string[] = [];
  const visibleOpponents: string[] = [];

  // Verifica teammates dentro do raio
  for (const teammate of teammates) {
    if (teammate.playerId === player.playerId) continue;
    const dist = distanceInMeters(player, teammate);
    if (dist <= tacticalRadius.radiusMeters) {
      visibleTeammates.push(teammate.playerId);
    }
  }

  // Verifica oponentes dentro do raio
  for (const opponent of opponents) {
    const dist = distanceInMeters(player, opponent);
    if (dist <= tacticalRadius.radiusMeters) {
      visibleOpponents.push(opponent.playerId);
    }
  }

  // Jogador isolado se tem menos de 2 teammates próximos
  const isIsolated = visibleTeammates.length < 2;

  // Qualidade do suporte: mais teammates próximos = melhor
  const supportQuality = Math.min(1, visibleTeammates.length / 4);

  return {
    playerId: player.playerId,
    visibleTeammates,
    visibleOpponents,
    isIsolated,
    supportQuality,
  };
}

/**
 * Encontra melhor opção de passe baseada em awareness
 */
export function findBestPassTarget(
  carrier: PitchPlayerState,
  teammates: PitchPlayerState[],
  opponents: PitchPlayerState[],
  awarenessMap: Map<string, PlayerAwareness>,
): PitchPlayerState | null {
  let bestTarget: PitchPlayerState | null = null;
  let bestScore = -1;

  for (const teammate of teammates) {
    if (teammate.playerId === carrier.playerId) continue;

    const awareness = awarenessMap.get(teammate.playerId);
    if (!awareness) continue;

    const dist = distanceInMeters(carrier, teammate);

    // Score baseado em:
    // - Proximidade (mais perto = melhor, mas não muito perto)
    // - Suporte tático (mais apoio = melhor)
    // - Não estar isolado
    // - Posição mais avançada (x maior)

    const proximityScore = dist > 5 && dist < 30 ? (1 - Math.abs(dist - 15) / 15) : 0;
    const supportScore = awareness.supportQuality;
    const isolationPenalty = awareness.isIsolated ? 0.5 : 1;
    const progressionBonus = (teammate.x - carrier.x) / 100; // Passe para frente

    const totalScore = (proximityScore * 0.4 + supportScore * 0.3 + progressionBonus * 0.3) * isolationPenalty;

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestTarget = teammate;
    }
  }

  return bestTarget;
}

/**
 * Calcula posição ideal para suporte tático
 */
export function calculateSupportPosition(
  player: PitchPlayerState,
  carrier: PitchPlayerState,
  targetDistanceMeters: number = 15,
): { x: number; y: number } {
  const dx = carrier.x - player.x;
  const dy = carrier.y - player.y;
  const currentDist = Math.hypot((dx / 100) * 105, (dy / 100) * 68);

  if (currentDist < 1) {
    // Muito próximo, manter posição
    return { x: player.x, y: player.y };
  }

  // Move em direção ao carrier mantendo distância ideal
  const targetDistCqw = (targetDistanceMeters / 105) * 100;
  const ratio = targetDistCqw / Math.hypot(dx, dy);

  return {
    x: carrier.x - dx * ratio,
    y: carrier.y - dy * ratio,
  };
}

/**
 * Identifica jogadores que devem pressionar juntos
 */
export function calculateCoordinatedPress(
  ballCarrier: PitchPlayerState,
  defenders: PitchPlayerState[],
  maxPressDistanceMeters: number = 20,
): string[] {
  const pressers: string[] = [];

  for (const defender of defenders) {
    const dist = distanceInMeters(defender, ballCarrier);
    if (dist <= maxPressDistanceMeters) {
      pressers.push(defender.playerId);
    }
  }

  return pressers;
}
