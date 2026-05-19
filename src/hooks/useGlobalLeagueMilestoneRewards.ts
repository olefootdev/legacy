/**
 * Observa o time do manager na Liga Global e dispara CLAIM_GLOBAL_LEAGUE_MILESTONES
 * para cada marco atingido (10/50/100/300/1000 em partidas, gols, pontos, vitórias).
 *
 * REGRA CRÍTICA (fix 2026-05-18d):
 *   Marcos NÃO pagam retroativo. Se o `globalLeagueMilestonesClaimed` está
 *   vazio E o time já tem stats acumuladas (ex.: simuladas pela Edge Function
 *   global-league-tick ANTES do user logar), todos os marcos já atingidos
 *   são marcados como "claimed" SEM grant. Só os marcos que o user atingir
 *   DAQUI EM DIANTE pagam EXP.
 *
 *   Sem essa proteção, todo manager novo que entra na liga global recebe
 *   instantaneamente os marcos retroativos (~117k EXP) porque a Edge Function
 *   simula partidas pra deixar a liga viva.
 *
 * Roda no boot e a cada atualização do `globalLeagueMVP` (hidratação + realtime).
 * Idempotente: cada marco só é "marcado" 1× — controle via `globalLeagueMilestonesClaimed`.
 */

import { useEffect } from 'react';
import { useGameDispatch, useGameStore } from '@/game/store';
import { milestonesReachedByTeam } from '@/match/globalLeagueMilestones';

export function useGlobalLeagueMilestoneRewards() {
  const dispatch = useGameDispatch();
  const club = useGameStore((s) => s.club);
  const managerProfile = useGameStore((s) => s.userSettings?.managerProfile);
  const globalLeagueMVP = useGameStore((s) => s.globalLeagueMVP);
  const claimed = useGameStore((s) => s.globalLeagueMilestonesClaimed);

  useEffect(() => {
    if (!globalLeagueMVP) return;
    const managerId = managerProfile?.email ?? club?.id;
    if (!managerId) return;
    const myTeam = globalLeagueMVP.teams.find((t) => t.managerId === managerId);
    if (!myTeam) return;

    const reached = milestonesReachedByTeam(myTeam);
    if (reached.length === 0) return;

    const alreadyClaimed = new Set(claimed ?? []);
    const fresh = reached.filter((id) => !alreadyClaimed.has(id));
    if (fresh.length === 0) return;

    // FIX 2026-05-18d: PRIMEIRA VEZ que o hook vê o time (claimed array vazio)
    // significa que o user acabou de entrar na liga global. Tudo que já está
    // "atingido" é stat retroativa (Edge Function simula partidas pra deixar
    // a liga viva). NÃO paga EXP — só marca os marcos como vistos. A partir
    // dessa baseline, qualquer marco NOVO que o user atingir paga normalmente.
    if (alreadyClaimed.size === 0) {
      dispatch({
        type: 'CLAIM_GLOBAL_LEAGUE_MILESTONES_SILENT',
        milestoneIds: fresh,
      });
      return;
    }

    dispatch({ type: 'CLAIM_GLOBAL_LEAGUE_MILESTONES', milestoneIds: fresh });
  }, [globalLeagueMVP, claimed, club?.id, managerProfile?.email, dispatch]);
}
