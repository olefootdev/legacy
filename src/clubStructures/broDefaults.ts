import type { AdminBroPriceTable } from './types';

/**
 * Fallback BRO prices (dev/staging only).
 * In production, these come from Admin API.
 * Values in centavos (1 BRO = 100 cents).
 */
export const DEFAULT_BRO_PRICES_CENTS: AdminBroPriceTable = {
  stadium:         { level3to4BroCents: 1_299, level4to5BroCents: 2_499 },
  training_center: { level3to4BroCents:   999, level4to5BroCents: 1_999 },
  youth_academy:   { level3to4BroCents:   799, level4to5BroCents: 1_599 },
  medical_dept:    { level3to4BroCents:   699, level4to5BroCents: 1_399 },
  megastore:       { level3to4BroCents:   599, level4to5BroCents: 1_199 },
};
