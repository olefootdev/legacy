// Stub no-op para o subsistema "Position Knowledge" (treino de IA por DNA de lenda).
// Implementação real nunca foi escrita; este arquivo existe só para callsites compilarem.

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
  traits: Record<string, number>;
  sessionsCompleted: number;
  lastTrainedAt: string;
  coachNotes?: string;
}

export interface PositionTrainingError {
  ok: false;
  error: string;
}

export function applyPositionKnowledgeBias<T>(base: T, _knowledge: unknown, _zone: unknown): T {
  return base;
}

export function evolvePositionKnowledgePostMatch(
  knowledge: PositionKnowledge | undefined,
  _outcome: unknown,
  _action: unknown,
  _zone: unknown,
): PositionKnowledge | undefined {
  return knowledge;
}
