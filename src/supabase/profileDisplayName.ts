import { getSupabase } from '@/supabase/client';

/**
 * `public.profiles.display_name` — primeiro nome do manager (cadastro), usado na saudação.
 */
export async function syncProfileManagerFirstName(firstName: string): Promise<void> {
  const trimmed = firstName.trim();
  if (!trimmed) return;
  const sb = getSupabase();
  if (!sb) return;
  const { data: auth } = await sb.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) return;

  const { data: row } = await sb.from('profiles').select('id').eq('id', userId).maybeSingle();
  if (row) {
    const { error } = await sb.from('profiles').update({ display_name: trimmed }).eq('id', userId);
    if (error) console.warn('[profileDisplayName] update:', error.message);
  } else {
    const { error } = await sb.from('profiles').insert({ id: userId, display_name: trimmed } as never);
    if (error) console.warn('[profileDisplayName] insert:', error.message);
  }
}

/**
 * Lê o primeiro nome no perfil remoto; se houver sessão e o campo estiver vazio,
 * grava o fallback local (backfill para contas antigas).
 */
export async function hydrateManagerFirstNameFromSupabase(localFallback: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: auth } = await sb.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) return null;

  const { data, error } = await sb.from('profiles').select('display_name').eq('id', userId).maybeSingle();
  if (error) {
    console.warn('[profileDisplayName] select:', error.message);
    return null;
  }
  let remote = typeof data?.display_name === 'string' ? data.display_name.trim() : '';
  if (!remote && localFallback.trim()) {
    await syncProfileManagerFirstName(localFallback);
    const { data: d2, error: e2 } = await sb.from('profiles').select('display_name').eq('id', userId).maybeSingle();
    if (e2) {
      console.warn('[profileDisplayName] select after sync:', e2.message);
      return null;
    }
    remote = typeof d2?.display_name === 'string' ? d2.display_name.trim() : '';
  }
  return remote || null;
}
