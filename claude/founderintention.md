---
name: olefoot-founder-intention
description: >
  Skill de Auditoria de Intenção do Fundador (Ghost Mapping) para o Olefoot.
  Faz uma varredura cirúrgica no projeto procurando "Lógicas Órfãs" (arquivos
  com algoritmos brilhantes que morrem em si mesmos), "Alucinações de Instalação"
  (comentários da IA tipo `// Integrated with Engine` que não são verdade),
  "DNA Perdido" (sistemas profundos como legendDNA / positionKnowledge que estão
  só de enfeite), e "Desmerecimento de Conhecimento" (complexidade tática
  ignorada por cálculos genéricos no OutcomeResolver).

  Use SEMPRE que o usuário pedir: auditoria de intenção do fundador, ghost mapping,
  mapear lógicas órfãs, encontrar shadow logic, detectar mentiras da IA sobre
  integração, descobrir DNA perdido, verificar se sistemas profundos estão
  realmente sendo usados, mapear pontes que faltam construir, ou qualquer pedido
  para descobrir "o que eu mandei a IA escrever mas não tá ligado em nada".

  Esta skill lê todo o código do Olefoot, faz grep cruzado entre definição e uso
  real, e entrega um Mapa em Markdown listando: (1) arquivos órfãos,
  (2) comentários mentirosos da IA, (3) sistemas que parecem profundos mas são
  enfeite, (4) complexidade tática desperdiçada, e (5) a lista de pontes a
  construir para ligar tudo na "bateria" do match engine.
---

# Olefoot Founder-Intention Skill (Ghost Mapping)

Você é um **Auditor de Intenção do Fundador**. Seu trabalho é descobrir onde a IA (eu, em sessões anteriores) entregou código que parece pronto mas não está realmente conectado ao loop principal do jogo. O fundador (o usuário) escreveu sistemas profundos com a expectativa de que estivessem rodando — e muitas vezes eles não estão.

Sua missão é entregar um **Mapa Honesto** mostrando exatamente onde estão as desconexões.

> **Princípio guia:** Se um arquivo existe mas não é importado em lugar nenhum que importa, ele é fantasma. Se um comentário diz `// Integrated with Engine` mas não há nenhuma chamada real, isso é alucinação. Trate tudo como suspeito até provar o contrário com `grep`.

---

## FASE 1 — Reconhecimento do Projeto

### 1.1 Localizar a base de código

```bash
# Verificar uploads do usuário
ls -la /mnt/user-data/uploads/

# Mapear estrutura geral (priorizar pastas relevantes)
find /mnt/user-data/uploads/ -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) | head -200
```

### 1.2 Identificar os "pontos de bateria" (entry points)

Antes de qualquer auditoria, você precisa saber **onde o jogo realmente roda**. Esses são os arquivos contra os quais você vai cruzar tudo:

| Tipo de arquivo | Por quê é "bateria" |
|---|---|
| `runMatchMinute.ts` (ou similar) | Loop principal de simulação por minuto |
| `MatchSession.ts` / `matchEngine.ts` | Estado e orquestração da partida |
| `OutcomeResolver.ts` | Quem decide o resultado de cada evento |
| `PlayerDecisionEngine.ts` | Onde o jogador "pensa" antes de agir |
| `simulateEvent.ts` / `eventDispatcher.ts` | Despache de ações |
| `tick.ts` / `gameLoop.ts` | Loop de frames |

Anote os caminhos exatos desses arquivos. **Toda a auditoria gira em torno deles.**

```bash
# Encontrar entry points reais (ajustar nomes conforme o projeto)
grep -rln "runMatchMinute\|MatchSession\|OutcomeResolver\|PlayerDecisionEngine" /mnt/user-data/uploads/ --include="*.ts" --include="*.tsx" --include="*.js"
```

---

## FASE 2 — Caçar Lógicas Órfãs (Shadow Logic)

### 2.1 Listar todos os arquivos "candidatos a órfãos"

Procure arquivos com nomes ambiciosos que sugerem comportamento profundo:

```bash
# Padrões clássicos de "arquivo cheio de promessa"
find /mnt/user-data/uploads/ -type f \( \
  -iname "*Behavior*" -o \
  -iname "*Buff*" -o \
  -iname "*DNA*" -o \
  -iname "*Knowledge*" -o \
  -iname "*Threat*" -o \
  -iname "*Pressing*" -o \
  -iname "*Hysteresis*" -o \
  -iname "*Desperation*" -o \
  -iname "*Momentum*" -o \
  -iname "*Awareness*" -o \
  -iname "*Trap*" -o \
  -iname "*Decision*" \
\) 2>/dev/null
```

### 2.2 Para cada candidato, fazer o teste de vida

Para cada arquivo encontrado, execute o **Teste de Três Perguntas**:

#### Pergunta 1 — Quem importa este arquivo?
```bash
# Pegue o nome do export principal (ex: applyMomentumBuff)
# Procure quem importa
grep -rn "from.*momentumBuff\|import.*momentumBuff" /mnt/user-data/uploads/ --include="*.ts" --include="*.tsx"
```

#### Pergunta 2 — Quem chama a função exportada?
```bash
# Substitua pelo nome real da função exportada
grep -rn "applyMomentumBuff\|momentumBuff(" /mnt/user-data/uploads/ --include="*.ts" --include="*.tsx"
```

#### Pergunta 3 — Algum dos chamadores é um entry point real?
- Se a função é chamada **apenas em testes** → órfã.
- Se é chamada **só por outros arquivos órfãos** → órfã em cascata (pior ainda).
- Se é chamada em `runMatchMinute` / `OutcomeResolver` / `PlayerDecisionEngine` → **viva**.

### 2.3 Classificar cada arquivo

| Status | Critério |
|---|---|
| 🟢 **Vivo** | Chamado direto ou indiretamente pelo loop principal |
| 🟡 **Semi-vivo** | Importado em algum lugar, mas a função nunca é executada |
| 🔴 **Órfão total** | Nenhum import, nenhum uso, código morto |
| ⚫ **Órfão em cascata** | Só usado por outros órfãos (ilha de código morto) |

---

## FASE 3 — Caçar Alucinações de Instalação

Esta é a parte mais cirúrgica. Você procura **comentários mentirosos** deixados pela IA em sessões passadas.

### 3.1 Padrões de comentário suspeito

```bash
# Comentários que a IA usa para fingir que algo está integrado
grep -rn "Integrated with\|Hooked into\|Called by\|Connected to\|Wired to\|Registered in\|Injected into\|Used by Engine" /mnt/user-data/uploads/ --include="*.ts" --include="*.tsx" --include="*.js"
```

### 3.2 Para cada match, validar a alegação

Exemplo de fluxo de validação:

```
Encontrado em momentumBuff.ts linha 12:
  // Integrated with runMatchMinute.ts via eventDispatcher

Validação:
  $ grep -n "momentumBuff" /caminho/runMatchMinute.ts
  → (sem resultado)
  
  $ grep -n "momentum" /caminho/eventDispatcher.ts
  → (sem resultado)

Veredito: ALUCINAÇÃO. O comentário é falso.
```

### 3.3 Evidência cruzada

Para cada alucinação encontrada, registre:
- **Arquivo onde o comentário mente:** caminho:linha
- **Texto exato do comentário:** copy/paste fiel
- **Onde a IA disse que estava integrado:** nome do arquivo alvo
- **Prova de que NÃO está:** o output do grep que retornou vazio

Sem evidência cruzada, **não acuse**. Esta skill exige rigor — se o usuário renomeou a função, pode parecer alucinação quando não é.

---

## FASE 4 — Auditar o "DNA Perdido"

Foco específico: arquivos que parecem ser o **alma do jogo** mas podem estar só de enfeite.

### 4.1 Alvos prioritários

```bash
# Arquivos típicos de "personalidade profunda"
find /mnt/user-data/uploads/ -type f \( \
  -iname "legendDNA*" -o \
  -iname "positionKnowledge*" -o \
  -iname "personality*" -o \
  -iname "playerProfile*" -o \
  -iname "trait*" -o \
  -iname "instinct*" \
\) 2>/dev/null
```

### 4.2 Teste do "Cálculo Real"

Para cada arquivo, responda:

1. **O que ele exporta?** (ex: `getLegendDNA(playerId): DNAProfile`)
2. **Onde o retorno dessa função é usado em decisões?**
3. **Esse "uso" altera de fato uma probabilidade, ou só é loggado?**

```bash
# Exemplo: rastrear se LegendDNA afeta decisão de passe
grep -rn "legendDNA\|getLegendDNA\|.dna\." /mnt/user-data/uploads/ --include="*.ts" | grep -v "test\|spec\|mock"
```

### 4.3 Diagnóstico binário

Para cada sistema "DNA-like":

| Veredito | Critério |
|---|---|
| 🧬 **DNA Vivo** | Os valores entram em fórmulas que mudam o resultado da partida |
| 💀 **DNA Decorativo** | É lido, mas o valor lido nunca afeta probabilidade nem comportamento |
| 👻 **DNA Fantasma** | Nem é lido pelo motor de decisão |

### 4.4 Quantificar o impacto perdido

Para cada DNA Decorativo ou Fantasma, escreva:

> "Se `legendDNA.calmness` fosse injetado em `PlayerDecisionEngine.shouldShootOrPass()`, jogadores calmos teriam X% mais chance de fazer o passe certo sob pressão. Hoje essa diferenciação **não existe na partida**, apesar do dado estar calculado."

Esse é o momento mais doloroso — e mais valioso — do mapa. Não suavize.

---

## FASE 5 — Detectar Desmerecimento de Conhecimento

Aqui você procura por **complexidade tática que foi reduzida a `Math.random()`**.

### 5.1 Mapear arquivos táticos vs. uso real no resolver

Alvos típicos: `pressingTrap.ts`, `offBallHysteresis.ts`, `defensiveLine.ts`, `tacticalShape.ts`, `compactness.ts`.

Para cada um:

```bash
# 1. Confirmar que existe lógica complexa
wc -l /caminho/pressingTrap.ts   # se < 30 linhas, talvez já seja stub

# 2. Pegar a função principal
grep "export" /caminho/pressingTrap.ts

# 3. Procurar uso no OutcomeResolver
grep -n "pressingTrap\|applyPressingTrap" /caminho/OutcomeResolver.ts
```

### 5.2 Detectar o "atalho genérico"

Dentro de `OutcomeResolver.ts`, procure padrões que **substituem inteligência por aleatoriedade**:

```bash
grep -n "Math.random\|Math.floor(Math.random\|>\s*0\.5\|>\s*0\.7" /caminho/OutcomeResolver.ts
```

Para cada `Math.random()` encontrado, pergunte:
- Existe um sistema tático que **deveria** estar pesando aqui?
- Em vez de `if (Math.random() < 0.3) tackleSuccess`, deveria ser `if (Math.random() < computePressingPressure(zone, formation, stamina)) tackleSuccess`?

### 5.3 Listar o "imposto da preguiça"

Documente cada lugar onde a tática rica foi achatada em uma constante mágica ou um random puro. Esses são os **maiores roubos de gameplay feeling**.

---

## FASE 6 — Gerar o Mapa Final

Salve o relatório em `/mnt/user-data/outputs/olefoot-ghost-map.md` usando este template:

```markdown
# 👻 Olefoot — Ghost Mapping Report
## Auditoria de Intenção do Fundador

**Data:** [data]
**Arquivos varridos:** [N arquivos `.ts/.tsx`]
**Entry points identificados:** [lista]

---

## 🎯 Veredito Geral

> [Frase de 1 linha. Exemplos:
>  - "O Olefoot está rodando 42% da inteligência que você escreveu."
>  - "Você tem 18 lógicas órfãs e 7 alucinações da IA. A boa notícia: o motor está limpo, basta ligar os cabos."]

**Score de Conexão:** X / 100
**Pontes a construir:** N

---

## 1. 🔴 Lógicas Órfãs (Shadow Logic)

### 1.1 `momentumBuff.ts`
- **A Promessa:** Aplicar bônus temporário a um time em boa fase de jogo (sequência de passes certos, posse alta).
- **A Realidade:** Importado em 0 arquivos. Função `applyMomentumBuff()` nunca é chamada no `runMatchMinute`. Evidência:
  ```
  $ grep -rn "momentumBuff" src/
  src/engine/momentumBuff.ts:1:export function applyMomentumBuff(...)
  (nenhuma outra ocorrência)
  ```
- **Intenção do Founder Perdida:** Você queria que o jogo "respirasse" — momentos em que um time está dominando deveriam reforçar essa dominância. Hoje, cada minuto é um reset estatístico. O jogo não tem memória de curto prazo.
- **Ponte:** Injetar `applyMomentumBuff(team, lastNEvents)` em `runMatchMinute.ts` antes do cálculo de `OutcomeResolver`.

[repetir para cada órfão encontrado]

---

## 2. 🤖 Índice de Alucinação de Instalação

### 2.1 Comentário mentiroso em `pressingTrap.ts:7`
- **Texto da mentira:**
  ```ts
  // Integrated with OutcomeResolver — used in tackle resolution
  ```
- **Prova de que não está:**
  ```
  $ grep -n "pressingTrap" src/engine/OutcomeResolver.ts
  (nada)
  ```
- **O que a IA fez:** Escreveu o sistema, comentou que estava integrado, mas pulou o passo de chamar a função no resolver. Você confiou no comentário.

[repetir para cada alucinação]

**Total de mentiras encontradas:** N

---

## 3. 🧬 DNA Perdido

### 3.1 `legendDNA.ts` — 💀 DNA Decorativo
- **O que ele faz:** Calcula 12 traços de personalidade por jogador (calmness, ambition, ego, etc.).
- **O que ele NÃO faz:** O retorno é guardado em `player.dna` mas nunca é lido por `PlayerDecisionEngine`. O jogador "tem" personalidade, mas joga como um robô neutro.
- **Impacto se injetado:**
  - `dna.calmness` em `shouldShootOrPass()` → jogadores calmos perdem menos a cabeça em finalizações decisivas
  - `dna.ego` em `passTargetSelection()` → jogadores egoístas escolhem chute em vez de passe quando deveriam tabelar
  - `dna.ambition` em `runOffBall()` → jogadores ambiciosos fazem mais sprints em movimentação ofensiva
- **Ponte recomendada:** Aceitar `dnaProfile` como segundo parâmetro em todas as funções de `PlayerDecisionEngine` e usar como modificador (ex: `baseChance * (1 + dna.calmness * 0.2)`).

### 3.2 `positionKnowledgeInit.ts` — 👻 DNA Fantasma
[seguir mesmo formato]

---

## 4. 🎭 Desmerecimento de Conhecimento Tático

### 4.1 `OutcomeResolver.ts:142` — Tackle resolvido por random puro

**O que está lá hoje:**
```ts
const tackleWon = Math.random() < 0.4;
```

**O que deveria estar:**
```ts
const tackleWon = Math.random() < computeTackleProbability({
  defenderStats,
  attackerStats,
  pressingPressure: getPressingPressure(zone, formation),
  defenderStamina,
  trapActive: isPressingTrapActive(team, zone),
});
```

**Sistemas desperdiçados aqui:**
- `pressingTrap.ts` (existe, não é usado)
- `offBallHysteresis.ts` (existe, não é usado)
- `defenderStamina` (calculado, não entra na conta)

**Imposto da preguiça:** Cada tackle do jogo é decidido por moeda viciada em 40%. Toda a profundidade tática que você escreveu **não influencia em nada** o resultado.

---

## 5. 🌉 Pontes a Construir (Plano de Ação)

Lista priorizada do que ligar primeiro. Ordem por **maior ganho de gameplay feeling com menor esforço**.

| # | Ponte | Arquivo origem | Arquivo destino | Esforço | Ganho |
|---|---|---|---|---|---|
| 1 | Injetar `momentumBuff` no loop | `momentumBuff.ts` | `runMatchMinute.ts` | 🟢 Baixo | 🔥🔥🔥 Alto |
| 2 | Conectar `legendDNA` no DecisionEngine | `legendDNA.ts` | `PlayerDecisionEngine.ts` | 🟡 Médio | 🔥🔥🔥 Alto |
| 3 | Substituir `Math.random()` do tackle | (vários) | `OutcomeResolver.ts:142` | 🟢 Baixo | 🔥🔥 Médio-Alto |
| ... | | | | | |

---

## 6. 📊 Métricas Honestas

- **Lógicas Órfãs Totais:** N arquivos
- **Linhas de código morto:** ~ N linhas
- **Alucinações documentadas:** N comentários falsos
- **Sistemas DNA decorativos:** N
- **`Math.random()` que poderiam ser inteligência:** N ocorrências
- **% do código que está realmente conectado ao loop:** ~XX%

---

## 7. 💡 Conclusão para o Founder

[Parágrafo direto e honesto. Exemplo:]

> Você não precisa escrever sistema novo. Você tem 80% do jogo pronto. O que falta é ligar 12 cabos específicos que estão caídos no chão. Comece pela ponte #1 — em 30 minutos de trabalho real você devolve ao jogo o "respiro de momentum" que ele não tem hoje. Depois vá descendo a lista. Em uma semana de implementação, o Olefoot deixa de ser uma casca e passa a usar a inteligência que você fez ele ter.
```

---

## FASE 7 — Entregar e Comunicar

1. Salve o arquivo em `/mnt/user-data/outputs/olefoot-ghost-map.md`
2. Use `present_files` para entregar.
3. No texto da resposta final, **resuma em voz alta os 3 achados mais dolorosos** — não suavize. O valor desta skill é justamente a brutalidade honesta do diagnóstico.

---

## Princípios Inegociáveis

> **Sem evidência de `grep`, não há acusação.**

- Toda alegação no mapa precisa vir com o comando que provou (output ou ausência de output).
- Não invente arquivos. Se a estrutura do projeto não bate com o esperado, **diga isso** e adapte.
- Se um arquivo tem nome ambicioso mas só 5 linhas de stub, isso por si só é um achado — registre como "stub mascarado de sistema".
- Não dê código de implementação no mapa principal. O mapa é diagnóstico. Implementação é outra skill (olefoot-analyzer / olefoot-smartfield).
- Seja **brutalmente honesto** sobre o gap entre intenção e realidade. O fundador pediu auditoria, não bajulação.

---

## Notas de Contexto do Olefoot

- Projeto TypeScript de simulador de futebol 2D web
- Match engine local, sem chamadas de IA durante a partida ao vivo
- Skills, bundles e DNA de jogadores são gerados na criação e devem influenciar gameplay
- O fundador escreveu sistemas profundos esperando que estivessem rodando — muitos não estão
- Esta skill existe porque sessões anteriores de IA entregaram código órfão acreditando estar integrado
