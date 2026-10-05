/**
 * O manager por trás do pedido, pelo JWT do Supabase (header Authorization).
 * null = sem sessão ou sessão inválida. O dono vem sempre do token, nunca da URL.
 */
import { getSupabaseAdmin } from './supabaseAdmin.js';

export async function donoDaSessao(authHeader: string | undefined): Promise<string | null> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb.auth.getUser(token);
  return error || !data.user ? null : data.user.id;
}
