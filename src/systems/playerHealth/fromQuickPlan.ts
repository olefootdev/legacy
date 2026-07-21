import { rollInjurySeverity } from '@/systems/injury';
import type { MatchOutcomeEvent, PlayerHealth } from './types';

/**
 * Produtor de consequências para partidas de COMPETIÇÃO jogadas no motor
 * Quick (Liga Ole, Legends Cup). A Liga Global tem o próprio produtor
 * (useGlobalConsequencesSync) e o amistoso Quick segue sem consequências.
 *
 * O motor Quick (plano Python) não reporta cartões/lesões minuto a minuto,
 * então a disciplina é derivada AQUI dos stats reais da partida (desarmes →
 * cartão) e do estado de saúde acumulado (fadiga/risco → lesão), com RNG
 * semeado — mesmo seed, mesmas consequências (testável, sem Math.random).
 *
 * NÃO emite eventos 'played': fadiga e injuryRisk pós-jogo já são aplicados
 * pelo creditQuickPlan; emitir 'played' aqui dobraria o custo.
 */

/** RNG determinístico (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface QuickConsequenceStatLite {
  tackles: number;
  km: number;
  rating: number;
}

export interface QuickPlanConsequenceInput {
  matchId: string;
  /** Escopo dos amarelos acumulados: 'liga-ole' | 'legends-cup'. */
  leagueId: string;
  homeStats: Record<string, QuickConsequenceStatLite>;
  /** Saúde ANTES da partida — alimenta a probabilidade de lesão. */
  playerHealth: Record<string, PlayerHealth>;
  /** Seed da partida (timestamp serve em runtime; fixo nos testes). */
  seed: number;
  /** Finalizações totais — proxy de intensidade (mesma régua do fromLiveMatch). */
  shots: number;
  now: number;
}

/** Desarmes puxam cartão: 0 desarmes ≈ 4% · 3 desarmes ≈ 15% · cap 30%. */
function yellowProbability(tackles: number): number {
  return Math.min(0.3, 0.04 + tackles * 0.036);
}

/** Vermelho direto é raro; desarmes altos aumentam de leve. */
function redProbability(tackles: number): number {
  return Math.min(0.05, 0.012 + tackles * 0.004);
}

/** Lesão cresce com risco acumulado e fadiga crítica na entrada. */
function injuryProbability(h: PlayerHealth | undefined): number {
  const risk = h?.injuryRisk ?? 0;
  const fatigue = h?.fatigue ?? 0;
  return Math.min(0.2, 0.012 + (risk / 100) * 0.12 + (fatigue >= 80 ? 0.045 : 0));
}

export function quickPlanToConsequenceEvents(
  input: QuickPlanConsequenceInput,
): MatchOutcomeEvent[] {
  const intensity = Math.max(0.3, Math.min(1, 0.4 + input.shots / 30));
  const events: MatchOutcomeEvent[] = [];

  for (const [pid, stat] of Object.entries(input.homeStats)) {
    if (!pid) continue;
    const rng = mulberry32((input.seed ^ hashSeed(pid)) >>> 0);
    const base = {
      playerId: pid,
      matchId: input.matchId,
      matchMode: 'quick' as const,
      leagueId: input.leagueId,
      at: input.now,
    };

    // Disciplina: vermelho direto exclui amarelo no mesmo sorteio (o vermelho
    // já suspende); segundo amarelo na mesma partida não é modelado.
    const rDiscipline = rng();
    if (rDiscipline < redProbability(stat.tackles)) {
      events.push({ ...base, type: 'red_card', reason: 'direct' });
    } else if (rDiscipline < redProbability(stat.tackles) + yellowProbability(stat.tackles)) {
      events.push({ ...base, type: 'yellow_card', leagueId: input.leagueId });
    }

    // Lesão: probabilidade do estado ANTES da partida.
    const h = input.playerHealth[pid];
    if (rng() < injuryProbability(h)) {
      events.push({
        ...base,
        type: 'injury',
        severity: rollInjurySeverity(rng(), intensity, h?.injuryRisk ?? 0),
      });
    }
  }

  return events;
}
