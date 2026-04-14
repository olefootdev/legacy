import { olefootApiBase } from '@/gamespirit/admin/runtimeTruth';

export interface GameSpiritDecisionRequest {
  player: string;
  position: string;
  ballOwner: boolean;
  pressureLevel: string;
  nearbyPlayers: string[];
  objective: string;
}

export interface GameSpiritDecisionResponse {
  decision: string;
  confidence: number;
  narration: string;
}

export interface GameSpiritDecisionErr {
  error: string;
  status?: number;
}

/**
 * Chama o servidor OLEFOOT (OpenAI só no backend). Adequado para eventos discretos
 * (pré-pensamento, beat de narração), nunca por frame.
 */
export async function requestGameSpiritDecision(
  body: GameSpiritDecisionRequest,
): Promise<GameSpiritDecisionResponse | GameSpiritDecisionErr> {
  const base = olefootApiBase();
  try {
    const r = await fetch(`${base}/api/gamespirit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: body }),
    });
    const j = (await r.json()) as GameSpiritDecisionResponse & { error?: string };
    if (!r.ok || typeof j.error === 'string') {
      return { error: j.error ?? `HTTP ${r.status}`, status: r.status };
    }
    if (
      typeof j.decision !== 'string' ||
      typeof j.narration !== 'string' ||
      typeof j.confidence !== 'number'
    ) {
      return { error: 'Resposta do servidor em formato inesperado.', status: r.status };
    }
    return {
      decision: j.decision,
      confidence: j.confidence,
      narration: j.narration,
    };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : 'Sem ligação ao servidor (olefoot-server na porta 4000?).',
    };
  }
}
