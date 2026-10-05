/**
 * GameSpiritInsight — Camada de leitura tática inteligente.
 *
 * Observa eventos do GameSpirit e produz frases curtas com autoridade narrativa,
 * como se fosse um comentarista elite lendo o jogo em tempo real.
 *
 * Não substitui a narrativa existente. Adiciona uma camada de inteligência
 * que aparece em momentos relevantes, mostrando causa e consequência.
 */

import type { SpiritContext, SpiritOutcome } from './types';
import type { CausalMatchEvent } from '@/match/causal/matchCausalTypes';
import type { PitchPlayerState } from '@/engine/types';
import { isBox, isCreationZone, isFinalThird } from '@/match/spatialZones';
import { L } from '@/i18n/L';

export interface TacticalInsight {
  /** Frase curta de leitura tática (1-2 linhas max) */
  text: string;
  /** Peso narrativo: low | medium | high */
  weight: 'low' | 'medium' | 'high';
  /** Tipo do insight para classificação */
  type: InsightType;
  /** Minuto do evento */
  minute: number;
  /** Jogador principal envolvido (se houver) */
  playerId?: string;
  /** Impacto emocional estimado (0-100) */
  emotionalImpact: number;
}

export type InsightType =
  | 'spatial_awareness'      // Leitura de espaço
  | 'pressure_reading'       // Leitura de pressão
  | 'momentum_shift'         // Mudança de domínio
  | 'tactical_error'         // Erro tático
  | 'decisive_moment'        // Momento decisivo
  | 'fatigue_impact'         // Impacto de fadiga
  | 'skill_execution'        // Execução de habilidade
  | 'counter_timing'         // Timing de contra-ataque
  | 'defensive_breakdown'    // Falha defensiva
  | 'creative_solution';     // Solução criativa

interface InsightContext {
  ctx: SpiritContext;
  outcome: SpiritOutcome;
  events: readonly CausalMatchEvent[];
  playerName?: string;
  onBall?: PitchPlayerState;
}

/**
 * Analisa o tick do GameSpirit e retorna insight tático se o momento for relevante.
 * Retorna null se o momento não merecer leitura especial.
 */
export function generateTacticalInsight(
  ctx: SpiritContext,
  outcome: SpiritOutcome,
): TacticalInsight | null {
  const ic: InsightContext = {
    ctx,
    outcome,
    events: outcome.causalEvents,
    playerName: ctx.onBall?.name,
    onBall: ctx.onBall,
  };

  // Prioridade: gol > defesa difícil > erro grave > mudança de domínio
  if (outcome.goalFor) {
    return analyzeGoal(ic);
  }

  const shotResult = outcome.causalEvents.find((e) => e.type === 'shot_result');
  if (shotResult) {
    const sr = shotResult.payload as { outcome: string };
    if (sr.outcome === 'save') {
      return analyzeSave(ic);
    }
    if (sr.outcome === 'block') {
      return analyzeBlock(ic);
    }
    if (sr.outcome === 'wide' || sr.outcome === 'miss_far') {
      return analyzeMiss(ic);
    }
  }

  const foul = outcome.causalEvents.find((e) => e.type === 'foul_committed');
  if (foul) {
    return analyzeFoul(ic);
  }

  const possessionChange = outcome.causalEvents.find((e) => e.type === 'possession_change');
  if (possessionChange && ctx.momentum) {
    const momentumSwing = Math.abs(ctx.momentum.home - ctx.momentum.away);
    if (momentumSwing > 0.4) {
      return analyzeMomentumShift(ic);
    }
  }

  const tackle = outcome.causalEvents.find((e) => e.type === 'interception');
  if (tackle) {
    return analyzeTackle(ic);
  }

  // Não gera insight para momentos comuns
  return null;
}

function analyzeGoal(ic: InsightContext): TacticalInsight {
  const { ctx, outcome } = ic;
  const isCounter = outcome.goalBuildUp === 'counter';
  const momentum = ctx.momentum?.home ?? 0;
  const fatigue = ctx.avgHomeFatigue;
  const zi = ctx.ballZoneInfo;
  const inBox = zi ? isBox(zi) : false;
  const inCreation = zi ? isCreationZone(zi) : false;

  // Leituras específicas por contexto
  const insights: Array<{ text: string; weight: 'low' | 'medium' | 'high'; impact: number }> = [];

  if (isCounter) {
    insights.push({
      text: L('O GameSpirit leu a transição antes da defesa reagir.', 'GameSpirit read the transition before the defence could react.'),
      weight: 'high',
      impact: 88,
    });
    insights.push({
      text: L('Esse gol nasceu da velocidade de decisão, não da sorte.', 'That goal came from speed of thought, not luck.'),
      weight: 'high',
      impact: 85,
    });
  } else if (inBox) {
    insights.push({
      text: L('A pressão abriu um corredor invisível dentro da área.', 'The pressure opened an invisible lane inside the box.'),
      weight: 'high',
      impact: 90,
    });
    insights.push({
      text: L('Esse gol começou três passes antes.', 'That goal started three passes earlier.'),
      weight: 'medium',
      impact: 82,
    });
  } else if (inCreation) {
    insights.push({
      text: L('O espaço apareceu porque a linha defensiva subiu meio segundo tarde.', 'The space opened because the back line stepped up half a second late.'),
      weight: 'high',
      impact: 86,
    });
  }

  if (momentum > 0.5) {
    insights.push({
      text: L('O time estava vencendo o campo antes de vencer o placar.', 'They were winning the pitch before they won the scoreline.'),
      weight: 'high',
      impact: 92,
    });
  } else if (momentum < -0.3) {
    insights.push({
      text: L('Esse gol não veio do domínio. Veio da frieza no momento certo.', "That goal didn't come from dominance. It came from composure at the right moment."),
      weight: 'high',
      impact: 89,
    });
  }

  if (fatigue > 72) {
    insights.push({
      text: L('A defesa atrasou meio segundo. Fadiga cobra seu preço.', 'The defence was half a second late. Fatigue takes its toll.'),
      weight: 'medium',
      impact: 78,
    });
  }

  if (ctx.onBall?.attributes) {
    const finishing = ctx.onBall.attributes.finalizacao ?? 50;
    const positioning = ctx.onBall.attributes.tatico ?? 50;
    if (finishing >= 85 && positioning >= 80) {
      insights.push({
        text: L('A finalização foi boa, mas a decisão de estar ali nasceu antes.', 'Good finish, but the decision to be there came earlier.'),
        weight: 'high',
        impact: 87,
      });
    }
  }

  // Fallback genérico forte
  if (insights.length === 0) {
    insights.push({
      text: L('Esse gol não foi acaso. Foi leitura de jogo.', 'That goal was no accident. It was reading the game.'),
      weight: 'medium',
      impact: 80,
    });
  }

  const chosen = insights[Math.floor(Math.random() * insights.length)]!;

  return {
    text: chosen.text,
    weight: chosen.weight,
    type: isCounter ? 'counter_timing' : inBox ? 'spatial_awareness' : 'decisive_moment',
    minute: ctx.minute,
    playerId: ctx.onBall?.playerId,
    emotionalImpact: chosen.impact,
  };
}

function analyzeSave(ic: InsightContext): TacticalInsight | null {
  const { ctx } = ic;
  const zi = ctx.ballZoneInfo;
  const inBox = zi ? isBox(zi) : false;
  const danger = zi ? isFinalThird(zi) : false;

  if (!danger) return null; // Defesa fácil não merece insight

  const insights: Array<{ text: string; weight: 'low' | 'medium' | 'high'; impact: number }> = [];

  if (inBox) {
    insights.push({
      text: L('O goleiro salvou mais que um chute. Salvou o momento emocional da partida.', 'The keeper saved more than a shot. He saved the momentum of the match.'),
      weight: 'high',
      impact: 85,
    });
    insights.push({
      text: L('Essa defesa não foi reflexo. Foi leitura antecipada da trajetória.', "That save wasn't reflex. The keeper read the flight early."),
      weight: 'high',
      impact: 83,
    });
  } else {
    insights.push({
      text: L('O goleiro fechou o ângulo antes do atacante decidir.', 'The keeper closed the angle before the striker could decide.'),
      weight: 'medium',
      impact: 75,
    });
  }

  const chosen = insights[Math.floor(Math.random() * insights.length)]!;

  return {
    text: chosen.text,
    weight: chosen.weight,
    type: 'decisive_moment',
    minute: ctx.minute,
    emotionalImpact: chosen.impact,
  };
}

function analyzeBlock(ic: InsightContext): TacticalInsight | null {
  const { ctx } = ic;
  const zi = ctx.ballZoneInfo;
  const inBox = zi ? isBox(zi) : false;

  if (!inBox) return null; // Bloqueio longe da área não é tão relevante

  const insights = [
    { text: L('A defesa leu a intenção do chute e se jogou no caminho.', 'The defence read the shot and threw themselves in the way.'), weight: 'medium' as const, impact: 72 },
    { text: L('Esse bloqueio nasceu de posicionamento, não de sorte.', 'That block came from positioning, not luck.'), weight: 'medium' as const, impact: 70 },
  ];

  const chosen = insights[Math.floor(Math.random() * insights.length)]!;

  return {
    text: chosen.text,
    weight: chosen.weight,
    type: 'defensive_breakdown',
    minute: ctx.minute,
    emotionalImpact: chosen.impact,
  };
}

function analyzeMiss(ic: InsightContext): TacticalInsight | null {
  const { ctx } = ic;
  const fatigue = ctx.avgHomeFatigue;
  const pressure = ctx.nearbyOpponentDist < 8;

  const insights: Array<{ text: string; weight: 'low' | 'medium' | 'high'; impact: number }> = [];

  if (fatigue > 75) {
    insights.push({
      text: L('Esse erro não foi técnico. Foi desgaste acumulado.', "That wasn't a technical error. It was accumulated fatigue."),
      weight: 'medium',
      impact: 68,
    });
  }

  if (pressure) {
    insights.push({
      text: L('A pressão tirou meio segundo de decisão. Foi o suficiente.', 'The pressure took away half a second. That was enough.'),
      weight: 'medium',
      impact: 65,
    });
  }

  if (insights.length === 0) return null;

  const chosen = insights[Math.floor(Math.random() * insights.length)]!;

  return {
    text: chosen.text,
    weight: chosen.weight,
    type: 'tactical_error',
    minute: ctx.minute,
    playerId: ctx.onBall?.playerId,
    emotionalImpact: chosen.impact,
  };
}

function analyzeFoul(ic: InsightContext): TacticalInsight | null {
  const { ctx, events } = ic;
  const foulEvent = events.find((e) => e.type === 'foul_committed');
  if (!foulEvent) return null;

  const payload = foulEvent.payload as { dangerous?: boolean; severity?: string };
  if (!payload.dangerous) return null; // Falta leve não merece insight

  const insights = [
    { text: L('A falta foi tática. Parar o contra-ataque valia o cartão.', 'A tactical foul. Stopping the counter was worth the card.'), weight: 'medium' as const, impact: 70 },
    { text: L('Esse erro não foi de técnica. Foi de desespero.', "That wasn't technique. It was desperation."), weight: 'medium' as const, impact: 72 },
  ];

  const chosen = insights[Math.floor(Math.random() * insights.length)]!;

  return {
    text: chosen.text,
    weight: chosen.weight,
    type: 'tactical_error',
    minute: ctx.minute,
    emotionalImpact: chosen.impact,
  };
}

function analyzeMomentumShift(ic: InsightContext): TacticalInsight | null {
  const { ctx } = ic;
  const momentum = ctx.momentum;
  if (!momentum) return null;

  const homeDominant = momentum.home > 0.4;
  const awayDominant = momentum.away > 0.4;

  if (!homeDominant && !awayDominant) return null;

  const insights = [
    { text: L('O time não acelerou por acaso. Sentiu fraqueza no lado oposto.', "They didn't speed up by chance. They sensed weakness on the other side."), weight: 'medium' as const, impact: 75 },
    { text: L('A mudança de ritmo não foi planejada. Foi lida no momento.', "The change of tempo wasn't planned. It was read in the moment."), weight: 'medium' as const, impact: 73 },
  ];

  const chosen = insights[Math.floor(Math.random() * insights.length)]!;

  return {
    text: chosen.text,
    weight: chosen.weight,
    type: 'momentum_shift',
    minute: ctx.minute,
    emotionalImpact: chosen.impact,
  };
}

function analyzeTackle(ic: InsightContext): TacticalInsight | null {
  const { ctx } = ic;
  const zi = ctx.ballZoneInfo;
  const dangerous = zi ? isFinalThird(zi) : false;

  if (!dangerous) return null; // Interceptação no meio-campo não é tão relevante

  const insights = [
    { text: L('A interceptação veio da leitura do passe, não da velocidade.', 'The interception came from reading the pass, not pace.'), weight: 'medium' as const, impact: 70 },
    { text: L('O defensor antecipou a jogada dois segundos antes.', 'The defender anticipated it two seconds early.'), weight: 'medium' as const, impact: 72 },
  ];

  const chosen = insights[Math.floor(Math.random() * insights.length)]!;

  return {
    text: chosen.text,
    weight: chosen.weight,
    type: 'spatial_awareness',
    minute: ctx.minute,
    emotionalImpact: chosen.impact,
  };
}
