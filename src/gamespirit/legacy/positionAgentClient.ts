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

export interface PositionTrainingPayload {
  posCode: string;
  legendId?: string;
  topic: string;
  playerContext?: {
    name?: string;
    ovr?: number;
    behavior?: string;
    sessionsCompleted?: number;
    coachNotes?: string;
  };
  recentResults?: Array<{ outcome: string; rating: number }>;
  knowledgeContext?: string;
}

const SERVER_BASE = import.meta.env?.VITE_SERVER_URL ?? 'http://localhost:4000';

export async function requestPositionTrainingSession(
  payload: PositionTrainingPayload,
): Promise<PositionTrainingResponse> {
  try {
    const res = await fetch(`${SERVER_BASE}/api/position-coach/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as Record<string, unknown>;
      return { ok: false, error: (err['error'] as string | undefined) ?? `HTTP ${res.status}` };
    }

    const data = await res.json() as {
      ok: boolean;
      legendSource?: string;
      updatedWeights?: Record<string, unknown>;
      updatedTraits?: Record<string, unknown>;
      coachNotes?: string;
      narrative?: string;
      error?: string;
    };

    if (!data.ok) {
      return { ok: false, error: data.error ?? 'Resposta inválida do servidor.' };
    }

    return {
      ok: true,
      legendSource: data.legendSource ?? payload.legendId ?? payload.posCode.toLowerCase(),
      updatedWeights: data.updatedWeights ?? {},
      updatedTraits: data.updatedTraits ?? {},
      coachNotes: data.coachNotes,
      narrative: data.narrative ?? '',
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro de rede.' };
  }
}

/** Verifica se o servidor de position coach está disponível. */
export async function checkPositionCoachStatus(): Promise<{ available: boolean; model?: string }> {
  try {
    const res = await fetch(`${SERVER_BASE}/api/position-coach/status`);
    if (!res.ok) return { available: false };
    const data = await res.json() as { ok?: boolean; model?: string; anthropicConfigured?: boolean };
    return { available: !!(data.ok && data.anthropicConfigured), model: data.model };
  } catch {
    return { available: false };
  }
}
