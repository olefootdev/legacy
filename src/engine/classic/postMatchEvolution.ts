/**
 * Post-Match Evolution Engine — evolução baseada em eventos reais da partida.
 *
 * Analisa o eventFeed ao final da partida e calcula ganhos de atributos
 * específicos por jogador, baseado no TIPO de contribuição (não genérico).
 *
 * Integra com o sistema existente de evolução (playerEvolution.ts) — os
 * ganhos aqui se somam ao swing genérico do applyMatchPerformanceEvolution.
 */

import type { MatchEvent, ClassicPlayer } from './types';
import type { PlayerAttributes } from '@/entities/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PlayerEvolutionGain {
  playerId: number;
  playerName: string;
  gains: Partial<Record<keyof PlayerAttributes, number>>;
  reasons: string[];
}

// ─── Contribution Analysis ──────────────────────────────────────────────────

interface ContributionAccumulator {
  progressivePasses: number;
  chancesCreated: number;
  goalsScored: number;
  assists: number;
  shotsHighXG: number;
  interceptions: number;
  tacklesWon: number;
  savesDangerous: number;
  crossesCompleted: number;
  duelsWon: number;
  buildupPasses: number;
}

function emptyAccumulator(): ContributionAccumulator {
  return {
    progressivePasses: 0,
    chancesCreated: 0,
    goalsScored: 0,
    assists: 0,
    shotsHighXG: 0,
    interceptions: 0,
    tacklesWon: 0,
    savesDangerous: 0,
    crossesCompleted: 0,
    duelsWon: 0,
    buildupPasses: 0,
  };
}

// ─── Main Function ──────────────────────────────────────────────────────────

/**
 * Analisa o feed de eventos da partida e calcula evolução por jogador.
 *
 * @param eventFeed - Todos os eventos da partida (cronológico)
 * @param players - Estado final dos jogadores (com fatigue, onFire, etc.)
 * @param outcome - Resultado da partida para o time home
 * @returns Array de ganhos por jogador (só jogadores home evoluem)
 */
export function computeEventBasedEvolution(
  eventFeed: MatchEvent[],
  players: ClassicPlayer[],
  outcome: 'win' | 'draw' | 'loss',
): PlayerEvolutionGain[] {
  const homePlayers = players.filter(p => p.team === 'home');
  const accumulators = new Map<number, ContributionAccumulator>();

  // Inicializa acumuladores
  for (const p of homePlayers) {
    accumulators.set(p.id, emptyAccumulator());
  }

  // ─── Análise de eventos ─────────────────────────────────────────────────
  for (let i = 0; i < eventFeed.length; i++) {
    const evt = eventFeed[i];
    if (evt.team !== 'home') continue;
    const acc = accumulators.get(evt.playerId ?? -1);
    if (!acc) continue;

    switch (evt.type) {
      case 'pass': {
        // Passe progressivo: bola avançou significativamente
        const nextEvt = eventFeed[i + 1];
        if (nextEvt && nextEvt.team === 'home') {
          const progressX = evt.ballX - (players.find(p => p.id === evt.playerId)?.position.x ?? evt.ballX);
          if (Math.abs(progressX) > 60) {
            acc.progressivePasses++;
          } else {
            acc.buildupPasses++;
          }
        }
        // Assistência: passe que precede gol (até 2 eventos antes)
        const next1 = eventFeed[i + 1];
        const next2 = eventFeed[i + 2];
        if ((next1?.type === 'goal' && next1.team === 'home') ||
            (next2?.type === 'goal' && next2.team === 'home')) {
          acc.chancesCreated++;
          if (next1?.type === 'goal') acc.assists++;
        }
        break;
      }
      case 'cross': {
        // Cruzamento completado (se próximo evento é do mesmo time)
        const nextEvt = eventFeed[i + 1];
        if (nextEvt && nextEvt.team === 'home') {
          acc.crossesCompleted++;
        }
        // Assistência de cruzamento
        const next1 = eventFeed[i + 1];
        if (next1?.type === 'goal' && next1.team === 'home') {
          acc.assists++;
          acc.chancesCreated++;
        }
        break;
      }
      case 'goal': {
        acc.goalsScored++;
        // xG implícito: gol de dentro da área (ballX perto do gol)
        const isHighXG = evt.ballX > 480 || evt.ballX < 120; // perto do gol
        if (isHighXG) acc.shotsHighXG++;
        break;
      }
      case 'save': {
        // Defesa perigosa (GK do time home)
        const gk = homePlayers.find(p => p.role === 'GK');
        if (gk) {
          const gkAcc = accumulators.get(gk.id);
          if (gkAcc) gkAcc.savesDangerous++;
        }
        break;
      }
      case 'interception': {
        acc.interceptions++;
        break;
      }
      case 'tackle': {
        acc.tacklesWon++;
        break;
      }
      case 'duel': {
        acc.duelsWon++;
        break;
      }
    }
  }

  // ─── Calcular ganhos por jogador ────────────────────────────────────────
  const results: PlayerEvolutionGain[] = [];

  for (const p of homePlayers) {
    const acc = accumulators.get(p.id)!;
    const gains: Partial<Record<keyof PlayerAttributes, number>> = {};
    const reasons: string[] = [];

    // Modificadores globais
    const fatigueMultiplier = p.fatigue > 80 ? 0.5 : p.fatigue > 60 ? 0.75 : 1.0;
    const fireMultiplier = p.onFire ? 1.3 : 1.0;
    const outcomeMultiplier = outcome === 'win' ? 1.2 : outcome === 'loss' ? 0.8 : 1.0;
    const globalMod = fatigueMultiplier * fireMultiplier * outcomeMultiplier;

    // Passes progressivos → passe + tático
    if (acc.progressivePasses >= 3) {
      const gain = Math.min(0.20, acc.progressivePasses * 0.03) * globalMod;
      gains.passe = (gains.passe ?? 0) + gain;
      gains.tatico = (gains.tatico ?? 0) + gain * 0.5;
      reasons.push(`+${gain.toFixed(2)} Passe (${acc.progressivePasses} progressive passes)`);
    }

    // Chances criadas → passe + tático
    if (acc.chancesCreated >= 1) {
      const gain = Math.min(0.25, acc.chancesCreated * 0.08) * globalMod;
      gains.passe = (gains.passe ?? 0) + gain;
      gains.tatico = (gains.tatico ?? 0) + gain * 0.8;
      reasons.push(`+${gain.toFixed(2)} Tático (${acc.chancesCreated} chances created)`);
    }

    // Gols → finalização + mentalidade
    if (acc.goalsScored >= 1) {
      const gain = Math.min(0.30, acc.goalsScored * 0.15) * globalMod;
      gains.finalizacao = (gains.finalizacao ?? 0) + gain;
      gains.mentalidade = (gains.mentalidade ?? 0) + gain * 0.3;
      reasons.push(`+${gain.toFixed(2)} Finalização (${acc.goalsScored} goals)`);
    }

    // Chutes de alto xG → finalização
    if (acc.shotsHighXG >= 1) {
      const gain = Math.min(0.15, acc.shotsHighXG * 0.05) * globalMod;
      gains.finalizacao = (gains.finalizacao ?? 0) + gain;
      reasons.push(`+${gain.toFixed(2)} Finalização (${acc.shotsHighXG} shots from high xG)`);
    }

    // Interceptações → marcação + tático
    if (acc.interceptions >= 2) {
      const gain = Math.min(0.18, acc.interceptions * 0.04) * globalMod;
      gains.marcacao = (gains.marcacao ?? 0) + gain;
      gains.tatico = (gains.tatico ?? 0) + gain * 0.5;
      reasons.push(`+${gain.toFixed(2)} Marcação (${acc.interceptions} interceptions)`);
    }

    // Tackles → marcação + físico
    if (acc.tacklesWon >= 2) {
      const gain = Math.min(0.15, acc.tacklesWon * 0.04) * globalMod;
      gains.marcacao = (gains.marcacao ?? 0) + gain;
      gains.fisico = (gains.fisico ?? 0) + gain * 0.4;
      reasons.push(`+${gain.toFixed(2)} Marcação (${acc.tacklesWon} tackles won)`);
    }

    // Defesas perigosas (GK) → marcação (reflexo)
    if (acc.savesDangerous >= 1) {
      const gain = Math.min(0.25, acc.savesDangerous * 0.12) * globalMod;
      gains.marcacao = (gains.marcacao ?? 0) + gain;
      gains.mentalidade = (gains.mentalidade ?? 0) + gain * 0.4;
      reasons.push(`+${gain.toFixed(2)} Reflexo (${acc.savesDangerous} dangerous saves)`);
    }

    // Cruzamentos completados → passe + velocidade
    if (acc.crossesCompleted >= 2) {
      const gain = Math.min(0.12, acc.crossesCompleted * 0.04) * globalMod;
      gains.passe = (gains.passe ?? 0) + gain;
      gains.velocidade = (gains.velocidade ?? 0) + gain * 0.5;
      reasons.push(`+${gain.toFixed(2)} Passe (${acc.crossesCompleted} crosses completed)`);
    }

    // Duelos ganhos → físico + marcação
    if (acc.duelsWon >= 2) {
      const gain = Math.min(0.12, acc.duelsWon * 0.03) * globalMod;
      gains.fisico = (gains.fisico ?? 0) + gain;
      gains.marcacao = (gains.marcacao ?? 0) + gain * 0.5;
      reasons.push(`+${gain.toFixed(2)} Físico (${acc.duelsWon} duels won)`);
    }

    // Buildup passes (participação na construção) → tático
    if (acc.buildupPasses >= 5) {
      const gain = Math.min(0.10, acc.buildupPasses * 0.015) * globalMod;
      gains.tatico = (gains.tatico ?? 0) + gain;
      reasons.push(`+${gain.toFixed(2)} Tático (${acc.buildupPasses} buildup passes)`);
    }

    // Só adiciona se teve algum ganho
    if (reasons.length > 0) {
      results.push({ playerId: p.id, playerName: p.shortName, gains, reasons });
    }
  }

  // ─── Logs ───────────────────────────────────────────────────────────────
  const devMode = typeof import.meta !== 'undefined' && !!(import.meta as any).env?.DEV;
  if (devMode && results.length > 0) {
    console.info('[EVOLUTION] Post-match event-based evolution:');
    for (const r of results) {
      for (const reason of r.reasons) {
        console.info(`[EVOLUTION] ${r.playerName}: ${reason}`);
      }
    }
  }

  return results;
}
