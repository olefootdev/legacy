/**
 * Wallet Financial Hub — constantes tuníveis.
 * Todas as taxas, limites e configurações de produto num único lugar.
 */

import type { OlexpPlan, GatCategory } from './types';

// ---------------------------------------------------------------------------
// OLEXP — planos de yield
// ---------------------------------------------------------------------------

export const OLEXP_PLANS: readonly OlexpPlan[] = [
  { id: '90d',  days: 90,  dailyRate: 0.00175, minBroCents: 30_000, label: '90 dias — 0,175%/dia' },
  { id: '180d', days: 180, dailyRate: 0.00225, minBroCents: 30_000, label: '180 dias — 0,225%/dia' },
  { id: '360d', days: 360, dailyRate: 0.00275, minBroCents: 30_000, label: '360 dias — 0,275%/dia' },
] as const;

/** SWAP antecipado OLEXP → SPOT: principal mínimo por posição (30 BRO). */
export const OLEXP_SWAP_OLEXP_TO_SPOT_MIN_BRO_CENTS = 30 * 100;

/** Primeiro crédito de yield apenas 24h após a adesão */
export const OLEXP_FIRST_YIELD_DELAY_HOURS = 24;

// ---------------------------------------------------------------------------
// Referral
// ---------------------------------------------------------------------------

/** Comissão por nível (mesma taxa nos 3 níveis) */
export const REFERRAL_RATE = 0.05;

export const REFERRAL_MAX_LEVELS = 3;

/**
 * Tipos de ganho elegíveis para comissão de referral.
 * Yield, transferência, bônus e referral em si NÃO geram comissão (anti-pirâmide).
 */
export const REFERRAL_ELIGIBLE_SOURCES: readonly string[] = [
  'MATCH_REWARD',
  'PURCHASE',
] as const;

// ---------------------------------------------------------------------------
// GameAssetsTreasury (GAT)
// ---------------------------------------------------------------------------

/** 1% da base (BRO em centavos) por nível de referral, pago em EXP / dia (níveis 1–3). */
export const GAT_REFERRAL_LEVEL_RATE = 0.01;

/** Duração do reward em meses */
export const GAT_DURATION_MONTHS = 24;

/** Texto das faixas de taxa diária em EXP (% sobre a base em BRO). */
export const GAT_TIER_SUMMARY_PT =
  '1–100 BRO: 1,5%/dia · 101–300: 2,5% · 301–999: 3,5% · ≥1000 BRO: 5,5% (tudo em EXP). Referral GAT: 1%/nível (até 3) em EXP.';

/** Categorias de gasto que geram base elegível para GAT */
export const GAT_ELIGIBLE_CATEGORIES: readonly GatCategory[] = [
  'player_pack',
  'scout_intel',
  'structure_upgrade',
  'stadium_upgrade',
  'training_facility',
] as const;

export const GAT_CATEGORY_LABELS: Record<GatCategory, string> = {
  player_pack: 'Pacote de Jogador',
  scout_intel: 'Relatório de Olheiro',
  structure_upgrade: 'Melhoria de Estrutura',
  stadium_upgrade: 'Melhoria de Estádio',
  training_facility: 'Centro de Treino',
};

// ---------------------------------------------------------------------------
// Geral
// ---------------------------------------------------------------------------

/** Job hora (23:59 UTC em dias úteis para OLEXP, todos os dias para GAT) */
export const DAILY_ACCRUE_HOUR = 23;
export const DAILY_ACCRUE_MINUTE = 59;

// ---------------------------------------------------------------------------
// TradingView (wallet — mercado de referência)
// ---------------------------------------------------------------------------

/** Símbolo genérico de referência; ajustar quando houver par BRO listado. */
export const TRADINGVIEW_SYMBOL = 'FOREXCOM:SPXUSD';
