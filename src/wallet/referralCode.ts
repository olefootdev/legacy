/**
 * Códigos de indicação OLEFOOT: 3–5 caracteres alfanuméricos (A–Z, 2–9), sem especiais.
 * Usados em links olefoot.ai/CÓDIGO, vínculo de patrocinador e envio BRO por código (MVP cliente).
 */

/** Caracteres legíveis (evita O/0 e I/1). */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** 3 a 5 caracteres, apenas letras e números após normalização. */
const CODE_PATTERN = /^[A-Z0-9]{3,5}$/;

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
  if (s.length < 3 || s.length > 5) return null;
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
  const bytes = new Uint8Array(5);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 5; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (let i = 0; i < 5; i++) {
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
