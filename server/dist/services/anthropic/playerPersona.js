/**
 * Persona de jogador — Create Player.
 *
 * 2 modos:
 *   - Combined (legado): 1 call que recebe prompt livre e devolve tudo.
 *     Mantido pra compat com o endpoint atual /api/admin/player-from-prompt.
 *   - Agentes especializados (novo): 4 chamadas sequenciais na admin UI.
 *     Ver ../../routes/gameSpirit.ts pra os 4 novos endpoints.
 *
 * Modelo: Sonnet — qualidade importa, não é hot path.
 */
import { callAnthropic, jsonSystemPrompt } from '../../lib/anthropic.js';
// ─── Modo Combined — compat com endpoint atual ───────────────────────────
const COMBINED_SYSTEM = jsonSystemPrompt(`Você é o "GameSpirit" de OLEFOOT. O admin JÁ definiu nome, posição, país,
raridade e pé bom. Sua tarefa: receber um prompt livre sobre estilo, atributos
e personalidade do jogador, e devolver os campos restantes.

NÃO repita os campos fixados (name, pos, country, strongFoot, creatorType,
rarity) no JSON. Omita chaves que não consiga inferir.`, `{ archetype?: "profissional"|"novo_talento"|"lenda"|"meme"|"ai_plus",
     behavior?: "equilibrado"|"ofensivo"|"defensivo"|"criativo",
     attrs?: { passe, marcacao, velocidade, drible, finalizacao, fisico, tatico, mentalidade, confianca, fairPlay } números 40-99,
     quemSouEu?: string,
     num?: number 1-99,
     fatigue?: 0-100, injuryRisk?: 0-100, evolutionXp?: ≥0, outForMatches?: ≥0,
     spiritNotes?: string }`);
export async function generatePlayerPersonaCombined(locked, userPrompt) {
    const colLine = locked.collectionSummary?.trim()
        ? `- Coleção: ${locked.collectionSummary.trim()}\n`
        : '';
    const ctx = `Dados fixos:\n- Nome: ${locked.name.trim()}\n- Posição: ${locked.pos.trim()}\n- País: ${(locked.country ?? '—')}\n- Tipo: ${locked.creatorType ?? '—'}\n- Raridade: ${locked.rarity ?? '—'}\n- Pé bom: ${locked.strongFoot ?? '—'}\n${colLine}`;
    const user = `${ctx}\nPrompt do admin:\n---\n${userPrompt}\n---\nResponde só com o JSON.`;
    const r = await callAnthropic({
        model: 'sonnet',
        system: COMBINED_SYSTEM,
        user,
        expectJson: true,
        temperature: 0.35,
        maxTokens: 1024,
    });
    if (!r.ok)
        return { ok: false, error: r.error };
    return { ok: true, rawAssistant: r.text, json: r.json };
}
const SCOUT_SYSTEM = jsonSystemPrompt(`Você é um scout atemporal que acompanha futebol desde 1910. Recebe o nome
(e talvez apelido) de um jogador e devolve uma pesquisa biográfica estruturada.

REGRAS:
- Se o jogador existe na história real, use conhecimento geral sobre ele (clubes,
  títulos, estilo). Se não, marque confidence: "low" e retorne campos mínimos.
- NUNCA invente títulos ou feitos dos quais não tem certeza.
- Use 3-7 clubes principais, 3-8 títulos principais, 3-5 highlights.
- playstyle_notes: 2-3 frases descrevendo como jogava.
- personality_traits: 3-6 tags curtas (ex: "líder nato", "técnico refinado").`);
export async function runScoutAgent(input) {
    const linksBlock = input.sources && input.sources.length > 0
        ? `\nFontes de pesquisa fornecidas pelo admin (use como referência primária):\n${input.sources
            .filter((l) => l.trim())
            .map((l, i) => `${i + 1}. ${l.trim()}`)
            .join('\n')}\n`
        : '';
    const hints = [
        input.nickname ? `Apelido: ${input.nickname}` : '',
        input.hintPosition ? `Posição sugerida: ${input.hintPosition}` : '',
        input.hintEra ? `Era aproximada: ${input.hintEra}` : '',
    ].filter(Boolean).join('\n');
    const user = `Jogador: ${input.name}\n${hints}${linksBlock}\nPesquisa estruturada no JSON do schema. Se houver fontes fornecidas, cite-as em sources_used.`;
    const r = await callAnthropic({
        model: 'sonnet',
        system: SCOUT_SYSTEM,
        user,
        expectJson: true,
        maxTokens: 2048,
        temperature: 0.4,
    });
    if (!r.ok)
        return { ok: false, error: r.error };
    return { ok: true, research: r.json };
}
const ATTRIBUTES_SYSTEM = jsonSystemPrompt(`Você é um analisador de atributos de jogador pra videogame de futebol.
Recebe pesquisa biográfica e a raridade-alvo (se fornecida). Devolve atributos
calibrados 40-99 e um overall coerente.

RARIDADES OFICIAIS DO OLEFOOT (use exatamente um destes em rarity_recommended):
- "premium"     → overall 40-59 (básico, profissional amador)
- "gol"         → 55-65 (sólido regional)
- "rare"        → 65-74 (profissional internacional)
- "ultra_rare"  → 74-82 (top de liga nacional)
- "champion"    → 82-88 (titular de grande clube)
- "legend"      → 88-93 (estrela internacional em auge)
- "epic"        → 93-99 (lenda histórica: Pelé, Maradona, Zidane, Messi, Ronaldo)

REGRAS:
- Distribuição coerente: atacante tem fisico alto se era bruto, baixo se técnico.
- fairPlay: 40 = cascudo/violento, 90 = cavalheiro. Nunca 99 (reservado pra Fair-play FIFA).
- subattrs_notes: 1-2 frases explicando por que alguns atributos são altos/baixos.`);
export async function runAttributesAgent(input) {
    const rar = input.targetRarity ? `Raridade-alvo: ${input.targetRarity}` : '';
    const user = `Pesquisa:\n${JSON.stringify(input.research, null, 2)}\n\n${rar}\n\nResponda com JSON do schema.`;
    const r = await callAnthropic({
        model: 'sonnet',
        system: ATTRIBUTES_SYSTEM,
        user,
        expectJson: true,
        maxTokens: 1024,
        temperature: 0.3,
    });
    if (!r.ok)
        return { ok: false, error: r.error };
    return { ok: true, attrs: r.json };
}
const BIO_SYSTEM = jsonSystemPrompt(`Você é o narrador e biógrafo do OLEFOOT. Recebe pesquisa e atributos de um
jogador e produz textos que o GameSpirit vai usar nas telas de card, perfil e
narração.

REGRAS:
- quem_sou_eu: 2-4 parágrafos EM PRIMEIRA PESSOA. O jogador falando dele mesmo.
  Tom visceral, evocativo, NÃO enciclopédico. Sem clichês.
- bio_short: 1-2 frases curtas pra caber num card.
- signature_move: jogada icônica ou traço mais marcante em 1 linha.
- personality_line: como ele é fora do campo em 1 frase.
- spirit_notes: conexão narrativa com o jogo — como ele aparece em partida.
- Português brasileiro natural, sem gírias datadas.
- Nunca invente troféus ou fatos específicos.`);
export async function runBioAgent(input) {
    const attrsBlock = input.attrs ? `Atributos:\n${JSON.stringify(input.attrs, null, 2)}\n\n` : '';
    const user = `Pesquisa:\n${JSON.stringify(input.research, null, 2)}\n\n${attrsBlock}Gere o JSON do schema.`;
    const r = await callAnthropic({
        model: 'sonnet',
        system: BIO_SYSTEM,
        user,
        expectJson: true,
        maxTokens: 1500,
        temperature: 0.75, // narrativa criativa
    });
    if (!r.ok)
        return { ok: false, error: r.error };
    return { ok: true, bio: r.json };
}
const VALUATION_SYSTEM = jsonSystemPrompt(`Você é um analista de NFTs, colecionáveis e jogos de futebol. Avalia uma
carta do OLEFOOT com base em atributos, raridade e contexto.

RARIDADES (use exatamente um em rarity_tier):
- "premium"     → overall 40-59
- "gol"         → 55-65
- "rare"        → 65-74
- "ultra_rare"  → 74-82
- "champion"    → 82-88
- "legend"      → 88-93
- "epic"        → 93-99

FAIXAS DE FLOOR em BRO cents (1 BRO = 100 cents):
- premium      : 30 000 - 100 000     (R$ 3-10)
- gol          : 100 000 - 300 000
- rare         : 300 000 - 800 000
- ultra_rare   : 800 000 - 2 000 000
- champion     : 2 000 000 - 5 000 000
- legend       : 5 000 000 - 10 000 000
- epic         : 10 000 000 +

REGRAS:
- EXP é moeda conquistada: target_price_exp ≈ cents / 10 (ajuste por lore/era).
- volatility: "high" pra lendas internacionais, "low" pra profissional estável.
- scarcity_note: 1 frase sobre raridade no contexto da coleção.
- collection_fit: 1 frase sobre como encaixa (ex: "completa a era 90s" ou "primeiro goleiro epic").`);
export async function runValuationAgent(input) {
    const ctxLine = input.collectionContext ? `Contexto da coleção: ${input.collectionContext}` : '';
    const resLine = input.research ? `Pesquisa resumida: ${input.research.full_name}, ${input.research.era}, ${input.research.position}` : '';
    const user = `${resLine}\n${ctxLine}\nAtributos:\n${JSON.stringify(input.attrs, null, 2)}\n\nGere o JSON.`;
    const r = await callAnthropic({
        model: 'haiku', // valuation é cálculo + contexto curto; haiku basta
        system: VALUATION_SYSTEM,
        user,
        expectJson: true,
        maxTokens: 512,
        temperature: 0.2,
    });
    if (!r.ok)
        return { ok: false, error: r.error };
    return { ok: true, valuation: r.json };
}
//# sourceMappingURL=playerPersona.js.map