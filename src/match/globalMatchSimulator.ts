/**
 * Motor de simulação simultânea para Match Global
 *
 * Executa múltiplos jogos em paralelo durante 3 minutos,
 * gerando eventos distribuídos temporalmente de forma realista.
 */

import type {
  GlobalFixture,
  GlobalMatchEvent,
  GlobalEventType,
  CoachCommands,
  GlobalHighlight,
} from './globalMatch';
import {
  newGlobalEventId,
  GLOBAL_MATCH_CONSTANTS,
  getCurrentGameMinute,
} from './globalMatch';
import type { PossessionSide } from '@/engine/types';

interface SimulationContext {
  fixture: GlobalFixture;
  homeStrength: number;
  awayStrength: number;
  homeMomentum: number;
  awayMomentum: number;
  homeCommands?: CoachCommands;
  awayCommands?: CoachCommands;
}

interface EventCandidate {
  type: GlobalEventType;
  side: PossessionSide;
  minute: number;
  playerName?: string;
  playerId?: string;
}

/**
 * Calcula força efetiva do time baseado em OVR + comandos do treinador
 */
function calculateEffectiveStrength(
  baseOverall: number,
  commands?: CoachCommands,
): number {
  let strength = baseOverall;

  if (!commands) return strength;

  // Postura
  if (commands.posture === 'offensive') {
    strength += 2; // Mais ataque, mais risco
  } else if (commands.posture === 'defensive') {
    strength -= 1; // Menos ataque, mais solidez
  }

  // Intensidade
  if (commands.intensity === 'high') {
    strength += 1.5;
  } else if (commands.intensity === 'low') {
    strength -= 1;
  }

  // Estilo (impacto menor)
  if (commands.style === 'counter') {
    strength += 0.5; // Eficiente em transições
  }

  return Math.max(50, Math.min(99, strength));
}

/**
 * Gera eventos para uma partida durante os 90 minutos
 */
function generateMatchEvents(ctx: SimulationContext): EventCandidate[] {
  const events: EventCandidate[] = [];

  const homeStr = calculateEffectiveStrength(ctx.homeStrength, ctx.homeCommands);
  const awayStr = calculateEffectiveStrength(ctx.awayStrength, ctx.awayCommands);

  // Diferença de força determina probabilidade de eventos
  const totalStr = homeStr + awayStr;
  const homeProb = homeStr / totalStr;
  const awayProb = awayStr / totalStr;

  // Gols esperados (baseado em força)
  const expectedGoals = 2 + Math.random() * 2; // 2-4 gols por jogo
  const homeGoals = Math.floor(expectedGoals * homeProb + Math.random() * 1.5);
  const awayGoals = Math.floor(expectedGoals * awayProb + Math.random() * 1.5);

  // Distribuir gols ao longo dos 90 minutos
  for (let i = 0; i < homeGoals; i++) {
    const minute = Math.floor(Math.random() * 90) + 1;
    events.push({
      type: 'goal',
      side: 'home',
      minute,
      playerName: `Jogador ${Math.floor(Math.random() * 11) + 1}`,
    });
  }

  for (let i = 0; i < awayGoals; i++) {
    const minute = Math.floor(Math.random() * 90) + 1;
    events.push({
      type: 'goal',
      side: 'away',
      minute,
      playerName: `Jogador ${Math.floor(Math.random() * 11) + 1}`,
    });
  }

  // Cartões (baseado em intensidade)
  const yellowChance = ctx.homeCommands?.intensity === 'high' ? 0.4 : 0.2;
  const redChance = 0.05;

  if (Math.random() < yellowChance) {
    events.push({
      type: 'yellow_card',
      side: Math.random() < 0.5 ? 'home' : 'away',
      minute: Math.floor(Math.random() * 90) + 1,
      playerName: `Jogador ${Math.floor(Math.random() * 11) + 1}`,
    });
  }

  if (Math.random() < redChance) {
    events.push({
      type: 'red_card',
      side: Math.random() < 0.5 ? 'home' : 'away',
      minute: Math.floor(Math.random() * 90) + 1,
      playerName: `Jogador ${Math.floor(Math.random() * 11) + 1}`,
    });
  }

  // Lesões (raro)
  if (Math.random() < 0.1) {
    events.push({
      type: 'injury',
      side: Math.random() < 0.5 ? 'home' : 'away',
      minute: Math.floor(Math.random() * 90) + 1,
      playerName: `Jogador ${Math.floor(Math.random() * 11) + 1}`,
    });
  }

  // Ordenar por minuto
  return events.sort((a, b) => a.minute - b.minute);
}

/**
 * Converte evento candidato em evento global com timestamp real
 */
function candidateToGlobalEvent(
  candidate: EventCandidate,
  fixture: GlobalFixture,
  kickoffMs: number,
): GlobalMatchEvent {
  const timestampMs = kickoffMs + candidate.minute * GLOBAL_MATCH_CONSTANTS.GAME_MINUTE_MS;

  let text = '';
  const teamName = candidate.side === 'home' ? fixture.homeTeamName : fixture.awayTeamName;

  switch (candidate.type) {
    case 'goal':
      text = `⚽ GOL! ${candidate.playerName} marca para ${teamName}`;
      break;
    case 'yellow_card':
      text = `🟡 Cartão amarelo para ${candidate.playerName} (${teamName})`;
      break;
    case 'red_card':
      text = `🟥 EXPULSÃO! ${candidate.playerName} (${teamName})`;
      break;
    case 'injury':
      text = `⚠️ Lesão: ${candidate.playerName} (${teamName})`;
      break;
    default:
      text = `Evento em ${teamName}`;
  }

  return {
    id: newGlobalEventId(),
    fixtureId: fixture.id,
    type: candidate.type,
    minute: candidate.minute,
    timestampMs,
    side: candidate.side,
    playerName: candidate.playerName,
    playerId: candidate.playerId,
    text,
    highlight: candidate.type === 'goal' || candidate.type === 'red_card',
  };
}

/**
 * Detecta destaques globais (eventos importantes para todo o painel)
 */
function detectGlobalHighlights(
  fixtures: GlobalFixture[],
  newEvents: GlobalMatchEvent[],
): GlobalHighlight[] {
  const highlights: GlobalHighlight[] = [];

  for (const event of newEvents) {
    if (event.type !== 'goal' && event.type !== 'red_card') continue;

    const fixture = fixtures.find((f) => f.id === event.fixtureId);
    if (!fixture) continue;

    // GOL DO LÍDER (time com overall alto marcando)
    const isLeader =
      (event.side === 'home' && fixture.homeOverall >= 85) ||
      (event.side === 'away' && fixture.awayOverall >= 85);

    if (isLeader && event.type === 'goal') {
      highlights.push({
        id: newGlobalEventId(),
        type: 'leader_goal',
        fixtureId: fixture.id,
        text: `🔥 GOL DO LÍDER: ${event.side === 'home' ? fixture.homeTeamName : fixture.awayTeamName}`,
        timestampMs: event.timestampMs,
      });
    }

    // VIRADA (time que estava perdendo vira o jogo)
    if (event.type === 'goal') {
      const wasLosing =
        (event.side === 'home' && fixture.scoreHome < fixture.scoreAway) ||
        (event.side === 'away' && fixture.scoreAway < fixture.scoreHome);

      const nowWinning =
        (event.side === 'home' && fixture.scoreHome > fixture.scoreAway) ||
        (event.side === 'away' && fixture.scoreAway > fixture.scoreHome);

      if (wasLosing && nowWinning) {
        highlights.push({
          id: newGlobalEventId(),
          type: 'comeback',
          fixtureId: fixture.id,
          text: `🔄 VIRADA! ${event.side === 'home' ? fixture.homeTeamName : fixture.awayTeamName} vira o jogo`,
          timestampMs: event.timestampMs,
        });
      }
    }

    // EXPULSÃO DECISIVA (cartão vermelho em jogo equilibrado)
    if (event.type === 'red_card') {
      const isBalanced = Math.abs(fixture.scoreHome - fixture.scoreAway) <= 1;
      if (isBalanced) {
        highlights.push({
          id: newGlobalEventId(),
          type: 'decisive_red',
          fixtureId: fixture.id,
          text: `🟥 EXPULSÃO DECISIVA em ${fixture.homeTeamName} x ${fixture.awayTeamName}`,
          timestampMs: event.timestampMs,
        });
      }
    }
  }

  return highlights;
}

/**
 * Simula uma rodada completa de jogos
 */
export function simulateGlobalRound(
  fixtures: GlobalFixture[],
  kickoffMs: number,
): {
  updatedFixtures: GlobalFixture[];
  allEvents: GlobalMatchEvent[];
  highlights: GlobalHighlight[];
} {
  const updatedFixtures: GlobalFixture[] = [];
  const allEvents: GlobalMatchEvent[] = [];

  // Gerar eventos para cada partida
  for (const fixture of fixtures) {
    const ctx: SimulationContext = {
      fixture,
      homeStrength: fixture.homeOverall,
      awayStrength: fixture.awayOverall,
      homeMomentum: 0.5,
      awayMomentum: 0.5,
      homeCommands: fixture.homeCommands,
      awayCommands: fixture.awayCommands,
    };

    const candidates = generateMatchEvents(ctx);
    const events = candidates.map((c) => candidateToGlobalEvent(c, fixture, kickoffMs));

    // Calcular placar final
    const homeGoals = events.filter((e) => e.type === 'goal' && e.side === 'home').length;
    const awayGoals = events.filter((e) => e.type === 'goal' && e.side === 'away').length;

    updatedFixtures.push({
      ...fixture,
      scoreHome: homeGoals,
      scoreAway: awayGoals,
      currentMinute: 90,
      events,
      status: 'finished',
      kickoffMs,
      finishedAtMs: kickoffMs + GLOBAL_MATCH_CONSTANTS.ROUND_DURATION_MS,
    });

    allEvents.push(...events);
  }

  // Detectar destaques globais
  const highlights = detectGlobalHighlights(updatedFixtures, allEvents);

  return { updatedFixtures, allEvents, highlights };
}

/**
 * Atualiza fixtures em tempo real (chamado a cada segundo durante a rodada)
 */
export function updateLiveFixtures(
  fixtures: GlobalFixture[],
  nowMs: number,
): GlobalFixture[] {
  return fixtures.map((fixture) => {
    if (fixture.status !== 'live' || !fixture.kickoffMs) return fixture;

    const currentMinute = getCurrentGameMinute(fixture, nowMs);

    // Revelar eventos que já aconteceram
    const revealedEvents = fixture.events.filter((e) => e.minute <= currentMinute);

    // Calcular placar atual
    const scoreHome = revealedEvents.filter((e) => e.type === 'goal' && e.side === 'home').length;
    const scoreAway = revealedEvents.filter((e) => e.type === 'goal' && e.side === 'away').length;

    // Verificar se terminou
    const isFinished = currentMinute >= 90;

    return {
      ...fixture,
      currentMinute,
      scoreHome,
      scoreAway,
      status: isFinished ? 'finished' : 'live',
      finishedAtMs: isFinished ? nowMs : undefined,
    };
  });
}

/**
 * Prepara fixtures para uma nova rodada
 */
export function prepareFixturesForRound(
  teams: Array<{ id: string; name: string; overall: number }>,
  roundId: string,
): GlobalFixture[] {
  const fixtures: GlobalFixture[] = [];

  // Gerar confrontos (round-robin simplificado)
  for (let i = 0; i < teams.length; i += 2) {
    if (i + 1 >= teams.length) break;

    const home = teams[i]!;
    const away = teams[i + 1]!;

    fixtures.push({
      id: `${roundId}_${i}`,
      roundId,
      division: 'Divisão 1',
      homeTeamId: home.id,
      awayTeamId: away.id,
      homeTeamName: home.name,
      awayTeamName: away.name,
      homeOverall: home.overall,
      awayOverall: away.overall,
      scoreHome: 0,
      scoreAway: 0,
      currentMinute: 0,
      events: [],
      status: 'scheduled',
    });
  }

  return fixtures;
}
