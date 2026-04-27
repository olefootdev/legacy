# Auditoria: Arquitetura de Agentes Offline para Jogadores Gênesis

## 1. ONDE OS JOGADORES SÃO CARREGADOS DO SUPABASE

### Arquivos identificados:
- **`src/supabase/genesisMarket.ts`** — carrega jogadores Gênesis do catálogo `genesis_market_players`
- **`src/game/genesisTestSquads.ts`** — usa `genesisMarket` para montar squads de teste
- **`src/game/welcomeGenesisPack.ts`** — pack inicial de boas-vindas com jogadores Gênesis
- **`src/game/persistence.ts`** — rehydrate/migrate do localStorage + Supabase

### Fluxo atual:
1. Supabase retorna `PlayerEntity` com `attrs`, `pos`, `archetype`, `behavior`, `zone`
2. Jogador é inserido em `OlefootGameState.players` (Record<string, PlayerEntity>)
3. Escalação usa `lineup: Record<slotId, playerId>`

**✅ Ponto de entrada identificado**: após carregar do Supabase, antes de inserir no state.

---

## 2. ONDE OS ATRIBUTOS SÃO NORMALIZADOS

### Arquivos identificados:
- **`src/match/playerInMatch.ts`**
  - `matchAttributesFromPlayerEntity()` — converte `PlayerEntity.attrs` → `MatchPlayerAttributes`
  - `normalizeMatchAttributes()` — clamp 0-100
  - `createPlayerMatchRuntime()` — cria runtime com stamina, confidence, morale

### Estrutura atual:
```typescript
PlayerEntity.attrs → MatchPlayerAttributes {
  passeCurto, passeLongo, cruzamento,
  marcacao, velocidade, fairPlay,
  drible, finalizacao, fisico,
  tatico, mentalidade, confianca
}
```

**✅ Ponto de transformação identificado**: `matchAttributesFromPlayerEntity` é chamado ao criar `PitchPlayerState`.

---

## 3. ONDE A PARTIDA CALCULA MOVIMENTO

### Arquivos identificados:
- **`src/engine/test2d/tacticalPositioning.ts`** — `computeTacticalPositions()`
  - Posicionamento baseado em formação, fase tática, zona do campo
  - Usa `FORMATION_BASES` do catálogo
  - Aplica spacing, anti-chaos, role-aware movement

- **`src/engine/test2d/teamShape.ts`** — modifica shape por fase/intenção
- **`src/engine/test2d/antiChaosEngine.ts`** — previne bunching/movimento caótico
- **`src/engine/ultralive2d/applyAttrsToMovement.ts`** — attrs → movement knobs

### Fluxo atual:
1. `tacticalPositioning` calcula posição ideal por slot
2. `teamShape` ajusta por fase (in_possession / out_of_possession)
3. `antiChaosEngine` corrige sobreposição
4. Atributos (`velocidade`, `tatico`) influenciam velocidade de movimento

**✅ Movimento é tático, não individual**: jogadores seguem formação, não decidem onde ir.

---

## 4. ONDE A PARTIDA CALCULA DECISÃO

### Arquivos identificados (CRÍTICO):

#### **A) GameSpirit (Partida Rápida/Auto)**
- **`src/gamespirit/GameSpirit.ts`** — `gameSpiritTick()`
  - `pickAction()` — decide shot/pass/progress/recycle
  - `homeMayRegisterShot()` — elegibilidade de chute
  - `findFreeForwardTeammate()` — busca passe progressivo
  - Usa `SpiritContext` com bola, jogadores, zona, pressão

#### **B) PlayerDecisionEngine (Partida ao Vivo 2D)**
- **`src/playerDecision/PlayerDecisionEngine.ts`** — máquina de estados
  - Fases: `idle → scanning → deliberating → deciding → executing`
  - `tick()` — loop principal de decisão
  - Usa `DecisionContext` com carrier, receiver, pressure, space

- **`src/playerDecision/OnBallDecision.ts`** — `decideOnBall()`
  - Avalia opções: pass_safe, pass_progressive, carry, shoot, clearance
  - Usa `collectiveIndividualDecision.ts` para scoring
  - Considera zona, pressão, companheiros livres, xG

- **`src/playerDecision/OffBallDecision.ts`** — `decideOffBall()`
  - Movimento sem bola: support, press, hold_position, attack_space

- **`src/playerDecision/collectiveIndividualDecision.ts`** — **CORE DECISION LOGIC**
  - `chooseAction()` — scoring de ações com bias coletivo + individual
  - Usa `PlayerProfile` com `role`, `archetype`, `attributes`, `behavior`
  - Aplica bias por posição, arquétipo, mentalidade

#### **C) SmartField (Hint Tático)**
- **`src/smartfield/decision.ts`** — `getBestAction()`
  - Retorna hint de ação baseado em zona, pressão, geometria
  - GameSpirit prioriza hint quando confidence > 0.7

### Estrutura de decisão atual:
```typescript
DecisionContext {
  isCarrier, isReceiver,
  ball, teammates, opponents,
  pressure, space, threatLevel,
  collective: { phase, passChainLength, supportCount }
}

PlayerProfile {
  role: MatchTacticalRole,
  archetype: MatchCognitiveArchetype,
  attributes: MatchPlayerAttributes,
  behavior: PlayerBehavior
}

→ chooseAction() → ActionOption[]
→ pick best score → OnBallAction | OffBallAction
```

**✅ Decisão já usa perfil do jogador**: `role`, `archetype`, `attributes`, `behavior`.

---

## 5. ONDE AS SKILLS ATUAIS SÃO APLICADAS

### Arquivos identificados:
- **`src/match/skillActivation.ts`** — `SkillActivationSystem`
  - Gerencia cooldowns, ativação via comandos do treinador
  - `getActiveBehaviors()` — retorna behaviors ativos
  - `applyBehaviorBias()` — modifica score de decisão

- **`src/skills/skillEngine.ts`** — `resolveSkills()`
  - Aplica skills equipadas durante a partida
  - Tick de cooldowns

- **`src/skills/playbookV1.ts`** — catálogo de skills
  - Skills têm `behaviors` com `bias` por ação
  - Exemplo: `{ pass_progressive: +0.15, shoot: -0.08 }`

### Fluxo atual:
1. Jogador tem `PlayerEntity.skills: string[]` (IDs de skills equipadas)
2. Durante partida, skills são ativadas por comando ou contexto
3. `getActiveBehaviors()` retorna bias de skills ativas
4. `applyBehaviorBias()` modifica score de ações em `chooseAction()`

**✅ Skills já modificam decisão via bias**: sistema plugável existente.

---

## 6. ONDE O GAMESPIRIT INTERFERE NO COMPORTAMENTO

### Arquivos identificados:
- **`src/gamespirit/GameSpirit.ts`** — autoridade narrativa
  - Resolve shots, goals, narrative
  - `pickAction()` decide ação macro (shot/pass/progress)
  - Usa `SpiritContext` com momentum, zona, pressão

- **`src/gamespirit/spiritStateMachine.ts`** — fases Spirit
  - `open_play`, `buildup_gk`, `penalty`, `corner`, `free_kick`
  - Controla flow da partida

- **`src/gamespirit/contextualNarrative.ts`** — enriquece narrativa
- **`src/gamespirit/momentum.ts`** — calcula momentum por lado

### Interferência atual:
- GameSpirit **não controla movimento individual** (só macro: shot/pass/progress)
- PlayerDecisionEngine **executa decisão individual** (qual passe, qual movimento)
- GameSpirit **valida resultado** (shot → goal/save/wide)

**✅ GameSpirit é árbitro, não controlador**: valida, não decide por jogador.

---

## 7. ONDE O RESULTADO PÓS-JOGO É SALVO

### Arquivos identificados:
- **`src/game/reducer.ts`** — `FINALIZE_MATCH`
  - Atualiza `results`, `leagueSeason`, `playerSeasonLedger`
  - Aplica fadiga, lesão, evolução XP
  - Salva em localStorage + Supabase

- **`src/supabase/matchPersistence.ts`** — `insertMatch()`
  - Persiste partida completa no Supabase
  - Inclui stats, eventos, scout scoring

- **`src/team/playerSeasonLedger.ts`** — estatísticas agregadas
- **`src/team/playerEvolutionTimeline.ts`** — histórico evolutivo

**✅ Ponto de salvamento identificado**: após `FINALIZE_MATCH`, antes de persistir.

---

## 8. RESUMO: PONTOS DE INTEGRAÇÃO PARA AGENTES OFFLINE

### ✅ Onde plugar AgentProfile:

1. **Carregamento (Supabase → State)**
   - `src/game/persistence.ts` — após rehydrate
   - `src/supabase/genesisMarket.ts` — após fetch
   - **Action**: gerar `AgentProfile` se não existir

2. **Normalização (Entity → Match)**
   - `src/match/playerInMatch.ts` — `matchAttributesFromPlayerEntity()`
   - **Action**: enriquecer `PitchPlayerState` com `agentProfile`

3. **Decisão (Match Runtime)**
   - `src/playerDecision/collectiveIndividualDecision.ts` — `chooseAction()`
   - **Action**: usar `AgentProfile` para bias de decisão
   - **Fallback**: se não existir, usar lógica atual

4. **Skills (Equipamento Automático)**
   - `src/skills/skillEngine.ts` — `resolveSkills()`
   - **Action**: equipar skills baseado em `AgentProfile`

5. **Evolução (Pós-Jogo)**
   - `src/game/reducer.ts` — `FINALIZE_MATCH`
   - **Action**: atualizar `AgentProfile.learningState` baseado em eventos

---

## 9. ARQUIVOS QUE PRECISAM SER TOCADOS (ORDEM DE IMPLEMENTAÇÃO)

### Fase 1: Tipos e Factory (sem quebrar nada)
1. ✅ `src/agents/types.ts` — tipos `AgentProfile`, `SpatialProfile`, etc.
2. ✅ `src/agents/AgentProfileFactory.ts` — gera profile por posição/arquétipo
3. ✅ `src/agents/SkillRegistry.ts` — catálogo de skills offline

### Fase 2: Decisão (plugar no fluxo existente)
4. ✅ `src/agents/PlayerDecisionEngine.ts` — wrapper que usa `AgentProfile`
5. ✅ `src/agents/TeamIntentResolver.ts` — intenção coletiva do time
6. ✅ `src/playerDecision/collectiveIndividualDecision.ts` — adicionar bias de `AgentProfile`

### Fase 3: Carregamento (gerar profiles em runtime)
7. ✅ `src/game/persistence.ts` — gerar `AgentProfile` ao rehydrate
8. ✅ `src/supabase/genesisMarket.ts` — gerar `AgentProfile` ao fetch

### Fase 4: Evolução (aprendizado pós-jogo)
9. ✅ `src/agents/MatchLearningEngine.ts` — registra eventos importantes
10. ✅ `src/game/reducer.ts` — atualizar `AgentProfile` em `FINALIZE_MATCH`

### Fase 5: Persistência (opcional, salvar no Supabase depois)
11. ✅ `src/supabase/agentProfiles.ts` — CRUD de profiles
12. ✅ `src/entities/types.ts` — adicionar `PlayerEntity.agentProfile?: AgentProfile`

---

## 10. GARANTIAS DE NÃO-QUEBRA

### ✅ Fallbacks obrigatórios:
- Se `agentProfile` não existir → usar lógica atual
- Se factory falhar → log + continuar sem profile
- Se skill não existir → ignorar silenciosamente
- Se learning falhar → não bloquear salvamento

### ✅ Flags de debug:
- `localStorage.setItem('DEBUG_AGENTS', 'true')` → logs detalhados
- `localStorage.setItem('DISABLE_AGENTS', 'true')` → desabilitar sistema

### ✅ Testes de regressão:
- Partida rápida sem profiles → deve funcionar igual
- Partida ao vivo sem profiles → deve funcionar igual
- Admin/mercado → não deve quebrar

---

## 11. PRÓXIMOS PASSOS

1. ✅ Criar tipos base (`src/agents/types.ts`)
2. ✅ Criar factory (`src/agents/AgentProfileFactory.ts`)
3. ✅ Criar registry de skills (`src/agents/SkillRegistry.ts`)
4. ✅ Plugar no fluxo de decisão (`collectiveIndividualDecision.ts`)
5. ✅ Gerar profiles em runtime (`persistence.ts`, `genesisMarket.ts`)
6. ✅ Implementar learning (`MatchLearningEngine.ts`)
7. ✅ Testar em partida rápida
8. ✅ Testar em partida ao vivo
9. ✅ Persistir no Supabase (opcional)

---

**Conclusão**: A arquitetura atual já tem os hooks necessários. Podemos plugar agentes offline sem refatoração destrutiva, usando o sistema de `PlayerProfile` + `chooseAction()` existente e adicionando `AgentProfile` como camada evolutiva opcional.
