import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Tradução id ⇄ username pros painéis de admin.
 *
 * As tabelas da expansão referenciam auth.users, então o PostgREST não faz o
 * embed pra profiles — a rota busca as linhas e traduz os ids aqui, num
 * request só. 🔒 Devolve username/display_name, NUNCA e-mail: o admin já
 * vazou PII uma vez (ver project_admin_api_pii_leak) e não repete.
 */
export async function usernamesDe(
  sb: SupabaseClient,
  ids: Iterable<string>,
): Promise<Map<string, string>> {
  const unicos = [...new Set([...ids].filter(Boolean))];
  const mapa = new Map<string, string>();
  if (unicos.length === 0) return mapa;
  // Em lotes: o filtro `in` vai na URL e estoura com milhares de ids.
  for (let i = 0; i < unicos.length; i += 200) {
    const { data } = await sb
      .from('profiles')
      .select('id, username, display_name')
      .in('id', unicos.slice(i, i + 200));
    for (const p of data ?? []) {
      mapa.set(p.id as string, (p.username as string) || (p.display_name as string) || '');
    }
  }
  return mapa;
}

/** Resolve @username → id. null quando não existe. */
export async function idPorUsername(sb: SupabaseClient, username: string): Promise<string | null> {
  const limpo = username.trim().replace(/^@/, '');
  if (!limpo) return null;
  const { data } = await sb.from('profiles').select('id').ilike('username', limpo).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}
