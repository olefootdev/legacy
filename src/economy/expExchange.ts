export interface ExpExchangeOrder {
  id: string;
  kind: 'npc' | 'player';
  /** Clube vendedor (ordens `player`); ausente em `npc`. */
  sellerClubId?: string;
  teamName: string;
  expAmount: number;
  broCents: number;
  createdAtIso: string;
}

export interface ExpExchangeState {
  npcOrders: ExpExchangeOrder[];
  playerOrders: ExpExchangeOrder[];
}

export function createInitialExpExchangeState(): ExpExchangeState {
  return {
    npcOrders: [],     // sem mocks — livro começa vazio
    playerOrders: [],
  };
}

/** Livro NPC desativado — só ordens reais entram no livro. */
export function replenishNpcExpOrders(state: ExpExchangeState): ExpExchangeState {
  return state;
}

export const EXP_EXCHANGE_MIN_LOT = 10_000;
export const EXP_EXCHANGE_MAX_LOT = 50_000_000;
export const EXP_EXCHANGE_MIN_BRO_CENTS = 100;
