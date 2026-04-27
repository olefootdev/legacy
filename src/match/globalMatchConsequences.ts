/**
 * Sistema de Consequências Pós-Rodada
 *
 * Aplica suspensões, lesões, atualiza tabela e calcula momentum.
 */

import type {
  GlobalRound,
  GlobalFixture,
  GlobalMatchEvent,
  RoundConsequences,
} from './globalMatch';
import type { LeagueStandingRow } from './adminLeagues';
import { sortStandings } from './adminLeagues';

interface PlayerImpact {
  playerId: string;
  playerName: string;
  teamId: string;
  yellowCards: number;
  redCards: number;
  injuries: number;
}

/**
 * Analisa eventos da rodada e extrai impactos por jogador
 */
function extractPlayerImpacts(fixtures: GlobalFixture[]): Map<string, PlayerImpact> {
  const impacts = new Map<string, PlayerImpact>();

  for (const fixture of fixtures) {
    for (const event of fixture.events) {
      if (!event.playerId || !event.playerName) continue;

      const key = event.playerId;
      const teamId = event.side === 'home' ? fixture.homeTeamId : fixture.awayTeamId;

      if (!impacts.has(key)) {
        impacts.set(key, {
          playerId: event.playerId,
          playerName: event.playerName,
          teamId,
          yellowCards: 0,
          redCards: 0,
          injuries: 0,
        });
      }

      const impact = impacts.get(key)!;

      if (event.type === 'yellow_card') impact.yellowCards++;
      if (event.type === 'red_card') impact.redCards++;
      if (event.type === 'injury') impact.injuries++;
    }
  }

  return impacts;
}

/**
 * Calcula suspensões baseado em cartões
 */
function calculateSuspensions(
  impacts: Map<string, PlayerImpact>,
  previousYellowCounts: Map<string, number>,
): RoundConsequences['suspensions'] {
  const suspensions: RoundConsequences['suspensions'] = [];

  for (const impact of impacts.values()) {
    // Cartão vermelho direto = 1 rodada de suspensão
    if (impact.redCards > 0) {
      suspensions.push({
        playerId: impact.playerId,
        playerName: impact.playerName,
        teamId: impact.teamId,
        reason: 'red_card',
        roundsToServe: 1,
      });
    }

    // Acúmulo de amarelos (3 amarelos = 1 rodada de suspensão)
    const previousYellows = previousYellowCounts.get(impact.playerId) ?? 0;
    const totalYellows = previousYellows + impact.yellowCards;

    if (totalYellows >= 3 && previousYellows < 3) {
      suspensions.push({
        playerId: impact.playerId,
        playerName: impact.playerName,
        teamId: impact.teamId,
        reason: 'yellow_accumulation',
        roundsToServe: 1,
      });
    }
  }

  return suspensions;
}

/**
 * Calcula lesões e tempo de recuperação
 */
function calculateInjuries(impacts: Map<string, PlayerImpact>): RoundConsequences['injuries'] {
  const injuries: RoundConsequences['injuries'] = [];

  for (const impact of impacts.values()) {
    if (impact.injuries === 0) continue;

    // Severidade aleatória
    const roll = Math.random();
    let severity: 'light' | 'moderate' | 'severe';
    let recoveryRounds: number;

    if (roll < 0.6) {
      severity = 'light';
      recoveryRounds = 1;
    } else if (roll < 0.9) {
      severity = 'moderate';
      recoveryRounds = 2;
    } else {
      severity = 'severe';
      recoveryRounds = 3;
    }

    injuries.push({
      playerId: impact.playerId,
      playerName: impact.playerName,
      teamId: impact.teamId,
      severity,
      recoveryRounds,
    });
  }

  return injuries;
}

/**
 * Atualiza tabela da liga baseado nos resultados
 */
function updateStandings(
  currentStandings: LeagueStandingRow[],
  fixtures: GlobalFixture[],
): {
  updatedStandings: LeagueStandingRow[];
  changes: RoundConsequences['standingsChanges'];
} {
  const standingsMap = new Map<string, LeagueStandingRow>();

  // Copiar standings atuais
  for (const row of currentStandings) {
    standingsMap.set(row.teamId, { ...row });
  }

  // Aplicar resultados das partidas
  for (const fixture of fixtures) {
    if (fixture.status !== 'finished') continue;

    const homeRow = standingsMap.get(fixture.homeTeamId);
    const awayRow = standingsMap.get(fixture.awayTeamId);

    if (!homeRow || !awayRow) continue;

    // Atualizar estatísticas
    homeRow.played++;
    awayRow.played++;

    homeRow.goalsFor += fixture.scoreHome;
    homeRow.goalsAgainst += fixture.scoreAway;
    awayRow.goalsFor += fixture.scoreAway;
    awayRow.goalsAgainst += fixture.scoreHome;

    // Atribuir pontos
    if (fixture.scoreHome > fixture.scoreAway) {
      homeRow.points += 3; // Vitória casa
    } else if (fixture.scoreHome < fixture.scoreAway) {
      awayRow.points += 3; // Vitória visitante
    } else {
      homeRow.points += 1; // Empate
      awayRow.points += 1;
    }
  }

  // Ordenar tabela
  const previousStandings = sortStandings(currentStandings);
  const updatedStandings = sortStandings(Array.from(standingsMap.values()));

  // Detectar mudanças de posição
  const changes: RoundConsequences['standingsChanges'] = [];

  for (const row of updatedStandings) {
    const previousPos = previousStandings.findIndex((r) => r.teamId === row.teamId) + 1;
    const newPos = updatedStandings.findIndex((r) => r.teamId === row.teamId) + 1;

    if (previousPos !== newPos) {
      const previousRow = previousStandings.find((r) => r.teamId === row.teamId);
      const pointsGained = row.points - (previousRow?.points ?? 0);

      changes.push({
        teamId: row.teamId,
        teamName: row.name,
        previousPosition: previousPos,
        newPosition: newPos,
        pointsGained,
      });
    }
  }

  return { updatedStandings, changes };
}

/**
 * Processa todas as consequências de uma rodada
 */
export function processRoundConsequences(
  round: GlobalRound,
  currentStandings: LeagueStandingRow[],
  previousYellowCounts: Map<string, number>,
): {
  consequences: RoundConsequences;
  updatedStandings: LeagueStandingRow[];
  updatedYellowCounts: Map<string, number>;
} {
  const impacts = extractPlayerImpacts(round.fixtures);

  const suspensions = calculateSuspensions(impacts, previousYellowCounts);
  const injuries = calculateInjuries(impacts);

  const { updatedStandings, changes } = updateStandings(currentStandings, round.fixtures);

  // Atualizar contagem de amarelos
  const updatedYellowCounts = new Map(previousYellowCounts);
  for (const impact of impacts.values()) {
    const current = updatedYellowCounts.get(impact.playerId) ?? 0;
    updatedYellowCounts.set(impact.playerId, current + impact.yellowCards);

    // Resetar após suspensão por acúmulo
    if (current + impact.yellowCards >= 3) {
      updatedYellowCounts.set(impact.playerId, 0);
    }
  }

  const consequences: RoundConsequences = {
    roundId: round.id,
    suspensions,
    injuries,
    standingsChanges: changes,
  };

  return {
    consequences,
    updatedStandings,
    updatedYellowCounts,
  };
}

/**
 * Calcula momentum do time baseado em resultados recentes
 */
export function calculateTeamMomentum(
  teamId: string,
  recentFixtures: GlobalFixture[],
): number {
  let momentum = 0.5; // Neutro

  const teamFixtures = recentFixtures.filter(
    (f) => f.homeTeamId === teamId || f.awayTeamId === teamId,
  );

  for (const fixture of teamFixtures) {
    const isHome = fixture.homeTeamId === teamId;
    const teamScore = isHome ? fixture.scoreHome : fixture.scoreAway;
    const opponentScore = isHome ? fixture.scoreAway : fixture.scoreHome;

    if (teamScore > opponentScore) {
      momentum += 0.1; // Vitória
    } else if (teamScore < opponentScore) {
      momentum -= 0.1; // Derrota
    }
  }

  return Math.max(0, Math.min(1, momentum));
}

/**
 * Gera relatório de consequências para exibição
 */
export function formatConsequencesReport(consequences: RoundConsequences): string {
  const lines: string[] = [];

  lines.push('=== CONSEQUÊNCIAS DA RODADA ===\n');

  if (consequences.suspensions.length > 0) {
    lines.push('🟥 SUSPENSÕES:');
    for (const s of consequences.suspensions) {
      const reason = s.reason === 'red_card' ? 'Cartão Vermelho' : 'Acúmulo de Amarelos';
      lines.push(`  • ${s.playerName} (${reason}) - ${s.roundsToServe} rodada(s)`);
    }
    lines.push('');
  }

  if (consequences.injuries.length > 0) {
    lines.push('⚠️ LESÕES:');
    for (const i of consequences.injuries) {
      const severityLabel = {
        light: 'Leve',
        moderate: 'Moderada',
        severe: 'Grave',
      }[i.severity];
      lines.push(`  • ${i.playerName} (${severityLabel}) - ${i.recoveryRounds} rodada(s)`);
    }
    lines.push('');
  }

  if (consequences.standingsChanges.length > 0) {
    lines.push('📊 MUDANÇAS NA TABELA:');
    for (const c of consequences.standingsChanges) {
      const direction = c.newPosition < c.previousPosition ? '⬆️' : '⬇️';
      lines.push(
        `  ${direction} ${c.teamName}: ${c.previousPosition}º → ${c.newPosition}º (+${c.pointsGained} pts)`,
      );
    }
    lines.push('');
  }

  if (
    consequences.suspensions.length === 0 &&
    consequences.injuries.length === 0 &&
    consequences.standingsChanges.length === 0
  ) {
    lines.push('Nenhuma consequência significativa nesta rodada.');
  }

  return lines.join('\n');
}

/**
 * Verifica se um jogador está disponível para jogar
 */
export function isPlayerAvailable(
  playerId: string,
  activeSuspensions: RoundConsequences['suspensions'],
  activeInjuries: RoundConsequences['injuries'],
): { available: boolean; reason?: string } {
  const suspension = activeSuspensions.find((s) => s.playerId === playerId);
  if (suspension) {
    return {
      available: false,
      reason: `Suspenso (${suspension.reason === 'red_card' ? 'Cartão Vermelho' : 'Acúmulo de Amarelos'})`,
    };
  }

  const injury = activeInjuries.find((i) => i.playerId === playerId);
  if (injury) {
    return {
      available: false,
      reason: `Lesionado (${injury.severity})`,
    };
  }

  return { available: true };
}
