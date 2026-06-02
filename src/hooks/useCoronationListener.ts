/**
 * useCoronationListener
 *
 * Escuta INSERT em `daily_crowns` via Supabase Realtime. Quando uma nova coroa
 * é registrada e o `manager_id` (email) bate com o manager logado, retorna
 * o `DailyCrown` pra disparar o CoronationModal.
 *
 * Também verifica no mount: se já existe uma coroa de hoje pertencente ao
 * manager logado e ele ainda não viu (flag em localStorage), abre o modal.
 */

import { useEffect, useState } from 'react';
import { getSupabase } from '@/supabase/client';
import { useGameStore } from '@/game/store';
import { loadRecentCrowns } from '@/supabase/globalLeague';
import type { DailyCrown } from '@/match/globalLeagueMVP';

const SEEN_KEY = 'olefoot:daily_crown_seen';

function markSeen(id: string) {
  try { localStorage.setItem(SEEN_KEY, id); } catch { /* noop */ }
}
function alreadySeen(id: string): boolean {
  try { return localStorage.getItem(SEEN_KEY) === id; } catch { return false; }
}

export function useCoronationListener(): {
  crown: DailyCrown | null;
  dismiss: () => void;
} {
  const managerProfile = useGameStore((s) => s.userSettings?.managerProfile);
  const club = useGameStore((s) => s.club);
  const managerId = managerProfile?.email ?? club?.id ?? null;

  const [crown, setCrown] = useState<DailyCrown | null>(null);

  const dismiss = () => {
    if (crown) markSeen(crown.id);
    setCrown(null);
  };

  // 1) On mount: check if today's crown belongs to me and hasn't been shown yet.
  useEffect(() => {
    if (!managerId) return;
    let cancelled = false;
    loadRecentCrowns(1).then((rows) => {
      if (cancelled) return;
      const latest = rows[0];
      if (!latest) return;
      if (latest.managerId !== managerId) return;
      if (alreadySeen(latest.id)) return;
      setCrown(latest);
    });
    return () => { cancelled = true; };
  }, [managerId]);

  // 2) Realtime: capture new crown insertion mid-session.
  useEffect(() => {
    if (!managerId) return;
    const sb = getSupabase();
    if (!sb) return;

    const channel = sb
      .channel('daily_crowns:coronation')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'daily_crowns' },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (String(row.manager_id) !== managerId) return;
          if (alreadySeen(String(row.id))) return;
          setCrown({
            id: String(row.id),
            teamId: String(row.team_id),
            managerId: String(row.manager_id),
            clubName: String(row.club_name),
            clubShort: String(row.club_short),
            dailyDate: String(row.daily_date),
            seasonId: String(row.season_id),
            competitionId: row.competition_id == null ? undefined : String(row.competition_id),
            bracketSize: Number(row.bracket_size ?? 0),
            runnerUpTeamId: row.runner_up_team_id == null ? undefined : String(row.runner_up_team_id),
            runnerUpClubName: row.runner_up_club_name == null ? undefined : String(row.runner_up_club_name),
            finalScoreHome: row.final_score_home == null ? undefined : Number(row.final_score_home),
            finalScoreAway: row.final_score_away == null ? undefined : Number(row.final_score_away),
            finalWentToPens: Boolean(row.final_went_to_pens),
            crownedAtMs: Number(row.crowned_at_ms ?? 0),
          });
        },
      )
      .subscribe();

    return () => { sb.removeChannel(channel); };
  }, [managerId]);

  return { crown, dismiss };
}
