import { olefootApiBase } from '@/gamespirit/admin/runtimeTruth';

export interface GrowthAnalystBriefing {
  /** Resumo executivo do dia / período */
  daily_review: string;
  /** Como receita (proxy) e crescimento de base se relacionam */
  revenue_and_growth: string;
  /** Leitura de caixa: despesas R$ vs entradas, runway mental */
  cashflow_health: string;
  /** 3–7 dicas acionáveis */
  tips: string[];
  /** Riscos ou pontos de atenção */
  cautions: string[];
  /** Nota sobre tendência / próximos dias (sem garantir precisão) */
  forecast_note: string;
}

function parseBriefing(raw: string): GrowthAnalystBriefing | null {
  let data: unknown;
  try {
    data = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  const daily_review = typeof o.daily_review === 'string' ? o.daily_review.trim() : '';
  const revenue_and_growth = typeof o.revenue_and_growth === 'string' ? o.revenue_and_growth.trim() : '';
  const cashflow_health = typeof o.cashflow_health === 'string' ? o.cashflow_health.trim() : '';
  const forecast_note = typeof o.forecast_note === 'string' ? o.forecast_note.trim() : '';
  const tips = Array.isArray(o.tips) ? o.tips.filter((x): x is string => typeof x === 'string') : [];
  const cautions = Array.isArray(o.cautions)
    ? o.cautions.filter((x): x is string => typeof x === 'string')
    : [];
  if (!daily_review || !revenue_and_growth) return null;
  return {
    daily_review,
    revenue_and_growth,
    cashflow_health: cashflow_health || '—',
    tips,
    cautions,
    forecast_note: forecast_note || '—',
  };
}

export async function requestGrowthAnalyst(body: {
  snapshot: Record<string, unknown>;
  founderNote?: string;
}): Promise<
  | { ok: true; briefing: GrowthAnalystBriefing; rawAssistant: string }
  | { ok: false; error: string; status?: number; rawAssistant?: string }
> {
  const base = olefootApiBase();
  try {
    const r = await fetch(`${base}/api/admin/growth-analyst`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        snapshot: body.snapshot,
        founderNote: body.founderNote?.trim() || undefined,
      }),
    });
    const j = (await r.json()) as {
      ok?: boolean;
      error?: string;
      rawAssistant?: string;
    };
    if (!r.ok || j.ok === false) {
      return { ok: false, error: j.error ?? `HTTP ${r.status}`, status: r.status, rawAssistant: j.rawAssistant };
    }
    const raw = typeof j.rawAssistant === 'string' ? j.rawAssistant.trim() : '';
    const briefing = parseBriefing(raw);
    if (!briefing) {
      return {
        ok: false,
        error: 'Resposta do modelo inválida.',
        status: r.status,
        rawAssistant: raw,
      };
    }
    return { ok: true, briefing, rawAssistant: raw };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Sem ligação ao servidor (olefoot-server + ANTHROPIC_API_KEY).',
    };
  }
}
