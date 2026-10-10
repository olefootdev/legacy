/**
 * LEGACY LEAGUE — a liga que só se joga na Partida Viva (regras em lib/legacyLeague.ts).
 *
 *   GET  /api/legacy-league            — temporada, tabela, minha posição, minhas partidas
 *   POST /api/legacy-league/partida    — abre uma partida da liga (o servidor sorteia o
 *                                        adversário: o time de outro manager real)
 *   POST /api/legacy-league/resultado  — fecha a partida: vale com custódia válida + filme
 *
 * A tabela `legacy_league_partidas` é só do servidor (RLS fechada).
 */
import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { donoDaSessao } from '../lib/sessao.js';
import { rateLimit } from '../lib/rateLimit.js';
import {
  fimDaTemporada, LIMITE_POR_DIA, montarTabela, temporadaAnterior, temporadaDe, VALIDADE_DA_PARTIDA_MS, veredito,
  type PartidaValida,
} from '../lib/legacyLeague.js';

export const legacyLeagueRoutes = new Hono();
type Sb = NonNullable<ReturnType<typeof getSupabaseAdmin>>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Nome e sigla do clube de cada manager (a tabela mostra clube, nunca e-mail). */
async function clubes(sb: Sb, ids: string[]): Promise<Map<string, { nome: string; sigla: string }>> {
  const out = new Map<string, { nome: string; sigla: string }>();
  if (!ids.length) return out;
  const { data } = await sb.from('profiles').select('id, club_name, club_short, display_name').in('id', ids);
  for (const p of data ?? []) {
    out.set(p.id as string, { nome: String(p.club_name ?? p.display_name ?? 'Clube'), sigla: String(p.club_short ?? '---') });
  }
  return out;
}

/** Partidas abertas há mais de 3 h viram `expirada` (não contam, não voltam). */
async function expirarVelhas(sb: Sb, dono: string) {
  const limite = new Date(Date.now() - VALIDADE_DA_PARTIDA_MS).toISOString();
  await sb.from('legacy_league_partidas').update({ status: 'expirada', fechado_em: new Date().toISOString(), motivo: 'não jogada a tempo' })
    .eq('dono', dono).eq('status', 'aberta').lt('criado_em', limite);
}

legacyLeagueRoutes.get('/api/legacy-league', rateLimit(30), async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false }, 503);
  const eu = await donoDaSessao(c.req.header('Authorization'));
  if (!eu) return c.json({ ok: false, erro: 'sessão inválida' }, 401);
  await expirarVelhas(sb, eu);
  const agora = new Date();
  const temporada = temporadaDe(agora);
  const anterior = temporadaAnterior(agora);

  const [{ data: validas, error }, { data: passadas }, { data: minhas }] = await Promise.all([
    sb.from('legacy_league_partidas').select('dono, gols_pro, gols_contra, pontos').eq('temporada', temporada).eq('status', 'valida'),
    sb.from('legacy_league_partidas').select('dono, gols_pro, gols_contra, pontos').eq('temporada', anterior).eq('status', 'valida'),
    sb.from('legacy_league_partidas').select('id, adversario, status, motivo, gols_pro, gols_contra, pontos, criado_em')
      .eq('dono', eu).order('criado_em', { ascending: false }).limit(12),
  ]);
  if (error) return c.json({ ok: false, erro: 'liga indisponível' }, 503); // tabela ainda não existe

  const tabela = montarTabela((validas ?? []) as PartidaValida[]);
  const campeao = montarTabela((passadas ?? []) as PartidaValida[])[0] ?? null;
  const hoje = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate())).toISOString();
  const jogadasHoje = (minhas ?? []).filter((p) => (p.criado_em as string) >= hoje && p.status !== 'expirada').length;
  const ids = [...new Set([...tabela.slice(0, 50).map((l) => l.dono), ...(minhas ?? []).map((p) => p.adversario as string), ...(campeao ? [campeao.dono] : []), eu])];
  const nomes = await clubes(sb, ids);
  const posicao = tabela.findIndex((l) => l.dono === eu);

  return c.json({
    ok: true,
    temporada,
    terminaEm: fimDaTemporada(agora).toISOString(),
    restantesHoje: Math.max(0, LIMITE_POR_DIA - jogadasHoje),
    limitePorDia: LIMITE_POR_DIA,
    // Na tabela, o id do manager não sai: só posição, clube e números (e "você").
    tabela: tabela.slice(0, 50).map((l, i) => ({ ...l, dono: undefined, posicao: i + 1, voce: l.dono === eu, clube: nomes.get(l.dono) ?? null })),
    minha: posicao >= 0 ? { ...tabela[posicao]!, dono: undefined, posicao: posicao + 1 } : null,
    campeaoAnterior: campeao ? { clube: nomes.get(campeao.dono) ?? null, pontos: campeao.pontos, voce: campeao.dono === eu } : null,
    partidas: (minhas ?? []).map((p) => ({
      id: p.id, status: p.status, motivo: p.motivo, golsPro: p.gols_pro, golsContra: p.gols_contra, pontos: p.pontos,
      quando: p.criado_em, adversario: nomes.get(p.adversario as string) ?? null,
    })),
  });
});

legacyLeagueRoutes.post('/api/legacy-league/partida', rateLimit(10), async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false }, 503);
  const eu = await donoDaSessao(c.req.header('Authorization'));
  if (!eu) return c.json({ ok: false, erro: 'sessão inválida' }, 401);
  await expirarVelhas(sb, eu);
  const agora = new Date();
  const temporada = temporadaDe(agora);

  // Partida aberta e ainda válida: devolve a mesma (sair e voltar não queima jogo).
  const { data: aberta } = await sb.from('legacy_league_partidas').select('id, adversario')
    .eq('dono', eu).eq('status', 'aberta').order('criado_em', { ascending: false }).limit(1).maybeSingle();
  let partida = aberta as { id: string; adversario: string } | null;

  if (!partida) {
    const hoje = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate())).toISOString();
    const { count } = await sb.from('legacy_league_partidas').select('id', { count: 'exact', head: true })
      .eq('dono', eu).neq('status', 'expirada').gte('criado_em', hoje);
    if ((count ?? 0) >= LIMITE_POR_DIA) return c.json({ ok: false, erro: 'limite do dia', limite: LIMITE_POR_DIA }, 429);

    // Sorteio do adversário: elenco completo, outro manager, de preferência inédito na temporada.
    const [{ data: elencos }, { data: enfrentados }] = await Promise.all([
      sb.from('manager_squad').select('user_id, players').neq('user_id', eu).limit(400),
      sb.from('legacy_league_partidas').select('adversario').eq('dono', eu).eq('temporada', temporada),
    ]);
    const completos = (elencos ?? []).filter((e) => Array.isArray(e.players) && (e.players as unknown[]).length >= 11).map((e) => e.user_id as string);
    const ja = new Set((enfrentados ?? []).map((p) => p.adversario as string));
    const ineditos = completos.filter((id) => !ja.has(id));
    const pool = ineditos.length ? ineditos : completos;
    if (!pool.length) return c.json({ ok: false, erro: 'sem adversário disponível' }, 503);
    const adversario = pool[Math.floor(Math.random() * pool.length)]!;
    const { data: nova, error } = await sb.from('legacy_league_partidas')
      .insert({ temporada, dono: eu, adversario }).select('id, adversario').single();
    if (error || !nova) return c.json({ ok: false, erro: 'liga indisponível' }, 503);
    partida = nova as { id: string; adversario: string };
  }

  // O time do adversário, no MESMO formato da busca de amistoso (o celular reaproveita a conversão).
  const [{ data: elenco }, { data: perfil }] = await Promise.all([
    sb.from('manager_squad').select('user_id, players, lineup, formation_scheme').eq('user_id', partida.adversario).maybeSingle(),
    sb.from('profiles').select('display_name, club_name, club_short, onboarding_data').eq('id', partida.adversario).maybeSingle(),
  ]);
  if (!elenco) return c.json({ ok: false, erro: 'o adversário ficou sem elenco' }, 409);
  return c.json({
    ok: true,
    partida: partida.id,
    adversario: {
      user_id: elenco.user_id, players: elenco.players, lineup: elenco.lineup, formation_scheme: elenco.formation_scheme,
      display_name: perfil?.display_name ?? null, club_name: perfil?.club_name ?? null, club_short: perfil?.club_short ?? null,
      onboarding_data: perfil?.onboarding_data ?? null, player_count: Array.isArray(elenco.players) ? (elenco.players as unknown[]).length : 0,
    },
  });
});

legacyLeagueRoutes.post('/api/legacy-league/resultado', rateLimit(30), async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false }, 503);
  const eu = await donoDaSessao(c.req.header('Authorization'));
  if (!eu) return c.json({ ok: false, erro: 'sessão inválida' }, 401);
  const corpo = (await c.req.json().catch(() => null)) as { partida?: unknown; seed?: unknown } | null;
  const id = typeof corpo?.partida === 'string' ? corpo.partida : '';
  const seed = typeof corpo?.seed === 'string' ? corpo.seed.slice(0, 200) : '';
  if (!UUID.test(id) || !seed) return c.json({ ok: false, erro: 'partida inválida' }, 400);

  const { data: partida } = await sb.from('legacy_league_partidas').select('id, adversario, status, pontos, gols_pro, gols_contra, motivo')
    .eq('id', id).eq('dono', eu).maybeSingle();
  if (!partida) return c.json({ ok: false, erro: 'partida não encontrada' }, 404);
  if (partida.status !== 'aberta') {
    return c.json({ ok: true, status: partida.status, pontos: partida.pontos, golsPro: partida.gols_pro, golsContra: partida.gols_contra, motivo: partida.motivo });
  }

  const [{ data: sombra }, { data: filme }] = await Promise.all([
    sb.from('evolucao_sombra').select('custodia, resultado').eq('owner_id', eu).eq('seed', seed).maybeSingle(),
    sb.from('partidas_filme').select('resumo').eq('dono', eu).eq('seed', seed).maybeSingle(),
  ]);
  const v = veredito({
    seed, partidaId: id, adversario: partida.adversario as string,
    sombra: sombra ? { custodia: String(sombra.custodia), resultado: String(sombra.resultado) } : null,
    filme: filme?.resumo ? (filme.resumo as { placarCasa: number; placarFora: number }) : null,
  });
  if (v.status === 'aguardando') return c.json({ ok: true, status: 'aguardando', falta: v.falta }, 202);

  const fechado = new Date().toISOString();
  const linha = v.status === 'valida'
    ? { status: 'valida', seed, gols_pro: v.gols_pro, gols_contra: v.gols_contra, pontos: v.pontos, fechado_em: fechado, motivo: null }
    : { status: 'invalida', seed, pontos: 0, fechado_em: fechado, motivo: v.motivo };
  // `.eq('status','aberta')`: dois pedidos ao mesmo tempo não fecham duas vezes.
  const { error } = await sb.from('legacy_league_partidas').update(linha).eq('id', id).eq('status', 'aberta');
  if (error) return c.json({ ok: false, erro: 'não fechou' }, 500);
  return c.json({ ok: true, status: linha.status, pontos: linha.pontos, golsPro: v.status === 'valida' ? v.gols_pro : null, golsContra: v.status === 'valida' ? v.gols_contra : null, motivo: linha.motivo });
});
