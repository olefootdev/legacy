/**
 * Rota do assistente IA — processa perguntas usando knowledge base do código.
 * Sistema de busca local sem dependência de APIs externas.
 */

import { Hono } from 'hono';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export const assistantRoutes = new Hono();

// ES modules: obter __dirname equivalente
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { searchKnowledge, generateAnswer, findFAQAnswer } from '../lib/knowledgeSearch.js';

/**
 * Knowledge base — arquivos-chave do projeto que o assistente pode consultar.
 * Atualizado automaticamente ao ler o filesystem.
 */
interface KnowledgeEntry {
  path: string;
  content: string;
  category: 'docs' | 'code' | 'config';
}

let knowledgeBase: KnowledgeEntry[] = [];
let lastKnowledgeUpdate = 0;
const KNOWLEDGE_CACHE_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Carrega knowledge base do filesystem.
 * Lê arquivos relevantes: docs/, CLAUDE.md, principais componentes.
 */
function loadKnowledgeBase(): KnowledgeEntry[] {
  const entries: KnowledgeEntry[] = [];
  const projectRoot = join(__dirname, '../../../');

  // 1. Documentação
  const docsPath = join(projectRoot, 'docs');
  if (statSync(docsPath, { throwIfNoEntry: false })?.isDirectory()) {
    const docFiles = readdirSync(docsPath).filter((f) => f.endsWith('.md'));
    for (const file of docFiles) {
      try {
        const content = readFileSync(join(docsPath, file), 'utf-8');
        entries.push({
          path: `docs/${file}`,
          content,
          category: 'docs',
        });
      } catch (e) {
        console.warn(`Failed to read docs/${file}`, e);
      }
    }
  }

  // 2. CLAUDE.md (instruções principais)
  try {
    const claudeMd = readFileSync(join(projectRoot, 'CLAUDE.md'), 'utf-8');
    entries.push({
      path: 'CLAUDE.md',
      content: claudeMd,
      category: 'docs',
    });
  } catch (e) {
    console.warn('CLAUDE.md not found', e);
  }

  // 3. README principal
  try {
    const readme = readFileSync(join(projectRoot, 'README.md'), 'utf-8');
    entries.push({
      path: 'README.md',
      content: readme,
      category: 'docs',
    });
  } catch (e) {
    console.warn('README.md not found', e);
  }

  // 4. Tipos principais (entities, game state)
  const keyCodeFiles = [
    'src/entities/types.ts',
    'src/game/types.ts',
    'src/systems/economy.ts',
    'src/systems/careerTiers.ts',
    'src/match-engine/formations/catalog.ts',
  ];

  for (const file of keyCodeFiles) {
    try {
      const content = readFileSync(join(projectRoot, file), 'utf-8');
      entries.push({
        path: file,
        content,
        category: 'code',
      });
    } catch (e) {
      console.warn(`Failed to read ${file}`, e);
    }
  }

  console.log(`[assistant] Loaded ${entries.length} knowledge entries`);
  return entries;
}

/**
 * Busca entradas relevantes na knowledge base usando keywords.
 * DEPRECATED: usar searchKnowledge() de knowledgeSearch.ts
 */
function searchKnowledgeOld(query: string, limit = 5): KnowledgeEntry[] {
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);

  const scored = knowledgeBase.map((entry) => {
    const text = `${entry.path} ${entry.content}`.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      const matches = (text.match(new RegExp(kw, 'g')) || []).length;
      score += matches;
    }
    return { entry, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.entry);
}

/**
 * POST /api/assistant/ask
 * Recebe pergunta do usuário e responde usando busca inteligente na knowledge base.
 * Sistema 100% local, sem APIs externas.
 */
assistantRoutes.post('/ask', async (c) => {
  try {
    const body = await c.req.json();
    const { question, conversationHistory = [] } = body;

    if (!question || typeof question !== 'string') {
      return c.json({ error: 'Question is required' }, 400);
    }

    // Atualiza knowledge base se necessário
    const now = Date.now();
    if (now - lastKnowledgeUpdate > KNOWLEDGE_CACHE_MS || knowledgeBase.length === 0) {
      knowledgeBase = loadKnowledgeBase();
      lastKnowledgeUpdate = now;
    }

    // 1. Tenta encontrar em FAQ (respostas pré-definidas)
    const faqAnswer = findFAQAnswer(question);
    if (faqAnswer) {
      return c.json({
        answer: faqAnswer.answer,
        sources: faqAnswer.sources,
        confidence: 'high',
        method: 'faq',
        timestamp: new Date().toISOString(),
      });
    }

    // 2. Busca inteligente na knowledge base
    const searchResults = searchKnowledge(question, knowledgeBase, 5);

    // 3. Gera resposta estruturada
    const { answer, sources, confidence } = generateAnswer(question, searchResults);

    return c.json({
      answer,
      sources,
      confidence,
      method: 'search',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[assistant] Error:', error);
    return c.json(
      {
        error: 'Failed to process question',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
});

/**
 * GET /api/assistant/knowledge
 * Retorna lista de arquivos na knowledge base (para debug).
 */
assistantRoutes.get('/knowledge', (c) => {
  if (knowledgeBase.length === 0) {
    knowledgeBase = loadKnowledgeBase();
    lastKnowledgeUpdate = Date.now();
  }

  return c.json({
    count: knowledgeBase.length,
    files: knowledgeBase.map((e) => ({ path: e.path, category: e.category })),
    lastUpdate: new Date(lastKnowledgeUpdate).toISOString(),
  });
});
