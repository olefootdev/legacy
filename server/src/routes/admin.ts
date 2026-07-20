import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAdminToken } from '../lib/adminAuth.js';

export const adminRoutes = new Hono();

/**
 * GATE DE ADMIN EM TUDO DESTE ROUTER.
 *
 * Estava só no comentário: `/profiles` dizia "protegido por X-Admin-Token" mas
 * não chamava o guard, e o mount em index.ts não tem middleware. Resultado: a
 * rota respondia 200 pra qualquer um, expondo nome, e-mail e telefone de 73
 * usuários. Como middleware, rota nova neste arquivo já nasce protegida.
 */
adminRoutes.use('*', async (c, next) => {
  const authErr = await requireAdminToken(c);
  if (authErr) return authErr;
  await next();
});

/**
 * GET /api/admin/profiles
 * Lista todos os profiles do jogo usando service role (bypassa RLS).
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

// ═══════════════════════════════════════════════════════════════════════════
// CONTRIBUIÇÕES DAS LENDAS — correção, história em áudio, pedido de card
//
// Sem tabela nem RPC novos: service role lê `legend_contributions` direto.
// O áudio mora em bucket PRIVADO; devolvemos signed URL de curta duração em
// vez de tornar o bucket público — a voz do atleta não vira link eterno.
// ═══════════════════════════════════════════════════════════════════════════

/** GET /api/admin/legend-contributions?status=pendente */
adminRoutes.get('/legend-contributions', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin não configurado.' }, 503);

  const status = c.req.query('status');
  let q = sb
    .from('legend_contributions')
    .select('id, kind, user_id, legacy_player_id, message, audio_path, payload, status, admin_note, created_at, reviewed_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (status && status !== 'todas') q = q.eq('status', status);

  const { data, error } = await q;
  if (error) {
    console.error('[admin/legend-contributions]', error.message);
    return c.json({ error: error.message }, 500);
  }

  const rows = data ?? [];

  // Nome do card e do autor, pra não mostrar só uuid na tela.
  const cardIds = [...new Set(rows.map((r) => r.legacy_player_id).filter(Boolean))] as string[];
  const cards = cardIds.length
    ? (await sb.from('legacy_players').select('id, name').in('id', cardIds)).data ?? []
    : [];
  const cardName = new Map(cards.map((x) => [x.id as string, x.name as string]));

  const out = await Promise.all(
    rows.map(async (r) => {
      let audioUrl: string | null = null;
      if (r.audio_path) {
        const { data: signed } = await sb.storage
          .from('legend-stories')
          .createSignedUrl(r.audio_path as string, 60 * 60); // 1h
        audioUrl = signed?.signedUrl ?? null;
      }
      let authorEmail: string | null = null;
      try {
        const { data: u } = await sb.auth.admin.getUserById(r.user_id as string);
        authorEmail = u?.user?.email ?? null;
      } catch { /* autor sem conta legível */ }
      return { ...r, cardName: r.legacy_player_id ? cardName.get(r.legacy_player_id as string) ?? null : null, audioUrl, authorEmail };
    }),
  );

  return c.json(out);
});

/** POST /api/admin/legend-contribution-review  { id, status, adminNote? } */
adminRoutes.post('/legend-contribution-review', async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ error: 'Supabase admin não configurado.' }, 503);

  let body: { id?: number; status?: string; adminNote?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: 'JSON inválido' }, 400); }

  const id = Number(body.id);
  const status = String(body.status ?? '');
  if (!Number.isFinite(id) || !['pendente', 'aceita', 'recusada'].includes(status)) {
    return c.json({ error: 'id ou status inválido' }, 400);
  }

  const { error } = await sb
    .from('legend_contributions')
    .update({
      status,
      admin_note: body.adminNote?.trim() || null,
      reviewed_at: status === 'pendente' ? null : new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});
