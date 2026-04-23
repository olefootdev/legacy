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

const STORAGE_KEY = 'olefoot_admin_panel_session_v1';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export interface AdminPanelSession {
  email: string;
  displayName?: string | null;
  role: string;
  loggedAt: number;
  expiresAt: number;
}

export interface AdminPanelLoginResult {
  ok: boolean;
  session?: AdminPanelSession;
  error?: string;
}

export async function adminPanelLogin(email: string, password: string): Promise<AdminPanelLoginResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Supabase não configurado.' };
  console.log('[adminPanelLogin] enviando', { email, passwordLen: password.length });
  // DEBUG TEMPORÁRIO: chama a RPC espiã também pra ver o que o server está vendo.
  try {
    const dbg = await sb.rpc('admin_panel_login_debug', { p_email: email, p_password: password });
    console.log('[adminPanelLogin] DEBUG server-side:', dbg);
  } catch (e) {
    console.warn('[adminPanelLogin] debug RPC não existe:', e);
  }
  const { data, error } = await sb.rpc('admin_panel_login', {
    p_email: email,
    p_password: password,
  });
  console.log('[adminPanelLogin] resposta', { data, error });
  if (error) return { ok: false, error: `RPC: ${error.message}` };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !row.email) {
    return {
      ok: false,
      error: `E-mail ou senha incorretos. (data=${JSON.stringify(data)})`,
    };
  }
  const now = Date.now();
  const session: AdminPanelSession = {
    email: row.email,
    displayName: row.display_name ?? null,
    role: row.role ?? 'admin',
    loggedAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };
  saveAdminPanelSession(session);
  return { ok: true, session };
}

export function saveAdminPanelSession(session: AdminPanelSession): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch { /* noop */ }
}

export function loadAdminPanelSession(): AdminPanelSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminPanelSession;
    if (!parsed.email || !parsed.expiresAt) return null;
    if (Date.now() >= parsed.expiresAt) {
      clearAdminPanelSession();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearAdminPanelSession(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
}

export function isAdminPanelSessionValid(): boolean {
  return loadAdminPanelSession() !== null;
}
