# Assistente IA do Olefoot — Arquitetura e Implementação

## Visão Geral

Sistema de assistente inteligente que responde perguntas sobre o Olefoot usando **knowledge base atualizada** do código-fonte e documentação do projeto.

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                          │
│  ┌────────────────────────────────────────────────────┐     │
│  │  OlefootAIAssistant.tsx                            │     │
│  │  - Chat interface com design BVB                   │     │
│  │  - Perguntas rápidas pré-definidas                 │     │
│  │  - Histórico de conversação                        │     │
│  │  - Minimizar/Expandir                              │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            ↓ POST /api/assistant/ask
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Hono)                            │
│  ┌────────────────────────────────────────────────────┐     │
│  │  server/src/routes/assistant.ts                    │     │
│  │  1. Carrega knowledge base (cache 5min)            │     │
│  │  2. Busca docs relevantes (keyword search)         │     │
│  │  3. Monta prompt com contexto                      │     │
│  │  4. Chama Claude API                               │     │
│  │  5. Retorna resposta + fontes                      │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Knowledge Base                              │
│  - docs/*.md (documentação do projeto)                      │
│  - CLAUDE.md (instruções principais)                        │
│  - README.md                                                 │
│  - src/entities/types.ts (tipos principais)                 │
│  - src/systems/economy.ts (economia)                        │
│  - src/systems/careerTiers.ts (progressão)                  │
│  - src/match-engine/formations/catalog.ts (formações)       │
└─────────────────────────────────────────────────────────────┘
```

## Componentes

### 1. **OlefootAIAssistant** (Frontend)

**Localização:** `src/components/assistant/OlefootAIAssistant.tsx`

**Features:**
- Chat interface com design BVB (amarelo neon, preto, tipografia editorial)
- Botão flutuante no canto inferior esquerdo
- 3 estados: fechado, minimizado, aberto
- Perguntas rápidas pré-definidas
- Histórico de conversação com scroll automático
- Mostra fontes consultadas (arquivos usados na resposta)
- Loading states com animações

**Props:**
```typescript
interface OlefootAIAssistantProps {
  autoOpen?: boolean;           // Abre automaticamente
  initialQuestion?: string;     // Pergunta inicial pré-carregada
}
```

**Perguntas Rápidas:**
1. Como ganhar EXP?
2. Diferença entre partidas (Rápida, Auto, Ao Vivo)
3. Como funciona BRO?
4. Comprar jogadores no mercado
5. Melhorar meu time
6. Formações táticas

### 2. **Assistant Routes** (Backend)

**Localização:** `server/src/routes/assistant.ts`

**Endpoints:**

#### `POST /api/assistant/ask`
Processa pergunta do usuário e retorna resposta com contexto.

**Request:**
```json
{
  "question": "Como eu ganho EXP no Olefoot?",
  "conversationHistory": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**Response:**
```json
{
  "answer": "Você ganha EXP de várias formas...",
  "sources": ["docs/ECONOMIA.md", "src/systems/economy.ts"],
  "timestamp": "2026-04-25T..."
}
```

#### `GET /api/assistant/knowledge`
Retorna lista de arquivos na knowledge base (debug).

**Response:**
```json
{
  "count": 12,
  "files": [
    { "path": "CLAUDE.md", "category": "docs" },
    { "path": "docs/ECONOMIA.md", "category": "docs" },
    { "path": "src/entities/types.ts", "category": "code" }
  ],
  "lastUpdate": "2026-04-25T..."
}
```

### 3. **Knowledge Base System**

**Carregamento:**
- Lê filesystem no startup e a cada 5 minutos (cache)
- Indexa arquivos relevantes: docs, CLAUDE.md, tipos principais
- Cada entrada tem: `path`, `content`, `category`

**Busca:**
- Keyword-based search (simples mas eficaz)
- Extrai keywords da pergunta (palavras > 3 chars)
- Pontua cada documento por número de matches
- Retorna top 5 documentos mais relevantes

**Arquivos Indexados:**
1. **Documentação:** `docs/*.md`
2. **Instruções:** `CLAUDE.md`, `README.md`
3. **Código-chave:**
   - `src/entities/types.ts` — tipos principais
   - `src/game/types.ts` — estado do jogo
   - `src/systems/economy.ts` — economia
   - `src/systems/careerTiers.ts` — progressão
   - `src/match-engine/formations/catalog.ts` — formações

### 4. **Claude Integration**

**Model:** `claude-3-5-sonnet-20241022`

**System Prompt:**
```
Você é o assistente oficial do Olefoot, um simulador de futebol brasileiro com IA embarcada.

Seu papel:
- Responder perguntas sobre funcionalidades, mecânicas e estratégias do jogo
- Usar o contexto fornecido (documentação e código) para dar respostas precisas
- Ser direto, claro e útil — sem enrolação
- Falar em português brasileiro, tom amigável mas profissional
- Se não souber algo, admitir e sugerir onde o usuário pode encontrar a resposta

Contexto do jogo (documentação e código):
[... contexto relevante ...]

Responda de forma concisa (máximo 3 parágrafos). Use bullet points quando apropriado.
```

**Contexto Dinâmico:**
- Busca top 5 documentos relevantes
- Inclui até 2000 chars de cada documento
- Formata como `### path\ncontent`

## Como Usar

### Frontend

```tsx
import { OlefootAIAssistant } from '@/components/assistant/OlefootAIAssistant';

// Botão flutuante (padrão)
<OlefootAIAssistant />

// Abrir automaticamente com pergunta
<OlefootAIAssistant 
  autoOpen 
  initialQuestion="Como funciona o mercado de transferências?"
/>
```

### Backend

```bash
# Variável de ambiente necessária
ANTHROPIC_API_KEY=sk-ant-...

# Testar knowledge base
curl http://localhost:4000/api/assistant/knowledge

# Fazer pergunta
curl -X POST http://localhost:4000/api/assistant/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Como ganhar EXP?"}'
```

## Melhorias Futuras

### 1. **Vector Search (Embeddings)**
Substituir keyword search por embeddings para busca semântica mais precisa.

```typescript
// Usar OpenAI embeddings ou similar
const embedding = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: question,
});

// Buscar documentos similares por cosine similarity
const relevant = findSimilarDocs(embedding.data[0].embedding);
```

### 2. **Indexação Automática**
Watcher que recarrega knowledge base quando arquivos mudam.

```typescript
import { watch } from 'fs';

watch('docs/', { recursive: true }, () => {
  console.log('[assistant] Docs changed, reloading knowledge base');
  knowledgeBase = loadKnowledgeBase();
});
```

### 3. **Feedback Loop**
Usuário pode marcar respostas como úteis/inúteis para melhorar o sistema.

```typescript
interface Message {
  // ...
  feedback?: 'helpful' | 'not_helpful';
}

// Salvar feedback para análise
assistantRoutes.post('/feedback', async (c) => {
  const { messageId, feedback } = await c.req.json();
  // Salvar no Supabase para análise posterior
});
```

### 4. **Contexto de Sessão**
Lembrar estado do usuário (tier, time, economia) para respostas personalizadas.

```typescript
// Incluir contexto do usuário no prompt
const userContext = `
Contexto do usuário:
- Tier: ${user.tier}
- EXP: ${user.exp}
- Time: ${user.squadSize} jogadores
- Última partida: ${user.lastMatch}
`;
```

### 5. **Sugestões Proativas**
Assistente sugere dicas baseado no comportamento do usuário.

```typescript
// Detectar padrões
if (user.lostLastThreeMatches) {
  suggestTip('Tente ajustar sua formação ou treinar seus jogadores');
}

if (user.hasLowEXP && user.hasUnclaimedMissions) {
  suggestTip('Você tem missões prontas para resgatar — ganhe EXP agora!');
}
```

## Segurança

- **Rate limiting:** Limitar requests por IP/usuário
- **Input sanitization:** Validar pergunta (max length, caracteres permitidos)
- **API key protection:** Nunca expor `ANTHROPIC_API_KEY` no frontend
- **CORS:** Apenas origens permitidas podem chamar a API

## Performance

- **Cache de knowledge base:** 5 minutos (ajustável)
- **Limite de contexto:** Top 5 docs, 2000 chars cada (10KB total)
- **Timeout:** 30s para resposta do Claude
- **Histórico:** Apenas últimas 4 mensagens enviadas ao Claude

## Custos

**Claude API:**
- Input: ~$3 / 1M tokens
- Output: ~$15 / 1M tokens

**Estimativa por pergunta:**
- Input: ~5K tokens (contexto + histórico)
- Output: ~500 tokens (resposta)
- **Custo:** ~$0.01 por pergunta

**Otimizações:**
- Cache de respostas comuns
- Limitar contexto enviado
- Usar modelo menor para perguntas simples

## Monitoramento

```typescript
// Logs estruturados
console.log('[assistant] Question:', {
  question: question.slice(0, 100),
  docsFound: relevantDocs.length,
  responseTime: Date.now() - startTime,
});

// Métricas
- Total de perguntas
- Tempo médio de resposta
- Taxa de erro
- Documentos mais consultados
```

---

**Status:** ✅ Implementado e pronto para uso

**Próximos passos:**
1. Testar com perguntas reais
2. Adicionar mais documentos à knowledge base
3. Implementar feedback loop
4. Otimizar busca com embeddings
