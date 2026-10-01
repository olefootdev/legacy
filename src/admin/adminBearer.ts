/**
 * O header que prova admin pro servidor: o Bearer da SESSÃO DO JOGO.
 *
 * As rotas /api/admin/* aceitam sessão de e-mail da lista de admins
 * (server/src/lib/adminAuth.ts). Os clientes de IA do painel chamavam sem
 * header nenhum — funcionava porque as rotas estavam abertas (P0 do raio-x
 * 30/09). Agora elas exigem admin, e este helper é o que os clientes anexam.
 */
import { getSupabase } from '@/supabase/client';

export async function adminBearer(): Promise<Record<string, string>> {
  const sb = getSupabase();
  if (!sb) return {};
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
