/**
 * Wallet Financial Hub — tipos e contratos.
 * Pure TS, sem dependência de React. Serve como contrato para backend futuro.
 */

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------

export type WalletLedgerType =
  | 'SPOT_EXP'
  | 'SPOT_BRO'
  | 'OLEXP_PRINCIPAL'
  | 'OLEXP_YIELD'
  | 'SWAP_SPOT_TO_OLEXP'
  | 'SWAP_OLEXP_TO_SPOT'
  | 'REFERRAL_OLE_GAME'
  | 'REFERRAL_NFT'
  | 'GAT_REWARD'
  | 'GAT_BASE_DEBIT'
  | 'TRANSFER'
  | 'PURCHASE'
  | 'MATCH_REWARD'
  | 'STRUCTURE_UPGRADE'
  /** Simulação Admin / futuro on-ramp fiat → SPOT BRO */
  | 'FIAT_DEPOSIT'
  /** Simulação Admin / futuro off-ramp SPOT BRO → fiat */
  | 'FIAT_WITHDRAWAL';

export type WalletCurrencyExt = 'EXP' | 'BRO' | 'OLEXP' | 'GAT';

export type LedgerStatus = 'pending' | 'confirmed' | 'cancelled';

export interface WalletLedgerEntry {
  id: string;
  userId: string;
  type: WalletLedgerType;
  currency: WalletCurrencyExt;
  /** Positivo = crédito, negativo = débito */
  amount: number;
  status: LedgerStatus;
  source: string;
  refId?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface LedgerFilter {
  type?: WalletLedgerType | WalletLedgerType[];
  currency?: WalletCurrencyExt;
  status?: LedgerStatus;
  fromDate?: string;
  toDate?: string;
}

// ---------------------------------------------------------------------------
// OLEXP (staking)
// ---------------------------------------------------------------------------

export type OlexpPlanId = '90d' | '180d' | '360d';

export interface OlexpPlan {
  id: OlexpPlanId;
  days: number;
  /** Yield diário sobre o principal (seg–sex, sem capitalização) */
  dailyRate: number;
  /** Mínimo em centavos de BRO */
  minBroCents: number;
  label: string;
}

export type OlexpPositionStatus = 'active' | 'matured' | 'claimed';

export interface OlexpPosition {
  id: string;
  planId: OlexpPlanId;
  /** Principal em centavos de BRO */
  principalCents: number;
  startDate: string;
  endDate: string;
  /** Yield acumulado mas ainda não sacado (centavos BRO) */
  yieldAccruedCents: number;
  /** Yield já creditado ao SPOT (centavos BRO) */
  yieldPaidCents: number;
  status: OlexpPositionStatus;
  /** Última data (ISO) em que o accrual foi processado */
  lastAccrualDate: string;
}

// ---------------------------------------------------------------------------
// Referral
// ---------------------------------------------------------------------------

export type ReferralLevel = 1 | 2 | 3;
export type ReferralSourceType = 'ole_game' | 'nft_primary';

export interface ReferralNode {
  userId: string;
  sponsorId: string;
  level: ReferralLevel;
  createdAt: string;
}

export interface ReferralCommission {
  id: string;
  fromUserId: string;
  toUserId: string;
  level: ReferralLevel;
  sourceType: ReferralSourceType;
  /** Valor original que gerou a comissão (centavos) */
  sourceAmount: number;
  /** Comissão calculada (centavos) */
  commissionAmount: number;
  currency: WalletCurrencyExt;
  status: LedgerStatus;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// GameAssetsTreasury (GAT)
// ---------------------------------------------------------------------------

export type GatCategory =
  | 'player_pack'
  | 'scout_intel'
  | 'structure_upgrade'
  | 'stadium_upgrade'
  | 'training_facility';

export interface GatPosition {
  id: string;
  userId: string;
  /** Base elegível (centavos BRO gastos na categoria) */
  baseEligibleCents: number;
  dailyRate: number;
  startDate: string;
  /** Data de fim (24 meses após startDate) */
  endDate: string;
  /** Reward acumulado mas não sacado (centavos BRO) */
  accruedCents: number;
  /** Reward já creditado ao SPOT (centavos BRO) */
  paidCents: number;
  lastAccrualDate: string;
  sourceCategory: GatCategory;
  /** Nome amigável do ativo (ex.: Estádio, Pacote de EXP). Opcional em saves antigos. */
  assetLabel?: string;
}

// ---------------------------------------------------------------------------
// WalletState (agregado central)
// ---------------------------------------------------------------------------

/** MVP cliente: identidade para SWAP. TODO: backend + LGPD. */
export interface WalletKycProfile {
  fullName: string;
  address: string;
  cpf: string;
  confirmedAt: string;
}

export interface WalletState {
  /** Saldo SPOT BRO em centavos */
  spotBroCents: number;
  /** Saldo SPOT EXP */
  spotExpBalance: number;

  olexpPositions: OlexpPosition[];
  referralTree: ReferralNode[];
  referralCommissions: ReferralCommission[];
  gatPositions: GatPosition[];
  ledger: WalletLedgerEntry[];

  /** KYC leve para OLEXP já completado */
  kycOlexpDone: boolean;
  /**
   * Primeira vez que completa o formulário de identidade para SWAP (qualquer direção).
   * Espelhado com localStorage `olefoot-wallet-swap-kyc`.
   */
  hasCompletedSwapKyc?: boolean;
  /** Dados de identidade para SWAP (MVP só cliente). */
  kycProfile?: WalletKycProfile;
  /** ID do patrocinador (referral) */
  sponsorId: string | null;
}

// ---------------------------------------------------------------------------
// Resultados de operação (para validação sem throw)
// ---------------------------------------------------------------------------

export type WalletResult<T = WalletState> =
  | { ok: true; state: T }
  | { ok: false; error: string; code: WalletErrorCode };

export type WalletErrorCode =
  | 'ADMIN_INVALID_AMOUNT'
  | 'INSUFFICIENT_SPOT_BRO'
  | 'INSUFFICIENT_SPOT_EXP'
  | 'OLEXP_MIN_NOT_MET'
  | 'OLEXP_KYC_REQUIRED'
  | 'OLEXP_NOT_MATURED'
  | 'OLEXP_POSITION_NOT_FOUND'
  | 'OLEXP_ALREADY_CLAIMED'
  | 'OLEXP_NOT_ACTIVE'
  | 'REFERRAL_SELF'
  | 'REFERRAL_ALREADY_SET'
  | 'REFERRAL_SPONSOR_NOT_FOUND'
  | 'GAT_INVALID_CATEGORY';
