/**
 * Fase 3 do plano MELHORIAS_INTELIGENCIA_PARTIDAS.md — Fatores Contextuais.
 *
 * Modificadores nomeados e auditáveis que ajustam o `SpiritContext` ANTES
 * da resolução do tick. Cada fator é um multiplicador transparente:
 *
 *  - homeAdvantage  (0.95 – 1.10) — mando de campo + torcida
 *  - restMultiplier (0.85 – 1.10) — dias desde a última partida
 *  - derbyIntensity (1.00 – 1.20) — clássico/rivalidade
 *  - importance     (1.00 – 1.15) — peso do jogo (liga/decisão/final)
 *  - squadDepletion (0.80 – 1.00) — desfalques (vem da Fase 2)
 *
 * Plug point: `buildSpiritContext` em `shared/gamespirit/GameSpirit.ts`.
 * Cada modificador entra como multiplicador sobre `homeTeamAvg`, `crowdSupport`,
 * `avgHomeFatigue` ou `tacticalMentality` — NUNCA como número mágico.
 *
 * Esses fatores são também a entrada base de Fase 1 (Monte Carlo) — cada
 * cenário pode rodar N simulações com modificadores fixos pra ler V/E/D.
 */

import type { EffectiveTeamStrength } from './availabilityReport';

// ──────────────────────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────────────────────

export type MatchImportance = 'liga' | 'decisao' | 'final';

export interface MatchContextModifiers {
  /** 0.95-1.10. Multiplica homeTeamAvg + crowdSupport. >1 quando em casa, <1 fora. */
  homeAdvantage: number;
  /** 0.85-1.10. Multiplica AvgHomeFatigue de forma INVERSA (rest<1 ⇒ time mais cansado). */
  restMultiplier: number;
  /** 1.00-1.20. Multiplica crowdSupport (torcida ferve no clássico). */
  derbyIntensity: number;
  /** 1.00-1.15. Multiplica tacticalMentality (time joga mais agressivo). */
  importance: number;
  /** 0.80-1.00. Multiplica homeTeamAvg. Vem direto de EffectiveTeamStrength.depletionMultiplier. */
  squadDepletion: number;
  /** Detalhe legível pra UI/debug — cada fator com a razão. */
  breakdown: {
    homeAdvantage: string;
    rest: string;
    derby: string;
    importance: string;
    depletion: string;
  };
}

export interface MatchContextInput {
  /** Time do user é mandante do fixture? */
  isHome: boolean;
  /** Dias desde a última partida oficial do time do user. */
  daysSinceLastMatch?: number;
  /** Clássico/rivalidade marcada no fixture. */
  isDerby?: boolean;
  /** Peso da partida (liga normal, decisão, final). */
  importance?: MatchImportance;
  /** Resultado da Fase 2 — força efetiva do XI. */
  effectiveTeamStrength?: EffectiveTeamStrength;
}

export interface ApplyContextInput {
  homeTeamAvg: number;
  crowdSupport: number;
  avgHomeFatigue: number;
  tacticalMentality: number;
}

export interface ApplyContextOutput extends ApplyContextInput {
  /** Delta aplicado em cada campo (post - pre) — auditável. */
  appliedDelta: ApplyContextInput;
}

// ──────────────────────────────────────────────────────────────────────────
// Calibração — calibrada pra "feel" de futebol real
// ──────────────────────────────────────────────────────────────────────────

// Mando de campo: ~57% de vitórias mandantes na média histórica.
const HOME_ADVANTAGE_IN = 1.07;
const HOME_ADVANTAGE_AWAY = 0.95;

// Descanso — penalidade por congestão de calendário.
// 1 dia = jogo back-to-back (puxado), 7+ dias = totalmente descansado.
function restMultiplierFromDays(d: number | undefined): number {
  if (d == null || !Number.isFinite(d)) return 1.0;
  const clamped = Math.max(0, Math.min(14, d));
  if (clamped <= 1) return 0.85;
  if (clamped <= 2) return 0.92;
  if (clamped <= 3) return 0.97;
  if (clamped <= 5) return 1.0;
  if (clamped <= 7) return 1.03;
  return 1.05;
}

const DERBY_INTENSITY_BOOST = 1.15;

const IMPORTANCE_MULTS: Record<MatchImportance, number> = {
  liga: 1.0,
  decisao: 1.07,
  final: 1.13,
};

// Cap final pra garantir nada escapa dos ranges.
const CAPS = {
  homeAdvantage: [0.90, 1.15] as const,
  restMultiplier: [0.80, 1.12] as const,
  derbyIntensity: [1.0, 1.25] as const,
  importance: [1.0, 1.20] as const,
  squadDepletion: [0.70, 1.05] as const,
};

function clamp(n: number, [lo, hi]: readonly [number, number]): number {
  return Math.max(lo, Math.min(hi, n));
}

// ──────────────────────────────────────────────────────────────────────────
// Calculadora
// ──────────────────────────────────────────────────────────────────────────

/**
 * Calcula os 5 modificadores a partir de inputs brutos (fixture + state).
 * Garante ranges seguros e produz breakdown legível.
 */
export function computeMatchContextModifiers(input: MatchContextInput): MatchContextModifiers {
  const homeAdv = input.isHome ? HOME_ADVANTAGE_IN : HOME_ADVANTAGE_AWAY;
  const rest = restMultiplierFromDays(input.daysSinceLastMatch);
  const derby = input.isDerby ? DERBY_INTENSITY_BOOST : 1.0;
  const importance = IMPORTANCE_MULTS[input.importance ?? 'liga'];
  const depletion = input.effectiveTeamStrength?.depletionMultiplier ?? 1.0;

  return {
    homeAdvantage: clamp(homeAdv, CAPS.homeAdvantage),
    restMultiplier: clamp(rest, CAPS.restMultiplier),
    derbyIntensity: clamp(derby, CAPS.derbyIntensity),
    importance: clamp(importance, CAPS.importance),
    squadDepletion: clamp(depletion, CAPS.squadDepletion),
    breakdown: {
      homeAdvantage: input.isHome ? 'Jogando em casa' : 'Visitante',
      rest: input.daysSinceLastMatch != null
        ? `${input.daysSinceLastMatch} dia${input.daysSinceLastMatch === 1 ? '' : 's'} desde o último jogo`
        : 'Descanso desconhecido',
      derby: input.isDerby ? 'Clássico — torcida ferve' : 'Jogo normal',
      importance: input.importance === 'final'
        ? 'Final — pressão máxima'
        : input.importance === 'decisao'
          ? 'Decisão — tensão alta'
          : 'Liga normal',
      depletion: input.effectiveTeamStrength
        ? `XI -${Math.round((1 - depletion) * 100)}% (fadiga/contratos)`
        : 'Plantel completo',
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Aplicação no SpiritContext
// ──────────────────────────────────────────────────────────────────────────

/**
 * Aplica os modificadores nos 4 campos do SpiritContext que carregam o "peso"
 * da partida na resolução. Retorna delta auditável pra debug/UI de transparência.
 *
 * Plug points e por que:
 *  - homeTeamAvg     ← homeAdvantage × squadDepletion (força efetiva do time)
 *  - crowdSupport    ← homeAdvantage × derbyIntensity (energia da torcida)
 *  - avgHomeFatigue  ← /restMultiplier (descanso baixa fadiga baseline)
 *  - tacticalMentality ← importance (decisão sobe mentalidade)
 */
export function applyContextModifiers(
  base: ApplyContextInput,
  mods: MatchContextModifiers,
): ApplyContextOutput {
  // homeTeamAvg: mando + desfalques.
  const homeTeamAvg = base.homeTeamAvg * mods.homeAdvantage * mods.squadDepletion;
  // crowdSupport: mando + clássico.
  const crowdSupport = base.crowdSupport * mods.homeAdvantage * mods.derbyIntensity;
  // Fadiga inversamente proporcional ao descanso: descansou bem ⇒ menos fadiga.
  const avgHomeFatigue = mods.restMultiplier > 0 ? base.avgHomeFatigue / mods.restMultiplier : base.avgHomeFatigue;
  // Mentalidade tática sobe em jogo importante.
  const tacticalMentality = base.tacticalMentality * mods.importance;

  // Clamps de sanidade pra evitar valores absurdos no motor.
  const clampedHomeAvg = clamp(homeTeamAvg, [0, 100]);
  const clampedCrowd = clamp(crowdSupport, [-1, 1.6]);
  const clampedFatigue = clamp(avgHomeFatigue, [0, 100]);
  const clampedMentality = clamp(tacticalMentality, [0, 1.2]);

  return {
    homeTeamAvg: clampedHomeAvg,
    crowdSupport: clampedCrowd,
    avgHomeFatigue: clampedFatigue,
    tacticalMentality: clampedMentality,
    appliedDelta: {
      homeTeamAvg: clampedHomeAvg - base.homeTeamAvg,
      crowdSupport: clampedCrowd - base.crowdSupport,
      avgHomeFatigue: clampedFatigue - base.avgHomeFatigue,
      tacticalMentality: clampedMentality - base.tacticalMentality,
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Helper: derivar daysSinceLastMatch de um histórico
// ──────────────────────────────────────────────────────────────────────────

/**
 * Pega a partida mais recente do time e devolve dias desde então (relativo a `nowMs`).
 * Retorna undefined se não tiver histórico — caller decide o que fazer.
 */
export function daysSinceLastMatchFromHistory(
  history: { atMs: number }[] | undefined,
  nowMs: number = Date.now(),
): number | undefined {
  if (!history || history.length === 0) return undefined;
  const sorted = [...history].sort((a, b) => b.atMs - a.atMs);
  const lastMs = sorted[0]!.atMs;
  if (!Number.isFinite(lastMs)) return undefined;
  const diffMs = Math.max(0, nowMs - lastMs);
  return diffMs / (1000 * 60 * 60 * 24);
}

// ──────────────────────────────────────────────────────────────────────────
// Default neutro — pra modos que ainda não plugaram contexto
// ──────────────────────────────────────────────────────────────────────────

export function neutralContextModifiers(): MatchContextModifiers {
  return {
    homeAdvantage: 1.0,
    restMultiplier: 1.0,
    derbyIntensity: 1.0,
    importance: 1.0,
    squadDepletion: 1.0,
    breakdown: {
      homeAdvantage: 'Neutro',
      rest: 'Neutro',
      derby: 'Neutro',
      importance: 'Neutro',
      depletion: 'Neutro',
    },
  };
}
