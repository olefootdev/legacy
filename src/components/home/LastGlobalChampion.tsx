/**
 * LastGlobalChampion — módulo da Home: "Último Campeão Liga Global".
 *
 * Mostra o clube campeão mais recente + o manager, num card compacto que leva
 * pra /match/global. Dados 100% reais (loadRecentCrowns); se ainda não houve
 * coroação, o módulo simplesmente não aparece (sem inventar campeão).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadRecentCrowns } from '@/supabase/globalLeague';
import type { DailyCrown } from '@/match/globalLeagueMVP';
import { resolveManagerName } from '@/lib/championManager';
import { useGameStore } from '@/game/store';
import { GlobalChampionHonor } from '@/components/matchglobal/GlobalChampionHonor';

export function LastGlobalChampion() {
  const navigate = useNavigate();
  const managerProfile = useGameStore((s) => s.userSettings?.managerProfile);
  const [crown, setCrown] = useState<DailyCrown | null>(null);
  const [manager, setManager] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadRecentCrowns(1)
      .then((cs) => { if (alive) setCrown(cs[0] ?? null); })
      .catch(() => { /* sem coroa → módulo some, sem inventar */ });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!crown) { setManager(null); return; }
    // Se o campeão sou eu, uso meu nome (confiável); senão, RPC social (sem PII).
    const myEmail = managerProfile?.email;
    if (myEmail && crown.managerId === myEmail) {
      setManager(`${managerProfile?.firstName ?? ''} ${managerProfile?.lastName ?? ''}`.trim() || null);
      return;
    }
    let alive = true;
    resolveManagerName(crown.clubName, crown.clubShort).then((n) => { if (alive) setManager(n); });
    return () => { alive = false; };
  }, [crown, managerProfile]);

  if (!crown) return null;

  return (
    <GlobalChampionHonor
      variant="compact"
      clubName={crown.clubName}
      clubShort={crown.clubShort}
      managerName={manager}
      dailyDate={crown.dailyDate}
      runnerUpClubName={crown.runnerUpClubName}
      finalScoreHome={crown.finalScoreHome}
      finalScoreAway={crown.finalScoreAway}
      finalWentToPens={crown.finalWentToPens}
      onClick={() => navigate('/match/global')}
    />
  );
}

export default LastGlobalChampion;
