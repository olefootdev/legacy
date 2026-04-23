import { getSupabase } from '@/supabase/client';
import { createPlayer, overallFromAttributes } from '@/entities/player';
import type {
  PlayerAttributes,
  PlayerEntity,
  PlayerStrongFoot,
} from '@/entities/types';

export type LegacyPlayerRow = {
  id: string;
  name: string;
  pos: string;
  pos_original: string | null;
  attributes: Record<string, number>;
  taught_attributes: string[];
  team_booster: Record<string, number>;
  price_bro_cents: number;
  listed_on_market: boolean;
  country: string | null;
  age: number | null;
  strong_foot: string | null;
  creator_label: string | null;
  rarity_label: string | null;
  bio: string | null;
  portrait_storage_path: string | null;
  portrait_public_url: string | null;
  card_supply: number | null;
  created_at: string | null;
  updated_at: string | null;
};

export type LegacyMentorshipRow = {
  student_player_id: string;
  manager_id: string;
  legacy_id: string;
  learned_attributes: Record<string, number>;
  started_at: string;
  last_tick_at: string;
  updated_at: string;
};

function supabasePublicUrl(): string | undefined {
  const raw = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const u = raw?.trim();
  return u ? u.replace(/\/$/, '') : undefined;
}

export function legacyPortraitImageUrl(row: Pick<LegacyPlayerRow, 'portrait_public_url' | 'portrait_storage_path' | 'updated_at'>): string | undefined {
  const direct = row.portrait_public_url?.trim();
  if (direct) return direct;
  const path = row.portrait_storage_path?.trim();
  if (!path) return undefined;
  const base = supabasePublicUrl();
  if (!base) return undefined;
  const bust = row.updated_at ? `?v=${new Date(row.updated_at).getTime() || Date.now()}` : '';
  return `${base}/storage/v1/object/public/legacy-player-portraits/${path.replace(/^\//, '')}${bust}`;
}

function attrsFromRow(attributes: Record<string, unknown> | null | undefined): PlayerAttributes {
  const a = attributes && typeof attributes === 'object' ? attributes : {};
  const num = (k: keyof PlayerAttributes, d: number) => {
    const v = (a as Record<string, unknown>)[k as string];
    return typeof v === 'number' && Number.isFinite(v) ? v : d;
  };
  return {
    passe: num('passe', 70),
    marcacao: num('marcacao', 70),
    velocidade: num('velocidade', 70),
    drible: num('drible', 70),
    finalizacao: num('finalizacao', 70),
    fisico: num('fisico', 70),
    tatico: num('tatico', 70),
    mentalidade: num('mentalidade', 70),
    confianca: num('confianca', 70),
    fairPlay: num('fairPlay', 70),
  };
}

export function legacyRowToPlayerEntity(row: LegacyPlayerRow): PlayerEntity {
  const attrs = attrsFromRow(row.attributes);
  const sf = row.strong_foot?.trim().toLowerCase();
  const strongFoot: PlayerStrongFoot | undefined =
    sf === 'right' || sf === 'left' || sf === 'both' ? sf : undefined;
  const ovr = overallFromAttributes(attrs);
  return createPlayer({
    id: `legacy-${row.id}`,
    num: 99,
    name: row.name.trim(),
    pos: row.pos.trim(),
    archetype: 'lenda',
    behavior: 'equilibrado',
    attrs,
    fatigue: 0,
    injuryRisk: 0,
    evolutionXp: 0,
    outForMatches: 0,
    portraitUrl: legacyPortraitImageUrl(row),
    country: row.country?.trim() || undefined,
    strongFoot,
    rarity: 'epico',
    bio: row.bio?.trim() || undefined,
    listedOnMarket: false,
    age: row.age != null && Number.isFinite(row.age) ? Math.round(row.age) : undefined,
    mintOverall: ovr,
    isLegacy: true,
    legacyTeamBooster: row.team_booster ?? {},
    legacyTaughtAttributes: Array.isArray(row.taught_attributes) ? row.taught_attributes : [],
  });
}

export async function fetchAllLegacyPlayerRows(): Promise<LegacyPlayerRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from('legacy_players').select('*').order('name', { ascending: true });
  if (error) {
    console.warn('[legacyPlayers] fetch:', error.message);
    return [];
  }
  return (data ?? []) as LegacyPlayerRow[];
}

export async function fetchListedLegacyPlayerRows(): Promise<LegacyPlayerRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from('legacy_players').select('*').eq('listed_on_market', true).order('name', { ascending: true });
  if (error) {
    console.warn('[legacyPlayers] fetch listed:', error.message);
    return [];
  }
  return (data ?? []) as LegacyPlayerRow[];
}

export async function upsertLegacyPlayer(row: Partial<LegacyPlayerRow> & { id: string; name: string; pos: string }): Promise<LegacyPlayerRow | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const payload = { ...row, updated_at: new Date().toISOString() };
  const { data, error } = await sb.from('legacy_players').upsert(payload).select('*').single();
  if (error) {
    console.warn('[legacyPlayers] upsert:', error.message);
    return null;
  }
  return data as LegacyPlayerRow;
}

export async function deleteLegacyPlayer(id: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from('legacy_players').delete().eq('id', id);
  if (error) {
    console.warn('[legacyPlayers] delete:', error.message);
    return false;
  }
  return true;
}

export async function setLegacyMentor(studentPlayerId: string, legacyId: string): Promise<LegacyMentorshipRow | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('set_legacy_mentor', {
    p_student_player_id: studentPlayerId,
    p_legacy_id: legacyId,
  });
  if (error) {
    console.warn('[legacyPlayers] set_legacy_mentor:', error.message);
    return null;
  }
  return (Array.isArray(data) ? data[0] : data) as LegacyMentorshipRow | null;
}

export async function tickLegacyMentorships(): Promise<number> {
  const sb = getSupabase();
  if (!sb) return 0;
  const { data, error } = await sb.rpc('tick_legacy_mentorships');
  if (error) {
    console.warn('[legacyPlayers] tick:', error.message);
    return 0;
  }
  return Array.isArray(data) ? data.length : 0;
}

export async function fetchMyMentorships(): Promise<LegacyMentorshipRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from('legacy_mentorships').select('*');
  if (error) {
    console.warn('[legacyPlayers] fetch mentorships:', error.message);
    return [];
  }
  return (data ?? []) as LegacyMentorshipRow[];
}
