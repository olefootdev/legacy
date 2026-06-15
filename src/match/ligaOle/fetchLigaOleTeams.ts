/**
 * fetchLigaOleTeams.ts — sorteia times REAIS de managers pra Liga Ole.
 *
 * Regra de ouro (pedido do fundador): os 32 times são SEMPRE de managers reais,
 * com elencos reais — NUNCA times externos/sintéticos. A fonte é a tabela
 * `global_league_teams` (managers cadastrados). O elenco real de cada adversário
 * é resolvido na hora da partida via fetchOpponentRoster (profiles → manager_squad).
 */

import { getSupabase, isSupabaseConfigured } from '@/supabase/client';
import type { LigaOleTeam } from './ligaOleModel';

interface TeamRow {
  id: string;
  club_name: string;
  club_short: string;
  overall: number;
}

/** Embaralhamento determinístico (seed) — mesmo sorteio replicável. */
function seededShuffle<T>(arr: T[], seed: string): T[] {
  let a = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) a = Math.imul(a ^ seed.charCodeAt(i), 3432918353);
  const rng = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Busca `count` rivais reais. Exclui o clube do manager por NOME e por SHORT
 * (case-insensitive) — o banco pode ter um short diferente do da store, então só
 * o short não basta: sem isso o manager cairia contra si mesmo no chaveamento.
 * Sorteio determinístico por seed. Retorna LigaOleTeam (id = global_league_teams).
 */
export async function fetchLigaOleRivals(args: {
  excludeShort: string;
  excludeName: string;
  excludeManagerId?: string | null;
  count: number;
  seed: string;
}): Promise<LigaOleTeam[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabase();
  if (!sb) return [];
  const norm = (s: string | undefined | null) => String(s ?? '').trim().toLowerCase();
  const exShort = norm(args.excludeShort);
  const exName = norm(args.excludeName);
  const exMgr = norm(args.excludeManagerId);
  try {
    const { data, error } = await sb
      .from('global_league_teams')
      .select('id, manager_id, club_name, club_short, overall')
      .gt('overall', 0)
      .limit(200);
    if (error || !Array.isArray(data)) return [];
    const seenName = new Set<string>();
    const rows = (data as Array<TeamRow & { manager_id?: string }>).filter((t) => {
      if (Number(t.overall) <= 0) return false;
      // É o clube do próprio manager? (por id de manager, nome ou short) → fora.
      if (exMgr && norm(t.manager_id) === exMgr) return false;
      if (exShort && norm(t.club_short) === exShort) return false;
      if (exName && norm(t.club_name) === exName) return false;
      // Sem clubes duplicados no chaveamento (mesmo nome aparecendo 2×).
      const key = norm(t.club_name);
      if (seenName.has(key)) return false;
      seenName.add(key);
      return true;
    });
    const picked = seededShuffle(rows, args.seed).slice(0, args.count);
    return picked.map((t) => ({
      id: t.id,
      name: t.club_name || 'Clube Rival',
      short: t.club_short || 'RIV',
      overall: Math.round(Number(t.overall)),
      managerId: t.manager_id ? String(t.manager_id) : undefined,
    }));
  } catch {
    return [];
  }
}
