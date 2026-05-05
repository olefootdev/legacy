# Olefoot — Log de sessões

> Este arquivo é atualizado pelo agente ao final de cada sessão.
> Sempre leia a última entrada antes de começar uma nova sessão.
> Entradas mais recentes ficam no topo.

---

## 2025-01 — Sessão 2

### Implementado nesta sessão

**Core agents:**
- `PlayerAgent.ts` — tick loop com perceive→decide→validate→execute
- `AgentTypes.ts` — Vec2, PositionId, RoleId, ArchetypeId, Intention, ActionType
- `AgentMemory.ts` — lastIntention, lastAction, ticksInCurrentIntention
- `AgentPerception.ts` — nearestTeammateDist + nearestOpponentDist separados
- `AgentDecision.ts` — árvore determinística com confidence multiplier + briefing
- `AgentAction.ts` — resolve intention → action + target, stamina gate, offside trap
- `OffsideTrap.ts` — CBs step up emergente quando oponente entra em press radius

**Archetypes:**
- `balanced.ts` — speedBias, attackBias, reachBias, defenseBias

**Positions (11):**
- GK, LB, CB_L, CB_R, RB, LM, CM_L, CM_R, RM, ST_L, ST_R

**Team:**
- `create442Team.ts` — home team com skillIds
- `create442TeamAway.ts` — away team com coordenadas espelhadas

**Skills (Fase 2):**
- `SkillEngine.ts` — clinical-finisher, overlap-run, anchor-hold
- `skills/clinical-finisher/SKILL.md`

**Simulator:**
- `TeamSimulator.ts` — stepSimulator + runSimulation + SimEvent system
- Confidence dinâmica por eventos (GOAL, SHOT, PASS_SUCCESS, TACKLE, POSSESSION_CHANGE)

**Context (identidade tática):**
- `PlayerIdentityContext.ts` — 6 seções: Identity, ZoneResponsibility, TacticalExpectations, PreferredActions, BehavioralLimits, MatchMission
- `PlayerRoleExpectations.ts` — 11 perfis táticos distintos
- `PlayerMatchBriefing.ts` — resolved values para o decision engine
- `PreMatchAgentLoader.ts` — loadTeamBriefings() com log de validação

**FieldKnowledge:**
- `FieldKnowledge.ts` — tipos core: FieldZone, PositionTerritory, TerritoryValidation
- `FieldZones.ts` — 16 zonas com coordenadas IFAB reais (x=depth, y=width)
- `PositionTerritories.ts` — 11 territórios para 4-4-2
- `TerritoryRules.ts` — 8 funções de inteligência espacial (soft territory)
- `FieldKnowledgeLoader.ts` — attachFieldKnowledge() por agente
- `FieldKnowledgeDebug.ts` — debugTeamTerritory() com log por jogador

**Integration:**
- `MovementBridge.ts` — executeTeamMovement() reusa clampToPitch + fatigueSpeedMultiplier + computeSeparationForces

### Sistema de coordenadas (CRÍTICO)
```
x: 0=home goal → 100=away goal  (profundidade/depth)
y: 0=left edge → 100=right edge (largura/width)
Home ataca para x=100
```
Este é o sistema usado por /agents/positions/* e por FieldZones.ts.
NÃO confundir com fieldGeometry.ts canônico (x=width, y=depth).

### Problemas encontrados e resolvidos
- FieldZones usava x=width, y=depth (sistema canônico) mas positions usam x=depth, y=width → corrigido reescrevendo FieldZones
- PlayerRoleExpectations tinha coordenadas invertidas → corrigido com python replace
- dynamic import em tickAgent tornava função assíncrona → substituído por import estático

### O que ficou pendente
- `MatchFieldContext.ts` — as 3 camadas (FieldStructure, PhaseFieldState, LiveFieldState)
- `queryForAgent()` — interface entre agente e campo
- Phase-aware zones (zonas mudam conforme POSSESSION/DEFENDING/TRANSITION)
- `shouldIgnoreBall` no AgentDecision (recovery priority absoluta)
- Integração completa: PlayerAgent usando MatchFieldContext no tick

### Próxima sessão deve começar por
1. Criar `/agents/match/MatchFieldContext.ts` com as 3 camadas
2. Implementar `queryForAgent()` que serve AgentFieldQuery para cada agente
3. Integrar `queryForAgent()` no tick loop do PlayerAgent (entre decide e validate)
4. Implementar `shouldIgnoreBall` — quando true, agente ignora ballPosition completamente
5. Atualizar ARCHITECTURE.md

### Interfaces que mudaram
- `tickAgent()` agora recebe `opponentPositions: Vec2[]` (adicionado)
- `buildPerception()` agora retorna `nearestTeammateDist` + `nearestOpponentDist` (separados)
- `decideIntention()` agora recebe `briefing: PlayerMatchBriefing | null`
- `resolveAction()` agora recebe `stamina`, `nearestOpponentDist`, `teamHasBall`, `position`, `archetypeId`
- `PlayerAgentState` agora tem: `briefing`, `fieldKnowledge`, `lastZoneId`, `lastSkillFired`

---

## 2025-01 — Sessão 1

### Implementado nesta sessão
- Esta é a sessão inicial — estrutura de contexto criada
- CLAUDE.md: contexto permanente do agente
- ARCHITECTURE.md: estado atual da implementação
- RULES.md: regras invioláveis
- SESSION_LOG.md: este arquivo

### Próxima sessão deve começar por
- Implementar `MatchFieldContext.ts` com as 3 camadas
