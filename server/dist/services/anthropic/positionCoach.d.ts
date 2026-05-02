/**
 * Position Coach — DNA tático por posição.
 * 9 posições, cada uma com sistema prompt específico herdado do legado.
 * Substitui OpenAI em positionCoach.ts:302.
 */
export interface PositionCoachInput {
    system: string;
    userContent: string;
}
export declare function runPositionCoach(input: PositionCoachInput): Promise<{
    ok: boolean;
    data?: unknown;
    rawAssistant?: string;
    error?: string;
}>;
