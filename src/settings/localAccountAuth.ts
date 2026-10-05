/**
 * Senha local (MVP cliente) — não substitui auth servidor / Supabase.
 * Armazena hash SHA-256 com salt em localStorage.
 */

import { L } from '@/i18n/L';

const STORAGE_KEY = 'olefoot-local-auth-v1';

interface StoredAuth {
  v: 1;
  salt: string;
  hash: string;
}

function readStored(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as StoredAuth;
    if (p?.v !== 1 || typeof p.salt !== 'string' || typeof p.hash !== 'string') return null;
    return p;
  } catch {
    return null;
  }
}

async function digestHex(value: string): Promise<string> {
  const enc = new TextEncoder().encode(value);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hasLocalPassword(): boolean {
  return readStored() !== null;
}

export async function setLocalPassword(plain: string): Promise<{ ok: boolean; error?: string }> {
  if (plain.length < 6) return { ok: false, error: L('A senha deve ter pelo menos 6 caracteres.', 'Password must be at least 6 characters.') };
  if (readStored()) return { ok: false, error: L('Já existe senha. Usa “Trocar senha”.', 'A password already exists. Use “Change password”.') };
  const salt = crypto.randomUUID();
  const hash = await digestHex(`${salt}:${plain}`);
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, salt, hash } satisfies StoredAuth));
  return { ok: true };
}

export async function changeLocalPassword(
  currentPlain: string,
  nextPlain: string,
): Promise<{ ok: boolean; error?: string }> {
  const st = readStored();
  if (!st) return { ok: false, error: L('Ainda não definiste senha local.', "You haven't set a local password yet.") };
  if (nextPlain.length < 6) return { ok: false, error: L('A nova senha deve ter pelo menos 6 caracteres.', 'New password must be at least 6 characters.') };
  const cur = await digestHex(`${st.salt}:${currentPlain}`);
  if (cur !== st.hash) return { ok: false, error: L('Senha atual incorreta.', 'Current password is incorrect.') };
  const salt = crypto.randomUUID();
  const hash = await digestHex(`${salt}:${nextPlain}`);
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, salt, hash } satisfies StoredAuth));
  return { ok: true };
}

export async function verifyLocalPassword(plain: string): Promise<boolean> {
  const st = readStored();
  if (!st) return false;
  const h = await digestHex(`${st.salt}:${plain}`);
  return h === st.hash;
}

/** Remove credencial local (não apaga o save do jogo). */
export function clearLocalPassword(): void {
  localStorage.removeItem(STORAGE_KEY);
}
