/**
 * Códigos de indicação OLEFOOT: 6–8 caracteres alfanuméricos (A–Z, 2–9), sem especiais.
 * Mínimo 6 chars = 32^6 ≈ 1 bilhão de combinações, inviável para brute-force.
 * Usados em links olefoot.ai/CÓDIGO, vínculo de patrocinador e envio BRO por código.
 */

/** Caracteres legíveis (evita O/0 e I/1). */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** 6 a 8 caracteres, apenas letras e números após normalização. */
const CODE_PATTERN = /^[A-Z0-9]{6,8}$/;

/** Segmentos de URL de 1 nível que não podem ser interpretados como código de indicação. */
export const REFERRAL_PATH_RESERVED = new Set(
  [
    'admin',
    'login',
    'cadastro',
    'wallet',
    'team',
    'city',
    'store',
    'transfer',
    'match',
    'missions',
    'leagues',
    'profile',
    'config',
    'ranking',
    'r',
    'ref',
    'i',
    'invite',
    'api',
    'api-football',
    'brand',
    'public',
    'assets',
    'src',
    'vite',
  ].map((s) => s.toLowerCase()),
);

export const PENDING_REFERRER_SESSION_KEY = 'olefoot-pending-referrer-code';

export function normalizeReferralCode(raw: string): string | null {
  const s = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.length < 6 || s.length > 8) return null;
  if (!CODE_PATTERN.test(s)) return null;
  return s;
}

export function isValidReferralCode(raw: string): boolean {
  return normalizeReferralCode(raw) !== null;
}

export function isReservedInviteSegment(segment: string): boolean {
  return REFERRAL_PATH_RESERVED.has(segment.trim().toLowerCase());
}

export function generateRandomReferralCode(): string {
  const LENGTH = 8; // 32^8 ≈ 1 trilhão de combinações
  const bytes = new Uint8Array(LENGTH);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < LENGTH; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (let i = 0; i < LENGTH; i++) {
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return out;
}

export function readPendingReferrerCode(): string | null {
  try {
    const v = sessionStorage.getItem(PENDING_REFERRER_SESSION_KEY);
    return v ? normalizeReferralCode(v) : null;
  } catch {
    return null;
  }
}

export function setPendingReferrerCode(code: string): void {
  const n = normalizeReferralCode(code);
  if (!n) return;
  try {
    sessionStorage.setItem(PENDING_REFERRER_SESSION_KEY, n);
  } catch {
    /* private mode */
  }
}

export function clearPendingReferrerCode(): void {
  try {
    sessionStorage.removeItem(PENDING_REFERRER_SESSION_KEY);
  } catch {
    /* */
  }
}

export function inviteLinkForCode(code: string): string {
  const n = normalizeReferralCode(code);
  if (!n) return '';
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/${n}`;
  }
  return `/${n}`;
}
