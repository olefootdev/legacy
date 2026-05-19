/**
 * Welcome pack — gate Supabase.
 *
 * Histórico: o fluxo silencioso `tryGrantWelcomeGenesisPack` foi removido em
 * 2026-05-18. Hoje a entrega é 100% pela OnboardingCeremony (interativa).
 *
 * Este módulo expõe APENAS as 2 funções de integração com Supabase:
 *   • hasServerGrant() — confere se o user já recebeu (welcome_pack_grants table)
 *   • claimWelcomePackSlot() — registra grant atomicamente via RPC
 *
 * O gate de "já recebeu" agora é `userSettings.hasDoneOnboarding` (local +
 * cross-browser via manager_game_state.onboarding_flags) + welcome_pack_grants
 * server-side. A flag `welcomeGenesisPackVersion` foi descontinuada.
 */
import { getSupabase } from '@/supabase/client';

/**
 * Verifica server-side se este manager já recebeu o welcome pack.
 * Guard primário — independente do localStorage.
 */
export async function hasServerGrant(): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { data: sessData } = await sb.auth.getSession();
  const uid = sessData?.session?.user?.id ?? null;
  if (!uid) return false;
  const { data, error } = await sb
    .from('welcome_pack_grants')
    .select('user_id')
    .eq('user_id', uid)
    .maybeSingle();
  if (error) return false;
  return data !== null;
}

/**
 * Reserva atômica de 1 slot via RPC. Retorna null se Supabase off ou sem auth.
 *
 * Usa getSession() (lê do storage local, sincrónico após signUp) em vez de
 * getUser() (faz round-trip ao server e pode falhar logo depois do signup
 * por causa de propagação do token).
 */
export async function claimWelcomePackSlot(): Promise<
  { claimed: boolean; remaining: number } | null
> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: sessData } = await sb.auth.getSession();
  const uid = sessData?.session?.user?.id ?? null;
  if (!uid) {
    console.warn('[welcomePack] sem sessão após signup; não foi possível reservar slot.');
    return null;
  }
  const { data, error } = await sb.rpc('claim_welcome_pack', { p_manager_id: uid });
  if (error) {
    console.warn('[welcomePack] claim_welcome_pack:', error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    claimed: Boolean((row as { claimed: boolean }).claimed),
    remaining: Number((row as { remaining: number }).remaining ?? 0),
  };
}
