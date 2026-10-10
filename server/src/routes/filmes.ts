/**
 * PARTIDA VIVA — Fase 7: o filme no servidor (docs/PARTIDA-VIVA-PLANO.md §8).
 *
 *   POST /api/filme       — quem jogou manda o filme; se o adversário era o time
 *                           de outro manager, ele recebe a notificação.
 *   GET  /api/filmes      — os filmes da sessão: os que ela jogou e os que
 *                           jogaram CONTRA o time dela.
 *   GET  /api/filme/:id   — um filme (só pro dono ou pro adversário).
 *
 * A tabela `partidas_filme` é só do servidor (RLS fechada ao cliente).
 * Conferência pura em lib/filme.ts.
 */
import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { donoDaSessao } from '../lib/sessao.js';
import { rateLimit } from '../lib/rateLimit.js';
import {
  AVISOS_POR_ADVERSARIO_POR_DIA, AVISOS_POR_DIA, avisoDoAdversario, conferirFilme, elencoBate, type ResumoDoFilme,
} from '../lib/filme.js';

export const filmesRoutes = new Hono();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

filmesRoutes.post('/api/filme', rateLimit(12), async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false }, 503);
  const dono = await donoDaSessao(c.req.header('Authorization'));
  if (!dono) return c.json({ ok: false, erro: 'sessão inválida' }, 401);
  const conf = conferirFilme(await c.req.json().catch(() => null), dono);
  if (!conf.ok) return c.json({ ok: false, erro: conf.erro }, 400);

  // A partida existiu: o motor emitiu plano pra este dono com esta seed.
  const { data: plano } = await sb.from('quick_plans_emitidos')
    .select('id').eq('owner_id', dono).eq('seed', conf.seed).limit(1).maybeSingle();
  if (!plano) return c.json({ ok: false, erro: 'partida sem plano emitido' }, 403);

  // O adversário só vale se o time de fora do filme é o elenco dele.
  let adversario = conf.adversario;
  if (adversario) {
    const { data: elenco } = await sb.from('manager_squad').select('players').eq('user_id', adversario).maybeSingle();
    const ids = Array.isArray(elenco?.players) ? (elenco!.players as Array<{ id?: unknown }>).flatMap((p) => (typeof p?.id === 'string' ? [p.id] : [])) : [];
    if (!elencoBate(conf.filme, ids)) adversario = null;
  }

  const { data: gravado, error } = await sb.from('partidas_filme')
    .upsert({ dono, adversario, seed: conf.seed, resumo: conf.resumo, filme: conf.filme }, { onConflict: 'dono,seed', ignoreDuplicates: true })
    .select('id').maybeSingle();
  if (error) return c.json({ ok: false, erro: 'não gravou' }, 500);
  if (!gravado) {
    // Já existia (reenvio): devolve o mesmo id, sem avisar de novo.
    const { data: antigo } = await sb.from('partidas_filme').select('id').eq('dono', dono).eq('seed', conf.seed).maybeSingle();
    return c.json({ ok: true, id: antigo?.id ?? null, avisado: false });
  }

  let avisado = false;
  if (adversario) {
    const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const [{ count: doDia }, { count: doPar }] = await Promise.all([
      sb.from('partidas_filme').select('id', { count: 'exact', head: true }).eq('dono', dono).not('adversario', 'is', null).gte('criado_em', desde),
      sb.from('partidas_filme').select('id', { count: 'exact', head: true }).eq('dono', dono).eq('adversario', adversario).gte('criado_em', desde),
    ]);
    if ((doDia ?? 0) <= AVISOS_POR_DIA && (doPar ?? 0) <= AVISOS_POR_ADVERSARIO_POR_DIA) {
      const { titulo, mensagem } = avisoDoAdversario(conf.resumo);
      const { error: eAviso } = await sb.from('notifications').insert({
        user_id: adversario, category: 'COMPETIÇÃO', title: titulo, message: mensagem,
        link: `/match/filme/s/${gravado.id}`, payload: { tipo: 'filme_do_adversario', filme: gravado.id },
      });
      avisado = !eAviso;
    }
  }
  return c.json({ ok: true, id: gravado.id, avisado });
});

filmesRoutes.get('/api/filmes', rateLimit(30), async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false }, 503);
  const eu = await donoDaSessao(c.req.header('Authorization'));
  if (!eu) return c.json({ ok: false, erro: 'sessão inválida' }, 401);
  const { data, error } = await sb.from('partidas_filme')
    .select('id, dono, resumo, criado_em, visto_em')
    .or(`dono.eq.${eu},adversario.eq.${eu}`)
    .order('criado_em', { ascending: false }).limit(20);
  if (error) return c.json({ ok: false, erro: 'sem filmes' }, 500);
  return c.json({
    ok: true,
    filmes: (data ?? []).map((f) => ({
      id: f.id as string, papel: f.dono === eu ? 'dono' : 'adversario', resumo: f.resumo as ResumoDoFilme,
      quando: f.criado_em as string, novo: f.dono !== eu && !f.visto_em,
    })),
  });
});

filmesRoutes.get('/api/filme/:id', rateLimit(30), async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false }, 503);
  const eu = await donoDaSessao(c.req.header('Authorization'));
  if (!eu) return c.json({ ok: false, erro: 'sessão inválida' }, 401);
  const id = c.req.param('id') ?? '';
  if (!UUID.test(id)) return c.json({ ok: false, erro: 'id inválido' }, 400);
  const { data } = await sb.from('partidas_filme')
    .select('id, dono, adversario, filme, visto_em').eq('id', id).maybeSingle();
  // Quem não é dono nem adversário recebe "não existe" (não confirma que o id existe).
  if (!data || (data.dono !== eu && data.adversario !== eu)) return c.json({ ok: false, erro: 'não encontrado' }, 404);
  const papel = data.dono === eu ? 'dono' : 'adversario';
  if (papel === 'adversario' && !data.visto_em) {
    await sb.from('partidas_filme').update({ visto_em: new Date().toISOString() }).eq('id', id);
  }
  return c.json({ ok: true, papel, filme: { ...(data.filme as object), id: data.id } });
});
