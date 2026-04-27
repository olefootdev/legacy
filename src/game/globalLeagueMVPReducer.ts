/**
 * Reducer handlers para Global League MVP
 */

import type { OlefootGameState, InboxItem, InboxCategory } from './types';
import type { InboxMessageType } from './inboxTypes';
import type { GlobalFixture } from '@/match/globalMatch';
import {
  createGlobalLeagueMVP,
  registerTeam,
  finalizePlayoffRound,
  finalizeLeagueRound,
  applyPromotionRelegation,
  adminStartPlayoffs,
  type GlobalLeagueMVPState,
} from '@/match/globalLeagueMVP';
import { simulateGlobalRound } from '@/match/globalMatchSimulator';

/**
 * Helper para criar item de inbox da Liga Global. As notificações da Liga
 * caem todas em category=COMPETIÇÃO; o `tag` mantém o rótulo visual ("LIGA
 * GLOBAL") que os callers passam. messageType é livre (analytics) e cast.
 */
function makeInboxItem(
  id: string,
  messageType: string,
  tag: string,
  title: string,
  body?: string,
  options?: { deepLink?: string; colorClass?: string }
): InboxItem {
  const now = new Date();
  return {
    id,
    messageType: messageType as InboxMessageType,
    category: 'COMPETIÇÃO' as InboxCategory,
    tag,
    title,
    body,
    timeLabel: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    deepLink: options?.deepLink,
    colorClass: options?.colorClass ?? 'text-white',
  };
}

/** Inicializar liga MVP */
export function handleInitGlobalLeagueMVP(state: OlefootGameState): OlefootGameState {
  return {
    ...state,
    globalLeagueMVP: createGlobalLeagueMVP(),
  };
}

/** Registrar time na liga */
export function handleRegisterGlobalTeam(
  state: OlefootGameState,
  managerId: string,
  clubName: string,
  clubShort: string,
  overall: number
): OlefootGameState {
  if (!state.globalLeagueMVP) {
    return state;
  }

  const updatedLeague = registerTeam(
    state.globalLeagueMVP,
    managerId,
    clubName,
    clubShort,
    overall
  );

  const teamsCount = updatedLeague.teams.length;
  const minTeams = updatedLeague.minTeamsRequired;

  const notifications: InboxItem[] = [
    makeInboxItem(
      `global_registered_${Date.now()}`,
      'GLOBAL_LEAGUE_REGISTERED',
      'LIGA GLOBAL',
      '✅ Cadastro Confirmado',
      `${clubName} foi registrado na Liga Global! (${teamsCount}/${minTeams})`,
      { deepLink: '/liga-global/registro', colorClass: 'text-neon-yellow' }
    ),
  ];

  // Quando atingir o mínimo, avisa que admin pode iniciar os playoffs.
  if (teamsCount === minTeams && state.globalLeagueMVP.status === 'waiting_teams') {
    notifications.push(
      makeInboxItem(
        `playoffs_ready_${Date.now()}`,
        'PLAYOFFS_READY',
        'LIGA GLOBAL',
        '🏆 Pronto para iniciar playoffs',
        `Os ${minTeams} times necessários foram cadastrados. Aguardando comando do admin para iniciar os playoffs.`,
        { deepLink: '/admin', colorClass: 'text-neon-yellow' }
      )
    );
  }

  return {
    ...state,
    globalLeagueMVP: updatedLeague,
    inbox: [...notifications, ...state.inbox].slice(0, 14),
  };
}

/** Admin: iniciar manualmente os playoffs (gera 6 rodadas de ida/volta). */
export function handleAdminStartGlobalPlayoffs(state: OlefootGameState): OlefootGameState {
  if (!state.globalLeagueMVP) return state;
  const updatedLeague = adminStartPlayoffs(state.globalLeagueMVP);
  if (updatedLeague === state.globalLeagueMVP) return state; // no-op (já em playoffs ou sem times)

  const notification = makeInboxItem(
    `playoffs_start_${Date.now()}`,
    'PLAYOFFS_START',
    'LIGA GLOBAL',
    '🏆 Playoffs Iniciados!',
    `Playoffs da Liga Global iniciados! ${updatedLeague.teams.length} times disputam 6 rodadas.`,
    { deepLink: '/liga-global/playoffs', colorClass: 'text-neon-yellow' }
  );

  return {
    ...state,
    globalLeagueMVP: updatedLeague,
    inbox: [notification, ...state.inbox].slice(0, 14),
  };
}

/** Iniciar rodada de playoff */
export function handleStartGlobalPlayoffRound(
  state: OlefootGameState,
  roundNumber: number
): OlefootGameState {
  if (!state.globalLeagueMVP || state.globalLeagueMVP.status !== 'playoffs') {
    return state;
  }

  const round = state.globalLeagueMVP.playoffRounds.find(r => r.roundNumber === roundNumber);
  if (!round) return state;

  // Simular todos os jogos da rodada
  const simulatedFixtures = round.fixtures.map(fixture => {
    const homeTeam = state.globalLeagueMVP!.teams.find(t => t.id === fixture.homeTeamId);
    const awayTeam = state.globalLeagueMVP!.teams.find(t => t.id === fixture.awayTeamId);

    if (!homeTeam || !awayTeam) return fixture;

    // Simular partida
    const result = simulateMatch(homeTeam.overall, awayTeam.overall);

    return {
      ...fixture,
      scoreHome: result.homeScore,
      scoreAway: result.awayScore,
      status: 'live' as const,
      kickoffMs: Date.now(),
      events: generateMatchEvents(result.homeScore, result.awayScore, fixture),
    };
  });

  // Atualizar rodada
  const updatedRounds = state.globalLeagueMVP.playoffRounds.map(r => {
    if (r.roundNumber === roundNumber) {
      return {
        ...r,
        status: 'live' as const,
        fixtures: simulatedFixtures,
        actualKickoffMs: Date.now(),
      };
    }
    return r;
  });

  // Notificar início da rodada
  const notification = makeInboxItem(
    `playoff_round_start_${roundNumber}`,
    'PLAYOFF_ROUND_START',
    'LIGA GLOBAL',
    `⚽ Rodada ${roundNumber} Iniciada`,
    `Playoffs - Rodada ${roundNumber} de 6 está ao vivo!`,
    { deepLink: '/liga-global/playoffs', colorClass: 'text-neon-green' }
  );

  return {
    ...state,
    globalLeagueMVP: {
      ...state.globalLeagueMVP,
      playoffRounds: updatedRounds,
    },
    inbox: [notification, ...state.inbox].slice(0, 14),
  };
}

/** Finalizar rodada de playoff */
export function handleFinishGlobalPlayoffRound(
  state: OlefootGameState,
  roundNumber: number,
  finishedFixtures: GlobalFixture[]
): OlefootGameState {
  if (!state.globalLeagueMVP || state.globalLeagueMVP.status !== 'playoffs') {
    return state;
  }

  const updatedLeague = finalizePlayoffRound(
    state.globalLeagueMVP,
    roundNumber,
    finishedFixtures
  );

  const notifications: InboxItem[] = [];

  // Notificar resultado da rodada
  notifications.push(
    makeInboxItem(
      `playoff_round_finish_${roundNumber}`,
      'PLAYOFF_ROUND_FINISH',
      'LIGA GLOBAL',
      `✅ Rodada ${roundNumber} Finalizada`,
      `Playoffs - Rodada ${roundNumber} concluída. Confira a classificação!`,
      { deepLink: '/liga-global/playoffs' }
    )
  );

  // Se foi a última rodada, notificar distribuição em divisões
  if (roundNumber === 6 && updatedLeague.status === 'active') {
    // Encontrar divisão do manager
    const userSettings = state.userSettings;
    const managerId = userSettings.managerProfile?.email || 'guest';
    const userTeam = updatedLeague.teams.find(t => t.managerId === managerId);

    if (userTeam && userTeam.division) {
      const divisionName = userTeam.division === 1 ? 'Elite' : userTeam.division === 2 ? 'Intermediária' : 'Acesso';
      notifications.push(
        makeInboxItem(
          `division_assigned_${Date.now()}`,
          'DIVISION_ASSIGNED',
          'LIGA GLOBAL',
          `🎯 Divisão ${userTeam.division} Confirmada`,
          `Você foi classificado para a Divisão ${userTeam.division} (${divisionName})! A liga oficial começa em breve.`,
          { deepLink: '/match/global', colorClass: 'text-neon-yellow' }
        )
      );
    }

    notifications.push(
      makeInboxItem(
        `league_start_${Date.now()}`,
        'LEAGUE_START',
        'LIGA GLOBAL',
        '🏁 Liga Oficial Iniciada',
        'Os playoffs terminaram! A liga oficial está ativa com 3 divisões.',
        { deepLink: '/match/global', colorClass: 'text-neon-yellow' }
      )
    );
  }

  return {
    ...state,
    globalLeagueMVP: updatedLeague,
    inbox: [...notifications, ...state.inbox].slice(0, 14),
  };
}

/** Iniciar rodada da liga oficial */
export function handleStartGlobalLeagueRound(
  state: OlefootGameState,
  roundNumber: number
): OlefootGameState {
  if (!state.globalLeagueMVP || state.globalLeagueMVP.status !== 'active') {
    return state;
  }

  const round = state.globalLeagueMVP.leagueRounds.find(r => r.roundNumber === roundNumber);
  if (!round) return state;

  // Simular todos os jogos da rodada
  const simulatedFixtures = round.fixtures.map(fixture => {
    const homeTeam = state.globalLeagueMVP!.teams.find(t => t.id === fixture.homeTeamId);
    const awayTeam = state.globalLeagueMVP!.teams.find(t => t.id === fixture.awayTeamId);

    if (!homeTeam || !awayTeam) return fixture;

    const result = simulateMatch(homeTeam.overall, awayTeam.overall);

    return {
      ...fixture,
      scoreHome: result.homeScore,
      scoreAway: result.awayScore,
      status: 'live' as const,
      kickoffMs: Date.now(),
      events: generateMatchEvents(result.homeScore, result.awayScore, fixture),
    };
  });

  // Atualizar rodada
  const updatedRounds = state.globalLeagueMVP.leagueRounds.map(r => {
    if (r.roundNumber === roundNumber) {
      return {
        ...r,
        status: 'live' as const,
        fixtures: simulatedFixtures,
        actualKickoffMs: Date.now(),
      };
    }
    return r;
  });

  // Notificar início da rodada
  const notification = makeInboxItem(
    `league_round_start_${roundNumber}`,
    'LEAGUE_ROUND_START',
    'LIGA GLOBAL',
    `⚽ Rodada ${roundNumber} Ao Vivo`,
    `Liga Global - Rodada ${roundNumber} está acontecendo agora!`,
    { deepLink: '/match/global', colorClass: 'text-neon-green' }
  );

  return {
    ...state,
    globalLeagueMVP: {
      ...state.globalLeagueMVP,
      leagueRounds: updatedRounds,
    },
    inbox: [notification, ...state.inbox].slice(0, 14),
  };
}

/** Finalizar rodada da liga oficial */
export function handleFinishGlobalLeagueRound(
  state: OlefootGameState,
  roundNumber: number,
  finishedFixtures: GlobalFixture[]
): OlefootGameState {
  if (!state.globalLeagueMVP || state.globalLeagueMVP.status !== 'active') {
    return state;
  }

  const updatedLeague = finalizeLeagueRound(
    state.globalLeagueMVP,
    roundNumber,
    finishedFixtures
  );

  const notifications: InboxItem[] = [];

  // Encontrar resultado do time do manager
  const userSettings = state.userSettings;
  const managerId = userSettings.managerProfile?.email || 'guest';
  const userTeam = updatedLeague.teams.find(t => t.managerId === managerId);

  if (userTeam) {
    const userFixture = finishedFixtures.find(
      f => f.homeTeamId === userTeam.id || f.awayTeamId === userTeam.id
    );

    if (userFixture) {
      const isHome = userFixture.homeTeamId === userTeam.id;
      const userScore = isHome ? userFixture.scoreHome : userFixture.scoreAway;
      const opponentScore = isHome ? userFixture.scoreAway : userFixture.scoreHome;
      const opponentName = isHome ? userFixture.awayTeamName : userFixture.homeTeamName;

      const result = userScore > opponentScore ? 'Vitória' : userScore < opponentScore ? 'Derrota' : 'Empate';
      const emoji = userScore > opponentScore ? '🎉' : userScore < opponentScore ? '😔' : '🤝';

      notifications.push(
        makeInboxItem(
          `league_result_${roundNumber}`,
          'LEAGUE_RESULT',
          'LIGA GLOBAL',
          `${emoji} ${result}!`,
          `Rodada ${roundNumber}: ${userTeam.clubName} ${userScore} x ${opponentScore} ${opponentName}`,
          { deepLink: '/match/global' }
        )
      );
    }

    // Verificar mudança de posição
    if (userTeam.previousPosition && userTeam.position) {
      const positionChange = userTeam.previousPosition - userTeam.position;
      if (positionChange > 0) {
        notifications.push(
          makeInboxItem(
            `position_up_${roundNumber}`,
            'POSITION_UP',
            'LIGA GLOBAL',
            '📈 Subiu na Tabela!',
            `Você subiu ${positionChange} posição${positionChange > 1 ? 'ões' : ''}! Agora está em ${userTeam.position}º lugar.`,
            { deepLink: '/match/global', colorClass: 'text-emerald-400' }
          )
        );
      } else if (positionChange < 0) {
        notifications.push(
          makeInboxItem(
            `position_down_${roundNumber}`,
            'POSITION_DOWN',
            'LIGA GLOBAL',
            '📉 Caiu na Tabela',
            `Você caiu ${Math.abs(positionChange)} posição${Math.abs(positionChange) > 1 ? 'ões' : ''}. Agora está em ${userTeam.position}º lugar.`,
            { deepLink: '/match/global', colorClass: 'text-red-400' }
          )
        );
      }
    }
  }

  return {
    ...state,
    globalLeagueMVP: updatedLeague,
    inbox: [...notifications, ...state.inbox].slice(0, 14),
  };
}

/** Aplicar promoção e rebaixamento */
export function handleApplyPromotionRelegation(state: OlefootGameState): OlefootGameState {
  if (!state.globalLeagueMVP || state.globalLeagueMVP.status !== 'active') {
    return state;
  }

  const oldLeague = state.globalLeagueMVP;
  const updatedLeague = applyPromotionRelegation(oldLeague);

  const notifications: InboxItem[] = [];

  // Verificar promoção/rebaixamento do manager
  const userSettings = state.userSettings;
  const managerId = userSettings.managerProfile?.email || 'guest';
  const oldTeam = oldLeague.teams.find(t => t.managerId === managerId);
  const newTeam = updatedLeague.teams.find(t => t.managerId === managerId);

  if (oldTeam && newTeam && oldTeam.division !== newTeam.division) {
    if (newTeam.division! < oldTeam.division!) {
      // Promovido
      notifications.push(
        makeInboxItem(
          `promotion_${Date.now()}`,
          'PROMOTION',
          'LIGA GLOBAL',
          '🎉 Promovido!',
          `Parabéns! Você subiu para a Divisão ${newTeam.division}!`,
          { deepLink: '/match/global', colorClass: 'text-neon-yellow' }
        )
      );
    } else {
      // Rebaixado
      notifications.push(
        makeInboxItem(
          `relegation_${Date.now()}`,
          'RELEGATION',
          'LIGA GLOBAL',
          '⚠️ Rebaixado',
          `Você foi rebaixado para a Divisão ${newTeam.division}. Lute para voltar!`,
          { deepLink: '/match/global', colorClass: 'text-red-400' }
        )
      );
    }
  }

  // Notificar fim de temporada
  notifications.push(
    makeInboxItem(
      `season_end_${Date.now()}`,
      'SEASON_END',
      'LIGA GLOBAL',
      '🏁 Temporada Finalizada',
      'A temporada terminou! Promoções e rebaixamentos foram aplicados.',
      { deepLink: '/match/global' }
    )
  );

  return {
    ...state,
    globalLeagueMVP: updatedLeague,
    inbox: [...notifications, ...state.inbox].slice(0, 14),
  };
}

/** Resetar liga MVP */
export function handleResetGlobalLeagueMVP(state: OlefootGameState): OlefootGameState {
  return {
    ...state,
    globalLeagueMVP: createGlobalLeagueMVP(),
    // Limpar dados mockados
    olefootLeague: undefined,
    globalLeague: undefined,
  };
}

/** Simular partida (algoritmo simples baseado em overall) */
function simulateMatch(homeOverall: number, awayOverall: number): {
  homeScore: number;
  awayScore: number;
} {
  // Vantagem de jogar em casa
  const homeAdvantage = 3;
  const adjustedHome = homeOverall + homeAdvantage;

  // Diferença de força
  const diff = adjustedHome - awayOverall;

  // Probabilidade base de gol (0.5 a 3.5 gols por time)
  const baseGoals = 1.5;

  // Ajustar baseado na diferença
  const homeExpected = baseGoals + (diff / 20);
  const awayExpected = baseGoals - (diff / 20);

  // Gerar gols com distribuição de Poisson simplificada
  const homeScore = Math.max(0, Math.round(homeExpected + (Math.random() - 0.5) * 2));
  const awayScore = Math.max(0, Math.round(awayExpected + (Math.random() - 0.5) * 2));

  return { homeScore, awayScore };
}

/** Gerar eventos básicos da partida */
function generateMatchEvents(
  homeScore: number,
  awayScore: number,
  fixture: GlobalFixture
): import('@/match/globalMatch').GlobalMatchEvent[] {
  const events: import('@/match/globalMatch').GlobalMatchEvent[] = [];
  const totalGoals = homeScore + awayScore;

  // Distribuir gols ao longo dos 90 minutos
  for (let i = 0; i < totalGoals; i++) {
    const minute = Math.floor(Math.random() * 90) + 1;
    const isHome = i < homeScore;
    const side = isHome ? 'home' : 'away';
    const teamName = isHome ? fixture.homeTeamName : fixture.awayTeamName;

    events.push({
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      fixtureId: fixture.id,
      type: 'goal',
      minute,
      timestampMs: Date.now() + minute * 1000,
      side,
      text: `⚽ GOL! ${teamName} marca!`,
      highlight: true,
    });
  }

  // Ordenar por minuto
  events.sort((a, b) => a.minute - b.minute);

  return events;
}
