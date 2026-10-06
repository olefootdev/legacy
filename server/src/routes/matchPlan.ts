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
}

interface QuickPlanTeamInput {
  strength: number;
  intensity?: 'defensive' | 'balanced' | 'offensive';
  lineup: QuickPlanPlayerInput[];
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
  /** Fase A (Quick 2.0): 'second_half' = replan dos minutos 46-90. */
  mode?: 'full' | 'second_half';
  first_half?: QuickPlanFirstHalfInput;
  decisions?: QuickPlanDecisionInput[];
  /** FABLE — DERBY/CLÁSSICO: Python amplia agressividade dos 2 lados (~×1.12). */
  is_derby?: boolean;
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
      atualizadas.map((f) => [f.player_id, { atributos: f.atributos, ovr: f.ovr, tracos: f.tracos }]),
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
    const comTracos = aplicarTracos(body.home_team.lineup, fichas);
    body.home_team.lineup = comTracos.escalacao;
    if (comTracos.aplicados.jogadores > 0) {
      conferencia.tracos = comTracos.aplicados;
      console.info(`[rpg] traços em ${comTracos.aplicados.jogadores} titular(es), +${comTracos.aplicados.pontos} ponto(s)`);
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

export const matchPlanRoutes = new Hono();

matchPlanRoutes.post('/api/match/quick-plan', rateLimit(20), async (c) => {
  const body = await c.req.json<QuickPlanRequestBody>().catch(() => null);
  if (!body?.seed || !body.home_team || !body.away_team) {
    return c.json({ ok: false, error: 'campos obrigatórios: seed, home_team, away_team' }, 400);
  }
  if (body.mode === 'second_half' && !body.first_half) {
    return c.json({ ok: false, error: "mode 'second_half' exige first_half" }, 400);
  }

  // FASE 3 — o motor para de receber atributo de fora. O dono sai do token uma
  // vez e serve à conferência e à custódia.
  const dono = await donoDaSessao(c.req.header('Authorization'));
  const conferencia = await conferirContraAsFichas(dono, body);

  const cacheKey = JSON.stringify({
    s: body.seed,
    h: body.home_short,
    a: body.away_short,
    hi: body.home_team.intensity,
    hs: body.home_team.strength,
    as: body.away_team.strength,
    hl: body.home_team.lineup.map((p) => p.id).join(','),
    al: body.away_team.lineup.map((p) => p.id).join(','),
    m: body.mode ?? 'full',
    fh: body.first_half
      ? `${body.first_half.home_score}-${body.first_half.away_score}-${body.first_half.momentum_end ?? 50}`
      : '',
    d: (body.decisions ?? [])
      .map((d) => `${d.channel}:${d.target_side ?? 'home'}:${d.weight}`)
      .join('|'),
    // Derby entra na chave — mesmo seed com/sem clássico são planos distintos.
    dy: body.is_derby === true ? 1 : 0,
    // Os NÚMEROS que vão ao motor (já conferidos). Antes a chave olhava só os
    // ids: ativar a lenda não mudava o plano dentro da janela do cache, e um
    // pedido adulterado deixava o plano dele para o próximo. Ver
    // `impressaoDaEscalacao`.
    af: impressaoDaEscalacao([body.home_team.lineup, body.away_team.lineup]),
  });
  const cached = simpleCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return c.json({ ok: true, plan: cached.plan, cached: true, plano_id: await guardarCustodia(dono, body, cached.plan, conferencia) });
  }

  const scriptPath = resolveScriptPath();
  if (!existsSync(scriptPath)) {
    return c.json({ ok: false, error: `script Python não encontrado: ${scriptPath}` }, 500);
  }

  try {
    const stdout = await runPython(scriptPath, JSON.stringify(body));
    const plan = JSON.parse(stdout);
    simpleCache.set(cacheKey, { ts: Date.now(), plan });
    return c.json({ ok: true, plan, cached: false, plano_id: await guardarCustodia(dono, body, plan, conferencia) });
  } catch (e) {
    return c.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 502);
  }
});
