/**
 * Sistema de detecção de fraude e transações suspeitas.
 * Analisa padrões de comportamento e bloqueia operações de alto risco.
 */

import type { WalletLedgerEntry, WalletState } from './types';

export type FraudRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface FraudAlert {
  level: FraudRiskLevel;
  reason: string;
  blocked: boolean;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface TransactionRiskAnalysis {
  riskLevel: FraudRiskLevel;
  alerts: FraudAlert[];
  shouldBlock: boolean;
  requiresReview: boolean;
}

/**
 * Analisa uma transação antes de executá-la.
 */
export function analyzeTransactionRisk(
  wallet: WalletState,
  operation: {
    type: string;
    amountCents: number;
    targetUserId?: string;
  },
  userContext?: {
    ipAddress?: string;
    userAgent?: string;
    lastLoginAt?: string;
  },
): TransactionRiskAnalysis {
  const alerts: FraudAlert[] = [];
  const now = new Date().toISOString();

  // 1. Verificar valor anormalmente alto
  if (operation.amountCents > 1_000_000) { // > 10k BRO
    alerts.push({
      level: 'critical',
      reason: 'Valor extremamente alto (> 10k BRO)',
      blocked: true,
      timestamp: now,
      metadata: { amountCents: operation.amountCents },
    });
  } else if (operation.amountCents > 500_000) { // > 5k BRO
    alerts.push({
      level: 'high',
      reason: 'Valor alto (> 5k BRO) - requer revisão',
      blocked: false,
      timestamp: now,
      metadata: { amountCents: operation.amountCents },
    });
  }

  // 2. Verificar múltiplas transações em curto período (velocity check)
  const recentTransactions = wallet.ledger.filter((entry) => {
    const entryTime = new Date(entry.createdAt).getTime();
    const nowTime = new Date(now).getTime();
    const diffMinutes = (nowTime - entryTime) / (1000 * 60);
    return diffMinutes <= 5 && entry.status === 'confirmed';
  });

  if (recentTransactions.length >= 10) {
    alerts.push({
      level: 'high',
      reason: 'Múltiplas transações em 5 minutos (possível bot)',
      blocked: true,
      timestamp: now,
      metadata: { count: recentTransactions.length },
    });
  } else if (recentTransactions.length >= 5) {
    alerts.push({
      level: 'medium',
      reason: 'Atividade elevada detectada',
      blocked: false,
      timestamp: now,
      metadata: { count: recentTransactions.length },
    });
  }

  // 3. Verificar saldo insuficiente (tentativa de double-spend)
  if (operation.type.includes('WITHDRAW') || operation.type.includes('TRANSFER')) {
    if (wallet.spotBroCents < operation.amountCents) {
      alerts.push({
        level: 'critical',
        reason: 'Saldo insuficiente (possível double-spend)',
        blocked: true,
        timestamp: now,
        metadata: { balance: wallet.spotBroCents, requested: operation.amountCents },
      });
    }
  }

  // 4. Verificar padrão de round-trip (lavagem de dinheiro)
  const last24h = wallet.ledger.filter((entry) => {
    const entryTime = new Date(entry.createdAt).getTime();
    const nowTime = new Date(now).getTime();
    const diffHours = (nowTime - entryTime) / (1000 * 60 * 60);
    return diffHours <= 24;
  });

  const deposits = last24h.filter((e) => e.type === 'FIAT_DEPOSIT' && e.amount > 0);
  const withdrawals = last24h.filter((e) => e.type === 'FIAT_WITHDRAWAL' && e.amount < 0);

  if (deposits.length > 0 && withdrawals.length > 0) {
    const totalDeposit = deposits.reduce((sum, e) => sum + e.amount, 0);
    const totalWithdrawal = Math.abs(withdrawals.reduce((sum, e) => sum + e.amount, 0));

    // Se deposita e saca valor similar em 24h (round-trip)
    if (Math.abs(totalDeposit - totalWithdrawal) < totalDeposit * 0.1) {
      alerts.push({
        level: 'high',
        reason: 'Padrão de round-trip detectado (possível lavagem)',
        blocked: false,
        timestamp: now,
        metadata: { deposit: totalDeposit, withdrawal: totalWithdrawal },
      });
    }
  }

  // 5. Verificar mudança de IP suspeita (se disponível)
  if (userContext?.ipAddress) {
    // TODO: Implementar verificação de geolocalização
    // Se IP muda de país em < 1 hora, é suspeito
  }

  // Determinar nível de risco geral
  const criticalAlerts = alerts.filter((a) => a.level === 'critical');
  const highAlerts = alerts.filter((a) => a.level === 'high');

  let riskLevel: FraudRiskLevel = 'low';
  let shouldBlock = false;
  let requiresReview = false;

  if (criticalAlerts.length > 0) {
    riskLevel = 'critical';
    shouldBlock = true;
    requiresReview = true;
  } else if (highAlerts.length > 0) {
    riskLevel = 'high';
    requiresReview = true;
  } else if (alerts.length > 0) {
    riskLevel = 'medium';
  }

  return { riskLevel, alerts, shouldBlock, requiresReview };
}

/**
 * Registra um alerta de fraude no ledger para auditoria.
 */
export function logFraudAlert(
  wallet: WalletState,
  alert: FraudAlert,
  operation: { type: string; amountCents: number },
): WalletState {
  const entry: WalletLedgerEntry = {
    id: `fraud-alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId: 'system',
    type: 'PURCHASE', // Tipo genérico para alertas
    currency: 'BRO',
    amount: 0,
    status: 'cancelled',
    source: 'fraud_detection',
    refId: `alert-${alert.level}`,
    createdAt: alert.timestamp,
    metadata: {
      fraudAlert: true,
      level: alert.level,
      reason: alert.reason,
      blocked: alert.blocked,
      operation,
    },
  };

  return {
    ...wallet,
    ledger: [...wallet.ledger, entry],
  };
}

/**
 * Verifica se um usuário está em cooldown após múltiplas tentativas suspeitas.
 */
export function checkCooldown(wallet: WalletState): {
  inCooldown: boolean;
  remainingSeconds: number;
  reason?: string;
} {
  const now = new Date().getTime();
  const last10min = wallet.ledger.filter((entry) => {
    const entryTime = new Date(entry.createdAt).getTime();
    const diffMinutes = (now - entryTime) / (1000 * 60);
    return (
      diffMinutes <= 10 &&
      entry.status === 'cancelled' &&
      entry.metadata?.fraudAlert === true
    );
  });

  // Se teve 3+ alertas de fraude em 10 min, cooldown de 30 min
  if (last10min.length >= 3) {
    const oldestAlert = last10min[last10min.length - 1];
    const alertTime = new Date(oldestAlert.createdAt).getTime();
    const cooldownEnd = alertTime + 30 * 60 * 1000; // 30 min
    const remainingMs = cooldownEnd - now;

    if (remainingMs > 0) {
      return {
        inCooldown: true,
        remainingSeconds: Math.ceil(remainingMs / 1000),
        reason: 'Múltiplas tentativas suspeitas detectadas',
      };
    }
  }

  return { inCooldown: false, remainingSeconds: 0 };
}
