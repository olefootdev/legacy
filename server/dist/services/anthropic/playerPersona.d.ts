/**
 * Persona de jogador — Create Player.
 *
 * 2 modos:
 *   - Combined (legado): 1 call que recebe prompt livre e devolve tudo.
 *     Mantido pra compat com o endpoint atual /api/admin/player-from-prompt.
 *   - Agentes especializados (novo): 4 chamadas sequenciais na admin UI.
 *     Ver ../../routes/gameSpirit.ts pra os 4 novos endpoints.
 *
 * Modelo: Sonnet — qualidade importa, não é hot path.
 */
export interface AdminPlayerLocked {
    name: string;
    pos: string;
    country?: string;
    strongFoot?: string;
    creatorType?: string;
    rarity?: string;
    collectionSummary?: string;
}
export interface PlayerPersonaResult {
    archetype?: string;
    behavior?: string;
    attrs?: Record<string, number>;
    quemSouEu?: string;
    num?: number;
    fatigue?: number;
    injuryRisk?: number;
    evolutionXp?: number;
    outForMatches?: number;
    spiritNotes?: string;
}
export declare function generatePlayerPersonaCombined(locked: AdminPlayerLocked, userPrompt: string): Promise<{
    ok: boolean;
    rawAssistant?: string;
    json?: PlayerPersonaResult;
    error?: string;
}>;
export interface ScoutResearch {
    full_name: string;
    nickname?: string;
    position: string;
    era: string;
    nationality: string;
    national_team?: string;
    main_clubs: Array<{
        name: string;
        years?: string;
        role?: string;
    }>;
    titles: string[];
    highlights: string[];
    playstyle_notes: string;
    personality_traits: string[];
    confidence: 'high' | 'medium' | 'low';
    sources_used: string[];
}
export declare function runScoutAgent(input: {
    name: string;
    nickname?: string;
    hintPosition?: string;
    hintEra?: string;
    /** URLs de pesquisa fornecidas pelo admin (Wikipedia, transfermarkt, etc). */
    sources?: string[];
}): Promise<{
    ok: boolean;
    research?: ScoutResearch;
    error?: string;
}>;
export type AdminRarityTier = 'premium' | 'gol' | 'rare' | 'ultra_rare' | 'champion' | 'legend' | 'epic';
export interface AttributesResult {
    overall: number;
    rarity_recommended: AdminRarityTier;
    attrs: {
        passe: number;
        marcacao: number;
        velocidade: number;
        drible: number;
        finalizacao: number;
        fisico: number;
        tatico: number;
        mentalidade: number;
        confianca: number;
        fairPlay: number;
    };
    subattrs_notes: string;
}
export declare function runAttributesAgent(input: {
    research: ScoutResearch;
    targetRarity?: AdminRarityTier;
}): Promise<{
    ok: boolean;
    attrs?: AttributesResult;
    error?: string;
}>;
export interface BioResult {
    quem_sou_eu: string;
    bio_short: string;
    signature_move: string;
    personality_line: string;
    spirit_notes: string;
}
export declare function runBioAgent(input: {
    research: ScoutResearch;
    attrs?: AttributesResult;
}): Promise<{
    ok: boolean;
    bio?: BioResult;
    error?: string;
}>;
export interface ValuationResult {
    floor_price_bro_cents: number;
    target_price_bro_cents: number;
    target_price_exp: number;
    rarity_tier: AdminRarityTier;
    scarcity_note: string;
    collection_fit: string;
    volatility: 'low' | 'medium' | 'high';
}
export declare function runValuationAgent(input: {
    attrs: AttributesResult;
    research?: ScoutResearch;
    collectionContext?: string;
}): Promise<{
    ok: boolean;
    valuation?: ValuationResult;
    error?: string;
}>;
