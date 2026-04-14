import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';

export const matchRoutes = new Hono();

/**
 * POST /matches
 * Cria uma partida. Corpo: { mode, home_club_id, away_club_id? }
 *
 * Auth: espera header `Authorization: Bearer <jwt>`.
 * TODO: validar JWT via getSupabaseAdmin()?.auth.getUser(jwt) para produção.
 */
matchRoutes.post('/matches', async (c) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return c.json(
      { error: 'Supabase não configurado neste servidor (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY em server/.env).' },
      503,
    );
  }

  const body = await c.req.json<{
    mode?: string;
    home_club_id?: string;
    away_club_id?: string;
  }>();

  const mode = body.mode;
  if (!mode || !['quick', 'auto', 'test2d'].includes(mode)) {
    return c.json({ error: 'mode must be quick | auto | test2d' }, 400);
  }
  if (!body.home_club_id) {
    return c.json({ error: 'home_club_id is required' }, 400);
  }

  const { data, error } = await supabaseAdmin
    .from('matches')
    .insert({
      mode,
      home_club_id: body.home_club_id,
      away_club_id: body.away_club_id ?? null,
      status: 'scheduled',
      started_at: new Date().toISOString(),
    })
    .select('id, mode, status, started_at')
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }
  return c.json(data, 201);
});

/**
 * POST /matches/:id/events
 * Insere um evento na partida.
 * Corpo: { type, minute, payload? }
 */
matchRoutes.post('/matches/:id/events', async (c) => {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return c.json(
      { error: 'Supabase não configurado neste servidor (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY em server/.env).' },
      503,
    );
  }

  const matchId = c.req.param('id');
  const body = await c.req.json<{
    type?: string;
    minute?: number;
    payload?: Record<string, unknown>;
  }>();

  if (!body.type) {
    return c.json({ error: 'type is required' }, 400);
  }

  const { data, error } = await supabaseAdmin
    .from('match_events')
    .insert({
      match_id: matchId,
      type: body.type,
      minute: body.minute ?? 0,
      payload: body.payload ?? {},
    })
    .select('id, type, minute, created_at')
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }
  return c.json(data, 201);
});
