/**
 * OLEFOOT PYTHON MODE — Sync com Supabase.
 *
 * Persiste consequências, presença e claims de bonus nas tabelas dedicadas
 * criadas em 20260525014754_olefoot_python_mode.sql.
 *
 * Estratégia:
 *   - Reads: load no boot (hidratação) — popula state.consequenceStore + managerPresence
 *   - Writes: fire-and-forget após dispatch (não bloqueia UI)
 *   - manager_id sempre vem do auth.uid() — RLS garante isolamento
 */
import { getSupabase, isSupabaseConfigured } from './client';
import type {
  ConsequenceStoreState,
  PersistentConsequence,
} from '@/systems/consequences/types';
import type {
  LoginBonusClaimResult,
  ManagerPresence,
} from '@/systems/engagement/types';

// ─── Auth helper ──────────────────────────────────────────────────

async function currentUserId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data?.session?.user?.id ?? null;
}

// ─── Row types (espelham migration) ───────────────────────────────

interface ConsequenceRow {
  id: string;
  manager_id: string;
  club_id: string;
  player_id: string | null;
  kind: string;
  dimension: 'physical' | 'psychological' | 'reputational' | 'financial';
  scope: 'player' | 'club';
  magnitude: number;
  decay_curve: 'step' | 'linear' | 'exponential';
  starts_at: string;
  expires_at: string;
  source_event_id: string | null;
  metadata: Record<string, unknown> | null;
}

interface PresenceRow {
  manager_id: string;
  last_login_at: string;
  last_session_end_at: string | null;
  total_sessions: number;
  last_bonus_claim_at: string | null;
  bonus_streak_slots: number;
  absence_penalty_last_applied_at: string | null;
  last_absence_tier: string | null;
}

// ─── Mappers ──────────────────────────────────────────────────────

function rowToConsequence(row: ConsequenceRow): PersistentConsequence {
  return {
    id: row.id,
    managerId: row.manager_id,
    clubId: row.club_id,
    playerId: row.player_id ?? undefined,
    kind: row.kind,
    dimension: row.dimension,
    scope: row.scope,
    magnitude: Number(row.magnitude),
    decayCurve: row.decay_curve,
    startsAt: new Date(row.starts_at).getTime(),
    expiresAt: new Date(row.expires_at).getTime(),
    sourceEventId: row.source_event_id ?? undefined,
    metadata: row.metadata ?? undefined,
  };
}

function consequenceToRow(c: PersistentConsequence, uid: string): Omit<ConsequenceRow, 'metadata'> & { metadata: Record<string, unknown> } {
  return {
    id: c.id,
    manager_id: uid, // SEMPRE auth.uid — RLS exige
    club_id: c.clubId,
    player_id: c.playerId ?? null,
    kind: c.kind,
    dimension: c.dimension,
    scope: c.scope,
    magnitude: c.magnitude,
    decay_curve: c.decayCurve,
    starts_at: new Date(c.startsAt).toISOString(),
    expires_at: new Date(c.expiresAt).toISOString(),
    source_event_id: c.sourceEventId ?? null,
    metadata: c.metadata ?? {},
  };
}

function rowToPresence(row: PresenceRow): ManagerPresence {
  return {
    managerId: row.manager_id,
    lastLoginAt: new Date(row.last_login_at).getTime(),
    lastSessionEndAt: row.last_session_end_at
      ? new Date(row.last_session_end_at).getTime()
      : undefined,
    totalSessions: row.total_sessions,
    lastBonusClaimAt: row.last_bonus_claim_at
      ? new Date(row.last_bonus_claim_at).getTime()
      : undefined,
    bonusStreakSlots: row.bonus_streak_slots,
    absencePenaltyLastAppliedAt: row.absence_penalty_last_applied_at
      ? new Date(row.absence_penalty_last_applied_at).getTime()
      : undefined,
    lastAbsenceTier: (row.last_absence_tier as ManagerPresence['lastAbsenceTier']) ?? undefined,
  };
}

// ─── Load (hidratação) ────────────────────────────────────────────

export interface OlefootPythonModeSnapshot {
  consequenceStore: ConsequenceStoreState | null;
  managerPresence: ManagerPresence | null;
}

/**
 * Carrega consequências ativas + presença do manager logado.
 * Filtra consequências já expiradas no DB (server-side WHERE).
 */
export async function loadOlefootPythonModeState(): Promise<OlefootPythonModeSnapshot | null> {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabase();
  if (!sb) return null;
  const uid = await currentUserId();
  if (!uid) return null;

  const nowIso = new Date().toISOString();

  // Consequências ativas
  const consequencesPromise = sb
    .from('club_consequences')
    .select('*')
    .eq('manager_id', uid)
    .gt('expires_at', nowIso);

  // Presença
  const presencePromise = sb
    .from('manager_presence')
    .select('*')
    .eq('manager_id', uid)
    .maybeSingle();

  const [cRes, pRes] = await Promise.all([consequencesPromise, presencePromise]);

  if (cRes.error) {
    console.warn('[olefootPythonMode] load consequences error:', cRes.error.message);
  }
  if (pRes.error) {
    console.warn('[olefootPythonMode] load presence error:', pRes.error.message);
  }

  const active: Record<string, PersistentConsequence> = {};
  for (const row of (cRes.data ?? []) as ConsequenceRow[]) {
    const c = rowToConsequence(row);
    active[c.id] = c;
  }

  return {
    consequenceStore: { active, lastTickAt: Date.now() },
    managerPresence: pRes.data ? rowToPresence(pRes.data as PresenceRow) : null,
  };
}

// ─── Writes ────────────────────────────────────────────────────────

export async function persistConsequencesBatch(
  consequences: PersistentConsequence[],
): Promise<void> {
  if (!consequences.length || !isSupabaseConfigured()) return;
  const sb = getSupabase();
  if (!sb) return;
  const uid = await currentUserId();
  if (!uid) return;

  const rows = consequences.map((c) => consequenceToRow(c, uid));
  const { error } = await sb.from('club_consequences').insert(rows);
  if (error) {
    console.warn('[olefootPythonMode] persistConsequences error:', error.message);
  }
}

/**
 * Apaga consequências expiradas server-side. Chamado quando TICK_CONSEQUENCES
 * remove rows do estado local.
 */
export async function purgeExpiredConsequences(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const sb = getSupabase();
  if (!sb) return;
  const uid = await currentUserId();
  if (!uid) return;

  const nowIso = new Date().toISOString();
  const { error } = await sb
    .from('club_consequences')
    .delete()
    .eq('manager_id', uid)
    .lte('expires_at', nowIso);

  if (error && error.code !== 'PGRST116') {
    console.warn('[olefootPythonMode] purgeExpired error:', error.message);
  }
}

export async function upsertManagerPresence(
  presence: ManagerPresence,
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const sb = getSupabase();
  if (!sb) return;
  const uid = await currentUserId();
  if (!uid) return;

  const row: PresenceRow = {
    manager_id: uid,
    last_login_at: new Date(presence.lastLoginAt).toISOString(),
    last_session_end_at: presence.lastSessionEndAt
      ? new Date(presence.lastSessionEndAt).toISOString()
      : null,
    total_sessions: presence.totalSessions,
    last_bonus_claim_at: presence.lastBonusClaimAt
      ? new Date(presence.lastBonusClaimAt).toISOString()
      : null,
    bonus_streak_slots: presence.bonusStreakSlots,
    absence_penalty_last_applied_at: presence.absencePenaltyLastAppliedAt
      ? new Date(presence.absencePenaltyLastAppliedAt).toISOString()
      : null,
    last_absence_tier: presence.lastAbsenceTier ?? null,
  };

  const { error } = await sb
    .from('manager_presence')
    .upsert(row, { onConflict: 'manager_id' });

  if (error) {
    console.warn('[olefootPythonMode] upsertPresence error:', error.message);
  }
}

export async function logLoginBonusClaim(claim: LoginBonusClaimResult): Promise<void> {
  if (!claim.claimed || !isSupabaseConfigured()) return;
  const sb = getSupabase();
  if (!sb) return;
  const uid = await currentUserId();
  if (!uid) return;

  const { error } = await sb.from('manager_login_bonus_claims').insert({
    manager_id: uid,
    claimed_at: new Date().toISOString(),
    slot_index: claim.slotIndex ?? 1,
    reward_kind: claim.reward?.kind ?? 'exp_small',
    exp_granted: claim.reward?.expAmount ?? null,
    is_weekend: claim.isWeekend ?? false,
  });

  if (error) {
    console.warn('[olefootPythonMode] logBonusClaim error:', error.message);
  }
}
