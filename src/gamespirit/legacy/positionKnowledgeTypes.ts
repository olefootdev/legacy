export type PositionActionKey = string;
export type KnowledgeZoneKey = string;

export interface PositionKnowledgeActionWeight {
  weight: number;
  bias?: number;
}

export interface PositionKnowledge {
  posCode: string;
  legendSource: string;
  actionWeights: Record<string, PositionKnowledgeActionWeight>;
  traits: {
    pressIntensity: number;
    offensiveRuns: number;
    riskTaking: number;
    buildUpPreference: number;
    defensiveCompactness?: number;
  };
  sessionsCompleted: number;
  lastTrainedAt: string;
  coachNotes?: string;
}

export interface PositionTrainingError {
  ok: false;
  error: string;
}

/**
 * Aplica os pesos de posição da lenda sobre a ação base proposta pelo GameSpirit.
 * Usa os actionWeights para calcular qual ação tem maior score ponderado.
 * Se nenhum peso relevante existir, retorna a ação base intacta.
 */
export function applyPositionKnowledgeBias<T extends string>(
  base: T,
  knowledge: PositionKnowledge,
  _zone: KnowledgeZoneKey,
): T {
  const weights = knowledge.actionWeights;
  if (!weights || Object.keys(weights).length === 0) return base;

  // Mapeamento de ações do GameSpirit para chaves de actionWeights
  const ACTION_MAP: Record<string, string[]> = {
    progress:  ['pass_progressive', 'carry', 'dribble_risk', 'through_ball'],
    recycle:   ['pass_safe', 'clearance', 'hold'],
    shoot:     ['shoot'],
    cross:     ['cross'],
    dribble:   ['dribble_risk'],
    clear:     ['clearance'],
  };

  const candidates = ACTION_MAP[base as string];
  if (!candidates) return base;

  // Score da ação base
  const baseScore = candidates.reduce((sum, k) => sum + (weights[k]?.weight ?? 1.0), 0) / candidates.length;

  // Verifica se alguma ação alternativa tem score significativamente maior (>15%)
  const alternatives: Array<{ action: T; score: number }> = [];
  for (const [action, keys] of Object.entries(ACTION_MAP)) {
    if (action === (base as string)) continue;
    const score = keys.reduce((sum, k) => sum + (weights[k]?.weight ?? 1.0), 0) / keys.length;
    alternatives.push({ action: action as T, score });
  }

  alternatives.sort((a, b) => b.score - a.score);
  const best = alternatives[0];

  // Só substitui se a alternativa for >15% melhor E o knowledge tiver sessões suficientes
  const sessionFactor = Math.min(1, knowledge.sessionsCompleted / 5);
  if (best && best.score > baseScore * (1 + 0.15 * sessionFactor)) {
    return best.action;
  }

  return base;
}

/**
 * Evolui o PositionKnowledge pós-partida de forma determinística.
 * Ajusta actionWeights com base no outcome e na ação dominante do jogador.
 * Deltas pequenos: +0.02 por evento positivo, -0.01 por erro.
 */
export function evolvePositionKnowledgePostMatch(
  knowledge: PositionKnowledge,
  outcome: 'win' | 'draw' | 'loss',
  action: PositionActionKey,
  zone: KnowledgeZoneKey,
): PositionKnowledge {
  const weights = { ...knowledge.actionWeights };

  // Delta base por outcome
  const outcomeDelta = outcome === 'win' ? 0.02 : outcome === 'loss' ? -0.01 : 0.005;

  // Reforça o peso da ação dominante desta partida
  if (weights[action]) {
    const current = weights[action]!.weight;
    const delta = outcomeDelta + (zone === 'att' || zone === 'def' ? 0.01 : 0);
    weights[action] = {
      weight: Math.max(0.5, Math.min(2.0, current + delta)),
      bias: weights[action]!.bias,
    };
  } else {
    // Ação nova — inicializa com peso neutro + delta
    weights[action] = { weight: Math.max(0.5, 1.0 + outcomeDelta), bias: 0 };
  }

  // Decaimento suave nos outros pesos para evitar inflação ilimitada
  for (const key of Object.keys(weights)) {
    if (key === action) continue;
    const w = weights[key]!;
    weights[key] = {
      ...w,
      weight: Math.max(0.5, Math.min(2.0, w.weight * 0.998)),
    };
  }

  return {
    ...knowledge,
    actionWeights: weights,
    sessionsCompleted: knowledge.sessionsCompleted + 1,
    lastTrainedAt: new Date().toISOString(),
  };
}
