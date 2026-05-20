/**
 * Inteligência Situacional do GameSpirit
 *
 * Dois sistemas que tornam as partidas mais surpreendentes:
 *
 * 1. ARCOS NARRATIVOS DINÂMICOS
 *    Detecta o "estado emocional" da partida e ajusta probabilidades.
 *    Ex: 0-0 aos 80' → drama máximo, mais chances de gol.
 *    Ex: goleada → adversário se fecha, menos gols.
 *    Ex: virada recente → time que virou fica confiante, outro fica vulnerável.
 *
 * 2. MEMÓRIA DE CURTO PRAZO (PRESSÃO ACUMULADA)
 *    Chutes consecutivos sem gol acumulam "pressão" que aumenta a chance
 *    do próximo chute entrar. Simula o efeito real de cerco ao gol.
 *    Gol sofrido deixa o time vulnerável por 2-3 minutos.
 */

export interface SituationalModifiers {
  /** Multiplicador sobre chance de gol (1.0 = neutro) */
  goalChanceMult: number;
  /** Multiplicador sobre chance de falta perigosa */
  foulChanceMult: number;
  /** Multiplicador sobre chance de pênalti (dado falta) */
  penaltyChanceMult: number;
  /** Boost de momentum para o time da casa */
  homeMomentumBoost: number;
  /** Boost de momentum para o visitante */
  awayMomentumBoost: number;
}

export interface MatchSituationInput {
  minute: number;
  homeScore: number;
  awayScore: number;
  /** Minutos desde o último gol (qualquer lado). null = nenhum gol ainda. */
  minutesSinceLastGoal: number | null;
  /** Chutes da casa sem gol consecutivos (reseta ao marcar). */
  homeShotsWithoutGoal: number;
  /** Chutes do visitante sem gol consecutivos. */
  awayShotsWithoutGoal: number;
  /** Último lado que marcou ('home' | 'away' | null). */
  lastGoalSide: 'home' | 'away' | null;
  /** Minuto do último gol. */
  lastGoalMinute: number | null;
}

// ── Arcos Narrativos ─────────────────────────────────────────────────────────

type NarrativeArc =
  | 'deadlock'       // 0-0 prolongado → tensão crescente
  | 'late_drama'     // placar apertado nos últimos 10 min
  | 'comeback'       // time perdendo acabou de marcar
  | 'blowout'        // goleada (3+ gols de diferença)
  | 'post_goal_rush' // 2 min após gol → vulnerabilidade
  | 'neutral';       // nenhum arco especial

function detectArc(input: MatchSituationInput): NarrativeArc {
  const { minute, homeScore, awayScore, lastGoalSide, lastGoalMinute } = input;
  const diff = Math.abs(homeScore - awayScore);
  const total = homeScore + awayScore;

  // Pós-gol: 2 minutos de vulnerabilidade
  if (lastGoalMinute != null && minute - lastGoalMinute <= 2) {
    return 'post_goal_rush';
  }

  // Goleada: 3+ gols de diferença
  if (diff >= 3) {
    return 'blowout';
  }

  // Comeback: time que estava perdendo acabou de empatar/virar
  if (lastGoalSide != null && lastGoalMinute != null && minute - lastGoalMinute <= 5) {
    const scorerWasLosing =
      (lastGoalSide === 'home' && homeScore <= awayScore) ||
      (lastGoalSide === 'away' && awayScore <= homeScore);
    if (scorerWasLosing) return 'comeback';
  }

  // Late drama: últimos 10 minutos com placar apertado (diff <= 1)
  if (minute >= 80 && diff <= 1) {
    return 'late_drama';
  }

  // Deadlock: 0-0 após minuto 60, ou empate sem gols há 20+ min
  if (homeScore === 0 && awayScore === 0 && minute >= 60) {
    return 'deadlock';
  }
  if (total > 0 && input.minutesSinceLastGoal != null && input.minutesSinceLastGoal >= 20 && diff <= 1) {
    return 'deadlock';
  }

  return 'neutral';
}

function arcModifiers(arc: NarrativeArc): Partial<SituationalModifiers> {
  switch (arc) {
    case 'deadlock':
      // Tensão crescente: mais chances de gol, mais faltas
      return { goalChanceMult: 1.35, foulChanceMult: 1.3, penaltyChanceMult: 1.2 };
    case 'late_drama':
      // Drama máximo: tudo aumenta
      return { goalChanceMult: 1.5, foulChanceMult: 1.4, penaltyChanceMult: 1.5 };
    case 'comeback':
      // Time que virou está confiante, adversário nervoso
      return { goalChanceMult: 1.25, foulChanceMult: 1.2, penaltyChanceMult: 1.1 };
    case 'post_goal_rush':
      // Vulnerabilidade pós-gol: chance de outro gol rápido
      return { goalChanceMult: 1.4, foulChanceMult: 1.1, penaltyChanceMult: 1.0 };
    case 'blowout':
      // Goleada: adversário se fecha, menos emoção
      return { goalChanceMult: 0.7, foulChanceMult: 0.8, penaltyChanceMult: 0.8 };
    case 'neutral':
    default:
      return {};
  }
}

// ── Pressão Acumulada ────────────────────────────────────────────────────────

function pressureModifiers(input: MatchSituationInput): Partial<SituationalModifiers> {
  // Chutes consecutivos sem gol acumulam pressão
  // A cada 2 chutes sem gol, +8% de chance no próximo
  const homePressure = Math.min(0.4, input.homeShotsWithoutGoal * 0.08);
  const awayPressure = Math.min(0.4, input.awayShotsWithoutGoal * 0.08);

  // O lado com mais pressão acumulada tem boost
  const goalBoost = 1 + Math.max(homePressure, awayPressure);

  return {
    goalChanceMult: goalBoost,
    homeMomentumBoost: homePressure * 0.3,
    awayMomentumBoost: awayPressure * 0.3,
  };
}

// ── API Pública ──────────────────────────────────────────────────────────────

const DEFAULT_MODIFIERS: SituationalModifiers = {
  goalChanceMult: 1.0,
  foulChanceMult: 1.0,
  penaltyChanceMult: 1.0,
  homeMomentumBoost: 0,
  awayMomentumBoost: 0,
};

/**
 * Calcula modificadores situacionais baseados no contexto da partida.
 * Combina arco narrativo + pressão acumulada.
 */
export function computeSituationalModifiers(input: MatchSituationInput): SituationalModifiers {
  const arc = detectArc(input);
  const arcMods = arcModifiers(arc);
  const pressMods = pressureModifiers(input);

  return {
    goalChanceMult: (arcMods.goalChanceMult ?? 1) * (pressMods.goalChanceMult ?? 1),
    foulChanceMult: arcMods.foulChanceMult ?? 1,
    penaltyChanceMult: arcMods.penaltyChanceMult ?? 1,
    homeMomentumBoost: pressMods.homeMomentumBoost ?? 0,
    awayMomentumBoost: pressMods.awayMomentumBoost ?? 0,
  };
}

/** Detecta o arco narrativo atual (para debug/UI). */
export function detectNarrativeArc(input: MatchSituationInput): string {
  return detectArc(input);
}
