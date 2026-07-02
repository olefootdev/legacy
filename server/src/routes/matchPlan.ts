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

export const matchPlanRoutes = new Hono();

matchPlanRoutes.post('/api/match/quick-plan', rateLimit(20), async (c) => {
  const body = await c.req.json<QuickPlanRequestBody>().catch(() => null);
  if (!body?.seed || !body.home_team || !body.away_team) {
    return c.json({ ok: false, error: 'campos obrigatórios: seed, home_team, away_team' }, 400);
  }
  if (body.mode === 'second_half' && !body.first_half) {
    return c.json({ ok: false, error: "mode 'second_half' exige first_half" }, 400);
  }

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
  });
  const cached = simpleCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return c.json({ ok: true, plan: cached.plan, cached: true });
  }

  const scriptPath = resolveScriptPath();
  if (!existsSync(scriptPath)) {
    return c.json({ ok: false, error: `script Python não encontrado: ${scriptPath}` }, 500);
  }

  try {
    const stdout = await runPython(scriptPath, JSON.stringify(body));
    const plan = JSON.parse(stdout);
    simpleCache.set(cacheKey, { ts: Date.now(), plan });
    return c.json({ ok: true, plan, cached: false });
  } catch (e) {
    return c.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 502);
  }
});
