/**
 * Wrapper unificado do Anthropic SDK.
 *
 * Centraliza:
 *   - Cliente único reutilizado
 *   - Seleção de modelo (Sonnet pra qualidade, Haiku pra velocidade/custo)
 *   - Parsing JSON robusto com retry se vier quebrado
 *   - Erros padronizados
 *
 * Todas as rotas que usam LLM devem importar daqui (server/src/routes/*).
 */
export declare const MODELS: {
    readonly sonnet: string;
    readonly haiku: string;
};
export type ModelKey = keyof typeof MODELS;
export declare function hasAnthropicKey(): boolean;
export interface AnthropicCallOptions {
    /** Chave do modelo: 'sonnet' (qualidade) ou 'haiku' (custo/velocidade). */
    model: ModelKey;
    /** System prompt — identidade e regras do agente. */
    system: string;
    /** Conteúdo do usuário — pergunta/contexto. */
    user: string;
    /** Máximo de tokens de resposta. Default 1024. */
    maxTokens?: number;
    /** Criatividade 0.0–1.0. Default 0.7 pra narrativa; use 0.3 pra JSON estrito. */
    temperature?: number;
    /** Se true, espera JSON na resposta e faz parse. Retry automático se falhar. */
    expectJson?: boolean;
    /** Timeout em ms. Default 30000. */
    timeoutMs?: number;
}
export interface AnthropicCallResult<T = unknown> {
    ok: boolean;
    text?: string;
    json?: T;
    error?: string;
    usage?: {
        inputTokens: number;
        outputTokens: number;
    };
    model: string;
}
export declare function callAnthropic<T = unknown>(opts: AnthropicCallOptions): Promise<AnthropicCallResult<T>>;
/**
 * Cria um "system prompt" padronizado com regras de saída JSON.
 * Usar em todos os endpoints que esperam JSON estruturado.
 */
export declare function jsonSystemPrompt(persona: string, schemaHint?: string): string;
