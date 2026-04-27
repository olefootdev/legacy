/**
 * Sistema de variação narrativa — evita repetição de expressões em lances similares.
 *
 * Rastreia os últimos N eventos por tipo e força variação nas escolhas de template.
 * Exemplo: 3 passes seguidos usarão 3 expressões diferentes.
 */
const HISTORY_SIZE = 8; // Rastreia últimos 8 eventos
const narrativeHistory = [];
/**
 * Escolhe um template variado do array, evitando repetir os últimos usados.
 *
 * @param arr Array de templates disponíveis
 * @param eventType Tipo do evento (ex: 'progress', 'recycle', 'shot')
 * @param seed Seed para randomização
 * @param minute Minuto atual da partida
 * @returns Template escolhido
 */
export function pickVaried(arr, eventType, seed, minute) {
    if (arr.length === 1)
        return arr[0];
    // Buscar últimos usos deste tipo de evento
    const recentUses = narrativeHistory
        .filter(h => h.type === eventType)
        .slice(-3); // Últimos 3 usos
    // Índices já usados recentemente
    const usedIndices = new Set(recentUses.map(h => h.templateIndex));
    // Se todos foram usados recentemente, limpar histórico deste tipo
    if (usedIndices.size >= arr.length) {
        const toRemove = narrativeHistory.filter(h => h.type === eventType);
        toRemove.forEach(entry => {
            const idx = narrativeHistory.indexOf(entry);
            if (idx !== -1)
                narrativeHistory.splice(idx, 1);
        });
        usedIndices.clear();
    }
    // Escolher índice que não foi usado recentemente
    let attempts = 0;
    let chosenIndex;
    do {
        chosenIndex = Math.abs(Math.floor(seed * 9973 + attempts * 7919)) % arr.length;
        attempts++;
    } while (usedIndices.has(chosenIndex) && attempts < arr.length * 2);
    // Registrar uso
    narrativeHistory.push({
        type: eventType,
        templateIndex: chosenIndex,
        minute,
    });
    // Manter tamanho do histórico
    if (narrativeHistory.length > HISTORY_SIZE) {
        narrativeHistory.shift();
    }
    return arr[chosenIndex];
}
/**
 * Limpa o histórico de narrativa (útil ao iniciar nova partida).
 */
export function clearNarrativeHistory() {
    narrativeHistory.length = 0;
}
/**
 * Retorna estatísticas do histórico (para debug/telemetria).
 */
export function getNarrativeStats() {
    const eventsByType = {};
    for (const entry of narrativeHistory) {
        eventsByType[entry.type] = (eventsByType[entry.type] ?? 0) + 1;
    }
    return {
        totalEvents: narrativeHistory.length,
        eventsByType,
        recentEvents: [...narrativeHistory],
    };
}
//# sourceMappingURL=narrativeVariation.js.map