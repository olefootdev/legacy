import type { OlefootGameState } from '@/game/types';
import type { CoachAction } from './coachActions';
import { findShopItem } from '@/game/shopCatalog';
import { L } from '@/i18n/L';

/**
 * Gera ações proativas para o manager APROVAR baseado no SSOT `playerHealth`.
 * Heurísticas conservadoras — só dispara quando há sinal claro.
 *
 * - avg fadiga >= 75% OU >=4 jogadores `atRisk` → treino coletivo de recuperação
 * - 1+ jogador lesionado → start_treatment do mais grave
 * - >=3 jogadores `atRisk` E >=1 Booster Fadiga Zero (450 EXP) acessível → buy_health_booster
 */
export function generateProactiveHealthActions(state: OlefootGameState): CoachAction[] {
  const out: CoachAction[] = [];
  const players = Object.values(state.players);
  if (players.length === 0) return out;

  const health = state.playerHealth ?? {};
  const now = Date.now();

  let totalFatigue = 0;
  let countAtRisk = 0;
  const injured: { id: string; outFor: number }[] = [];

  for (const p of players) {
    const h = health[p.id];
    const fatigue = h?.fatigue ?? p.fatigue ?? 0;
    const outFor = h?.outForMatches ?? p.outForMatches ?? 0;
    const atRisk = h?.atRisk ?? false;

    totalFatigue += fatigue;
    if (atRisk) countAtRisk++;
    if (outFor > 0) injured.push({ id: p.id, outFor });
  }

  const avgFatigue = totalFatigue / players.length;

  // 1) Treino coletivo de recuperação física
  if (avgFatigue >= 75 || countAtRisk >= 4) {
    out.push({
      id: `coach-rest-${now}`,
      type: 'start_training',
      title: L('Descanso coletivo (recuperação)', 'Team rest (recovery)'),
      description: L('Plantel cansado — sessão coletiva de descanso (24h) para baixar fadiga e risco de lesão.', 'Tired squad — team rest session (24h) to cut fatigue and injury risk.'),
      reasoning:
        avgFatigue >= 75
          ? L(`Fadiga média do plantel em ${avgFatigue.toFixed(0)}% (limiar 75).`, `Squad average fatigue at ${avgFatigue.toFixed(0)}% (threshold 75).`)
          : L(`${countAtRisk} jogadores em risco (atRisk) — descanso urgente.`, `${countAtRisk} players at risk — rest urgently.`),
      urgency: avgFatigue >= 90 || countAtRisk >= 6 ? 'high' : 'medium',
      status: 'pending',
      createdAt: now,
      data: {
        mode: 'coletivo',
        trainingType: 'descanso' as const,
        playerIds: [],
        group: 'all',
        durationHours: 24,
      },
    });
  }

  // 2) Iniciar tratamento médico do mais grave
  if (injured.length > 0) {
    const worst = injured.sort((a, b) => b.outFor - a.outFor)[0];
    const player = state.players[worst.id];
    if (player) {
      out.push({
        id: `coach-treat-${worst.id}-${now}`,
        type: 'start_treatment',
        title: L(`Tratar ${player.name}`, `Treat ${player.name}`),
        description: L(`${player.name} indisponível por ${worst.outFor} jogos. Acelerar recuperação.`, `${player.name} out for ${worst.outFor} games. Speed up recovery.`),
        reasoning: L(`Departamento médico pode reduzir tempo de baixa.`, `The medical department can shorten the time out.`),
        urgency: 'high',
        status: 'pending',
        createdAt: now,
        data: { playerId: worst.id },
      });
    }
  }

  // 3) Comprar Booster Fadiga Zero quando atRisk severo + EXP disponível
  if (countAtRisk >= 3) {
    const booster = findShopItem(state.shopCatalog, 'booster-fatigue');
    const cost = booster?.priceExp ?? 0;
    if (booster && cost > 0 && state.finance.ole >= cost) {
      out.push({
        id: `coach-buy-booster-${now}`,
        type: 'buy_health_booster',
        title: L('Comprar Booster Fadiga Zero', 'Buy Zero Fatigue Booster'),
        description: L(`Resetar fadiga do plantel inteiro (${cost} EXP).`, `Reset fatigue for the whole squad (${cost} EXP).`),
        reasoning: L(`${countAtRisk} jogadores em risco. Booster zera fadiga global e protege contra lesões.`, `${countAtRisk} players at risk. The booster clears all fatigue and protects against injuries.`),
        urgency: countAtRisk >= 6 ? 'high' : 'medium',
        status: 'pending',
        createdAt: now,
        data: {
          shopItemId: booster.id,
          costExp: booster.priceExp ?? undefined,
          costBroCents: booster.priceBroCents ?? undefined,
        },
      });
    }
  }

  return out;
}
