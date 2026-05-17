/**
 * Resolve a URL do brasão de um clube/seleção a partir do Supabase Storage.
 *
 * Os PNGs vivem no bucket público `crests` do projeto Supabase configurado
 * em VITE_SUPABASE_URL. Upload manual via Dashboard → Storage → crests.
 * Os IDs seguem a numeração do API-Sports.
 *
 * Mantemos o nome `localCrestUrl` por compatibilidade com callers — leia-se
 * "URL canônica do brasão" (resolvida do nosso storage, não do api-sports).
 */
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';

export function localCrestUrl(id: number): string {
  return `${SUPABASE_URL}/storage/v1/object/public/crests/${id}.png`;
}
