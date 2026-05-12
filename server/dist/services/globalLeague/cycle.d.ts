import type { SupabaseClient } from '@supabase/supabase-js';
import type { CycleResult } from './types.js';
export declare function runGlobalLeagueCycle(sb: SupabaseClient): Promise<CycleResult>;
export declare function recoverStaleLiveRound(sb: SupabaseClient, now?: number): Promise<CycleResult | null>;
export declare function enrollClubInGlobalLeague(sb: SupabaseClient, opts: {
    managerId: string;
    clubName: string;
    clubShort: string;
    overall: number;
}): Promise<{
    ok: boolean;
    teamId?: string;
    error?: string;
}>;
