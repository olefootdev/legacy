/**
 * PR-B da Fase 1 — Monte Carlo de Predição de Partida.
 *
 * Modelo: xG (expected goals) por time → amostragem Poisson via SpiritRng
 * seedável. Mesma abordagem usada em sistemas reais (FiveThirtyEight, ClubElo)
 * pra predizer V/E/D em futebol.
 *
 * Por que não simular o GameSpirit tick-a-tick aqui:
 *  1. Performance: 1000 sims × 90 min seria ~minutos. Poisson roda em ~10ms.
 *  2. Calibração: xG é a métrica empírica do futebol real (StatsBomb base).
 *  3. Sinal forte com pouco código: consome diretamente as forças efetivas
 *     da Fase 2 + modificadores da Fase 3 — leitura honesta da partida.
 *
 * O motor full pode rodar Monte Carlo no futuro pra validar consistência;
 * pra UI viva (pré-jogo + ao vivo) Poisson é mais que suficiente.
 */

import { SpiritRng } from '../../shared/gamespirit/SpiritRng';
import type { MatchContextModifiers } from './contextFactors';
import type { EffectiveTeamStrength } from './availabilityReport';
import type { PlayerEntity } from '@/entities/types';
import { overallFromAttributes } from '@/entities/player';
import { roleFromSlotId } from './positionWeights';

// ──────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ──────────────────────────────────────────────────────────────────────────

export interface MonteCarloInput {
  /** OVR médio do time mandante (0–100). Idealmente vindo de EffectiveTeamStrength.effectiveOverall. */
  homeTeamOvr: number;
  /** OVR médio do adversário (0–100). */
  awayTeamOvr: number;
  /** Modificadores contextuais (Fase 3). Aplicados em homeAdvantage, descanso, derby, importância, depletion. */
  contextModifiers?: MatchContextModifiers;
  /** Força efetiva do time do user (Fase 2). Se ausente, baseTeamOvr é tratado como efetivo. */
  effectiveHomeStrength?: EffectiveTeamStrength;
  /** Roster mandante — usado pra calcular topScorers. */
  homeRoster?: PlayerEntity[];
  /** Roster visitante — usado pra calcular topScorers do adversário. */
  awayRoster?: PlayerEntity[];
  /** Número de simulações. Default 1000. */
  n?: number;
  /** Seed do RNG. Default Date.now() — caller pode fixar pra reprodutibilidade (UI). */
  seed?: number;
}

export interface ScoreBucket {
  score: string;          // "2-1"
  prob: number;           // [0, 1]
  homeGoals: number;
  awayGoals: number;
}

export interface TopScorer {
  playerId: string;
  playerName: string;
  goalsTotal: number;     // soma de gols em N simulações
  goalsPerMatch: number;  // média
}

export interface MonteCarloResult {
  /** Probabilidade de vitória do mandante [0, 1]. */
  winHome: number;
  draw: number;
  winAway: number;
  /** Esperança de gols por time. */
  xgHome: number;
  xgAway: number;
  /** Top 5 placares mais prováveis, ordenados desc. */
  scoreDist: ScoreBucket[];
  /** Top 3 prováveis marcadores em cada lado. */
  topHomeScorers: TopScorer[];
  topAwayScorers: TopScorer[];
  /** % das sims em que terminou com diferença ≤ 1 — proxy de "jogo aberto/dramático". */
  dramaIndex: number;
  /** True quando o underdog tem ≥ 25% de chance de vitória. */
  zebra: boolean;
  /** Lado do underdog (só definido quando zebra=true). */
  zebraSide?: 'home' | 'away';
  /** Quantas simulações foram efetivamente rodadas. */
  samples: number;
  /** Seed usada (echo pro caller saber reproduzir). */
  seedUsed: number;
  /** Tempo de execução em ms — útil pra calibrar n no caller. */
  durationMs: number;
}

// ──────────────────────────────────────────────────────────────────────────
// Calibração — alinhada com calibrationData.ts (StatsBomb base) + Fase 3
// ──────────────────────────────────────────────────────────────────────────

/** Total esperado de gols numa partida média (StatsBomb top leagues 2.5–3.0). */
const BASE_TOTAL_XG = 2.7;

/**
 * Multiplicador de xG por dif. de OVR. Usa exponente quadrático sobre
 * (ovr - 40) pra amplificar diferenças realistas: 90 vs 60 deve mesmo
 * favorecer fortemente o mandante (~70%+), não 50/50.
 */
function strengthRatio(homeOvr: number, awayOvr: number): { home: number; away: number } {
  const safe = (v: number) => Math.max(40, Math.min(99, v));
  const h = Math.pow(safe(homeOvr) - 40, 2);
  const a = Math.pow(safe(awayOvr) - 40, 2);
  const total = h + a || 1;
  return { home: (h / total) * 2, away: (a / total) * 2 };
}

// ──────────────────────────────────────────────────────────────────────────
// Poisson sampling (Knuth) com RNG seedável
// ──────────────────────────────────────────────────────────────────────────

function samplePoisson(lambda: number, rng: SpiritRng): number {
  if (lambda <= 0) return 0;
  if (lambda > 30) {
    // Aproximação Normal pra λ grande (não esperado em xG de partida, mas seguro).
    const u1 = rng.next();
    const u2 = rng.next();
    const z = Math.sqrt(-2 * Math.log(Math.max(1e-9, u1))) * Math.cos(2 * Math.PI * u2);
    return Math.max(0, Math.round(lambda + z * Math.sqrt(lambda)));
  }
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  // Knuth: multiplica uniformes até p ≤ L
  // Guard de 50 iterações pra evitar travamento em λ extremo + seed degenerado.
  for (let i = 0; i < 50; i++) {
    k++;
    p *= rng.next();
    if (p <= L) break;
  }
  return Math.max(0, k - 1);
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers de roster
// ──────────────────────────────────────────────────────────────────────────

interface ScorerWeight {
  playerId: string;
  name: string;
  weight: number;
}

/** Pesos de marcador: atacantes pesam muito, meias médio, defensores quase nada. */
function buildScorerWeights(roster: PlayerEntity[] | undefined): ScorerWeight[] {
  if (!roster || roster.length === 0) return [];
  const weights: ScorerWeight[] = [];
  for (const p of roster) {
    const ovr = overallFromAttributes(p.attrs, p.pos);
    // Map zone/pos para classe: ATA=2.0, MC/MEI=1.0, ZAG/LAT=0.2, GOL=0.02
    let posWeight = 0.5;
    const pos = p.pos?.toUpperCase() ?? '';
    if (pos === 'ATA' || pos === 'PE' || pos === 'PD' || pos === 'CA' || pos === 'CF') posWeight = 2.0;
    else if (pos === 'MC' || pos === 'MEI' || pos === 'VOL' || pos === 'MD') posWeight = 1.0;
    else if (pos === 'ZAG' || pos === 'LE' || pos === 'LD' || pos === 'LAT') posWeight = 0.2;
    else if (pos === 'GOL' || pos === 'GR' || pos === 'GK') posWeight = 0.02;
    weights.push({
      playerId: p.id,
      name: p.name,
      // ovr 60 → 0.6; ovr 90 → 0.9. Multiplica por posição.
      weight: (ovr / 100) * posWeight,
    });
  }
  return weights;
}

/** Sorteia um marcador proporcional aos pesos. Devolve undefined se sem roster. */
function sampleScorer(weights: ScorerWeight[], rng: SpiritRng): ScorerWeight | undefined {
  if (weights.length === 0) return undefined;
  const total = weights.reduce((s, w) => s + w.weight, 0);
  if (total <= 0) return weights[Math.floor(rng.next() * weights.length)]!;
  let t = rng.next() * total;
  for (const w of weights) {
    t -= w.weight;
    if (t <= 0) return w;
  }
  return weights[weights.length - 1]!;
}

// ──────────────────────────────────────────────────────────────────────────
// Aplicação dos modificadores da Fase 3 no xG
// ──────────────────────────────────────────────────────────────────────────

function applyContextToXg(
  baseHome: number,
  baseAway: number,
  mods: MatchContextModifiers | undefined,
  effective: EffectiveTeamStrength | undefined,
): { xgHome: number; xgAway: number } {
  let xgHome = baseHome;
  let xgAway = baseAway;

  if (mods) {
    // Mando + torcida favorecem ataque mandante E reduzem xG do visitante.
    // Efeito amplificado em ambos os lados pra refletir vantagem real.
    xgHome *= mods.homeAdvantage;
    xgAway *= 2 - mods.homeAdvantage; // inverso: visitante perde xg
    // Descanso amplifica desempenho mandante.
    xgHome *= 0.5 + 0.5 * mods.restMultiplier;
    // Derby aumenta intensidade ⇒ mais gols em ambos os lados.
    xgHome *= 1 + (mods.derbyIntensity - 1) * 0.6;
    xgAway *= 1 + (mods.derbyIntensity - 1) * 0.6;
    // Importância (final/decisão) eleva mentalidade mandante.
    xgHome *= 1 + (mods.importance - 1) * 0.5;
  }

  if (effective && effective.depletionMultiplier < 1) {
    // Time desfalcado produz menos xG. Aplica multiplicador da Fase 2.
    xgHome *= effective.depletionMultiplier;
  }

  return { xgHome: Math.max(0.05, xgHome), xgAway: Math.max(0.05, xgAway) };
}

// ──────────────────────────────────────────────────────────────────────────
// API principal
// ──────────────────────────────────────────────────────────────────────────

/**
 * Roda N simulações Monte Carlo e devolve agregados pra UI de predição.
 * Determinístico: mesmo input + seed produz o mesmo MonteCarloResult.
 */
export function simulateMatchN(input: MonteCarloInput): MonteCarloResult {
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const n = Math.max(1, Math.floor(input.n ?? 1000));
  const seed = input.seed ?? Date.now();
  const rng = new SpiritRng(seed);

  // xG base por força.
  const ratio = strengthRatio(input.homeTeamOvr, input.awayTeamOvr);
  let xgHomeBase = BASE_TOTAL_XG * (ratio.home / 2);
  let xgAwayBase = BASE_TOTAL_XG * (ratio.away / 2);

  // Aplica modificadores (Fase 3) + força efetiva (Fase 2).
  const adjusted = applyContextToXg(xgHomeBase, xgAwayBase, input.contextModifiers, input.effectiveHomeStrength);
  const xgHome = adjusted.xgHome;
  const xgAway = adjusted.xgAway;

  // Roster scorer weights (compostos uma vez, reusados).
  const homeScorerW = buildScorerWeights(input.homeRoster);
  const awayScorerW = buildScorerWeights(input.awayRoster);

  let winH = 0, drw = 0, winA = 0;
  let drama = 0;
  let totalGoalsHome = 0;
  let totalGoalsAway = 0;
  const scoreFreq = new Map<string, { home: number; away: number; count: number }>();
  const homeScorerCounts = new Map<string, number>();
  const awayScorerCounts = new Map<string, number>();
  const homeScorerNames = new Map<string, string>();
  const awayScorerNames = new Map<string, string>();

  for (let i = 0; i < n; i++) {
    const gh = samplePoisson(xgHome, rng);
    const ga = samplePoisson(xgAway, rng);

    if (gh > ga) winH++;
    else if (gh < ga) winA++;
    else drw++;
    if (Math.abs(gh - ga) <= 1) drama++;

    totalGoalsHome += gh;
    totalGoalsAway += ga;

    const key = `${gh}-${ga}`;
    const existing = scoreFreq.get(key);
    if (existing) existing.count++;
    else scoreFreq.set(key, { home: gh, away: ga, count: 1 });

    // Sample scorers (só pra agregar likely heroes).
    for (let g = 0; g < gh; g++) {
      const w = sampleScorer(homeScorerW, rng);
      if (w) {
        homeScorerCounts.set(w.playerId, (homeScorerCounts.get(w.playerId) ?? 0) + 1);
        homeScorerNames.set(w.playerId, w.name);
      }
    }
    for (let g = 0; g < ga; g++) {
      const w = sampleScorer(awayScorerW, rng);
      if (w) {
        awayScorerCounts.set(w.playerId, (awayScorerCounts.get(w.playerId) ?? 0) + 1);
        awayScorerNames.set(w.playerId, w.name);
      }
    }
  }

  const winHomeProb = winH / n;
  const drawProb = drw / n;
  const winAwayProb = winA / n;

  // Score dist top 5.
  const scoreDist: ScoreBucket[] = [...scoreFreq.values()]
    .map((b) => ({ score: `${b.home}-${b.away}`, prob: b.count / n, homeGoals: b.home, awayGoals: b.away }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, 5);

  const topFromMap = (counts: Map<string, number>, names: Map<string, string>): TopScorer[] => {
    return [...counts.entries()]
      .map(([id, total]) => ({
        playerId: id,
        playerName: names.get(id) ?? id,
        goalsTotal: total,
        goalsPerMatch: total / n,
      }))
      .sort((a, b) => b.goalsTotal - a.goalsTotal)
      .slice(0, 3);
  };

  const topHomeScorers = topFromMap(homeScorerCounts, homeScorerNames);
  const topAwayScorers = topFromMap(awayScorerCounts, awayScorerNames);

  const dramaIndex = drama / n;
  const zebraSide: 'home' | 'away' | undefined =
    winAwayProb >= 0.25 && winHomeProb > winAwayProb
      ? 'away'
      : winHomeProb >= 0.25 && winAwayProb > winHomeProb
        ? 'home'
        : undefined;
  const zebra = zebraSide !== undefined;

  const t1 = (typeof performance !== 'undefined' ? performance.now() : Date.now());

  return {
    winHome: winHomeProb,
    draw: drawProb,
    winAway: winAwayProb,
    xgHome: totalGoalsHome / n,
    xgAway: totalGoalsAway / n,
    scoreDist,
    topHomeScorers,
    topAwayScorers,
    dramaIndex,
    zebra,
    zebraSide,
    samples: n,
    seedUsed: seed,
    durationMs: Math.round(t1 - t0),
  };
}

// Re-export roleFromSlotId pra compat — alguns chamadores podem precisar.
export { roleFromSlotId };

// ──────────────────────────────────────────────────────────────────────────
// PR-C — Live recompute V/E/D
// ──────────────────────────────────────────────────────────────────────────

export interface LiveMonteCarloInput extends MonteCarloInput {
  currentHomeGoals: number;
  currentAwayGoals: number;
  /** 0-90. minutos já jogados. */
  minutesElapsed: number;
}

/**
 * Roda Monte Carlo da PARTIDA RESTANTE: amostra apenas os gols dos minutos
 * que faltam (xG escalado pelo ratio remaining/90), soma ao placar atual,
 * e devolve V/E/D + drama atualizados pra UI ao vivo.
 *
 * Quando minutesElapsed >= 90, devolve resultado determinístico (placar final
 * é fixo, V/E/D 0/0/1 conforme ganhador).
 */
export function simulateLiveRemainder(input: LiveMonteCarloInput): MonteCarloResult {
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const minutesRemaining = Math.max(0, 90 - input.minutesElapsed);

  // Match terminada — resultado determinístico.
  if (minutesRemaining <= 0) {
    const ch = input.currentHomeGoals;
    const ca = input.currentAwayGoals;
    const winH = ch > ca ? 1 : 0;
    const drw = ch === ca ? 1 : 0;
    const winA = ch < ca ? 1 : 0;
    return {
      winHome: winH, draw: drw, winAway: winA,
      xgHome: ch, xgAway: ca,
      scoreDist: [{ score: `${ch}-${ca}`, prob: 1, homeGoals: ch, awayGoals: ca }],
      topHomeScorers: [], topAwayScorers: [],
      dramaIndex: Math.abs(ch - ca) <= 1 ? 1 : 0,
      zebra: false, samples: 1,
      seedUsed: input.seed ?? 0, durationMs: 0,
    };
  }

  const n = Math.max(1, Math.floor(input.n ?? 1000));
  const seed = input.seed ?? Date.now();
  const rng = new SpiritRng(seed);
  const remainingRatio = minutesRemaining / 90;

  const ratio = (() => {
    const safe = (v: number) => Math.max(40, Math.min(99, v));
    const h = Math.pow(safe(input.homeTeamOvr) - 40, 2);
    const a = Math.pow(safe(input.awayTeamOvr) - 40, 2);
    const total = h + a || 1;
    return { home: (h / total) * 2, away: (a / total) * 2 };
  })();
  let xgHomeBase = BASE_TOTAL_XG * (ratio.home / 2) * remainingRatio;
  let xgAwayBase = BASE_TOTAL_XG * (ratio.away / 2) * remainingRatio;

  // Aplica modificadores (Fase 3).
  const mods = input.contextModifiers;
  let xgHome = xgHomeBase;
  let xgAway = xgAwayBase;
  if (mods) {
    xgHome *= mods.homeAdvantage;
    xgAway *= 2 - mods.homeAdvantage;
    xgHome *= 0.5 + 0.5 * mods.restMultiplier;
    xgHome *= 1 + (mods.derbyIntensity - 1) * 0.6;
    xgAway *= 1 + (mods.derbyIntensity - 1) * 0.6;
    xgHome *= 1 + (mods.importance - 1) * 0.5;
  }
  if (input.effectiveHomeStrength && input.effectiveHomeStrength.depletionMultiplier < 1) {
    xgHome *= input.effectiveHomeStrength.depletionMultiplier;
  }
  xgHome = Math.max(0.01, xgHome);
  xgAway = Math.max(0.01, xgAway);

  let winH = 0, drw = 0, winA = 0;
  let drama = 0;
  let totalGoalsHome = 0;
  let totalGoalsAway = 0;
  const scoreFreq = new Map<string, { home: number; away: number; count: number }>();

  for (let i = 0; i < n; i++) {
    const addH = samplePoisson(xgHome, rng);
    const addA = samplePoisson(xgAway, rng);
    const finalH = input.currentHomeGoals + addH;
    const finalA = input.currentAwayGoals + addA;

    if (finalH > finalA) winH++;
    else if (finalH < finalA) winA++;
    else drw++;
    if (Math.abs(finalH - finalA) <= 1) drama++;

    totalGoalsHome += finalH;
    totalGoalsAway += finalA;

    const key = `${finalH}-${finalA}`;
    const existing = scoreFreq.get(key);
    if (existing) existing.count++;
    else scoreFreq.set(key, { home: finalH, away: finalA, count: 1 });
  }

  const winHomeProb = winH / n;
  const drawProb = drw / n;
  const winAwayProb = winA / n;

  const scoreDist: ScoreBucket[] = [...scoreFreq.values()]
    .map((b) => ({ score: `${b.home}-${b.away}`, prob: b.count / n, homeGoals: b.home, awayGoals: b.away }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, 5);

  const dramaIndex = drama / n;
  const zebraSide: 'home' | 'away' | undefined =
    winAwayProb >= 0.25 && winHomeProb > winAwayProb
      ? 'away'
      : winHomeProb >= 0.25 && winAwayProb > winHomeProb
        ? 'home'
        : undefined;

  const t1 = (typeof performance !== 'undefined' ? performance.now() : Date.now());

  return {
    winHome: winHomeProb,
    draw: drawProb,
    winAway: winAwayProb,
    xgHome: totalGoalsHome / n,
    xgAway: totalGoalsAway / n,
    scoreDist,
    topHomeScorers: [],
    topAwayScorers: [],
    dramaIndex,
    zebra: zebraSide !== undefined,
    zebraSide,
    samples: n,
    seedUsed: seed,
    durationMs: Math.round(t1 - t0),
  };
}
