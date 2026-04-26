/**
 * GameSpirit Enhanced — Wrapper que adiciona insights táticos ao GameSpirit existente.
 *
 * Não modifica a lógica do GameSpirit.ts original.
 * Apenas observa os resultados e adiciona uma camada de leitura inteligente.
 */

import { gameSpiritTick, buildSpiritContext } from './GameSpirit';
import { generateTacticalInsight, type TacticalInsight } from './gameSpiritInsight';
import { MemorableMomentsCollector, type MemorableMoment } from './memorableMoments';
import type { SpiritContext, SpiritOutcome } from './types';

export interface EnhancedSpiritOutcome extends SpiritOutcome {
  /** Insight tático gerado para este tick (se houver) */
  tacticalInsight?: TacticalInsight;
}

/**
 * Wrapper do gameSpiritTick que adiciona insights táticos.
 * Mantém a mesma assinatura, apenas enriquece o resultado.
 */
export function gameSpiritTickEnhanced(
  ctx: SpiritContext,
  awayShort: string,
  causalSeqStart: number,
  nowMs: number = Date.now(),
  momentsCollector?: MemorableMomentsCollector,
): EnhancedSpiritOutcome {
  // Executa o GameSpirit normal
  const outcome = gameSpiritTick(ctx, awayShort, causalSeqStart, nowMs);

  // Gera insight tático se o momento for relevante
  const insight = generateTacticalInsight(ctx, outcome);

  // Se houver collector e insight, adiciona como candidato a momento memorável
  if (momentsCollector && insight) {
    const side = outcome.goalFor ?? ctx.possession;
    const playerName = ctx.onBall?.name;
    const currentScore = {
      home: ctx.homeScore + (outcome.goalFor === 'home' ? 1 : 0),
      away: ctx.awayScore + (outcome.goalFor === 'away' ? 1 : 0),
    };
    momentsCollector.addInsight(insight, side, playerName, currentScore);
  }

  return {
    ...outcome,
    tacticalInsight: insight ?? undefined,
  };
}

/**
 * Formata um insight tático para exibição no feed.
 * Retorna string formatada pronta para renderizar.
 */
export function formatInsightForFeed(insight: TacticalInsight): string {
  // Prefixo visual para destacar insights do GameSpirit
  const prefix = '🧠 GameSpirit:';
  return `${prefix} ${insight.text}`;
}

/**
 * Formata momentos memoráveis para exibição pós-jogo.
 */
export function formatMemorableMoments(moments: MemorableMoment[]): string {
  if (moments.length === 0) return '';

  const lines: string[] = ['', '═══ MOMENTOS MEMORÁVEIS ═══', ''];

  for (const moment of moments) {
    const emoji = getMomentEmoji(moment.type);
    const header = `${emoji} ${moment.minute}' — ${getMomentTypeLabel(moment.type)}`;
    const insight = `   ${moment.insight}`;
    const consequence = moment.consequence ? `   → ${moment.consequence}` : '';

    lines.push(header);
    lines.push(insight);
    if (consequence) lines.push(consequence);
    lines.push('');
  }

  return lines.join('\n');
}

function getMomentEmoji(type: MemorableMoment['type']): string {
  const emojiMap: Record<MemorableMoment['type'], string> = {
    impossible_goal: '⚡',
    crucial_save: '🧤',
    game_changing_error: '⚠️',
    momentum_reversal: '🔄',
    tactical_masterclass: '🎯',
    individual_brilliance: '✨',
    defensive_heroics: '🛡️',
    counter_strike: '⚔️',
    pressure_breakthrough: '💥',
    late_drama: '🔥',
  };
  return emojiMap[type] || '⭐';
}

function getMomentTypeLabel(type: MemorableMoment['type']): string {
  const labelMap: Record<MemorableMoment['type'], string> = {
    impossible_goal: 'Gol Improvável',
    crucial_save: 'Defesa Crucial',
    game_changing_error: 'Erro Decisivo',
    momentum_reversal: 'Virada de Momentum',
    tactical_masterclass: 'Jogada Tática Perfeita',
    individual_brilliance: 'Brilho Individual',
    defensive_heroics: 'Heroísmo Defensivo',
    counter_strike: 'Contra-Ataque Letal',
    pressure_breakthrough: 'Quebra de Pressão',
    late_drama: 'Drama Final',
  };
  return labelMap[type] || 'Momento Especial';
}

/**
 * Exporta as funções originais para compatibilidade.
 */
export { buildSpiritContext, gameSpiritTick };
export type { TacticalInsight, MemorableMoment };
export { MemorableMomentsCollector };
