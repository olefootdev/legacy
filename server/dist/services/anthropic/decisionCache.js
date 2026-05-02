/**
 * Cache opcional para decisões GameSpirit (ex.: Redis no futuro).
 * Por omissão não persiste nada — só define o contrato.
 */
export const noopGameSpiritDecisionCache = {
    async get() {
        return null;
    },
    async set() {
        /* reservado para implementação futura */
    },
};
//# sourceMappingURL=decisionCache.js.map