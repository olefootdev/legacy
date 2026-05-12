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
import { requireAdminToken } from '../lib/adminAuth.js';
import { recoverStaleLiveRound, runGlobalLeagueCycle, enrollClubInGlobalLeague } from '../services/globalLeague/cycle.js';
import type { TeamRow } from '../services/globalLeague/types.js';

export const globalLeagueRoutes = new Hono();

interface ProfileRow {
  id: string;
  display_name: string | null;
  club_name: string | null;
  club_short: string | null;
  onboarding_data: unknown;
}

interface SquadRow {
  user_id: string;
  players: unknown;
  lineup: Record<string, string> | null;
}

function managerEmailFromProfile(profile: ProfileRow): string | null {
  const data = profile.onboarding_data as { managerProfile?: { email?: unknown } } | null;
  const email = data?.managerProfile?.email;
  return typeof email === 'string' && email.includes('@') ? email.trim().toLowerCase() : null;
}

function cleanShortName(value: string | null | undefined, fallback: string): string {
  const raw = (value || fallback || 'FC').replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase();
  return raw || 'FC';
}

function avgOverallFromSquad(squad?: SquadRow): number {
  if (!squad || !Array.isArray(squad.players)) return 42;
  const players = squad.players as Array<{ id?: string; attrs?: Record<string, unknown> }>;
  const lineupIds = Object.values(squad.lineup ?? {});
  const selected = lineupIds.length > 0
    ? lineupIds.map(id => players.find(p => p.id === id)).filter((p): p is { attrs?: Record<string, unknown> } => !!p)
    : players;
  const ovrs = selected
    .map((p) => {
      const attrs = p.attrs ?? {};
      const nums = Object.values(attrs).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
      if (nums.length === 0) return null;
      return Math.round(nums.reduce((sum, n) => sum + n, 0) / nums.length);
    })
    .filter((n): n is number => n != null);
  if (ovrs.length === 0) return 42;
  return Math.max(40, Math.min(99, Math.round(ovrs.reduce((sum, n) => sum + n, 0) / ovrs.length)));
}

function teamFromProfile(profile: ProfileRow, squad?: SquadRow, existing?: TeamRow): TeamRow {
  const managerId = managerEmailFromProfile(profile) ?? profile.id;
  const clubName = profile.club_name?.trim() || profile.display_name?.trim() || 'Olefoot FC';
  const clubShort = cleanShortName(profile.club_short, clubName);
  const base: TeamRow = existing ?? {
    id: 'gt_' + managerId.replace(/[^a-z0-9]/gi, '_'),
    manager_id: managerId,
    club_name: clubName,
    club_short: clubShort,
    overall: avgOverallFromSquad(squad),
    division: null,
    position: null,
    previous_position: null,
    playoff_points: 0,
    playoff_matches_played: 0,
    playoff_wins: 0,
    playoff_draws: 0,
    playoff_losses: 0,
    playoff_goals_for: 0,
    playoff_goals_against: 0,
    points: 0,
    matches_played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals_for: 0,
    goals_against: 0,
    goal_difference: 0,
    recent_form: [],
    injury_modifier: 0,
    injury_rounds_remaining: 0,
    yellow_card_count: 0,
    suspension_rounds_remaining: 0,
    all_time_points: 0,
    all_time_matches_played: 0,
    all_time_wins: 0,
    all_time_draws: 0,
    all_time_losses: 0,
    all_time_goals_for: 0,
    all_time_goals_against: 0,
    all_time_seasons_played: 0,
  };

  return {
    ...base,
    manager_id: managerId,
    club_name: clubName,
    club_short: clubShort,
    overall: avgOverallFromSquad(squad) || base.overall,
  };
}

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
  const forbidden = requireAdminToken(c);
  if (forbidden) return forbidden;
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
  const forbidden = requireAdminToken(c);
  if (forbidden) return forbidden;
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase não configurado' }, 503);

  const body = await c.req.json().catch(() => null);
  if (!body?.seasonName) {
    return c.json({ error: 'seasonName é obrigatório' }, 400);
  }

  const seasonName: string = String(body.seasonName);
  const durationDays: number = Number(body.durationDays ?? 10);
  const slots: string[] = Array.isArray(body.slots)
    ? body.slots.map(String)
    : ['05:30', '11:00', '15:00', '19:00', '21:30'];
  const slotDurationMin: number = Number(body.slotDurationMin ?? 30);
  const minTeamsRequired: number = Number(body.minTeamsRequired ?? 2);
  // fullReset=true zera all_time_* + division pra estreia oficial. Default (false)
  // preserva carry-over de all-time e divisão entre seasons da mesma competição.
  const fullReset: boolean = body.fullReset === true;
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
        await sb.from('global_league_events').delete().in('fixture_id', fixtureIds);
        await sb.from('global_league_fixtures').delete().in('id', fixtureIds);
      }

      // Deletar rodadas
      await sb.from('global_league_rounds').delete().in('id', roundIds);
    }
  }

  // 2. Reset dos times. Stats de season e mecânicas (form, amarelos, suspensão,
  //    lesões) SEMPRE zeram entre seasons. fullReset adicionalmente zera
  //    all_time_* e division (estreia oficial / nuke total).
  const resetPayload: Record<string, unknown> = {
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
    recent_form: [],
    yellow_card_count: 0,
    suspension_rounds_remaining: 0,
    injury_modifier: 0,
    injury_rounds_remaining: 0,
  };
  if (fullReset) {
    Object.assign(resetPayload, {
      division: null,
      all_time_points: 0,
      all_time_matches_played: 0,
      all_time_wins: 0,
      all_time_draws: 0,
      all_time_losses: 0,
      all_time_goals_for: 0,
      all_time_goals_against: 0,
      all_time_seasons_played: 0,
    });
  }
  const { error: resetError } = await sb
    .from('global_league_teams')
    .update(resetPayload)
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
      competition_id: `competition_${Date.now()}`,
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

  console.log(`[start-season] Nova temporada iniciada: ${seasonId} — ${seasonName}${fullReset ? ' (FULL RESET)' : ''}`);
  return c.json({ ok: true, seasonId, seasonName, fullReset });
});

/**
 * POST /enroll — inscreve um clube na liga global.
 * Body: { managerId, clubName, clubShort, overall }
 * Idempotente via onConflict: manager_id.
 */
/**
 * POST /recover-stale-live — tenta destravar uma rodada que ficou live.
 */
globalLeagueRoutes.post('/recover-stale-live', async (c) => {
  const forbidden = requireAdminToken(c);
  if (forbidden) return forbidden;
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase não configurado' }, 503);
  const result = await recoverStaleLiveRound(sb);
  return c.json(result ?? {
    ok: true,
    step: 'recover-stale-live',
    skipped: true,
    reason: 'no-stale-live-round',
  });
});

/**
 * POST /backfill-teams — cadastra/atualiza na Liga Global todos os perfis com clube.
 * Preserva estatísticas de times existentes e usa manager_squad para estimar OVR.
 */
globalLeagueRoutes.post('/backfill-teams', async (c) => {
  const forbidden = requireAdminToken(c);
  if (forbidden) return forbidden;
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase não configurado' }, 503);

  const [
    { data: profiles, error: profilesErr },
    { data: squads, error: squadsErr },
    { data: existing, error: teamsErr },
  ] = await Promise.all([
    sb.from('profiles').select('id, display_name, club_name, club_short, onboarding_data').order('created_at', { ascending: true }),
    sb.from('manager_squad').select('user_id, players, lineup'),
    sb.from('global_league_teams').select('*'),
  ]);

  if (profilesErr) return c.json({ error: profilesErr.message }, 500);
  if (squadsErr) return c.json({ error: squadsErr.message }, 500);
  if (teamsErr) return c.json({ error: teamsErr.message }, 500);

  const squadByUser = new Map((squads ?? []).map((s) => [(s as SquadRow).user_id, s as SquadRow]));
  const existingByManager = new Map(((existing as TeamRow[] | null) ?? []).map((t) => [t.manager_id, t]));
  const teams = ((profiles ?? []) as ProfileRow[])
    .filter(p => !!p.club_name?.trim())
    .map((profile) => {
      const managerId = managerEmailFromProfile(profile) ?? profile.id;
      return teamFromProfile(profile, squadByUser.get(profile.id), existingByManager.get(managerId));
    });

  if (teams.length > 0) {
    const { error } = await sb.from('global_league_teams').upsert(teams as never[], { onConflict: 'manager_id' });
    if (error) return c.json({ error: error.message }, 500);
  }

  return c.json({
    ok: true,
    profiles: (profiles ?? []).length,
    upserted: teams.length,
    existing: existingByManager.size,
    insertedOrRecovered: teams.filter(t => !existingByManager.has(t.manager_id)).length,
  });
});

globalLeagueRoutes.post('/enroll', async (c) => {
  const forbidden = requireAdminToken(c);
  if (forbidden) return forbidden;
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
