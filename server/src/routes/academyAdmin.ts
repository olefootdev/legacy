/**
 * Rotas admin do gacha de criação: revisar/selar templates de atributos
 * (banco que cresce) e ajustar as odds/tetos de raridade.
 *
 * Auth: header X-Admin-Token (requireAdminToken). Escrita via service role.
 */
import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAdminToken } from '../lib/adminAuth.js';

export const academyAdminRoutes = new Hono();

const ATTR_KEYS = [
  'passe', 'marcacao', 'velocidade', 'drible', 'finalizacao',
  'fisico', 'tatico', 'mentalidade', 'confianca', 'fairPlay',
] as const;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));

// ─── Templates ───────────────────────────────────────────────────────────────

/** GET — lista templates (draft primeiro, mais recentes no topo). */
academyAdminRoutes.get('/api/admin/academy/templates', async (c) => {
  const authErr = requireAdminToken(c);
  if (authErr) return authErr;
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin não configurado.' }, 503);

  const { data, error } = await sb
    .from('attribute_templates')
    .select('*')
    .order('status', { ascending: true }) // 'draft' < 'sealed'
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) {
    console.error('[academy-admin] list templates:', error.message);
    return c.json({ error: error.message }, 500);
  }
  return c.json({ ok: true, templates: data ?? [] });
});

interface PatchTemplateBody {
  id?: string;
  attributes?: Record<string, number>;
  overall?: number;
  status?: 'draft' | 'sealed';
  player_name?: string;
  bio_snippet?: string;
}

/** PATCH — edita/sela um template. Recalcula nada: admin é a verdade aqui. */
academyAdminRoutes.patch('/api/admin/academy/template', async (c) => {
  const authErr = requireAdminToken(c);
  if (authErr) return authErr;
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin não configurado.' }, 503);

  const body = await c.req.json<PatchTemplateBody>().catch(() => ({} as PatchTemplateBody));
  if (!body.id) return c.json({ error: 'id obrigatório.' }, 400);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.attributes && typeof body.attributes === 'object') {
    const attrs: Record<string, number> = {};
    for (const k of ATTR_KEYS) attrs[k] = clamp(Number(body.attributes[k] ?? 50), 1, 99);
    patch.attributes = attrs;
  }
  if (typeof body.overall === 'number') patch.overall = clamp(body.overall, 1, 99);
  if (body.status === 'draft' || body.status === 'sealed') patch.status = body.status;
  if (typeof body.player_name === 'string' && body.player_name.trim()) patch.player_name = body.player_name.trim();
  if (typeof body.bio_snippet === 'string') patch.bio_snippet = body.bio_snippet.trim();

  const { data, error } = await sb
    .from('attribute_templates')
    .update(patch)
    .eq('id', body.id)
    .select('*')
    .maybeSingle();
  if (error) {
    console.error('[academy-admin] patch template:', error.message);
    return c.json({ error: error.message }, 500);
  }
  return c.json({ ok: true, template: data });
});

// ─── Odds / config ─────────────────────────────────────────────────────────────

/** GET — config de odds/tetos por raridade. */
academyAdminRoutes.get('/api/admin/academy/draw-config', async (c) => {
  const authErr = requireAdminToken(c);
  if (authErr) return authErr;
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin não configurado.' }, 503);

  const { data, error } = await sb
    .from('academy_draw_config')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true, config: data ?? [] });
});

interface PatchConfigBody {
  rarity_tier?: string;
  probability_pct?: number;
  ovr_floor?: number;
  ovr_ceiling?: number;
}

/** PATCH — ajusta odds/tetos de uma raridade. */
academyAdminRoutes.patch('/api/admin/academy/draw-config', async (c) => {
  const authErr = requireAdminToken(c);
  if (authErr) return authErr;
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin não configurado.' }, 503);

  const body = await c.req.json<PatchConfigBody>().catch(() => ({} as PatchConfigBody));
  if (!body.rarity_tier) return c.json({ error: 'rarity_tier obrigatório.' }, 400);

  const patch: Record<string, unknown> = {};
  if (typeof body.probability_pct === 'number') patch.probability_pct = Math.max(0, body.probability_pct);
  if (typeof body.ovr_floor === 'number') patch.ovr_floor = clamp(body.ovr_floor, 1, 99);
  if (typeof body.ovr_ceiling === 'number') patch.ovr_ceiling = clamp(body.ovr_ceiling, 1, 99);
  if (Object.keys(patch).length === 0) return c.json({ error: 'nada pra atualizar.' }, 400);

  const { data, error } = await sb
    .from('academy_draw_config')
    .update(patch)
    .eq('rarity_tier', body.rarity_tier)
    .select('*')
    .maybeSingle();
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true, config: data });
});
