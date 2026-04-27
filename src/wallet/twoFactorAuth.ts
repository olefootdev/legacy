/**
 * 2FA para operações financeiras sensíveis.
 * Usa TOTP (Time-based One-Time Password) compatível com Google Authenticator.
 */

import type { WalletState } from './types';

export interface TwoFactorConfig {
  enabled: boolean;
  secret?: string;
  backupCodes?: string[];
  enabledAt?: string;
}

export interface TwoFactorChallenge {
  required: boolean;
  reason?: string;
}

/**
 * Operações que requerem 2FA quando habilitado.
 */
export type SensitiveOperation =
  | 'WITHDRAW_BRO'
  | 'SWAP_OLEXP_TO_SPOT'
  | 'TRANSFER_TO_USER'
  | 'CHANGE_KYC'
  | 'DISABLE_2FA';

/**
 * Verifica se uma operação requer 2FA.
 */
export function requires2FA(
  operation: SensitiveOperation,
  twoFactorConfig: TwoFactorConfig,
  amountCents?: number,
): TwoFactorChallenge {
  if (!twoFactorConfig.enabled) {
    return { required: false };
  }

  // Sempre requer 2FA para estas operações
  const alwaysRequire: SensitiveOperation[] = ['CHANGE_KYC', 'DISABLE_2FA'];
  if (alwaysRequire.includes(operation)) {
    return { required: true, reason: 'Operação sensível de segurança' };
  }

  // Requer 2FA para valores altos (> 1000 BRO = 100k centavos)
  if (amountCents && amountCents > 100_000) {
    return { required: true, reason: 'Valor alto (> 1000 BRO)' };
  }

  // Requer 2FA para todas as operações financeiras quando habilitado
  return { required: true, reason: '2FA habilitado' };
}

/**
 * Gera um secret TOTP (base32) para configuração inicial.
 * Em produção, usar biblioteca crypto segura (ex: otpauth, speakeasy).
 */
export function generateTotpSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  for (let i = 0; i < 32; i++) {
    secret += chars[Math.floor(Math.random() * chars.length)];
  }
  return secret;
}

/**
 * Gera códigos de backup (8 dígitos cada, 10 códigos).
 */
export function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const code = Math.floor(10000000 + Math.random() * 90000000).toString();
    codes.push(code);
  }
  return codes;
}

/**
 * Valida um código TOTP (6 dígitos).
 * Em produção, implementar verificação real com biblioteca TOTP.
 * Esta é uma validação mock para estrutura.
 */
export function validateTotpCode(secret: string, code: string): boolean {
  // TODO: Implementar verificação TOTP real com biblioteca (speakeasy, otpauth)
  // Por agora, aceita qualquer código de 6 dígitos para não bloquear dev
  return /^\d{6}$/.test(code);
}

/**
 * Valida um código de backup e o marca como usado.
 */
export function validateBackupCode(
  backupCodes: string[],
  code: string,
): { valid: boolean; remainingCodes: string[] } {
  const idx = backupCodes.indexOf(code);
  if (idx === -1) {
    return { valid: false, remainingCodes: backupCodes };
  }

  // Remove o código usado
  const remainingCodes = backupCodes.filter((c) => c !== code);
  return { valid: true, remainingCodes };
}

/**
 * Habilita 2FA para o usuário.
 */
export function enable2FA(): {
  secret: string;
  backupCodes: string[];
  qrCodeUrl: string;
} {
  const secret = generateTotpSecret();
  const backupCodes = generateBackupCodes();

  // URL para gerar QR code (compatível com Google Authenticator)
  const issuer = 'Olefoot';
  const accountName = 'user@olefoot'; // Em produção, usar email real
  const qrCodeUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;

  return { secret, backupCodes, qrCodeUrl };
}

/**
 * Desabilita 2FA (requer código válido).
 */
export function disable2FA(
  twoFactorConfig: TwoFactorConfig,
  code: string,
): { ok: boolean; error?: string } {
  if (!twoFactorConfig.enabled || !twoFactorConfig.secret) {
    return { ok: false, error: '2FA não está habilitado.' };
  }

  const validTotp = validateTotpCode(twoFactorConfig.secret, code);
  const backupResult = twoFactorConfig.backupCodes
    ? validateBackupCode(twoFactorConfig.backupCodes, code)
    : { valid: false, remainingCodes: [] };

  if (!validTotp && !backupResult.valid) {
    return { ok: false, error: 'Código inválido.' };
  }

  return { ok: true };
}
