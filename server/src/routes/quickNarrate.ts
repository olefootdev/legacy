/**
 * Quick Narrate — enriquece a narração da Partida Rápida 2.0 via Sonnet.
 *
 * O MatchPlan vem do Python (determinístico, ~5ms). A narração textual dele é
 * template local. Esta rota recebe os MOMENTOS-CHAVE (analyst beats + gols, com
 * destaque pro gol da vitória) e devolve narração rica em pt-BR (voz Legacy
 * Tech: emoção sem clichê, sem emoji). Pré-buscável: o frontend chama UMA vez
 * quando o plano chega; o resultado é mesclado nos beats e na comemoração.
 *
 * Custo controlado: UMA chamada Sonnet por partida, cache em memória por
 * fingerprint (seed + placar + ids dos beats). Sem chave Anthropic → 503 e o
 * frontend cai no texto do Python (degradação graciosa).
 */

import { Hono } from 'hono';
import { rateLimit } from '../lib/rateLimit.js';
import { callAnthropic, hasAnthropicKey, jsonSystemPrompt } from '../lib/anthropic.js';

interface BeatInput {
  id: string;
  minute: number;
  intent?: 'attack' | 'defend' | 'neutral';
  insight: string;
  primary?: string;
  threat?: string;
}

interface GoalInput {
  minute: number;
  actor?: string;
  side: 'home' | 'away';
  is_winner?: boolean;
  score_after?: string;
}

interface QuickNarrateBody {
  seed: string;
  home: string;
  away: string;
  home_score: number;
  away_score: number;
  narrative_arc?: string;
  beats?: BeatInput[];
  goals?: GoalInput[];
}

export interface QuickNarration {
  beats: Record<string, string>;
  goals: Record<string, string>;
  reading?: string;
}

const cache = new Map<string, { ts: number; data: QuickNarration }>();
const CACHE_TTL_MS = 10 * 60_000;

function fingerprint(b: QuickNarrateBody): string {
  return [
    b.seed,
    `${b.home_score}-${b.away_score}`,
    (b.beats ?? []).map((x) => x.id).join(','),
    (b.goals ?? []).map((g) => `${g.minute}${g.side}`).join(','),
  ].join('|');
}

const SYSTEM = jsonSystemPrompt(
  [
    'Você é o narrador-analista do Olefoot — futebol brasileiro, voz Legacy Tech.',
    'Estilo: PORTUGUÊS DO BRASIL, emoção real sem clichê batido, frases curtas e',
    'concretas. Nunca use emoji. Nunca use "equipa"/"relvado" (isso é de Portugal).',
    'Cada narração é uma única frase de impacto (máx ~16 palavras).',
    'Beats = leitura tática do momento (o que está acontecendo no setor do campo).',
    'Gols = o estouro emocional; o gol da vitória (is_winner) é o ápice, capriche.',
    'Use os nomes próprios (jogador/clube) quando vierem — eles carregam a emoção.',
  ].join(' '),
  '{ "beats": { "<beat_id>": "frase" }, "goals": { "<minuto>": "frase" }, "reading": "uma frase de fecho sobre a leitura do jogo" }',
);

export const quickNarrateRoutes = new Hono();

quickNarrateRoutes.post('/api/match/quick-narrate', rateLimit(20), async (c) => {
  const body = await c.req.json<QuickNarrateBody>().catch(() => null);
  if (!body?.seed) {
    return c.json({ ok: false, error: 'campo obrigatório: seed' }, 400);
  }
  if (!hasAnthropicKey()) {
    return c.json({ ok: false, error: 'narração IA indisponível (sem chave)' }, 503);
  }

  const key = fingerprint(body);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return c.json({ ok: true, narration: cached.data, cached: true });
  }

  const user = JSON.stringify({
    confronto: `${body.home} x ${body.away}`,
    placar_final: `${body.home_score}-${body.away_score}`,
    arco: body.narrative_arc ?? 'balanced',
    beats: (body.beats ?? []).map((b) => ({
      id: b.id,
      minuto: b.minute,
      intencao: b.intent ?? 'neutral',
      leitura: b.insight,
      setor_forte: b.primary,
      ameaca: b.threat,
    })),
    gols: (body.goals ?? []).map((g) => ({
      minuto: g.minute,
      autor: g.actor,
      lado: g.side === 'home' ? body.home : body.away,
      e_da_casa: g.side === 'home',
      gol_da_vitoria: !!g.is_winner,
      placar_apos: g.score_after,
    })),
  });

  const res = await callAnthropic<QuickNarration>({
    model: 'sonnet',
    system: SYSTEM,
    user,
    expectJson: true,
    maxTokens: 900,
    temperature: 0.85,
    timeoutMs: 20_000,
  });

  if (!res.ok || !res.json) {
    return c.json({ ok: false, error: res.error ?? 'falha na narração' }, 502);
  }

  const data: QuickNarration = {
    beats: res.json.beats ?? {},
    goals: res.json.goals ?? {},
    reading: res.json.reading,
  };
  cache.set(key, { ts: Date.now(), data });
  return c.json({ ok: true, narration: data, cached: false });
});
