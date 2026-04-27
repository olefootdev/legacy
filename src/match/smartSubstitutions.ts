/**
 * Sistema de Substituições Inteligentes — Fase 3 Polish #4
 * Sugestões automáticas baseadas em contexto (fadiga, tático, momentum).
 */

import type { PitchPlayerState } from '@/engine/types';
import type { PlayerEntity } from '@/entities/types';

export type SubstitutionReason = 'fatigue' | 'tactical' | 'injury' | 'momentum';
export type SubstitutionUrgency = 'low' | 'medium' | 'high';

export interface SubstitutionSuggestion {
  id: string;
  minute: number;
  reason: SubstitutionReason;
  playerOut: PitchPlayerState;
  playerIn: PlayerEntity;
  impact: {
    attack: number; // -5 a +5
    defense: number;
    energy: number;
  };
  urgency: SubstitutionUrgency;
  narrative: string;
}

/** Calcula impacto da substituição nos atributos do time */
function calculateSubstitutionImpact(
  playerOut: PitchPlayerState,
  playerIn: PlayerEntity,
): { attack: number; defense: number; energy: number } {
  const outAttrs = playerOut.attributes;
  const inAttrs = playerIn.attrs;

  // Ataque: média de finalização, drible, passe
  const outAttack = ((outAttrs?.finalizacao ?? 50) + (outAttrs?.drible ?? 50) + (outAttrs?.passe ?? 50)) / 3;
  const inAttack = ((inAttrs?.finalizacao ?? 50) + (inAttrs?.drible ?? 50) + (inAttrs?.passe ?? 50)) / 3;
  const attackDiff = Math.round((inAttack - outAttack) / 10); // -5 a +5

  // Defesa: média de marcação, tático, físico
  const outDefense = ((outAttrs?.marcacao ?? 50) + (outAttrs?.tatico ?? 50) + (outAttrs?.fisico ?? 50)) / 3;
  const inDefense = ((inAttrs?.marcacao ?? 50) + (inAttrs?.tatico ?? 50) + (inAttrs?.fisico ?? 50)) / 3;
  const defenseDiff = Math.round((inDefense - outDefense) / 10);

  // Energia: fadiga vs frescor
  const outEnergy = 100 - playerOut.fatigue;
  const inEnergy = 100; // substituto entra fresco
  const energyDiff = Math.round((inEnergy - outEnergy) / 20);

  return {
    attack: Math.max(-5, Math.min(5, attackDiff)),
    defense: Math.max(-5, Math.min(5, defenseDiff)),
    energy: Math.max(-5, Math.min(5, energyDiff)),
  };
}

/** Detecta sugestões de substituição por fadiga */
export function detectFatigueSuggestions(
  pitchPlayers: PitchPlayerState[],
  bench: PlayerEntity[],
  minute: number,
): SubstitutionSuggestion[] {
  const suggestions: SubstitutionSuggestion[] = [];

  for (const player of pitchPlayers) {
    // Fadiga crítica (>75)
    if (player.fatigue > 75) {
      // Busca substituto na mesma posição
      const replacement = bench.find(p => p.pos === player.role);
      if (!replacement) continue;

      const impact = calculateSubstitutionImpact(player, replacement);
      const urgency: SubstitutionUrgency = player.fatigue > 85 ? 'high' : 'medium';

      suggestions.push({
        id: `fatigue_${player.playerId}_${minute}`,
        minute,
        reason: 'fatigue',
        playerOut: player,
        playerIn: replacement,
        impact,
        urgency,
        narrative: `${player.name} está exausto (${Math.round(player.fatigue)}% fadiga). Trocar por ${replacement.name}?`,
      });
    }
  }

  return suggestions;
}

/** Detecta sugestões táticas baseadas no placar */
export function detectTacticalSuggestions(
  pitchPlayers: PitchPlayerState[],
  bench: PlayerEntity[],
  minute: number,
  scoreDiff: number,
): SubstitutionSuggestion[] {
  const suggestions: SubstitutionSuggestion[] = [];

  // Perdendo após 65': trocar defensor por atacante
  if (scoreDiff < 0 && minute >= 65) {
    const defender = pitchPlayers.find(p => p.role === 'def');
    const attacker = bench.find(p => p.pos === 'ATA' || p.pos === 'attack');

    if (defender && attacker) {
      const impact = calculateSubstitutionImpact(defender, attacker);
      impact.attack += 2; // bônus tático
      impact.defense -= 2; // penalidade tática

      suggestions.push({
        id: `tactical_attack_${minute}`,
        minute,
        reason: 'tactical',
        playerOut: defender,
        playerIn: attacker,
        impact,
        urgency: scoreDiff < -1 ? 'high' : 'medium',
        narrative: `Perdendo ${Math.abs(scoreDiff)}-0. Trocar ${defender.name} (DEF) por ${attacker.name} (ATA) para buscar o gol?`,
      });
    }
  }

  // Vencendo por 1 após 75': trocar atacante por defensor
  if (scoreDiff === 1 && minute >= 75) {
    const attacker = pitchPlayers.find(p => p.role === 'attack');
    const defender = bench.find(p => p.pos === 'ZAG' || p.pos === 'def');

    if (attacker && defender) {
      const impact = calculateSubstitutionImpact(attacker, defender);
      impact.defense += 2; // bônus tático
      impact.attack -= 2; // penalidade tática

      suggestions.push({
        id: `tactical_defend_${minute}`,
        minute,
        reason: 'tactical',
        playerOut: attacker,
        playerIn: defender,
        impact,
        urgency: 'medium',
        narrative: `Vencendo por 1. Trocar ${attacker.name} (ATA) por ${defender.name} (DEF) para segurar o resultado?`,
      });
    }
  }

  return suggestions;
}

/** Detecta sugestões baseadas em momentum negativo */
export function detectMomentumSuggestions(
  pitchPlayers: PitchPlayerState[],
  bench: PlayerEntity[],
  minute: number,
  momentum: { home: number; away: number },
): SubstitutionSuggestion[] {
  const suggestions: SubstitutionSuggestion[] = [];

  // Momentum muito baixo (<30) e perdendo
  if (momentum.home < 30) {
    // Busca jogador com melhor overall no banco
    const bestBench = bench
      .map(p => ({
        player: p,
        overall: (p.attrs?.finalizacao ?? 50 + p.attrs?.passe ?? 50 + p.attrs?.drible ?? 50) / 3,
      }))
      .sort((a, b) => b.overall - a.overall)[0];

    // Busca jogador com pior performance em campo
    const worstPitch = pitchPlayers
      .map(p => ({
        player: p,
        performance: 100 - p.fatigue + (p.attributes?.finalizacao ?? 50),
      }))
      .sort((a, b) => a.performance - b.performance)[0];

    if (bestBench && worstPitch) {
      const impact = calculateSubstitutionImpact(worstPitch.player, bestBench.player);

      suggestions.push({
        id: `momentum_${minute}`,
        minute,
        reason: 'momentum',
        playerOut: worstPitch.player,
        playerIn: bestBench.player,
        impact,
        urgency: 'medium',
        narrative: `Time sufocado! Trocar ${worstPitch.player.name} por ${bestBench.player.name} para mudar o jogo?`,
      });
    }
  }

  return suggestions;
}

/** Detecta todas as sugestões de substituição */
export function detectAllSubstitutionSuggestions(
  pitchPlayers: PitchPlayerState[],
  bench: PlayerEntity[],
  minute: number,
  scoreDiff: number,
  momentum: { home: number; away: number },
): SubstitutionSuggestion[] {
  const fatigue = detectFatigueSuggestions(pitchPlayers, bench, minute);
  const tactical = detectTacticalSuggestions(pitchPlayers, bench, minute, scoreDiff);
  const momentumSugs = detectMomentumSuggestions(pitchPlayers, bench, minute, momentum);

  // Prioriza por urgência
  return [...fatigue, ...tactical, ...momentumSugs]
    .sort((a, b) => {
      const urgencyOrder = { high: 3, medium: 2, low: 1 };
      return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
    })
    .slice(0, 3); // máximo 3 sugestões por vez
}
