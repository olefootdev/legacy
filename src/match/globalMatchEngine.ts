/**
 * Motor de Simulação do Match Global
 *
 * Integra com o GameSpirit existente para simular múltiplas partidas
 * simultaneamente usando o mesmo motor que os modos quick/auto.
 *
 * ESTRATÉGIA:
 * 1. Usa `advanceMatchToPostgame` do matchBulk.ts (modo auto otimizado)
 * 2. Executa partidas em paralelo (Promise.all)
 * 3. Extrai eventos relevantes para o painel global
 * 4. Distribui eventos temporalmente durante os 3 minutos
 */

import type {
  GlobalFixture,
  GlobalMatchEvent,
  GlobalHighlight,
  CoachCommands,
} from './globalMatch';
import {
  newGlobalEventId,
  GLOBAL_MATCH_CONSTANTS,
} from './globalMatch';
import type { PossessionSide, LiveMatchSnapshot, MatchEventEntry } from '@/engine/types';
import { advanceMatchToPostgame } from '@/engine/matchBulk';
import type { PlayerEntity } from '@/entities/types';
import type { TeamTacticalStyle } from '@/tactics/playingStyle';

interface TeamSimulationInput {
  players: PlayerEntity[];
  overall: number;
  commands?: CoachCommands;
}

interface MatchSimulationInput {
  fixtureId: string;
  home: TeamSimulationInput;
  away: TeamSimulationInput;
}

/**
 * Converte comandos do treinador em estilo tático
 */
function commandsToTacticalStyle(commands?: CoachCommands): TeamTacticalStyle {
  if (!commands) {
    return {
      possession: 50,
      pressing: 50,
      width: 50,
      tempo: 50,
      directness: 50,
    };
  }

  const style: TeamTacticalStyle = {
    possession: 50,
    pressing: 50,
    width: 50,
    tempo: 50,
    directness: 50,
  };

  // Postura
  if (commands.posture === 'offensive') {
    style.possession = 60;
    style.pressing = 65;
    style.tempo = 60;
  } else if (commands.posture === 'defensive') {
    style.possession = 40;
    style.pressing = 35;
    style.tempo = 40;
  }

  // Intensidade
  if (commands.intensity === 'high') {
    style.pressing += 15;
    style.tempo += 15;
  } else if (commands.intensity === 'low') {
    style.pressing -= 15;
    style.tempo -= 15;
  }

  // Estilo
  if (commands.style === 'possession') {
    style.possession = 70;
    style.directness = 30;
  } else if (commands.style === 'counter') {
    style.possession = 40;
    style.directness = 70;
    style.tempo = 70;
  } else if (commands.style === 'direct') {
    style.directness = 80;
    style.tempo = 60;
  }

  // Normalizar valores (0-100)
  Object.keys(style).forEach((key) => {
    const k = key as keyof TeamTacticalStyle;
    style[k] = Math.max(0, Math.min(100, style[k]));
  });

  return style;
}

/**
 * Cria snapshot inicial de partida para simulação
 */
function createInitialMatchSnapshot(
  home: TeamSimulationInput,
  away: TeamSimulationInput,
): LiveMatchSnapshot {
  const homeStyle = commandsToTacticalStyle(home.commands);
  const awayStyle = commandsToTacticalStyle(away.commands);

  return {
    mode: 'auto',
    phase: 'playing',
    minute: 0,
    clockPeriod: 'first_half',
    homeScore: 0,
    awayScore: 0,
    possession: Math.random() < 0.5 ? 'home' : 'away',
    events: [],
    homePlayers: [],
    awayPlayers: [],
    ball: { x: 50, y: 50 },
    tacticalStyle: homeStyle,
    tacticalMentality: homeStyle.pressing,
    defensiveLine: 50,
    tempo: homeStyle.tempo,
    causalLog: {
      batches: [],
      lastTickMs: Date.now(),
      lastMinute: 0,
      lastPhase: 'LIVE',
    },
  };
}

/**
 * Converte eventos do motor em eventos globais
 */
function convertToGlobalEvents(
  fixtureId: string,
  engineEvents: MatchEventEntry[],
  kickoffMs: number,
): GlobalMatchEvent[] {
  const globalEvents: GlobalMatchEvent[] = [];

  for (const event of engineEvents) {
    let type: GlobalMatchEvent['type'] | null = null;
    let side: PossessionSide = 'home';

    // Mapear tipos de evento
    if (event.kind === 'goal_home') {
      type = 'goal';
      side = 'home';
    } else if (event.kind === 'goal_away') {
      type = 'goal';
      side = 'away';
    } else if (event.kind === 'yellow_home') {
      type = 'yellow_card';
      side = 'home';
    } else if (event.kind === 'yellow_away') {
      type = 'yellow_card';
      side = 'away';
    } else if (event.kind === 'red_home') {
      type = 'red_card';
      side = 'home';
    } else if (event.kind === 'red_away') {
      type = 'red_card';
      side = 'away';
    } else if (event.kind === 'injury_home') {
      type = 'injury';
      side = 'home';
    } else if (event.kind === 'sub') {
      type = 'substitution';
      side = 'home';
    }

    if (type) {
      const timestampMs = kickoffMs + event.minute * GLOBAL_MATCH_CONSTANTS.GAME_MINUTE_MS;

      globalEvents.push({
        id: newGlobalEventId(),
        fixtureId,
        type,
        minute: event.minute,
        timestampMs,
        side,
        playerName: event.playerId,
        text: event.text,
        highlight: type === 'goal' || type === 'red_card',
      });
    }
  }

  return globalEvents;
}

/**
 * Simula uma partida usando o motor existente
 */
async function simulateSingleMatch(
  input: MatchSimulationInput,
  kickoffMs: number,
): Promise<{
  fixtureId: string;
  scoreHome: number;
  scoreAway: number;
  events: GlobalMatchEvent[];
}> {
  // Criar snapshot inicial
  const initialSnapshot = createInitialMatchSnapshot(input.home, input.away);

  // Simular partida completa (modo auto otimizado)
  const result = advanceMatchToPostgame({
    snapshot: initialSnapshot,
    homeRoster: input.home.players,
    allPlayers: Object.fromEntries(
      [...input.home.players, ...input.away.players].map((p) => [p.id, p]),
    ),
    spiritTickProb: 0.54, // Probabilidade de tick do GameSpirit (modo auto)
    skipEvent: () => {}, // Não emitir eventos durante simulação
  });

  const finalSnapshot = result.snapshot;

  // Converter eventos do motor para eventos globais
  const globalEvents = convertToGlobalEvents(
    input.fixtureId,
    finalSnapshot.events,
    kickoffMs,
  );

  return {
    fixtureId: input.fixtureId,
    scoreHome: finalSnapshot.homeScore,
    scoreAway: finalSnapshot.awayScore,
    events: globalEvents,
  };
}

/**
 * Detecta destaques globais baseado em contexto
 */
function detectGlobalHighlights(
  fixtures: GlobalFixture[],
  simulationResults: Array<{
    fixtureId: string;
    scoreHome: number;
    scoreAway: number;
    events: GlobalMatchEvent[];
  }>,
): GlobalHighlight[] {
  const highlights: GlobalHighlight[] = [];

  for (const result of simulationResults) {
    const fixture = fixtures.find((f) => f.id === result.fixtureId);
    if (!fixture) continue;

    const goalEvents = result.events.filter((e) => e.type === 'goal');

    for (const event of goalEvents) {
      // GOL DO LÍDER (time com overall alto)
      const isLeader =
        (event.side === 'home' && fixture.homeOverall >= 85) ||
        (event.side === 'away' && fixture.awayOverall >= 85);

      if (isLeader) {
        highlights.push({
          id: newGlobalEventId(),
          type: 'leader_goal',
          fixtureId: fixture.id,
          text: `🔥 GOL DO LÍDER: ${event.side === 'home' ? fixture.homeTeamName : fixture.awayTeamName}`,
          timestampMs: event.timestampMs,
        });
      }

      // ZEBRA (time fraco vencendo time forte)
      const ovrDiff = Math.abs(fixture.homeOverall - fixture.awayOverall);
      const weakerWinning =
        (event.side === 'home' &&
          fixture.homeOverall < fixture.awayOverall - 10 &&
          result.scoreHome > result.scoreAway) ||
        (event.side === 'away' &&
          fixture.awayOverall < fixture.homeOverall - 10 &&
          result.scoreAway > result.scoreHome);

      if (weakerWinning && ovrDiff >= 15) {
        highlights.push({
          id: newGlobalEventId(),
          type: 'upset',
          fixtureId: fixture.id,
          text: `⚡ ZEBRA! ${event.side === 'home' ? fixture.homeTeamName : fixture.awayTeamName} surpreende`,
          timestampMs: event.timestampMs,
        });
      }
    }

    // EXPULSÃO DECISIVA
    const redCards = result.events.filter((e) => e.type === 'red_card');
    for (const red of redCards) {
      const isBalanced = Math.abs(result.scoreHome - result.scoreAway) <= 1;
      if (isBalanced) {
        highlights.push({
          id: newGlobalEventId(),
          type: 'decisive_red',
          fixtureId: fixture.id,
          text: `🟥 EXPULSÃO DECISIVA em ${fixture.homeTeamName} x ${fixture.awayTeamName}`,
          timestampMs: red.timestampMs,
        });
      }
    }
  }

  return highlights;
}

/**
 * Simula rodada completa usando o motor real do Olefoot
 */
export async function simulateGlobalRoundWithEngine(
  fixtures: GlobalFixture[],
  kickoffMs: number,
  getTeamPlayers: (teamId: string) => PlayerEntity[],
): Promise<{
  updatedFixtures: GlobalFixture[];
  allEvents: GlobalMatchEvent[];
  highlights: GlobalHighlight[];
}> {
  // Preparar inputs de simulação
  const simulationInputs: MatchSimulationInput[] = fixtures.map((fixture) => ({
    fixtureId: fixture.id,
    home: {
      players: getTeamPlayers(fixture.homeTeamId),
      overall: fixture.homeOverall,
      commands: fixture.homeCommands,
    },
    away: {
      players: getTeamPlayers(fixture.awayTeamId),
      overall: fixture.awayOverall,
      commands: fixture.awayCommands,
    },
  }));

  // Simular todas as partidas em paralelo
  const simulationResults = await Promise.all(
    simulationInputs.map((input) => simulateSingleMatch(input, kickoffMs)),
  );

  // Atualizar fixtures com resultados
  const updatedFixtures: GlobalFixture[] = fixtures.map((fixture) => {
    const result = simulationResults.find((r) => r.fixtureId === fixture.id);
    if (!result) return fixture;

    return {
      ...fixture,
      scoreHome: result.scoreHome,
      scoreAway: result.scoreAway,
      currentMinute: 90,
      events: result.events,
      status: 'finished',
      kickoffMs,
      finishedAtMs: kickoffMs + GLOBAL_MATCH_CONSTANTS.ROUND_DURATION_MS,
    };
  });

  // Coletar todos os eventos
  const allEvents = simulationResults.flatMap((r) => r.events);

  // Detectar destaques globais
  const highlights = detectGlobalHighlights(fixtures, simulationResults);

  return { updatedFixtures, allEvents, highlights };
}

/**
 * Versão simplificada para testes (sem jogadores reais)
 * Usa a simulação probabilística original
 */
export { simulateGlobalRound } from './globalMatchSimulator';
