# Match Global — Sistema de Simulação

## 📋 Visão Geral

O **Match Global** usa o mesmo motor de simulação que os modos existentes do Olefoot (quick/auto/test2d), garantindo consistência e realismo.

## 🎮 Como as Partidas São Simuladas

### **1. Motor Base: GameSpirit + matchBulk**

Todas as partidas do Match Global usam o **modo `auto`** otimizado:

```typescript
// src/engine/matchBulk.ts
advanceMatchToPostgame({
  snapshot: initialSnapshot,
  homeRoster: players,
  spiritTickProb: 0.54, // Probabilidade de tick do GameSpirit
})
```

**O que acontece internamente:**
- `runMatchMinute` é chamado para cada minuto (0-90)
- `buildSpiritContext` + `gameSpiritTick` resolvem eventos
- Sistema de posse, passes, finalizações, defesas
- Cartões, lesões, substituições automáticas
- Narrativa gerada pelo GameSpirit

### **2. Integração com Comandos do Treinador**

Os comandos definidos pelo manager são convertidos em `TeamTacticalStyle`:

```typescript
// Postura: offensive/balanced/defensive
// Intensidade: high/medium/low
// Estilo: possession/counter/direct

commandsToTacticalStyle(commands) → {
  possession: 60,
  pressing: 65,
  tempo: 60,
  directness: 50,
  width: 50
}
```

**Impacto real:**
- Postura ofensiva → +10% posse, +15% pressing
- Intensidade alta → +15% pressing, +15% tempo
- Contra-ataque → +30% directness, +30% tempo

### **3. Simulação Paralela**

Durante os **3 minutos** da rodada:

```typescript
// Todas as partidas simulam simultaneamente
const results = await Promise.all(
  fixtures.map(fixture => simulateSingleMatch(fixture))
);
```

**Cada partida:**
1. Cria snapshot inicial com estilos táticos
2. Simula 90 minutos em ~2-5 segundos (modo auto otimizado)
3. Extrai eventos relevantes (gols, cartões, lesões)
4. Distribui eventos temporalmente nos 3 minutos reais

### **4. Distribuição Temporal de Eventos**

Os eventos são mapeados do tempo de jogo (0-90min) para tempo real (0-3min):

```typescript
// Minuto 45 do jogo → 1min30s real
timestampMs = kickoffMs + (minute * 2000); // 2s por minuto de jogo
```

**Exemplo:**
- Gol aos 23' → aparece em 46s reais
- Cartão aos 67' → aparece em 2m14s reais
- Gol aos 89' → aparece em 2m58s reais

### **5. Detecção de Destaques Globais**

O sistema analisa eventos e contexto para gerar destaques:

```typescript
// GOL DO LÍDER (overall >= 85)
if (teamOverall >= 85 && event.type === 'goal') {
  highlight = "🔥 GOL DO LÍDER: Time X"
}

// ZEBRA (diferença de overall >= 15)
if (weakerTeam.score > strongerTeam.score && ovrDiff >= 15) {
  highlight = "⚡ ZEBRA! Time fraco surpreende"
}

// EXPULSÃO DECISIVA (jogo equilibrado)
if (Math.abs(scoreHome - scoreAway) <= 1 && redCard) {
  highlight = "🟥 EXPULSÃO DECISIVA"
}
```

## 🔄 Fluxo Completo de uma Rodada

### **Fase 1: Pré-Jogo (5 minutos antes)**
```
1. Janela de comandos abre
2. Managers definem: postura, intensidade, estilo
3. Comandos são salvos no fixture
4. 5 minutos antes do kickoff → comandos fecham
```

### **Fase 2: Kickoff (início da rodada)**
```
1. Status muda para 'live'
2. Todas as partidas iniciam simultaneamente
3. Para cada partida:
   - Converte comandos em TeamTacticalStyle
   - Cria LiveMatchSnapshot inicial
   - Chama advanceMatchToPostgame()
   - Simula 90 minutos em ~3s
```

### **Fase 3: Durante os 3 Minutos**
```
1. Eventos são revelados progressivamente
2. A cada segundo, verifica:
   - currentMinute = (nowMs - kickoffMs) / 2000
   - Revela eventos onde event.minute <= currentMinute
3. Placar atualiza em tempo real
4. Destaques aparecem no topo do painel
```

### **Fase 4: Pós-Rodada**
```
1. Todas as partidas terminam
2. Processa consequências:
   - Suspensões (vermelho ou 3 amarelos)
   - Lesões (leve/moderada/grave)
   - Atualiza tabela da liga
   - Calcula momentum dos times
3. Agenda próxima rodada (+1 hora)
```

## 🎯 Diferenças Entre Modos

| Aspecto | Quick | Auto | Test2D | **Match Global** |
|---------|-------|------|--------|------------------|
| Motor | GameSpirit | GameSpirit | GameSpirit + Yuka | GameSpirit |
| Duração | ~50s | ~10s | ~5min | ~3s por jogo |
| Campo visual | Não | Não | Sim (2D) | Não |
| Interação | Não | Não | Sim (comandos) | Não (pré-jogo) |
| Eventos | Completos | Reduzidos | Completos | Completos |
| Paralelo | Não | Não | Não | **Sim (múltiplos)** |

## 🔧 Arquivos Criados

### **1. globalMatchEngine.ts** (NOVO)
- Integra com `advanceMatchToPostgame`
- Converte comandos em estilos táticos
- Simula partidas em paralelo
- Distribui eventos temporalmente

### **2. globalMatchSimulator.ts** (Fallback)
- Simulação probabilística simplificada
- Usado quando não há jogadores reais
- Baseado em overall + comandos

### **3. globalMatchScheduler.ts**
- Gerencia ciclo de rodadas
- Transições de status automáticas
- Limite de 10 rodadas/dia

### **4. globalMatchConsequences.ts**
- Suspensões e lesões
- Atualização de tabela
- Cálculo de momentum

### **5. globalMatchRealtime.ts**
- Supabase Realtime para sincronização
- Broadcast de eventos
- Persistência de rodadas

## 🚀 Uso no Código

### **Opção 1: Com Jogadores Reais (Recomendado)**
```typescript
import { simulateGlobalRoundWithEngine } from '@/match/globalMatchEngine';

const result = await simulateGlobalRoundWithEngine(
  fixtures,
  kickoffMs,
  (teamId) => getPlayersForTeam(teamId) // Busca jogadores do banco
);
```

### **Opção 2: Simulação Rápida (Testes)**
```typescript
import { simulateGlobalRound } from '@/match/globalMatchSimulator';

const result = simulateGlobalRound(fixtures, kickoffMs);
```

## 📊 Exemplo de Resultado

```typescript
{
  updatedFixtures: [
    {
      id: "gf_...",
      homeTeamName: "Flamengo",
      awayTeamName: "Palmeiras",
      scoreHome: 2,
      scoreAway: 1,
      events: [
        { minute: 23, type: 'goal', side: 'home', text: "⚽ GOL! Jogador 9" },
        { minute: 45, type: 'yellow_card', side: 'away', text: "🟡 Cartão" },
        { minute: 67, type: 'goal', side: 'away', text: "⚽ GOL! Jogador 10" },
        { minute: 89, type: 'goal', side: 'home', text: "⚽ GOL! Jogador 11" }
      ]
    }
  ],
  highlights: [
    { type: 'leader_goal', text: "🔥 GOL DO LÍDER: Flamengo" },
    { type: 'comeback', text: "🔄 VIRADA! Flamengo vira o jogo" }
  ]
}
```

## ✅ Vantagens da Abordagem

1. **Consistência**: Mesmo motor dos outros modos
2. **Realismo**: GameSpirit garante eventos coerentes
3. **Performance**: Modo auto otimizado (~3s por jogo)
4. **Escalabilidade**: Promise.all para paralelização
5. **Flexibilidade**: Comandos do treinador influenciam resultado
6. **Manutenibilidade**: Reutiliza código existente

## 🎮 Experiência do Usuário

O jogador vê:
- ✅ Todos os jogos acontecendo simultaneamente
- ✅ Placares atualizando em tempo real
- ✅ Eventos aparecendo progressivamente
- ✅ Destaques importantes no topo
- ✅ Sensação de "mundo vivo"

O jogador NÃO vê:
- ❌ Campo 2D (não é necessário)
- ❌ Simulação instantânea (eventos distribuídos)
- ❌ Detalhes técnicos do motor

---

**Resultado:** Sistema completo, realista e performático que simula múltiplas partidas simultaneamente usando o motor existente do Olefoot, mantendo a essência do Elifoot com tecnologia moderna.
