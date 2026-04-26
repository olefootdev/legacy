/**
 * Momentos Memoráveis — Sistema de seleção dos 3-5 eventos mais marcantes da partida.
 *
 * A partida não precisa narrar tudo perfeitamente. Ela precisa gerar momentos
 * que o jogador vai lembrar. Este módulo seleciona os eventos com maior peso
 * narrativo e impacto emocional.
 */

import type { TacticalInsight } from './gameSpiritInsight';
import type { PossessionSide } from '@/engine/types';

export interface MemorableMoment {
  /** Tipo do momento */
  type: MomentType;
  /** Minuto do evento */
  minute: number;
  /** Jogador principal envolvido */
  playerId?: string;
  playerName?: string;
  /** Lado que protagonizou o momento */
  side: PossessionSide;
  /** Impacto emocional (0-100) */
  emotionalImpact: number;
  /** Frase curta do GameSpirit sobre o momento */
  insight: string;
  /** Peso narrativo: low | medium | high */
  narrativeWeight: 'low' | 'medium' | 'high';
  /** Consequência percebida no jogo */
  consequence?: string;
  /** Placar no momento do evento */
  score: { home: number; away: number };
}

export type MomentType =
  | 'impossible_goal'        // Gol improvável
  | 'crucial_save'           // Defesa crucial
  | 'game_changing_error'    // Erro que mudou o jogo
  | 'momentum_reversal'      // Virada de momentum
  | 'tactical_masterclass'   // Jogada tática perfeita
  | 'individual_brilliance'  // Brilho individual
  | 'defensive_heroics'      // Heroísmo defensivo
  | 'counter_strike'         // Contra-ataque letal
  | 'pressure_breakthrough'  // Quebra de pressão
  | 'late_drama';            // Drama nos minutos finais

interface MomentCandidate {
  moment: MemorableMoment;
  score: number; // Pontuação para seleção (0-100)
}

/**
 * Acumulador de momentos candidatos durante a partida.
 * Mantém todos os insights gerados e seleciona os melhores ao final.
 */
export class MemorableMomentsCollector {
  private candidates: MomentCandidate[] = [];
  private currentScore = { home: 0, away: 0 };

  /**
   * Adiciona um insight como candidato a momento memorável.
   */
  addInsight(
    insight: TacticalInsight,
    side: PossessionSide,
    playerName: string | undefined,
    currentScore: { home: number; away: number },
  ): void {
    this.currentScore = currentScore;

    const momentType = this.classifyMomentType(insight, currentScore);
    const consequence = this.inferConsequence(insight, currentScore);

    const moment: MemorableMoment = {
      type: momentType,
      minute: insight.minute,
      playerId: insight.playerId,
      playerName,
      side,
      emotionalImpact: insight.emotionalImpact,
      insight: insight.text,
      narrativeWeight: insight.weight,
      consequence,
      score: { ...currentScore },
    };

    const score = this.calculateMomentScore(moment, insight);

    this.candidates.push({ moment, score });
  }

  /**
   * Retorna os 3-5 momentos mais memoráveis da partida.
   * Usa algoritmo de seleção que evita redundância e prioriza variedade.
   */
  selectTopMoments(): MemorableMoment[] {
    if (this.candidates.length === 0) return [];

    // Ordena por score decrescente
    const sorted = [...this.candidates].sort((a, b) => b.score - a.score);

    const selected: MemorableMoment[] = [];
    const usedTypes = new Set<MomentType>();
    const usedMinutes = new Set<number>();

    for (const candidate of sorted) {
      if (selected.length >= 5) break;

      const { moment } = candidate;

      // Evita momentos muito próximos no tempo (min 3 minutos de distância)
      const tooClose = Array.from(usedMinutes).some((m) => Math.abs(m - moment.minute) < 3);
      if (tooClose && selected.length >= 3) continue;

      // Prioriza variedade de tipos (mas permite duplicatas se score muito alto)
      if (usedTypes.has(moment.type) && candidate.score < 85 && selected.length >= 3) continue;

      selected.push(moment);
      usedTypes.add(moment.type);
      usedMinutes.add(moment.minute);
    }

    // Garante mínimo de 3 momentos se houver candidatos suficientes
    if (selected.length < 3 && this.candidates.length >= 3) {
      for (const candidate of sorted) {
        if (selected.length >= 3) break;
        if (!selected.includes(candidate.moment)) {
          selected.push(candidate.moment);
        }
      }
    }

    // Ordena por minuto (cronológico)
    return selected.sort((a, b) => a.minute - b.minute);
  }

  /**
   * Classifica o tipo de momento baseado no insight e contexto.
   */
  private classifyMomentType(
    insight: TacticalInsight,
    score: { home: number; away: number },
  ): MomentType {
    const isLateGame = insight.minute >= 75;
    const isCloseGame = Math.abs(score.home - score.away) <= 1;

    // Gols
    if (insight.type === 'counter_timing') {
      return 'counter_strike';
    }
    if (insight.type === 'decisive_moment' && insight.emotionalImpact >= 85) {
      return isLateGame && isCloseGame ? 'late_drama' : 'impossible_goal';
    }
    if (insight.type === 'spatial_awareness' && insight.emotionalImpact >= 85) {
      return 'tactical_masterclass';
    }

    // Defesas
    if (insight.type === 'decisive_moment' && insight.text.includes('goleiro')) {
      return isLateGame ? 'late_drama' : 'crucial_save';
    }

    // Erros
    if (insight.type === 'tactical_error' && insight.emotionalImpact >= 70) {
      return 'game_changing_error';
    }

    // Mudanças de momentum
    if (insight.type === 'momentum_shift') {
      return 'momentum_reversal';
    }

    // Defesa
    if (insight.type === 'defensive_breakdown' || insight.text.includes('defesa')) {
      return 'defensive_heroics';
    }

    // Pressão
    if (insight.type === 'pressure_reading') {
      return 'pressure_breakthrough';
    }

    // Habilidade individual
    if (insight.type === 'skill_execution') {
      return 'individual_brilliance';
    }

    // Fallback
    return isLateGame ? 'late_drama' : 'tactical_masterclass';
  }

  /**
   * Infere a consequência do momento no jogo.
   */
  private inferConsequence(
    insight: TacticalInsight,
    score: { home: number; away: number },
  ): string | undefined {
    const isLateGame = insight.minute >= 75;
    const isCloseGame = Math.abs(score.home - score.away) <= 1;

    if (insight.type === 'decisive_moment' && insight.emotionalImpact >= 85) {
      if (isLateGame && isCloseGame) {
        return 'Momento decisivo da partida';
      }
      return 'Virada emocional do jogo';
    }

    if (insight.type === 'momentum_shift') {
      return 'Mudança de domínio da partida';
    }

    if (insight.type === 'tactical_error' && insight.emotionalImpact >= 70) {
      return 'Erro que custou caro';
    }

    if (insight.type === 'counter_timing') {
      return 'Transição letal';
    }

    if (insight.text.includes('goleiro') && insight.emotionalImpact >= 80) {
      return 'Defesa que salvou o resultado';
    }

    return undefined;
  }

  /**
   * Calcula score de relevância do momento (0-100).
   * Considera: impacto emocional, fase do jogo, placar, raridade.
   */
  private calculateMomentScore(moment: MemorableMoment, insight: TacticalInsight): number {
    let score = moment.emotionalImpact; // Base: 0-100

    // Peso narrativo
    if (moment.narrativeWeight === 'high') score += 15;
    else if (moment.narrativeWeight === 'medium') score += 8;

    // Fase do jogo (minutos finais valem mais)
    if (moment.minute >= 80) score += 12;
    else if (moment.minute >= 70) score += 8;
    else if (moment.minute <= 15) score += 5; // Início também é relevante

    // Placar apertado aumenta relevância
    const scoreDiff = Math.abs(moment.score.home - moment.score.away);
    if (scoreDiff === 0) score += 10;
    else if (scoreDiff === 1) score += 6;

    // Tipos raros valem mais
    const rareTypes: MomentType[] = [
      'impossible_goal',
      'game_changing_error',
      'late_drama',
      'individual_brilliance',
    ];
    if (rareTypes.includes(moment.type)) score += 8;

    // Gols sempre têm peso extra
    if (insight.type === 'decisive_moment' || insight.type === 'counter_timing') {
      score += 10;
    }

    return Math.min(100, score);
  }

  /**
   * Retorna estatísticas dos momentos coletados.
   */
  getStats(): {
    totalCandidates: number;
    avgEmotionalImpact: number;
    highImpactCount: number;
  } {
    if (this.candidates.length === 0) {
      return { totalCandidates: 0, avgEmotionalImpact: 0, highImpactCount: 0 };
    }

    const avgImpact =
      this.candidates.reduce((sum, c) => sum + c.moment.emotionalImpact, 0) /
      this.candidates.length;

    const highImpact = this.candidates.filter((c) => c.moment.emotionalImpact >= 80).length;

    return {
      totalCandidates: this.candidates.length,
      avgEmotionalImpact: Math.round(avgImpact),
      highImpactCount: highImpact,
    };
  }

  /**
   * Limpa todos os candidatos (útil para reset entre partidas).
   */
  clear(): void {
    this.candidates = [];
    this.currentScore = { home: 0, away: 0 };
  }
}
