/**
 * useClubPulse — liga o CLUB PULSE ao store.
 *
 * Seis sistemas que já rodavam invisíveis (torcida, forma, moral, engajamento,
 * consequências, atividade do dia) viram um número no topo da Home.
 *
 * ⚠️ Seletores ESTÁVEIS: cada `useGameStore` aqui devolve uma referência que já
 * existe no estado (objeto, array ou primitivo) — nunca um valor derivado. Criar
 * valor novo dentro do seletor quebra o cache do `useSyncExternalStore` e derruba
 * a página em laço infinito (já aconteceu no Transfer, em produção).
 */
import { useMemo } from 'react';
import { useGameStore } from '@/game/store';
import { useClubConsequences } from '@/hooks/useConsequences';
import { computeEngagementScore } from '@/systems/engagement/engagementScore';
import { computeClubPulse, type ClubPulse, type PulseConsequence } from '@/systems/clubPulse';

export function useClubPulse(): ClubPulse {
  const crowd = useGameStore((s) => s.crowd);
  const form = useGameStore((s) => s.form);
  const playerMoral = useGameStore((s) => s.playerMoral);
  const playerHealth = useGameStore((s) => s.playerHealth);
  const players = useGameStore((s) => s.players);
  const presence = useGameStore((s) => s.managerPresence);
  const managerScore = useGameStore((s) => s.managerScore);
  const consequences = useClubConsequences();

  return useMemo(() => {
    const squadMoral = Object.values(playerMoral ?? {}).map((m) => m.moral);

    const healthValues = Object.values(playerHealth ?? {});
    const totalPlayers = Object.keys(players ?? {}).length;
    const healthyPlayers = healthValues.filter(
      (h) => h.outForMatches === 0 && h.suspendedMatches === 0 && !h.atRisk,
    ).length;

    const engagementScore = presence
      ? computeEngagementScore({ presence, totalPlayers, healthyPlayers })
      : 50;

    const pulseConsequences: PulseConsequence[] = consequences.map((c) => ({
      dimension: c.consequence.dimension,
      currentValue: c.currentValue,
    }));

    return computeClubPulse({
      crowdSupportPercent: crowd?.supportPercent ?? 50,
      form: form ?? [],
      squadMoral,
      engagementScore,
      consequences: pulseConsequences,
      managerScoreToday: managerScore?.today ?? 0,
    });
  }, [crowd, form, playerMoral, playerHealth, players, presence, managerScore, consequences]);
}
