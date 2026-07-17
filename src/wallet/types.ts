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
  | 'REFERRAL_OLE_GAME'
  | 'REFERRAL_NFT'
  | 'TRANSFER'
  | 'PURCHASE'
  | 'MATCH_REWARD'
  | 'STRUCTURE_UPGRADE';

/** OLEFOOT é a moeda do jogo (legacy_olefoot_credits). OLEXP e GAT foram removidos em 2026-07-16. */
export type WalletCurrencyExt = 'EXP' | 'BRO' | 'OLEFOOT';

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
// Colecionáveis (NFT)
// ---------------------------------------------------------------------------

/**
 * Item da prateleira de colecionáveis da Wallet.
 *
 * SHELL (2026-07-16): o tipo existe e a UI renderiza, mas nada popula a lista
 * ainda — o branch do fim de semana pluga a fonte (cards Legacy/Genesis que o
 * manager possui, arte já hospedada em Pinata/IPFS). Não há tokenização
 * on-chain no projeto: `tokenId`/`chain` ficam opcionais pra quando houver.
 */
export interface WalletCollectible {
  id: string;
  name: string;
  /** Ex.: "Adauto — Slavia Praha 2006" */
  collectionTitle?: string;
  imageUrl?: string;
  /** Fase/raridade exibida no card. */
  rarityLabel?: string;
  acquiredAt?: string;
  /** Só quando existir tokenização de verdade. */
  tokenId?: string;
  chain?: string;
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

  referralTree: ReferralNode[];
  referralCommissions: ReferralCommission[];
  ledger: WalletLedgerEntry[];

  /**
   * Primeira vez que completa o formulário de identidade para SWAP (qualquer direção).
   * Espelhado com localStorage `olefoot-wallet-swap-kyc`.
   */
  hasCompletedSwapKyc?: boolean;
  /** Dados de identidade para SWAP (MVP só cliente). */
  kycProfile?: WalletKycProfile;
  /** ID do patrocinador (referral) */
  sponsorId: string | null;
  /**
   * Código público de indicação deste utilizador (3–5 alfanuméricos), imutável após criado.
   */
  myReferralCode: string | null;
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
  | 'REFERRAL_SELF'
  | 'REFERRAL_ALREADY_SET'
  | 'REFERRAL_INVALID_CODE'
  | 'REFERRAL_SPONSOR_NOT_FOUND';
