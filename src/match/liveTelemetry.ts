/**
 * Sistema de telemetria para partidas ao vivo (test2d).
 * Rastreia todas as ações executadas e gera métricas de qualidade.
 */

export interface LiveMatchTelemetry {
  // Contadores de ações
  actions: {
    passes: number;
    progressivePasses: number;
    throughBalls: number;
    crosses: number;
    lowCrosses: number;
    highCrosses: number;
    shoots: number;
    shootsLongRange: number;
    dribbles: number;
    tackles: number;
    fouls: number;
    yellowCards: number;
    redCards: number;
    drawFouls: number;
  };

  // Métricas de qualidade
  quality: {
    forwardPassRatio: number;  // % de passes para frente
    actionVariety: number;      // Diversidade de ações (0-1)
    excitementScore: number;    // Score de emoção (0-100)
    physicalityScore: number;   // Score de fisicalidade (0-100)
  };

  // Timeline de eventos importantes
  timeline: Array<{
    minute: number;
    action: string;
    player: string;
    zone: string;
  }>;

  // Estatísticas por minuto
  minuteStats: Record<number, {
    actions: number;
    shoots: number;
    fouls: number;
  }>;
}

let currentTelemetry: LiveMatchTelemetry | null = null;

export function initTelemetry(): void {
  currentTelemetry = {
    actions: {
      passes: 0,
      progressivePasses: 0,
      throughBalls: 0,
      crosses: 0,
      lowCrosses: 0,
      highCrosses: 0,
      shoots: 0,
      shootsLongRange: 0,
      dribbles: 0,
      tackles: 0,
      fouls: 0,
      yellowCards: 0,
      redCards: 0,
      drawFouls: 0,
    },
    quality: {
      forwardPassRatio: 0,
      actionVariety: 0,
      excitementScore: 0,
      physicalityScore: 0,
    },
    timeline: [],
    minuteStats: {},
  };
}

export function trackAction(
  action: string,
  minute: number,
  player: string,
  zone: string,
  metadata?: Record<string, any>
): void {
  if (!currentTelemetry) return;

  const a = currentTelemetry.actions;

  // Incrementar contadores
  switch (action) {
    case 'pass':
    case 'simple_pass':
    case 'safe_pass':
      a.passes++;
      if (metadata?.isForward) a.progressivePasses++;
      break;
    case 'progressive_pass':
      a.passes++;
      a.progressivePasses++;
      break;
    case 'through_ball':
      a.throughBalls++;
      a.passes++;
      a.progressivePasses++;
      break;
    case 'cross':
    case 'high_cross':
      a.crosses++;
      a.highCrosses++;
      break;
    case 'low_cross':
      a.crosses++;
      a.lowCrosses++;
      break;
    case 'shoot':
      a.shoots++;
      break;
    case 'shoot_long_range':
      a.shoots++;
      a.shootsLongRange++;
      break;
    case 'progressive_dribble':
    case 'beat_marker':
    case 'aggressive_carry':
    case 'cut_inside':
    case 'turn_on_marker':
      a.dribbles++;
      break;
    case 'tackle':
      a.tackles++;
      break;
    case 'foul':
      a.fouls++;
      break;
    case 'yellow_card':
      a.yellowCards++;
      break;
    case 'red_card':
      a.redCards++;
      break;
    case 'draw_foul':
      a.drawFouls++;
      break;
  }

  // Adicionar à timeline (só ações importantes)
  const importantActions = [
    'through_ball', 'cross', 'high_cross', 'low_cross',
    'shoot', 'shoot_long_range', 'foul', 'yellow_card', 'red_card'
  ];
  if (importantActions.includes(action)) {
    currentTelemetry.timeline.push({ minute, action, player, zone });
  }

  // Atualizar stats por minuto
  const m = Math.floor(minute);
  if (!currentTelemetry.minuteStats[m]) {
    currentTelemetry.minuteStats[m] = { actions: 0, shoots: 0, fouls: 0 };
  }
  currentTelemetry.minuteStats[m].actions++;
  if (action.includes('shoot')) currentTelemetry.minuteStats[m].shoots++;
  if (action === 'foul') currentTelemetry.minuteStats[m].fouls++;
}

export function computeQualityMetrics(): void {
  if (!currentTelemetry) return;

  const a = currentTelemetry.actions;
  const q = currentTelemetry.quality;

  // Forward pass ratio
  q.forwardPassRatio = a.passes > 0 ? a.progressivePasses / a.passes : 0;

  // Action variety (Shannon entropy simplificado)
  const total = Object.values(a).reduce((sum, v) => sum + v, 0);
  if (total > 0) {
    const types = [
      a.passes, a.throughBalls, a.crosses, a.shoots,
      a.dribbles, a.tackles, a.fouls
    ].filter(v => v > 0);
    q.actionVariety = types.length / 7;  // 7 tipos principais
  }

  // Excitement score (baseado em ações ofensivas)
  const offensiveActions = a.shoots + a.throughBalls + a.crosses + a.dribbles;
  q.excitementScore = Math.min(100, offensiveActions * 2);

  // Physicality score (baseado em faltas e tackles)
  const physicalActions = a.tackles + a.fouls + a.yellowCards * 2 + a.redCards * 5;
  q.physicalityScore = Math.min(100, physicalActions * 3);
}

export function getTelemetry(): LiveMatchTelemetry | null {
  if (!currentTelemetry) return null;
  computeQualityMetrics();
  return currentTelemetry;
}

export function generateReport(): string {
  if (!currentTelemetry) return 'Telemetria não inicializada';

  computeQualityMetrics();

  const a = currentTelemetry.actions;
  const q = currentTelemetry.quality;

  return `
╔══════════════════════════════════════════════════════════╗
║         RELATÓRIO DE TELEMETRIA — PARTIDA AO VIVO        ║
╠══════════════════════════════════════════════════════════╣

📊 CONTADORES DE AÇÕES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Passes totais:              ${a.passes.toString().padStart(3)}
  ├─ Passes progressivos:     ${a.progressivePasses.toString().padStart(3)} (${(q.forwardPassRatio * 100).toFixed(1)}%)
  └─ Through balls:           ${a.throughBalls.toString().padStart(3)}

  Cruzamentos:                ${a.crosses.toString().padStart(3)}
  ├─ Cruzamentos altos:       ${a.highCrosses.toString().padStart(3)}
  └─ Cruzamentos rasteiros:   ${a.lowCrosses.toString().padStart(3)}

  Chutes:                     ${a.shoots.toString().padStart(3)}
  └─ Chutes de longa dist.:   ${a.shootsLongRange.toString().padStart(3)}

  Dribles:                    ${a.dribbles.toString().padStart(3)}
  Desarmes:                   ${a.tackles.toString().padStart(3)}

  Faltas:                     ${a.fouls.toString().padStart(3)}
  ├─ Cartões amarelos:        ${a.yellowCards.toString().padStart(3)}
  ├─ Cartões vermelhos:       ${a.redCards.toString().padStart(3)}
  └─ Faltas provocadas:       ${a.drawFouls.toString().padStart(3)}

📈 MÉTRICAS DE QUALIDADE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Variedade de ações:         ${(q.actionVariety * 100).toFixed(1)}% ${q.actionVariety > 0.7 ? '✅' : q.actionVariety > 0.5 ? '⚠️' : '❌'}
  Score de emoção:            ${q.excitementScore.toFixed(1)}/100 ${q.excitementScore > 60 ? '✅' : q.excitementScore > 40 ? '⚠️' : '❌'}
  Score de fisicalidade:      ${q.physicalityScore.toFixed(1)}/100 ${q.physicalityScore > 40 ? '✅' : q.physicalityScore > 20 ? '⚠️' : '❌'}
  Ratio passes p/ frente:     ${(q.forwardPassRatio * 100).toFixed(1)}% ${q.forwardPassRatio > 0.5 ? '✅' : q.forwardPassRatio > 0.35 ? '⚠️' : '❌'}

🎯 DIAGNÓSTICO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${generateDiagnosis(a, q)}

╚══════════════════════════════════════════════════════════╝
  `.trim();
}

function generateDiagnosis(
  actions: LiveMatchTelemetry['actions'],
  quality: LiveMatchTelemetry['quality']
): string {
  const issues: string[] = [];
  const successes: string[] = [];

  // Análise de chutes
  if (actions.shoots < 8) {
    issues.push('❌ Poucos chutes (< 8) — jogadores muito conservadores');
  } else if (actions.shoots < 15) {
    issues.push('⚠️  Chutes abaixo do esperado (8-15) — pode melhorar');
  } else {
    successes.push('✅ Boa frequência de chutes (15+)');
  }

  // Análise de cruzamentos
  if (actions.crosses < 4) {
    issues.push('❌ Poucos cruzamentos (< 4) — laterais não estão cruzando');
  } else if (actions.crosses < 8) {
    issues.push('⚠️  Cruzamentos abaixo do esperado (4-8)');
  } else {
    successes.push('✅ Boa frequência de cruzamentos (8+)');
  }

  // Análise de through balls
  if (actions.throughBalls < 2) {
    issues.push('❌ Poucos through balls (< 2) — sem passes em profundidade');
  } else if (actions.throughBalls < 4) {
    issues.push('⚠️  Through balls abaixo do esperado (2-4)');
  } else {
    successes.push('✅ Boa frequência de through balls (4+)');
  }

  // Análise de faltas
  if (actions.fouls < 8) {
    issues.push('❌ Poucas faltas (< 8) — jogo sem fisicalidade');
  } else if (actions.fouls < 12) {
    issues.push('⚠️  Faltas abaixo do esperado (8-12)');
  } else {
    successes.push('✅ Boa frequência de faltas (12+)');
  }

  // Análise de variedade
  if (quality.actionVariety < 0.5) {
    issues.push('❌ Baixa variedade de ações — jogo monótono');
  } else if (quality.actionVariety < 0.7) {
    issues.push('⚠️  Variedade moderada — pode ter mais tipos de ação');
  } else {
    successes.push('✅ Boa variedade de ações');
  }

  // Análise de passes progressivos
  if (quality.forwardPassRatio < 0.35) {
    issues.push('❌ Muitos passes para trás — jogo muito conservador');
  } else if (quality.forwardPassRatio < 0.5) {
    issues.push('⚠️  Passes progressivos abaixo do esperado');
  } else {
    successes.push('✅ Boa proporção de passes para frente');
  }

  let diagnosis = '';
  if (successes.length > 0) {
    diagnosis += '  ' + successes.join('\n  ') + '\n\n';
  }
  if (issues.length > 0) {
    diagnosis += '  ' + issues.join('\n  ');
  }

  return diagnosis || '  ✅ Todas as métricas estão boas!';
}
