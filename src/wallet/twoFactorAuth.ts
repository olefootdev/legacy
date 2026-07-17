/**
 * 2FA — geração de segredo TOTP e códigos de backup.
 *
 * Consumidor real: `src/admin/useAdmin2FA.ts` (setup de 2FA do admin), que usa
 * `generateTotpSecret` e `generateBackupCodes`.
 *
 * ⚠️ NÃO EXISTE VALIDAÇÃO DE TOTP NESTE PROJETO. `validateTotpCode` foi removido
 * em 2026-07-16: era `/^\d{6}$/.test(code)` — aceitava QUALQUER 6 dígitos. Era
 * usado só pelo `useSecureWallet`, que nunca foi montado. Se um dia alguém for
 * checar código TOTP de verdade, use uma lib (otpauth/speakeasy) e valide no
 * SERVIDOR — não reintroduza validação no cliente.
 */

export interface TwoFactorConfig {
  enabled: boolean;
  secret?: string;
  backupCodes?: string[];
  enabledAt?: string;
}

/** Bytes aleatórios criptográficos. Math.random() é previsível e não serve p/ segredo. */
function randomBytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return buf;
}

/** Gera um secret TOTP (base32, 32 chars). */
export function generateTotpSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; // base32
  const bytes = randomBytes(32);
  let secret = '';
  for (let i = 0; i < 32; i++) {
    // 32 chars = 5 bits; & 31 mapeia sem viés (256 % 32 === 0).
    secret += chars[bytes[i]! & 31];
  }
  return secret;
}

/** Gera 10 códigos de backup de 8 dígitos. */
export function generateBackupCodes(): string[] {
  const codes: string[] = [];
  const bytes = new Uint32Array(10);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 10; i++) {
    codes.push((10_000_000 + (bytes[i]! % 90_000_000)).toString());
  }
  return codes;
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
