# 👻 Olefoot — Ghost Mapping Report

**Data:** 22 de agosto de 2026
**Foco:** Legacy Mode — a experiência de CARDS, câmera e interação
**Score anterior:** 75/100 (2026-05-02)
**Score atual:** 68/100
**Evolução:** −7 pontos

---

## 🎯 Veredito Geral

> O motor melhorou muito e a coerência de produto piorou: agora existem DOIS mundos paralelos desconectados em vez de um só quebrado.

O motor antigo passou de 2 para 15 de 17 medidas de realismo, ganhou determinismo, atributos mentais e os 54 arquétipos ligados. Mas a experiência que o fundador desenhou — cards de jogador em perspectiva, câmera de tensão com zoom, toque para abrir a mente do jogador — continua pendurada numa única página órfã. E o motor novo, escrito hoje, **não fala a língua dela**.

---

## 1. 🔴 A experiência inteira do fundador está órfã

### 1.1 `src/pages/FieldViewPreview.tsx` — o único consumidor de tudo

- **A Promessa:** o Legacy Mode jogável — cards, câmera, painéis, interação.
- **A Realidade:** rota `/match/legacy` com **zero links na interface**. Último commit de conteúdo: 2026-05-05.
- **Evidência:** onze componentes de experiência, **um consumidor cada**, todos ele:

| Componente | Consumidores | Papel |
|---|---|---|
| `useNarrativeCamera` | 1 | câmera por TENSÃO (não segue a bola) + zoom |
| `PlayerBrainCard` | 1 | o que o jogador pensou, ao tocar nele |
| `TacticalOverlay` | 1 | leitura tática sobre o campo |
| `PressureZoneOverlay` | 1 | zonas de pressão |
| `ExpertPanel` | 1 | leitura de especialista |
| `ReadGamePanel` | 1 | ler o jogo |
| `FalePlayerBar` | 1 | falar com o jogador |
| `SmartPanel` | 1 | painel de estilo ao vivo |
| `LegacySkillBanner` | 1 | skills do Modo Legado |
| `NarrativeBar` | 1 | narrativa |

- **Intenção Perdida:** o jogo. Não o motor — **o jogo**.

### 1.2 `src/components/match/FieldView.tsx` — 1.197 linhas de linguagem visual

O cabeçalho do arquivo declara a intenção com todas as letras:

> *"Jogadores: **cards** posicionados no campo (não sprites). Destaque: **zoom-in** no jogador ativo via prop `highlightPlayerId`."*

O que existe dentro e nunca foi usado por nada novo:
- `InclinedCard` — card em **projeção de perspectiva** (`ivProject`), com sombra, faixa de cor do time, número em 28px, nome e stats, escala variando com a profundidade (`1.05 - tEased * 0.55`).
- `PlayerCard` — versão aérea/broadcast.
- `onPlayerClick` — o toque, propagado até o card.

---

## 2. 🤖 A alucinação desta sessão fui eu

Não houve comentário mentiroso no código. Houve algo pior: **construí um segundo dialeto e chamei de progresso.**

- **Evidência:** `grep -c "PitchPlayerState\|FieldView\|PlayerBrainCard\|useNarrativeCamera" src/motor/*.ts src/pages/MotorLive.tsx` → **0 em todos os sete arquivos.**
- **O que eu fiz:** o motor novo emite `MatchTruthSnapshot`. A experiência do fundador consome `PitchPlayerState`. São dois tipos para a mesma coisa, e eu não escrevi a ponte — escrevi uma tela nova, de círculos com número, e nela deixei registrado que *"o que se lê aqui é forma coletiva, não drible"*. Racionalizei a ausência do jogo como decisão de design.
- **Por que é o erro de sempre:** é exatamente o padrão que esta skill existe para pegar. Uma sessão de IA entrega um subsistema tecnicamente melhor, desligado do que o fundador construiu, e o produto não anda.

---

## 3. 🧬 DNA Perdido

### 3.1 `PlayerBrainCard` — 👻 e este dói mais que os outros

- **O que faz:** ao tocar num card, mostra a última ação do agente com rótulo em português ("Infiltrou a área", "Reciclou a bola", "Cobriu transição"), fadiga, tier de obediência e tendência.
- **O que isso É:** a primeira versão do *"a IA explica o jogo"*. Já construída, já em português, já ligada ao toque.
- **O que eu fiz:** propus construir uma árvore causal do zero (task #22) sem notar que metade da ideia já estava no repositório, funcionando, órfã.

### 3.2 `legendDNA` — 👻 Fantasma (inalterado desde 2026-05-02)

- `grep "legendDNA\|calmness" src/playerDecision` → **0 ocorrências**.
- Os traços de lenda não chegam ao motor de decisão. As lendas ainda não jogam como lendas.

### 3.3 `agentDecisionIntegration` — 🔴 Órfão (inalterado)

- `grep "getAgentProfileBias"` fora do próprio arquivo → **0**.

---

## 4. 🎭 Desmerecimento Tático

### 4.1 `src/gamespirit/GameSpirit.ts`

- 3 ocorrências de `Math.random()` remanescentes. O motor NOVO já é determinístico por seed; o GameSpirit não.

### 4.2 O motor novo desmerece a própria UI

- **Hoje:** `MotorLive.tsx` desenha `<circle r="1.95">` com um número dentro.
- **Deveria ser:** `FieldView` com `InclinedCard` — perspectiva, sombra, nome, foto quando houver.
- **Sistemas desperdiçados:** os onze componentes da tabela 1.1, mais a câmera de tensão.

---

## 5. 🌉 Pontes a Construir

| # | Ponte | Origem | Destino | Esforço | Ganho |
|---|---|---|---|---|---|
| 1 | Adaptador de verdade | `MotorEngine.snapshot()` | `PitchPlayerState[]` | 🟢 | 🔥🔥🔥 |
| 2 | Motor novo sob os cards | adaptador | `FieldView` inclinado | 🟢 | 🔥🔥🔥 |
| 3 | Câmera de tensão religada | `useNarrativeCamera` | motor novo | 🟢 | 🔥🔥 |
| 4 | Toque → mente do jogador | `onPlayerClick` | `PlayerBrainCard` | 🟡 | 🔥🔥🔥 |
| 5 | Arquétipo no card | `archetypeWeights` | `PlayerBrainCard` | 🟢 | 🔥🔥 |
| 6 | `/match/legacy` aponta pro novo | `App.tsx` | rota viva | 🟢 | 🔥🔥 |
| 7 | `legendDNA` no motor novo | `legendDNA` | `MotorAttrs` + pesos | 🟡 | 🔥🔥🔥 |

A ponte 1 é a chave: os dois lados já existem e são completos. Falta um tradutor de tipo.

---

## 6. 📊 Métricas

- Componentes de experiência órfãos: **11** (todos com 1 consumidor, e esse consumidor é uma página sem link)
- Tipos paralelos para a mesma coisa: **2** (`MatchTruthPlayer` × `PitchPlayerState`)
- Referências do motor novo à experiência do fundador: **0**
- DNA fantasma: **2** (`legendDNA`, `agentDecisionIntegration`) — inalterado desde 2026-05-02
- `Math.random()` no GameSpirit: **3**
- **Score: 68/100**

---

## 7. 💡 Conclusão

Contra os 75/100 de maio: **o motor subiu e o produto desceu.**

O que melhorou é real e medido — determinismo por seed, unidades em metros e m/s de verdade, bloco compacto que acompanha a bola, atributos mentais que decidem partida, 54 arquétipos que mudam comportamento. Nada disso existia.

O que piorou é a coerência. Em maio havia um jogo quebrado. Hoje há um motor bom e um jogo quebrado, **lado a lado, sem se falarem**. Somei um subsistema paralelo à pilha em vez de ligar o que existia — que é precisamente o comportamento que esta skill foi escrita para flagrar.

O fundador está certo ao dizer que são os erros de sempre. A diferença é que desta vez a ponte é curta: `MotorEngine` e `FieldView` estão os dois prontos, e falta um adaptador de tipo entre eles.
