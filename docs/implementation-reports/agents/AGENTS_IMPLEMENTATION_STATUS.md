# Sistema de Agentes Offline — Implementação Completa

## ✅ Fase 1: Tipos e Factory (CONCLUÍDO)

### Arquivos criados:
- ✅ `src/agents/types.ts` — Tipos completos (AgentProfile, SpatialProfile, TeamProfile, etc.)
- ✅ `src/agents/profileTemplates.ts` — Templates por posição (GOL, ZAG, LE, LD, VOL, MC, PE, PD, ATA, CA)
- ✅ `src/agents/AgentProfileFactory.ts` — Factory que gera profiles baseado em posição + atributos + arquétipo + raridade
- ✅ `src/agents/SkillRegistry.ts` — Catálogo de 15 skills offline (spatial, team, individual, risk, critical)

### Skills implementadas:
1. **Spatial**: spatial_awareness, scan_before_receive
2. **Team**: team_support, overlap_run, defensive_recovery, hold_position
3. **Individual**: safe_pass_under_pressure, progressive_pass, attack_space, shoot_window, selfish_finish_bias
4. **Critical**: critical_composure
5. **Goalkeeper**: gk_positioning

## ✅ Fase 2: Decisão e Intenção (CONCLUÍDO)

### Arquivos criados:
- ✅ `src/agents/TeamIntentResolver.ts` — Resolve intenção coletiva do time (control_game, press_high, protect_result, seek_draw, accelerate_attack, reorganize)
- ✅ Bias de decisão por intenção do time

## ✅ Fase 3: Learning (CONCLUÍDO)

### Arquivos criados:
- ✅ `src/agents/MatchLearningEngine.ts` — Sistema de aprendizado pós-jogo
- ✅ Captura eventos: pass_ok/fail, shot_ok/fail, duel_won/lost, critical_error/success, selfish_ok/fail
- ✅ Atualiza LearningState: confidence, riskTendency, passVsShootPreference, criticalComposure, tacticalDiscipline, egoControl

## ✅ Painel Admin (CONCLUÍDO)

### Arquivos criados:
- ✅ `src/admin/AdminAgentsPanel.tsx` — Painel completo com 5 tabs
- ✅ `src/admin/AdminAgentsPanel.css` — Estilos completos
- ✅ Integrado em `src/admin/AdminDashboard.tsx`

### Tabs implementadas:
1. **📊 Perfis** — Visualiza AgentProfile de qualquer jogador
   - Lista de jogadores
   - Botão "Gerar Perfil"
   - Visualização completa: Spatial, Team, Individual, Risk, Critical, Skills, Learning
   - Validação de perfil

2. **⚡ Skills** — Catálogo de skills
   - Filtros por categoria (spatial, team, individual, risk, critical)
   - Detalhes de cada skill (when, score, bias, cooldown)
   - Código fonte das funções

3. **🏭 Gerador** — Geração em massa
   - Gera profiles para todos os jogadores do plantel
   - Estatísticas: total, sucesso, falhas
   - Lista de erros

4. **🧪 Testes** — Testes interativos
   - Teste de Intenção do Time (sliders para minuto, placar, força, fadiga)
   - Teste de Skills por Posição

5. **📈 Aprendizado** — Documentação do sistema
   - Como funciona
   - Eventos capturados
   - Evolução

## 🎯 Como Usar

### 1. Acessar o Painel Admin
```
/admin → IA & Moderação → Agentes Offline
```

### 2. Gerar Perfil de um Jogador
1. Tab "Perfis"
2. Selecionar jogador na lista
3. Clicar "Gerar Perfil"
4. Visualizar todos os perfis (Spatial, Team, Individual, Risk, Critical)

### 3. Visualizar Skills
1. Tab "Skills"
2. Filtrar por categoria
3. Clicar em skill para ver detalhes

### 4. Gerar Perfis em Massa
1. Tab "Gerador"
2. Clicar "Gerar Todos os Perfis"
3. Ver estatísticas e erros

### 5. Testar Intenção do Time
1. Tab "Testes"
2. Ajustar sliders (minuto, placar, força, fadiga)
3. Ver intenção resolvida em tempo real

## 🔧 Próximos Passos (Integração com Partida)

### Para plugar no fluxo de decisão:
1. Modificar `src/playerDecision/collectiveIndividualDecision.ts`
2. Adicionar bias de `AgentProfile` em `chooseAction()`
3. Usar `TeamIntentResolver` para bias coletivo
4. Aplicar skills ativas via `SkillRegistry`

### Para persistir profiles:
1. Adicionar `agentProfile?: AgentProfile` em `PlayerEntity` (`src/entities/types.ts`)
2. Gerar profiles ao carregar do Supabase (`src/game/persistence.ts`)
3. Atualizar profiles pós-jogo (`src/game/reducer.ts` FINALIZE_MATCH)

### Para learning pós-jogo:
1. Instanciar `MatchLearningCapture` no início da partida
2. Capturar eventos durante a partida (pass_ok/fail, shot_ok/fail, etc.)
3. Aplicar learning em FINALIZE_MATCH via `updateAgentProfileWithLearning()`

## 📊 Estrutura de Dados

### AgentProfile
```typescript
{
  playerId: string,
  position: string,
  role: string,
  archetype: string,
  spatialProfile: { spatialAwareness, scanBeforeReceive, runTiming, defensivePositioning },
  teamProfile: { supportCarrier, tacticalDiscipline, teamCommunication, defensiveCover, collectiveMovement },
  individualProfile: { creativity, decisionUnderPressure, ballConfidence, vision, technicalExecution },
  riskProfile: { baseRisk, riskUnderPressure, riskWhenLosing, riskWhenWinning, dribbleVsPass },
  criticalProfile: { criticalComposure, ego, crowdPressureReaction, selfishVsTeam, finishingConfidence },
  equippedSkills: string[],
  learningState: { confidence, riskTendency, passVsShootPreference, criticalComposure, tacticalDiscipline, egoControl, recentEvents },
  createdAt: string,
  updatedAt: string,
  version: number
}
```

### SkillDefinition
```typescript
{
  id: string,
  name: string,
  description: string,
  category: 'spatial' | 'team' | 'individual' | 'risk' | 'critical',
  positions: string[],
  when: (ctx) => boolean,
  score: (ctx) => number,
  bias: Record<string, number>,
  cooldown: number
}
```

## 🎨 Design

- Tema dark (BVB yellow + dark slate)
- Tabs horizontais
- Grid responsivo (lista + detalhes)
- Stat bars com cores dinâmicas (verde/azul/laranja/vermelho)
- Chips de skills por categoria
- Validação visual (✅/❌)

## 🚀 Status

**IMPLEMENTAÇÃO COMPLETA**
- ✅ Tipos e Factory
- ✅ Skills Registry
- ✅ Team Intent Resolver
- ✅ Match Learning Engine
- ✅ Painel Admin completo
- ✅ Integrado no AdminDashboard
- ⏳ Aguardando integração com fluxo de decisão da partida
