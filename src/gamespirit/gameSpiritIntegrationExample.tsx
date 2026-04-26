/**
 * Exemplo de integração do GameSpiritEnhanced em uma partida.
 *
 * Este arquivo mostra como integrar o sistema de insights táticos
 * em uma partida existente sem quebrar o código atual.
 */

import {
  gameSpiritTickEnhanced,
  formatInsightForFeed,
  formatMemorableMoments,
  MemorableMomentsCollector,
  type EnhancedSpiritOutcome,
} from './gameSpiritEnhanced';
import { buildSpiritContext } from './GameSpirit';
import type { PitchPlayerState, PossessionSide } from '@/engine/types';
import type { PlayerEntity } from '@/entities/types';

/**
 * EXEMPLO 1: Integração em loop de partida existente
 *
 * Substitua `gameSpiritTick` por `gameSpiritTickEnhanced` onde você
 * já chama o GameSpirit. O resto do código continua igual.
 */
export function exampleMatchLoop() {
  // Cria o collector de momentos memoráveis no início da partida
  const momentsCollector = new MemorableMomentsCollector();

  // Estado da partida (exemplo simplificado)
  let minute = 1;
  let homeScore = 0;
  let awayScore = 0;
  const feedLines: string[] = [];

  // Loop de minutos da partida
  while (minute <= 90) {
    // Constrói o contexto (igual ao código existente)
    const ctx = buildSpiritContext({
      minute,
      homeScore,
      awayScore,
      possession: 'home' as PossessionSide,
      ball: { x: 50, y: 50 },
      crowdSupport: 75,
      tacticalMentality: 65,
      opponentStrength: 80,
      homeRoster: [] as PlayerEntity[], // Seu roster real aqui
      homePlayers: [] as PitchPlayerState[], // Seus jogadores em campo aqui
      homeShort: 'Casa',
      recentFeedLines: feedLines.slice(-3),
    });

    // MUDANÇA: usa gameSpiritTickEnhanced em vez de gameSpiritTick
    const outcome: EnhancedSpiritOutcome = gameSpiritTickEnhanced(
      ctx,
      'Visitante',
      0,
      Date.now(),
      momentsCollector, // Passa o collector para acumular momentos
    );

    // Adiciona narrativa normal ao feed (igual ao código existente)
    feedLines.push(outcome.narrative);

    // NOVO: Se houver insight tático, adiciona ao feed também
    if (outcome.tacticalInsight) {
      const insightText = formatInsightForFeed(outcome.tacticalInsight);
      feedLines.push(insightText);
    }

    // Atualiza placar se houver gol (igual ao código existente)
    if (outcome.goalFor === 'home') homeScore++;
    if (outcome.goalFor === 'away') awayScore++;

    minute++;
  }

  // NOVO: Ao final da partida, seleciona os momentos memoráveis
  const memorableMoments = momentsCollector.selectTopMoments();

  // Exibe os momentos memoráveis (pode ser em tela de pós-jogo)
  console.log(formatMemorableMoments(memorableMoments));

  // Estatísticas dos momentos (opcional, para debug)
  const stats = momentsCollector.getStats();
  console.log('Momentos candidatos:', stats.totalCandidates);
  console.log('Impacto emocional médio:', stats.avgEmotionalImpact);
  console.log('Momentos de alto impacto:', stats.highImpactCount);

  return {
    feedLines,
    memorableMoments,
    stats,
  };
}

/**
 * EXEMPLO 2: Integração gradual (sem quebrar código existente)
 *
 * Se você não quer mudar o código de partida agora, pode adicionar
 * insights em paralelo sem modificar o fluxo principal.
 */
export function exampleGradualIntegration() {
  const momentsCollector = new MemorableMomentsCollector();

  // Seu código de partida existente continua igual
  // ...

  // Depois de cada tick do GameSpirit, você pode gerar insight separadamente:
  /*
  const outcome = gameSpiritTick(ctx, awayShort, seq, now);

  // Adiciona insight em paralelo (não afeta o outcome original)
  const insight = generateTacticalInsight(ctx, outcome);
  if (insight) {
    momentsCollector.addInsight(insight, ctx.possession, ctx.onBall?.name, { home: homeScore, away: awayScore });
    // Exibe o insight onde você quiser (feed, console, etc)
  }
  */
}

/**
 * EXEMPLO 3: Exibição de insights no feed da UI
 *
 * Como renderizar insights no componente de feed existente.
 */
export function exampleFeedRendering(feedLines: string[]) {
  return feedLines.map((line, idx) => {
    // Detecta se é um insight do GameSpirit
    const isInsight = line.startsWith('🧠 GameSpirit:');

    return (
      <div
        key={idx}
        className={isInsight ? 'feed-line feed-line-insight' : 'feed-line'}
        style={
          isInsight
            ? {
                backgroundColor: 'rgba(255, 215, 0, 0.1)',
                borderLeft: '3px solid #FFD700',
                paddingLeft: '8px',
                fontStyle: 'italic',
                color: '#FFD700',
              }
            : undefined
        }
      >
        {line}
      </div>
    );
  });
}

/**
 * EXEMPLO 4: Tela de pós-jogo com momentos memoráveis
 */
export function examplePostGameScreen(moments: ReturnType<typeof MemorableMomentsCollector.prototype.selectTopMoments>) {
  if (moments.length === 0) return null;

  return (
    <div className="memorable-moments-section">
      <h2>⭐ Momentos Memoráveis</h2>
      {moments.map((moment, idx) => (
        <div key={idx} className="memorable-moment-card">
          <div className="moment-header">
            <span className="moment-minute">{moment.minute}'</span>
            <span className="moment-type">{moment.type}</span>
            {moment.playerName && <span className="moment-player">{moment.playerName}</span>}
          </div>
          <div className="moment-insight">{moment.insight}</div>
          {moment.consequence && (
            <div className="moment-consequence">→ {moment.consequence}</div>
          )}
          <div className="moment-impact">
            Impacto emocional: {moment.emotionalImpact}/100
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * EXEMPLO 5: CSS sugerido para os insights
 */
export const suggestedCSS = `
/* Linha de insight no feed */
.feed-line-insight {
  background: linear-gradient(90deg, rgba(255, 215, 0, 0.15) 0%, transparent 100%);
  border-left: 3px solid #FFD700;
  padding: 8px 12px;
  margin: 4px 0;
  font-style: italic;
  color: #FFD700;
  font-weight: 500;
  animation: insightFadeIn 0.5s ease-out;
}

@keyframes insightFadeIn {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Card de momento memorável */
.memorable-moment-card {
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.1) 0%, rgba(255, 215, 0, 0.05) 100%);
  border: 2px solid rgba(255, 215, 0, 0.3);
  border-radius: 8px;
  padding: 16px;
  margin: 12px 0;
  transition: transform 0.2s, box-shadow 0.2s;
}

.memorable-moment-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 215, 0, 0.2);
}

.moment-header {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 8px;
  font-weight: 600;
}

.moment-minute {
  color: #FFD700;
  font-size: 1.1em;
}

.moment-type {
  color: #FFF;
  font-size: 0.9em;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.moment-player {
  color: #FFD700;
  font-size: 0.95em;
}

.moment-insight {
  color: #FFF;
  font-style: italic;
  margin: 8px 0;
  line-height: 1.5;
}

.moment-consequence {
  color: rgba(255, 215, 0, 0.8);
  font-size: 0.9em;
  margin-top: 8px;
}

.moment-impact {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.85em;
  margin-top: 8px;
}
`;
