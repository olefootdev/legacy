# Quick Match Addiction Design
## Psicologia de Jogos de Aposta + Hiperconectividade aplicada ao Olefoot

---

## 1. PSICOLOGIA DOS JOGOS DE APOSTA: POR QUE AS PESSOAS SÃO VICIADAS?

### 1.1 Dopamina e Recompensas Variáveis (Variable Ratio Schedule)
**O que é:** O cérebro libera dopamina não quando você ganha, mas quando você **não sabe se vai ganhar**. Slot machines usam isso: você não sabe quando vai ganhar, então continua jogando.

**Aplicação no Olefoot:**
- Cada partida rápida deve ter **múltiplos pontos de incerteza** durante o jogo, não só no resultado final
- O jogador deve sentir que "quase ganhou" mesmo quando perde (near-miss effect)
- Recompensas inesperadas durante a partida (não só no final)

### 1.2 Near-Miss Effect (Efeito "Quase")
**O que é:** Perder por pouco ativa as mesmas áreas cerebrais que ganhar. "Quase ganhei" faz você jogar de novo.

**Exemplos de apostas:**
- Bola na trave = "quase ganhei"
- Defesa milagrosa do goleiro aos 89' = "quase ganhei"
- Pênalti perdido = "quase ganhei"

### 1.3 Ilusão de Controle
**O que é:** O jogador acredita que suas decisões influenciam o resultado, mesmo em jogos de sorte.

**Aplicação:**
- Substituições táticas durante a partida
- Mudança de formação no intervalo
- Decisões em momentos-chave (pênalti, falta perigosa)

### 1.4 Sunk Cost Fallacy (Falácia do Custo Afundado)
**O que é:** "Já investi tanto tempo/dinheiro, não posso parar agora."

**Aplicação:**
- Sequências de vitórias (win streaks) que o jogador não quer quebrar
- Missões diárias que exigem X partidas rápidas
- Recompensas progressivas (quanto mais joga, melhor a recompensa)

### 1.5 FOMO (Fear of Missing Out)
**O que é:** Medo de perder oportunidades limitadas.

**Aplicação:**
- Eventos temporários no modo rápido
- Bônus de recompensa que expira em X horas
- Desafios diários/semanais exclusivos

---

## 2. HIPERCONECTIVIDADE: JOGOS QUE PRENDEM ATENÇÃO

### 2.1 Hyper-Casual Games (Candy Crush, Subway Surfers)
**Características:**
- Sessões curtas (1-3 minutos)
- Feedback visual/sonoro constante
- Progressão clara e imediata
- "Mais uma partida" sempre disponível

### 2.2 Betting Apps (Bet365, Betano)
**Características:**
- Live betting: você aposta DURANTE o jogo
- Odds mudam em tempo real (cria urgência)
- Cash-out: você pode "sair" antes do fim (ilusão de controle)
- Notificações push constantes

### 2.3 Gacha Games (Genshin Impact, FIFA Ultimate Team)
**Características:**
- Recompensas aleatórias (loot boxes)
- Colecionismo (completar sets)
- Power creep (sempre tem algo melhor)
- Daily login rewards

---

## 3. ANÁLISE DO MODO /match/quick ATUAL

### 3.1 O que já funciona bem:
✅ Duração curta (~50s de jogo real)
✅ Feed de eventos em tempo real
✅ Animações de gol com freeze
✅ Assistente técnico com sugestões
✅ Substituições durante a partida
✅ Intervalo com decisões táticas
✅ Pênaltis interativos

### 3.2 O que falta para criar vício:
❌ **Falta recompensa imediata após cada partida**
❌ **Falta progressão visível (XP bar, level up)**
❌ **Falta "near-miss" visual (bola na trave, defesa milagrosa)**
❌ **Falta streak system (3 vitórias seguidas = bônus)**
❌ **Falta desafios em tempo real (marque 2 gols em 3 partidas)**
❌ **Falta comparação social (seu amigo ganhou 5 seguidas)**
❌ **Falta urgência (evento expira em 2h)**
❌ **Falta "quase" (perdeu nos acréscimos, defesa aos 89')**

---

## 4. PROPOSTAS DE IMPLEMENTAÇÃO: TORNAR O /match/quick VICIANTE

### 4.1 SISTEMA DE STREAKS (Sequências de Vitórias)
**Conceito:** Cada vitória seguida aumenta o multiplicador de recompensas.

**Implementação:**
```typescript
interface QuickMatchStreak {
  current: number;        // vitórias seguidas
  best: number;          // recorde pessoal
  multiplier: number;    // 1x, 1.5x, 2x, 3x, 5x
  nextReward: string;    // "Mais 1 vitória = 500 OLE"
}

// Multiplicadores:
// 1 vitória = 1x
// 2 vitórias = 1.5x
// 3 vitórias = 2x
// 5 vitórias = 3x
// 10 vitórias = 5x (LENDÁRIO)
```

**UI:**
- Barra de streak no topo da tela (🔥 3 VITÓRIAS SEGUIDAS)
- Animação especial quando quebra recorde pessoal
- Notificação: "Mais 1 vitória = BÔNUS TRIPLO!"
- Perder quebra a streak (cria tensão)

**Psicologia aplicada:**
- Sunk cost: "Já ganhei 4, não posso perder agora"
- Variable reward: "Se ganhar mais 1, ganho o triplo"
- FOMO: "Meu recorde é 7, quero chegar em 10"

---

### 4.2 NEAR-MISS SYSTEM (Sistema de "Quase")
**Conceito:** Destacar visualmente momentos onde você "quase" ganhou/empatou.

**Implementação:**
```typescript
interface NearMissEvent {
  kind: 'woodwork' | 'miracle_save' | 'offside_goal' | 'last_minute_loss';
  minute: number;
  description: string;
  visualEffect: 'shake' | 'slow_mo' | 'red_flash';
}

// Exemplos:
// - Bola na trave aos 88' (perdendo por 1)
// - Defesa milagrosa do goleiro adversário aos 85'
// - Gol anulado por impedimento
// - Gol sofrido aos 90+3' (estava empatando)
```

**UI:**
- Slow motion quando bola bate na trave
- Tela treme + efeito sonoro de "UHHH" da torcida
- Replay automático de defesas milagrosas
- Mensagem: "QUASE! Bola na trave aos 88'"

**Psicologia aplicada:**
- Near-miss effect: "Quase ganhei, vou jogar de novo"
- Emotional engagement: frustração controlada gera re-engajamento

---

### 4.3 IN-MATCH BETTING (Apostas Durante a Partida)
**Conceito:** Jogador pode fazer "apostas" internas durante a partida para ganhar bônus.

**Implementação:**
```typescript
interface InMatchBet {
  kind: 'next_goal' | 'clean_sheet' | 'comeback' | 'domination';
  stake: number;        // OLE apostado
  odds: number;         // 1.5x, 2x, 3x
  resolvedAt?: number;  // minuto que resolveu
  won: boolean;
}

// Exemplos:
// Min 15: "Aposte 100 OLE que você marca o próximo gol" (odds 2x)
// Min 30: "Aposte 200 OLE que não leva gol até o fim" (odds 3x)
// Min 60 (perdendo 0-1): "Aposte 500 OLE que vira o jogo" (odds 5x)
```

**UI:**
- Pop-up rápido no meio da partida: "APOSTE AGORA: Próximo gol é seu? (2x)"
- Botão "SIM (100 OLE)" / "NÃO"
- Se ganhar: animação de moedas caindo
- Se perder: "Quase! Tente na próxima"

**Psicologia aplicada:**
- Ilusão de controle: "Eu decidi apostar, então influencio o resultado"
- Variable reward: odds mudam conforme o jogo
- Urgência: aposta só disponível por 10 segundos

---

### 4.4 DAILY CHALLENGES (Desafios Diários)
**Conceito:** Missões diárias que exigem jogar partidas rápidas.

**Implementação:**
```typescript
interface DailyChallenge {
  id: string;
  description: string;
  progress: number;
  target: number;
  reward: { ole: number; exp: number; item?: string };
  expiresAt: Date;
}

// Exemplos:
// - "Vença 3 partidas rápidas" (300 OLE + 100 EXP)
// - "Marque 5 gols em partidas rápidas" (500 OLE)
// - "Vença sem levar gol" (1000 OLE + Pack Bronze)
// - "Faça 2 substituições e vença" (200 OLE)
```

**UI:**
- Ícone de desafio piscando no menu principal
- Barra de progresso: "2/3 vitórias"
- Notificação ao completar: "DESAFIO COMPLETO! +300 OLE"
- Timer: "Expira em 4h 23min"

**Psicologia aplicada:**
- FOMO: "Só tenho 4h para completar"
- Sunk cost: "Já fiz 2/3, vou terminar"
- Daily habit: jogador volta todo dia

---

### 4.5 LIVE LEADERBOARD (Ranking ao Vivo)
**Conceito:** Ranking de amigos/global que atualiza em tempo real.

**Implementação:**
```typescript
interface QuickMatchLeaderboard {
  period: 'daily' | 'weekly' | 'all_time';
  entries: {
    rank: number;
    userId: string;
    username: string;
    wins: number;
    streak: number;
    points: number;
  }[];
  myRank: number;
  nextRankAt: number; // pontos necessários para subir
}
```

**UI:**
- Aba "RANKING" no modo rápido
- Destaque: "Você está em 12º. Mais 2 vitórias = 10º lugar"
- Notificação: "Seu amigo João subiu para 3º!"
- Recompensas semanais: Top 10 ganha pack especial

**Psicologia aplicada:**
- Social comparison: "Meu amigo está na frente, vou jogar mais"
- Competition: "Quero chegar no Top 10"
- Status: "Sou Top 3 do ranking semanal"

---

### 4.6 INSTANT REWARDS (Recompensas Instantâneas)
**Conceito:** Recompensa visual imediata após cada partida (não só OLE).

**Implementação:**
```typescript
interface QuickMatchReward {
  ole: number;
  exp: number;
  items: { kind: string; rarity: string }[];
  bonuses: { kind: string; value: number }[]; // streak, challenge, etc
  levelUp?: { from: number; to: number };
}
```

**UI:**
- Tela de recompensa ANTES do resumo da partida
- Animação de moedas caindo
- "LEVEL UP!" com confete se subiu de nível
- Barra de XP preenchendo
- Itens desbloqueados (cards, emblemas, etc)
- Botão grande: "JOGAR DE NOVO" (não "Voltar")

**Psicologia aplicada:**
- Instant gratification: recompensa imediata
- Variable reward: às vezes ganha item raro
- Progression: barra de XP sempre visível

---

### 4.7 MOMENTUM SYSTEM (Sistema de Momentum Visual)
**Conceito:** Feedback visual constante de quem está dominando.

**Implementação:**
```typescript
interface MomentumState {
  pressure: number; // 0-100 (0 = visitante domina, 100 = casa domina)
  trend: 'rising' | 'falling' | 'stable';
  events: { minute: number; delta: number; reason: string }[];
}
```

**UI:**
- Barra horizontal no topo: [VISITANTE ←→ CASA]
- Barra se move conforme o jogo (chute, defesa, posse)
- Cores: vermelho (perdendo momentum) → amarelo → verde (dominando)
- Mensagens: "PRESSÃO MÁXIMA!" quando barra está no extremo
- Efeito visual: tela pulsa quando momentum muda bruscamente

**Psicologia aplicada:**
- Constant feedback: jogador sempre sabe como está o jogo
- Emotional engagement: tensão visual constante
- Anticipation: "Estou dominando, vou marcar logo"

---

### 4.8 LAST-MINUTE DRAMA (Drama de Último Minuto)
**Conceito:** Aumentar artificialmente a tensão nos minutos finais.

**Implementação:**
```typescript
interface LastMinuteDrama {
  enabled: boolean;
  triggers: {
    kind: 'corner_kick' | 'free_kick' | 'counter_attack' | 'penalty_appeal';
    minute: number;
    outcome: 'goal' | 'near_miss' | 'nothing';
  }[];
}

// Lógica:
// - Se jogo está empatado ou diferença de 1 gol
// - Entre min 85-90
// - 60% de chance de evento dramático
// - Slow motion + música tensa
```

**UI:**
- Música muda para trilha tensa aos 85'
- Câmera lenta em chutes finais
- Mensagem: "ÚLTIMO ATAQUE!"
- Torcida gritando (áudio)
- Coração pulsando na tela

**Psicologia aplicada:**
- Peak-end rule: jogador lembra do final, não do meio
- Emotional peak: drama final cria memória forte
- Near-miss: "Quase virei o jogo aos 89'"

---

### 4.9 QUICK REMATCH (Revanche Rápida)
**Conceito:** Botão "REVANCHE" imediato após perder.

**Implementação:**
```typescript
interface QuickRematch {
  available: boolean;
  opponent: OpponentStub;
  bonusMultiplier: number; // 1.5x se vencer a revanche
  countdown: number; // 10s para aceitar
}
```

**UI:**
- Tela de derrota: botão grande "REVANCHE (1.5x RECOMPENSA)"
- Timer: "Revanche disponível por 10s"
- Animação: botão pulsando
- Se aceitar: carrega partida imediatamente (sem voltar ao menu)

**Psicologia aplicada:**
- Loss aversion: "Não posso terminar perdendo"
- Urgency: "Só tenho 10s para decidir"
- Bonus incentive: "Se ganhar, ganho mais"

---

### 4.10 GACHA REWARDS (Recompensas Aleatórias)
**Conceito:** Após X partidas, jogador ganha um "pack" aleatório.

**Implementação:**
```typescript
interface GachaReward {
  kind: 'bronze' | 'silver' | 'gold' | 'legendary';
  contents: { item: string; rarity: string }[];
  probability: { bronze: 0.7, silver: 0.2, gold: 0.08, legendary: 0.02 };
}

// Lógica:
// - A cada 5 partidas rápidas = 1 pack bronze
// - A cada 10 vitórias = 1 pack silver
// - Streak de 5 = 1 pack gold
// - Streak de 10 = 1 pack legendary
```

**UI:**
- Animação de abertura de pack (cartas virando)
- Luz dourada se for item raro
- Som de "OHHH" se for lendário
- Coleção: "Você tem 45/100 emblemas"

**Psicologia aplicada:**
- Variable reward: nunca sabe o que vai ganhar
- Collecting: "Quero completar a coleção"
- Rarity: "Ganhei um item lendário!"

---

## 5. ROADMAP DE IMPLEMENTAÇÃO (PRIORIDADE)

### FASE 1: QUICK WINS (1-2 dias)
1. **Streak System** (4.1)
   - Adicionar `quickMatchStreak` ao `OlefootGameState`
   - UI: barra de streak no topo
   - Multiplicador de recompensas

2. **Instant Rewards Screen** (4.6)
   - Tela de recompensa antes do resumo
   - Animação de moedas
   - Botão "JOGAR DE NOVO"

3. **Quick Rematch** (4.9)
   - Botão "REVANCHE" após derrota
   - Timer de 10s
   - Bônus de 1.5x

### FASE 2: ENGAGEMENT (3-5 dias)
4. **Daily Challenges** (4.4)
   - Sistema de missões diárias
   - Integração com `trackMissionEvent`
   - UI de progresso

5. **Near-Miss System** (4.2)
   - Detectar bola na trave, defesas milagrosas
   - Slow motion + efeitos visuais
   - Replay automático

6. **Momentum System** (4.7)
   - Barra de momentum visual
   - Feedback constante durante partida

### FASE 3: SOCIAL + GACHA (5-7 dias)
7. **Live Leaderboard** (4.5)
   - Ranking diário/semanal
   - Integração com Supabase
   - Recompensas para Top 10

8. **Gacha Rewards** (4.10)
   - Packs aleatórios
   - Sistema de colecionáveis
   - Animação de abertura

9. **In-Match Betting** (4.3)
   - Apostas durante a partida
   - Pop-ups de odds
   - Resolução em tempo real

### FASE 4: POLISH (2-3 dias)
10. **Last-Minute Drama** (4.8)
    - Música tensa aos 85'
    - Slow motion em finalizações
    - Eventos dramáticos finais

---

## 6. MÉTRICAS DE SUCESSO

### KPIs para medir vício:
- **Session Length:** Tempo médio por sessão (meta: +50%)
- **Sessions per Day:** Quantas vezes o jogador volta (meta: 3-5x/dia)
- **Retention D1/D7/D30:** Quantos voltam após 1/7/30 dias (meta: 60%/40%/20%)
- **Matches per Session:** Quantas partidas rápidas por sessão (meta: 5-10)
- **Streak Completion Rate:** % de jogadores que chegam em streak 5+ (meta: 30%)
- **Rematch Accept Rate:** % que aceita revanche após perder (meta: 70%)
- **Daily Challenge Completion:** % que completa desafios diários (meta: 50%)

---

## 7. CÓDIGO DE EXEMPLO: STREAK SYSTEM

```typescript
// src/game/quickMatchStreak.ts

export interface QuickMatchStreak {
  current: number;
  best: number;
  lastMatchWon: boolean;
  multiplier: number;
  nextMilestone: number;
}

export function getStreakMultiplier(streak: number): number {
  if (streak >= 10) return 5;
  if (streak >= 5) return 3;
  if (streak >= 3) return 2;
  if (streak >= 2) return 1.5;
  return 1;
}

export function getNextMilestone(streak: number): number {
  if (streak < 2) return 2;
  if (streak < 3) return 3;
  if (streak < 5) return 5;
  if (streak < 10) return 10;
  return streak + 5;
}

export function updateStreak(
  current: QuickMatchStreak,
  won: boolean
): QuickMatchStreak {
  if (won) {
    const newCurrent = current.current + 1;
    return {
      current: newCurrent,
      best: Math.max(current.best, newCurrent),
      lastMatchWon: true,
      multiplier: getStreakMultiplier(newCurrent),
      nextMilestone: getNextMilestone(newCurrent),
    };
  } else {
    return {
      current: 0,
      best: current.best,
      lastMatchWon: false,
      multiplier: 1,
      nextMilestone: 2,
    };
  }
}

export function calculateReward(
  baseReward: number,
  streak: QuickMatchStreak
): number {
  return Math.floor(baseReward * streak.multiplier);
}
```

```typescript
// src/game/reducer.ts (adicionar ao reducer)

case 'FINALIZE_QUICK_MATCH': {
  const live = state.liveMatch;
  if (!live) return state;
  
  const won = live.homeScore > live.awayScore;
  const baseReward = 100; // OLE base
  
  const newStreak = updateStreak(
    state.quickMatchStreak ?? { current: 0, best: 0, lastMatchWon: false, multiplier: 1, nextMilestone: 2 },
    won
  );
  
  const reward = calculateReward(baseReward, newStreak);
  
  return {
    ...state,
    quickMatchStreak: newStreak,
    economy: {
      ...state.economy,
      ole: state.economy.ole + reward,
    },
  };
}
```

```typescript
// src/components/quickmatch/StreakBar.tsx

export function StreakBar({ streak }: { streak: QuickMatchStreak }) {
  if (streak.current === 0) return null;
  
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50"
    >
      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3">
        <span className="text-2xl">🔥</span>
        <div className="flex flex-col">
          <span className="text-xs font-bold uppercase tracking-wider">
            Sequência
          </span>
          <span className="text-lg font-black">
            {streak.current} VITÓRIAS
          </span>
        </div>
        <div className="h-8 w-px bg-white/30" />
        <div className="flex flex-col items-end">
          <span className="text-xs opacity-80">Multiplicador</span>
          <span className="text-xl font-black">{streak.multiplier}x</span>
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-center mt-2 text-sm text-white/90 font-medium"
      >
        Mais {streak.nextMilestone - streak.current} vitória
        {streak.nextMilestone - streak.current > 1 ? 's' : ''} = {getStreakMultiplier(streak.nextMilestone)}x
      </motion.div>
    </motion.div>
  );
}
```

---

## 8. CONCLUSÃO

O modo `/match/quick` do Olefoot tem **enorme potencial** para se tornar viciante como jogos de aposta e hyper-casual games. As mecânicas já existem (partidas rápidas, decisões táticas, eventos ao vivo), mas faltam os **gatilhos psicológicos** que criam o loop de dopamina.

### Principais mudanças necessárias:
1. **Recompensa imediata e visível** após cada partida
2. **Streak system** para criar tensão e FOMO
3. **Near-miss visual** para fazer o jogador sentir que "quase ganhou"
4. **Desafios diários** para criar hábito
5. **Ranking social** para competição
6. **Revanche rápida** para evitar que o jogador saia após perder
7. **Gacha rewards** para colecionismo e surpresa

### Impacto esperado:
- **+100% no tempo de sessão** (de 5min para 10-15min)
- **+200% em partidas por sessão** (de 2 para 6-8 partidas)
- **+50% em retention D7** (jogadores voltam mais)
- **+300% em engajamento diário** (jogam todo dia para completar desafios)

O Olefoot pode se tornar o **"Bet365 do futebol de manager"** — onde o jogador não consegue parar de jogar "só mais uma partida rápida".
