/**
 * Opponent Roster — resolve o elenco REAL de um clube adversário.
 *
 * Problema: a Partida Rápida / Clássico precisam dos jogadores de verdade do
 * adversário (todos os times da Liga Global têm plantel em `manager_squad`).
 * O fixture da liga só carrega nome/short do clube, então aqui fazemos o JOIN:
 *
 *   profiles (club_name/club_short) → id (UUID) → manager_squad.players
 *
 * Devolve os 11 titulares (pela lineup; senão top OVR), com os PlayerEntity
 * completos pro motor + cards. Cache em memória por clube (5 min).
 */

import { Hono } from 'hono';
import { rateLimit } from '../lib/rateLimit.js';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';

interface ReqBody {
  clubName?: string;
  clubShort?: string;
}

interface PlayerLike {
  id?: string;
  name?: string;
  pos?: string;
  attrs?: Record<string, number>;
  [k: string]: unknown;
}

const cache = new Map<string, { ts: number; players: PlayerLike[]; formationScheme: string | null }>();
const CACHE_TTL_MS = 5 * 60_000;

/** OVR simples (média dos atributos) — só pra ordenar/escolher os 11. */
function approxOvr(p: PlayerLike): number {
  const a = p.attrs ?? {};
  const vals = Object.values(a).filter((v) => typeof v === 'number') as number[];
  if (!vals.length) return 0;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

const normName = (p: PlayerLike) => String(p.name ?? '').trim().toLowerCase();

/**
 * Top 11 DISTINTOS: respeita a lineup quando existe; senão, melhores por OVR.
 * Deduplica por id E por nome — alguns saves têm jogadores duplicados (mesmo
 * nome, ids diferentes); exibir "Fulano" 3× parece bug. Completa com o resto
 * do elenco real (nunca inventa).
 */
function pickEleven(players: PlayerLike[], lineup: Record<string, unknown> | null): PlayerLike[] {
  const byId = new Map(players.filter((p) => typeof p.id === 'string').map((p) => [p.id as string, p]));
  const out: PlayerLike[] = [];
  const seenId = new Set<string>();
  const seenName = new Set<string>();
  const take = (p: PlayerLike): boolean => {
    const id = p.id as string;
    const nm = normName(p);
    if (seenId.has(id) || (nm && seenName.has(nm))) return false;
    out.push(p); seenId.add(id); if (nm) seenName.add(nm);
    return true;
  };

  if (lineup && typeof lineup === 'object') {
    for (const pid of Object.values(lineup)) {
      if (typeof pid !== 'string') continue;
      const p = byId.get(pid);
      if (p) take(p);
      if (out.length >= 11) break;
    }
  }
  if (out.length < 11) {
    const rest = players
      .filter((p) => typeof p.id === 'string')
      .sort((a, b) => approxOvr(b) - approxOvr(a));
    for (const p of rest) {
      take(p);
      if (out.length >= 11) break;
    }
  }
  return out.slice(0, 11);
}

export const opponentRosterRoutes = new Hono();

opponentRosterRoutes.post('/api/match/opponent-roster', rateLimit(30), async (c) => {
  const body = await c.req.json<ReqBody>().catch(() => null);
  const clubName = body?.clubName?.trim();
  const clubShort = body?.clubShort?.trim();
  if (!clubName && !clubShort) {
    return c.json({ ok: false, error: 'informe clubName ou clubShort' }, 400);
  }

  const key = `${(clubShort ?? '').toLowerCase()}|${(clubName ?? '').toLowerCase()}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return c.json({ ok: true, players: cached.players, formationScheme: cached.formationScheme, cached: true });
  }

  const sb = getSupabaseAdmin();
  if (!sb) return c.json({ ok: false, error: 'supabase indisponível' }, 503);

  try {
    // 1) Resolve o clube → profile (UUID). club_short é mais único; cai pro nome.
    let profileId: string | null = null;
    if (clubShort) {
      const { data } = await sb.from('profiles').select('id').ilike('club_short', clubShort).limit(1);
      profileId = (data?.[0] as { id?: string } | undefined)?.id ?? null;
    }
    if (!profileId && clubName) {
      const { data } = await sb.from('profiles').select('id').ilike('club_name', clubName).limit(1);
      profileId = (data?.[0] as { id?: string } | undefined)?.id ?? null;
    }
    if (!profileId) {
      return c.json({ ok: false, error: 'clube sem profile correspondente' }, 404);
    }

    // 2) manager_squad do dono do clube.
    const { data: sq } = await sb
      .from('manager_squad')
      .select('players, lineup, formation_scheme')
      .eq('user_id', profileId)
      .maybeSingle();

    const players = Array.isArray((sq as { players?: PlayerLike[] } | null)?.players)
      ? ((sq as { players: PlayerLike[] }).players)
      : [];
    if (players.length < 7) {
      return c.json({ ok: false, error: 'elenco real insuficiente' }, 404);
    }

    const lineup = (sq as { lineup?: Record<string, unknown> } | null)?.lineup ?? null;
    const formationScheme = (sq as { formation_scheme?: string } | null)?.formation_scheme ?? null;
    const eleven = pickEleven(players, lineup);

    cache.set(key, { ts: Date.now(), players: eleven, formationScheme });
    return c.json({ ok: true, players: eleven, formationScheme, cached: false });
  } catch (e) {
    return c.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
