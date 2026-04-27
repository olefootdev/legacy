import { olefootApiBase } from '@/gamespirit/admin/runtimeTruth';
import { isFeatureEnabled } from '@/admin/platformConfigStore';

export interface GameSpiritDecisionRequest {
  player: string;
  position: string;
  ballOwner: boolean;
  pressureLevel: string;
  nearbyPlayers: string[];
  objective: string;
  /** Resumo compacto dos traits de posição do jogador (DNA de lenda). Ex: "press:0.8 offRuns:0.9 risk:0.7". */
  positionTraits?: string;
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
  // Feature flag: admin pode desligar todas as chamadas OpenAI em runtime.
  if (!isFeatureEnabled('GAMESPIRIT_ENABLED')) {
    return { error: 'GameSpirit desativado pelo admin (feature flag).', status: 503 };
  }
  const base = olefootApiBase();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const r = await fetch(`${base}/api/gamespirit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: body }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

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
    clearTimeout(timeoutId);
    if (e instanceof Error && e.name === 'AbortError') {
      return { error: 'Timeout: servidor não respondeu em 15s.' };
    }
    return {
      error: e instanceof Error ? e.message : 'Sem ligação ao servidor (olefoot-server na porta 4000?).',
    };
  }
}
