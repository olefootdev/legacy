import { getSupabase } from '@/supabase/client';

/**
 * Gera username a partir de firstName + clubShort.
 * Ex.: "Jonhnes" + "OFC" → "jonhnes_ofc"
 */
export function computeUsername(firstName: string, clubShort: string): string {
  const cleanFirst = firstName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const cleanShort = clubShort
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  if (!cleanFirst || !cleanShort) return '';
  return `${cleanFirst}_${cleanShort}`;
}

/**
 * Verifica se as iniciais do clube já estão em uso por outro manager.
 * Retorna `true` se disponível, `false` se já existe.
 */
export async function checkClubShortAvailable(clubShort: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return true;
  const { data, error } = await sb.rpc('check_club_short_available', {
    p_club_short: clubShort.trim().toUpperCase(),
  });
  if (error) {
    console.warn('[managerUsername] checkClubShortAvailable:', error.message);
    return true;
  }
  return data === true;
}

/**
 * Busca um perfil pelo username (para adicionar amigo).
 * Retorna o perfil ou null se não existir.
 */
export async function findProfileByUsername(username: string): Promise<{
  id: string;
  username: string;
  displayName: string;
  clubName: string;
  clubShort: string;
} | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const clean = username.replace(/^@/, '').trim().toLowerCase();
  if (!clean) return null;
  const { data, error } = await sb.rpc('find_profile_by_username', {
    p_username: clean,
  });
  if (error) {
    console.warn('[managerUsername] findProfileByUsername:', error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name ?? '',
    clubName: row.club_name ?? '',
    clubShort: row.club_short ?? '',
  };
}

/**
 * Lê o username do próprio manager logado.
 */
export async function getMyUsername(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: auth } = await sb.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) return null;
  const { data, error } = await sb
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[managerUsername] getMyUsername:', error.message);
    return null;
  }
  return data?.username ?? null;
}
