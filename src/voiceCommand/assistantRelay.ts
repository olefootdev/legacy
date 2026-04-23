/**
 * Relay do assistente — filtra o comando pela eficácia do staff antes de
 * chegar ao jogador.
 *
 * Qualidade do relay:
 *   - clean  (eff ≥85): comando chega limpo, pode ganhar sugestão complementar
 *   - basic  (eff 60-85): comando chega literal
 *   - partial_loss (eff 40-60): parte da especificidade se perde (ex.: alvo vira genérico)
 *   - distorted    (eff <40): comando vira algo próximo mas não igual (ou é ignorado)
 *
 * A eficácia multiplica a obediência individual depois (já implementado em
 * `rollObedience(assistantEffectiveness)`).
 */

import {
  ASSISTANT_LABEL,
  ASSISTANT_GLYPH,
  type AssistantRole,
  type ParsedCommand,
  type RelayedCommand,
} from './types';

export interface AssistantStaff {
  role: AssistantRole;
  /** Eficácia 0-100. */
  effectiveness: number;
  /** Nome do assistente (pra feed). Opcional. */
  name?: string;
}

export type RelayQuality = 'clean' | 'basic' | 'partial_loss' | 'distorted';

/** Defaults MVP — assistentes base que todos os managers recebem. */
export const DEFAULT_ASSISTANT_STAFF: Record<AssistantRole, AssistantStaff> = {
  tatico: { role: 'tatico', effectiveness: 68, name: 'Aux. Tático' },
  ataque: { role: 'ataque', effectiveness: 72, name: 'Aux. Ataque' },
  defesa: { role: 'defesa', effectiveness: 65, name: 'Aux. Defesa' },
  fisico: { role: 'fisico', effectiveness: 70, name: 'Preparador Físico' },
  mental: { role: 'mental', effectiveness: 75, name: 'Preparador Mental' },
};

export function qualityFromEffectiveness(eff: number): RelayQuality {
  if (eff >= 85) return 'clean';
  if (eff >= 60) return 'basic';
  if (eff >= 40) return 'partial_loss';
  return 'distorted';
}

/**
 * Aplica o filtro do assistente no comando. O parsed original vira um
 * `RelayedCommand` com qualidade + narrativa do relay.
 *
 * Distorções aplicadas quando eff baixa:
 *   - partial_loss: alvo explícito (player_id/shirt_number) vira `role` ou `team`.
 *   - distorted: ~40% chance de o comando ser soltado (resulta null).
 */
export function relayCommand(
  parsed: ParsedCommand,
  staff: AssistantStaff,
): RelayedCommand | null {
  const quality = qualityFromEffectiveness(staff.effectiveness);
  const label = staff.name ?? ASSISTANT_LABEL[staff.role];
  const glyph = ASSISTANT_GLYPH[staff.role];

  // Distorção pesada: ~40% de chance de comando "se perder" no relay.
  if (quality === 'distorted' && Math.random() < 0.4) {
    return null;
  }

  let out: RelayedCommand = {
    ...parsed,
    assistant: staff.role,
    assistantEffectiveness: staff.effectiveness,
    relayQuality: quality,
    relayNarrative: '',
  };

  // Partial loss: degrada especificidade do alvo.
  if (quality === 'partial_loss') {
    if (out.target.kind === 'player_id' || out.target.kind === 'shirt_number' || out.target.kind === 'player_name') {
      // Tenta preservar role implícito, senão vira team.
      out = { ...out, target: { kind: 'team' } };
    }
  }

  // Narrativa do relay (mostrada no feed do Comando Técnico)
  const phrases: Record<RelayQuality, (c: string) => string> = {
    clean: (c) => `${glyph} ${label}: "Entendi — ${c}". Equipe, vai!`,
    basic: (c) => `${glyph} ${label}: "${c}" — transmite pro time.`,
    partial_loss: (c) => `${glyph} ${label}: "hum... ${c.split(' ').slice(0, 3).join(' ')}..." — relay parcial.`,
    distorted: (c) => `${glyph} ${label}: "não ouvi bem..." — comando chega embaralhado.`,
  };
  out.relayNarrative = phrases[quality](parsed.rawText);

  return out;
}

/**
 * Apanha o assistente atual (do save, futuro) ou retorna o default.
 * Hoje: defaults fixos. Amanhã: lê `state.manager.voiceAssistants` se existir.
 */
export function getAssistantStaff(
  role: AssistantRole,
  override?: Partial<Record<AssistantRole, AssistantStaff>>,
): AssistantStaff {
  return override?.[role] ?? DEFAULT_ASSISTANT_STAFF[role];
}
