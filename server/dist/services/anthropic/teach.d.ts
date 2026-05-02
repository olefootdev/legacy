/**
 * GameSpirit Teach — admin ensina novos padrões ao GameSpirit.
 * 3 tipos: narrative, tactical, position. JSON estrito.
 * Substitui OpenAI em gameSpirit.ts:225.
 */
export type TeachKind = 'narrative' | 'tactical' | 'position';
export declare function runTeach(input: {
    kind: TeachKind;
    userMessage: string;
    contextJson?: string;
}): Promise<{
    ok: boolean;
    data?: unknown;
    rawAssistant?: string;
    error?: string;
}>;
