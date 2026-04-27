// Stub no-op: cliente de agente para sessões de treino de Position Knowledge.

import type { PositionTrainingError } from './positionKnowledgeTypes';

export interface PositionTrainingSuccess {
  ok: true;
  legendSource: string;
  updatedWeights: Record<string, unknown>;
  updatedTraits: Record<string, unknown>;
  coachNotes?: string;
  narrative: string;
}

export type PositionTrainingResponse = PositionTrainingSuccess | PositionTrainingError;

export async function requestPositionTrainingSession(_payload: unknown): Promise<PositionTrainingResponse> {
  return { ok: false, error: 'Position training agent not implemented (stub).' };
}
