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
 * Sigla LIVRE pro nome do clube (o banco não aceita duas iguais —
 * `profiles_club_short_unique`). Tenta as iniciais, as 3 primeiras letras,
 * 3 letras de dentro do nome e, por fim, a sigla com um número.
 */
export async function siglaLivre(nomeDoClube: string): Promise<string> {
  const palavras = nomeDoClube.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  const junto = palavras.join('');
  const iniciais = palavras.length >= 2 ? palavras.map((w) => w[0]).join('').slice(0, 4) : junto.slice(0, 3);
  const base = (iniciais.length >= 2 ? iniciais : (junto + 'FC').slice(0, 3));
  const candidatos = new Set<string>([base, junto.slice(0, 3), palavras.length >= 2 ? (palavras[0]!.slice(0, 2) + palavras[1]![0]) : junto.slice(0, 2) + junto.slice(-1)]);
  for (const c of candidatos) if (c.length >= 2 && (await checkClubShortAvailable(c))) return c;
  for (let n = 1; n <= 99; n++) {
    const c = `${base.slice(0, 3)}${n}`;
    if (await checkClubShortAvailable(c)) return c;
  }
  return `${base.slice(0, 2)}${Date.now() % 1000}`;
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
