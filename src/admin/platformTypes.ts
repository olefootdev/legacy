/**
 * Modelo de dados do Admin ao nível da plataforma (multi-utilizador simulado).
 * Persistido em localStorage separado do save do jogo (`olefoot-admin-platform-v1`).
 */

import type { OlexpPlanId } from '@/wallet/types';

export type AdminPlatformUserStatus = 'active' | 'suspended';

/** Custódia OLEXP ao nível plataforma (visão operacional / backend futuro). */
export type PlatformOlexpCustodyStatus =
  | 'pending_activation'
  | 'active'
  | 'matured'
  | 'claimed';

export interface PlatformOlexpPosition {
  id: string;
  userId: string;
  planId: OlexpPlanId;
  principalCents: number;
  /** YYYY-MM-DD — após activação, alinhado ao motor de yield */
  startDate: string;
  endDate: string;
  yieldAccruedCents: number;
  status: PlatformOlexpCustodyStatus;
  createdAt: string;
  activatedAt?: string;
  lastAccrualDate?: string;
  note?: string;
}

export interface AdminPlatformUser {
  id: string;
  /** ID futuro backend / SSO */
  externalId?: string;
  displayName: string;
  email?: string;
  country?: string;
  clubName: string;
  clubShort: string;
  /** BRO “jogo” (saldo principal do manager) */
  broCents: number;
  spotBroCents: number;
  spotExpBalance: number;
  /** EXP ranking (ole) */
  ole: number;
  olexpPrincipalLockedCents: number;
  olexpYieldAccruedCents: number;
  gatPositionsCount: number;
  ledgerEntriesCount: number;
  createdAtIso: string;
  updatedAtIso: string;
  status: AdminPlatformUserStatus;
  notes?: string;
}

export type PlatformLedgerKind =
  | 'fiat_deposit'
  | 'fiat_withdrawal'
  | 'treasury_adjust'
  | 'user_balance_adjust';

/** Esteira operacional para depósitos/saques (on/off-ramp simulado ou futuro PSP). */
export type FiatPipelineStatus = 'processing' | 'completed' | 'failed';

export interface PlatformLedgerLine {
  id: string;
  createdAt: string;
  kind: PlatformLedgerKind;
  /** Positivo = entrada de BRO na plataforma / utilizador; negativo = saída */
  broCentsDelta: number;
  /** `treasury` ou id de utilizador */
  target: string;
  note?: string;
  /**
   * Só relevante para fiat_deposit / fiat_withdrawal.
   * `processing` = pedido na fila, saldos ainda não aplicados (intervenção Admin).
   */
  flowStatus?: FiatPipelineStatus;
  failureReason?: string;
}

export interface AdminPlatformState {
  version: 1;
  /** Tesouraria OLEFOOT (taxas, spreads) — não é soma automática dos users */
  platformTreasuryBroCents: number;
  /** Escrow agregado reportado (ex.: desafios) */
  platformEscrowBroCents: number;
  users: AdminPlatformUser[];
  /** Movimentos administrativos ao nível plataforma (MVP) */
  platformLedger: PlatformLedgerLine[];
  /** Posições OLEXP (detalhe por cliente; agregados em `users` recalculam quando há linhas). */
  platformOlexpPositions: PlatformOlexpPosition[];
}

export function emptyPlatformState(): AdminPlatformState {
  return {
    version: 1,
    platformTreasuryBroCents: 0,
    platformEscrowBroCents: 0,
    users: [],
    platformLedger: [],
    platformOlexpPositions: [],
  };
}
