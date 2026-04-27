# ✅ Estrutura Shared/ Criada — Guia de Migração

## 📁 ESTRUTURA CRIADA

```
olefoot-v-11/
├── shared/                          # ✅ NOVO: Código compartilhado
│   ├── package.json                 # Configuração do pacote shared
│   ├── tsconfig.json                # TypeScript config
│   ├── README.md                    # Documentação
│   └── gamespirit/                  # Motor de jogo
│       ├── GameSpirit.ts            # Lógica principal (58KB)
│       ├── types.ts                 # Tipos compartilhados
│       ├── momentum.ts              # Sistema de momentum
│       ├── narrationSeed.ts         # Geração de narrativas
│       ├── narrativeTemplates.ts    # Templates de texto
│       ├── contextualNarrative.ts   # Narrativa contextual
│       ├── spiritStateMachine.ts    # Máquina de estados
│       ├── spiritSnapshotTypes.ts   # Tipos de snapshot
│       └── index.ts                 # Barrel export
├── src/                             # Frontend
│   └── gamespirit/
│       └── GameSpirit.ts.new        # ✅ Re-export de shared/
└── server/                          # Backend
    └── src/
        └── controllers/
            └── matchTickController.ts.new  # ✅ Importa de shared/
```

---

## 🔧 ARQUIVOS CRIADOS

### **1. shared/package.json**
```json
{
  "name": "@olefoot/shared",
  "version": "1.0.0",
  "description": "Shared code between frontend and backend",
  "main": "index.js",
  "type": "module"
}
```

### **2. shared/gamespirit/index.ts** (Barrel Export)
```typescript
export { gameSpiritTick, buildSpiritContext } from './GameSpirit';
export type { SpiritContext, SpiritOutcome, ProposedAction } from './types';
export { updateMomentum } from './momentum';
export { enrichNarrative } from './contextualNarrative';
```

### **3. src/gamespirit/GameSpirit.ts.new** (Frontend Re-export)
```typescript
// Mantém compatibilidade com código existente
export { gameSpiritTick, buildSpiritContext } from '../../shared/gamespirit';
export * from '../../shared/gamespirit/GameSpirit';
```

### **4. server/src/controllers/matchTickController.ts.new** (Backend Corrigido)
```typescript
// CORRIGIDO: Importa de shared/ em vez de src/
import { gameSpiritTick, buildSpiritContext } from '../../shared/gamespirit/index.js';
```

---

## 🚀 COMO MIGRAR (3 Passos)

### **Passo 1: Backup dos Arquivos Originais**
```bash
# Fazer backup antes de substituir
cp src/gamespirit/GameSpirit.ts src/gamespirit/GameSpirit.ts.backup
cp server/src/controllers/matchTickController.ts server/src/controllers/matchTickController.ts.backup
```

### **Passo 2: Substituir pelos Novos Arquivos**
```bash
# Frontend: Re-export de shared/
mv src/gamespirit/GameSpirit.ts.new src/gamespirit/GameSpirit.ts

# Backend: Importação corrigida
mv server/src/controllers/matchTickController.ts.new server/src/controllers/matchTickController.ts
```

### **Passo 3: Instalar Dependências do Shared**
```bash
cd shared
npm install
cd ..
```

---

## ⚠️ PROBLEMAS A RESOLVER

### **1. Dependências Externas no GameSpirit**

O `shared/gamespirit/GameSpirit.ts` ainda importa de `@/`:

```typescript
// ❌ PROBLEMA: Imports de @/ não funcionam no backend
import { overallFromAttributes } from '@/entities/player';
import { crowdSpiritFromSupport } from '@/systems/crowdSpirit';
import { resolveSkills } from '@/skills/skillEngine';
import { PlayerProgressionManager } from '@/progression/playerProgression';
```

**Solução:**
1. Mover essas dependências para `shared/` também
2. Ou criar interfaces/adapters para desacoplar

### **2. Imports Relativos**

Alguns arquivos em `shared/gamespirit/` ainda usam imports relativos que podem quebrar:

```typescript
// contextualNarrative.ts
import { pickLine } from './narrationSeed';  // ✅ OK
import type { SpiritContext } from './types'; // ✅ OK
```

---

## 📋 CHECKLIST DE MIGRAÇÃO COMPLETA

### **Arquivos Movidos para Shared:**
- ✅ GameSpirit.ts (58KB)
- ✅ types.ts
- ✅ momentum.ts
- ✅ narrationSeed.ts
- ✅ narrativeTemplates.ts
- ✅ contextualNarrative.ts
- ✅ spiritStateMachine.ts
- ✅ spiritSnapshotTypes.ts

### **Dependências a Mover:**
- ⚠️ `@/entities/player` → `shared/entities/`
- ⚠️ `@/systems/crowdSpirit` → `shared/systems/`
- ⚠️ `@/skills/skillEngine` → `shared/skills/`
- ⚠️ `@/progression/playerProgression` → `shared/progression/`
- ⚠️ `@/match/causal/matchCausalTypes` → `shared/match/`
- ⚠️ `@/tactics/playingStyle` → `shared/tactics/`
- ⚠️ `@/match/positionWeights` → `shared/match/`
- ⚠️ `@/match/spatialZones` → `shared/match/`
- ⚠️ `@/simulation/field` → `shared/simulation/`
- ⚠️ `@/match/specialEvents` → `shared/match/`

### **Arquivos Atualizados:**
- ✅ `src/gamespirit/GameSpirit.ts` → Re-export
- ✅ `server/src/controllers/matchTickController.ts` → Importa de shared/

---

## 🎯 SOLUÇÃO RÁPIDA (Sem Mover Tudo)

Se não quiser mover todas as dependências agora, use **adapter pattern**:

### **Opção A: Duplicar GameSpirit**
```bash
# Manter versão simplificada em shared/ sem dependências
# Versão completa em src/ com todas as features
```

### **Opção B: Dependency Injection**
```typescript
// shared/gamespirit/GameSpirit.ts
export function gameSpiritTick(
  ctx: SpiritContext,
  awayShort: string,
  causalSeqStart: number,
  nowMs: number,
  deps: {
    overallFromAttributes: (attrs: any) => number;
    crowdSpiritFromSupport: (support: number) => any;
    resolveSkills: (params: any) => any;
    // ... outras dependências
  }
) {
  // Usa deps em vez de imports diretos
  const avg = deps.overallFromAttributes(player.attrs);
}
```

### **Opção C: Manter Código Duplicado Temporariamente**
```bash
# shared/ tem versão simplificada (sem signature moves, sem skills)
# src/ tem versão completa
# Backend usa versão simplificada
```

---

## ✅ STATUS ATUAL

| Item | Status | Nota |
|------|--------|------|
| Pasta shared/ criada | ✅ | Estrutura pronta |
| Arquivos copiados | ✅ | 10 arquivos |
| Barrel export | ✅ | index.ts criado |
| Frontend re-export | ✅ | .new criado |
| Backend corrigido | ✅ | .new criado |
| Dependências resolvidas | ⚠️ | Requer mais trabalho |
| Build funcional | ❌ | Requer resolver deps |

---

## 🚀 PRÓXIMOS PASSOS

### **Opção 1: Migração Completa (2-3h)**
1. Mover todas as dependências para shared/
2. Criar tsconfig paths para @shared/
3. Atualizar todos os imports
4. Testar build frontend e backend

### **Opção 2: Solução Rápida (30min)**
1. Usar Opção C (código duplicado)
2. Criar `shared/gamespirit/GameSpiritSimple.ts` sem deps
3. Backend usa versão simples
4. Frontend usa versão completa

### **Opção 3: Hybrid (1h)**
1. Mover apenas tipos para shared/
2. GameSpirit fica em src/ e server/src/ (duplicado)
3. Sincronizar manualmente quando mudar

---

## 💡 RECOMENDAÇÃO

**Para produção imediata:** Use **Opção 2** (código duplicado)
- Backend tem versão simplificada sem signature moves
- Frontend tem versão completa
- Funciona em 30 minutos

**Para longo prazo:** Use **Opção 1** (migração completa)
- Código único e consistente
- Mais trabalho inicial
- Melhor manutenibilidade

---

## 📝 COMANDOS PARA APLICAR

```bash
# Aplicar migração (depois de escolher opção)
mv src/gamespirit/GameSpirit.ts.new src/gamespirit/GameSpirit.ts
mv server/src/controllers/matchTickController.ts.new server/src/controllers/matchTickController.ts

# Testar
npm run lint
cd server && npm run dev:server
```

---

## ✅ CONCLUSÃO

A estrutura `shared/` foi criada com sucesso, mas **requer resolver dependências** antes de funcionar completamente.

**Escolha uma das 3 opções acima** e continue a migração conforme sua prioridade (velocidade vs qualidade).
