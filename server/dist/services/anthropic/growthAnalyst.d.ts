/**
 * Growth Analyst — análise diária do founder.
 * Substitui OpenAI em gameSpirit.ts:160.
 */
export interface GrowthAnalystResult {
    daily_review: string;
    revenue_and_growth: string;
    cashflow_health: string;
    tips: string[];
    cautions: string[];
    forecast_note: string;
}
export declare function runGrowthAnalyst(input: {
    snapshot: unknown;
    founderNote?: string;
}): Promise<{
    ok: boolean;
    analysis?: GrowthAnalystResult;
    error?: string;
    rawAssistant?: string;
}>;
