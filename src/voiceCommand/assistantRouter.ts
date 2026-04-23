/**
 * Router: decide qual assistente recebe o comando.
 * Usa `INTENT_ASSISTANT` do types.ts como fonte primária + heurística sobre
 * menção explícita do assistente na frase original ("Ataque, manda o Adrien...").
 */

import {
  ASSISTANT_LABEL,
  INTENT_ASSISTANT,
  type AssistantRole,
  type ParsedCommand,
  type VoiceIntent,
} from './types';

// Palavras-chave que forçam um assistente específico mesmo que o intent sugira outro.
const EXPLICIT_ASSISTANT_RE: Record<AssistantRole, RegExp> = {
  tatico: /\b(tatic(o|a)|auxiliar|comissao|coordenador)\b/i,
  ataque: /\b(atacan|ofensivo|ataque)\b/i,
  defesa: /\b(defesa|defensivo|marcac)\b/i,
  fisico: /\b(fisico|preparador\s+fisico|condicion)\b/i,
  mental: /\b(mental|psicolog|emocion)\b/i,
};

export function routeToAssistant(cmd: ParsedCommand): AssistantRole {
  // Prioridade 1: menção explícita no transcript
  for (const [role, re] of Object.entries(EXPLICIT_ASSISTANT_RE) as Array<[AssistantRole, RegExp]>) {
    if (re.test(cmd.rawText)) return role;
  }
  // Prioridade 2: mapa canônico por intent
  return INTENT_ASSISTANT[cmd.intent] ?? 'tatico';
}

/** Nome legível do assistente — útil na narração. */
export function assistantDisplayName(role: AssistantRole): string {
  return ASSISTANT_LABEL[role];
}

/** Útil pra debug / testes. */
export function __routeForTesting(intent: VoiceIntent): AssistantRole {
  return INTENT_ASSISTANT[intent] ?? 'tatico';
}
