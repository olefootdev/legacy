/**
 * Sistema de busca inteligente na knowledge base — sem APIs externas.
 * Usa TF-IDF, keyword matching e ranking por relevância.
 */
/**
 * Dicionário de sinônimos e termos relacionados para melhorar busca.
 */
const SYNONYMS = {
    exp: ['experiência', 'xp', 'pontos', 'progressão'],
    bro: ['moeda', 'dinheiro', 'currency', 'comprar'],
    partida: ['jogo', 'match', 'disputa', 'jogar'],
    jogador: ['player', 'atleta', 'carta', 'card'],
    time: ['equipe', 'elenco', 'squad', 'plantel'],
    formação: ['tática', 'esquema', 'formation', 'posicionamento'],
    mercado: ['transfer', 'compra', 'venda', 'leilão', 'auction'],
    treino: ['training', 'evolução', 'desenvolvimento'],
    carreira: ['progressão', 'tier', 'nível', 'ranking'],
    missão: ['quest', 'objetivo', 'tarefa', 'desafio'],
};
/**
 * Stopwords em português — palavras muito comuns que não agregam na busca.
 */
const STOPWORDS = new Set([
    'o', 'a', 'os', 'as', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das',
    'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'com', 'sem', 'sob',
    'e', 'ou', 'mas', 'que', 'se', 'como', 'quando', 'onde', 'qual',
    'eu', 'tu', 'ele', 'ela', 'nós', 'vós', 'eles', 'elas',
    'meu', 'teu', 'seu', 'nosso', 'vosso', 'minha', 'tua', 'sua',
    'é', 'são', 'foi', 'ser', 'estar', 'ter', 'fazer', 'ir',
]);
/**
 * Normaliza texto: lowercase, remove acentos, pontuação.
 */
function normalizeText(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '') // remove acentos
        .replace(/[^\w\s]/g, ' ') // remove pontuação
        .replace(/\s+/g, ' ')
        .trim();
}
/**
 * Extrai keywords de uma query, expandindo com sinônimos.
 */
function extractKeywords(query) {
    const normalized = normalizeText(query);
    const words = normalized.split(' ').filter((w) => w.length > 2 && !STOPWORDS.has(w));
    const expanded = new Set(words);
    // Adiciona sinônimos
    for (const word of words) {
        if (SYNONYMS[word]) {
            SYNONYMS[word].forEach((syn) => expanded.add(syn));
        }
    }
    return Array.from(expanded);
}
/**
 * Calcula score TF-IDF simplificado para um termo em um documento.
 */
function calculateTFIDF(term, doc, allDocs) {
    const docNorm = normalizeText(doc);
    const termCount = (docNorm.match(new RegExp(term, 'g')) || []).length;
    if (termCount === 0)
        return 0;
    // TF: frequência do termo no documento
    const tf = termCount / docNorm.split(' ').length;
    // IDF: inverso da frequência em todos os documentos
    const docsWithTerm = allDocs.filter((d) => normalizeText(d).includes(term)).length;
    const idf = Math.log(allDocs.length / (docsWithTerm + 1));
    return tf * idf;
}
/**
 * Extrai snippets relevantes do conteúdo (contexto ao redor das keywords).
 */
function extractSnippets(content, keywords, maxSnippets = 3) {
    const snippets = [];
    const lines = content.split('\n');
    const contentNorm = normalizeText(content);
    for (const keyword of keywords) {
        for (let i = 0; i < lines.length; i++) {
            const lineNorm = normalizeText(lines[i]);
            if (lineNorm.includes(keyword)) {
                // Pega linha atual + 1 antes + 1 depois para contexto
                const start = Math.max(0, i - 1);
                const end = Math.min(lines.length, i + 2);
                const snippet = lines.slice(start, end).join(' ').trim();
                if (snippet.length > 20 && snippet.length < 300) {
                    snippets.push(snippet);
                    if (snippets.length >= maxSnippets)
                        return snippets;
                }
            }
        }
    }
    return snippets;
}
/**
 * Busca inteligente na knowledge base.
 */
export function searchKnowledge(query, knowledgeBase, limit = 5) {
    const keywords = extractKeywords(query);
    const allContents = knowledgeBase.map((e) => e.content);
    const results = [];
    for (const entry of knowledgeBase) {
        let score = 0;
        const matchedKeywords = [];
        const contentNorm = normalizeText(entry.content);
        const pathNorm = normalizeText(entry.path);
        // 1. Score por keywords no conteúdo (TF-IDF)
        for (const keyword of keywords) {
            const tfidf = calculateTFIDF(keyword, entry.content, allContents);
            if (tfidf > 0) {
                score += tfidf * 10; // peso 10x
                matchedKeywords.push(keyword);
            }
        }
        // 2. Boost se keyword aparece no path/filename (muito relevante)
        for (const keyword of keywords) {
            if (pathNorm.includes(keyword)) {
                score += 5;
                if (!matchedKeywords.includes(keyword)) {
                    matchedKeywords.push(keyword);
                }
            }
        }
        // 3. Boost por categoria (docs > code > config)
        if (entry.category === 'docs')
            score *= 1.5;
        else if (entry.category === 'code')
            score *= 1.2;
        // 4. Penaliza documentos muito longos (menos focados)
        const lengthPenalty = Math.min(1, 5000 / entry.content.length);
        score *= lengthPenalty;
        if (score > 0) {
            const relevantSnippets = extractSnippets(entry.content, keywords, 3);
            results.push({
                entry,
                score,
                matchedKeywords,
                relevantSnippets,
            });
        }
    }
    // Ordena por score decrescente
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
}
/**
 * Gera resposta estruturada baseada nos resultados da busca.
 * Linguagem popular e amigável.
 */
export function generateAnswer(query, searchResults) {
    if (searchResults.length === 0) {
        return {
            answer: 'Opa, não achei nada sobre isso na documentação 😅\n\nTenta perguntar de outro jeito ou ser mais específico. Tipo: "como ganhar EXP?" ou "o que é BRO?"',
            sources: [],
            confidence: 'low',
        };
    }
    const topResult = searchResults[0];
    const sources = searchResults.map((r) => r.entry.path);
    // Constrói resposta baseada nos snippets mais relevantes
    const snippets = searchResults
        .flatMap((r) => r.relevantSnippets)
        .slice(0, 5);
    let answer = '';
    // Detecta tipo de pergunta e formata resposta de forma amigável
    const queryLower = query.toLowerCase();
    if (queryLower.includes('como') || queryLower.includes('qual')) {
        answer = `Beleza! Achei isso aqui pra você:\n\n`;
    }
    else if (queryLower.includes('o que é') || queryLower.includes('o que e')) {
        answer = `Opa! Deixa eu te explicar:\n\n`;
    }
    else if (queryLower.includes('onde') || queryLower.includes('quando')) {
        answer = `Show! Olha só o que encontrei:\n\n`;
    }
    else {
        answer = `Achei umas informações aqui:\n\n`;
    }
    // Adiciona snippets formatados
    snippets.forEach((snippet, i) => {
        answer += `${i + 1}. ${snippet}\n\n`;
    });
    // Adiciona referência aos arquivos consultados de forma amigável
    if (sources.length > 0) {
        answer += `\n📚 Olhei nesses arquivos: ${sources.slice(0, 3).join(', ')}`;
    }
    // Adiciona dica amigável se confiança for baixa
    if (topResult.score < 5) {
        answer += `\n\n💡 **Dica:** Se não era isso que você queria, tenta perguntar de outro jeito!`;
    }
    // Calcula confiança baseada no score do melhor resultado
    let confidence = 'low';
    if (topResult.score > 10)
        confidence = 'high';
    else if (topResult.score > 5)
        confidence = 'medium';
    return { answer, sources, confidence };
}
/**
 * Perguntas frequentes pré-indexadas para respostas rápidas.
 * Linguagem popular, intuitiva e amigável.
 */
export const FAQ_ANSWERS = {
    'como ganhar exp': {
        answer: `Opa! Vou te explicar como ganhar EXP aqui no Olefoot:

🎮 **Jogando partidas** — Cada vitória te dá EXP. Quanto mais difícil o jogo, mais você ganha!

🎯 **Fazendo missões** — Tem missões todo dia, toda semana e umas especiais. É a forma mais rápida de subir no começo!

⚽ **Treinando seus jogadores** — Quando você evolui o time, também ganha EXP

🏆 **Ganhando campeonatos** — Troféus e títulos te dão uma boa grana de EXP

💡 **Dica de ouro:** Foca nas missões no início! É o jeito mais rápido de evoluir.

📚 Fontes: docs/ECONOMIA_EXP_BRO.md, src/systems/economy.ts`,
        sources: ['docs/ECONOMIA_EXP_BRO.md', 'src/systems/economy.ts'],
    },
    'diferenca entre partidas': {
        answer: `Beleza! Aqui no Olefoot você tem 3 jeitos de jogar:

⚡ **Partida Rápida (Quick)**
→ Resultado na hora, sem enrolação. Perfeito pra quando você tá com pressa e quer ganhar EXP rápido (1 minuto)

📖 **Partida Auto**
→ O jogo rola sozinho mas você vê os lances acontecendo. Legal pra acompanhar sem precisar controlar tudo (3 minutos)

🎮 **Partida ao Vivo (Live 2D)**
→ Aqui é você quem manda! Controla tudo em tempo real, muda tática, dá comando pros jogadores. É o modo completo mesmo (10+ minutos)

💡 **Qual escolher?** Depende do seu tempo livre! Quick pra rapidão, Auto pra ver o jogo rolar, Live pra jogar de verdade.

📚 Fontes: docs/MATCH_SIMULATION_PIPELINE.md, CLAUDE.md`,
        sources: ['docs/MATCH_SIMULATION_PIPELINE.md', 'CLAUDE.md'],
    },
    'o que e bro': {
        answer: `Fala! BRO é a moeda premium do jogo, tipo o "dinheiro de verdade" aqui dentro:

💰 **Pra que serve?**
Comprar jogadores no mercado de transferências. É com BRO que você monta um timaço!

🤑 **Como conseguir?**
Você pode comprar com grana real ou ganhar em recompensas especiais do jogo

💵 **Quanto vale?**
1 BRO vale mais ou menos 1 dólar (é só referência, não é conversão garantida)

⚖️ **BRO vs EXP — qual a diferença?**
- EXP = sua evolução no jogo, seu nível
- BRO = dinheiro pra comprar jogadores

💡 **Sacou?** EXP é pra você crescer, BRO é pra montar o time dos sonhos!

📚 Fontes: docs/ECONOMIA_EXP_BRO.md, src/systems/economy.ts`,
        sources: ['docs/ECONOMIA_EXP_BRO.md', 'src/systems/economy.ts'],
    },
    'como comprar jogadores': {
        answer: `Show! Vou te ensinar a comprar jogadores no mercado:

1️⃣ **Vai em /market/transfer** — É o mercado de transferências

2️⃣ **Escolhe a aba Genesis** — São as cartas fundadoras, as mais raras e fortes do jogo

3️⃣ **Tem 2 jeitos de comprar:**
   🔨 **Leilão** — Você dá lances e disputa com outros managers. Quem der mais leva!
   💸 **Compra imediata** — Paga o preço fixo e já leva o jogador na hora

4️⃣ **Pode pagar com EXP ou BRO** — Depende do anúncio

💡 **Atenção:** Cartas Genesis são limitadas e têm overall alto. Pensa bem antes de gastar!

🎯 **Dica:** Se tá começando, foca em jogadores mais baratos pra montar o time. Depois vai atrás dos craques!

📚 Fontes: docs/ECONOMIA_EXP_BRO.md, src/pages/Transfer.tsx`,
        sources: ['docs/ECONOMIA_EXP_BRO.md', 'src/pages/Transfer.tsx'],
    },
    'como melhorar time': {
        answer: `Beleza! Vou te dar umas dicas pra deixar seu time cascudo:

⚽ **Escala certa**
Bota os jogadores nas posições certas! Cada formação valoriza atributos diferentes. Testa 4-3-3, 4-4-2, experimenta!

📈 **Treina o pessoal**
Usa o EXP pra evoluir os atributos dos jogadores. Foca nos que você mais usa!

🛒 **Compra no mercado**
Quando tiver BRO ou EXP sobrando, vai no mercado buscar jogadores melhores

🏆 **Joga e ganha**
Quanto mais você joga e vence, mais EXP ganha pra evoluir tudo

🧠 **Química do time**
Jogadores da mesma nacionalidade jogam melhor juntos. Tenta montar um time com química!

💡 **Dica de ouro:** Não adianta ter 11 atacantes. Monta um time balanceado: defesa boa, meio forte e ataque afiado!

📚 Fontes: docs/COACH_SKILLS_PLAYBOOK_V1.md, src/systems/economy.ts`,
        sources: ['docs/COACH_SKILLS_PLAYBOOK_V1.md', 'src/systems/economy.ts'],
    },
    'o que e genesis': {
        answer: `Opa! Genesis são as cartas fundadoras do Olefoot:

🌟 **O que são?**
São os primeiros jogadores criados no jogo. Tipo as cartas originais, as raízes de tudo!

💎 **Por que são especiais?**
- São limitadas (não tem infinitas)
- Têm overall alto (jogadores fortes)
- Valem mais no mercado
- São colecionáveis

🎯 **Vale a pena?**
Se você quer montar um timaço e tem BRO pra investir, sim! São os melhores jogadores disponíveis.

💡 **Sacou?** É tipo ter uma carta rara de um álbum. Todo mundo quer, mas nem todo mundo tem!

📚 Fontes: docs/ECONOMIA_EXP_BRO.md, src/pages/Transfer.tsx`,
        sources: ['docs/ECONOMIA_EXP_BRO.md', 'src/pages/Transfer.tsx'],
    },
};
/**
 * Tenta encontrar resposta em FAQ antes de buscar na knowledge base.
 */
export function findFAQAnswer(query) {
    const queryNorm = normalizeText(query);
    for (const [key, value] of Object.entries(FAQ_ANSWERS)) {
        if (queryNorm.includes(key)) {
            return value;
        }
    }
    return null;
}
//# sourceMappingURL=knowledgeSearch.js.map