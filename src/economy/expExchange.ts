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

const NPC_TEAM_NAMES = [
  'SC Atlântico',
  'Porto Real FC',
  'União Central',
  'Clube do Vale',
  'Estrela do Norte',
  'CA Litoral',
  'FC Horizonte',
  'Desportivo Aurora',
  'Grêmio Industrial',
  'Olympus City',
] as const;

function isoNow(): string {
  return new Date().toISOString();
}

function randomBroCentsForLot(exp: number): number {
  const bro = (exp / 85_000) * 100;
  const cents = Math.round(bro * 100);
  return Math.max(500, Math.min(250_000, cents));
}

/** Semear livro NPC (ex.: save antigo sem `expExchange`). */
export function seedNpcExpExchangeOrders(count: number): ExpExchangeOrder[] {
  const out: ExpExchangeOrder[] = [];
  const t = Date.now();
  for (let i = 0; i < count; i++) {
    const teamName = NPC_TEAM_NAMES[i % NPC_TEAM_NAMES.length];
    const expAmount = 25_000 + ((i * 47_711 + 19_000) % 475_000);
    out.push({
      id: `ex_npc_${t}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      kind: 'npc',
      teamName,
      expAmount,
      broCents: randomBroCentsForLot(expAmount),
      createdAtIso: isoNow(),
    });
  }
  return out;
}

export function createInitialExpExchangeState(): ExpExchangeState {
  return {
    npcOrders: [],     // sem mocks — livro começa vazio
    playerOrders: [],
  };
}

/**
 * Livro NPC desativado no deploy de testes online.
 * Quando reativar, chame `seedNpcExpExchangeOrders(N)` aqui.
 */
export function replenishNpcExpOrders(state: ExpExchangeState): ExpExchangeState {
  return state;
}

export const EXP_EXCHANGE_MIN_LOT = 10_000;
export const EXP_EXCHANGE_MAX_LOT = 50_000_000;
export const EXP_EXCHANGE_MIN_BRO_CENTS = 100;
