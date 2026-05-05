# Olefoot — Contexto Permanente do Agente

> Leia este arquivo inteiro antes de qualquer implementação.
> Depois leia ARCHITECTURE.md e a última entrada de SESSION_LOG.md.

---

## O que é este projeto

Olefoot é um match engine de futebol baseado em **agentes autônomos**.

Cada PlayerAgent é um agente independente que:
1. Percebe o ambiente (ballPosition, ownPosition, goalPosition, nearestPlayer)
2. Decide uma intenção (HOLD_POSITION, SUPPORT, PROGRESS, FINISH)
3. Valida o target contra o FieldKnowledge
4. Executa a ação (MOVE, RUN, PASS, SHOOT, TACKLE, HOLD)

O comportamento tático **emerge** dos agentes. Nenhum script externo controla jogadores.
A partida não é coreografada — ela acontece.

---

## Estrutura de diretórios (não altere sem registrar em SESSION_LOG.md)

```
/agents
  /core
    PlayerAgent.ts          ← tick loop principal (sagrado)
    AgentTypes.ts           ← Vec2, PositionId, RoleId, ArchetypeId, Intention, ActionType
    AgentMemory.ts          ← lastIntention, lastAction, ticksInCurrentIntention
    AgentPerception.ts      ← percepção dos 4 inputs
    AgentDecision.ts        ← árvore determinística: FINISH > PROGRESS > SUPPORT > HOLD
    AgentAction.ts          ← resolve intention → action + target

  /context
    PlayerIdentityContext.ts   ← identidade tática completa do jogador
    PlayerMatchBriefing.ts     ← briefing pré-partida
    PlayerRoleExpectations.ts  ← o que cada posição deve fazer
    PreMatchAgentLoader.ts     ← carrega contexto em cada agente antes do tick 0

  /fieldKnowledge
    FieldKnowledge.ts          ← interface principal consultada pelos agentes
    FieldZones.ts              ← 15 zonas nomeadas com coordenadas percentuais
    PositionTerritories.ts     ← territórios por posição no 4-4-2
    TerritoryRules.ts          ← funções de validação territorial
    FieldKnowledgeLoader.ts    ← carrega campo antes da partida
    FieldKnowledgeDebug.ts     ← logs de auditoria por agente

  /match
    MatchFieldContext.ts       ← estado vivo do campo (atualiza por tick e por fase)

  /archetypes
    defensive.ts
    balanced.ts
    offensive.ts
    aggressive.ts

  /positions
    /goalkeeper
    /defenders
    /midfielders
    /forwards

  /team
    create442Team.ts          ← instancia os 11 agentes com coordenadas corretas
```

---

## O tick loop é sagrado — nunca quebre esta ordem

```
perceive
  → decide intention
    → MatchFieldContext.queryForAgent()   ← consulta estado vivo do campo
      → TerritoryRules.validateTarget()  ← valida território
        → execute action
```

`MatchFieldContext.updateTick()` é chamado **UMA vez por tick**, antes de todos os agentes.
Cada agente chama `queryForAgent()` individualmente — mas o estado já está calculado.

---

## Regras que nunca podem ser violadas

**NUNCA:**
- Reescrever ou modificar o match engine existente fora de /agents
- Criar arquivos fora da estrutura /agents (exceto se explicitamente pedido)
- Hardcodar coordenadas — usar sempre `fieldWidth` e `fieldHeight` dinâmicos
- Misturar responsabilidades entre módulos (veja separação abaixo)
- Adicionar UI, animações ou chamadas a GameSpirit dentro dos agentes
- Fazer o agente agir sem passar pela validação territorial
- Usar `PlayerIdentityContext` apenas como sugestão — ele deve **vetar** ações proibidas
- Chamar `MatchFieldContext.updateTick()` mais de uma vez por tick

**SEMPRE:**
- Verificar ARCHITECTURE.md antes de criar qualquer arquivo novo
- Manter arquivos pequenos com responsabilidade única
- Logar o briefing de cada agente antes do tick 0 (ver FieldKnowledgeDebug.ts)
- Registrar o que foi feito em SESSION_LOG.md ao final de cada sessão

---

## Separação de responsabilidades (não misture)

| Módulo | Responsabilidade |
|--------|-----------------|
| `PlayerAgent` | Orquestra o tick. Chama percepção, decisão e ação. |
| `AgentDecision` | Decide a intenção. Não conhece o campo diretamente. |
| `FieldKnowledge` | Valida targets e territórios. Não decide intenções. |
| `MatchFieldContext` | Mantém estado vivo do campo. Atualiza uma vez por tick. |
| `PlayerIdentityContext` | Define identidade e veta ações proibidas. |
| `PreMatchAgentLoader` | Carrega contexto antes do tick 0. Não participa do loop. |

---

## Conceitos-chave que você precisa conhecer

### Phase-aware zones
As zonas permitidas de cada jogador mudam conforme a fase do jogo:
- `POSSESSION` → fullbacks podem subir, atacantes expandem
- `DEFENDING` → fullbacks ficam no corredor defensivo, compactação aumenta
- `TRANSITION_ATTACK` → meias avançam, atacantes pressionam linha
- `TRANSITION_DEFENSE` → todos recuam para bloco defensivo

### Recovery priority
Quando `shouldRecoverPosition()` retorna `true`, o agente **ignora** o `ballPosition`
e mira exclusivamente no `recoveryTarget`. Isso cria compactação defensiva sem scripts.

### queryForAgent()
Interface entre o agente e o campo. Retorna:
```typescript
{
  currentZone: ZoneId
  allowedZones: Zone[]
  primaryTerritory: Zone
  isOutOfPosition: boolean
  recoveryTarget: Vec2
  shouldIgnoreBall: boolean
  pressurePriority: 'HIGH' | 'MEDIUM' | 'LOW'
}
```

### Soft territory (não use hard clamp)
- Target levemente fora do território → permitir movimento
- Target profundamente fora → redirecionar para recoveryTarget
- Equipe com posse → expandir zonas de suporte
- Equipe defendendo → reduzir expansão ofensiva

---

## Formação base: 4-4-2

| Posição | Base (x,y) | Roam | Bias |
|---------|-----------|------|------|
| GK | (10, 50) | baixo | defensive |
| LB | (25, 20) | médio | support |
| CB_L | (25, 40) | baixo | defensive |
| CB_R | (25, 60) | baixo | defensive |
| RB | (25, 80) | médio | support |
| LM | (50, 15) | alto | offensive |
| CM_L | (50, 40) | médio | balanced |
| CM_R | (50, 60) | médio | balanced |
| RM | (50, 85) | alto | offensive |
| ST_L | (80, 40) | alto | offensive |
| ST_R | (80, 60) | alto | aggressive |

Coordenadas em unidades de campo (fieldWidth x fieldHeight).

---

## Estado atual da implementação

> Ver ARCHITECTURE.md para detalhe completo.
> Ver SESSION_LOG.md para o que foi feito na última sessão.
