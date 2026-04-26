/**
 * Hook React para operações de wallet com segurança integrada.
 * Combina 2FA, detecção de fraude e backup automático.
 */

import { useState, useCallback, useEffect } from 'react';
import type { WalletState } from './types';
import type { SensitiveOperation, TwoFactorConfig } from './twoFactorAuth';
import { requires2FA, validateTotpCode, validateBackupCode } from './twoFactorAuth';
import { analyzeTransactionRisk, logFraudAlert, checkCooldown } from './fraudDetection';
import { backupWalletToSupabase, autoBackupIfNeeded } from './walletBackup';
import { getSupabase } from '@/supabase/client';

export interface SecureWalletHook {
  // Estado
  wallet: WalletState;
  twoFactorConfig: TwoFactorConfig;
  isLoading: boolean;
  error: string | null;

  // Operações seguras
  executeSecureOperation: (
    operation: SensitiveOperation,
    amountCents: number,
    code?: string,
  ) => Promise<{ ok: boolean; error?: string; requires2FA?: boolean }>;

  // Gerenciamento de 2FA
  enable2FA: () => Promise<{ ok: boolean; secret?: string; backupCodes?: string[]; qrCodeUrl?: string; error?: string }>;
  disable2FA: (code: string) => Promise<{ ok: boolean; error?: string }>;

  // Backup manual
  backupNow: () => Promise<{ ok: boolean; error?: string }>;

  // Verificação de segurança
  checkSecurity: () => {
    inCooldown: boolean;
    remainingSeconds: number;
    reason?: string;
  };
}

export function useSecureWallet(
  wallet: WalletState,
  userId: string,
  onWalletUpdate: (wallet: WalletState) => void,
): SecureWalletHook {
  const [twoFactorConfig, setTwoFactorConfig] = useState<TwoFactorConfig>({ enabled: false });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);

  // Carregar config 2FA do Supabase
  useEffect(() => {
    const loadTwoFactorConfig = async () => {
      const supabase = getSupabase();
      if (!supabase || !userId) return;

      const { data, error } = await supabase
        .from('user_2fa_config')
        .select('enabled, secret, backup_codes, enabled_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('[useSecureWallet] Erro ao carregar 2FA:', error.message);
        return;
      }

      if (data) {
        setTwoFactorConfig({
          enabled: data.enabled,
          secret: data.secret || undefined,
          backupCodes: data.backup_codes || undefined,
          enabledAt: data.enabled_at || undefined,
        });
      }
    };

    loadTwoFactorConfig();
  }, [userId]);

  // Backup automático periódico
  useEffect(() => {
    const interval = setInterval(() => {
      autoBackupIfNeeded(wallet, userId, lastBackupAt || undefined).then(() => {
        setLastBackupAt(new Date().toISOString());
      });
    }, 5 * 60 * 1000); // A cada 5 minutos

    return () => clearInterval(interval);
  }, [wallet, userId, lastBackupAt]);

  const executeSecureOperation = useCallback(
    async (
      operation: SensitiveOperation,
      amountCents: number,
      code?: string,
    ): Promise<{ ok: boolean; error?: string; requires2FA?: boolean }> => {
      setIsLoading(true);
      setError(null);

      try {
        // 1. Verificar cooldown
        const cooldownCheck = checkCooldown(wallet);
        if (cooldownCheck.inCooldown) {
          const error = `Conta em cooldown por ${Math.ceil(cooldownCheck.remainingSeconds / 60)} minutos. ${cooldownCheck.reason}`;
          setError(error);
          return { ok: false, error };
        }

        // 2. Verificar se requer 2FA
        const twoFactorCheck = requires2FA(operation, twoFactorConfig, amountCents);
        if (twoFactorCheck.required && !code) {
          return { ok: false, requires2FA: true, error: twoFactorCheck.reason };
        }

        // 3. Validar código 2FA se fornecido
        if (code && twoFactorConfig.enabled && twoFactorConfig.secret) {
          const validTotp = validateTotpCode(twoFactorConfig.secret, code);
          const backupResult = twoFactorConfig.backupCodes
            ? validateBackupCode(twoFactorConfig.backupCodes, code)
            : { valid: false, remainingCodes: [] };

          if (!validTotp && !backupResult.valid) {
            const error = 'Código 2FA inválido';
            setError(error);
            return { ok: false, error };
          }

          // Atualizar backup codes se foi usado um
          if (backupResult.valid) {
            setTwoFactorConfig({
              ...twoFactorConfig,
              backupCodes: backupResult.remainingCodes,
            });

            // Salvar no Supabase
            const supabase = getSupabase();
            if (supabase) {
              await supabase
                .from('user_2fa_config')
                .update({ backup_codes: backupResult.remainingCodes })
                .eq('user_id', userId);
            }
          }
        }

        // 4. Análise de risco de fraude
        const riskAnalysis = analyzeTransactionRisk(wallet, {
          type: operation,
          amountCents,
        });

        if (riskAnalysis.shouldBlock) {
          // Registrar alerta no ledger
          let updatedWallet = wallet;
          for (const alert of riskAnalysis.alerts.filter((a) => a.blocked)) {
            updatedWallet = logFraudAlert(updatedWallet, alert, {
              type: operation,
              amountCents,
            });
          }
          onWalletUpdate(updatedWallet);

          // Salvar alerta no Supabase
          const supabase = getSupabase();
          if (supabase) {
            await supabase.from('fraud_alerts').insert({
              user_id: userId,
              risk_level: riskAnalysis.riskLevel,
              reason: riskAnalysis.alerts[0]?.reason || 'Transação bloqueada',
              blocked: true,
              operation_type: operation,
              amount_cents: amountCents,
              metadata: { alerts: riskAnalysis.alerts },
            });
          }

          const error = `Transação bloqueada: ${riskAnalysis.alerts[0]?.reason}`;
          setError(error);
          return { ok: false, error };
        }

        // 5. Operação aprovada - executar
        // (A lógica real da operação seria chamada aqui)
        console.log('[useSecureWallet] Operação aprovada:', operation, amountCents);

        // 6. Backup automático após operação importante
        if (amountCents > 10_000) {
          await backupWalletToSupabase(wallet, userId);
          setLastBackupAt(new Date().toISOString());
        }

        return { ok: true };
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : 'Erro desconhecido';
        setError(errorMsg);
        return { ok: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [wallet, userId, twoFactorConfig, onWalletUpdate],
  );

  const enable2FA = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { enable2FA: enable2FAFn } = await import('./twoFactorAuth');
      const result = enable2FAFn();

      // Salvar no Supabase
      const supabase = getSupabase();
      if (!supabase) {
        return { ok: false, error: 'Supabase não configurado' };
      }

      const { error: dbError } = await supabase.from('user_2fa_config').upsert({
        user_id: userId,
        enabled: true,
        secret: result.secret,
        backup_codes: result.backupCodes,
        enabled_at: new Date().toISOString(),
      });

      if (dbError) {
        setError(dbError.message);
        return { ok: false, error: dbError.message };
      }

      setTwoFactorConfig({
        enabled: true,
        secret: result.secret,
        backupCodes: result.backupCodes,
        enabledAt: new Date().toISOString(),
      });

      return { ok: true, ...result };
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Erro ao habilitar 2FA';
      setError(errorMsg);
      return { ok: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const disable2FA = useCallback(
    async (code: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const { disable2FA: disable2FAFn } = await import('./twoFactorAuth');
        const result = disable2FAFn(twoFactorConfig, code);

        if (!result.ok) {
          setError(result.error || 'Erro ao desabilitar 2FA');
          return result;
        }

        // Atualizar no Supabase
        const supabase = getSupabase();
        if (supabase) {
          await supabase
            .from('user_2fa_config')
            .update({ enabled: false, secret: null, backup_codes: null })
            .eq('user_id', userId);
        }

        setTwoFactorConfig({ enabled: false });
        return { ok: true };
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : 'Erro ao desabilitar 2FA';
        setError(errorMsg);
        return { ok: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [userId, twoFactorConfig],
  );

  const backupNow = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await backupWalletToSupabase(wallet, userId);
      if (result.ok) {
        setLastBackupAt(new Date().toISOString());
      } else {
        setError(result.error || 'Erro ao fazer backup');
      }
      return result;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Erro ao fazer backup';
      setError(errorMsg);
      return { ok: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, [wallet, userId]);

  const checkSecurity = useCallback(() => {
    return checkCooldown(wallet);
  }, [wallet]);

  return {
    wallet,
    twoFactorConfig,
    isLoading,
    error,
    executeSecureOperation,
    enable2FA,
    disable2FA,
    backupNow,
    checkSecurity,
  };
}
