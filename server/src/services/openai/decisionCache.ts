/**
 * Cache opcional para decisões GameSpirit (ex.: Redis no futuro).
 * Por omissão não persiste nada — só define o contrato.
 */

export interface GameSpiritDecisionCache {
  get(key: string): Promise<string | null>;
  set(key: string, jsonValue: string, ttlMs?: number): Promise<void>;
}

export const noopGameSpiritDecisionCache: GameSpiritDecisionCache = {
  async get() {
    return null;
  },
  async set() {
    /* reservado para implementação futura */
  },
};
