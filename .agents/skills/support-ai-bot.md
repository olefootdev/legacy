---
name: support-ai-bot
description: Skill para gerenciar o assistente IA local do Olefoot — adicionar FAQs, melhorar respostas, analisar perguntas sem resposta e otimizar a knowledge base
version: 1.0.0
author: Olefoot Team
tags: [ai, assistant, support, knowledge-base, faq]
---

# Support AI Bot — Skill do Assistente IA Local

Skill especializada para gerenciar, melhorar e expandir o assistente IA do Olefoot.

## Quando usar esta skill

Use SEMPRE que o usuário pedir:
- Adicionar novas perguntas ao FAQ
- Melhorar respostas existentes
- Analisar perguntas que não tiveram boa resposta
- Otimizar a knowledge base
- Testar o assistente
- Adicionar sinônimos ou stopwords
- Revisar linguagem das respostas
- Expandir documentação para o assistente

## O que esta skill faz

### 1. **Adicionar FAQs**
Cria novas perguntas frequentes com respostas prontas em linguagem popular e amigável.

**Exemplo:**
```
Usuário: "Adiciona uma FAQ sobre como treinar jogadores"
Skill: Cria FAQ com resposta amigável, emojis e dicas práticas
```

### 2. **Melhorar Respostas**
Revisa respostas existentes para torná-las mais claras, amigáveis e úteis.

**Exemplo:**
```
Usuário: "A resposta sobre formações tá muito técnica, deixa mais simples"
Skill: Reescreve em linguagem popular com exemplos práticos
```

### 3. **Analisar Perguntas Sem Resposta**
Identifica perguntas que tiveram confidence baixa e sugere melhorias.

**Exemplo:**
```
Usuário: "Quais perguntas o assistente não conseguiu responder bem?"
Skill: Lista perguntas com confidence baixa e sugere FAQs ou docs
```

### 4. **Expandir Sinônimos**
Adiciona novos sinônimos para melhorar a busca.

**Exemplo:**
```
Usuário: "Adiciona sinônimos para 'tática'"
Skill: Adiciona: estratégia, esquema, sistema, jeito de jogar
```

### 5. **Testar Assistente**
Faz bateria de testes com perguntas comuns.

**Exemplo:**
```
Usuário: "Testa o assistente com 10 perguntas"
Skill: Executa testes e reporta confidence, tempo de resposta, qualidade
```

### 6. **Otimizar Knowledge Base**
Analisa quais documentos são mais consultados e sugere melhorias.

**Exemplo:**
```
Usuário: "Quais docs o assistente mais usa?"
Skill: Analisa logs e mostra ranking de documentos mais relevantes
```

## Arquivos que esta skill gerencia

### **Backend:**
- `server/src/lib/knowledgeSearch.ts` — Engine de busca e FAQs
- `server/src/routes/assistant.ts` — Rotas da API

### **Frontend:**
- `src/components/assistant/OlefootAIAssistant.tsx` — Interface do chat
- `src/components/assistant/OlefootAssistant.tsx` — Tutorial passo a passo

### **Documentação:**
- `docs/ASSISTANT_LOCAL_KNOWLEDGE.md` — Arquitetura e uso
- `docs/ASSISTANT_AI_ARCHITECTURE.md` — Documentação técnica

## Comandos disponíveis

### **Adicionar FAQ**
```
/support-ai-bot add-faq "Como treinar jogadores?"
```
Cria nova FAQ com resposta amigável.

### **Melhorar resposta**
```
/support-ai-bot improve "como ganhar exp"
```
Reescreve resposta existente com linguagem mais clara.

### **Testar assistente**
```
/support-ai-bot test
```
Executa bateria de testes com perguntas comuns.

### **Adicionar sinônimos**
```
/support-ai-bot add-synonyms "tática" "estratégia, esquema, sistema"
```
Expande sinônimos para melhorar busca.

### **Analisar performance**
```
/support-ai-bot analyze
```
Mostra estatísticas: perguntas mais comuns, confidence média, docs mais usados.

### **Expandir documentação**
```
/support-ai-bot expand-docs "formações táticas"
```
Sugere melhorias na documentação para tópico específico.

## Diretrizes de linguagem

Ao criar ou melhorar respostas, SEMPRE siga estas diretrizes:

### ✅ **Use linguagem popular:**
- "Opa!" / "Beleza!" / "Show!" / "Fala!"
- "Vou te explicar..." / "Deixa eu te mostrar..."
- "Sacou?" / "Entendeu?" / "Tá ligado?"

### ✅ **Seja direto e claro:**
- Frases curtas
- Sem jargão técnico
- Exemplos práticos

### ✅ **Use emojis contextuais:**
- 🎮 Jogando
- 🎯 Missões/Objetivos
- ⚽ Futebol/Treino
- 🏆 Troféus/Conquistas
- 💰 Dinheiro/Moedas
- 💡 Dicas
- 📚 Fontes/Documentação
- ⚡ Rápido/Ação
- 🔨 Leilão
- 💸 Compra

### ✅ **Estrutura de resposta:**
1. Saudação amigável
2. Explicação clara com bullet points
3. Dica prática (💡)
4. Fontes consultadas (📚)

### ❌ **Evite:**
- Linguagem formal ou técnica demais
- Frases longas e complexas
- Jargão sem explicação
- Tom robótico ou distante

## Exemplos de FAQs bem escritas

### **Exemplo 1: Pergunta sobre mecânica**
```typescript
'como treinar jogadores': {
  answer: `Beleza! Vou te ensinar a treinar seus jogadores:

⚽ **Vai na aba Time** — Escolhe o jogador que você quer evoluir

📈 **Escolhe o atributo** — Passe, chute, velocidade, físico... o que você achar que precisa melhorar

💰 **Gasta EXP** — Cada treino custa EXP. Quanto mais alto o atributo, mais caro fica

🎯 **Foca no que importa** — Não adianta treinar chute no zagueiro. Treina o que a posição dele precisa!

💡 **Dica de ouro:** Treina os jogadores que você mais usa. Não gasta EXP com banco!

📚 Fontes: docs/COACH_SKILLS_PLAYBOOK_V1.md`,
  sources: ['docs/COACH_SKILLS_PLAYBOOK_V1.md'],
},
```

### **Exemplo 2: Pergunta sobre estratégia**
```typescript
'qual melhor formacao': {
  answer: `Opa! Não existe "melhor formação", depende do seu estilo:

⚔️ **4-3-3 (Ataque)** — 3 atacantes, pressão alta. Bom pra quem gosta de jogar no ataque

🛡️ **4-4-2 (Balanceado)** — Clássico, equilibrado. Bom pra começar

🎯 **4-2-3-1 (Controle)** — Domina o meio, 1 atacante forte. Pra quem gosta de posse de bola

🔥 **3-5-2 (Agressivo)** — 5 no meio, pressão forte. Arriscado mas eficiente

💡 **Dica:** Testa várias! Vê qual combina com seus jogadores e teu jeito de jogar.

📚 Fontes: src/match-engine/formations/catalog.ts, CLAUDE.md`,
  sources: ['src/match-engine/formations/catalog.ts', 'CLAUDE.md'],
},
```

### **Exemplo 3: Pergunta sobre economia**
```typescript
'vale a pena comprar bro': {
  answer: `Depende do que você quer, mano:

💰 **Vale se você quer:**
- Montar um timaço rápido
- Comprar cartas Genesis (as melhores)
- Não quer esperar pra evoluir

🎮 **Não precisa se você:**
- Tá curtindo evoluir devagar
- Tem paciência pra ganhar EXP jogando
- Quer o desafio de montar time do zero

💡 **Sacou?** BRO acelera as coisas, mas dá pra jogar de boa sem gastar nada. É escolha sua!

🎯 **Dica:** Se for comprar, espera uma promoção ou foca em 1-2 jogadores chave, não sai comprando tudo.

📚 Fontes: docs/ECONOMIA_EXP_BRO.md`,
  sources: ['docs/ECONOMIA_EXP_BRO.md'],
},
```

## Fluxo de trabalho

### **1. Usuário pede nova FAQ**
```
1. Entende a pergunta
2. Busca informações na knowledge base
3. Escreve resposta em linguagem popular
4. Adiciona emojis e dicas
5. Testa a resposta
6. Adiciona ao FAQ_ANSWERS
```

### **2. Usuário pede melhoria**
```
1. Lê resposta atual
2. Identifica problemas (muito técnica, confusa, longa)
3. Reescreve seguindo diretrizes
4. Testa com perguntas similares
5. Atualiza FAQ_ANSWERS
```

### **3. Usuário pede análise**
```
1. Lê logs do assistente (se disponíveis)
2. Identifica padrões: perguntas comuns, confidence baixa
3. Sugere FAQs ou melhorias na documentação
4. Prioriza por impacto (perguntas mais frequentes primeiro)
```

## Testes automatizados

A skill deve testar o assistente com estas perguntas:

### **Básicas (devem ter confidence: high):**
- "Como ganhar EXP?"
- "O que é BRO?"
- "Diferença entre partidas"
- "Como comprar jogadores?"

### **Intermediárias (devem ter confidence: medium/high):**
- "Como melhorar meu time?"
- "Quais formações existem?"
- "O que são cartas Genesis?"
- "Como treinar jogadores?"

### **Avançadas (podem ter confidence: medium):**
- "Qual a melhor estratégia pra ganhar campeonato?"
- "Como funciona a química do time?"
- "Vale a pena comprar BRO?"

## Métricas de sucesso

Uma boa resposta deve ter:
- ✅ Confidence: high ou medium
- ✅ Tempo de resposta: < 200ms
- ✅ Linguagem amigável (emojis, saudação, dicas)
- ✅ Fontes citadas
- ✅ Estrutura clara (bullet points)

## Próximas melhorias sugeridas

1. **Sistema de feedback**
   - Botão 👍/👎 nas respostas
   - Salvar feedback no Supabase
   - Analisar respostas com mais 👎

2. **Analytics**
   - Perguntas mais comuns
   - Horários de pico
   - Tópicos mais buscados

3. **A/B Testing**
   - Testar 2 versões de resposta
   - Ver qual tem mais 👍
   - Manter a melhor

4. **Auto-aprendizado**
   - Detectar perguntas novas
   - Sugerir FAQs automaticamente
   - Notificar admin

## Comandos úteis

### **Testar localmente:**
```bash
# Testar FAQ
curl -X POST http://localhost:4000/api/assistant/ask \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:5173" \
  -d '{"question": "Como ganhar EXP?"}'

# Ver knowledge base
curl http://localhost:4000/api/assistant/knowledge
```

### **Adicionar FAQ:**
```typescript
// Em server/src/lib/knowledgeSearch.ts
export const FAQ_ANSWERS = {
  // ... FAQs existentes
  'nova pergunta': {
    answer: `Resposta amigável aqui...`,
    sources: ['docs/...'],
  },
};
```

### **Adicionar sinônimos:**
```typescript
// Em server/src/lib/knowledgeSearch.ts
const SYNONYMS = {
  // ... sinônimos existentes
  'novo_termo': ['sinônimo1', 'sinônimo2', 'sinônimo3'],
};
```

## Conclusão

Esta skill é essencial para manter o assistente IA sempre atualizado, útil e amigável. Use-a sempre que precisar melhorar a experiência do usuário com o suporte do jogo!

🎯 **Objetivo:** Assistente que conversa como um amigo te ajudando no jogo, não como um robô lendo manual.
