/**
 * Seed de narração — banco de templates por situação.
 * Cada template usa placeholders: {{from}}, {{to}}, {{team}}, {{keeper}}.
 * `pickLine` escolhe por peso, preenche e devolve uma linha única pronta para o feed.
 */
export interface NarrationEntry {
    situation: string;
    template: string;
    tags: string[];
    weight: number;
}
export declare const NARRATION_SEED: NarrationEntry[];
export interface PickLineParams {
    min: number;
    from?: string;
    to?: string;
    team?: string;
    keeper?: string;
}
/**
 * Seleciona um template por situação(ões), pondera por weight, preenche placeholders
 * e devolve a linha pronta com prefixo de minuto. Retorna null se nenhum candidato
 * válido existir (permite fallback ao chamador).
 *
 * Templates que exigem {{to}} são filtrados se `to` não for fornecido.
 */
export declare function pickLine(situation: string | string[], params: PickLineParams, seed?: number): string | null;
