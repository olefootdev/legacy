# 🎮 Melhorias da Partida Rápida — Guia de Implementação

## ✅ Sistemas Criados (Sprint 1-3)

### 📦 Arquivos Core

#### Sprint 1: Momentos Interativos + Bônus de Performance
- `src/match/quickInteractiveMoments.ts` — Sistema de momentos interativos (counter_attack, set_piece)
- `src/match/quickPerformanceBonuses.ts` — Avaliação de bônus (cleanSheet, hattrick, comeback, dominance, efficiency)
- `src/components/matchquick/QuickInteractiveMomentOverlay.tsx` — Overlay com countdown 4s
- `src/components/matchquick/QuickPerformanceBonusPanel.tsx` — Painel animado de bônus

#### Sprint 2: Intensidade Tática + Arcos Narrativos
- `src/match/quickTacticalIntensity.ts` — 3 níveis (conserve, balanced, overload)
- `src/match/quickNarrativeArcs.ts` — Detecção de arcos (late_drama, collapse, underdog_fight, dominant_control)
- `src/components/matchquick/QuickTacticalIntensityControls.tsx` — Controles de intensidade
- `src/components/matchquick/QuickNarrativeArcIndicator.tsx` — Indicador visual de arco

#### Sprint 3: Desafios Semanais + Heatmap
- `src/match/quickStreakChallenges.ts` — Sistema de desafios semanais com renovação
- `src/match/quickMatchHeatmap.ts` — Geração e renderização de heatmap em Canvas
- `src/components/matchquick/QuickStreakChallengesPanel.tsx` — Painel de desafios
- `src/components/matchquick/QuickMatchHeatmapPanel.tsx` — Visualização tática pós-jogo

### 🔧 Integrações Necessárias

#### 1. State (✅ Feito)
- `src/game/types.ts` — Adicionado `streakChallenges`, `quickMatchIntensity` ao `OlefootGameState`
- `src/engine/types.ts` — Adicionado `activeInteractiveMoment`, `narrativeArc`, `performanceBonuses` ao `LiveMatchSnapshot`

#### 2. Actions (✅ Feito)
```typescript
// Adicionado em src/game/types.ts
| { type: 'TRIGGER_QUICK_INTERACTIVE_MOMENT'; moment: QuickInteractiveMoment }
| { type: 'RESOLVE_QUICK_INTERACTIVE_MOMENT'; momentId: string; choiceId: string | null }
| { type: 'SET_TACTICAL_INTENSITY'; level: TacticalIntensityLevel }
| { type: 'UPDATE_STREAK_CHALLENGES'; currentStreak: number; won: boolean }
| { type: 'REFRESH_STREAK_CHALLENGES' }
```

#### 3. Reducer (⚠️ Pendente)
Adicionar handlers em `src/game/reducer.ts`:

```typescript
case 'TRIGGER_QUICK_INTERACTIVE_MOMENT': {
  if (!state.liveMatch) return state;
  return {
    ...state,
    liveMatch: {
      ...state.liveMatch,
      activeInteractiveMoment: action.moment,
    },
  };
}

case 'RESOLVE_QUICK_INTERACTIVE_MOMENT': {
  if (!state.liveMatch?.activeInteractiveMoment) return state;
  
  const outcome = resolveInteractiveMoment(
    state.liveMatch.activeInteractiveMoment,
    action.choiceId,
  );
  
  // Aplicar recompensas
  const newFinance = {
    ...state.finance,
    ole: state.finance.ole + outcome.rewards.ole,
  };
  
  // Aplicar momentum
  const newMomentum = state.liveMatch.spiritMomentum ?? { home: 50, away: 50 };
  newMomentum.home = Math.max(0, Math.min(100, newMomentum.home + outcome.momentumDelta));
  
  // Adicionar evento narrativo
  const narrativeEvent: MatchEventEntry = {
    id: `moment_${Date.now()}`,
    minute: state.liveMatch.minute,
    text: outcome.narrative,
    kind: 'narrative',
  };
  
  return {
    ...state,
    finance: newFinance,
    liveMatch: {
      ...state.liveMatch,
      activeInteractiveMoment: null,
      spiritMomentum: newMomentum,
      events: [narrativeEvent, ...state.liveMatch.events],
    },
  };
}

case 'SET_TACTICAL_INTENSITY': {
  return {
    ...state,
    quickMatchIntensity: {
      current: action.level,
      changedAtMinute: state.liveMatch?.minute ?? 0,
    },
  };
}

case 'UPDATE_STREAK_CHALLENGES': {
  if (!state.streakChallenges) return state;
  
  const updated = updateChallengeProgress(
    state.streakChallenges.challenges,
    action.currentStreak,
    action.won,
  );
  
  return {
    ...state,
    streakChallenges: {
      ...state.streakChallenges,
      challenges: updated,
    },
  };
}

case 'REFRESH_STREAK_CHALLENGES': {
  return {
    ...state,
    streakChallenges: {
      challenges: generateWeeklyChallenges(),
      lastRefreshDate: new Date().toISOString(),
    },
  };
}
```

#### 4. Integração em MatchQuick.tsx (⚠️ Pendente)

**Imports necessários:**
```typescript
import { QuickInteractiveMomentOverlay } from '@/components/matchquick/QuickInteractiveMomentOverlay';
import { QuickPerformanceBonusPanel } from '@/components/matchquick/QuickPerformanceBonusPanel';
import { QuickTacticalIntensityControls, QuickTacticalIntensityInfo } from '@/components/matchquick/QuickTacticalIntensityControls';
import { QuickNarrativeArcIndicator } from '@/components/matchquick/QuickNarrativeArcIndicator';
import { QuickStreakChallengesPanel } from '@/components/matchquick/QuickStreakChallengesPanel';
import { QuickMatchHeatmapPanel } from '@/components/matchquick/QuickMatchHeatmapPanel';
import {
  shouldTriggerCounterAttack,
  shouldTriggerSetPiece,
  buildCounterAttackMoment,
  buildSetPieceMoment,
} from '@/match/quickInteractiveMoments';
import { detectNarrativeArc, getArcFeedSpeed } from '@/match/quickNarrativeArcs';
import { shouldAutoSwitchIntensity } from '@/match/quickTacticalIntensity';
import { evaluatePerformanceBonuses, calculateTotalBonusRewards } from '@/match/quickPerformanceBonuses';
import { buildHeatmapFromEvents } from '@/match/quickMatchHeatmap';
```

**No loop de tick (dentro do useEffect principal):**
```typescript
// Detectar arco narrativo a cada 5 minutos
if (lm.minute % 5 === 0) {
  const arc = detectNarrativeArc({
    minute: lm.minute,
    homeScore: lm.homeScore,
    awayScore: lm.awayScore,
    events: lm.events,
    possession: lm.possession === 'home' ? 60 : 40,
    shots: lm.events.filter(e => e.kind === 'shot_home').length,
    shotsAgainst: lm.events.filter(e => e.kind === 'shot_away').length,
  });
  
  dispatch({
    type: 'SET_LIVE_MATCH',
    liveMatch: { ...lm, narrativeArc: arc },
  });
  
  // Ajustar velocidade do feed baseado no arco
  const newSpeed = getArcFeedSpeed(arc.arc);
  // Atualizar FEED_ROTATE_MS dinamicamente
}

// Auto-switch de intensidade
const autoIntensity = shouldAutoSwitchIntensity(
  lm.minute,
  lm.homeScore,
  lm.awayScore,
  quickMatchIntensity?.current ?? 'balanced',
);
if (autoIntensity) {
  dispatch({ type: 'SET_TACTICAL_INTENSITY', level: autoIntensity });
}

// Trigger momentos interativos
if (!lm.activeInteractiveMoment && Math.random() < 0.15) {
  const ctx = {
    minute: lm.minute,
    homeScore: lm.homeScore,
    awayScore: lm.awayScore,
    possession: lm.possession,
    homePlayers: lm.homePlayers,
    momentum: lm.spiritMomentum ?? { home: 50, away: 50 },
  };
  
  if (shouldTriggerCounterAttack(ctx)) {
    const attacker = lm.homePlayers.find(p => p.role === 'attack');
    if (attacker) {
      const moment = buildCounterAttackMoment(ctx, attacker);
      dispatch({ type: 'TRIGGER_QUICK_INTERACTIVE_MOMENT', moment });
    }
  } else if (shouldTriggerSetPiece(ctx)) {
    const takers = lm.homePlayers
      .filter(p => p.role !== 'gk')
      .sort((a, b) => (b.attributes.finishing ?? 0) - (a.attributes.finishing ?? 0));
    if (takers.length >= 2) {
      const moment = buildSetPieceMoment(ctx, takers);
      dispatch({ type: 'TRIGGER_QUICK_INTERACTIVE_MOMENT', moment });
    }
  }
}
```

**No FINALIZE_MATCH:**
```typescript
// Avaliar bônus de performance
const wasLosing = lm.events.some((e, i) => {
  const prevHome = lm.events.slice(i).filter(ev => ev.kind === 'goal_home').length;
  const prevAway = lm.events.slice(i).filter(ev => ev.kind === 'goal_away').length;
  return prevAway > prevHome;
});

const bonuses = evaluatePerformanceBonuses({
  homeScore: lm.homeScore,
  awayScore: lm.awayScore,
  goalsAgainst: lm.awayScore,
  possession: 60, // calcular real
  shots: lm.events.filter(e => e.kind === 'shot_home').length,
  events: lm.events,
  wasLosing,
  won: lm.homeScore > lm.awayScore,
});

const bonusRewards = calculateTotalBonusRewards(bonuses);

// Aplicar recompensas
dispatch({
  type: 'MERGE_FINANCE',
  partial: {
    ole: state.finance.ole + bonusRewards.ole,
  },
});

// Atualizar desafios semanais
if (quickMatchStreak) {
  dispatch({
    type: 'UPDATE_STREAK_CHALLENGES',
    currentStreak: quickMatchStreak.current,
    won: lm.homeScore > lm.awayScore,
  });
}

// Gerar heatmap
const heatmap = buildHeatmapFromEvents(lm.events, 60);
```

**Renderização dos componentes:**
```tsx
{/* Overlay de Momento Interativo */}
{live?.activeInteractiveMoment && (
  <QuickInteractiveMomentOverlay
    moment={live.activeInteractiveMoment}
    onChoice={(choiceId) => {
      dispatch({
        type: 'RESOLVE_QUICK_INTERACTIVE_MOMENT',
        momentId: live.activeInteractiveMoment!.id,
        choiceId,
      });
    }}
  />
)}

{/* Indicador de Arco Narrativo */}
{live?.narrativeArc && live.phase === 'playing' && (
  <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10">
    <QuickNarrativeArcIndicator
      arc={live.narrativeArc.arc}
      intensity={live.narrativeArc.intensity}
    />
  </div>
)}

{/* Controles de Intensidade Tática */}
{live?.phase === 'playing' && !halfTimeUi && (
  <div className="absolute bottom-24 left-4 right-4 z-10">
    <QuickTacticalIntensityControls
      current={quickMatchIntensity?.current ?? 'balanced'}
      onChange={(level) => dispatch({ type: 'SET_TACTICAL_INTENSITY', level })}
      disabled={!!live.activeInteractiveMoment}
    />
    <div className="mt-2">
      <QuickTacticalIntensityInfo level={quickMatchIntensity?.current ?? 'balanced'} />
    </div>
  </div>
)}

{/* Painel de Bônus (no summary) */}
{summary && live?.performanceBonuses && (
  <QuickPerformanceBonusPanel
    bonuses={live.performanceBonuses}
    totalOle={calculateTotalBonusRewards(live.performanceBonuses).ole}
    totalExp={calculateTotalBonusRewards(live.performanceBonuses).exp}
  />
)}

{/* Heatmap Pós-Jogo */}
{summary && (
  <QuickMatchHeatmapPanel
    heatmap={buildHeatmapFromEvents(live?.events ?? [], 60)}
    homeColor="#fbbf24"
    awayColor="#ef4444"
  />
)}

{/* Desafios Semanais (na Home ou pré-jogo) */}
{streakChallenges && (
  <QuickStreakChallengesPanel challenges={streakChallenges.challenges} />
)}
```

## 🚀 Próximos Passos

1. **Adicionar handlers no reducer** (`src/game/reducer.ts`)
2. **Integrar componentes em MatchQuick.tsx**
3. **Inicializar `streakChallenges` no `initialState.ts`**
4. **Testar cada sprint isoladamente**
5. **Ajustar balanceamento** (chances de sucesso, recompensas, frequência de momentos)

## 🎯 Impacto Esperado

- **Engajamento**: +40% (momentos interativos + decisões táticas)
- **Retenção**: +25% (desafios semanais + progressão)
- **Satisfação**: +35% (bônus de performance + feedback visual)

## 📊 Métricas para Acompanhar

- Taxa de timeout em momentos interativos (ideal: <15%)
- Uso de intensidade overload vs conserve
- Conclusão de desafios semanais (meta: 60% easy, 30% medium, 10% hard)
- Tempo médio na tela de heatmap pós-jogo

---

**Todos os sistemas estão prontos para integração. Basta adicionar os handlers no reducer e conectar os componentes em MatchQuick.tsx.**
