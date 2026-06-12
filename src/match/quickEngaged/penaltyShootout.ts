/**
 * penaltyShootout.ts — Disputa de pênaltis da Partida Rápida 2.0.
 *
 * Regra de produto: NENHUM jogo termina empatado. No empate, vai pra disputa.
 *
 * Lógica REAL (pedido do fundador):
 *  • Batedor: técnica (finalização) × físico (sangue-frio/potência) × confiança,
 *    DESCONTADO pela fadiga — quem está mais inteiro e mais técnico converte mais.
 *  • Goleiro: defesa (marcação) + confiança + físico + um traço OCULTO de
 *    "pegador de pênalti" (determinístico por goleiro — alguns são especialistas).
 *  • Melhor de 5 (com parada antecipada quando matematicamente decidido).
 *  • Empatou em 5 → MORTE SÚBITA alternada usando o resto do elenco (cicla).
 *
 * PURO e DETERMINÍSTICO (seed) — sem React, sem Date/Math.random — pra ser
 * testável (scripts/test-penalty-shootout.ts) e dar replay coerente.
 */

export interface ShootoutKicker {
  id: string;
  name: string;
  pos: string;
  /** Técnica de finalização (0–100) — núcleo da cobrança. */
  finalizacao: number;
  /** Físico (0–100) — potência e sangue-frio sob pressão. */
  fisico: number;
  /** Confiança (0–100) — frieza na hora H. */
  confianca: number;
  /** Fadiga atual (0–100) — cansaço derruba a qualidade da batida. */
  fatigue: number;
  portrait?: string | null;
}

export interface ShootoutKeeper {
  id: string;
  name: string;
  /** Marcação/reflexo (0–100) — base da defesa. */
  marcacao: number;
  confianca: number;
  fisico: number;
  fatigue: number;
}

export type KickOutcome = 'goal' | 'save' | 'miss';

export interface ShootoutKick {
  round: number;
  side: 'home' | 'away';
  kickerId: string;
  kickerName: string;
  scored: boolean;
  outcome: KickOutcome;
  /** Probabilidade de gol calculada (debug/teste/explicação). */
  goalProb: number;
  /** Placar da DISPUTA após esta cobrança. */
  homeTally: number;
  awayTally: number;
  suddenDeath: boolean;
}

export interface ShootoutResult {
  winner: 'home' | 'away';
  homeTally: number;
  awayTally: number;
  kicks: ShootoutKick[];
  suddenDeath: boolean;
}

const clamp = (lo: number, hi: number, v: number) => Math.max(lo, Math.min(hi, v));

// ─── RNG determinístico local (mulberry32) — sem dependências ────────────────

function hashStr(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i += 1) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

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

function rngFor(seed: string): () => number {
  return mulberry32(hashStr(seed));
}

// ─── Modelo de qualidade ─────────────────────────────────────────────────────

/** Qualidade da batida: técnica × físico × confiança, descontada a fadiga. */
export function kickerRating(k: ShootoutKicker): number {
  const base = k.finalizacao * 0.5 + k.fisico * 0.3 + k.confianca * 0.2;
  const fatiguePenalty = (clamp(0, 100, k.fatigue) / 100) * 18; // até -18 exausto
  return clamp(20, 99, base - fatiguePenalty);
}

/**
 * Capacidade do goleiro de defender pênalti. Marcação é o núcleo; confiança e
 * físico ajudam; e um TRAÇO OCULTO determinístico faz alguns goleiros serem
 * "pegadores de pênalti" de verdade (varia ~-6 a +10 por goleiro, fixo no jogo).
 */
export function keeperPenaltyRating(g: ShootoutKeeper, seed: string): number {
  const base = g.marcacao * 0.55 + g.confianca * 0.3 + g.fisico * 0.15;
  const specialist = rngFor(`${seed}:gkspec:${g.id}`)(); // 0..1, fixo por goleiro
  const bonus = (specialist - 0.38) * 16; // ~-6.1 .. +9.9
  const fatiguePenalty = (clamp(0, 100, g.fatigue) / 100) * 12;
  return clamp(20, 95, base + bonus - fatiguePenalty);
}

/** Probabilidade de gol da cobrança (batedor vs goleiro). Pênalti favorece o
 *  batedor (~75% na média real), goleiro forte desconta. */
export function goalProbability(kicker: ShootoutKicker, keeper: ShootoutKeeper, seed: string): number {
  const kr = kickerRating(kicker);
  const gr = keeperPenaltyRating(keeper, seed);
  const diff = (kr - gr) / 100; // ~-0.8 .. +0.8
  return clamp(0.40, 0.96, 0.74 + diff * 0.42);
}

/** Resolve uma cobrança. Determinístico pelo seed + side + round + batedor. */
export function resolveKick(
  kicker: ShootoutKicker,
  keeper: ShootoutKeeper,
  seed: string,
  side: 'home' | 'away',
  round: number,
): { scored: boolean; outcome: KickOutcome; goalProb: number } {
  const goalProb = goalProbability(kicker, keeper, seed);
  const rng = rngFor(`${seed}:so:${side}:${round}:${kicker.id}`);
  const r = rng();
  const scored = r < goalProb;
  let outcome: KickOutcome = 'goal';
  if (!scored) {
    // Falhou: foi DEFESA (goleiro forte) ou ERRO do batedor (fadiga/azar)?
    // Quanto melhor o goleiro relativo, mais provável ser defesa que erro pra fora.
    const gr = keeperPenaltyRating(keeper, seed);
    const saveShare = clamp(0.35, 0.8, 0.4 + (gr - 55) / 100);
    outcome = rngFor(`${seed}:miss:${side}:${round}:${kicker.id}`)() < saveShare ? 'save' : 'miss';
  }
  return { scored, outcome, goalProb };
}

// ─── Disputa completa ────────────────────────────────────────────────────────

/** Quantas cobranças restam pro time nas 5 primeiras (pra parada antecipada). */
function remainingInFive(kicksTaken: number): number {
  return Math.max(0, 5 - kicksTaken);
}

/**
 * Simula a disputa inteira. Recebe as ORDENS COMPLETAS (os 5 escolhidos +
 * o resto do elenco pra morte súbita) de cada time + os goleiros.
 *
 * Nunca empata: morte súbita alternada segue até alguém marcar e o outro não
 * no mesmo round. Os batedores ciclam quando a lista acaba (elenco inteiro).
 */
export function simulateShootout(args: {
  homeOrder: ShootoutKicker[];
  awayOrder: ShootoutKicker[];
  homeKeeper: ShootoutKeeper;
  awayKeeper: ShootoutKeeper;
  seed: string;
}): ShootoutResult {
  const { homeOrder, awayOrder, homeKeeper, awayKeeper, seed } = args;
  const kicks: ShootoutKick[] = [];
  let homeTally = 0;
  let awayTally = 0;
  let homeTaken = 0;
  let awayTaken = 0;

  const kickHome = (round: number, sudden: boolean) => {
    const kicker = homeOrder[homeTaken % homeOrder.length]!;
    const res = resolveKick(kicker, awayKeeper, seed, 'home', round);
    if (res.scored) homeTally += 1;
    homeTaken += 1;
    kicks.push({
      round, side: 'home', kickerId: kicker.id, kickerName: kicker.name,
      scored: res.scored, outcome: res.outcome, goalProb: res.goalProb,
      homeTally, awayTally, suddenDeath: sudden,
    });
  };
  const kickAway = (round: number, sudden: boolean) => {
    const kicker = awayOrder[awayTaken % awayOrder.length]!;
    const res = resolveKick(kicker, homeKeeper, seed, 'away', round);
    if (res.scored) awayTally += 1;
    awayTaken += 1;
    kicks.push({
      round, side: 'away', kickerId: kicker.id, kickerName: kicker.name,
      scored: res.scored, outcome: res.outcome, goalProb: res.goalProb,
      homeTally, awayTally, suddenDeath: sudden,
    });
  };

  // Decidido nas 5 primeiras? (líder já não pode ser alcançado)
  const decidedInFive = (): boolean => {
    const homeCanGet = homeTally + remainingInFive(homeTaken);
    const awayCanGet = awayTally + remainingInFive(awayTaken);
    return homeTally > awayCanGet || awayTally > homeCanGet;
  };

  // ── Melhor de 5 (home bate primeiro em cada round), com parada antecipada ──
  for (let round = 1; round <= 5; round += 1) {
    kickHome(round, false);
    if (decidedInFive()) break;
    kickAway(round, false);
    if (decidedInFive()) break;
  }

  // ── Morte súbita: rounds alternados até diferença no fim do round ──
  let round = 6;
  let suddenDeath = false;
  while (homeTally === awayTally) {
    suddenDeath = true;
    kickHome(round, true);
    kickAway(round, true);
    round += 1;
    // (homeTally !== awayTally encerra; se ambos marcam/erram, segue)
  }

  return {
    winner: homeTally > awayTally ? 'home' : 'away',
    homeTally,
    awayTally,
    kicks,
    suddenDeath,
  };
}

// ─── Helpers de seleção (UI) ─────────────────────────────────────────────────

/** Ordena candidatos pela qualidade de cobrança (melhor primeiro). */
export function rankKickers(kickers: ShootoutKicker[]): ShootoutKicker[] {
  return [...kickers].sort((a, b) => kickerRating(b) - kickerRating(a));
}
