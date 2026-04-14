/**
 * Testes de integração locais com OpenAI (GameSpirit /api/gamespirit).
 *
 * SDK (sem servidor HTTP):
 *   npm run test:openai --prefix server
 *
 * HTTP (servidor Hono noutro terminal: npm run dev:server):
 *   npm run test:openai:http --prefix server
 *
 * URL do servidor: TEST_OLEFOOT_API_URL ou http://127.0.0.1:4000
 *
 * Requer OPENAI_API_KEY em server/.env (modo SDK e modo HTTP no servidor).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { getGameDecision } from '../src/services/openai/getGameDecision.js';
import type { GameSpiritDecisionContext } from '../src/services/openai/gameSpiritContext.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function assertShape(
  r: { decision: string; narration: string; confidence: number },
  label: string,
): void {
  assert(typeof r.decision === 'string' && r.decision.length > 0, `${label}: decision`);
  assert(typeof r.narration === 'string' && r.narration.length > 0, `${label}: narration`);
  assert(
    typeof r.confidence === 'number' && r.confidence >= 0 && r.confidence <= 1,
    `${label}: confidence 0..1`,
  );
}

const sampleA: GameSpiritDecisionContext = {
  player: 'LD 2',
  position: 'att_third',
  ballOwner: true,
  pressureLevel: 'medium',
  nearbyPlayers: ['MC 8', 'PD 11'],
  objective: 'build_play',
};

const sampleB: GameSpiritDecisionContext = {
  player: 'MC 8',
  position: 'mid',
  ballOwner: false,
  pressureLevel: 'high',
  nearbyPlayers: ['ST 9'],
  objective: 'defend_transition',
};

async function runSdk(): Promise<void> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error('[test:openai] Falta OPENAI_API_KEY em server/.env');
    process.exit(1);
  }

  console.log('[test:openai] SDK getGameDecision — contexto A…');
  const a = await getGameDecision(sampleA);
  console.log(JSON.stringify(a, null, 2));
  assertShape(a, 'A');

  console.log('[test:openai] SDK getGameDecision — contexto B…');
  const b = await getGameDecision(sampleB);
  console.log(JSON.stringify(b, null, 2));
  assertShape(b, 'B');

  console.log('[test:openai] SDK: OK.');
}

async function runHttp(): Promise<void> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error('[test:openai:http] OPENAI_API_KEY deve estar em server/.env (o servidor lê o mesmo .env).');
    process.exit(1);
  }

  const base = (process.env.TEST_OLEFOOT_API_URL ?? 'http://127.0.0.1:4000').replace(/\/$/, '');
  const url = `${base}/api/gamespirit`;
  console.log('[test:openai:http] POST', url);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context: sampleA }),
  });
  const text = await res.text();
  let j: unknown;
  try {
    j = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Resposta não-JSON (HTTP ${res.status}): ${text.slice(0, 400)}`);
  }
  assert(res.ok && j && typeof j === 'object', `HTTP ${res.status}: ${text.slice(0, 400)}`);
  const o = j as Record<string, unknown>;
  assertShape(
    {
      decision: String(o.decision ?? ''),
      narration: String(o.narration ?? ''),
      confidence: Number(o.confidence),
    },
    'HTTP',
  );
  console.log(JSON.stringify(j, null, 2));
  console.log('[test:openai:http] OK.');
}

const http = process.argv.includes('--http');

try {
  if (http) {
    await runHttp();
  } else {
    await runSdk();
  }
  process.exit(0);
} catch (e) {
  console.error('[test:openai] Falha:', e instanceof Error ? e.message : e);
  process.exit(1);
}
