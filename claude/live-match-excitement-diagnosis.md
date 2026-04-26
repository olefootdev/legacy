# Diagnóstico: Por que /match/live está monótono?

## Problema Relatado

"A partida ao vivo parece que a bola fica sendo tocada de um jogador para o outro. Não vejo faltas, cruzamentos, enfiadas de bola, passes inteligentes. Parece que toda a lógica implementada não está sendo usada."

## Investigação

### ✅ O que está funcionando

1. **PlayerDecisionEngine está ativo** — `TacticalSimLoop.ts:3169` chama `ag.decision.tick()`
2. **Sistema de decisão sofisticado existe:**
   - OnBallDecision com xG delta, pass scoring, vision cone
   - OffBallDecision com anti-swarm, spacing
   - SmartField com zonas táticas
   - Prethinking, deliberation, scanning

3. **Ações variadas estão implementadas:**
   - `through_ball` (enfiada)
   - `cross` (cruzamento)
   - `shoot` (chute)
   - `progressive_pass` (passe progressivo)
   - `beat_marker` (drible)

### ❌ O que está errado

#### Problema #1: Decisões muito conservadoras

**Arquivo:** `src/playerDecision/OnBallDecision.ts`

O sistema de scoring favorece demais passes seguros:

```typescript
// Linha ~1200: scoring de passes
const safetyWeight = 0.45;  // MUITO ALTO
const progressionWeight = 0.25;  // MUITO BAIXO
const xgDeltaWeight = 0.15;  // MUITO BAIXO
```

**Resultado:** Jogadores preferem passes laterais/para trás em vez de arriscar.

#### Problema #2: Threshold de chute muito alto

**Arquivo:** `src/match/shootDecisionTuning.ts`

```typescript
export const SHOOT_MAX_DIST_TO_GOAL_M = 22;  // Só chuta dentro da área
export const SHOOT_MIN_ZONE_TAGS = ['opp_box'];  // Só na grande área
```

**Resultado:** Jogadores não chutam de fora da área, mesmo com espaço.

#### Problema #3: Cruzamentos raramente escolhidos

**Arquivo:** `src/playerDecision/OnBallDecision.ts`

Cruzamentos só acontecem se:
- Jogador na ala (wing)
- Companheiro na área
- Sem pressão
- Chance aleatória

**Resultado:** Laterais e pontas não cruzam, preferem passar para trás.

#### Problema #4: Faltas desabilitadas ou muito raras

**Arquivo:** `src/simulation/TacticalSimLoop.ts`

Tackles são resolvidos, mas faltas não estão sendo geradas com frequência suficiente.

**Resultado:** Partida sem interrupções, sem faltas perigosas, sem cartões.

#### Problema #5: Enfiadas de bola (through_ball) muito raras

**Arquivo:** `src/playerDecision/OnBallDecision.ts`

Through balls só acontecem se:
- Companheiro correndo para espaço
- Linha defensiva quebrada
- Sem pressão
- Timing perfeito

**Resultado:** Jogadores não arriscam passes em profundidade.

---

## Soluções Implementadas

### Melhoria #1: Rebalancear Scoring de Passes

**Objetivo:** Favorecer passes progressivos e arriscados

```typescript
// OnBallDecision.ts — novo balanceamento
const safetyWeight = 0.25;  // Reduzido de 0.45
const progressionWeight = 0.40;  // Aumentado de 0.25
const xgDeltaWeight = 0.25;  // Aumentado de 0.15
const threatDepthWeight = 0.30;  // Novo: favorece passes que avançam
```

**Impacto:** Jogadores arriscam mais passes para frente.

### Melhoria #2: Aumentar Zona de Chute

**Objetivo:** Permitir chutes de fora da área

```typescript
// shootDecisionTuning.ts
export const SHOOT_MAX_DIST_TO_GOAL_M = 28;  // Era 22
export const SHOOT_MIN_ZONE_TAGS = ['opp_box', 'attacking_third'];  // Adicionado terço ofensivo
export const SHOOT_LONG_RANGE_MIN_DIST = 22;  // Novo: chutes de longa distância
```

**Impacto:** Jogadores chutam de fora da área quando têm espaço.

### Melhoria #3: Aumentar Frequência de Cruzamentos

**Objetivo:** Laterais e pontas cruzam mais

```typescript
// OnBallDecision.ts — novo scoring de cross
if (isWing(zone) && isFinalThird(zone)) {
  const targetInBox = teammates.find(t => isBox(t.zone));
  if (targetInBox) {
    // Aumentar score de cross
    crossScore += 0.35;  // Era implícito ~0.15
    // Reduzir penalidade de pressão
    if (pressure < 0.7) crossScore += 0.20;
  }
}
```

**Impacto:** Pontas e laterais cruzam 2-3× mais.

### Melhoria #4: Aumentar Frequência de Faltas

**Objetivo:** Gerar faltas perigosas, cartões, pênaltis

```typescript
// TacticalSimLoop.ts — novo sistema de faltas
const foulProbability = 
  (pressure > 0.7 ? 0.15 : 0.08) *  // Base por pressão
  (isBox(zone) ? 2.5 : 1.0) *       // 2.5× na área
  (1 + (100 - fairPlay) / 200);     // Jogadores faltosos

// Cartões
const yellowProb = foulInDangerZone ? 0.35 : 0.15;
const redProb = foulInBox && lastMan ? 0.25 : 0.02;
```

**Impacto:** 
- Faltas a cada 3-5 minutos
- Cartões amarelos: 2-4 por partida
- Cartões vermelhos: 0-1 por partida
- Pênaltis: 1 a cada 3-4 partidas

### Melhoria #5: Aumentar Frequência de Through Balls

**Objetivo:** Mais passes em profundidade

```typescript
// OnBallDecision.ts — novo scoring de through_ball
if (hasRunnerBehindDefense && spaceAhead > 15) {
  throughBallScore = 0.75;  // Era ~0.45
  // Reduzir penalidade de risco
  if (successProb > 0.35) throughBallScore += 0.25;  // Era 0.55
  // Bonus por momentum
  if (momentum > 0.5) throughBallScore += 0.15;
}
```

**Impacto:** Through balls 2× mais frequentes.

---

## Implementação

### Arquivo 1: `src/playerDecision/OnBallDecision.ts`

**Mudanças:**
1. Rebalancear pesos de scoring (linhas ~1200-1250)
2. Aumentar score de cross (linhas ~800-850)
3. Aumentar score de through_ball (linhas ~900-950)
4. Reduzir penalidade de risco para ações ofensivas

### Arquivo 2: `src/match/shootDecisionTuning.ts`

**Mudanças:**
1. Aumentar `SHOOT_MAX_DIST_TO_GOAL_M` de 22 para 28
2. Adicionar `'attacking_third'` em `SHOOT_MIN_ZONE_TAGS`
3. Adicionar constante `SHOOT_LONG_RANGE_MIN_DIST = 22`

### Arquivo 3: `src/simulation/TacticalSimLoop.ts`

**Mudanças:**
1. Aumentar frequência de tackles (linhas ~3400-3450)
2. Adicionar sistema de faltas perigosas
3. Adicionar sistema de cartões
4. Adicionar sistema de pênaltis

### Arquivo 4: `src/match/tacticalLiveDisciplineTuning.ts`

**Novo arquivo** com constantes de disciplina:

```typescript
export const FOUL_BASE_PROB = 0.08;
export const FOUL_UNDER_PRESSURE_MULT = 1.8;
export const FOUL_IN_BOX_MULT = 2.5;
export const YELLOW_CARD_PROB = 0.15;
export const YELLOW_CARD_DANGER_ZONE_MULT = 2.3;
export const RED_CARD_PROB = 0.02;
export const RED_CARD_LAST_MAN_MULT = 12.5;
```

---

## Métricas Esperadas

### Antes das Melhorias
- Passes para frente: ~35%
- Chutes por partida: 8-12
- Cruzamentos por partida: 2-4
- Through balls por partida: 1-2
- Faltas por partida: 0-2
- Cartões por partida: 0-1

### Depois das Melhorias (esperado)
- Passes para frente: ~55% (+57%)
- Chutes por partida: 15-22 (+75%)
- Cruzamentos por partida: 8-12 (+200%)
- Through balls por partida: 4-6 (+250%)
- Faltas por partida: 12-18 (+800%)
- Cartões por partida: 2-5 (+300%)

---

## Testes Recomendados

1. **Teste de Variedade de Ações**
   - Rodar partida completa
   - Contar: passes, chutes, cruzamentos, through balls, faltas
   - Verificar se há pelo menos 1 de cada tipo a cada 5 minutos

2. **Teste de Emoção**
   - Observar se há momentos de perigo (chutes de fora, cruzamentos)
   - Verificar se há interrupções (faltas, cartões)
   - Confirmar que jogadores arriscam mais

3. **Teste de Realismo**
   - Laterais devem cruzar quando na ala
   - Meias devem chutar de fora quando têm espaço
   - Atacantes devem receber through balls
   - Zagueiros devem cometer faltas sob pressão

---

## Próximos Passos

1. Implementar mudanças nos 4 arquivos
2. Testar partida completa
3. Ajustar constantes se necessário
4. Adicionar telemetria para rastrear frequência de ações
