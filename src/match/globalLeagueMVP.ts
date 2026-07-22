/**
 * GLOBAL LEAGUE MVP — Sistema de Liga com Playoffs e Divisões
 *
 * Fluxo:
 * 1. Aguarda 32 times cadastrados
 * 2. Playoffs (3 rodadas ida/volta = 6 jogos por time)
 * 3. Distribuição em 3 divisões baseada em pontos
 * 4. Liga oficial com promoção/rebaixamento (10% dos times)
 */

import type { GlobalFixture } from './globalMatch';
import { newGlobalFixtureId } from './globalMatch';

/** Status da liga global */
export type GlobalLeagueStatus =
  | 'waiting_teams'      // Aguardando 32 times
  | 'playoffs'           // Playoffs em andamento (3 rodadas)
  | 'active'             // Liga oficial ativa
  | 'season_ended';      // Temporada finalizada

/** Fase dos playoffs */
export type PlayoffPhase = 'round_1' | 'round_2' | 'round_3';

/** Time cadastrado na liga global */
export interface GlobalTeam {
  id: string;
  managerId: string;
  clubName: string;
  clubShort: string;
  overall: number;
  /** Engajamento do manager (0-100) — proxy de investimento/EXP no ranking composto. */
  engagementScore?: number;
  /** Time do coração (id api-sports) — brasão do clube na Home / Próxima Partida. */
  favoriteTeamId?: number;

  // Estatísticas dos playoffs
  playoffPoints: number;
  playoffMatchesPlayed: number;
  playoffWins: number;
  playoffDraws: number;
  playoffLosses: number;
  playoffGoalsFor: number;
  playoffGoalsAgainst: number;

  // Estatísticas da liga oficial
  division?: number;
  points: number;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  position?: number;
  previousPosition?: number;

  // Forma recente
  recentForm: Array<'W' | 'D' | 'L'>;

  // Estatísticas ALL-TIME — JAMAIS zeram entre temporadas
  allTimePoints: number;
  allTimeMatchesPlayed: number;
  allTimeWins: number;
  allTimeDraws: number;
  allTimeLosses: number;
  allTimeGoalsFor: number;
  allTimeGoalsAgainst: number;
  allTimeSeasonsPlayed: number;

  // Corrida do Dia Olefoot — zera na virada do dia (BRT), não no fim de season
  dailyPoints?: number;
  dailyMatchesPlayed?: number;
  dailyWins?: number;
  dailyDraws?: number;
  dailyLosses?: number;
  dailyGoalsFor?: number;
  dailyGoalsAgainst?: number;
  dailyGoalDifference?: number;
  // Coroas (campeão do mata-mata diário)
  seasonCrowns?: number;
  allTimeCrowns?: number;

  // Penalidades ativas
  injuryRoundsRemaining: number;
  injuryModifier: number;
  yellowCardCount: number;
  suspensionRoundsRemaining: number;
  /** Jogadores disponíveis (synced pelo cliente). Edge Function usa para WO. */
  availablePlayerCount?: number;
  /** Confrontos na temporada: opponentTeamId → nº de vezes. Rivalidade a partir de 3. */
  rivalryEncounters?: Record<string, number>;

  // Timestamps
  registeredAt: number;
}

/** Rodada de playoffs */
export interface PlayoffRound {
  phase: PlayoffPhase;
  roundNumber: number; // 1-6 (3 rodadas ida/volta)
  fixtures: GlobalFixture[];
  status: 'scheduled' | 'live' | 'finished';
  scheduledKickoffMs: number;
  actualKickoffMs?: number;
  finishedAtMs?: number;
  isReturning?: boolean;
}

/** Rodada da liga oficial */
export interface LeagueRound {
  roundNumber: number;
  fixtures: GlobalFixture[];
  status: 'scheduled' | 'live' | 'finished';
  scheduledKickoffMs: number;
  actualKickoffMs?: number;
  finishedAtMs?: number;
}

/** Estado completo da liga global MVP */
export interface GlobalLeagueMVPState {
  seasonId: string;
  seasonName?: string;
  status: GlobalLeagueStatus;

  // Times cadastrados
  teams: GlobalTeam[];
  minTeamsRequired: number; // 32

  // Playoffs (antes da divisão)
  playoffRounds: PlayoffRound[];
  currentPlayoffRound?: number;

  // Liga oficial (após playoffs)
  leagueRounds: LeagueRound[];
  currentLeagueRound?: number;

  // Configurações
  teamsPerDivision: number; // ~11 times por divisão (32/3 = 10.67)
  promotionPercentage: number; // 10%
  relegationPercentage: number; // 10%

  // Slots fixos por dia (Etapa 2)
  matchSlots?: string[];        // ['05:30','11:00','15:00','19:00','21:30']
  slotDurationMin?: number;     // 30
  currentOlefootDay?: string;   // YYYY-MM-DD UTC

  // Competição longa (Etapa 3) — pontos somam até o fim, all-time perpétuo
  competitionId?: string;            // 'competition_<ts>'
  competitionStartedAt?: number;     // epoch ms
  competitionDurationDays?: number;  // 7

  // Ciclo Diário (Coroa do Dia) — Fase A
  dailyDate?: string;                          // 'YYYY-MM-DD' BRT do dia corrente
  dailyPhase?: 'qualifying' | 'knockout' | 'crowned';
  dailyKoSeasonId?: string;                    // season_id dos rounds daily_ko ('dko_<dia>')
  dailyKoSize?: number;                        // tamanho do bracket (2,4,8,16,32)
  dailyQualifyHour?: number;                   // hora BRT do corte (default 19)
  dailyKoMaxSize?: number;                     // teto do bracket (default 32)

  createdAt: number;
  lastUpdated: number;
}

/** Confronto do mata-mata diário (round_type = 'daily_ko') */
export interface DailyKnockoutRound {
  id: string;
  roundNumber: number;
  phase: string;                    // 'ko_32' | 'ko_16' | ... | 'ko_2'
  size: number;                     // nº de times nesta fase
  fixtures: GlobalFixture[];
  status: 'scheduled' | 'live' | 'finished';
  scheduledKickoffMs: number;
  finishedAtMs?: number;
}

/** Campeão do Dia — espelha a tabela daily_crowns */
export interface DailyCrown {
  id: string;
  teamId: string;
  managerId: string;
  clubName: string;
  clubShort: string;
  dailyDate: string;                // 'YYYY-MM-DD' BRT
  seasonId: string;
  competitionId?: string;
  bracketSize: number;
  runnerUpTeamId?: string;
  runnerUpClubName?: string;
  finalScoreHome?: number;
  finalScoreAway?: number;
  finalWentToPens: boolean;
  crownedAtMs: number;
}

/** Constantes */
export const GLOBAL_LEAGUE_MVP_CONSTANTS = {
  MIN_TEAMS: 32,
  PLAYOFF_ROUNDS: 6, // 3 rodadas ida/volta
  DIVISIONS: 3,
  PROMOTION_PERCENTAGE: 0.1, // 10%
  RELEGATION_PERCENTAGE: 0.1, // 10%
  ROUND_INTERVAL_MS: 5 * 60 * 1000, // 5 min entre kickoffs (slot ativo)
} as const;

/** Criar time inicial */
export function createGlobalTeam(
  managerId: string,
  clubName: string,
  clubShort: string,
  overall: number,
  division?: number
): GlobalTeam {
  return {
    id: `gt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    managerId,
    clubName,
    clubShort,
    overall,
    division,
    playoffPoints: 0,
    playoffMatchesPlayed: 0,
    playoffWins: 0,
    playoffDraws: 0,
    playoffLosses: 0,
    playoffGoalsFor: 0,
    playoffGoalsAgainst: 0,
    points: 0,
    matchesPlayed: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    recentForm: [],
    allTimePoints: 0,
    allTimeMatchesPlayed: 0,
    allTimeWins: 0,
    allTimeDraws: 0,
    allTimeLosses: 0,
    allTimeGoalsFor: 0,
    allTimeGoalsAgainst: 0,
    allTimeSeasonsPlayed: 0,
    injuryRoundsRemaining: 0,
    injuryModifier: 0,
    yellowCardCount: 0,
    suspensionRoundsRemaining: 0,
    registeredAt: Date.now(),
  };
}

/** Criar estado inicial da liga */
export function createGlobalLeagueMVP(): GlobalLeagueMVPState {
  return {
    seasonId: `season_${Date.now()}`,
    status: 'waiting_teams',
    teams: [],
    minTeamsRequired: GLOBAL_LEAGUE_MVP_CONSTANTS.MIN_TEAMS,
    playoffRounds: [],
    leagueRounds: [],
    teamsPerDivision: Math.ceil(GLOBAL_LEAGUE_MVP_CONSTANTS.MIN_TEAMS / GLOBAL_LEAGUE_MVP_CONSTANTS.DIVISIONS),
    promotionPercentage: GLOBAL_LEAGUE_MVP_CONSTANTS.PROMOTION_PERCENTAGE,
    relegationPercentage: GLOBAL_LEAGUE_MVP_CONSTANTS.RELEGATION_PERCENTAGE,
    createdAt: Date.now(),
    lastUpdated: Date.now(),
  };
}

/** Registrar novo time.
 * Se a liga já está active, entra direto na Divisão 3 para jogar imediatamente.
 * Se está em waiting_teams/playoffs, entra sem divisão (será distribuído nos playoffs).
 */
export function registerTeam(
  league: GlobalLeagueMVPState,
  managerId: string,
  clubName: string,
  clubShort: string,
  overall: number
): GlobalLeagueMVPState {
  if (league.teams.some(t => t.managerId === managerId)) {
    return league;
  }

  const division = league.status === 'active' ? 3 : undefined;
  const newTeam = createGlobalTeam(managerId, clubName, clubShort, overall, division);
  return {
    ...league,
    teams: [...league.teams, newTeam],
    lastUpdated: Date.now(),
  };
}

/**
 * Disparado pelo admin: gera rodadas de playoff a partir dos times registrados
 * e move o status para 'playoffs'. Falha (no-op) se status != 'waiting_teams'.
 * Não exige mínimo de times — admin decide quando iniciar.
 */
export function adminStartPlayoffs(league: GlobalLeagueMVPState): GlobalLeagueMVPState {
  if (league.status !== 'waiting_teams') return league;
  if (league.teams.length === 0) return league;

  return {
    ...league,
    status: 'playoffs',
    playoffRounds: generatePlayoffRounds(league.teams),
    currentPlayoffRound: 1,
    lastUpdated: Date.now(),
  };
}

/** Gerar confrontos dos playoffs (3 rodadas ida/volta) */
export function generatePlayoffRounds(teams: GlobalTeam[]): PlayoffRound[] {
  const rounds: PlayoffRound[] = [];
  const n = teams.length;

  // 3 rodadas de turno + 3 rodadas de returno = 6 rodadas
  for (let roundNumber = 1; roundNumber <= 6; roundNumber++) {
    const isReturning = roundNumber > 3;
    const phase: PlayoffPhase = roundNumber <= 2 ? 'round_1' : roundNumber <= 4 ? 'round_2' : 'round_3';

    const fixtures: GlobalFixture[] = [];

    // Algoritmo round-robin
    const half = n / 2;
    const turnRound = isReturning ? roundNumber - 3 : roundNumber;

    // Rotacionar times
    const rotated = [...teams];
    for (let r = 1; r < turnRound; r++) {
      const last = rotated.pop()!;
      rotated.splice(1, 0, last);
    }

    // Criar confrontos
    for (let i = 0; i < half; i++) {
      let home = rotated[i];
      let away = rotated[n - 1 - i];

      // No returno, inverter mando
      if (isReturning) {
        [home, away] = [away, home];
      }

      fixtures.push({
        id: newGlobalFixtureId(),
        roundId: `playoff_${roundNumber}`,
        division: 'playoff',
        homeTeamId: home.id,
        homeTeamName: home.clubName,
        homeOverall: home.overall,
        awayTeamId: away.id,
        awayTeamName: away.clubName,
        awayOverall: away.overall,
        scoreHome: 0,
        scoreAway: 0,
        currentMinute: 0,
        events: [],
        status: 'scheduled',
      });
    }

    rounds.push({
      phase,
      roundNumber,
      fixtures,
      status: 'scheduled',
      scheduledKickoffMs: Date.now() + (roundNumber - 1) * GLOBAL_LEAGUE_MVP_CONSTANTS.ROUND_INTERVAL_MS,
    });
  }

  return rounds;
}

/** Atualizar estatísticas após rodada de playoff */
export function updatePlayoffStats(
  team: GlobalTeam,
  goalsFor: number,
  goalsAgainst: number
): GlobalTeam {
  const isWin = goalsFor > goalsAgainst;
  const isDraw = goalsFor === goalsAgainst;

  let points = 0;
  if (isWin) points = 3;
  else if (isDraw) points = 1;

  return {
    ...team,
    playoffPoints: team.playoffPoints + points,
    playoffMatchesPlayed: team.playoffMatchesPlayed + 1,
    playoffWins: team.playoffWins + (isWin ? 1 : 0),
    playoffDraws: team.playoffDraws + (isDraw ? 1 : 0),
    playoffLosses: team.playoffLosses + (!isWin && !isDraw ? 1 : 0),
    playoffGoalsFor: team.playoffGoalsFor + goalsFor,
    playoffGoalsAgainst: team.playoffGoalsAgainst + goalsAgainst,
    // ALL-TIME — playoff também conta
    allTimePoints: (team.allTimePoints ?? 0) + points,
    allTimeMatchesPlayed: (team.allTimeMatchesPlayed ?? 0) + 1,
    allTimeWins: (team.allTimeWins ?? 0) + (isWin ? 1 : 0),
    allTimeDraws: (team.allTimeDraws ?? 0) + (isDraw ? 1 : 0),
    allTimeLosses: (team.allTimeLosses ?? 0) + (!isWin && !isDraw ? 1 : 0),
    allTimeGoalsFor: (team.allTimeGoalsFor ?? 0) + goalsFor,
    allTimeGoalsAgainst: (team.allTimeGoalsAgainst ?? 0) + goalsAgainst,
  };
}

/** Finalizar rodada de playoff */
export function finalizePlayoffRound(
  league: GlobalLeagueMVPState,
  roundNumber: number,
  finishedFixtures: GlobalFixture[]
): GlobalLeagueMVPState {
  // Atualizar estatísticas dos times
  const teamMap = new Map(league.teams.map(t => [t.id, { ...t }]));

  for (const fixture of finishedFixtures) {
    const homeTeam = teamMap.get(fixture.homeTeamId);
    const awayTeam = teamMap.get(fixture.awayTeamId);

    if (homeTeam && awayTeam) {
      teamMap.set(fixture.homeTeamId, updatePlayoffStats(homeTeam, fixture.scoreHome, fixture.scoreAway));
      teamMap.set(fixture.awayTeamId, updatePlayoffStats(awayTeam, fixture.scoreAway, fixture.scoreHome));
    }
  }

  const updatedTeams = Array.from(teamMap.values());

  // Atualizar rodada
  const updatedPlayoffRounds = league.playoffRounds.map(round => {
    if (round.roundNumber === roundNumber) {
      return {
        ...round,
        status: 'finished' as const,
        finishedAtMs: Date.now(),
        fixtures: finishedFixtures,
      };
    }
    return round;
  });

  // Se foi a última rodada de playoff, distribuir em divisões
  const isLastPlayoffRound = roundNumber === 6;
  const shouldStartLeague = isLastPlayoffRound;

  let teamsWithDivisions = updatedTeams;
  let leagueRounds = league.leagueRounds;

  if (shouldStartLeague) {
    teamsWithDivisions = distributeIntoDivisions(updatedTeams);
    leagueRounds = generateLeagueRounds(teamsWithDivisions);
  }

  return {
    ...league,
    teams: teamsWithDivisions,
    playoffRounds: updatedPlayoffRounds,
    currentPlayoffRound: isLastPlayoffRound ? undefined : roundNumber + 1,
    status: shouldStartLeague ? 'active' : league.status,
    leagueRounds: shouldStartLeague ? leagueRounds : league.leagueRounds,
    currentLeagueRound: shouldStartLeague ? 1 : league.currentLeagueRound,
    lastUpdated: Date.now(),
  };
}

/** Distribuir times em divisões baseado nos pontos dos playoffs */
export function distributeIntoDivisions(teams: GlobalTeam[]): GlobalTeam[] {
  // Ordenar por pontos dos playoffs
  const sorted = [...teams].sort((a, b) => {
    if (b.playoffPoints !== a.playoffPoints) return b.playoffPoints - a.playoffPoints;
    if (b.playoffWins !== a.playoffWins) return b.playoffWins - a.playoffWins;
    const aDiff = a.playoffGoalsFor - a.playoffGoalsAgainst;
    const bDiff = b.playoffGoalsFor - b.playoffGoalsAgainst;
    if (bDiff !== aDiff) return bDiff - aDiff;
    if (b.playoffGoalsFor !== a.playoffGoalsFor) return b.playoffGoalsFor - a.playoffGoalsFor;
    return a.clubName.localeCompare(b.clubName);
  });

  // Distribuir em 3 divisões (~11 times cada)
  const teamsPerDivision = Math.ceil(teams.length / 3);

  return sorted.map((team, index) => {
    const division = Math.floor(index / teamsPerDivision) + 1;
    return {
      ...team,
      division: Math.min(division, 3), // Garantir que não passe de 3
      position: (index % teamsPerDivision) + 1,
    };
  });
}

/** Gerar rodadas da liga oficial (turno e returno) */
export function generateLeagueRounds(teams: GlobalTeam[]): LeagueRound[] {
  const rounds: LeagueRound[] = [];

  // Agrupar por divisão
  const byDivision = new Map<number, GlobalTeam[]>();
  for (const team of teams) {
    if (team.division) {
      if (!byDivision.has(team.division)) {
        byDivision.set(team.division, []);
      }
      byDivision.get(team.division)!.push(team);
    }
  }

  // Considera só divisões com pelo menos 2 times para calcular o número de rodadas
  const divisionsWithMatches = Array.from(byDivision.values()).filter(t => t.length >= 2);
  if (divisionsWithMatches.length === 0) return rounds;
  const maxTeamsInDivision = Math.max(...divisionsWithMatches.map(t => t.length));
  const totalRounds = (maxTeamsInDivision - 1) * 2;

  for (let roundNumber = 1; roundNumber <= totalRounds; roundNumber++) {
    const fixtures: GlobalFixture[] = [];
    const isReturning = roundNumber > (maxTeamsInDivision - 1);

    // Gerar confrontos para cada divisão
    for (const [division, divTeams] of byDivision) {
      const n = divTeams.length;
      const half = Math.floor(n / 2);
      const turnRound = isReturning ? roundNumber - (maxTeamsInDivision - 1) : roundNumber;

      // Rotacionar times
      const rotated = [...divTeams];
      for (let r = 1; r < turnRound; r++) {
        const last = rotated.pop()!;
        rotated.splice(1, 0, last);
      }

      // Criar confrontos
      for (let i = 0; i < half; i++) {
        let home = rotated[i];
        let away = rotated[n - 1 - i];

        if (isReturning) {
          [home, away] = [away, home];
        }

        fixtures.push({
          id: newGlobalFixtureId(),
          roundId: `league_${roundNumber}`,
          division: String(division),
          homeTeamId: home.id,
          homeTeamName: home.clubName,
          homeOverall: home.overall,
          awayTeamId: away.id,
          awayTeamName: away.clubName,
          awayOverall: away.overall,
          scoreHome: 0,
          scoreAway: 0,
          currentMinute: 0,
          events: [],
          status: 'scheduled',
        });
      }
    }

    rounds.push({
      roundNumber,
      fixtures,
      status: 'scheduled',
      scheduledKickoffMs: Date.now() + (roundNumber - 1) * GLOBAL_LEAGUE_MVP_CONSTANTS.ROUND_INTERVAL_MS,
    });
  }

  return rounds;
}

/** Atualizar estatísticas da liga oficial */
export function updateLeagueStats(
  team: GlobalTeam,
  goalsFor: number,
  goalsAgainst: number
): GlobalTeam {
  const isWin = goalsFor > goalsAgainst;
  const isDraw = goalsFor === goalsAgainst;
  const isLoss = goalsFor < goalsAgainst;

  let points = 0;
  let result: 'W' | 'D' | 'L' = 'L';

  if (isWin) {
    points = 3;
    result = 'W';
  } else if (isDraw) {
    points = 1;
    result = 'D';
  }

  const newForm = [...team.recentForm, result].slice(-5);

  return {
    ...team,
    points: team.points + points,
    matchesPlayed: team.matchesPlayed + 1,
    wins: team.wins + (isWin ? 1 : 0),
    draws: team.draws + (isDraw ? 1 : 0),
    losses: team.losses + (isLoss ? 1 : 0),
    goalsFor: team.goalsFor + goalsFor,
    goalsAgainst: team.goalsAgainst + goalsAgainst,
    goalDifference: team.goalDifference + (goalsFor - goalsAgainst),
    recentForm: newForm,
    // ALL-TIME — soma sempre, nunca reseta
    allTimePoints: (team.allTimePoints ?? 0) + points,
    allTimeMatchesPlayed: (team.allTimeMatchesPlayed ?? 0) + 1,
    allTimeWins: (team.allTimeWins ?? 0) + (isWin ? 1 : 0),
    allTimeDraws: (team.allTimeDraws ?? 0) + (isDraw ? 1 : 0),
    allTimeLosses: (team.allTimeLosses ?? 0) + (isLoss ? 1 : 0),
    allTimeGoalsFor: (team.allTimeGoalsFor ?? 0) + goalsFor,
    allTimeGoalsAgainst: (team.allTimeGoalsAgainst ?? 0) + goalsAgainst,
  };
}

/** Finalizar rodada da liga e atualizar classificação */
export function finalizeLeagueRound(
  league: GlobalLeagueMVPState,
  roundNumber: number,
  finishedFixtures: GlobalFixture[]
): GlobalLeagueMVPState {
  // Atualizar estatísticas
  const teamMap = new Map(league.teams.map(t => [t.id, { ...t }]));

  for (const fixture of finishedFixtures) {
    const homeTeam = teamMap.get(fixture.homeTeamId);
    const awayTeam = teamMap.get(fixture.awayTeamId);

    if (homeTeam && awayTeam) {
      teamMap.set(fixture.homeTeamId, updateLeagueStats(homeTeam, fixture.scoreHome, fixture.scoreAway));
      teamMap.set(fixture.awayTeamId, updateLeagueStats(awayTeam, fixture.scoreAway, fixture.scoreHome));
    }
  }

  let updatedTeams = Array.from(teamMap.values());

  // Atualizar posições por divisão
  updatedTeams = updateDivisionPositions(updatedTeams);

  // Atualizar rodada
  const updatedLeagueRounds = league.leagueRounds.map(round => {
    if (round.roundNumber === roundNumber) {
      return {
        ...round,
        status: 'finished' as const,
        finishedAtMs: Date.now(),
        fixtures: finishedFixtures,
      };
    }
    return round;
  });

  return {
    ...league,
    teams: updatedTeams,
    leagueRounds: updatedLeagueRounds,
    currentLeagueRound: roundNumber + 1,
    lastUpdated: Date.now(),
  };
}

/** Atualizar posições dentro de cada divisão */
export function updateDivisionPositions(teams: GlobalTeam[]): GlobalTeam[] {
  const byDivision = new Map<number, GlobalTeam[]>();

  for (const team of teams) {
    if (team.division) {
      if (!byDivision.has(team.division)) {
        byDivision.set(team.division, []);
      }
      byDivision.get(team.division)!.push(team);
    }
  }

  const result: GlobalTeam[] = [];

  for (const [division, divTeams] of byDivision) {
    const sorted = divTeams.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.clubName.localeCompare(b.clubName);
    });

    sorted.forEach((team, index) => {
      team.previousPosition = team.position;
      team.position = index + 1;
    });

    result.push(...sorted);
  }

  return result;
}

/** Aplicar promoção e rebaixamento ao final da temporada */
export function applyPromotionRelegation(league: GlobalLeagueMVPState): GlobalLeagueMVPState {
  const byDivision = new Map<number, GlobalTeam[]>();

  for (const team of league.teams) {
    if (team.division) {
      if (!byDivision.has(team.division)) {
        byDivision.set(team.division, []);
      }
      byDivision.get(team.division)!.push(team);
    }
  }

  const updatedTeams: GlobalTeam[] = [];

  // Processar cada divisão
  for (let division = 1; division <= 3; division++) {
    const divTeams = byDivision.get(division) || [];
    // ORDENA pela classificação real (DESC: pontos > V > SG > GP) antes de
    // calcular promoção/rebaixamento. Sem isso, a ordem do Map é a de inserção
    // e o pior pode acabar promovido / o melhor rebaixado.
    divTeams.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.clubName.localeCompare(b.clubName);
    });
    const teamsCount = divTeams.length;
    const promotionCount = Math.ceil(teamsCount * league.promotionPercentage);
    const relegationCount = Math.ceil(teamsCount * league.relegationPercentage);

    divTeams.forEach((team, index) => {
      let newDivision = division;

      // Promoção (top 10%) — sobe pra divisão de cima (número menor)
      if (division > 1 && index < promotionCount) {
        newDivision = division - 1;
      }
      // Rebaixamento (bottom 10%) — desce pra divisão de baixo (número maior)
      else if (division < 3 && index >= teamsCount - relegationCount) {
        newDivision = division + 1;
      }

      updatedTeams.push({
        ...team,
        division: newDivision,
        // Reset stats da temporada para reorganizar divisões
        points: 0,
        matchesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        recentForm: [],
        position: undefined,
        previousPosition: undefined,
        // Zera também os stats de PLAYOFF — senão a próxima temporada acumula em
        // cima do lixo da anterior (updatePlayoffStats soma) e a semeadura por
        // playoffPoints fica corrompida.
        playoffPoints: 0,
        playoffMatchesPlayed: 0,
        playoffWins: 0,
        playoffDraws: 0,
        playoffLosses: 0,
        playoffGoalsFor: 0,
        playoffGoalsAgainst: 0,
        // ALL-TIME preservado + +1 temporada concluída
        allTimePoints: team.allTimePoints ?? 0,
        allTimeMatchesPlayed: team.allTimeMatchesPlayed ?? 0,
        allTimeWins: team.allTimeWins ?? 0,
        allTimeDraws: team.allTimeDraws ?? 0,
        allTimeLosses: team.allTimeLosses ?? 0,
        allTimeGoalsFor: team.allTimeGoalsFor ?? 0,
        allTimeGoalsAgainst: team.allTimeGoalsAgainst ?? 0,
        allTimeSeasonsPlayed: (team.allTimeSeasonsPlayed ?? 0) + 1,
      });
    });
  }

  return {
    ...league,
    teams: updatedTeams,
    status: 'season_ended',
    lastUpdated: Date.now(),
  };
}
