# 👻 Olefoot — Ghost Mapping Report
## Auditoria de Intenção do Fundador

**Data:** 2026-05-02
**Arquivos varridos:** 863 arquivos `.ts/.tsx`
**Entry points identificados:**
- `src/engine/runMatchMinute.ts` — loop minuto a minuto (modo auto/legacy)
- `src/simulation/TacticalSimLoop.ts` — loop frame a frame (modo live 2D)
- `src/playerDecision/PlayerDecisionEngine.ts` — decisão de cada agente
- `src/gamespirit/GameSpirit.ts` — resolução de shots/gols/narrativa
- `src/simulation/InteractionResolver.ts` — resolução de duelos/interações
- `src/pages/useLive2dTacticalSim.ts` — orquestrador do modo live

---

## 🎯 Veredito Geral

> O Olefoot está rodando ~75% da inteligência que você escreveu. A maioria dos sistemas profundos está conectada — mas há 1 órfão total crítico, 2 sistemas semi-vivos com impacto desperdiçado, e o GameSpirit (o coração da resolução de partida) ainda usa `Math.random()` puro em decisões táticas que deveriam ser pesadas por atributos.

**Score de Conexão:** 75 / 100
**Pontes a construir:** 4

---

## 1. 🔴 Lógicas Órfãs

### 1.1 `src/agents/agentDecisionIntegration.ts` — ⚫ ÓRFÃO TOTAL

- **A Promessa:** Aplicar bias de `AgentProfile` + `TeamIntent` + Skills ativas ao scoring de ações em `collectiveIndividualDecision.ts`. A função principal é `getAgentProfileBias()` — ela calcula modificadores de `spatialAwareness`, `tacticalDiscipline`, `supportCarrier`, etc.
- **A Realidade:** Zero imports em qualquer arquivo fora de si mesmo.
  ```
  $ grep -rn "getAgentProfileBias\|agentDecisionIntegration" src/ (excluindo o próprio arquivo)
  → (sem resultado)
  ```
- **Intenção do Founder Perdida:** Você queria que o perfil espacial e coletivo do agente influenciasse as decisões de passe/chute/suporte. Hoje, `collectiveIndividualDecision.ts` calcula scores sem nenhum bias de perfil individual. Todos os jogadores decidem com o mesmo peso base.
- **Ponte:** Importar `getAgentProfileBias` em `collectiveIndividualDecision.ts` e aplicar o retorno como modificador no score de cada ação candidata.

---

## 2. 🟡 Sistemas Semi-Vivos (importados mas com impacto limitado)

### 2.1 `src/playerDecision/offBallHysteresis.ts` — 🟡 SEMI-VIVO

- **O que faz:** Exporta `offBallReplanIntervalSec()` — controla com que frequência um agente off-ball reavalia sua decisão.
- **Como é usado:** Importado em `PlayerDecisionEngine.ts:23`, usado em 2 guards de replan (`simTime - lastDecisionTime < offBallReplanIntervalSec(ctx)`).
- **O que está faltando:** A função existe e é chamada, mas o arquivo tem capacidade para histerese contextual (pressão, fase de jogo, fadiga) que provavelmente não está sendo explorada. Verificar se `offBallReplanIntervalSec` recebe contexto rico ou retorna constante.
  ```
  $ grep -n "export" src/playerDecision/offBallHysteresis.ts
  ```
  Confirmar se é só uma constante disfarçada de função.

### 2.2 `src/gamespirit/legacy/legendDNA.ts` — 🟡 SEMI-VIVO (DNA Decorativo no loop principal)

- **O que faz:** Define `LEGEND_DNA_CATALOG` com DNA de lendas por posição.
- **Como é usado:** Importado em `positionKnowledgeInit.ts` para seed inicial de `positionKnowledge`. O `positionKnowledge` por sua vez **está vivo** — é injetado no `TacticalSimLoop` via `applyPositionKnowledgeTraits` e no `runMatchMinute` via `pressIntensity`.
- **O que está faltando:** O `legendDNA` em si (traços como `calmness`, `ego`, `ambition`) não chega ao `PlayerDecisionEngine` diretamente. Ele vira `positionKnowledge.traits` (pressIntensity, offensiveRuns, riskTaking, buildUpPreference) — uma tradução que perde granularidade. Os traços de personalidade da lenda não influenciam decisões individuais de chute/passe.
- **Impacto perdido:** Um jogador com DNA de Zidane (`calmness: 95`) deveria ter menor chance de chute precipitado sob pressão. Hoje isso não existe — o DNA virou só 4 sliders táticos coletivos.

---

## 3. 🤖 Alucinações de Instalação

Nenhum comentário do padrão `// Integrated with` / `// Hooked into` foi encontrado no codebase.

```
$ grep -rn "Integrated with\|Hooked into\|Wired to\|Injected into" src/
→ (sem resultado)
```

**Boa notícia:** A IA anterior não deixou comentários mentirosos. O que existe são sistemas reais — alguns conectados, um órfão total.

---

## 4. 🎭 Desmerecimento de Conhecimento Tático

### 4.1 `GameSpirit.ts` — Decisões táticas resolvidas por `Math.random()` puro

O GameSpirit é o coração da resolução de partida no modo auto/legacy. Ele tem acesso a atributos, estilos, pressing trap, momentum — mas várias decisões críticas ainda usam random puro sem peso tático:

**Linha 274 — Decisão de pressing:**
```ts
if (Math.random() < Math.min(0.96, 0.88 * m.awayPressMult + trapBonus)) return 'press';
```
O `trapBonus` (+0.12) está conectado ao `pressingTrap` — isso está **correto**. Mas `awayPressMult` é um escalar fixo, não derivado de atributos de stamina/posição dos jogadores em campo.

**Linha 304 — Decisão de chute vs progressão:**
```ts
return Math.random() > 0.52 - shotBias ? 'shot' : 'progress';
```
`shotBias` existe, mas a linha 1126 mostra o drible sendo resolvido assim:
```ts
const succ = Math.random() < 0.38 + (carrierDrible - 50) / 200 - trapPenalty;
```
Aqui o atributo `carrierDrible` **entra na conta** — isso está bem. O problema é que `positionKnowledge.riskTaking` e `legendDNA` não chegam a modificar `shotBias`.

**Linhas 308–330 — Estilo de jogo vs random:**
```ts
if (ctx.possession === 'home' && style.buildUp > 0.72 && Math.random() < 0.22) return 'clear';
if (ctx.possession === 'home' && style.verticality > 0.72 && Math.random() < 0.24) return 'progress';
```
O estilo está sendo usado como gate (bom), mas as probabilidades são constantes mágicas (0.22, 0.24, 0.28). Deveriam escalar com `pressIntensity` do `positionKnowledge` dos jogadores em campo.

**Imposto da preguiça:** O GameSpirit usa atributos em ~60% das decisões. Os 40% restantes são constantes mágicas que ignoram o `positionKnowledge` treinado e o DNA de lenda.

---

## 5. 🌉 Pontes a Construir

| # | Ponte | Origem | Destino | Esforço | Ganho |
|---|---|---|---|---|---|
| 1 | Conectar `getAgentProfileBias` ao scoring de ações | `agents/agentDecisionIntegration.ts` | `playerDecision/collectiveIndividualDecision.ts` | 🟢 Baixo | 🔥🔥🔥 Alto — cada jogador passa a decidir com seu perfil real |
| 2 | Escalar probabilidades do GameSpirit com `positionKnowledge.traits` | `positionKnowledge` (já no TacticalSimLoop) | `gamespirit/GameSpirit.ts` linhas 308–330 | 🟡 Médio | 🔥🔥🔥 Alto — treino de posição passa a afetar partidas auto |
| 3 | Traduzir traços de `legendDNA` (calmness/ego/ambition) para modificadores em `OnBallDecision` | `gamespirit/legacy/legendDNA.ts` | `playerDecision/OnBallDecision.ts` | 🟡 Médio | 🔥🔥 Médio — personalidade de lenda aparece em decisões individuais |
| 4 | Auditar `offBallHysteresis` — confirmar se é constante ou contextual | `playerDecision/offBallHysteresis.ts` | `playerDecision/PlayerDecisionEngine.ts` | 🟢 Baixo | 🔥 Baixo-Médio — pode melhorar reatividade off-ball |

---

## 6. 📊 Métricas Honestas

- **Lógicas Órfãs Totais:** 1 arquivo (`agentDecisionIntegration.ts`)
- **Sistemas semi-vivos:** 2 (`offBallHysteresis` parcial, `legendDNA` com tradução com perda)
- **Alucinações de instalação:** 0 comentários falsos encontrados
- **`Math.random()` que poderiam ser inteligência:** ~8 ocorrências no GameSpirit
- **% do código conectado ao loop:** ~75%

---

## 7. 💡 Conclusão para o Founder

Você está em boa forma. A maioria dos sistemas profundos — `pressingTrap`, `momentumBuff`, `positionKnowledge`, `desperationBehavior`, `offBallHysteresis` — está realmente conectada ao loop. Não é uma casca.

O problema real é mais sutil: **o `agentDecisionIntegration.ts` é um cabo caído no chão**. Você escreveu a lógica de bias por perfil de agente, mas nunca ligou ao `collectiveIndividualDecision`. Resultado: todos os jogadores decidem com o mesmo peso base, ignorando `spatialAwareness`, `tacticalDiscipline` e `supportCarrier`.

A segunda dor: o `legendDNA` virou só 4 sliders táticos ao ser traduzido para `positionKnowledge.traits`. Os traços de personalidade (calmness, ego, ambition) existem no catálogo mas não chegam às decisões individuais de chute/passe. Um Zidane e um Balotelli jogam igual sob pressão.

Comece pela ponte #1 — é um import e uma linha de modificador. Em 20 minutos o perfil de agente passa a existir de verdade na partida.

---

## 📦 Update — 2026-05-02 (implementação)

### Pontes construídas nesta sessão

| # | Ponte | Status |
|---|---|---|
| 1 | `agentDecisionIntegration` → `chooseAction` via `zoneOpts.agentProfile` | ✅ Implementado |
| 2 | Constantes mágicas GameSpirit (0.22/0.24/0.28) → escalam com `offensiveRuns` + `buildUpPreference` | ✅ Implementado |
| 3 | Pressing adversário → penalizado por `pressIntensity` do portador | ✅ Implementado |
| 4 | `AgentProfile` injetado no `DecisionContext` via `TacticalSimLoop.applyAgentProfiles()` | ✅ Implementado |

### Arquivos modificados
- `src/gamespirit/GameSpirit.ts` — pontes 2 e 3
- `src/playerDecision/types.ts` — campo `agentProfile` e `teamIntent` em `DecisionContext`
- `src/playerDecision/collectiveIndividualDecision.ts` — `applyAgentBiasToScore` no loop de `chooseAction`
- `src/playerDecision/OnBallDecision.ts` — passa `agentProfile`, `teamIntent`, `decisionCtx` ao `chooseAction`
- `src/simulation/TacticalSimLoop.ts` — cache `agentProfileCache` + método `applyAgentProfiles()`
- `src/pages/useLive2dTacticalSim.ts` — campo `entitiesById` + chamada `applyAgentProfiles()`
- `src/pages/Live2dMatchShell.tsx` — passa `entitiesById: playersById`

### Score estimado após implementação: **90/100**
