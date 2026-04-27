/**
 * Coach Global Match Integration
 *
 * Sistema que conecta o Coach Agent com o Match Global:
 * - Pede orientações antes das rodadas
 * - Envia relatórios pós-rodada
 * - Sugere ajustes táticos baseados em resultados
 */

import type { CoachAgent, TeamContext, CoachAction } from './types';
import type { GlobalRound, GlobalFixture, CoachCommands } from '@/match/globalMatch';
import type { OlefootGameState } from '@/game/types';
import { nanoid } from 'nanoid';

export interface PreMatchCoachRequest {
  roundNumber: number;
  opponent: string;
  division: string;
  teamOverall: number;
  opponentOverall: number;
  recentForm: Array<'W' | 'D' | 'L'>;
  suggestedCommands: CoachCommands;
  reasoning: string;
}

export interface PostMatchCoachReport {
  roundNumber: number;
  result: 'win' | 'draw' | 'loss';
  scoreHome: number;
  scoreAway: number;
  opponent: string;
  keyEvents: string[];
  analysis: string;
  suggestions: string[];
}

/**
 * Gera pedido de orientação pré-rodada
 */
export function generatePreMatchRequest(
  coach: CoachAgent,
  round: GlobalRound,
  teamContext: TeamContext,
  gameState: OlefootGameState
): PreMatchCoachRequest | null {
  // Encontra fixture do time do manager
  const clubId = gameState.club.id;
  const fixture = round.fixtures.find(
    f => f.homeTeamId === clubId || f.awayTeamId === clubId
  );

  if (!fixture) return null;

  const isHome = fixture.homeTeamId === clubId;
  const teamOverall = isHome ? fixture.homeOverall : fixture.awayOverall;
  const opponentOverall = isHome ? fixture.awayOverall : fixture.homeOverall;
  const opponent = isHome ? fixture.awayTeamName : fixture.homeTeamName;

  // Pega forma recente da OLEFOOT LIGA
  const olefootLeague = gameState.olefootLeague;
  const team = olefootLeague?.teams.find(t => t.id === clubId);
  const recentForm = team?.recentForm ?? [];

  // Analisa situação e sugere comandos
  const suggestedCommands = analyzeAndSuggestCommands(
    coach,
    teamOverall,
    opponentOverall,
    recentForm,
    teamContext
  );

  const reasoning = buildPreMatchReasoning(
    coach,
    teamOverall,
    opponentOverall,
    recentForm,
    teamContext,
    suggestedCommands
  );

  return {
    roundNumber: round.roundNumber,
    opponent,
    division: fixture.division,
    teamOverall,
    opponentOverall,
    recentForm,
    suggestedCommands,
    reasoning,
  };
}

/**
 * Analisa situação e sugere comandos táticos
 */
function analyzeAndSuggestCommands(
  coach: CoachAgent,
  teamOverall: number,
  opponentOverall: number,
  recentForm: Array<'W' | 'D' | 'L'>,
  teamContext: TeamContext
): CoachCommands {
  const overallDiff = teamOverall - opponentOverall;
  const highFatigue = teamContext.averageFatigue > 60;
  const recentWins = recentForm.filter(r => r === 'W').length;
  const recentLosses = recentForm.filter(r => r === 'L').length;

  // Postura baseada em força relativa e personalidade
  let posture: CoachCommands['posture'] = 'balanced';

  if (coach.personality === 'Pragmatic') {
    // Pragmático: defensivo quando inferior, equilibrado quando superior
    posture = overallDiff < -5 ? 'defensive' : 'balanced';
  } else if (coach.personality === 'Visionary' || coach.personality === 'Motivator') {
    // Visionário/Motivador: sempre ofensivo quando possível
    posture = overallDiff > -10 ? 'offensive' : 'balanced';
  } else if (coach.personality === 'Tactician') {
    // Tático: adapta baseado em forma recente
    if (recentWins >= 3) posture = 'offensive';
    else if (recentLosses >= 3) posture = 'defensive';
    else posture = 'balanced';
  } else {
    // Developer: equilibrado, foco em desenvolvimento
    posture = 'balanced';
  }

  // Intensidade baseada em fadiga e situação
  let intensity: CoachCommands['intensity'] = 'medium';

  if (highFatigue) {
    intensity = 'low'; // Preservar jogadores
  } else if (overallDiff > 10) {
    intensity = 'high'; // Dominar adversário fraco
  } else if (recentLosses >= 2) {
    intensity = 'high'; // Reagir a sequência ruim
  }

  // Estilo baseado em personalidade
  let style: CoachCommands['style'] = 'possession';

  if (coach.personality === 'Pragmatic') {
    style = 'counter'; // Contra-ataque eficiente
  } else if (coach.personality === 'Visionary') {
    style = 'possession'; // Posse de bola
  } else if (coach.personality === 'Motivator') {
    style = 'direct'; // Jogo direto e intenso
  } else {
    style = overallDiff < 0 ? 'counter' : 'possession';
  }

  return {
    posture,
    intensity,
    style,
    setAtMs: Date.now(),
  };
}

/**
 * Constrói justificativa para os comandos sugeridos
 */
function buildPreMatchReasoning(
  coach: CoachAgent,
  teamOverall: number,
  opponentOverall: number,
  recentForm: Array<'W' | 'D' | 'L'>,
  teamContext: TeamContext,
  commands: CoachCommands
): string {
  const overallDiff = teamOverall - opponentOverall;
  const formText = recentForm.length > 0
    ? `Forma recente: ${recentForm.join('-')}`
    : 'Sem histórico recente';

  let reasoning = `**Análise Pré-Jogo:**\n\n`;

  // Força relativa
  if (overallDiff > 10) {
    reasoning += `✅ Somos favoritos (OVR ${teamOverall} vs ${opponentOverall}). `;
  } else if (overallDiff < -10) {
    reasoning += `⚠️ Adversário mais forte (OVR ${teamOverall} vs ${opponentOverall}). `;
  } else {
    reasoning += `⚖️ Jogo equilibrado (OVR ${teamOverall} vs ${opponentOverall}). `;
  }

  // Forma
  const wins = recentForm.filter(r => r === 'W').length;
  const losses = recentForm.filter(r => r === 'L').length;

  if (wins >= 3) {
    reasoning += `Estamos em boa fase (${wins} vitórias recentes). `;
  } else if (losses >= 2) {
    reasoning += `Precisamos reagir (${losses} derrotas recentes). `;
  }

  reasoning += `\n\n**Comandos Sugeridos:**\n\n`;

  // Postura
  reasoning += `🎯 **Postura: ${commands.posture}**\n`;
  if (commands.posture === 'offensive') {
    reasoning += `Vamos pressionar e buscar o gol. ${overallDiff > 5 ? 'Temos qualidade para dominar.' : 'Precisamos ser agressivos.'}\n\n`;
  } else if (commands.posture === 'defensive') {
    reasoning += `Vamos nos proteger e buscar contra-ataques. ${overallDiff < -5 ? 'Adversário é superior.' : 'Momento de ser pragmático.'}\n\n`;
  } else {
    reasoning += `Vamos equilibrar defesa e ataque. Jogo pede cautela e oportunismo.\n\n`;
  }

  // Intensidade
  reasoning += `⚡ **Intensidade: ${commands.intensity}**\n`;
  if (commands.intensity === 'high') {
    reasoning += `Máxima energia. ${teamContext.averageFatigue < 40 ? 'Plantel está fresco.' : 'Momento exige esforço extra.'}\n\n`;
  } else if (commands.intensity === 'low') {
    reasoning += `Poupar energia. ${teamContext.averageFatigue > 60 ? 'Plantel está cansado.' : 'Preservar para próximas rodadas.'}\n\n`;
  } else {
    reasoning += `Ritmo controlado. Equilíbrio entre resultado e preservação física.\n\n`;
  }

  // Estilo
  reasoning += `🎨 **Estilo: ${commands.style}**\n`;
  if (commands.style === 'possession') {
    reasoning += `Controlar o jogo com posse de bola. ${coach.personality === 'Visionary' ? 'Nosso estilo natural.' : 'Impor nosso ritmo.'}\n`;
  } else if (commands.style === 'counter') {
    reasoning += `Contra-ataque rápido. ${overallDiff < 0 ? 'Explorar espaços deixados pelo adversário.' : 'Eficiência é a chave.'}\n`;
  } else {
    reasoning += `Jogo direto e vertical. ${coach.personality === 'Motivator' ? 'Intensidade máxima.' : 'Buscar o gol rapidamente.'}\n`;
  }

  reasoning += `\n${formText}`;
  reasoning += `\nFadiga média: ${Math.round(teamContext.averageFatigue)}%`;

  return reasoning;
}

/**
 * Gera relatório pós-rodada
 */
export function generatePostMatchReport(
  coach: CoachAgent,
  fixture: GlobalFixture,
  isHome: boolean,
  teamContext: TeamContext
): PostMatchCoachReport {
  const scoreTeam = isHome ? fixture.scoreHome : fixture.scoreAway;
  const scoreOpponent = isHome ? fixture.scoreAway : fixture.scoreHome;
  const opponent = isHome ? fixture.awayTeamName : fixture.homeTeamName;

  let result: 'win' | 'draw' | 'loss';
  if (scoreTeam > scoreOpponent) result = 'win';
  else if (scoreTeam < scoreOpponent) result = 'loss';
  else result = 'draw';

  // Extrai eventos-chave
  const keyEvents = fixture.events
    .filter(e => e.type === 'goal' || e.type === 'red_card')
    .map(e => e.text)
    .slice(0, 5);

  // Análise do resultado
  const analysis = buildPostMatchAnalysis(
    coach,
    result,
    scoreTeam,
    scoreOpponent,
    opponent,
    fixture,
    teamContext
  );

  // Sugestões para próxima rodada
  const suggestions = buildPostMatchSuggestions(
    coach,
    result,
    fixture,
    teamContext
  );

  return {
    roundNumber: fixture.roundId ? parseInt(fixture.roundId.split('_')[1] || '0') : 0,
    result,
    scoreHome: fixture.scoreHome,
    scoreAway: fixture.scoreAway,
    opponent,
    keyEvents,
    analysis,
    suggestions,
  };
}

/**
 * Constrói análise pós-jogo
 */
function buildPostMatchAnalysis(
  coach: CoachAgent,
  result: 'win' | 'draw' | 'loss',
  scoreTeam: number,
  scoreOpponent: number,
  opponent: string,
  fixture: GlobalFixture,
  teamContext: TeamContext
): string {
  let analysis = '';

  if (result === 'win') {
    analysis += `🏆 **VITÓRIA!** ${scoreTeam}-${scoreOpponent} contra ${opponent}\n\n`;

    if (scoreTeam - scoreOpponent >= 3) {
      analysis += `Goleada! Dominamos completamente. `;
    } else if (scoreTeam - scoreOpponent === 1) {
      analysis += `Vitória suada mas merecida. `;
    } else {
      analysis += `Boa vitória. `;
    }

    if (coach.personality === 'Pragmatic') {
      analysis += `Resultado é o que importa. Três pontos na conta.`;
    } else if (coach.personality === 'Visionary') {
      analysis += `Controlamos o jogo e criamos chances.`;
    } else {
      analysis += `Time mostrou garra e determinação.`;
    }
  } else if (result === 'loss') {
    analysis += `❌ **DERROTA** ${scoreTeam}-${scoreOpponent} contra ${opponent}\n\n`;

    if (scoreOpponent - scoreTeam >= 3) {
      analysis += `Fomos superados. Precisamos reagir. `;
    } else {
      analysis += `Jogo equilibrado mas perdemos. `;
    }

    analysis += `Vamos analisar os erros e corrigir para a próxima.`;
  } else {
    analysis += `⚖️ **EMPATE** ${scoreTeam}-${scoreOpponent} contra ${opponent}\n\n`;

    if (scoreTeam > 0) {
      analysis += `Jogo movimentado. Ponto conquistado. `;
    } else {
      analysis += `Jogo truncado. Faltou criatividade. `;
    }
  }

  // Eventos importantes
  const goals = fixture.events.filter(e => e.type === 'goal').length;
  const redCards = fixture.events.filter(e => e.type === 'red_card').length;

  if (goals > 5) {
    analysis += `\n\nJogo aberto com ${goals} gols no total.`;
  }
  if (redCards > 0) {
    analysis += `\n\n⚠️ ${redCards} expulsão(ões) no jogo. Impactou o resultado.`;
  }

  return analysis;
}

/**
 * Constrói sugestões pós-jogo
 */
function buildPostMatchSuggestions(
  coach: CoachAgent,
  result: 'win' | 'draw' | 'loss',
  fixture: GlobalFixture,
  teamContext: TeamContext
): string[] {
  const suggestions: string[] = [];

  // Sugestões baseadas em fadiga
  if (teamContext.averageFatigue > 70) {
    suggestions.push('🏥 Plantel muito cansado. Recomendo treino de recuperação física (12-24h).');
  } else if (teamContext.averageFatigue < 30) {
    suggestions.push('✅ Plantel descansado. Bom momento para treino intenso de desenvolvimento.');
  }

  // Sugestões baseadas em resultado
  if (result === 'loss') {
    suggestions.push('📊 Após derrota, sugiro treino mental para recuperar confiança.');
    suggestions.push('🎯 Revisar tática. Treino coletivo de formação pode ajudar.');
  } else if (result === 'win') {
    suggestions.push('🔥 Vitória aumenta moral. Aproveitar para reforçar pontos fortes.');
  }

  // Sugestões baseadas em eventos
  const yellowCards = fixture.events.filter(e => e.type === 'yellow_card').length;
  if (yellowCards > 3) {
    suggestions.push('🟡 Muitos cartões. Treino coletivo de empatia pode reduzir indisciplina.');
  }

  const injuries = fixture.events.filter(e => e.type === 'injury').length;
  if (injuries > 0) {
    suggestions.push('⚠️ Lesões no jogo. Verificar se Departamento Médico precisa upgrade.');
  }

  // Sugestões baseadas em staff
  if (teamContext.staffLevels.treinador < 3) {
    suggestions.push('📈 Upgrade do Treinador multiplica ganhos de treino. Prioridade máxima.');
  }

  return suggestions;
}

/**
 * Cria ação de coach para pedir orientações pré-jogo
 */
export function createPreMatchAction(
  coach: CoachAgent,
  request: PreMatchCoachRequest
): CoachAction {
  return {
    id: nanoid(),
    type: 'start_training', // Reutiliza tipo existente (será expandido depois)
    title: `Rodada ${request.roundNumber}: ${request.opponent}`,
    description: `Orientações para o jogo contra ${request.opponent} (Divisão ${request.division})`,
    reasoning: request.reasoning,
    urgency: 'medium',
    status: 'pending',
    createdAt: Date.now(),
    data: {
      type: 'pre_match_commands',
      roundNumber: request.roundNumber,
      opponent: request.opponent,
      suggestedCommands: request.suggestedCommands,
    },
  };
}
