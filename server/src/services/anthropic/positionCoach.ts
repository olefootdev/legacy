/**
 * Position Coach — DNA tático por posição.
 * 9 posições, cada uma com sistema prompt específico herdado do legado.
 * Substitui OpenAI em positionCoach.ts:302.
 */

import { callAnthropic } from '../../lib/anthropic.js';

export interface PositionCoachInput {
  system: string;              // system prompt específico da posição (vem da rota)
  userContent: string;         // prompt montado na rota
}

export async function runPositionCoach(
  input: PositionCoachInput,
): Promise<{ ok: boolean; data?: unknown; rawAssistant?: string; error?: string }> {
  const r = await callAnthropic<unknown>({
    model: 'sonnet',
    system: input.system,
    user: input.userContent,
    expectJson: true,
    temperature: 0.3,
    maxTokens: 2048,
  });
  if (!r.ok) return { ok: false, error: r.error, rawAssistant: r.text };
  return { ok: true, data: r.json, rawAssistant: r.text };
}
