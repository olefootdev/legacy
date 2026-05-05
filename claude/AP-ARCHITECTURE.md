# Olefoot — Estado atual da arquitetura

> Atualize este arquivo ao final de cada sessão produtiva.
> Seja preciso: escreva o que EXISTE e funciona, não o que você planeja.

---

## Implementado e funcionando ✅

### /agents/core
- [x] `AgentTypes.ts` — Vec2, PositionId, RoleId, ArchetypeId, Intention, ActionType, ZoneConstraint
- [x] `AgentMemory.ts` — lastIntention, lastAction, ticksInCurrentIntention
- [x] `AgentPerception.ts` — nearestTeammateDist + nearestOpponentDist (separados)
- [x] `AgentDecision.ts` — árvore determinística + confidence multiplier + briefing integration
- [x] `AgentAction.ts` — stamina gate, SUPPORT passing lane, offside trap hook
- [x] `OffsideTrap.ts` — CBs step up emergente (Fase 3)
- [x] `PlayerAgent.ts` — tick loop: perceive→decide→skill→fieldValidate→move

### /agents/archetypes
- [x] `balanced.ts` — speedBias, attackBias, reachBias, defenseBias (+ getArchetypeModifiers)

### /agents/positions (11 posições)
- [x] GK, LB, CB_L, CB_R, RB, LM, CM_L, CM_R, RM, ST_L, ST_R

### /agents/team
- [x] `create442Team.ts` — home team com skillIds
- [x] `create442TeamAway.ts` — away team com coordenadas espelhadas (x=100-x)

### /agents/skills
- [x] `SkillEngine.ts` — clinical-finisher, overlap-run, anchor-hold
- [x] `skills/clinical-finisher/SKILL.md`

### /agents/sim
- [x] `TeamSimulator.ts` — stepSimulator + runSimulation + SimEvent system
- [x] Confidence dinâmica por eventos (Fase 4): GOAL, SHOT, PASS_SUCCESS, TACKLE, POSSESSION_CHANGE

### /agents/context
- [x] `PlayerIdentityContext.ts` — 6 seções estruturadas
- [x] `PlayerRoleExpectations.ts` — 11 perfis táticos distintos
- [x] `PlayerMatchBriefing.ts` — resolved values para decision engine
- [x] `PreMatchAgentLoader.ts` — loadTeamBriefings() com log de validação

### /agents/fieldKnowledge
- [x] `FieldKnowledge.ts` — tipos core: FieldZone, PositionTerritory, TerritoryValidation, FieldKnowledge
- [x] `FieldZones.ts` — 16 zonas com coordenadas IFAB reais
- [x] `PositionTerritories.ts` — 11 territórios para 4-4-2
- [x] `TerritoryRules.ts` — 8 funções: getZoneForCoordinate, isPointInsidePrimary, isPointForbidden, shouldRecoverPosition, clampTargetToAllowedTerritory, validateAgentTarget
- [x] `FieldKnowledgeLoader.ts` — attachFieldKnowledge() por agente
- [x] `FieldKnowledgeDebug.ts` — debugTeamTerritory() com log por jogador

### /agents/integration
- [x] `MovementBridge.ts` — executeTeamMovement() reusa clampToPitch + fatigueSpeedMultiplier + computeSeparationForces
- [x] `DISCOVERY.md` — mapa de sistemas existentes reutilizáveis

---

## Implementado mas incompleto ⚠️

- [ ] `TerritoryRules` — soft territory funciona mas não tem phase-awareness ainda
- [ ] `PlayerAgent.tickAgent()` — valida território mas não consulta MatchFieldContext (ainda não existe)
- [ ] `AgentDecision` — não tem `shouldIgnoreBall` (recovery priority absoluta)

---

## Não implementado ainda ❌

### /agents/match (pasta não existe ainda)
- [ ] `MatchFieldContext.ts` — estado vivo do campo com 3 camadas:
  - `FieldStructure` (imutável, carrega uma vez)
  - `PhaseFieldState` (atualiza por mudança de posse)
  - `LiveFieldState` (atualiza por tick)
- [ ] `queryForAgent()` — retorna AgentFieldQuery personalizado por agente
- [ ] Phase-aware zones — zonas mudam conforme POSSESSION/DEFENDING/TRANSITION_*
- [ ] `shouldIgnoreBall` — quando true, agente ignora ballPosition completamente
- [ ] Directional alignment check para SHOOT/FINISH

---

## Sistema de coordenadas (CRÍTICO — não confundir)

```
Sistema dos agentes (/agents/positions/* e FieldZones.ts):
  x: 0=home goal → 100=away goal  (profundidade/depth)
  y: 0=left edge → 100=right edge (largura/width)
  Home ataca para x=100

Sistema canônico fieldGeometry.ts (src/tactical/):
  x: 0=left → 100=right  (largura)
  y: 0=home → 100=away   (profundidade)
  INVERSO do sistema dos agentes
```

MovementBridge.ts faz a conversão entre os dois sistemas.

---

## Interfaces críticas (não mude as assinaturas sem anotar aqui)

```typescript
// tick loop principal
function tickAgent(
  agent: PlayerAgentState,
  ballPosition: Vec2,
  goalPosition: Vec2,
  teammatePositions: Vec2[],
  opponentPositions: Vec2[],
  teamHasBall: boolean,
  ballCarrierId: string | null,
): PlayerAgentState

// consulta ao campo por agente (A IMPLEMENTAR)
function queryForAgent(
  agent: PlayerAgentState,
  liveState: LiveFieldState,
  phaseState: PhaseFieldState,
): AgentFieldQuery

// atualização do estado vivo (uma vez por tick)
function updateTick(
  tick: number,
  ballPos: Vec2,
  homePlayers: PlayerAgentState[],
  awayPlayers: PlayerAgentState[],
  possession: 'home' | 'away' | null,
): LiveFieldState

// validação territorial (já existe em TerritoryRules.ts)
function validateAgentTarget(
  knowledge: FieldKnowledge,
  currentPos: Vec2,
  proposedTarget: Vec2,
  gameState: TerritoryGameState,
): TerritoryValidation
```

---

## Decisões arquiteturais registradas

| Data | Decisão | Motivo |
|------|---------|--------|
| 2025-01 | x=depth, y=width nos agentes | Consistência com /agents/positions/* existentes |
| 2025-01 | Soft territory (não hard clamp) | Hard clamp cria movimento robótico |
| 2025-01 | updateTick() uma vez por tick | Evita recalcular estado para cada um dos 11 agentes |
| 2025-01 | PlayerIdentityContext como veto | Sugestão era ignorada no momento de decisão |
| 2025-01 | MovementBridge como camada separada | PlayerAgent nunca manipula currentPosition diretamente |
| 2025-01 | SimEvent system no TeamSimulator | Confidence dinâmica sem acoplamento entre agentes |
