/**
 * Gerador de catálogo narrativo — batch via Anthropic Haiku.
 *
 * Recebe uma lista de "slots" (categoria + intensidade + tags + vibe) e
 * devolve N templates por slot. Cada template é uma string com placeholders
 * {player}, {minute}, {gk}, etc.
 *
 * Usado pelo script `scripts/generate-narrative-catalog.ts` e (futuro) cron
 * semanal do Cloudflare Workers.
 */
export interface CatalogSlot {
    category: string;
    intensity: string;
    contextTags?: string[];
    personaVibe: 'analytical' | 'visceral' | 'poetic' | 'casual';
    /** Quantos templates gerar pra este slot. */
    count: number;
}
export interface GeneratedTemplate {
    category: string;
    intensity: string;
    context_tags: string[];
    template: string;
    variables: Record<string, string[]>;
    persona_vibe: string;
}
export declare function generateSlot(slot: CatalogSlot): Promise<GeneratedTemplate[]>;
/**
 * Gera N slots em sequência (pra respeitar rate limits) e devolve um array
 * único pronto pra inserção via `admin_insert_narrative_batch`.
 */
export declare function generateCatalog(slots: CatalogSlot[]): Promise<GeneratedTemplate[]>;
