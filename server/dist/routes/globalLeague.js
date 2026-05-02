/**
 * Rotas da liga global — scheduler server-side.
 * Usa tabela admin_global_league_snapshot (JSONB) separada da
 * tabela global_league_state (schema relacional existente).
 */
import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
export const globalLeagueRoutes = new Hono();
const TABLE = 'admin_global_league_snapshot';
/** GET /global-league/state — retorna estado atual da liga */
globalLeagueRoutes.get('/state', async (c) => {
    const sb = getSupabaseAdmin();
    if (!sb)
        return c.json({ error: 'Supabase não configurado' }, 503);
    const { data, error } = await sb
        .from(TABLE)
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
        .from(TABLE)
        .upsert({ id: 'singleton', state: body.state }, { onConflict: 'id' });
    if (error)
        return c.json({ error: error.message }, 500);
    return c.json({ ok: true });
});
/** POST /global-league/tick — avança rodada automaticamente */
globalLeagueRoutes.post('/tick', async (c) => {
    const sb = getSupabaseAdmin();
    if (!sb)
        return c.json({ error: 'Supabase não configurado' }, 503);
    const { data, error } = await sb
        .from(TABLE)
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
    if (currentRound.status === 'scheduled' && currentRound.scheduledKickoffMs && now >= currentRound.scheduledKickoffMs) {
        currentRound.status = 'live';
        currentRound.actualKickoffMs = now;
        updated = true;
    }
    if (currentRound.status === 'live' && currentRound.actualKickoffMs && now >= currentRound.actualKickoffMs + 60000) {
        currentRound.status = 'finished';
        currentRound.finishedAtMs = now;
        updated = true;
    }
    if (updated) {
        await sb.from(TABLE).update({ state, updated_at: new Date().toISOString() }).eq('id', 'singleton');
    }
    return c.json({ ok: true, updated, status: currentRound.status });
});
//# sourceMappingURL=globalLeague.js.map