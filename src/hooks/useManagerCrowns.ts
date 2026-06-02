/**
 * useManagerCrowns
 *
 * Carrega todas as Coroas do Dia conquistadas pelo manager logado e mantém
 * atualizado via Realtime: novos INSERTs em `daily_crowns` que pertencem ao
 * manager aparecem imediatamente na lista.
 */

import { useEffect, useState } from 'react';
import { useGameStore } from '@/game/store';
import { getSupabase } from '@/supabase/client';
import { loadCrownsForManager } from '@/supabase/globalLeague';
import type { DailyCrown } from '@/match/globalLeagueMVP';

export function useManagerCrowns(): { crowns: DailyCrown[]; loading: boolean } {
  const managerProfile = useGameStore((s) => s.userSettings?.managerProfile);
  const club = useGameStore((s) => s.club);
  const managerId = managerProfile?.email ?? club?.id ?? null;

  const [crowns, setCrowns] = useState<DailyCrown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!managerId) { setLoading(false); return; }
    setLoading(true);
    loadCrownsForManager(managerId).then((rows) => {
      if (cancelled) return;
      setCrowns(rows);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [managerId]);

  // Realtime: nova coroa pertencente a este manager aparece sem refresh.
  useEffect(() => {
    if (!managerId) return;
    const sb = getSupabase();
    if (!sb) return;
    const channel = sb
      .channel('daily_crowns:manager')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'daily_crowns' },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (String(row.manager_id) !== managerId) return;
          // Insere no topo, dedupando pelo id.
          setCrowns((prev) => {
            const newCrown: DailyCrown = {
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
            };
            return [newCrown, ...prev.filter((c) => c.id !== newCrown.id)];
          });
        },
      )
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [managerId]);

  return { crowns, loading };
}
