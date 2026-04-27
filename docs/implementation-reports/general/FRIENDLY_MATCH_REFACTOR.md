# Refatoração Sistema de Amistosos — Olefoot

## Objetivo
Simplificar o fluxo de criação de partidas amistosas, adicionar busca automática de adversários e implementar times bot para garantir disponibilidade constante.

---

## 1. Times Bot (sempre disponíveis)

### 1.1 Definição dos Times Bot
```typescript
// src/match/botTeams.ts
export const BOT_TEAMS = [
  {
    id: 'bot-ole-fc',
    name: 'OLE FC',
    shortName: 'OLE',
    country: 'Internacional',
    avgOverall: 75,
    formation: '4-3-3' as const,
    style: 'balanced' as const,
  },
  {
    id: 'bot-antros-sc',
    name: 'ANTROS SC',
    shortName: 'ANT',
    country: 'Internacional',
    avgOverall: 72,
    formation: '4-4-2' as const,
    style: 'defensive' as const,
  },
  {
    id: 'bot-hexa-team',
    name: 'HEXA TEAM',
    shortName: 'HEX',
    country: 'Brasil',
    avgOverall: 78,
    formation: '4-2-3-1' as const,
    style: 'attacking' as const,
    // Jogadores brasileiros gerados proceduralmente
  },
  {
    id: 'bot-for-peace',
    name: 'FOR PEACE',
    shortName: 'FPC',
    country: 'Internacional',
    avgOverall: 70,
    formation: '3-5-2' as const,
    style: 'possession' as const,
  },
];
```

### 1.2 Geração Procedural de Elencos Bot
- Cada bot tem 18 jogadores gerados com base no `avgOverall`
- HEXA TEAM usa nomes brasileiros do pool existente
- Atributos balanceados por posição
- Formação fixa por time

---

## 2. Sistema de Disponibilidade ONLINE/OFFLINE

### 2.1 Novo Campo no Estado do Clube
```typescript
// src/game/types.ts
export interface ClubEntity {
  // ... campos existentes
  friendlyAvailability: 'ONLINE' | 'OFFLINE';
  friendlyAutoAccept: boolean; // aceita convites automaticamente quando ONLINE
}
```

### 2.2 Configuração no Perfil
- Toggle ONLINE/OFFLINE no `/profile`
- Quando ONLINE:
  - Time aparece na busca de adversários
  - Pode receber convites de outros managers
  - Partidas têm impacto real (ranking, lesões, cartões)
- Quando OFFLINE:
  - Time não aparece na busca
  - Não recebe convites
  - Só pode jogar contra bots

### 2.3 Persistência Supabase
```sql
-- Adicionar coluna na tabela clubs
ALTER TABLE clubs ADD COLUMN friendly_availability TEXT DEFAULT 'OFFLINE';
ALTER TABLE clubs ADD COLUMN friendly_auto_accept BOOLEAN DEFAULT false;
```

---

## 3. Busca Automática de Adversários

### 3.1 Algoritmo de Matchmaking
```typescript
// src/match/friendlyMatchmaking.ts
export async function findFriendlyOpponent(params: {
  myClubId: string;
  myOverall: number;
  preferredMode: 'quick' | 'penalty';
  maxOvrDiff?: number; // default: 10
}): Promise<OpponentMatch | null> {
  // 1. Buscar times ONLINE disponíveis
  const onlineTeams = await searchOnlineAvailableTeams({
    ovrRange: [params.myOverall - 10, params.myOverall + 10],
    excludeClubId: params.myClubId,
  });

  // 2. Se encontrou, retornar o mais próximo em OVR
  if (onlineTeams.length > 0) {
    return pickBestMatch(onlineTeams, params.myOverall);
  }

  // 3. Fallback: retornar um bot aleatório
  return pickRandomBot();
}
```

### 3.2 Critérios de Match
- **Prioridade 1**: Times ONLINE com OVR similar (±10)
- **Prioridade 2**: Times ONLINE com OVR similar (±15)
- **Prioridade 3**: Bot aleatório

---

## 4. Nova UI do Box de Amistoso

### 4.1 Estrutura Simplificada
```
┌─────────────────────────────────────┐
│  AMISTOSO                           │
│  Desafie rivais ou busque partida   │
├─────────────────────────────────────┤
│  [BUSCAR PARTIDA]  (primário)       │
│  [CONVIDAR CLUBE]  (secundário)     │
└─────────────────────────────────────┘
```

### 4.2 Fluxo "BUSCAR PARTIDA"
1. Usuário clica em "BUSCAR PARTIDA"
2. Modal abre com:
   - Seletor de modo (Quick Match / Disputa Pênaltis)
   - Seletor de aposta (BRO / EXP + valor)
   - Botão "BUSCAR ADVERSÁRIO"
3. Sistema busca automaticamente:
   - Mostra loading "Procurando adversário..."
   - Encontra time ONLINE ou bot
   - Exibe card do adversário encontrado
4. Usuário confirma e entra direto na partida

### 4.3 Fluxo "CONVIDAR CLUBE"
1. Usuário clica em "CONVIDAR CLUBE"
2. Modal abre com busca manual (fluxo atual mantido)
3. Busca por nome, seleciona, envia convite
4. Aguarda aceitação (45s timeout)

---

## 5. Componentes UI

### 5.1 FriendlyMatchBox (refatorado)
```tsx
// src/components/home/FriendlyMatchBox.tsx
<DashboardSection size="sm">
  <div className="sports-panel">
    <div className="ole-eyebrow">Desafie rivais</div>
    <h3 className="text-neon-yellow">Amistoso</h3>
    
    <div className="flex flex-col gap-2 mt-4">
      <button 
        onClick={handleQuickSearch}
        className="btn-primary"
      >
        <Search /> BUSCAR PARTIDA
      </button>
      
      <button 
        onClick={handleInviteClub}
        className="btn-secondary"
      >
        <UserPlus /> CONVIDAR CLUBE
      </button>
    </div>
  </div>
</DashboardSection>
```

### 5.2 QuickSearchModal
```tsx
// src/components/friendly/QuickSearchModal.tsx
- Modo de partida (Quick / Penalty)
- Aposta (BRO / EXP)
- Botão "BUSCAR ADVERSÁRIO"
- Loading state
- Card do adversário encontrado
- Botão "CONFIRMAR E JOGAR"
```

### 5.3 OpponentCard
```tsx
// src/components/friendly/OpponentCard.tsx
┌─────────────────────────────────┐
│  [CREST]  HEXA TEAM             │
│           OVR 78 · Brasil       │
│           4-2-3-1 · Attacking   │
│                                 │
│  Prêmio: 50 BRO (vencedor)      │
└─────────────────────────────────┘
```

---

## 6. Impacto no Ranking

### 6.1 Partidas ONLINE vs OFFLINE
- **ONLINE** (vs manager online):
  - Impacta ranking mundial
  - Pode causar lesões/cartões
  - Prêmio maior (2x)
  
- **OFFLINE** (vs bot ou manager offline):
  - Não impacta ranking
  - Sem lesões/cartões
  - Prêmio padrão

### 6.2 Indicador Visual
- Badge "ONLINE" em verde no card do adversário
- Badge "BOT" em cinza para times bot
- Badge "OFFLINE" em amarelo para times offline

---

## 7. Implementação por Etapas

### Fase 1: Times Bot
- [ ] Criar `src/match/botTeams.ts`
- [ ] Implementar geração de elencos bot
- [ ] Adicionar HEXA TEAM com nomes brasileiros

### Fase 2: Sistema de Disponibilidade
- [ ] Adicionar campos ao `ClubEntity`
- [ ] Criar toggle ONLINE/OFFLINE no perfil
- [ ] Persistir no Supabase

### Fase 3: Matchmaking
- [ ] Criar `src/match/friendlyMatchmaking.ts`
- [ ] Implementar busca automática
- [ ] Integrar com bots como fallback

### Fase 4: UI Refatorada
- [ ] Refatorar `FriendlyMatchBox`
- [ ] Criar `QuickSearchModal`
- [ ] Criar `OpponentCard`
- [ ] Atualizar fluxo na Home

### Fase 5: Testes e Ajustes
- [ ] Testar busca automática
- [ ] Testar convite manual
- [ ] Testar partidas vs bot
- [ ] Ajustar balanceamento de OVR

---

## 8. Melhorias Futuras

- **Histórico de adversários**: lista de últimos 10 adversários enfrentados
- **Favoritos**: marcar adversários favoritos para rematches rápidos
- **Torneios amistosos**: criar mini-torneios de 4-8 times
- **Desafios semanais**: adversários especiais com prêmios maiores
- **Replay de partidas**: assistir partidas de outros managers

---

## 9. Checklist de Design System

- [x] Usar `sports-panel` para cards
- [x] Usar `ole-eyebrow` para labels
- [x] Usar `btn-primary` / `btn-secondary`
- [x] Usar `text-neon-yellow` para destaques
- [x] Usar `border-l-4 border-l-neon-yellow` para barra lateral
- [x] Manter espaçamento consistente (gap-2, gap-4)
- [x] Usar `font-display` para títulos
- [x] Usar `font-serif-hero` para números grandes

---

## 10. Exemplo de Fluxo Completo

```
1. Manager abre Home
2. Vê box "AMISTOSO" com 2 botões
3. Clica em "BUSCAR PARTIDA"
4. Modal abre:
   - Seleciona "Quick Match"
   - Seleciona "50 BRO"
   - Clica "BUSCAR ADVERSÁRIO"
5. Sistema busca:
   - Procura times ONLINE (±10 OVR)
   - Não encontra
   - Retorna "HEXA TEAM" (bot)
6. Exibe card:
   - HEXA TEAM · OVR 78 · Brasil
   - Badge "BOT"
   - Prêmio: 50 BRO
7. Manager clica "CONFIRMAR E JOGAR"
8. Navega para /match/quick com adversário bot
```

---

## Conclusão

Esta refatoração simplifica drasticamente o fluxo de criação de amistosos, garante que sempre haja adversários disponíveis (via bots) e mantém a opção de convites manuais para quem prefere jogar contra amigos específicos.

O sistema de ONLINE/OFFLINE dá controle ao manager sobre quando quer ser desafiado, e o matchmaking automático remove a fricção de buscar manualmente por adversários.
