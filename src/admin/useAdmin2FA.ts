/**
 * Hook React para gerenciar 2FA do admin.
 * Integra com sistema de 2FA do wallet (reutiliza lógica).
 */

import { useState, useCallback } from 'react';
import { getSupabase } from '@/supabase/client';
import { generateTotpSecret, generateBackupCodes } from '@/wallet/twoFactorAuth';

export interface Admin2FASetup {
  secret: string;
  backupCodes: string[];
  qrCodeUrl: string;
}

export interface Admin2FAHook {
  isEnabled: boolean;
  isLoading: boolean;
  error: string | null;
  enable2FA: () => Promise<{ ok: boolean; setup?: Admin2FASetup; error?: string }>;
  disable2FA: (code: string) => Promise<{ ok: boolean; error?: string }>;
  verify2FA: (code: string) => Promise<{ ok: boolean; error?: string }>;
}

export function useAdmin2FA(adminEmail: string): Admin2FAHook {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enable2FA = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const secret = generateTotpSecret();
      const backupCodes = generateBackupCodes();

      // URL para QR code (compatível com Google Authenticator)
      const issuer = 'Olefoot Admin';
      const qrCodeUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(adminEmail)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;

      // Salvar no Supabase
      const sb = getSupabase();
      if (!sb) {
        return { ok: false, error: 'Supabase não configurado' };
      }

      const { error: dbError } = await sb.rpc('admin_panel_enable_2fa', {
        p_email: adminEmail,
        p_secret: secret,
        p_backup_codes: backupCodes,
      });

      if (dbError) {
        setError(dbError.message);
        return { ok: false, error: dbError.message };
      }

      setIsEnabled(true);
      return {
        ok: true,
        setup: { secret, backupCodes, qrCodeUrl },
      };
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Erro ao habilitar 2FA';
      setError(errorMsg);
      return { ok: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, [adminEmail]);

  const disable2FA = useCallback(
    async (code: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const sb = getSupabase();
        if (!sb) {
          return { ok: false, error: 'Supabase não configurado' };
        }

        const { error: dbError } = await sb.rpc('admin_panel_disable_2fa', {
          p_email: adminEmail,
          p_verification_code: code,
        });

        if (dbError) {
          setError(dbError.message);
          return { ok: false, error: dbError.message };
        }

        setIsEnabled(false);
        return { ok: true };
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : 'Erro ao desabilitar 2FA';
        setError(errorMsg);
        return { ok: false, error: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [adminEmail]
  );

  const verify2FA = useCallback(async (code: string) => {
    // Validação básica
    if (!/^\d{6}$/.test(code)) {
      return { ok: false, error: 'Código deve ter 6 dígitos' };
    }

    // TODO: Implementar validação TOTP real no backend
    return { ok: true };
  }, []);

  return {
    isEnabled,
    isLoading,
    error,
    enable2FA,
    disable2FA,
    verify2FA,
  };
}
