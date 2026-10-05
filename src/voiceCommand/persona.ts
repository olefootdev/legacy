/**
 * Análise de persona do manager a partir do histórico de comandos de voz.
 * Input: agregados do RPC `get_manager_persona`.
 * Output: estilo narrativo + insights pra UI.
 */

import { INTENT_CATEGORY, type VoiceIntent, type IntentCategory } from './types';
import { L } from '@/i18n/L';

export type ManagerStyle =
  | 'ofensivo_criativo'
  | 'ofensivo_direto'
  | 'defensivo_tatico'
  | 'gerencialista'
  | 'agressivo'
  | 'equilibrado'
  | 'iniciante';

export const STYLE_LABELS: Record<ManagerStyle, string> = {
  ofensivo_criativo: L('Ofensivo-Criativo', 'Attacking-Creative'),
  ofensivo_direto: L('Ofensivo-Direto', 'Attacking-Direct'),
  defensivo_tatico: L('Defensivo-Tático', 'Defensive-Tactical'),
  gerencialista: L('Gerencialista', 'Manager-Engineer'),
  agressivo: L('Agressivo', 'Aggressive'),
  equilibrado: L('Equilibrado', 'Balanced'),
  iniciante: L('Iniciante', 'Beginner'),
};

export const STYLE_DESCRIPTIONS: Record<ManagerStyle, string> = {
  ofensivo_criativo: L('Prioriza jogadas de ruptura e ataque à área — confia nos criativos.', 'Prioritises line-breaking play and attacking the box — trusts the creators.'),
  ofensivo_direto: L('Comando pro ataque direto — chutes, cruzamentos e velocidade.', 'Calls for direct attack — shots, crosses and pace.'),
  defensivo_tatico: L('Foco em manter o bloco, pressionar no momento certo e neutralizar o adversário.', 'Focus on keeping the block, pressing at the right time and neutralising the opponent.'),
  gerencialista: L('Ajusta formação, substituições e ritmo — comanda como um engenheiro.', 'Adjusts formation, subs and tempo — manages like an engineer.'),
  agressivo: L('Divide forte, pressiona alto e arrisca cartão — mentalidade de vitória a qualquer custo.', 'Tackles hard, presses high and risks cards — win-at-all-costs mentality.'),
  equilibrado: L('Alterna ataque, defesa e gestão conforme o momento do jogo.', 'Switches between attack, defence and game management as the match demands.'),
  iniciante: L('Poucos comandos emitidos — experimenta o sistema.', 'Few commands issued — still trying out the system.'),
};

export interface PersonaAggregates {
  total_commands: number;
  accepted_count: number;
  refused_count: number;
  top_intent: string | null;
  top_intent_count: number;
  top_assistant: string | null;
  top_assistant_count: number;
  avg_effective_obedience: number | null;
  first_command_at?: string | null;
  last_command_at?: string | null;
}

export interface ManagerPersona {
  style: ManagerStyle;
  label: string;
  description: string;
  total: number;
  acceptanceRate: number; // 0..1
  refusalRate: number;
  avgObedience: number; // 0..100
  topIntent: string | null;
  topIntentCount: number;
  topAssistant: string | null;
  categoryShare: Partial<Record<IntentCategory, number>>;
}

/**
 * Infere estilo a partir dos agregados. Usa:
 *   - categoria dominante do top_intent
 *   - peso do assistente favorito
 *   - proporção de intents agressivos vs criativos
 */
export function inferManagerStyle(agg: PersonaAggregates, categoryShare: Partial<Record<IntentCategory, number>>): ManagerStyle {
  if (agg.total_commands < 5) return 'iniciante';
  const shareAgg = categoryShare.aggressive ?? 0;
  const shareCreative = categoryShare.creative ?? 0;
  const shareCollective = categoryShare.collective ?? 0;
  const shareIndividual = categoryShare.individual ?? 0;
  const shareSubForm = (categoryShare.substitution ?? 0) + (categoryShare.formation ?? 0);

  if (shareAgg >= 0.2) return 'agressivo';
  if (shareSubForm >= 0.3) return 'gerencialista';

  const offensiveShare = shareIndividual + shareCreative;
  if (offensiveShare >= 0.55) {
    return shareCreative >= 0.2 ? 'ofensivo_criativo' : 'ofensivo_direto';
  }
  if (shareCollective >= 0.45) return 'defensivo_tatico';
  return 'equilibrado';
}

/** Converte agregados + histórico de intents em Persona completa. */
export function buildManagerPersona(
  agg: PersonaAggregates,
  /** Histórico opcional de intents (pra calcular categoryShare). Se ausente, estima via top_intent. */
  intentCounts?: Record<string, number>,
): ManagerPersona {
  const total = agg.total_commands || 0;
  const acceptanceRate = total > 0 ? agg.accepted_count / total : 0;
  const refusalRate = total > 0 ? agg.refused_count / total : 0;
  const avgObedience = Number(agg.avg_effective_obedience ?? 0);

  // Calcula distribuição por categoria
  const categoryShare: Partial<Record<IntentCategory, number>> = {};
  if (intentCounts) {
    const sum = Object.values(intentCounts).reduce((s, v) => s + v, 0) || 1;
    for (const [intent, c] of Object.entries(intentCounts)) {
      const cat = INTENT_CATEGORY[intent as VoiceIntent];
      if (!cat) continue;
      categoryShare[cat] = (categoryShare[cat] ?? 0) + c / sum;
    }
  } else if (agg.top_intent) {
    const cat = INTENT_CATEGORY[agg.top_intent as VoiceIntent];
    if (cat) categoryShare[cat] = 1;
  }

  const style = inferManagerStyle(agg, categoryShare);
  return {
    style,
    label: STYLE_LABELS[style],
    description: STYLE_DESCRIPTIONS[style],
    total,
    acceptanceRate,
    refusalRate,
    avgObedience,
    topIntent: agg.top_intent,
    topIntentCount: agg.top_intent_count || 0,
    topAssistant: agg.top_assistant,
    categoryShare,
  };
}
