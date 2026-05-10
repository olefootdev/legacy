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
 * POST /start-season — inicia uma nova temporada.
 * Deleta fixtures/eventos/rodadas antigas, faz soft reset dos times,
 * e atualiza global_league_state com os novos parâmetros.
 * Body: { seasonName, durationDays, slots, slotDurationMin, minTeamsRequired }
 */
globalLeagueRoutes.post('/start-season', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase não configurado' }, 503);

  const body = await c.req.json().catch(() => null);
  if (!body?.seasonName) {
    return c.json({ error: 'seasonName é obrigatório' }, 400);
  }

  const seasonName: string = String(body.seasonName);
  const durationDays: number = Number(body.durationDays ?? 7);
  const slots: string[] = Array.isArray(body.slots)
    ? body.slots.map(String)
    : ['05:30', '11:00', '15:00', '19:00', '21:30'];
  const slotDurationMin: number = Number(body.slotDurationMin ?? 30);
  const minTeamsRequired: number = Number(body.minTeamsRequired ?? 2);
  const seasonId = `season_${Date.now()}`;

  // 1. Deletar fixtures e eventos da season atual
  const { data: stateData } = await sb
    .from('global_league_state')
    .select('season_id')
    .eq('id', 'current')
    .maybeSingle();

  if (stateData?.season_id) {
    // Buscar rodadas da season atual para deletar fixtures/eventos
    const { data: rounds } = await sb
      .from('global_league_rounds')
      .select('id')
      .eq('season_id', stateData.season_id);

    if (rounds && rounds.length > 0) {
      const roundIds = rounds.map((r: { id: string }) => r.id);

      // Deletar eventos das fixtures dessas rodadas
      const { data: fixtures } = await sb
        .from('global_league_fixtures')
        .select('id')
        .in('round_id', roundIds);

      if (fixtures && fixtures.length > 0) {
        const fixtureIds = fixtures.map((f: { id: string }) => f.id);
        await sb.from('global_league_fixture_events').delete().in('fixture_id', fixtureIds);
        await sb.from('global_league_fixtures').delete().in('id', fixtureIds);
      }

      // Deletar rodadas
      await sb.from('global_league_rounds').delete().in('id', roundIds);
    }
  }

  // 2. Soft reset dos times: zerar stats de temporada, preservar all-time e divisões
  const { error: resetError } = await sb
    .from('global_league_teams')
    .update({
      points: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goals_for: 0,
      goals_against: 0,
      goal_difference: 0,
      matches_played: 0,
      playoff_points: 0,
      playoff_wins: 0,
      playoff_draws: 0,
      playoff_losses: 0,
      playoff_goals_for: 0,
      playoff_goals_against: 0,
      playoff_matches_played: 0,
      position: null,
      previous_position: null,
    })
    .neq('id', '00000000-0000-0000-0000-000000000000'); // update all rows

  if (resetError) {
    console.error('[start-season] Erro ao resetar times:', resetError.message);
    return c.json({ error: `Erro ao resetar times: ${resetError.message}` }, 500);
  }

  // 3. Atualizar global_league_state
  const { error: stateError } = await sb
    .from('global_league_state')
    .upsert({
      id: 'current',
      status: 'waiting_teams',
      season_id: seasonId,
      season_name: seasonName,
      competition_started_at: new Date().toISOString(),
      competition_duration_days: durationDays,
      match_slots: slots,
      slot_duration_min: slotDurationMin,
      min_teams_required: minTeamsRequired,
      current_playoff_round: null,
      current_league_round: null,
    });

  if (stateError) {
    console.error('[start-season] Erro ao atualizar estado:', stateError.message);
    return c.json({ error: `Erro ao atualizar estado: ${stateError.message}` }, 500);
  }

  console.log(`[start-season] Nova temporada iniciada: ${seasonId} — ${seasonName}`);
  return c.json({ ok: true, seasonId, seasonName });
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

