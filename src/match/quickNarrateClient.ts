/**
 * Cliente da narração IA da Partida Rápida 2.0.
 *
 * Pré-busca UMA vez quando o MatchPlan chega: monta os momentos-chave (analyst
 * beats + gols, marcando o gol da vitória) e pede ao backend a narração rica
 * (Sonnet). O resultado é mesclado nos beats e na comemoração de gol pelo
 * QuickPlanPlayer. Qualquer falha → null e o player segue com o texto do Python.
 */

import type { MatchPlan } from './quickPlanTypes';

const ENV = (import.meta as { env?: Record<string, string | undefined> }).env;

const API_BASE =
  ENV?.VITE_OLEFOOT_API_URL ||
  ENV?.VITE_API_URL ||
  'http://localhost:4000';

export interface QuickNarration {
  /** beat_id → frase rica (substitui insight.text). */
  beats: Record<string, string>;
  /** minuto → frase do gol (substitui a narração da comemoração). */
  goals: Record<string, string>;
  /** Frase de fecho sobre a leitura do jogo (pós-jogo). */
  reading?: string;
}

/** Extrai os gols do plano, marcando o último como gol da vitória se decidiu. */
function goalsFromPlan(plan: MatchPlan): Array<{
  minute: number; actor?: string; side: 'home' | 'away'; is_winner: boolean; score_after: string;
}> {
  let h = 0;
  let a = 0;
  const goals = plan.events
    .filter((e) => e.kind === 'goal_home' || e.kind === 'goal_away')
    .map((e) => {
      const side = e.kind === 'goal_home' ? 'home' : 'away';
      if (side === 'home') h += 1; else a += 1;
      return { minute: e.minute, actor: e.actor_name, side: side as 'home' | 'away', score_after: `${h}-${a}` };
    });
  // Gol da vitória = o que levou o vencedor à frente em definitivo (último do vencedor).
  const winnerSide = plan.home_score > plan.away_score ? 'home' : plan.away_score > plan.home_score ? 'away' : null;
  const winnerGoals = winnerSide ? goals.filter((g) => g.side === winnerSide) : [];
  const decisiveMinute = winnerGoals.length ? winnerGoals[winnerGoals.length - 1]!.minute : -1;
  return goals.map((g) => ({ ...g, is_winner: g.minute === decisiveMinute && g.side === winnerSide }));
}

export async function fetchQuickNarration(
  plan: MatchPlan,
  names: { home: string; away: string },
): Promise<QuickNarration | null> {
  try {
    const beats = (plan.analyst_beats ?? []).map((b) => ({
      id: b.id,
      minute: b.minute,
      intent: b.intent,
      insight: b.insight.text,
      primary: b.insight.primary_channel,
      threat: b.insight.threat_channel,
    }));
    const res = await fetch(`${API_BASE}/api/match/quick-narrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seed: plan.seed,
        home: names.home,
        away: names.away,
        home_score: plan.home_score,
        away_score: plan.away_score,
        narrative_arc: plan.narrative_arc,
        beats,
        goals: goalsFromPlan(plan),
      }),
    });
    if (!res.ok) return null;
    const body = await res.json();
    if (!body?.ok || !body?.narration) return null;
    return body.narration as QuickNarration;
  } catch {
    return null;
  }
}
