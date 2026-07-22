/**
 * resolveManagerName — descobre o NOME PÚBLICO do manager de um clube campeão.
 *
 * Usa o RPC `search_managers` (o mesmo da descoberta social), que devolve só
 * handles públicos (display_name / username) — nunca e-mail. Assim damos honra
 * ao manager campeão sem tocar em PII.
 */
import { searchManagers } from '@/supabase/friendships';

export async function resolveManagerName(clubName: string, clubShort?: string): Promise<string | null> {
  const name = clubName?.trim();
  if (!name || name.length < 3) return null;
  try {
    const results = await searchManagers(name, 5);
    const exact =
      results.find((r) => r.clubName === name && (!clubShort || r.clubShort === clubShort)) ??
      results.find((r) => r.clubName === name);
    return exact?.displayName || exact?.username || null;
  } catch {
    return null;
  }
}
