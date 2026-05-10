/**
 * Rotas da liga global — proxy read-only para as tabelas relacionais.
 *
 * A Edge Function global-league-tick é autoritativa. Este server apenas
 * expõe endpoints de leitura para clientes que não têm acesso direto ao
 * Supabase (ex: integrações externas, admin CLI).
 *
 * A tabela admin_global_league_snapshot foi descontinuada — não é escrita
 * pela Edge Function e não reflete o estado real da liga.
 */
import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { runGlobalLeagueCycle, enrollClubInGlobalLeague } from '../services/globalLeague/cycle.js';

export const globalLeagueRoutes = new Hono();

/** GET /state — estado atual da liga (lê das tabelas relacionais) */
globalLeagueRoutes.get('/state', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase não configurado' }, 503);

  const { data, error } = await sb
    .from('global_league_state')
    .select('*')
    .eq('id', 'current')
    .maybeSingle();

  if (error) return c.json({ error: error.message }, 500);
  if (!data) return c.json({ state: null });
  return c.json({ state: data });
});

/** GET /teams — times cadastrados, ordenados por pontos */
globalLeagueRoutes.get('/teams', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase não configurado' }, 503);

  const { data, error } = await sb
    .from('global_league_teams')
    .select('*')
    .order('points', { ascending: false });

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ teams: data ?? [] });
});

/** GET /rounds — rodadas da season atual */
globalLeagueRoutes.get('/rounds', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase não configurado' }, 503);

  const { data: stateData } = await sb
    .from('global_league_state')
    .select('season_id')
    .eq('id', 'current')
    .maybeSingle();

  if (!stateData) return c.json({ rounds: [] });

  const { data, error } = await sb
    .from('global_league_rounds')
    .select('*')
    .eq('season_id', stateData.season_id)
    .order('scheduled_kickoff_ms', { ascending: true });

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ rounds: data ?? [] });
});

/**
 * POST /cycle — executa um tick do ciclo da liga global.
 * Idempotente: pode ser chamado a qualquer momento; só processa se houver
 * rodada scheduled com kickoff no passado.
 */
globalLeagueRoutes.post('/cycle', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase não configurado' }, 503);
  const result = await runGlobalLeagueCycle(sb);
  const status = result.ok ? 200 : 500;
  return c.json(result, status);
});

/**
 * POST /enroll — inscreve um clube na liga global.
 * Body: { managerId, clubName, clubShort, overall }
 * Idempotente via onConflict: manager_id.
 */
globalLeagueRoutes.post('/enroll', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase não configurado' }, 503);
  const body = await c.req.json().catch(() => null);
  if (!body?.managerId || !body?.clubName || !body?.clubShort || !body?.overall) {
    return c.json({ error: 'managerId, clubName, clubShort, overall são obrigatórios' }, 400);
  }
  const result = await enrollClubInGlobalLeague(sb, {
    managerId: String(body.managerId),
    clubName: String(body.clubName),
    clubShort: String(body.clubShort),
    overall: Number(body.overall),
  });
  return c.json(result, result.ok ? 200 : 500);
});

