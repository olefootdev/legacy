/**
 * OLEFOOT LIGA — Sistema de Liga Completo
 *
 * 3 Divisões com 10 times cada
 * Sistema de pontos corridos (turno e returno)
 * Tabela de classificação atualizada automaticamente
 */

import type { GlobalFixture } from './globalMatch';
import { newGlobalFixtureId } from './globalMatch';

/** Time da OLEFOOT LIGA */
export interface OlefootLeagueTeam {
  id: string;
  name: string;
  shortName: string;
  overall: number;
  division: number;

  // Estatísticas da temporada
  points: number;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;

  // Forma recente (últimos 5 jogos)
  recentForm: Array<'W' | 'D' | 'L'>;

  // Posição na tabela
  position: number;
  previousPosition?: number;
}

/** Tabela de classificação de uma divisão */
export interface DivisionStandings {
  division: number;
  teams: OlefootLeagueTeam[];
  lastUpdated: number;
}

/** Rodada completa da liga */
export interface OlefootLeagueRound {
  roundNumber: number;
  isReturning: boolean; // true = returno
  fixtures: GlobalFixture[];
  status: 'scheduled' | 'live' | 'finished';
  scheduledKickoffMs: number;
  actualKickoffMs?: number;
  finishedAtMs?: number;
}

/** Estado completo da OLEFOOT LIGA */
export interface OlefootLeagueState {
  seasonId: string;
  seasonName: string;

  // Times de todas as divisões
  teams: OlefootLeagueTeam[];

  // Rodadas (18 rodadas = turno + returno para 10 times)
  rounds: OlefootLeagueRound[];
  currentRoundNumber: number;

  // Tabelas de classificação
  standings: DivisionStandings[];

  // Configurações
  createdAt: number;
  lastUpdated: number;
}

/** Nomes dos times brasileiros */
const TEAM_NAMES = [
  // Divisão 1 (Elite)
  { name: 'Flamengo', short: 'FLA' },
  { name: 'Palmeiras', short: 'PAL' },
  { name: 'Atlético-MG', short: 'CAM' },
  { name: 'Corinthians', short: 'COR' },
  { name: 'São Paulo', short: 'SAO' },
  { name: 'Internacional', short: 'INT' },
  { name: 'Grêmio', short: 'GRE' },
  { name: 'Fluminense', short: 'FLU' },
  { name: 'Santos', short: 'SAN' },
  { name: 'Botafogo', short: 'BOT' },

  // Divisão 2 (Intermediária)
  { name: 'Athletico-PR', short: 'CAP' },
  { name: 'Cruzeiro', short: 'CRU' },
  { name: 'Vasco', short: 'VAS' },
  { name: 'Bahia', short: 'BAH' },
  { name: 'Fortaleza', short: 'FOR' },
  { name: 'Bragantino', short: 'BRA' },
  { name: 'Cuiabá', short: 'CUI' },
  { name: 'Goiás', short: 'GOI' },
  { name: 'Coritiba', short: 'CFC' },
  { name: 'América-MG', short: 'AME' },

  // Divisão 3 (Acesso)
  { name: 'Sport', short: 'SPT' },
  { name: 'Vitória', short: 'VIT' },
  { name: 'Ceará', short: 'CEA' },
  { name: 'Ponte Preta', short: 'PON' },
  { name: 'Guarani', short: 'GUA' },
  { name: 'Avaí', short: 'AVA' },
  { name: 'Chapecoense', short: 'CHA' },
  { name: 'CRB', short: 'CRB' },
  { name: 'Náutico', short: 'NAU' },
  { name: 'Sampaio Corrêa', short: 'SAM' },
];

/** Criar time inicial */
function createTeam(
  index: number,
  division: number,
  nameData: { name: string; short: string }
): OlefootLeagueTeam {
  // OVR baseado na divisão
  const baseOverall = division === 1 ? 85 : division === 2 ? 78 : 72;
  const overall = baseOverall + Math.floor(Math.random() * 8);

  return {
    id: `team_${division}_${index}`,
    name: nameData.name,
    shortName: nameData.short,
    overall,
    division,
    points: 0,
    matchesPlayed: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    recentForm: [],
    position: index + 1,
  };
}

/** Criar todos os times da liga */
export function createOlefootLeagueTeams(): OlefootLeagueTeam[] {
  const teams: OlefootLeagueTeam[] = [];

  let nameIndex = 0;
  for (let division = 1; division <= 3; division++) {
    for (let i = 0; i < 10; i++) {
      teams.push(createTeam(i, division, TEAM_NAMES[nameIndex]));
      nameIndex++;
    }
  }

  return teams;
}

/** Gerar confrontos de uma rodada (round-robin) */
function generateRoundFixtures(
  teams: OlefootLeagueTeam[],
  roundNumber: number,
  isReturning: boolean
): GlobalFixture[] {
  const fixtures: GlobalFixture[] = [];

  // Agrupar por divisão
  const byDivision = new Map<number, OlefootLeagueTeam[]>();
  for (const team of teams) {
    if (!byDivision.has(team.division)) {
      byDivision.set(team.division, []);
    }
    byDivision.get(team.division)!.push(team);
  }

  // Gerar confrontos para cada divisão
  for (const [division, divTeams] of byDivision) {
    // Algoritmo round-robin
    const n = divTeams.length;
    const half = n / 2;

    // Rodada atual no turno (1-9)
    const turnRound = isReturning ? roundNumber - 9 : roundNumber;

    // Rotacionar times (algoritmo round-robin)
    const rotated = [...divTeams];
    for (let r = 1; r < turnRound; r++) {
      const last = rotated.pop()!;
      rotated.splice(1, 0, last);
    }

    // Criar confrontos
    for (let i = 0; i < half; i++) {
      let home = rotated[i];
      let away = rotated[n - 1 - i];

      // No returno, inverter mando de campo
      if (isReturning) {
        [home, away] = [away, home];
      }

      fixtures.push({
        id: newGlobalFixtureId(),
        roundId: `round_${roundNumber}`,
        division: String(division),
        homeTeamId: home.id,
        homeTeamName: home.name,
        homeOverall: home.overall,
        awayTeamId: away.id,
        awayTeamName: away.name,
        awayOverall: away.overall,
        scoreHome: 0,
        scoreAway: 0,
        currentMinute: 0,
        events: [],
        status: 'scheduled',
      });
    }
  }

  return fixtures;
}

/** Gerar todas as rodadas da temporada (18 rodadas = turno + returno) */
export function generateAllRounds(teams: OlefootLeagueTeam[]): OlefootLeagueRound[] {
  const rounds: OlefootLeagueRound[] = [];

  // 9 rodadas de turno + 9 rodadas de returno = 18 rodadas
  for (let roundNumber = 1; roundNumber <= 18; roundNumber++) {
    const isReturning = roundNumber > 9;
    const fixtures = generateRoundFixtures(teams, roundNumber, isReturning);

    rounds.push({
      roundNumber,
      isReturning,
      fixtures,
      status: 'scheduled',
      scheduledKickoffMs: Date.now() + (roundNumber - 1) * 60 * 60 * 1000, // 1h entre rodadas
    });
  }

  return rounds;
}

/** Atualizar estatísticas de um time após uma partida */
export function updateTeamStats(
  team: OlefootLeagueTeam,
  goalsFor: number,
  goalsAgainst: number,
  isHome: boolean
): OlefootLeagueTeam {
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

  // Atualizar forma recente (últimos 5 jogos)
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
  };
}

/** Atualizar tabela após uma rodada */
export function updateStandings(
  teams: OlefootLeagueTeam[],
  finishedFixtures: GlobalFixture[]
): OlefootLeagueTeam[] {
  // Criar mapa de times para atualização
  const teamMap = new Map(teams.map(t => [t.id, { ...t }]));

  // Atualizar estatísticas baseado nos resultados
  for (const fixture of finishedFixtures) {
    const homeTeam = teamMap.get(fixture.homeTeamId);
    const awayTeam = teamMap.get(fixture.awayTeamId);

    if (homeTeam && awayTeam) {
      teamMap.set(
        fixture.homeTeamId,
        updateTeamStats(homeTeam, fixture.scoreHome, fixture.scoreAway, true)
      );
      teamMap.set(
        fixture.awayTeamId,
        updateTeamStats(awayTeam, fixture.scoreAway, fixture.scoreHome, false)
      );
    }
  }

  // Converter de volta para array
  const updatedTeams = Array.from(teamMap.values());

  // Ordenar por divisão e depois por critérios de classificação
  const byDivision = new Map<number, OlefootLeagueTeam[]>();
  for (const team of updatedTeams) {
    if (!byDivision.has(team.division)) {
      byDivision.set(team.division, []);
    }
    byDivision.get(team.division)!.push(team);
  }

  // Ordenar cada divisão
  const sortedTeams: OlefootLeagueTeam[] = [];
  for (const [division, divTeams] of byDivision) {
    const sorted = divTeams.sort((a, b) => {
      // 1. Pontos
      if (b.points !== a.points) return b.points - a.points;
      // 2. Vitórias
      if (b.wins !== a.wins) return b.wins - a.wins;
      // 3. Saldo de gols
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      // 4. Gols marcados
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      // 5. Nome (desempate final)
      return a.name.localeCompare(b.name);
    });

    // Atualizar posições
    sorted.forEach((team, index) => {
      team.previousPosition = team.position;
      team.position = index + 1;
    });

    sortedTeams.push(...sorted);
  }

  return sortedTeams;
}

/** Criar tabelas de classificação por divisão */
export function createDivisionStandings(teams: OlefootLeagueTeam[]): DivisionStandings[] {
  const standings: DivisionStandings[] = [];

  for (let division = 1; division <= 3; division++) {
    const divTeams = teams
      .filter(t => t.division === division)
      .sort((a, b) => a.position - b.position);

    standings.push({
      division,
      teams: divTeams,
      lastUpdated: Date.now(),
    });
  }

  return standings;
}

/** Criar estado inicial da OLEFOOT LIGA */
export function createOlefootLeague(): OlefootLeagueState {
  const teams = createOlefootLeagueTeams();
  const rounds = generateAllRounds(teams);
  const standings = createDivisionStandings(teams);

  return {
    seasonId: `season_${Date.now()}`,
    seasonName: 'OLEFOOT LIGA 2026',
    teams,
    rounds,
    currentRoundNumber: 1,
    standings,
    createdAt: Date.now(),
    lastUpdated: Date.now(),
  };
}

/** Avançar para próxima rodada */
export function advanceToNextRound(league: OlefootLeagueState): OlefootLeagueState {
  const nextRoundNumber = league.currentRoundNumber + 1;

  if (nextRoundNumber > 18) {
    // Temporada finalizada
    return league;
  }

  return {
    ...league,
    currentRoundNumber: nextRoundNumber,
    lastUpdated: Date.now(),
  };
}

/** Finalizar rodada e atualizar tabela */
export function finalizeRound(
  league: OlefootLeagueState,
  roundNumber: number,
  finishedFixtures: GlobalFixture[]
): OlefootLeagueState {
  // Atualizar times com os resultados
  const updatedTeams = updateStandings(league.teams, finishedFixtures);

  // Atualizar tabelas
  const updatedStandings = createDivisionStandings(updatedTeams);

  // Atualizar rodada
  const updatedRounds = league.rounds.map(round => {
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
    standings: updatedStandings,
    rounds: updatedRounds,
    lastUpdated: Date.now(),
  };
}
