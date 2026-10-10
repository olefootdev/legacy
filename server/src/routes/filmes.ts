/**
 * PARTIDA VIVA — Fase 7: o filme no servidor (docs/PARTIDA-VIVA-PLANO.md §8).
 *
 *   POST /api/filme       — quem jogou manda o filme; se o adversário era o time
 *                           de outro manager, ele recebe a notificação.
 *   GET  /api/filmes      — os filmes da sessão: os que ela jogou e os que
 *                           jogaram CONTRA o time dela.
 *   GET  /api/filme/:id   — um filme (só pro dono, pro adversário ou pro atleta de
 *                           uma lenda que jogou nele — Fase 8).
 *   GET  /api/filmes/lenda — PLAYERVIP: as partidas das lendas do atleta da sessão.
 *
 * A tabela `partidas_filme` é só do servidor (RLS fechada ao cliente).
 * Conferência pura em lib/filme.ts.
 */
import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { donoDaSessao } from '../lib/sessao.js';
import { rateLimit } from '../lib/rateLimit.js';
import {
  AVISOS_POR_ADVERSARIO_POR_DIA, AVISOS_POR_DIA, avisoDaLenda, avisoDoAdversario, candidatosALenda, conferirFilme,
  elencoBate, golsNoFilme, type ResumoDoFilme,
} from '../lib/filme.js';

export const filmesRoutes = new Hono();
type Sb = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/** Linhas de legacy_players pros ids das fichas (no elenco o id ganha 'legacy-' quando a linha não tem). */
async function lendasPorFicha(sb: Sb, ids: string[]): Promise<Map<string, { nome: string; atleta: string | null }>> {
  const out = new Map<string, { nome: string; atleta: string | null }>();
  if (!ids.length) return out;
  const busca = [...new Set(ids.flatMap((id) => (id.startsWith('legacy-') ? [id, id.slice(7)] : [id])))];
  const { data } = await sb.from('legacy_players').select('id, name, beneficiary_user_id').in('id', busca);
  for (const l of data ?? []) {
    const ficha = ids.includes(l.id as string) ? (l.id as string) : `legacy-${l.id as string}`;
    if (ids.includes(ficha)) out.set(ficha, { nome: String(l.name ?? 'Sua lenda'), atleta: (l.beneficiary_user_id as string | null) ?? null });
  }
  return out;
}

/**
 * FASE 8 — "sua lenda jogou": marca as lendas do filme e avisa o atleta de cada
 * uma (no máximo 1 aviso por atleta por dia: só o 1º filme do dia avisa).
 */
async function marcarLendas(sb: Sb, filmeId: string, dono: string, adversario: string | null, conf: { filme: Record<string, unknown>; resumo: ResumoDoFilme }) {
  const lendas = await lendasPorFicha(sb, candidatosALenda(conf.filme));
  if (!lendas.size) return;
  const gols = golsNoFilme(conf.filme);
  const lendasGols = Object.fromEntries([...lendas.keys()].map((id) => [id, gols.get(id) ?? 0]));
  const { error } = await sb.from('partidas_filme').update({ lendas: [...lendas.keys()], lendas_gols: lendasGols }).eq('id', filmeId);
  if (error) return; // coluna ainda não existe (migration da Fase 8 pendente): o filme fica sem a marca
  const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const porAtleta = new Map<string, string[]>();
  for (const [id, l] of lendas) if (l.atleta && l.atleta !== dono && l.atleta !== adversario) porAtleta.set(l.atleta, [...(porAtleta.get(l.atleta) ?? []), id]);
  for (const [atleta, ids] of porAtleta) {
    const { count } = await sb.from('partidas_filme').select('id', { count: 'exact', head: true })
      .overlaps('lendas', ids).neq('id', filmeId).gte('criado_em', desde);
    if ((count ?? 0) > 0) continue;
    const melhor = ids.sort((a, b) => (gols.get(b) ?? 0) - (gols.get(a) ?? 0))[0]!;
    const { titulo, mensagem } = avisoDaLenda(lendas.get(melhor)!.nome, conf.resumo, gols.get(melhor) ?? 0);
    await sb.from('notifications').insert({
      user_id: atleta, category: 'COMPETIÇÃO', title: titulo, message: mensagem,
      link: `/playervip/filme/${filmeId}`, payload: { tipo: 'filme_da_lenda', filme: filmeId, lenda: melhor },
    });
  }
}
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

  await marcarLendas(sb, gravado.id as string, dono, adversario, conf).catch(() => undefined);

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
    .select('*').eq('id', id).maybeSingle();
  if (!data) return c.json({ ok: false, erro: 'não encontrado' }, 404);
  // Fase 8: o atleta de uma lenda que jogou também assiste — com a câmera nela.
  let seguir: string | null = null;
  if (data.dono !== eu && data.adversario !== eu) {
    const lendas = await lendasPorFicha(sb, Array.isArray(data.lendas) ? (data.lendas as string[]) : []);
    seguir = [...lendas].find(([, l]) => l.atleta === eu)?.[0] ?? null;
    // Quem não é dono, adversário nem atleta recebe "não existe" (não confirma que o id existe).
    if (!seguir) return c.json({ ok: false, erro: 'não encontrado' }, 404);
  }
  const papel = data.dono === eu ? 'dono' : data.adversario === eu ? 'adversario' : 'lenda';
  if (papel === 'adversario' && !data.visto_em) {
    await sb.from('partidas_filme').update({ visto_em: new Date().toISOString() }).eq('id', id);
  }
  return c.json({ ok: true, papel, seguir, filme: { ...(data.filme as object), id: data.id } });
});

filmesRoutes.get('/api/filmes/lenda', rateLimit(30), async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false }, 503);
  const eu = await donoDaSessao(c.req.header('Authorization'));
  if (!eu) return c.json({ ok: false, erro: 'sessão inválida' }, 401);
  const { data: minhas } = await sb.from('legacy_players').select('id, name').eq('beneficiary_user_id', eu);
  const nomes = new Map<string, string>();
  for (const l of minhas ?? []) {
    const id = l.id as string;
    nomes.set(id, String(l.name ?? '')); nomes.set(id.startsWith('legacy-') ? id : `legacy-${id}`, String(l.name ?? ''));
  }
  if (!nomes.size) return c.json({ ok: true, filmes: [] });
  const { data, error } = await sb.from('partidas_filme')
    .select('id, resumo, criado_em, lendas, lendas_gols').overlaps('lendas', [...nomes.keys()])
    .order('criado_em', { ascending: false }).limit(30);
  if (error) return c.json({ ok: true, filmes: [] }); // coluna da Fase 8 ainda não existe
  return c.json({
    ok: true,
    filmes: (data ?? []).map((f) => {
      const lenda = (f.lendas as string[]).find((id) => nomes.has(id)) ?? '';
      // Quem escalou fica de fora: o atleta vê o placar e a lenda, não o clube de quem jogou.
      const r = f.resumo as ResumoDoFilme;
      return {
        id: f.id as string, quando: f.criado_em as string, lenda, nome: nomes.get(lenda) ?? '',
        gols: Number((f.lendas_gols as Record<string, number> | null)?.[lenda] ?? 0),
        placar: { siglaCasa: r.siglaCasa, siglaFora: r.siglaFora, placarCasa: r.placarCasa, placarFora: r.placarFora },
      };
    }),
  });
});
