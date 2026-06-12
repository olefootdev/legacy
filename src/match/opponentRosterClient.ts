/**
 * Cliente do elenco real do adversário.
 *
 * A Partida Rápida não pode inventar jogadores: todos os times da Liga Global
 * têm plantel em `manager_squad`. Este client pede ao backend os 11 titulares
 * REAIS do clube adversário (resolvidos por profiles → manager_squad). Qualquer
 * falha → null, e o chamador decide o fallback.
 */

import type { PlayerEntity } from '@/entities/types';

const ENV = (import.meta as { env?: Record<string, string | undefined> }).env;

const API_BASE =
  ENV?.VITE_OLEFOOT_API_URL ||
  ENV?.VITE_API_URL ||
  'http://localhost:4000';

export interface OpponentRoster {
  players: PlayerEntity[];
  formationScheme: string | null;
}

export async function fetchOpponentRoster(args: {
  clubName?: string;
  clubShort?: string;
}): Promise<OpponentRoster | null> {
  if (!args.clubName && !args.clubShort) return null;
  try {
    const res = await fetch(`${API_BASE}/api/match/opponent-roster`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubName: args.clubName, clubShort: args.clubShort }),
    });
    if (!res.ok) return null;
    const body = await res.json();
    if (!body?.ok || !Array.isArray(body?.players) || body.players.length < 7) return null;
    return { players: body.players as PlayerEntity[], formationScheme: body.formationScheme ?? null };
  } catch {
    return null;
  }
}
