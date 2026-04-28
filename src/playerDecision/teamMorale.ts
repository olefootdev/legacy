/**
 * Sprint L5 — Moral coletiva da equipa.
 * Estado emocional do time como um todo, derivado do contexto da partida.
 * Influencia decisões individuais (passe, chute, agressividade) sem alterar atributos.
 */

export interface TeamMoraleState {
  /** 0-100 — nível geral de confiança coletiva. 50 = neutro. */
  confidence: number;
  /** -1..+1 — momentum recente. Positivo = embalado, negativo = abalado. */
  momentum: number;
  /** 0-100 — pressão psicológica do contexto (minute × scoreDelta × stakes). */
  pressure: number;
  /** Rótulo qualitativo pra UI/debug. */
  label: 'embalado' | 'confiante' | 'estável' | 'tenso' | 'abalado';
}

export interface TeamMoraleInputs {
  /** Diferença de placar do ponto de vista deste time. +1 = ganhando por 1. */
  scoreDelta: number;
  /** Minuto atual da partida (0-90+). */
  minute: number;
  /** Momentum narrativo do GameSpirit, se disponível (-1 a +1). */
  spiritMomentum?: number;
  /** Fadiga média dos titulares 0-100 (mais alta = mais cansaço). */
  avgFatigue?: number;
  /** Time tem a posse agora? */
  hasPossession?: boolean;
  /** Se o jogo é decisivo (final, mata-mata, etc.) — amplia pressão. */
  isFinal?: boolean;
  /** Cartões vermelhos sofridos (afetam negativamente). */
  redCardsAgainst?: number;
}

/**
 * Calcula moral coletiva a partir do estado da partida.
 * Cheap O(1) — chamar a cada N ticks (ex: a cada minuto simulado).
 */
export function deriveTeamMorale(input: TeamMoraleInputs): TeamMoraleState {
  const {
    scoreDelta,
    minute,
    spiritMomentum = 0,
    avgFatigue = 30,
    hasPossession = false,
    isFinal = false,
    redCardsAgainst = 0,
  } = input;

  // ── Confidence baseline ──
  // Cada gol de vantagem = +8. Cada gol perdido = -8.
  let confidence = 50 + scoreDelta * 8;

  // Late game stakes amplifica delta
  if (minute >= 75) {
    confidence += scoreDelta * 4; // dobro do peso nos últimos 15min
  }
  if (isFinal) {
    confidence += scoreDelta * 3; // jogo decisivo amplifica
  }

  // Momentum recente (fluxo do jogo)
  confidence += spiritMomentum * 6;

  // Cansaço drena moral
  confidence -= avgFatigue / 10;

  // Cartão vermelho é golpe psicológico
  confidence -= redCardsAgainst * 12;

  // Possessão dá leve confidence boost
  if (hasPossession) confidence += 2;

  confidence = Math.max(5, Math.min(95, Math.round(confidence)));

  // ── Pressure ──
  // Minute × scoreDelta crítico × stakes
  let pressure = 30;
  if (Math.abs(scoreDelta) <= 1 && minute >= 70) {
    pressure += 25; // jogo apertado nos finais
  }
  if (scoreDelta < 0 && minute >= 80) {
    pressure += 20; // perdendo nos minutos finais
  }
  if (isFinal) pressure += 15;
  pressure = Math.max(10, Math.min(95, Math.round(pressure)));

  // ── Label qualitativo ──
  let label: TeamMoraleState['label'];
  if (confidence >= 75) label = 'embalado';
  else if (confidence >= 60) label = 'confiante';
  else if (confidence >= 40) label = 'estável';
  else if (confidence >= 25) label = 'tenso';
  else label = 'abalado';

  return {
    confidence,
    momentum: spiritMomentum,
    pressure,
    label,
  };
}

/**
 * Multiplicador de execução baseado em moral. Aplicado em pass success,
 * shot accuracy, drible — modula performance individual via fator coletivo.
 *
 * Faixas:
 *   confidence 50 (neutro) → mul 1.00
 *   confidence 80          → mul 1.06
 *   confidence 20          → mul 0.93
 */
export function moraleExecutionMultiplier(morale: TeamMoraleState): number {
  return 1 + ((morale.confidence - 50) / 100) * 0.18;
}

/**
 * Bias de risco. Time abalado tende a chutar de qualquer ângulo (desespero).
 * Time embalado mantém compostura, joga simples.
 *
 * Retorna { shootBoost, holdBallBoost } pra aplicar como macroTilt no OnBallDecision.
 */
export function moraleRiskBias(morale: TeamMoraleState): {
  shootBoost: number;
  holdBallBoost: number;
} {
  const c = morale.confidence;
  if (c < 25) {
    // Abalado: chute desesperado, alta probabilidade de erros
    return { shootBoost: 0.18, holdBallBoost: -0.08 };
  }
  if (c < 40) {
    // Tenso: alguma pressa
    return { shootBoost: 0.08, holdBallBoost: -0.04 };
  }
  if (c >= 75) {
    // Embalado: confiança pra ousar mais
    return { shootBoost: 0.08, holdBallBoost: 0.06 };
  }
  return { shootBoost: 0, holdBallBoost: 0 };
}
