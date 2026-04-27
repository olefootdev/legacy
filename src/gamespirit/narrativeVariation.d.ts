/**
 * Sistema de variação narrativa — evita repetição de expressões em lances similares.
 *
 * Rastreia os últimos N eventos por tipo e força variação nas escolhas de template.
 * Exemplo: 3 passes seguidos usarão 3 expressões diferentes.
 */
interface NarrativeHistoryEntry {
    type: string;
    templateIndex: number;
    minute: number;
}
/**
 * Escolhe um template variado do array, evitando repetir os últimos usados.
 *
 * @param arr Array de templates disponíveis
 * @param eventType Tipo do evento (ex: 'progress', 'recycle', 'shot')
 * @param seed Seed para randomização
 * @param minute Minuto atual da partida
 * @returns Template escolhido
 */
export declare function pickVaried<T>(arr: T[], eventType: string, seed: number, minute: number): T;
/**
 * Limpa o histórico de narrativa (útil ao iniciar nova partida).
 */
export declare function clearNarrativeHistory(): void;
/**
 * Retorna estatísticas do histórico (para debug/telemetria).
 */
export declare function getNarrativeStats(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    recentEvents: NarrativeHistoryEntry[];
};
export {};
