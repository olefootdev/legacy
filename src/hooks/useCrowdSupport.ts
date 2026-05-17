/**
 * useCrowdSupport
 *
 * Deriva o "Apoio da torcida" exibido na Home a partir do desempenho real do
 * manager — hoje na Liga Global; futuramente em qualquer liga que somar peso.
 *
 * Por que não usar `state.crowd.supportPercent` direto:
 *   - O valor armazenado só é atualizado por classic match local, city store,
 *     stadium upgrade e admin shop. Nunca pelos resultados da Liga Global.
 *     Quem joga só Liga Global vê a % travada num número antigo (ex: 22%).
 *
 * Estratégia:
 *   - Base = forma recente (últimos 5 resultados) + posição na divisão.
 *   - Mistura com `crowd.supportPercent` armazenado (peso 30%) para preservar
 *     contribuições de classic / city / shop.
 *   - Se o time não está na Liga Global ou ainda não jogou, devolve o valor
 *     armazenado puro (compat com saves antigos).
 */

import { useGameStore } from '@/game/store';

const NEUTRAL = 50;

export interface CrowdSupportResult {
  supportPercent: number;
  moodLabel: string;
  /** 'derived' = usou Liga Global; 'stored' = caiu no valor antigo. */
  source: 'derived' | 'stored';
}

function crowdMood(support: number): string {
  if (support < 40) return 'Cética';
  if (support < 62) return 'Expectante';
  if (support < 82) return 'Confiante';
  return 'Euforia';
}

export function useCrowdSupport(): CrowdSupportResult {
  const stored = useGameStore((s) => s.crowd.supportPercent);
  const storedMood = useGameStore((s) => s.crowd.moodLabel);
  const globalLeagueMVP = useGameStore((s) => s.globalLeagueMVP);
  const managerProfile = useGameStore((s) => s.userSettings?.managerProfile);
  const club = useGameStore((s) => s.club);

  const managerId = managerProfile?.email ?? club?.id;
  const myTeam = globalLeagueMVP?.teams.find((t) => t.managerId === managerId);
  const matchesPlayed = myTeam?.matchesPlayed ?? 0;

  if (!myTeam || matchesPlayed === 0) {
    return { supportPercent: stored, moodLabel: storedMood, source: 'stored' };
  }

  // Forma recente — últimos 5 resultados. W = +6, D = 0, L = -4.
  // Range total: -20 (5 derrotas) a +30 (5 vitórias).
  const formScore = (myTeam.recentForm ?? [])
    .slice(0, 5)
    .reduce((acc, r) => acc + (r === 'W' ? 6 : r === 'L' ? -4 : 0), 0);

  // Bônus por posição na divisão. Líder = +8, lanterna = -8.
  let posBonus = 0;
  if (myTeam.position != null && myTeam.division != null) {
    const sameDiv = globalLeagueMVP!.teams.filter((t) => t.division === myTeam.division);
    const n = sameDiv.length;
    if (n > 1) {
      const percentile = 1 - (myTeam.position - 1) / (n - 1); // 1.0 topo, 0.0 último
      posBonus = Math.round(-8 + percentile * 16);
    }
  }

  const derived = NEUTRAL + formScore + posBonus;
  // Stored entra como pequeno desvio (classic match / city store mantêm relevância).
  const storedDelta = stored - NEUTRAL;
  const final = Math.max(0, Math.min(99, Math.round(derived + storedDelta * 0.3)));

  return { supportPercent: final, moodLabel: crowdMood(final), source: 'derived' };
}
