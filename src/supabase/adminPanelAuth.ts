/**
 * Gate de autenticação do painel admin.
 * Separado da sessão Supabase do jogador — mesmo que o admin esteja logado
 * no jogo com email diferente (ou deslogado), ele pode acessar /admin com
 * credencial própria.
 *
 * A sessão é armazenada em localStorage com TTL de 24h. A segurança real
 * das operações continua no DB via `is_admin()`.
 */

import { getSupabase } from '@/supabase/client';
import { encrypt, decrypt } from '@/lib/crypto';
import { generateCsrfToken } from '@/lib/csrf';

const STORAGE_KEY = 'olefoot_admin_panel_session_v1';
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2h (reduzido de 24h por segurança)
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 min de inatividade

// Chave de criptografia (em produção, vir de VITE_ADMIN_ENCRYPTION_KEY)
const ENCRYPTION_KEY = import.meta.env.VITE_ADMIN_ENCRYPTION_KEY || 'olefoot-default-key-change-in-production';

export interface AdminPanelSession {
  email: string;
  displayName?: string | null;
  role: string;
  loggedAt: number;
  expiresAt: number;
  lastActivityAt: number;
  csrfToken: string;
  twoFactorEnabled?: boolean;
}

export interface AdminPanelLoginResult {
  ok: boolean;
  session?: AdminPanelSession;
  error?: string;
}

export async function adminPanelLogin(email: string, password: string): Promise<AdminPanelLoginResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Supabase não configurado.' };

  // SEGURANÇA: Nunca logar senhas ou comprimento de senha
  console.log('[adminPanelLogin] tentativa de login:', { email });

  const { data, error } = await sb.rpc('admin_panel_login', {
    p_email: email,
    p_password: password,
    p_ip_address: null,
    p_user_agent: null,
    p_two_factor_code: null,
  });

  if (error) return { ok: false, error: `RPC: ${error.message}` };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !row.email) {
    return {
      ok: false,
      error: 'E-mail ou senha incorretos.',
    };
  }
  const now = Date.now();
  const session: AdminPanelSession = {
    email: row.email,
    displayName: row.display_name ?? null,
    role: row.role ?? 'admin',
    loggedAt: now,
    expiresAt: now + SESSION_TTL_MS,
    lastActivityAt: now,
    csrfToken: generateCsrfToken(),
    twoFactorEnabled: row.two_factor_enabled ?? false,
  };
  saveAdminPanelSession(session);
  return { ok: true, session };
}

export function saveAdminPanelSession(session: AdminPanelSession): void {
  try {
    const plaintext = JSON.stringify(session);
    encrypt(plaintext, ENCRYPTION_KEY).then((encrypted) => {
      localStorage.setItem(STORAGE_KEY, encrypted);
    }).catch((e) => {
      console.error('[adminPanelAuth] Failed to encrypt session:', e);
    });
  } catch { /* noop */ }
}

export async function loadAdminPanelSession(): Promise<AdminPanelSession | null> {
  try {
    const encrypted = localStorage.getItem(STORAGE_KEY);
    if (!encrypted) return null;

    // Tentar descriptografar (pode falhar se for sessão antiga não criptografada)
    let plaintext: string;
    try {
      // Sessão criptografada (novo formato)
      plaintext = await decrypt(encrypted, ENCRYPTION_KEY);
    } catch {
      // Fallback: sessão antiga não criptografada (migração)
      plaintext = encrypted;
    }

    const parsed = JSON.parse(plaintext) as AdminPanelSession;
    if (!parsed.email || !parsed.expiresAt) return null;

    const now = Date.now();

    // Verificar expiração absoluta
    if (now >= parsed.expiresAt) {
      clearAdminPanelSession();
      return null;
    }

    // Verificar timeout de inatividade
    const lastActivity = parsed.lastActivityAt || parsed.loggedAt;
    if (now - lastActivity >= IDLE_TIMEOUT_MS) {
      clearAdminPanelSession();
      return null;
    }

    // Atualizar lastActivityAt
    parsed.lastActivityAt = now;
    saveAdminPanelSession(parsed);

    return parsed;
  } catch {
    return null;
  }
}

// Tornar função async
export async function loadAdminPanelSessionAsync(): Promise<AdminPanelSession | null> {
  try {
    const encrypted = localStorage.getItem(STORAGE_KEY);
    if (!encrypted) return null;

    let plaintext: string;
    try {
      plaintext = await decrypt(encrypted, ENCRYPTION_KEY);
    } catch {
      plaintext = encrypted;
    }

    const parsed = JSON.parse(plaintext) as AdminPanelSession;
    if (!parsed.email || !parsed.expiresAt) return null;

    const now = Date.now();

    if (now >= parsed.expiresAt) {
      clearAdminPanelSession();
      return null;
    }

    const lastActivity = parsed.lastActivityAt || parsed.loggedAt;
    if (now - lastActivity >= IDLE_TIMEOUT_MS) {
      clearAdminPanelSession();
      return null;
    }

    parsed.lastActivityAt = now;
    saveAdminPanelSession(parsed);

    return parsed;
  } catch {
    return null;
  }
}

export function clearAdminPanelSession(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
}

export async function isAdminPanelSessionValid(): Promise<boolean> {
  const session = await loadAdminPanelSession();
  return session !== null;
}
