# @olefoot/shared

Código compartilhado entre frontend e backend do Olefoot.

## Estrutura

```
shared/
├── gamespirit/          # Motor de jogo GameSpirit
│   ├── GameSpirit.ts    # Lógica principal de simulação
│   ├── types.ts         # Tipos compartilhados
│   ├── momentum.ts      # Sistema de momentum
│   ├── narrationSeed.ts # Geração de narrativas
│   └── index.ts         # Barrel export
├── types/               # Tipos compartilhados
└── utils/               # Utilitários compartilhados
```

## Uso

### Frontend (React)
```typescript
import { gameSpiritTick, buildSpiritContext } from '@/gamespirit/GameSpirit';
// Importa do src/gamespirit/GameSpirit.ts que re-exporta de shared/
```

### Backend (Hono)
```typescript
import { gameSpiritTick, buildSpiritContext } from '../../shared/gamespirit/index.js';
// Importa diretamente de shared/
```

## Por que shared/?

O GameSpirit precisa rodar tanto no cliente (modo offline) quanto no servidor (anti-cheat).
Manter o código em `shared/` evita duplicação e garante comportamento idêntico.

## Build

```bash
cd shared
npm install
npm run build  # Compila TypeScript
```

## Dependências

O código em `shared/` deve ter **zero dependências** de:
- React
- DOM APIs
- Node.js específico
- Qualquer framework

Apenas TypeScript puro e lógica de negócio.
