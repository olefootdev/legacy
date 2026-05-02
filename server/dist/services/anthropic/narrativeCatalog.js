/**
 * Gerador de catálogo narrativo — batch via Anthropic Haiku.
 *
 * Recebe uma lista de "slots" (categoria + intensidade + tags + vibe) e
 * devolve N templates por slot. Cada template é uma string com placeholders
 * {player}, {minute}, {gk}, etc.
 *
 * Usado pelo script `scripts/generate-narrative-catalog.ts` e (futuro) cron
 * semanal do Cloudflare Workers.
 */
import { callAnthropic, jsonSystemPrompt } from '../../lib/anthropic.js';
const SYSTEM_PROMPT = jsonSystemPrompt(`Você é o "GameSpirit", narrador de futebol do OLEFOOT. Gera linhas curtas
e marcantes (máx 15 palavras) com tom brasileiro — ora analítico, ora
visceral, ora poético, ora casual. NUNCA use clichês de locução batida
("que golaço", exclamações duplas). Prefira construções ativas, verbos
específicos, metáforas que cabem no minuto de jogo.

Cada linha vai ser usada como TEMPLATE pelo motor do jogo: escreva placeholders
{player}, {minute}, {opponent}, {gk} quando fizer sentido. Nunca invente nomes
de jogadores reais.

Variáveis alternativas podem ser sugeridas em um objeto "variables": {outcome:
["no ângulo","no travessão"], reaction: ["a torcida explode","silêncio no
estádio"]} — o motor escolhe uma ao renderizar.`, `{ templates: [{ template: string, variables?: { [key: string]: string[] } }] }`);
function userPromptFor(slot) {
    const tagNote = slot.contextTags?.length
        ? `Tags de contexto: ${slot.contextTags.join(', ')}.`
        : '';
    return [
        `Gera exatamente ${slot.count} templates narrativos para:`,
        `- Categoria: ${slot.category}`,
        `- Intensidade: ${slot.intensity}`,
        `- Vibe: ${slot.personaVibe}`,
        tagNote,
        '',
        `Responda com { "templates": [{ "template": "...", "variables": {...} }, ...] }.`,
        `Evite repetir estrutura entre os ${slot.count} itens.`,
    ].filter(Boolean).join('\n');
}
export async function generateSlot(slot) {
    const r = await callAnthropic({
        model: 'haiku',
        system: SYSTEM_PROMPT,
        user: userPromptFor(slot),
        expectJson: true,
        maxTokens: 2048,
        temperature: 0.85, // narrativa criativa
    });
    if (!r.ok || !r.json?.templates) {
        throw new Error(`Falha a gerar slot ${slot.category}/${slot.intensity}: ${r.error ?? 'resposta vazia'}`);
    }
    return r.json.templates
        .filter((t) => typeof t.template === 'string' && t.template.trim().length > 0)
        .map((t) => ({
        category: slot.category,
        intensity: slot.intensity,
        context_tags: slot.contextTags ?? [],
        template: t.template.trim(),
        variables: t.variables ?? {},
        persona_vibe: slot.personaVibe,
    }));
}
/**
 * Gera N slots em sequência (pra respeitar rate limits) e devolve um array
 * único pronto pra inserção via `admin_insert_narrative_batch`.
 */
export async function generateCatalog(slots) {
    const all = [];
    for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        const got = await generateSlot(slot);
        all.push(...got);
        // eslint-disable-next-line no-console
        console.log(`  [${i + 1}/${slots.length}] ${slot.category}/${slot.intensity}/${slot.personaVibe} → ${got.length} templates`);
    }
    return all;
}
//# sourceMappingURL=narrativeCatalog.js.map