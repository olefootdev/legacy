/**
 * Lógica pura da Liga Global (sem deps de @/match — server-side).
 *
 * Replica `generatePlayoffRounds`, `distributeIntoDivisions`,
 * `generateLeagueRounds`, `applyPromotionRelegation` do cliente
 * (`src/match/globalLeagueMVP.ts`) para que o server seja autoritativo.
 *
 * IDs gerados aqui DEVEM ser deterministicamente prefixados pra não colidir
 * com os do cliente.
 */
const ROUND_INTERVAL_MS = 5 * 60 * 1000;
function newId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
/** Próximo topo de 5min do relógio */
export function getNextRoundTime(nowMs) {
    return Math.ceil((nowMs + 1000) / ROUND_INTERVAL_MS) * ROUND_INTERVAL_MS;
}
/**
 * Gera 6 rodadas de playoffs (3 turnos ida/volta) com round-robin.
 * Primeira rodada agendada para o próximo top de 5min.
 */
export function generatePlayoffRounds(teams, nowMs) {
    const rounds = [];
    const n = teams.length;
    if (n < 2)
        return rounds;
    const firstKickoff = getNextRoundTime(nowMs);
    for (let roundNumber = 1; roundNumber <= 6; roundNumber++) {
        const isReturning = roundNumber > 3;
        const phase = roundNumber <= 2 ? 'round_1' : roundNumber <= 4 ? 'round_2' : 'round_3';
        const fixtures = [];
        const half = Math.floor(n / 2);
        const turnRound = isReturning ? roundNumber - 3 : roundNumber;
        const rotated = [...teams];
        for (let r = 1; r < turnRound; r++) {
            const last = rotated.pop();
            rotated.splice(1, 0, last);
        }
        for (let i = 0; i < half; i++) {
            let home = rotated[i];
            let away = rotated[n - 1 - i];
            if (isReturning)
                [home, away] = [away, home];
            fixtures.push({
                id: newId('gf'),
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
                division: 'playoff',
            });
        }
        rounds.push({
            kind: 'playoff',
            roundNumber,
            phase,
            status: 'scheduled',
            scheduledKickoffMs: firstKickoff + (roundNumber - 1) * ROUND_INTERVAL_MS,
            fixtures,
        });
    }
    return rounds;
}
/**
 * Distribui times em divisões com base nos pontos de playoff.
 * Top N → div 1, próximos N → div 2, resto → div 3.
 */
export function distributeIntoDivisions(teams, totalDivisions = 3) {
    const sorted = [...teams].sort((a, b) => {
        if (b.playoffPoints !== a.playoffPoints)
            return b.playoffPoints - a.playoffPoints;
        if (b.playoffWins !== a.playoffWins)
            return b.playoffWins - a.playoffWins;
        const aDiff = a.playoffGoalsFor - a.playoffGoalsAgainst;
        const bDiff = b.playoffGoalsFor - b.playoffGoalsAgainst;
        if (bDiff !== aDiff)
            return bDiff - aDiff;
        if (b.playoffGoalsFor !== a.playoffGoalsFor)
            return b.playoffGoalsFor - a.playoffGoalsFor;
        return a.clubName.localeCompare(b.clubName);
    });
    const teamsPerDivision = Math.ceil(teams.length / totalDivisions);
    return sorted.map((team, index) => {
        const division = Math.min(totalDivisions, Math.floor(index / teamsPerDivision) + 1);
        const positionInDiv = (index % teamsPerDivision) + 1;
        return { ...team, division, position: positionInDiv };
    });
}
/**
 * Gera as rodadas da liga oficial — turno e returno por divisão.
 * Primeira rodada agendada para próximo top de 5min após nowMs.
 */
export function generateLeagueRounds(teams, nowMs) {
    const rounds = [];
    const byDivision = new Map();
    for (const team of teams) {
        if (!team.division)
            continue;
        if (!byDivision.has(team.division))
            byDivision.set(team.division, []);
        byDivision.get(team.division).push(team);
    }
    if (byDivision.size === 0)
        return rounds;
    // Considera só divisões com pelo menos 2 times para calcular o número de rodadas
    const divisionsWithMatches = Array.from(byDivision.values()).filter(t => t.length >= 2);
    if (divisionsWithMatches.length === 0)
        return rounds;
    const maxTeamsInDivision = Math.max(...divisionsWithMatches.map(t => t.length));
    const totalRounds = (maxTeamsInDivision - 1) * 2;
    const firstKickoff = getNextRoundTime(nowMs);
    for (let roundNumber = 1; roundNumber <= totalRounds; roundNumber++) {
        const fixtures = [];
        const isReturning = roundNumber > (maxTeamsInDivision - 1);
        for (const [division, divTeams] of byDivision) {
            const n = divTeams.length;
            if (n < 2)
                continue;
            const half = Math.floor(n / 2);
            const turnRound = isReturning ? roundNumber - (maxTeamsInDivision - 1) : roundNumber;
            const rotated = [...divTeams];
            for (let r = 1; r < turnRound; r++) {
                const last = rotated.pop();
                rotated.splice(1, 0, last);
            }
            for (let i = 0; i < half; i++) {
                let home = rotated[i];
                let away = rotated[n - 1 - i];
                if (isReturning)
                    [home, away] = [away, home];
                fixtures.push({
                    id: newId('gf'),
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
                    division: String(division),
                });
            }
        }
        rounds.push({
            kind: 'league',
            roundNumber,
            phase: '',
            status: 'scheduled',
            scheduledKickoffMs: firstKickoff + (roundNumber - 1) * ROUND_INTERVAL_MS,
            fixtures,
        });
    }
    return rounds;
}
/**
 * Aplica promoção/rebaixamento ao final da temporada e zera stats.
 * Top N% de cada divisão sobe; bottom N% desce.
 */
export function applyPromotionRelegation(teams, promotionPercentage, relegationPercentage, totalDivisions = 3) {
    const byDivision = new Map();
    for (const team of teams) {
        if (!team.division)
            continue;
        if (!byDivision.has(team.division))
            byDivision.set(team.division, []);
        byDivision.get(team.division).push(team);
    }
    // Ordenar dentro de cada divisão pelas stats da temporada
    for (const [, divTeams] of byDivision) {
        divTeams.sort((a, b) => {
            if (b.points !== a.points)
                return b.points - a.points;
            if (b.wins !== a.wins)
                return b.wins - a.wins;
            if (b.goalDifference !== a.goalDifference)
                return b.goalDifference - a.goalDifference;
            if (b.goalsFor !== a.goalsFor)
                return b.goalsFor - a.goalsFor;
            return a.clubName.localeCompare(b.clubName);
        });
    }
    const result = [];
    for (let division = 1; division <= totalDivisions; division++) {
        const divTeams = byDivision.get(division) || [];
        const teamsCount = divTeams.length;
        const promoCount = Math.ceil(teamsCount * promotionPercentage);
        const releCount = Math.ceil(teamsCount * relegationPercentage);
        divTeams.forEach((team, index) => {
            let newDivision = division;
            if (division > 1 && index < promoCount)
                newDivision = division - 1;
            else if (division < totalDivisions && index >= teamsCount - releCount)
                newDivision = division + 1;
            result.push({
                ...team,
                division: newDivision,
                // reset stats da nova temporada
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
                position: undefined,
            });
        });
    }
    // Times sem divisão (caso tenha entrado mid-season) entram no array com div=undefined
    for (const team of teams) {
        if (!team.division)
            result.push(team);
    }
    return result;
}
//# sourceMappingURL=globalLeagueLogic.js.map