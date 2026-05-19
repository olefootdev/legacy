/**
 * Cliente de autenticação do jogo (Supabase email+senha).
 *
 * Fluxo:
 *   - signUp — finaliza cadastro; cria user no auth.users, deixa sessão ativa.
 *   - signIn — login cross-device com email+senha.
 *   - saveOnboarding — grava display_name, club, onboarding_data no profiles.
 *   - fetchOnboarding — hidrata Zustand após signIn.
 */

import { getSupabase } from '@/supabase/client';
import type { UserSettings } from '@/game/types';
import type { FormationSchemeId } from '@/match-engine/types';

export interface GameSignUpInput {
  email: string;
  password: string;
  managerProfile: NonNullable<UserSettings['managerProfile']>;
  favoriteRealTeam: UserSettings['favoriteRealTeam'];
  clubName: string;
  clubShort: string;
  formationScheme: FormationSchemeId;
  /** Código de indicação normalizado (6-8 chars A–Z/0–9) ou null. */
  referredByCode?: string | null;
  /** Perfil do usuário: apaixonado, novo_talento, atleta_atuacao, profissional, midia, ex_jogador */
  userProfile?: string | null;
}

export interface OnboardingPayload {
  managerProfile: NonNullable<UserSettings['managerProfile']>;
  favoriteRealTeam: UserSettings['favoriteRealTeam'];
  formationScheme: FormationSchemeId;
  userProfile?: string | null;
}

export async function signUpWithEmail(input: GameSignUpInput): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Supabase não configurado.' };
  const { data, error } = await sb.auth.signUp({
    email: input.email.trim(),
    password: input.password,
  });
  if (error) return { ok: false, error: error.message };
  if (!data?.user) return { ok: false, error: 'Conta criada, confirma teu e-mail e tenta login.' };
  const saveErr = await saveOnboardingProfile({
    displayName: input.managerProfile.firstName.trim(),
    clubName: input.clubName.trim(),
    clubShort: input.clubShort.trim().toUpperCase().slice(0, 6),
    onboarding: {
      managerProfile: input.managerProfile,
      favoriteRealTeam: input.favoriteRealTeam,
      formationScheme: input.formationScheme,
      userProfile: input.userProfile ?? null,
    },
    referredByCode: input.referredByCode ?? null,
  });
  if (saveErr) return { ok: false, error: saveErr };
  return { ok: true };
}

export async function signInWithEmail(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Supabase não configurado.' };
  const { error } = await sb.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function sendPasswordResetEmail(email: string): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Supabase não configurado.' };
  const redirectTo = `${window.location.origin}/reset-password`;
  const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateUserPassword(newPassword: string): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Supabase não configurado.' };
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function checkEmailExists(email: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { data, error } = await sb.rpc('check_email_exists', { p_email: email.trim() });
  if (error) {
    console.warn('[auth] checkEmailExists:', error.message);
    return false;
  }
  return Boolean(data);
}

/**
 * Logout canônico: flush persist → reset gates → signOut → limpa localStorage.
 * Deve ser a ÚNICA função de logout chamada em todo o app.
 */
export async function signOutGame(): Promise<void> {
  const { flushAllPersistence } = await import('@/game/flushPersistence');
  const { resetSquadHydrationDone, resetGameStateHydration } = await import('@/game/store');
  await flushAllPersistence();
  resetGameStateHydration();
  resetSquadHydrationDone();
  const sb = getSupabase();
  if (sb) {
    try { await sb.auth.signOut(); } catch { /* noop */ }
  }
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('olefoot'))
      .forEach((k) => localStorage.removeItem(k));
  } catch { /* noop */ }
}

export async function saveOnboardingProfile(input: {
  displayName: string;
  clubName: string;
  clubShort: string;
  onboarding: OnboardingPayload;
  referredByCode?: string | null;
}): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { error } = await sb.rpc('save_onboarding_profile', {
    p_display_name: input.displayName,
    p_club_name: input.clubName,
    p_club_short: input.clubShort,
    p_onboarding_data: input.onboarding,
    p_referred_by_code: input.referredByCode ?? null,
  });
  return error ? error.message : null;
}

export interface LoadedOnboarding {
  displayName: string | null;
  clubName: string | null;
  clubShort: string | null;
  onboarding: OnboardingPayload | null;
}

export async function fetchOnboardingProfile(): Promise<LoadedOnboarding | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('get_my_onboarding_profile');
  if (error) {
    console.warn('[auth] fetchOnboardingProfile:', error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    displayName: row.display_name ?? null,
    clubName: row.club_name ?? null,
    clubShort: row.club_short ?? null,
    onboarding: row.onboarding_data ?? null,
  };
}
