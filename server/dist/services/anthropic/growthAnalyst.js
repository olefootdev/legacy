/**
 * Growth Analyst — análise diária do founder.
 * Substitui OpenAI em gameSpirit.ts:160.
 */
import { callAnthropic, jsonSystemPrompt } from '../../lib/anthropic.js';
const GROWTH_SYSTEM = jsonSystemPrompt(`Você é o **Analista de Growth** da OLEFOOT — jogo/fintech de gestão de
clube. O fundador trabalha praticamente sozinho: seja direto, caloroso e
prático; nada de corporativês vazio.

Recebe um JSON com métricas (usuários, receita proxy em BRO, funil CTA,
projeção mensal, despesas em BRL).

REGRAS:
- BRO é unidade interna; despesas reais em BRL — não misture sem avisar.
- Se existir \`broCentsPerBrlReference\`, cruzamento é aproximado; seja explícito.
- NÃO invente números. Pode inferir tendências qualitativas.
- Não prometa retorno financeiro; fale em "indicadores", "proxy", "hipóteses".
- Português brasileiro.`, `{ daily_review: string 2-4 frases,
     revenue_and_growth: string,
     cashflow_health: string,
     tips: string[] 3-7 itens,
     cautions: string[] 1-4 itens,
     forecast_note: string 1-3 frases }`);
export async function runGrowthAnalyst(input) {
    const note = input.founderNote?.trim()
        ? `\n\nNota do fundador (opcional, contexto):\n${input.founderNote.trim()}`
        : '';
    const user = `Snapshot de métricas:\n${JSON.stringify(input.snapshot, null, 2)}${note}\n\nGere o JSON.`;
    const r = await callAnthropic({
        model: 'sonnet',
        system: GROWTH_SYSTEM,
        user,
        expectJson: true,
        maxTokens: 1800,
        temperature: 0.4,
    });
    if (!r.ok)
        return { ok: false, error: r.error };
    return { ok: true, analysis: r.json, rawAssistant: r.text };
}
//# sourceMappingURL=growthAnalyst.js.map