# Auditoria: Conexões Admin → Jogo

**Data**: 2026-04-25  
**Objetivo**: Mapear todas as conexões entre o painel Admin e o estado do jogo

## ✅ Conexões Ativas e Funcionais

### 1. **Player Evolution Panel** (`AdminPlayerEvolutionPanel.tsx`)
- **Conexão**: `useGameStore((s) => s.players)` + `useGameDispatch()`
- **Ação**: `ADMIN_PATCH_PLAYER` — altera `evolutionRate` de jogadores
- **Impacto no jogo**: Taxa de evolução de atributos pós-partida
- **Status**: ✅ Conectado e funcional

### 2. **Shop Panel** (`AdminShopPanel.tsx`)
- **Conexão**: `useGameStore((s) => s.shopCatalog)` + `useGameStore((s) => s.shopInventory)`
- **Ação**: Gerencia catálogo e inventário da loja
- **Impacto no jogo**: Itens disponíveis para compra
- **Status**: ✅ Conectado e funcional

### 3. **Financeiro Panel** (`AdminFinanceiroPanel.tsx`)
- **Conexão**: `useGameStore((s) => s.finance)`
- **Ação**: Visualiza e gerencia finanças do clube
- **Impacto no jogo**: Economia do clube (OLE, BRO, EXP)
- **Status**: ✅ Conectado e funcional

### 4. **Usuários Panel** (`AdminUsuariosPanel.tsx`)
- **Conexão**: `getGameState()` + `IMPORT_SESSION_USER`
- **Ação**: Importa save de usuário para plataforma
- **Impacto no jogo**: Sincronização Supabase ↔ localStorage
- **Status**: ✅ Conectado e funcional

### 5. **Market Panel** (`AdminMarketPanel.tsx`)
- **Conexão**: `useGameStore((s) => s.players)`
- **Ação**: Gerencia mercado de transferências
- **Impacto no jogo**: Jogadores disponíveis para contratação
- **Status**: ✅ Conectado e funcional

### 6. **Prospect Art Panel** (`AdminProspectArtPanel.tsx`)
- **Conexão**: `getGameState()` + `useGameStore((s) => s.managerProspectArtQueue)` + `useGameStore((s) => s.players)`
- **Ação**: Cria jogadores da academia com arte gerada
- **Impacto no jogo**: Adiciona jogadores ao plantel
- **Status**: ✅ Conectado e funcional

### 7. **Leagues Panel** (`AdminLeaguesPanel.tsx`)
- **Conexão**: `useGameStore((s) => s.adminLeagues)` + `useGameStore((s) => s.adminPrimaryLeagueId)` + `useGameStore((s) => s.club)`
- **Ação**: Gerencia ligas e competições
- **Impacto no jogo**: Estrutura de competições disponíveis
- **Status**: ✅ Conectado e funcional

### 8. **Position Coach Section** (`PositionCoachSection.tsx`)
- **Conexão**: `useGameStore((s) => s.players)`
- **Ação**: Treina posicionamento tático via Anthropic API
- **Impacto no jogo**: Melhora atributos táticos de jogadores
- **Status**: ✅ Conectado e funcional

## ⚠️ Painéis Sem Conexão Direta com Game State

### 1. **Game Spirit Panel** (`AdminGameSpiritPanel.tsx`)
- **Conexão**: `gameSpiritKnowledgeStore` (localStorage separado)
- **Impacto**: Biblioteca de conhecimento para narrativas/padrões táticos
- **Nota**: Não modifica `OlefootGameState` diretamente — alimenta o motor de narrativa
- **Status**: ⚠️ Isolado (por design)

### 2. **Overview Panel** (`AdminOverviewPanel.tsx`)
- **Conexão**: `useAdminPlatformStore` (estado separado da plataforma)
- **Impacto**: KPIs agregados de todos os usuários
- **Nota**: Não modifica save local — apenas visualização
- **Status**: ⚠️ Read-only (por design)

### 3. **Growth Panel** (`AdminGrowthPanel.tsx`)
- **Conexão**: `useAdminPlatformStore`
- **Impacto**: Métricas de crescimento da plataforma
- **Status**: ⚠️ Read-only (por design)

### 4. **Global Panel** (`AdminGlobalPanel.tsx`)
- **Conexão**: Wrapper para Launch/Config/Broadcast
- **Impacto**: Configurações globais da plataforma
- **Status**: ⚠️ Plataforma-level (não afeta save individual)

### 5. **Audit Log Panel** (`AdminAuditLogPanel.tsx`)
- **Conexão**: Logs de auditoria (Supabase)
- **Status**: ⚠️ Read-only

### 6. **Profanity Panel** (`AdminProfanityPanel.tsx`)
- **Conexão**: Filtro de linguagem (config global)
- **Status**: ⚠️ Config-level

### 7. **Learned Phrases Panel** (`AdminLearnedPhrasesPanel.tsx`)
- **Conexão**: Frases aprendidas (GameSpirit knowledge)
- **Status**: ⚠️ Knowledge base

### 8. **Create Player Agents Panel** (`AdminCreatePlayerAgentsPanel.tsx`)
- **Conexão**: Cria jogadores via Anthropic API
- **Impacto**: Adiciona jogadores ao plantel
- **Status**: ✅ Conectado (via API)

### 9. **Genesis Portraits Panel** (`AdminGenesisPortraitsPanel.tsx`)
- **Conexão**: Supabase `genesis_market_players` + Pinata IPFS
- **Impacto**: Fotos de jogadores Genesis
- **Status**: ⚠️ Asset management (não afeta gameplay)

### 10. **Legacy Panel** (`AdminLegacyPanel.tsx`)
- **Conexão**: DNA de jogadores legado
- **Status**: ⚠️ Asset management

## 🔧 Sistema de Skills — Estado Atual

### Arquitetura
- **Engine**: `src/skills/skillEngine.ts` — resolução de skills com zona/pressão/cooldown
- **Schema**: `src/skills/playbookV1.ts` — validador de CoachSkill (PlaybookV1)
- **Catálogo**: `src/skills/seedCatalog.ts` — skills seed
- **Integração**: `src/smartfield/skillZoneIntegration.ts` — compatibilidade zonal

### Tipos de Skills Suportados
```typescript
type SkillType = 
  | 'SHOOT' | 'DRIBBLE' | 'CROSS' | 'HEADER' 
  | 'PASS' | 'PRESS' | 'BUILD_UP' | 'DEFEND' 
  | 'FREEKICK' | 'SAVE';
```

### Fluxo de Resolução
1. **Trigger**: Evento de jogo (chute, drible, passe, etc.)
2. **Compatibilidade**: Verifica se skill é compatível com zona atual
3. **Cooldown**: Bloqueia se skill foi usada recentemente (3 eventos)
4. **Chance**: Calcula `triggerChance` baseado em:
   - Atributo do jogador (ex: `finalizacao` para SHOOT)
   - Multiplicador zonal (box/final third = 1.30x, def third = 0.60x)
   - Pressão adversária (penaliza skills técnicas em até 50%)
   - Team booster (legacyTeamBooster → 0.8x–1.5x)
5. **Efeito**: Se disparar, aplica `BASE_EFFECT = 0.20` (20% boost)

### ⚠️ Problema Identificado: Skills NÃO estão conectadas aos jogadores

**Situação atual**:
- `PlayerEntity` não tem campo `skills: CoachSkill[]`
- `PitchPlayerState` não carrega skills do jogador
- `resolveSkills()` existe mas não é chamado no match engine
- Schema `CoachSkill` (PlaybookV1) está completo mas não há instâncias reais

**O que falta**:
1. Adicionar `skills?: string[]` (IDs) em `PlayerEntity` (`src/entities/types.ts`)
2. Criar catálogo de skills concretas (`src/skills/catalog.ts`)
3. Integrar `resolveSkills()` no match engine:
   - `TacticalSimLoop.ts` — ao processar ações
   - `GameSpirit.ts` — ao resolver chutes/passes
4. UI para atribuir skills a jogadores (Admin ou in-game)

## 📊 Resumo

| Categoria | Conectado | Isolado | Total |
|-----------|-----------|---------|-------|
| Painéis Admin | 8 | 10 | 18 |
| Game State Mutations | 8 | 0 | 8 |
| Read-only/Config | 0 | 10 | 10 |

**Conclusão**: Admin está bem conectado ao jogo para operações core (jogadores, economia, ligas). Skills existem como sistema mas não estão instanciadas nem conectadas aos jogadores.

## 🎯 Próximos Passos

1. ✅ Auditoria completa
2. 🔄 Implementar Skills efetivas:
   - Criar catálogo de 5-10 skills concretas
   - Adicionar campo `skills` em `PlayerEntity`
   - Integrar `resolveSkills()` no match engine
   - Testar no Live Match 2D
3. 🧪 Validar impacto no gameplay
