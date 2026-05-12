import { getSupabase } from '@/supabase/client';
import { loadAdminPanelSession } from './adminPanelAuth';
import { addCsrfHeader } from '@/lib/csrf';
import { olefootApiBase } from '@/gamespirit/admin/runtimeTruth';

export type UserStatus = 'active' | 'suspended' | 'banned';

export interface AdminProfileRow {
  id: string;
  display_name: string | null;
  club_name: string | null;
  club_short: string | null;
  created_at: string;
  updated_at: string;
  onboarding_data: Record<string, unknown> | null;
  referred_by_code: string | null;
}

export async function adminListProfiles(): Promise<AdminProfileRow[]> {
  try {
    const res = await fetch(`${olefootApiBase()}/api/admin/profiles`);
    if (!res.ok) {
      console.warn('[adminCore] list_profiles HTTP', res.status);
      return [];
    }
    return (await res.json()) as AdminProfileRow[];
  } catch (e) {
    console.warn('[adminCore] list_profiles:', e instanceof Error ? e.message : e);
    return [];
  }
}

export interface AdminTopReferrerRow {
  referred_by_code: string;
  referred_count: number;
  first_referral_at: string;
  last_referral_at: string;
}

export async function adminListTopReferrers(limit = 50): Promise<AdminTopReferrerRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc('admin_list_top_referrers', { p_limit: limit });
  if (error) {
    console.warn('[adminCore] list_top_referrers:', error.message);
    return [];
  }
  return (data ?? []) as AdminTopReferrerRow[];
}

export type AuditLogRow = {
  id: number;
  table_name: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  user_id: string | null;
  row_id: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  occurred_at: string;
};

export type LaunchCountersRow = {
  id: number;
  total_managers: number;
  welcome_packs_claimed: number;
  welcome_packs_limit: number;
  updated_at: string;
};

export type PlatformConfigRow = {
  key: string;
  value: Record<string, unknown>;
  updated_at: string;
  updated_by: string | null;
};

export async function adminSetUserStatus(userId: string, status: UserStatus): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  const session = await loadAdminPanelSession();
  if (!session?.csrfToken) {
    console.error('[adminCore] CSRF token missing');
    return false;
  }

  const { data, error } = await sb.rpc('admin_set_user_status', {
    p_user_id: userId,
    p_status: status,
    p_admin_email: session.email,
    p_csrf_token: session.csrfToken,
  });

  if (error) {
    console.error('[adminCore] set_user_status:', error.message);
    return false;
  }
  return Boolean(data);
}

export async function getMyStatus(): Promise<UserStatus | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('get_my_status');
  if (error) {
    console.warn('[adminCore] get_my_status:', error.message);
    return null;
  }
  return (data as UserStatus) ?? 'active';
}

export async function fetchAuditLog(params: { limit?: number; table?: string } = {}): Promise<AuditLogRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc('admin_read_audit_log', {
    p_limit: params.limit ?? 100,
    p_table: params.table ?? null,
  });
  if (error) {
    console.error('[adminCore] audit_log:', error.message);
    return [];
  }
  return (data ?? []) as AuditLogRow[];
}

export async function fetchLaunchCounters(): Promise<LaunchCountersRow | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from('launch_counters')
    .select('*')
    .eq('id', 1)
    .single();
  if (error) {
    console.warn('[adminCore] launch_counters:', error.message);
    return null;
  }
  return data as LaunchCountersRow;
}

export async function fetchAllPlatformConfig(): Promise<Record<string, Record<string, unknown>>> {
  const sb = getSupabase();
  if (!sb) return {};
  const { data, error } = await sb.from('platform_config').select('*');
  if (error) {
    console.warn('[adminCore] platform_config:', error.message);
    return {};
  }
  const out: Record<string, Record<string, unknown>> = {};
  for (const row of (data ?? []) as PlatformConfigRow[]) {
    out[row.key] = row.value ?? {};
  }
  return out;
}

export async function setPlatformConfig(key: string, value: Record<string, unknown>): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.rpc('admin_set_platform_config', {
    p_key: key,
    p_value: value,
  });
  if (error) {
    console.error('[adminCore] set_platform_config:', error.message);
    return false;
  }
  return true;
}

export interface OnboardingAuditResult {
  totalManagers: number;
  inGlobalLeague: number;
  withoutLeagueTeam: number;
  withWelcomePack: number;
  orphans: Array<{ id: string; displayName: string; clubName: string }>;
}

export async function fetchOnboardingAudit(): Promise<OnboardingAuditResult | null> {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const [profilesRes, teamsRes, grantsRes] = await Promise.all([
      sb.from('profiles').select('id, display_name, club_name'),
      sb.from('global_league_teams').select('manager_id'),
      sb.from('welcome_pack_grants').select('user_id'),
    ]);

    const profiles = (profilesRes.data ?? []) as Array<{ id: string; display_name: string | null; club_name: string | null }>;
    const teamManagerIds = new Set((teamsRes.data ?? []).map((t: { manager_id: string }) => t.manager_id));
    const grantUserIds = new Set((grantsRes.data ?? []).map((g: { user_id: string }) => g.user_id));

    const orphans = profiles
      .filter((p) => !teamManagerIds.has(p.id))
      .map((p) => ({
        id: p.id,
        displayName: p.display_name ?? '(sem nome)',
        clubName: p.club_name ?? '(sem clube)',
      }));

    return {
      totalManagers: profiles.length,
      inGlobalLeague: teamManagerIds.size,
      withoutLeagueTeam: orphans.length,
      withWelcomePack: grantUserIds.size,
      orphans,
    };
  } catch (err) {
    console.warn('[adminCore] onboarding audit failed:', err);
    return null;
  }
}
