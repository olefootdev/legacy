/**
 * Modelo de dados do Admin ao nível da plataforma (multi-utilizador simulado).
 * Persistido em localStorage separado do save do jogo (`olefoot-admin-platform-v1`).
 */

import type { OlexpPlanId } from '@/wallet/types';

export type AdminPlatformUserStatus = 'active' | 'suspended' | 'banned';

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

/** Receita de comércio in-game (loja, mercado) — MVP local; futuro: pipeline analytics. */
export type GrowthCommerceKind = 'store_item' | 'transfer_player' | 'bundle';

export interface GrowthCommerceLine {
  id: string;
  createdAt: string;
  kind: GrowthCommerceKind;
  /** Receita OLEFOOT (taxas / margem) em centavos BRO */
  revenueBroCents: number;
  /** Volume bruto opcional (ex.: preço do item) */
  grossBroCents?: number;
  userId?: string;
  label?: string;
}

/** Métricas de topo de funil por dia (impressões / cliques CTA) — alimenta CTR e campanhas. */
export interface GrowthDailyPulseRow {
  date: string;
  bannerImpressions: number;
  ctaClicks: number;
  /** Registos atribuídos a tráfego pago / campanha (MVP manual ou ingestão futura) */
  attributedSignups?: number;
}

/** Despesas operacionais reais (R$) — cashflow da empresa, não confundir com BRO do jogo. */
export type CashflowExpenseCategory =
  | 'pessoas'
  | 'infra'
  | 'marketing'
  | 'legal'
  | 'ferramentas'
  | 'impostos'
  | 'outro';

export interface CashflowExpenseLine {
  id: string;
  /** YYYY-MM-DD — dia de competência do gasto (ou início da recorrência) */
  date: string;
  label: string;
  category: CashflowExpenseCategory;
  /** Valor em centavos de BRL (ex.: R$ 120,00 → 12000) */
  amountBrlCents: number;
  note?: string;
  /** Se true, repete todo mês a partir de `date` até `endDate` (ou indefinidamente). */
  recurring?: boolean;
  /** YYYY-MM-DD — último mês de competência (inclusive). Só relevante quando `recurring=true`. */
  endDate?: string;
  createdAt: string;
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
  /** Histórico de compras (loja / transferências) para growth e faturamento próprio da plataforma */
  growthCommerceLines: GrowthCommerceLine[];
  /** Série diária para CTA, impressões e sinais de aquisição */
  growthDailyPulse: GrowthDailyPulseRow[];
  /** Gastos diários / operacionais em R$ (centavos) */
  growthCashflowExpenses: CashflowExpenseLine[];
  /**
   * Referência manual: quantos centavos de BRO equivalem a 1,00 BRL (para cruzar receita do ecossistema com despesas).
   * Ex.: 50 → 1 BRL = 0,50 BRO. Opcional — sem isto, o painel mostra as duas moedas lado a lado.
   */
  growthBroCentsPerBrl?: number;
}

export function emptyPlatformState(): AdminPlatformState {
  return {
    version: 1,
    platformTreasuryBroCents: 0,
    platformEscrowBroCents: 0,
    users: [],
    platformLedger: [],
    platformOlexpPositions: [],
    growthCommerceLines: [],
    growthDailyPulse: [],
    growthCashflowExpenses: [],
  };
}
