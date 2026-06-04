/**
 * Engagement Score — buff de vitória para managers ativos.
 *
 * Score 0-100 → buff de +0% a +20% no OVR efetivo da Liga Global.
 * Reseta a 0 após 48h sem login.
 *
 * Fontes de pontos:
 *   Login recente        max 20 pts
 *   Streak de bônus      max 25 pts
 *   Sessões recentes     max 15 pts
 *   Plantel saudável     max 20 pts
 *   Treino recente       max 10 pts
 *   Compra recente       max 10 pts
 *                        ─────────
 *                        max 100 pts
 */

import type { ManagerPresence } from './types';

const MS_PER_HOUR = 60 * 60 * 1000;
const RESET_HOURS = 48;
const MAX_SCORE = 100;
const MAX_BUFF_PERCENT = 20;

export interface EngagementInput {
  presence: ManagerPresence;
  totalPlayers: number;
  healthyPlayers: number;
  lastTrainingAt?: number;
  lastPurchaseAt?: number;
}

export function computeEngagementScore(input: EngagementInput, nowMs: number = Date.now()): number {
  const { presence, totalPlayers, healthyPlayers, lastTrainingAt, lastPurchaseAt } = input;
  const hoursSinceLogin = (nowMs - (presence.lastLoginAt || 0)) / MS_PER_HOUR;

  if (hoursSinceLogin >= RESET_HOURS) return 0;

  let score = 0;

  // Login recente (max 20)
  if (hoursSinceLogin < 1) score += 20;
  else if (hoursSinceLogin < 6) score += 15;
  else if (hoursSinceLogin < 12) score += 10;
  else if (hoursSinceLogin < 24) score += 5;

  // Streak de bônus (max 25)
  score += Math.min(25, (presence.bonusStreakSlots ?? 0) * 3);

  // Sessões acumuladas (max 15)
  score += Math.min(15, Math.floor((presence.totalSessions ?? 0) / 10) * 5);

  // Plantel saudável (max 20)
  if (totalPlayers > 0) {
    score += Math.round((healthyPlayers / totalPlayers) * 20);
  }

  // Treino recente nas últimas 24h (max 10)
  if (lastTrainingAt && (nowMs - lastTrainingAt) / MS_PER_HOUR < 24) {
    score += 10;
  }

  // Compra recente nas últimas 48h (max 10)
  if (lastPurchaseAt && (nowMs - lastPurchaseAt) / MS_PER_HOUR < 48) {
    score += 10;
  }

  return Math.min(MAX_SCORE, score);
}

export function engagementBuffPercent(score: number): number {
  return Math.round((Math.min(MAX_SCORE, score) / MAX_SCORE) * MAX_BUFF_PERCENT);
}

export function engagementBuffLabel(score: number): string {
  const pct = engagementBuffPercent(score);
  if (pct === 0) return 'Inativo';
  if (pct <= 5) return 'Baixo';
  if (pct <= 10) return 'Moderado';
  if (pct <= 15) return 'Alto';
  return 'Máximo';
}
