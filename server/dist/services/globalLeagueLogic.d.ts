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
export interface GlobalTeamLite {
    id: string;
    managerId: string;
    clubName: string;
    clubShort: string;
    overall: number;
    division?: number;
    position?: number;
    playoffPoints: number;
    playoffMatchesPlayed: number;
    playoffWins: number;
    playoffDraws: number;
    playoffLosses: number;
    playoffGoalsFor: number;
    playoffGoalsAgainst: number;
    points: number;
    matchesPlayed: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    recentForm: string[];
    registeredAt: number;
}
export interface FixtureLite {
    id: string;
    homeTeamId: string;
    awayTeamId: string;
    homeTeamName: string;
    awayTeamName: string;
    homeOverall: number;
    awayOverall: number;
    scoreHome: number;
    scoreAway: number;
    currentMinute: number;
    status: 'scheduled' | 'live' | 'finished';
    kickoffMs?: number;
    finishedAtMs?: number;
    events: any[];
    division: string | number;
}
export interface RoundLite {
    kind: 'playoff' | 'league';
    roundNumber: number;
    phase: string;
    status: 'scheduled' | 'live' | 'finished';
    scheduledKickoffMs: number;
    actualKickoffMs?: number;
    finishedAtMs?: number;
    fixtures: FixtureLite[];
}
/** Próximo topo de 5min do relógio */
export declare function getNextRoundTime(nowMs: number): number;
/**
 * Gera 6 rodadas de playoffs (3 turnos ida/volta) com round-robin.
 * Primeira rodada agendada para o próximo top de 5min.
 */
export declare function generatePlayoffRounds(teams: GlobalTeamLite[], nowMs: number): RoundLite[];
/**
 * Distribui times em divisões com base nos pontos de playoff.
 * Top N → div 1, próximos N → div 2, resto → div 3.
 */
export declare function distributeIntoDivisions(teams: GlobalTeamLite[], totalDivisions?: number): GlobalTeamLite[];
/**
 * Gera as rodadas da liga oficial — turno e returno por divisão.
 * Primeira rodada agendada para próximo top de 5min após nowMs.
 */
export declare function generateLeagueRounds(teams: GlobalTeamLite[], nowMs: number): RoundLite[];
/**
 * Aplica promoção/rebaixamento ao final da temporada e zera stats.
 * Top N% de cada divisão sobe; bottom N% desce.
 */
export declare function applyPromotionRelegation(teams: GlobalTeamLite[], promotionPercentage: number, relegationPercentage: number, totalDivisions?: number): GlobalTeamLite[];
