/**
 * O FILME COMO ARENA (Partida Viva, Fase 4 do Motor de Posses) — as rotas.
 *
 *   POST /api/arena/assumir  {filme, minuto, ordens}           — a prancheta: o motor
 *        simula dali com as suas ordens e devolve os MOMENTOS em que você escolhe
 *        (sem o desfecho). Pode pedir quantas vezes quiser: não grava nada.
 *   POST /api/arena/fechar   {filme, minuto, ordens, escolhas} — o tiro: o servidor
 *        refaz a MESMA simulação (é determinística), conta o seu placar com as suas
 *        escolhas, o do dono pela custódia e o do banco calado; grava a tentativa
 *        (uma por filme: jogar de novo mostra, mas não conta) e devolve o plano pro campo tocar.
 *   POST /api/arena/abrir    {filme}  — o dono abre o filme como DESAFIO (qualquer um assume).
 *   GET  /api/arena/desafios          — os filmes abertos como desafio.
 *   GET  /api/arena/ranking           — o ranking da semana (soma do saldo).
 *
 * Quem pode assumir: o dono, o adversário, o atleta de uma lenda que jogou o
 * filme, ou qualquer manager logado se o filme está aberto como desafio. Quem
 * assume comanda o time da CASA do filme (o do dono). A conta é pura em
 * lib/arena.ts; o motor, em server/smartfield/arena.py.
 *
 * Sem a migration 20261013000000_arena_do_filme.sql: assumir e fechar
 * funcionam (o resultado volta), mas nada é gravado — sem desafio aberto,
 * ranking ou lenda como agente.
 */
import { Hono } from 'hono';
import { existsSync } from 'node:fs';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { donoDaSessao } from '../lib/sessao.js';
import { rateLimit } from '../lib/rateLimit.js';
import { idiomaDoPedido } from '../lib/idioma.js';
import { escolhasVazias, lerEscolhas } from '../lib/partida/placar.js';
import {
  escolhasDaLenda, escolhasValidas, lancesDoPlano, MINUTO_MAX_DA_ARENA, momentosSemDesfecho, oQueEleFez,
  placarDaArena, planoEmVigor, rankingDaSemana, semanaDe, veredito, type PlanoGuardado, type Placar,
} from '../lib/arena.js';
import { resolveScriptPath, runPython } from './matchPlan.js';
import { lendasPorFicha } from './filmes.js';

export const arenaRoutes = new Hono();
type Sb = NonNullable<ReturnType<typeof getSupabaseAdmin>>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Papel = 'dono' | 'adversario' | 'lenda' | 'desafio';
interface FilmeDaArena {
  id: string; dono: string; adversario: string | null; seed: string;
  filme: Record<string, unknown>; lendas: string[]; arena_aberta?: boolean;
}

type Falha = { ok: false; status: 400 | 403 | 404 | 409 | 500 | 502; erro: string };

async function abrirFilme(sb: Sb, eu: string, id: string): Promise<{ ok: true; f: FilmeDaArena; papel: Papel; minhasLendas: string[] } | Falha> {
  if (!UUID.test(id)) return { ok: false, status: 400, erro: 'filme inválido' };
  const { data } = await sb.from('partidas_filme').select('*').eq('id', id).maybeSingle();
  if (!data) return { ok: false, status: 404, erro: 'filme não encontrado' };
  const f = data as unknown as FilmeDaArena;
  const lendas = await lendasPorFicha(sb, Array.isArray(f.lendas) ? f.lendas : []);
  const minhasLendas = [...lendas].filter(([, l]) => l.atleta === eu).map(([id]) => id);
  const papel: Papel | null = f.dono === eu ? 'dono' : f.adversario === eu ? 'adversario' : minhasLendas.length ? 'lenda' : f.arena_aberta ? 'desafio' : null;
  if (!papel) return { ok: false, status: 404, erro: 'filme não encontrado' };
  return { ok: true, f, papel, minhasLendas };
}

interface Simulado {
  minuto: number;
  ordens: unknown[];
  noMinuto: Placar;
  ele: Placar;
  voce: { events?: Array<Record<string, unknown>> } & Record<string, unknown>;
  parado: { events?: Array<Record<string, unknown>> };
  prova: unknown;
  /** Quem da casa está em campo no minuto (trocas do dono antes dele já feitas). */
  emCampo: string[];
}

/** Monta e roda a arena: custódia do dono → estado no minuto → motor. */
async function simularArena(sb: Sb, f: FilmeDaArena, minutoPedido: unknown, ordens: unknown, lang: 'pt' | 'en'): Promise<({ ok: true } & Simulado) | Falha> {
  const minuto = Number(minutoPedido);
  if (!Number.isInteger(minuto) || minuto < 2 || minuto > MINUTO_MAX_DA_ARENA) return { ok: false, status: 400, erro: `minuto entre 2 e ${MINUTO_MAX_DA_ARENA}` };
  const escolhasDoFilme = (f.filme as { escolhas?: unknown }).escolhas;
  if (!escolhasDoFilme) return { ok: false, status: 409, erro: 'filme gravado antes da arena (sem as escolhas da partida)' };
  const placarDoFilme: Placar = [Number(f.filme.placarCasa) || 0, Number(f.filme.placarFora) || 0];

  const { data: linhas, error } = await sb.from('quick_plans_emitidos')
    .select('resumo').eq('owner_id', f.dono).eq('seed', f.seed).order('criado_em', { ascending: true }).limit(64);
  if (error) return { ok: false, status: 500, erro: 'custódia indisponível' };
  const planos = (linhas ?? []).map((l) => l.resumo as PlanoGuardado).filter((p) => p && Array.isArray(p.lances));
  if (!planos.some((p) => p.modo === 'full')) return { ok: false, status: 409, erro: 'partida sem custódia' };

  const ele = oQueEleFez(planos, lerEscolhas(escolhasDoFilme), minuto, placarDoFilme);
  if (!ele) return { ok: false, status: 409, erro: 'o filme não bate com a custódia — não vira arena' };
  const vigente = planoEmVigor(planos, minuto);
  if (!vigente?.entrada) return { ok: false, status: 409, erro: 'partida de antes da arena (o pedido do motor não foi guardado)' };

  const script = resolveScriptPath();
  if (!existsSync(script)) return { ok: false, status: 500, erro: 'motor indisponível' };
  try {
    const stdout = await runPython(script, JSON.stringify({ ...vigente.entrada, lang, arena: { minuto, estado: ele.estado, comandos: Array.isArray(ordens) ? ordens.slice(0, 12) : [] } }), 8000);
    const r = JSON.parse(stdout) as { error?: string; minuto: number; ordens: unknown[]; voce: Simulado['voce']; parado: Simulado['parado']; prova: unknown };
    if (r.error) return { ok: false, status: 400, erro: r.error };
    const lineup = ((vigente.entrada.home_team as { lineup?: Array<{ id?: unknown }> } | undefined)?.lineup ?? []);
    const emCampo = lineup.flatMap((p) => (typeof p?.id === 'string' ? [p.id] : [])).filter((id) => !ele.estado.expulsos.includes(id));
    return { ok: true, minuto: r.minuto, ordens: r.ordens, noMinuto: ele.noMinuto, ele: ele.final, voce: r.voce, parado: r.parado, prova: r.prova, emCampo };
  } catch (e) {
    return { ok: false, status: 502, erro: e instanceof Error ? e.message.slice(0, 200) : 'motor falhou' };
  }
}

async function jaTentou(sb: Sb, filme: string, eu: string) {
  const { data, error } = await sb.from('arena_tentativas')
    .select('minuto, no_minuto, placar_ele, placar_voce, placar_parado, saldo, contra_parado').eq('filme', filme).eq('desafiante', eu).maybeSingle();
  return error ? null : data;
}

arenaRoutes.post('/api/arena/assumir', rateLimit(20), async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false }, 503);
  const eu = await donoDaSessao(c.req.header('Authorization'));
  if (!eu) return c.json({ ok: false, erro: 'sessão inválida' }, 401);
  const body = await c.req.json<{ filme?: string; minuto?: number; ordens?: unknown[] }>().catch(() => null);
  const aberto = await abrirFilme(sb, eu, String(body?.filme ?? ''));
  if (!aberto.ok) return c.json({ ok: false, erro: aberto.erro }, aberto.status);
  const sim = await simularArena(sb, aberto.f, body?.minuto, body?.ordens, idiomaDoPedido(c));
  if (!sim.ok) return c.json({ ok: false, erro: sim.erro }, sim.status);
  // Antes de fechar o aparelho NÃO vê o desfecho de nada: nem o plano, nem a prova.
  return c.json({
    ok: true, papel: aberto.papel, minuto: sim.minuto, noMinuto: sim.noMinuto, ordens: sim.ordens, emCampo: sim.emCampo,
    momentos: momentosSemDesfecho(sim.voce), jaTentou: await jaTentou(sb, aberto.f.id, eu),
  });
});

arenaRoutes.post('/api/arena/fechar', rateLimit(10), async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false }, 503);
  const eu = await donoDaSessao(c.req.header('Authorization'));
  if (!eu) return c.json({ ok: false, erro: 'sessão inválida' }, 401);
  const body = await c.req.json<{ filme?: string; minuto?: number; ordens?: unknown[]; escolhas?: unknown }>().catch(() => null);
  const aberto = await abrirFilme(sb, eu, String(body?.filme ?? ''));
  if (!aberto.ok) return c.json({ ok: false, erro: aberto.erro }, aberto.status);
  // Um tiro por filme: quem já assumiu pode jogar de novo e ver, mas não conta de novo.
  const anterior = await jaTentou(sb, aberto.f.id, eu);
  const sim = await simularArena(sb, aberto.f, body?.minuto, body?.ordens, idiomaDoPedido(c));
  if (!sim.ok) return c.json({ ok: false, erro: sim.erro }, sim.status);

  const momentos = momentosSemDesfecho(sim.voce);
  const escolhas = escolhasValidas(momentos, lerEscolhas(body?.escolhas));
  const voce = placarDaArena(sim.noMinuto, lancesDoPlano(sim.voce), escolhas);
  const parado = placarDaArena(sim.noMinuto, lancesDoPlano(sim.parado), escolhasVazias());
  const v = veredito(sim.minuto, sim.noMinuto, sim.ele, voce, parado);
  const daLenda = aberto.papel === 'lenda' ? escolhasDaLenda(momentos, escolhas, aberto.minhasLendas) : {};

  // O dono jogando o próprio filme não entra no ranking (ele já sabe o que vem).
  let registrado = false;
  if (aberto.papel !== 'dono' && !anterior) {
    const { error } = await sb.from('arena_tentativas').insert({
      filme: aberto.f.id, desafiante: eu, minuto: v.minuto, ordens: sim.ordens, escolhas,
      no_minuto: v.noMinuto, placar_ele: v.ele, placar_voce: v.voce, placar_parado: v.parado,
      saldo: v.saldo, contra_parado: v.contraParado, semana: semanaDe(new Date()),
      lendas: Object.keys(daLenda), escolhas_da_lenda: daLenda,
    });
    if (error?.code === '23505') return c.json({ ok: false, erro: 'você já assumiu este filme' }, 409);
    registrado = !error;
  }
  return c.json({ ok: true, papel: aberto.papel, veredito: v, escolhas, momentos, plano: sim.voce, emCampo: sim.emCampo, prova: sim.prova, registrado, lendaAprendeu: Object.keys(daLenda).length > 0 });
});

arenaRoutes.post('/api/arena/abrir', rateLimit(10), async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false }, 503);
  const eu = await donoDaSessao(c.req.header('Authorization'));
  if (!eu) return c.json({ ok: false, erro: 'sessão inválida' }, 401);
  const body = await c.req.json<{ filme?: string }>().catch(() => null);
  const aberto = await abrirFilme(sb, eu, String(body?.filme ?? ''));
  if (!aberto.ok) return c.json({ ok: false, erro: aberto.erro }, aberto.status);
  if (aberto.papel !== 'dono') return c.json({ ok: false, erro: 'só o dono abre o filme como desafio' }, 403);
  // Só vira desafio o filme que a arena consegue jogar (custódia bate, pedido do motor guardado).
  const teste = await simularArena(sb, aberto.f, 45, [], 'pt');
  if (!teste.ok) return c.json({ ok: false, erro: teste.erro }, teste.status);
  const { error } = await sb.from('partidas_filme').update({ arena_aberta: true }).eq('id', aberto.f.id).eq('dono', eu);
  if (error) return c.json({ ok: false, erro: 'desafio ainda não disponível' }, 503);
  return c.json({ ok: true });
});

arenaRoutes.get('/api/arena/desafios', rateLimit(30), async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false }, 503);
  const eu = await donoDaSessao(c.req.header('Authorization'));
  if (!eu) return c.json({ ok: false, erro: 'sessão inválida' }, 401);
  const { data, error } = await sb.from('partidas_filme').select('id, dono, resumo, criado_em')
    .eq('arena_aberta', true).neq('dono', eu).order('criado_em', { ascending: false }).limit(30);
  if (error) return c.json({ ok: true, desafios: [] }); // migration da Fase 4 pendente
  const ids = (data ?? []).map((f) => f.id as string);
  const { data: minhas } = ids.length
    ? await sb.from('arena_tentativas').select('filme, saldo').eq('desafiante', eu).in('filme', ids)
    : { data: [] as Array<{ filme: string; saldo: number }> };
  const feito = new Map((minhas ?? []).map((t) => [t.filme as string, t.saldo as number]));
  return c.json({
    ok: true,
    desafios: (data ?? []).map((f) => ({ id: f.id as string, resumo: f.resumo, quando: f.criado_em as string, meuSaldo: feito.get(f.id as string) ?? null })),
  });
});

arenaRoutes.get('/api/arena/ranking', rateLimit(30), async (c) => {
  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false }, 503);
  const eu = await donoDaSessao(c.req.header('Authorization'));
  if (!eu) return c.json({ ok: false, erro: 'sessão inválida' }, 401);
  const semana = semanaDe(new Date());
  const { data, error } = await sb.from('arena_tentativas').select('desafiante, saldo').eq('semana', semana).limit(5000);
  if (error) return c.json({ ok: true, semana, linhas: [] });
  const linhas = rankingDaSemana((data ?? []).map((t) => ({ desafiante: t.desafiante as string, saldo: Number(t.saldo) })));
  const top = linhas.slice(0, 50);
  const ids = [...new Set([...top.map((l) => l.desafiante), eu])];
  const { data: perfis } = await sb.from('profiles').select('id, club_name, club_short, display_name').in('id', ids);
  const nome = new Map((perfis ?? []).map((p) => [p.id as string, { nome: String(p.club_name ?? p.display_name ?? 'Clube'), sigla: String(p.club_short ?? '---') }]));
  const minha = linhas.findIndex((l) => l.desafiante === eu);
  return c.json({
    ok: true, semana,
    linhas: top.map((l, i) => ({ pos: i + 1, ...nome.get(l.desafiante), pontos: l.pontos, tentativas: l.tentativas, melhor: l.melhor, eu: l.desafiante === eu })),
    minha: minha >= 0 ? { pos: minha + 1, pontos: linhas[minha]!.pontos, tentativas: linhas[minha]!.tentativas } : null,
  });
});
