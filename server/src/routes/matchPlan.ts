/**
 * Match Plan — pré-computa uma Partida Rápida via Python.
 *
 * Pipeline:
 *   Frontend → POST /api/match/quick-plan {seed, home, away, intensity}
 *   Backend spawn python3 smartfield/match_simulator.py com input JSON via stdin
 *   Python simula 90' em ~5-50ms, devolve MatchPlan JSON via stdout
 *   Backend valida shape + devolve pro frontend
 *
 * Cache: por hash(seed + home + away + intensity). Plan idêntico = mesmo resultado.
 * O TS renderiza o plan em ~25s com timing variável por weightTier (FIX F).
 */

import { Hono } from 'hono';
import { rateLimit } from '../lib/rateLimit.js';
import { donoDaSessao } from '../lib/sessao.js';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { resumirPlano } from '../lib/smartProfile/custodia.js';
import {
  aplicarTracos, conferenciaVazia, conferirEscalacao, conferirFadiga, forcaDaEscalacao, impressaoDaEscalacao,
  type Conferencia, type FichaDoMotor,
} from '../lib/smartProfile/plano.js';
import { sincronizarFichas } from '../lib/smartProfile/sincronizar.js';
import { classesDaPartida } from '../lib/smartProfile/classesDaPartida.js';
import { idiomaDoPedido } from '../lib/idioma.js';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

interface QuickPlanPlayerInput {
  id: string;
  name?: string;
  pos?: string;
  role?: 'attack' | 'mid' | 'def' | 'gk';
  finalizacao?: number;
  passe?: number;
  marcacao?: number;
  velocidade?: number;
  fisico?: number;
  confianca?: number;
  // Os quatro que o jogo já mandava e esta interface não declarava — a
  // conferência da Fase 3 olha todos, então ficam explícitos.
  drible?: number;
  tatico?: number;
  mentalidade?: number;
  fair_play?: number;
  fatigue?: number;
  /** Partida Viva: especialistas — só a cadeia de lances lê (não mexem no placar). */
  cabeceio?: number;
  bola_parada?: number;
  penalti?: number;
  pe?: 'left' | 'right' | 'both';
}

interface QuickPlanTeamInput {
  strength: number;
  intensity?: 'defensive' | 'balanced' | 'offensive';
  lineup: QuickPlanPlayerInput[];
  /** DNA da fundação do clube (7 eixos 0–1). Ausente = neutro. Ver `limparDna`. */
  dna?: Record<string, number>;
}

const EIXOS_DNA = ['posse', 'pressao', 'vertical', 'criatividade', 'solidez', 'disciplina', 'intensidade'] as const;

/**
 * O DNA vem do cliente: só passa eixo conhecido, número finito, preso em 0–1
 * e com 3 casas. Qualquer outra coisa some — um pedido adulterado não injeta
 * multiplicador no motor. Sem eixo válido nenhum, o time joga neutro.
 */
export function limparDna(raw: unknown): Record<string, number> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, number> = {};
  for (const k of EIXOS_DNA) {
    const v = Number((raw as Record<string, unknown>)[k]);
    if (Number.isFinite(v)) out[k] = Math.round(Math.max(0, Math.min(1, v)) * 1000) / 1000;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * DNA de um clube, lido do `lineup_snapshot` que ele sincroniza com a Liga
 * Global — a mesma fonte do tick da liga. O time é achado pelas identidades
 * da RLS (uid OU e-mail em minúsculas: a liga registra pelo e-mail). Cache
 * curto: o DNA só muda quando o manager refaz a fundação.
 */
const dnaCache = new Map<string, { ts: number; dna: Record<string, number> | undefined }>();
const DNA_CACHE_MS = 60_000;

async function dnaDoUsuario(userId: string): Promise<Record<string, number> | undefined> {
  const hit = dnaCache.get(userId);
  if (hit && Date.now() - hit.ts < DNA_CACHE_MS) return hit.dna;
  const sb = getSupabaseAdmin();
  if (!sb) return undefined;
  try {
    const { data: u } = await sb.auth.admin.getUserById(userId);
    const ids = [userId, u?.user?.email?.toLowerCase()].filter((v): v is string => !!v);
    const { data } = await sb
      .from('global_league_teams')
      .select('lineup_snapshot')
      .in('manager_id', ids)
      .limit(1)
      .maybeSingle();
    const dna = limparDna((data as { lineup_snapshot?: { dna?: unknown } } | null)?.lineup_snapshot?.dna);
    dnaCache.set(userId, { ts: Date.now(), dna });
    return dna;
  } catch {
    return undefined;
  }
}

/** Dono do clube adversário pelo short (mesmo caminho do opponent-roster). */
async function donoDoClube(clubShort: string | undefined): Promise<string | null> {
  const short = clubShort?.trim();
  const sb = getSupabaseAdmin();
  if (!short || !sb) return null;
  const { data } = await sb.from('profiles').select('id').ilike('club_short', short).limit(1);
  return (data?.[0] as { id?: string } | undefined)?.id ?? null;
}

interface QuickPlanDecisionInput {
  beat_id?: string;
  choice_id?: string;
  channel: string;
  target_side?: 'home' | 'away';
  weight: number;
}

interface QuickPlanFirstHalfInput {
  home_score: number;
  away_score: number;
  momentum_end?: number;
  cards_home?: number;
  cards_away?: number;
  sent_off_home?: number;
  sent_off_away?: number;
}

interface QuickPlanRequestBody {
  seed: string;
  home_short: string;
  away_short: string;
  home_team: QuickPlanTeamInput;
  away_team: QuickPlanTeamInput;
  /** Fase A (Quick 2.0): 'second_half' = replan dos minutos 46-90.
   *  LEGACY (Fase 4b): 'from_minute' = replan a partir de `from_minute` depois de
   *  um grito/ordem do manager, com o `estado` daquele minuto. */
  mode?: 'full' | 'second_half' | 'from_minute';
  first_half?: QuickPlanFirstHalfInput;
  from_minute?: number;
  estado?: QuickPlanFirstHalfInput;
  /** LEGACY (Fase 4b): gritos e ordens — validados no Python (`comandos_ao_vivo.py`). */
  comandos?: unknown[];
  decisions?: QuickPlanDecisionInput[];
  /** FABLE — DERBY/CLÁSSICO: Python amplia agressividade dos 2 lados (~×1.12). */
  is_derby?: boolean;
  /** Idioma da narração (o servidor preenche pelo header — o cliente não manda). */
  lang?: 'pt' | 'en';
  /**
   * JOGO DA FUNDAÇÃO: o rival é o FANTASMA de um time histórico (sem dono no
   * banco), então o DNA dele vem do cliente — limpo por `limparDna`. Não abre
   * brecha nova: o lado de fora (elenco e força) já vinha do cliente; a
   * estreia não paga prêmio nem conta pra liga.
   */
  fantasma?: boolean;
}

const simpleCache = new Map<string, { ts: number; plan: unknown }>();
const CACHE_TTL_MS = 60_000;
const PYTHON_CMD = process.env.PYTHON_BIN ?? 'python3';

/** Resolve o caminho do script Python relativo ao repo.
 *  Ordem de busca:
 *    1. server/smartfield/ (Railway prod, Root Directory = server/)
 *    2. ../smartfield/ (dev local com cwd = server/)
 *    3. smartfield/ (dev local com cwd = repo root)
 *    4. /app/smartfield/ (fallback container)
 */
function resolveScriptPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'smartfield/match_simulator.py'),
    path.resolve(process.cwd(), '../smartfield/match_simulator.py'),
    path.resolve('/app/smartfield/match_simulator.py'),
    path.resolve('/app/server/smartfield/match_simulator.py'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0]!; // fallback
}

function runPython(scriptPath: string, inputJson: string, timeoutMs = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_CMD, [scriptPath], {
      cwd: path.dirname(scriptPath),
      timeout: timeoutMs,
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`python exited ${code}: ${stderr.slice(0, 400)}`));
    });
    proc.stdin.write(inputJson);
    proc.stdin.end();
  });
}

/**
 * CONFERÊNCIA (SMART-PROFILE, Fase 3): com manager logado, os atributos de cada
 * titular são conferidos contra a ficha em `player_profiles` antes de o corpo
 * chegar ao Python. Partida honesta sai idêntica; o que passa do envelope legal
 * dos tilts desce ao teto. ALTERA `body.home_team.lineup` no lugar — tem de
 * rodar antes da chave do cache, senão um pedido adulterado deixaria o plano
 * dele no cache para o próximo.
 *
 * Só o lado `home` é conferido: ver `conferirEscalacao` (ids de Genesis repetem
 * entre managers, e a ficha do adversário tem outro dono).
 *
 * Sem login, sem a tabela ou com erro de banco, segue como antes — a guarda
 * nunca derruba a geração do plano.
 */
async function conferirContraAsFichas(dono: string | null, body: QuickPlanRequestBody): Promise<Conferencia> {
  const conferencia = conferenciaVazia();
  if (!dono) return conferencia;
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return conferencia;
    if (!body.home_team.lineup.some((p) => typeof p.id === 'string' && p.id)) return conferencia;
    // SINCRONIZA ANTES DE CONFERIR. A ficha só se atualizava quando o cliente
    // abria GET /api/player-profiles; entre uma leitura e outra o elenco evolui
    // (treino, partida) e a ficha fica atrás. Conferir contra ficha velha corta
    // jogador HONESTO e marca a partida como suspeita — foi o que aconteceu com
    // `fair_play` 40 no elenco contra 39 na ficha. O sync lê `manager_squad`,
    // concilia e registra cada mudança no histórico, então o número conferido é
    // o de agora. Enquanto a evolução é do cliente (até a Fase 2C) é isto que o
    // servidor pode garantir: não que o atributo seja dele, mas que seja o MESMO
    // em todo canal — e que mudar deixe rastro.
    const { fichas: atualizadas } = await sincronizarFichas(sb, dono);
    if (!atualizadas.length) return conferencia;
    const fichas = new Map<string, FichaDoMotor>(
      atualizadas.map((f) => [f.player_id, { atributos: f.atributos, ovr: f.ovr, tracos: f.tracos, cerebro: f.cerebro }]),
    );
    body.home_team.lineup = conferirEscalacao(body.home_team.lineup, fichas, conferencia).escalacao;

    // FASE 3B — FORÇA DO TIME. `strength` escala a probabilidade de gol no
    // Python: mandar 95 é cheat mais barato que inflar atributo. O servidor
    // refaz a média de OVR pelas fichas.
    //
    // No replano do 2º tempo o cliente FIXA de propósito a força do 1º tempo
    // (`baseStrengthRef` em MatchQuickEngaged) — recalcular pela escalação nova,
    // com as substituições do intervalo, mudaria o jogo de quem joga limpo. Por
    // isso o 2º tempo herda a força do plano do 1º, pela seed.
    const daFicha = forcaDaEscalacao(body.home_team.lineup, fichas);
    if (daFicha !== null) {
      const enviada = Number(body.home_team.strength);
      let valor = daFicha;
      let fonte: 'ficha' | 'plano-do-1o-tempo' = 'ficha';
      if (body.mode === 'second_half') {
        const doPrimeiroTempo = await forcaDoPrimeiroTempo(sb, dono, String(body.seed));
        if (doPrimeiroTempo !== null) { valor = doPrimeiroTempo; fonte = 'plano-do-1o-tempo'; }
      }
      body.home_team.strength = valor;
      conferencia.forca = { daFicha, enviada: Number.isFinite(enviada) ? enviada : 0, fonte };
    }

    // FASE 4 (RPG) — o efeito dos traços entra aqui, DEPOIS da conferência: o
    // celular não sabe do traço e não poderia reivindicá-lo, então o envelope
    // não precisa acomodá-lo. Antes da impressão do cache, porque o traço muda
    // os números que vão ao motor.
    // FASE 5 (MANAGER-IDEAS) — o contexto que aciona o cérebro. `minhaForca`
    // vem da ficha (firme); a do adversário e o clássico vêm do pedido, e não
    // são brecha: inflar o adversário deixa a partida MAIS difícil no motor.
    const contexto = {
      minhaForca: conferencia.forca?.daFicha ?? null,
      forcaAdversario: Number(body.away_team?.strength) || 0,
      derby: body.is_derby === true,
      intensidade: body.home_team.intensity ?? 'balanced',
      segundoTempo: body.mode === 'second_half',
    } as const;
    const comTracos = aplicarTracos(body.home_team.lineup, fichas, contexto);
    body.home_team.lineup = comTracos.escalacao;
    if (comTracos.aplicados.jogadores > 0) {
      conferencia.tracos = comTracos.aplicados;
      const acionadas = Object.values(comTracos.aplicados.ideias ?? {}).flat();
      console.info(`[rpg] ajustes em ${comTracos.aplicados.jogadores} titular(es), ${comTracos.aplicados.pontos} ponto(s)`
        + (acionadas.length ? ` · ideias acionadas: ${[...new Set(acionadas)].join(', ')}` : '')
        + (comTracos.aplicados.dormindo ? ` · ${comTracos.aplicados.dormindo} dormindo` : ''));
    }

    // FADIGA — medida, nunca trocada. Ver `Conferencia.fadiga`.
    conferencia.fadiga = conferirFadiga(body.home_team.lineup, await fadigaConhecida(sb, dono));

    if (conferencia.corrigidos > 0) {
      console.warn(`[plano] ${conferencia.corrigidos} titular(es) fora da ficha: ${conferencia.motivos.slice(0, 3).join('; ')}`);
    }
    if (conferencia.forca && Math.abs(conferencia.forca.enviada - conferencia.forca.daFicha) > 1) {
      console.warn(`[plano] força enviada ${conferencia.forca.enviada} vs ficha ${conferencia.forca.daFicha} (usei ${body.home_team.strength}, fonte ${conferencia.forca.fonte})`);
    }
  } catch (e) {
    console.error('[plano] conferência falhou', e instanceof Error ? e.message : e);
  }
  return conferencia;
}

/**
 * Força do time que o servidor usou no plano do 1º TEMPO desta seed. O replano
 * do 2º tempo herda esse número — é o que o cliente faz, e recalcular com as
 * substituições do intervalo mudaria a partida de quem joga limpo.
 */
async function forcaDoPrimeiroTempo(
  sb: ReturnType<typeof getSupabaseAdmin>, dono: string, seed: string,
): Promise<number | null> {
  if (!sb) return null;
  const { data, error } = await sb.from('quick_plans_emitidos')
    .select('resumo').eq('owner_id', dono).eq('seed', seed.slice(0, 200)).eq('modo', 'full')
    .order('criado_em', { ascending: false }).limit(1).maybeSingle();
  if (error || !data) return null;
  const forca = (data.resumo as { conferencia?: { forca?: { daFicha?: unknown } } } | null)?.conferencia?.forca?.daFicha;
  return typeof forca === 'number' && Number.isFinite(forca) ? forca : null;
}

/**
 * Fadiga que o servidor conhece de cada jogador: `manager_game_state.player_health`
 * manda, com o `fatigue` do elenco como reserva — a mesma ordem de
 * `getEffectiveFatigue` (src/systems/fatigue.ts), que é o SSOT do jogo.
 *
 * Serve só para MEDIR: as duas fontes são escritas pelo snapshot do cliente e
 * podem estar atrás do jogo sem ninguém ter trapaceado.
 */
async function fadigaConhecida(
  sb: ReturnType<typeof getSupabaseAdmin>, dono: string,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!sb) return out;
  try {
    const [elenco, estado] = await Promise.all([
      sb.from('manager_squad').select('players').eq('user_id', dono).maybeSingle(),
      sb.from('manager_game_state').select('player_health').eq('user_id', dono).maybeSingle(),
    ]);
    for (const p of (elenco.data?.players ?? []) as Record<string, unknown>[]) {
      if (p && typeof p.id === 'string' && typeof p.fatigue === 'number') out.set(p.id, p.fatigue);
    }
    const saude = (estado.data?.player_health ?? {}) as Record<string, { fatigue?: unknown }>;
    for (const [id, h] of Object.entries(saude)) {
      if (h && typeof h.fatigue === 'number') out.set(id, h.fatigue);
    }
  } catch { /* medir é opcional: nunca derruba o plano */ }
  return out;
}

/**
 * CUSTÓDIA (SMART-PROFILE, Fase 2B): com manager logado, o plano emitido fica
 * registrado em `quick_plans_emitidos` e o id volta ao celular, que o cita no
 * relato do fim da partida. A conferência da Fase 3 viaja no resumo: o relato
 * que citar um plano corrigido sai `suspeita`. Sem login (visitante) ou sem a
 * tabela, a partida segue igual — só não há custódia. Nunca derruba o plano.
 */
async function guardarCustodia(
  dono: string | null, body: QuickPlanRequestBody, plan: unknown, conferencia: Conferencia,
): Promise<string | null> {
  try {
    const sb = getSupabaseAdmin();
    if (!dono || !sb) return null;
    const resumo = { ...resumirPlano(plan, body.home_team.lineup.map((p) => p.id)), conferencia };
    const { data, error } = await sb.from('quick_plans_emitidos')
      .insert({ owner_id: dono, seed: String(body.seed).slice(0, 200), modo: resumo.modo, resumo })
      .select('id').single();
    if (error) return null;
    return (data as { id: string }).id;
  } catch {
    return null;
  }
}

/** DNA do rival: do banco (dono do clube) ou, no Jogo da Fundação, o do fantasma (cliente, limpo). */
async function resolverDnaDoRival(body: QuickPlanRequestBody, dono: string | null): Promise<void> {
  if (body.fantasma === true) {
    body.away_team.dna = limparDna(body.away_team.dna);
    return;
  }
  const donoRival = await donoDoClube(body.away_short);
  body.away_team.dna = donoRival && donoRival !== dono ? await dnaDoUsuario(donoRival) : undefined;
}

export const matchPlanRoutes = new Hono();

/**
 * RELATÓRIO DE IDENTIDADE (Fundação, Fase 3). Um jogo não prova identidade
 * (o efeito do DNA some no ruído de uma partida), então o motor roda o MESMO
 * confronto em N seeds com e sem o DNA da casa e devolve as médias — a
 * diferença é o DNA. Mesmas regras do quick-plan: DNA da casa do banco,
 * escalação conferida contra as fichas. ~1,2 s pra 150 pares.
 */
const ANALISE_PARES = 150;
const analiseCache = new Map<string, { ts: number; analise: unknown }>();
matchPlanRoutes.post('/api/match/identidade', rateLimit(6), async (c) => {
  const body = await c.req.json<QuickPlanRequestBody>().catch(() => null);
  if (!body?.seed || !body.home_team || !body.away_team) {
    return c.json({ ok: false, error: 'campos obrigatórios: seed, home_team, away_team' }, 400);
  }
  const dono = await donoDaSessao(c.req.header('Authorization'));
  body.home_team.dna = (dono ? await dnaDoUsuario(dono) : undefined) ?? limparDna(body.home_team.dna);
  if (!body.home_team.dna) return c.json({ ok: false, error: 'clube sem identidade: nada a comparar' }, 400);
  await resolverDnaDoRival(body, dono);
  await conferirContraAsFichas(dono, body);
  delete body.mode;
  delete body.first_half;
  delete body.decisions;

  const chave = JSON.stringify({
    s: body.seed,
    dna: EIXOS_DNA.map((k) => body.home_team.dna?.[k] ?? '').join(','),
    dnaA: body.away_team.dna ? EIXOS_DNA.map((k) => body.away_team.dna?.[k] ?? '').join(',') : '',
    hs: body.home_team.strength,
    as: body.away_team.strength,
    af: impressaoDaEscalacao([body.home_team.lineup, body.away_team.lineup]),
  });
  const hit = analiseCache.get(chave);
  if (hit && Date.now() - hit.ts < 10 * 60_000) return c.json({ ok: true, analise: hit.analise, cached: true });

  const scriptPath = resolveScriptPath();
  if (!existsSync(scriptPath)) return c.json({ ok: false, error: `script Python não encontrado: ${scriptPath}` }, 500);
  try {
    const stdout = await runPython(scriptPath, JSON.stringify({ ...body, analise_identidade: ANALISE_PARES }), 20_000);
    const { analise } = JSON.parse(stdout) as { analise: unknown };
    analiseCache.set(chave, { ts: Date.now(), analise });
    return c.json({ ok: true, analise, cached: false });
  } catch (e) {
    return c.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 502);
  }
});

matchPlanRoutes.post('/api/match/quick-plan', rateLimit(20), async (c) => {
  const body = await c.req.json<QuickPlanRequestBody>().catch(() => null);
  if (!body?.seed || !body.home_team || !body.away_team) {
    return c.json({ ok: false, error: 'campos obrigatórios: seed, home_team, away_team' }, 400);
  }
  if (body.mode === 'second_half' && !body.first_half) {
    return c.json({ ok: false, error: "mode 'second_half' exige first_half" }, 400);
  }
  if (body.mode === 'from_minute' && (!body.estado || !Number.isFinite(Number(body.from_minute)))) {
    return c.json({ ok: false, error: "mode 'from_minute' exige from_minute e estado" }, 400);
  }

  // Narração no idioma do jogador (header X-Olefoot-Idioma). Só o TEXTO muda:
  // a partida em inglês é a mesma do português (test_cadeia_lances confere).
  body.lang = idiomaDoPedido(c);

  // FASE 3 — o motor para de receber atributo de fora. O dono sai do token uma
  // vez e serve à conferência e à custódia.
  const dono = await donoDaSessao(c.req.header('Authorization'));

  // DNA dos DOIS lados vem do banco (lineup_snapshot da Liga Global), não do
  // cliente. Sem sessão ou sem time inscrito, a casa usa o que o cliente
  // mandou (limpo); o adversário só joga com DNA se o dono dele tiver um.
  // Nunca o próprio DNA dos dois lados (amistoso contra si mesmo).
  const dnaCasaBanco = dono ? await dnaDoUsuario(dono) : undefined;
  body.home_team.dna = dnaCasaBanco ?? limparDna(body.home_team.dna);
  await resolverDnaDoRival(body, dono);
  const conferencia = await conferirContraAsFichas(dono, body);

  const cacheKey = JSON.stringify({
    lg: body.lang,
    s: body.seed,
    h: body.home_short,
    a: body.away_short,
    hi: body.home_team.intensity,
    hs: body.home_team.strength,
    as: body.away_team.strength,
    hl: body.home_team.lineup.map((p) => p.id).join(','),
    al: body.away_team.lineup.map((p) => p.id).join(','),
    m: body.mode ?? 'full',
    // LEGACY (Fase 4b): replan do meio do jogo — minuto, estado e comandos entram na chave.
    fm: body.mode === 'from_minute' ? Number(body.from_minute) : '',
    est: body.estado ? `${body.estado.home_score}-${body.estado.away_score}-${body.estado.momentum_end ?? 50}-${body.estado.sent_off_home ?? 0}-${body.estado.sent_off_away ?? 0}` : '',
    cmd: Array.isArray(body.comandos) ? JSON.stringify(body.comandos).slice(0, 4000) : '',
    fh: body.first_half
      ? `${body.first_half.home_score}-${body.first_half.away_score}-${body.first_half.momentum_end ?? 50}`
      : '',
    d: (body.decisions ?? [])
      .map((d) => `${d.channel}:${d.target_side ?? 'home'}:${d.weight}`)
      .join('|'),
    // Derby entra na chave — mesmo seed com/sem clássico são planos distintos.
    dy: body.is_derby === true ? 1 : 0,
    f: body.fantasma === true ? 1 : 0,
    // DNA da fundação: mesmo seed com DNA diferente = plano diferente.
    dna: body.home_team.dna ? EIXOS_DNA.map((k) => body.home_team.dna?.[k] ?? '').join(',') : '',
    dnaA: body.away_team.dna ? EIXOS_DNA.map((k) => body.away_team.dna?.[k] ?? '').join(',') : '',
    // Os NÚMEROS que vão ao motor (já conferidos). Antes a chave olhava só os
    // ids: ativar a lenda não mudava o plano dentro da janela do cache, e um
    // pedido adulterado deixava o plano dele para o próximo. Ver
    // `impressaoDaEscalacao`.
    af: impressaoDaEscalacao([body.home_team.lineup, body.away_team.lineup]),
  });
  // PARTIDA VIVA: a classe de cada jogador em campo viaja com o plano (só apresentação).
  const classes = classesDaPartida([body.home_team.lineup, body.away_team.lineup]);
  const cached = simpleCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return c.json({ ok: true, plan: { ...(cached.plan as object), classes }, cached: true, plano_id: await guardarCustodia(dono, body, cached.plan, conferencia) });
  }

  const scriptPath = resolveScriptPath();
  if (!existsSync(scriptPath)) {
    return c.json({ ok: false, error: `script Python não encontrado: ${scriptPath}` }, 500);
  }

  try {
    const stdout = await runPython(scriptPath, JSON.stringify(body));
    const plan = JSON.parse(stdout);
    simpleCache.set(cacheKey, { ts: Date.now(), plan });
    return c.json({ ok: true, plan: { ...plan, classes }, cached: false, plano_id: await guardarCustodia(dono, body, plan, conferencia) });
  } catch (e) {
    return c.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 502);
  }
});
