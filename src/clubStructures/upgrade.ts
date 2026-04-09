import type { FinanceState } from '@/entities/types';
import { addOle, addBroCents } from '@/systems/economy';
import type {
  ClubStructureId,
  ClubStructuresState,
  UpgradeCost,
  AdminBroPriceTable,
} from './types';
import {
  MAX_LEVEL,
  MAX_EXP_LEVEL,
  LEDGER_REASON_EXP,
  LEDGER_REASON_BRO,
} from './types';
import { getExpCost } from './expCosts';

export interface UpgradeResult {
  ok: boolean;
  error?: string;
  structures?: ClubStructuresState;
  finance?: FinanceState;
  ledgerReason?: typeof LEDGER_REASON_EXP | typeof LEDGER_REASON_BRO;
  /** Preenchido quando o upgrade foi pago em BRO (centavos). */
  broSpentCents?: number;
}

/**
 * Returns the cost for the next upgrade, or null if already at max.
 * Enforces the currency rule: EXP for 1→3, BRO for 3→5.
 */
export function getNextUpgradeCost(
  id: ClubStructureId,
  currentLevel: number,
  broPrices: AdminBroPriceTable,
): UpgradeCost | null {
  if (currentLevel >= MAX_LEVEL) return null;

  if (currentLevel < MAX_EXP_LEVEL) {
    const exp = getExpCost(id, currentLevel);
    if (exp === null) return null;
    return { currency: 'exp', amount: exp };
  }

  const bro = broPrices[id];
  if (currentLevel === 3) return { currency: 'bro', amount: bro.level3to4BroCents };
  if (currentLevel === 4) return { currency: 'bro', amount: bro.level4to5BroCents };
  return null;
}

/**
 * Attempt to upgrade a structure. Returns new state or error.
 *
 * - Levels 1→2 and 2→3: paid in EXP (reduces exp_balance / `ole`).
 * - Levels 3→4 and 4→5: paid in BRO cents only.
 */
export function tryUpgradeStructure(
  id: ClubStructureId,
  structures: ClubStructuresState,
  finance: FinanceState,
  broPrices: AdminBroPriceTable,
): UpgradeResult {
  const current = structures[id] ?? 1;

  if (current >= MAX_LEVEL) {
    return { ok: false, error: 'Estrutura já no nível máximo.' };
  }

  const cost = getNextUpgradeCost(id, current, broPrices);
  if (!cost) {
    return { ok: false, error: 'Custo de upgrade indisponível.' };
  }

  if (cost.currency === 'exp') {
    if (finance.ole < cost.amount) {
      return { ok: false, error: `EXP insuficiente. Necessário: ${cost.amount}.` };
    }
    const nextFinance = addOle(finance, -cost.amount);
    const nextStructures = { ...structures, [id]: current + 1 };
    return { ok: true, structures: nextStructures, finance: nextFinance, ledgerReason: LEDGER_REASON_EXP };
  }

  if (finance.broCents < cost.amount) {
    const needed = (cost.amount / 100).toFixed(2);
    return { ok: false, error: `BRO insuficiente. Necessário: ${needed} BRO.` };
  }

  let nextFinance = addBroCents(finance, -cost.amount);
  const out = (nextFinance.broLifetimeOutCents ?? 0) + cost.amount;
  nextFinance = { ...nextFinance, broLifetimeOutCents: out };
  const nextStructures = { ...structures, [id]: current + 1 };
  return {
    ok: true,
    structures: nextStructures,
    finance: nextFinance,
    ledgerReason: LEDGER_REASON_BRO,
    broSpentCents: cost.amount,
  };
}

/** Create the default structures state (all at level 1). */
export function createDefaultStructures(): ClubStructuresState {
  return {
    stadium: 1,
    megastore: 1,
    youth_academy: 1,
    training_center: 1,
    medical_dept: 1,
  };
}
