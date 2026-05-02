/**
 * Rotas da liga global — scheduler server-side.
 * O servidor é a fonte de verdade para rodadas automáticas.
 * Admin controla via painel, servidor executa.
 */
import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
export const globalLeagueRoutes = new Hono();
/** GET /global-league/state — retorna estado atual da liga */
globalLeagueRoutes.get('/state', async (c) => {
    const sb = getSupabaseAdmin();
    if (!sb)
        return c.json({ error: 'Supabase não configurado' }, 503);
    const { data, error } = await sb
        .from('global_league_state')
        .select('state, updated_at')
        .eq('id', 'singleton')
        .maybeSingle();
    if (error)
        return c.json({ error: error.message }, 500);
    if (!data)
        return c.json({ state: null });
    return c.json({ state: data.state, updatedAt: data.updated_at });
});
/** POST /global-league/state — persiste estado (chamado pelo admin) */
globalLeagueRoutes.post('/state', async (c) => {
    const sb = getSupabaseAdmin();
    if (!sb)
        return c.json({ error: 'Supabase não configurado' }, 503);
    const body = await c.req.json();
    if (!body?.state)
        return c.json({ error: 'state obrigatório' }, 400);
    const { error } = await sb
        .from('global_league_state')
        .upsert({ id: 'singleton', state: body.state }, { onConflict: 'id' });
    if (error)
        return c.json({ error: error.message }, 500);
    return c.json({ ok: true });
});
/** POST /global-league/tick — avança rodada automaticamente (chamado por cron/pg_cron) */
globalLeagueRoutes.post('/tick', async (c) => {
    const sb = getSupabaseAdmin();
    if (!sb)
        return c.json({ error: 'Supabase não configurado' }, 503);
    const { data, error } = await sb
        .from('global_league_state')
        .select('state')
        .eq('id', 'singleton')
        .maybeSingle();
    if (error || !data?.state)
        return c.json({ skipped: true, reason: 'sem estado' });
    const state = data.state;
    const currentRound = state.currentRound;
    if (!currentRound)
        return c.json({ skipped: true, reason: 'sem rodada' });
    const now = Date.now();
    let updated = false;
    // Auto-iniciar rodada agendada
    if (currentRound.status === 'scheduled' && currentRound.scheduledKickoffMs && now >= currentRound.scheduledKickoffMs) {
        currentRound.status = 'live';
        currentRound.actualKickoffMs = now;
        updated = true;
    }
    // Auto-finalizar rodada ao vivo após 60s
    if (currentRound.status === 'live' && currentRound.actualKickoffMs && now >= currentRound.actualKickoffMs + 60000) {
        currentRound.status = 'finished';
        currentRound.finishedAtMs = now;
        updated = true;
    }
    if (updated) {
        await sb
            .from('global_league_state')
            .update({ state, updated_at: new Date().toISOString() })
            .eq('id', 'singleton');
    }
    return c.json({ ok: true, updated, status: currentRound.status });
});
//# sourceMappingURL=globalLeague.js.map