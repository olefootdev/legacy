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
  price_unit_cents: number | null;
  currency: string | null;
  listed_on_market: boolean;
  country: string | null;
  age: number | null;
  strong_foot: string | null;
  creator_label: string | null;
  rarity_label: string | null;
  collection_id: string | null;
  collection_code: string | null;
  collection_title: string | null;
  bio: string | null;
  portrait_storage_path: string | null;
  portrait_public_url: string | null;
  /** Enquadramento (ponto focal) — foco 0..1 + zoom. Default 0.5/0.0/1. */
  portrait_focus_x: number | null;
  portrait_focus_y: number | null;
  portrait_zoom: number | null;
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

/**
 * Estilo CSS do enquadramento (ponto focal): object-position no foco + zoom
 * com transform-origin no mesmo ponto. Aplicar num <img object-cover>.
 * Use em token, profile e cards — uma fonte de imagem só.
 */
export function portraitFocusStyle(
  fx?: number | null,
  fy?: number | null,
  zoom?: number | null,
): import('react').CSSProperties {
  const x = Math.max(0, Math.min(1, typeof fx === 'number' ? fx : 0.5));
  const y = Math.max(0, Math.min(1, typeof fy === 'number' ? fy : 0));
  const z = Math.max(0.5, Math.min(3, typeof zoom === 'number' ? zoom : 1));
  const pos = `${(x * 100).toFixed(1)}% ${(y * 100).toFixed(1)}%`;
  return {
    objectFit: 'cover',
    objectPosition: pos,
    ...(z !== 1 ? { transform: `scale(${z})`, transformOrigin: pos } : {}),
  };
}

/** Conveniência: estilo direto a partir de uma LegacyPlayerRow. */
export function legacyPortraitFocusStyle(
  row: Pick<LegacyPlayerRow, 'portrait_focus_x' | 'portrait_focus_y' | 'portrait_zoom'>,
): import('react').CSSProperties {
  return portraitFocusStyle(row.portrait_focus_x, row.portrait_focus_y, row.portrait_zoom);
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
    // BUG FIX: row.id já pode vir com o prefixo "legacy-" (ex.: legacy-juca-
    // consolidacao). Sem o guard, virava "legacy-legacy-..." (id duplicado).
    id: row.id.startsWith('legacy-') ? row.id : `legacy-${row.id}`,
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
    portraitFocus: {
      x: typeof row.portrait_focus_x === 'number' ? row.portrait_focus_x : 0.5,
      y: typeof row.portrait_focus_y === 'number' ? row.portrait_focus_y : 0,
      zoom: typeof row.portrait_zoom === 'number' ? row.portrait_zoom : 1,
    },
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

/**
 * Persiste o positionKnowledge evoluído de um jogador com isLegacy: true.
 * Usa a tabela `legacy_players` via upsert parcial — só atualiza o campo
 * `position_knowledge` (JSONB) sem tocar nos outros campos.
 *
 * O `legacyId` é o UUID sem o prefixo "legacy-" (ex: "legacy-abc123" → "abc123").
 * Silencia erros de coluna inexistente (migration pendente) para não quebrar o fluxo.
 */
export async function syncLegacyPlayerPositionKnowledge(
  legacyPlayerId: string,
  positionKnowledge: unknown,
): Promise<{ ok: boolean; reason?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: 'no_client' };

  // Remove prefixo "legacy-" se presente
  const rawId = legacyPlayerId.startsWith('legacy-')
    ? legacyPlayerId.slice('legacy-'.length)
    : legacyPlayerId;

  try {
    const { error } = await sb
      .from('legacy_players')
      .update({ position_knowledge: positionKnowledge, updated_at: new Date().toISOString() } as never)
      .eq('id', rawId);

    if (error) {
      // Coluna pode não existir ainda (migration pendente) — não é erro crítico
      if (error.message.includes('column') || error.message.includes('position_knowledge')) {
        console.info('[legacyPlayers] position_knowledge column not yet migrated, skipping sync.');
        return { ok: false, reason: 'column_missing' };
      }
      console.warn('[legacyPlayers] syncPositionKnowledge:', error.message);
      return { ok: false, reason: error.message };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
