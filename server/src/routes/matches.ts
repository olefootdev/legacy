import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';

export const matchRoutes = new Hono();

async function resolveUser(authHeader: string | undefined): Promise<string | null> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

/**
 * POST /matches
 * Cria uma partida. Corpo: { mode, home_club_id, away_club_id? }
 * Auth: header `Authorization: Bearer <jwt>` obrigatório.
 */
matchRoutes.post('/matches', async (c) => {
  const userId = await resolveUser(c.req.header('Authorization'));
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

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

  // Verifica que home_club_id pertence ao usuário autenticado
  const { data: club } = await supabaseAdmin
    .from('clubs')
    .select('id')
    .eq('id', body.home_club_id)
    .eq('owner_id', userId)
    .maybeSingle();
  if (!club) return c.json({ error: 'Forbidden: home_club_id not owned by user' }, 403);

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
 * Insere um evento na partida. Corpo: { type, minute, payload? }
 * Auth: header `Authorization: Bearer <jwt>` obrigatório.
 */
matchRoutes.post('/matches/:id/events', async (c) => {
  const userId = await resolveUser(c.req.header('Authorization'));
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return c.json(
      { error: 'Supabase não configurado neste servidor (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY em server/.env).' },
      503,
    );
  }

  const matchId = c.req.param('id');

  // Verifica que a partida pertence ao usuário (via home_club owner)
  const { data: match } = await supabaseAdmin
    .from('matches')
    .select('id, home_club_id, clubs!inner(owner_id)')
    .eq('id', matchId)
    .maybeSingle();
  if (!match) return c.json({ error: 'Match not found' }, 404);
  const owner = (match as { clubs?: { owner_id?: string } }).clubs?.owner_id;
  if (!owner || owner !== userId) return c.json({ error: 'Forbidden' }, 403);

  const body = await c.req.json<{
    kind?: string;
    type?: string;
    minute?: number;
    payload?: Record<string, unknown>;
  }>();

  const kind = body.kind ?? body.type;
  if (!kind) {
    return c.json({ error: 'kind is required (alias: type)' }, 400);
  }

  const { data, error } = await supabaseAdmin
    .from('match_events')
    .insert({
      match_id: matchId,
      kind,
      minute: body.minute ?? 0,
      payload: body.payload ?? {},
    })
    .select('id, kind, minute, created_at')
    .single();

  if (error) {
    return c.json({ error: error.message }, 500);
  }
  return c.json(data, 201);
});
