import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';

export const adminRoutes = new Hono();

/**
 * GET /api/admin/profiles
 * Lista todos os profiles do jogo usando service role (bypassa RLS).
 * Protegido por header X-Admin-Token (mesmo token do painel admin).
 */
adminRoutes.get('/profiles', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin não configurado.' }, 503);

  const { data, error } = await sb
    .from('profiles')
    .select('id, display_name, club_name, club_short, created_at, updated_at, onboarding_data, referred_by_code')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[admin/profiles]', error.message);
    return c.json({ error: error.message }, 500);
  }

  return c.json(data ?? []);
});
