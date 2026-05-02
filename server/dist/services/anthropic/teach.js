/**
 * GameSpirit Teach — admin ensina novos padrões ao GameSpirit.
 * 3 tipos: narrative, tactical, position. JSON estrito.
 * Substitui OpenAI em gameSpirit.ts:225.
 */
import { callAnthropic, jsonSystemPrompt } from '../../lib/anthropic.js';
const SYSTEM_BY_KIND = {
    narrative: jsonSystemPrompt(`Você é um editor técnico do OLEFOOT GameSpirit. O usuário ensina estilo
de narração ou exemplos. Gere linhas curtas, estilo transmissão BR, com
placeholders {name} e {away} quando fizer sentido.`, `{ title: string, bucket: string (ex: "dribble","cross","press","custom"), lines: string[] 3-12 itens, notes: string }`),
    tactical: jsonSystemPrompt(`Você é um analista tático do OLEFOOT. O usuário descreve um padrão
ou ideia.`, `{ name: string, intentTag: string (ex: "press_high","build_up","counter" ou livre), notes: string }`),
    position: jsonSystemPrompt(`Você é um treinador do OLEFOOT. O usuário descreve uma posição
e responsabilidades. Campo 105x68, origem canto superior esquerdo.`, `{ code: string, label: string, zone: "gk"|"def"|"mid"|"att"|"wide", x01: number 0-1, y01: number 0-1, mainActivities: string[], coachingNotes: string }`),
};
export async function runTeach(input) {
    const ctx = input.contextJson?.trim()
        ? `\n\nContexto existente (não altere sem ser pedido):\n${input.contextJson}`
        : '';
    const r = await callAnthropic({
        model: 'haiku',
        system: SYSTEM_BY_KIND[input.kind],
        user: `${input.userMessage}${ctx}`,
        expectJson: true,
        temperature: 0.4,
        maxTokens: 1024,
    });
    if (!r.ok)
        return { ok: false, error: r.error, rawAssistant: r.text };
    return { ok: true, data: r.json, rawAssistant: r.text };
}
//# sourceMappingURL=teach.js.map