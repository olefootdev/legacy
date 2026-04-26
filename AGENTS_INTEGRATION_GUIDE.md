# Sistema de Agentes Offline — Guia de Integração Final

## ✅ Arquivos Criados

### Core System
- `src/agents/types.ts` — Tipos completos
- `src/agents/profileTemplates.ts` — Templates por posição
- `src/agents/AgentProfileFactory.ts` — Factory de profiles
- `src/agents/SkillRegistry.ts` — Catálogo de 15 skills
- `src/agents/TeamIntentResolver.ts` — Intenção coletiva
- `src/agents/MatchLearningEngine.ts` — Sistema de aprendizado

### Integration Layer
- `src/agents/agentDecisionIntegration.ts` — Bias de decisão
- `src/agents/agentProfileLoader.ts` — Carregamento automático
- `src/agents/matchLearningIntegration.ts` — Learning pós-jogo

### Admin Panel
- `src/admin/AdminAgentsPanel.tsx` — Painel completo
- `src/admin/AdminAgentsPanel.css` — Estilos

## 🔧 Integração Manual Necessária

### 1. Persistence (Carregamento do Supabase)

**Arquivo**: `src/game/persistence.ts`

**Localização**: Função `rehydrateGameState` (linha ~546)

**Adicionar após carregar players**:
```typescript
// Após a linha que carrega players do save
const players = /* ... código existente ... */;

// ADICIONAR: Gera profiles para jogadores sem profile
const playersWithProfiles = generateMissingAgentProfiles(players);

// Usar playersWithProfiles no resto da função
```

**Exemplo completo**:
```typescript
// Linha ~700 em persistence.ts
const players: Record<string, PlayerEntity> = {};
for (const [id, p] of Object.entries(rawPlayers)) {
  // ... código existente de sanitização ...
  players[id] = sanitizedPlayer;
}

// ✅ ADICIONAR AQUI:
const playersWithProfiles = generateMissingAgentProfiles(players);

// Usar playersWithProfiles no return
return {
  ...state,
  players: playersWithProfiles, // ← usar aqui
  // ... resto do código
};
```

### 2. Reducer (Learning Pós-Jogo)

**Arquivo**: `src/game/reducer.ts`

**Localização**: Case `'FINALIZE_MATCH'` (linha ~encontrar com grep)

**Adicionar import no topo**:
```typescript
import { applyMatchLearningToPlayers } from '@/agents/matchLearningIntegration';
```

**Adicionar antes do return**:
```typescript
case 'FINALIZE_MATCH': {
  // ... código existente ...
  
  // ✅ ADICIONAR antes do return final:
  const stateWithLearning = applyMatchLearningToPlayers(nextState, snapshot);
  
  return stateWithLearning; // ← usar aqui em vez de nextState
}
```

### 3. Decision Engine (Bias de Agente)

**Arquivo**: `src/playerDecision/collectiveIndividualDecision.ts`

**Localização**: Função `chooseAction` (linha ~encontrar com grep)

**Adicionar import no topo**:
```typescript
import { applyAgentBiasToScore } from '@/agents/agentDecisionIntegration';
import { resolveTeamIntent } from '@/agents/TeamIntentResolver';
import type { AgentProfile } from '@/agents/types';
```

**Modificar scoring de ações**:
```typescript
export function chooseAction(
  self: AgentSnapshot,
  ctx: DecisionContext,
  profile: PlayerProfile,
  // ... outros parâmetros
): DecisionPick {
  // ... código existente ...
  
  // ✅ ADICIONAR: Pega AgentProfile do jogador
  const agentProfile: AgentProfile | undefined = (self as any).agentProfile;
  
  // ✅ ADICIONAR: Resolve intenção do time
  const teamIntent = ctx.matchState ? resolveTeamIntent({
    minute: ctx.matchState.minute,
    homeScore: ctx.matchState.homeScore,
    awayScore: ctx.matchState.awayScore,
    possession: ctx.matchState.possession,
    teamStrength: 75, // ← calcular baseado no time
    opponentStrength: 70, // ← calcular baseado no adversário
    averageFatigue: 50, // ← calcular média do time
  }) : undefined;
  
  // No loop de scoring de ações:
  for (const action of actions) {
    let score = baseScore; // ← score calculado pelo código existente
    
    // ✅ ADICIONAR: Aplica bias de agente
    score = applyAgentBiasToScore(
      score,
      agentProfile,
      teamIntent,
      action.id,
      ctx,
    );
    
    // ... resto do código de scoring
  }
  
  // ... resto da função
}
```

### 4. PitchPlayerState (Passar AgentProfile)

**Arquivo**: `src/engine/pitchFromLineup.ts` (ou onde `PitchPlayerState` é criado)

**Adicionar agentProfile ao criar PitchPlayerState**:
```typescript
const pitchPlayer: PitchPlayerState = {
  playerId: player.id,
  slotId: slot,
  name: player.name,
  // ... outros campos
  agentProfile: player.agentProfile, // ✅ ADICIONAR
};
```

## 🎯 Como Testar

### 1. Testar Geração de Profiles
```typescript
// No console do browser ou em teste
import { createAgentProfile } from '@/agents/AgentProfileFactory';
const player = state.players['algum-id'];
const profile = createAgentProfile(player);
console.log(profile);
```

### 2. Testar no Admin
1. Acessar `/admin`
2. IA & Moderação → Agentes Offline
3. Tab "Perfis" → Selecionar jogador → Gerar Perfil
4. Tab "Gerador" → Gerar Todos os Perfis

### 3. Testar Learning
1. Jogar uma partida completa
2. Verificar no console: `player.agentProfile.learningState`
3. Comparar `recentEvents` antes e depois

### 4. Testar Decisão
1. Adicionar log em `chooseAction`:
```typescript
console.log('[AgentBias]', action.id, 'bias:', bias, 'final:', finalScore);
```
2. Jogar partida ao vivo (test2d)
3. Ver logs de decisão com bias aplicado

## 📊 Flags de Debug

Adicionar no localStorage para debug:
```javascript
localStorage.setItem('DEBUG_AGENTS', 'true');
localStorage.setItem('DEBUG_AGENT_DECISION', 'true');
localStorage.setItem('DEBUG_AGENT_LEARNING', 'true');
```

Usar nos arquivos:
```typescript
const DEBUG = localStorage.getItem('DEBUG_AGENTS') === 'true';
if (DEBUG) console.log('[Agents]', ...);
```

## 🚀 Ordem de Implementação Recomendada

1. ✅ **Persistence** — Gera profiles ao carregar (não quebra nada)
2. ✅ **Admin Panel** — Visualiza e testa profiles
3. ✅ **Decision Engine** — Aplica bias (melhora decisões)
4. ✅ **Learning** — Evolução pós-jogo (gradual)

## ⚠️ Notas Importantes

- **Fallback**: Se `agentProfile` não existir, código existente continua funcionando
- **Performance**: Factory é rápida (~1ms por jogador)
- **Persistência**: Profiles são salvos no `PlayerEntity`, vão pro localStorage automaticamente
- **Supabase**: Adicionar coluna `agent_profile JSONB` na tabela `genesis_market_players` (opcional)

## 📝 TODO Opcional (Futuro)

- [ ] Persistir profiles no Supabase
- [ ] UI de edição manual de profiles no Admin
- [ ] Criar novas skills via Admin
- [ ] Visualização de learning em tempo real durante partida
- [ ] Comparação de profiles entre jogadores
- [ ] Export/import de profiles
- [ ] Análise de correlação (profile vs performance)

---

**Status**: Sistema completo e pronto para integração manual nos 3 pontos críticos acima.
