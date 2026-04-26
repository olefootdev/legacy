/**
 * Exemplo de Integração dos Componentes em MatchQuick.tsx
 * Cole este código nos locais apropriados do arquivo
 */

// ============================================
// 1. IMPORTS (adicionar no topo do arquivo)
// ============================================

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

// ============================================
// 2. STATE (adicionar junto com outros useStates)
// ============================================

const quickMatchIntensity = useGameStore((s) => s.quickMatchIntensity);
const streakChallenges = useGameStore((s) => s.streakChallenges);

// ============================================
// 3. LÓGICA NO LOOP DE TICK (dentro do useEffect principal, na função tick())
// ============================================

// Detectar arco narrativo a cada 5 minutos
if (lm.minute % 5 === 0 && lm.minute > 0) {
  const shots = lm.events.filter(e =>
    e.kind === 'shot_home' ||
    (e.kind === 'narrative' && e.text.toLowerCase().includes('chut'))
  ).length;

  const shotsAgainst = lm.events.filter(e =>
    e.kind === 'shot_away' ||
    (e.kind === 'narrative' && e.text.toLowerCase().includes('adversário') && e.text.toLowerCase().includes('chut'))
  ).length;

  const arc = detectNarrativeArc({
    minute: lm.minute,
    homeScore: lm.homeScore,
    awayScore: lm.awayScore,
    events: lm.events,
    possession: lm.possession === 'home' ? 60 : 40,
    shots,
    shotsAgainst,
  });

  dispatch({
    type: 'SIM_SYNC',
    minute: lm.minute,
    homeScore: lm.homeScore,
    awayScore: lm.awayScore,
    possession: lm.possession,
    events: lm.events,
    stats: lm.homeStats,
    carrierId: lm.onBallPlayerId ?? null,
    fullTime: false,
    clockPeriod: lm.clockPeriod ?? 'first_half',
  });

  // Atualizar narrativeArc no liveMatch
  const updatedLm = getGameState().liveMatch;
  if (updatedLm) {
    dispatch({
      type: 'SIM_SYNC',
      minute: updatedLm.minute,
      homeScore: updatedLm.homeScore,
      awayScore: updatedLm.awayScore,
      possession: updatedLm.possession,
      events: updatedLm.events,
      stats: updatedLm.homeStats,
      carrierId: updatedLm.onBallPlayerId ?? null,
      fullTime: false,
      clockPeriod: updatedLm.clockPeriod ?? 'first_half',
    });
  }
}

// Auto-switch de intensidade tática
const autoIntensity = shouldAutoSwitchIntensity(
  lm.minute,
  lm.homeScore,
  lm.awayScore,
  quickMatchIntensity?.current ?? 'balanced',
);
if (autoIntensity) {
  dispatch({ type: 'SET_TACTICAL_INTENSITY', level: autoIntensity });
}

// Trigger momentos interativos (15% de chance por minuto)
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
      .sort((a, b) => (b.attributes?.finishing ?? 0) - (a.attributes?.finishing ?? 0));
    if (takers.length >= 2) {
      const moment = buildSetPieceMoment(ctx, takers);
      dispatch({ type: 'TRIGGER_QUICK_INTERACTIVE_MOMENT', moment });
    }
  }
}

// ============================================
// 4. RENDERIZAÇÃO DOS COMPONENTES (no return do JSX)
// ============================================

{/* Overlay de Momento Interativo - renderizar no topo, fora de outros containers */}
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

{/* Indicador de Arco Narrativo - posicionar no topo da tela durante o jogo */}
{live?.narrativeArc && live.phase === 'playing' && !halfTimeUi && (
  <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 w-full max-w-md px-4">
    <QuickNarrativeArcIndicator
      arc={live.narrativeArc.arc}
      intensity={live.narrativeArc.intensity}
    />
  </div>
)}

{/* Controles de Intensidade Tática - posicionar acima do feed */}
{live?.phase === 'playing' && !halfTimeUi && !live.activeInteractiveMoment && (
  <div className="absolute bottom-32 left-4 right-4 z-10">
    <QuickTacticalIntensityControls
      current={quickMatchIntensity?.current ?? 'balanced'}
      onChange={(level) => dispatch({ type: 'SET_TACTICAL_INTENSITY', level })}
      disabled={false}
    />
    <div className="mt-2">
      <QuickTacticalIntensityInfo level={quickMatchIntensity?.current ?? 'balanced'} />
    </div>
  </div>
)}

{/* Painel de Bônus de Performance - renderizar no summary pós-jogo */}
{summary && live?.performanceBonuses && live.performanceBonuses.length > 0 && (
  <div className="mb-6">
    <QuickPerformanceBonusPanel
      bonuses={live.performanceBonuses}
      totalOle={calculateTotalBonusRewards(live.performanceBonuses).ole}
      totalExp={calculateTotalBonusRewards(live.performanceBonuses).exp}
    />
  </div>
)}

{/* Heatmap Tático - renderizar no summary pós-jogo */}
{summary && live?.events && (
  <div className="mb-6">
    <QuickMatchHeatmapPanel
      heatmap={buildHeatmapFromEvents(live.events, 60)}
      homeColor="#fbbf24"
      awayColor="#ef4444"
    />
  </div>
)}

{/* Desafios Semanais - renderizar na tela de pré-jogo ou Home */}
{streakChallenges && streakChallenges.challenges.length > 0 && (
  <div className="mb-6">
    <QuickStreakChallengesPanel challenges={streakChallenges.challenges} />
  </div>
)}

// ============================================
// 5. INICIALIZAR DESAFIOS SEMANAIS (no primeiro boot)
// ============================================

// Adicionar no useEffect de inicialização ou no primeiro acesso à partida rápida:
useEffect(() => {
  if (!streakChallenges || streakChallenges.challenges.length === 0) {
    dispatch({ type: 'REFRESH_STREAK_CHALLENGES' });
  }
}, [streakChallenges, dispatch]);

// ============================================
// NOTAS DE IMPLEMENTAÇÃO
// ============================================

/*
1. Os momentos interativos pausam o jogo automaticamente via overlay modal
2. O arco narrativo ajusta a velocidade do feed dinamicamente (use getArcFeedSpeed)
3. A intensidade tática afeta a fadiga e chances de golo (aplicar no motor)
4. Os bônus são calculados automaticamente no FINALIZE_MATCH
5. O heatmap é gerado a partir dos eventos da partida
6. Os desafios semanais renovam automaticamente aos domingos

PRÓXIMOS PASSOS:
- Ajustar posicionamento dos componentes conforme layout existente
- Testar cada sistema isoladamente
- Balancear frequência de momentos interativos (atualmente 15% por minuto)
- Ajustar recompensas de bônus conforme economia do jogo
- Adicionar sons/vibrações nos momentos críticos
*/
