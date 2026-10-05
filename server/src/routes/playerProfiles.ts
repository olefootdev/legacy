import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { rateLimit } from '../lib/rateLimit.js';
import { semTabela, sincronizarFichas } from '../lib/smartProfile/sincronizar.js';

/**
 * SMART-PROFILE — as fichas do jogador (sessão do manager).
 *
 *   GET /api/player-profiles                     sincroniza com o elenco e devolve as fichas ativas
 *   GET /api/player-profiles/:playerId/memoria   o histórico (Memória) de um jogador
 *
 * O manager só vê as próprias fichas: o dono vem do JWT, nunca da URL.
 */
export const playerProfilesRoutes = new Hono();

async function donoDoPedido(authHeader: string | undefined): Promise<string | null> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb.auth.getUser(token);
  return error || !data.user ? null : data.user.id;
}

playerProfilesRoutes.get('/api/player-profiles', rateLimit(30), async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, erro: 'banco indisponível' }, 503);
  const dono = await donoDoPedido(c.req.header('Authorization'));
  if (!dono) return c.json({ ok: false, erro: 'sessão inválida' }, 401);
  try {
    const r = await sincronizarFichas(sb, dono);
    return c.json({
      ok: true,
      fichas: r.fichas,
      sync: { criadas: r.criadas, atualizadas: r.atualizadas, inativadas: r.inativadas, eventos: r.eventos },
    });
  } catch (e) {
    // Antes da migration rodar, o jogo segue normal: só não há ficha ainda.
    if (semTabela(e as { code?: string; message?: string })) return c.json({ ok: true, fichas: [], indisponivel: true });
    console.error('[player-profiles]', e instanceof Error ? e.message : e);
    return c.json({ ok: false, erro: 'falha ao montar as fichas' }, 500);
  }
});

playerProfilesRoutes.get('/api/player-profiles/:playerId/memoria', rateLimit(60), async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, erro: 'banco indisponível' }, 503);
  const dono = await donoDoPedido(c.req.header('Authorization'));
  if (!dono) return c.json({ ok: false, erro: 'sessão inválida' }, 401);
  const playerId = c.req.param('playerId') ?? '';
  if (!/^[\w-]{1,120}$/.test(playerId)) return c.json({ ok: false, erro: 'jogador inválido' }, 400);
  const { data, error } = await sb.from('player_profile_events')
    .select('tipo, dados, criado_em').eq('owner_id', dono).eq('player_id', playerId)
    .order('criado_em', { ascending: false }).limit(100);
  if (error) {
    if (semTabela(error)) return c.json({ ok: true, memoria: [], indisponivel: true });
    return c.json({ ok: false, erro: 'falha ao ler a memória' }, 500);
  }
  return c.json({ ok: true, memoria: data ?? [] });
});
