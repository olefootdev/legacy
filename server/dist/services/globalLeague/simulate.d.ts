import type { FixtureRow, TeamRow } from './types.js';
export declare function effectiveOverall(team: TeamRow): number;
export interface SimResult {
    score_home: number;
    score_away: number;
    events: Array<{
        id: string;
        fixture_id: string;
        event_type: string;
        minute: number;
        side: 'home' | 'away';
        text: string;
        highlight: boolean;
        timestamp_ms: number;
    }>;
    injured_side: 'home' | 'away' | null;
    home_yellow: boolean;
    away_yellow: boolean;
}
export declare function simulateFixture(fx: FixtureRow, effHome: number, effAway: number, kickoffMs: number): SimResult;
export declare function updateTeamRow(team: TeamRow, gf: number, ga: number, isPlayoff: boolean): TeamRow;
