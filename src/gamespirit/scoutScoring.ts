/**
 * Sistema de pontuação por scout para Partida Rápida.
 * Inspirado no Cartola FC — pontuação ilimitada baseada em desempenho real.
 *
 * Fluxo:
 *   1. `applyScoutEvent()` — aplica um evento ao tally do jogador (com crítico e multiplicador de contexto)
 *   2. `finalizeScoutTallies()` — bônus de fim de jogo (clean sheet, volume de defesas difíceis)
 *   3. `computeMatchMvp()` — elege melhor de cada posição + MVP geral com critérios anti-atacante-fácil
 */

// ─── Pontos base por evento ─────────────────────────────────────────────────

export const SCOUT_POINTS = {
  // Defensivos
  tackle:              1.2,
  foulCommitted:      -0.3,
  ownGoal:            -3.0,
  yellowCard:         -1.0,
  redCard:            -3.0,
  cleanSheet:          5.0,   // GK + zagueiros + laterais ao final
  difficultSave:       1.0,   // GK
  penaltySaved:        7.0,   // GK
  goalConceded:       -1.0,   // GK
  penaltyCommitted:   -1.0,

  // Ofensivos
  foulSuffered:        0.5,
  incompletePass:     -0.1,
  assist:              5.0,
  shotPost:            3.0,
  shotSaved:           1.2,
  shotWide:            0.8,
  goal:                8.0,
  offside:            -0.1,
  penaltyMissed:      -4.0,
  penaltySuffered:     1.0,
} as const;

export type ScoutEventKind = keyof typeof SCOUT_POINTS;

// ─── Multiplicadores de contexto ────────────────────────────────────────────

/** Gol decisivo: empate ou 1 de diferença depois do min 70. */
const DECISIVE_GOAL_MULT      = 1.25;
/** Assistência que gera gol decisivo. */
const DECISIVE_ASSIST_MULT    = 1.2;
/** Defesa difícil no final do jogo com resultado justo. */
const CLUTCH_SAVE_MULT        = 1.5;
/** Defesa de pênalti em momento crítico (≥75' ou empate). */
const CLUTCH_PENALTY_SAVE_MULT = 1.2;
/** Desarme que impede chance clara de gol. */
const CRITICAL_TACKLE_MULT    = 1.5;
/** Clean sheet com alta pressão ofensiva adversária. */
const PRESSURE_CLEAN_SHEET_MULT = 1.2;

// ─── Chance de crítico hit por tipo de evento ───────────────────────────────

const CRIT_CHANCE: Partial<Record<ScoutEventKind, number>> = {
  goal:         0.20,
  assist:       0.15,
  difficultSave: 0.18,
  tackle:       0.15,
  shotPost:     0.10,
  penaltySaved: 0.25,
};

/** Multiplicador quando rola crítico. */
const CRIT_MULTIPLIER = 1.5;

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface ScoutEventLog {
  kind: ScoutEventKind;
  minute: number;
  points: number;
  wasCrit: boolean;
  contextMult: number;
}

export interface ScoutTally {
  playerId: string;
  name: string;
  /** Posição para critério de MVP (GK, CB, LB, RB, MID, FWD…). */
  pos: string;
  totalPoints: number;
  events: ScoutEventLog[];
  /** Contagens brutas para critérios de MVP. */
  goals: number;
  assists: number;
  difficultSaves: number;
  tackles: number;
  penaltiesSaved: number;
  hasCleanSheet: boolean;
}

export interface ScoutMvpEntry {
  playerId: string;
  name: string;
  pos: string;
  totalPoints: number;
  headline: string;
}

export interface MatchScoutResult {
  tallies: Record<string, ScoutTally>;
  mvp: ScoutMvpEntry;
  top3: ScoutMvpEntry[];
}

// ─── Helpers internos ───────────────────────────────────────────────────────

function rollCrit(kind: ScoutEventKind, rng: number): boolean {
  const chance = CRIT_CHANCE[kind] ?? 0;
  return rng < chance;
}

function isDecisiveGoalMoment(minute: number, homeScore: number, awayScore: number): boolean {
  if (minute < 70) return false;
  return Math.abs(homeScore - awayScore) <= 1;
}

function emptyTally(playerId: string, name: string, pos: string): ScoutTally {
  return {
    playerId, name, pos,
    totalPoints: 0,
    events: [],
    goals: 0,
    assists: 0,
    difficultSaves: 0,
    tackles: 0,
    penaltiesSaved: 0,
    hasCleanSheet: false,
  };
}

// ─── API pública ─────────────────────────────────────────────────────────────

export interface ApplyScoutEventInput {
  tallies: Record<string, ScoutTally>;
  playerId: string;
  name: string;
  pos: string;
  kind: ScoutEventKind;
  minute: number;
  /** 0–1 aleatório para determinar crítico. */
  rng: number;
  /** Contexto de jogo para multiplicadores. */
  context?: {
    homeScore: number;
    awayScore: number;
    isDecisiveGoal?: boolean;
    isDecisiveAssist?: boolean;
    isClutchSave?: boolean;
    isClutchPenaltySave?: boolean;
    isCriticalTackle?: boolean;
  };
}

/** Aplica um evento de scout ao tally do jogador (mutável — passe uma cópia se precisar). */
export function applyScoutEvent(input: ApplyScoutEventInput): void {
  const { tallies, playerId, name, pos, kind, minute, rng, context } = input;

  if (!tallies[playerId]) {
    tallies[playerId] = emptyTally(playerId, name, pos);
  }
  const t = tallies[playerId]!;

  let base = SCOUT_POINTS[kind];

  // Multiplicador de contexto
  let contextMult = 1.0;
  if (context) {
    if (kind === 'goal' && context.isDecisiveGoal) contextMult = DECISIVE_GOAL_MULT;
    if (kind === 'assist' && context.isDecisiveAssist) contextMult = DECISIVE_ASSIST_MULT;
    if (kind === 'difficultSave' && context.isClutchSave) contextMult = CLUTCH_SAVE_MULT;
    if (kind === 'penaltySaved' && context.isClutchPenaltySave) contextMult = CLUTCH_PENALTY_SAVE_MULT;
    if (kind === 'tackle' && context.isCriticalTackle) contextMult = CRITICAL_TACKLE_MULT;
  }

  // Crítico hit (só em eventos positivos)
  const wasCrit = base > 0 && rollCrit(kind, rng);
  const critMult = wasCrit ? CRIT_MULTIPLIER : 1.0;

  const points = base * contextMult * critMult;

  t.totalPoints += points;
  t.events.push({ kind, minute, points, wasCrit, contextMult });

  // Contadores brutos
  if (kind === 'goal')          t.goals++;
  if (kind === 'assist')        t.assists++;
  if (kind === 'difficultSave') t.difficultSaves++;
  if (kind === 'tackle')        t.tackles++;
  if (kind === 'penaltySaved')  t.penaltiesSaved++;
}

/** Bônus de fim de jogo. Deve ser chamado uma vez no FINALIZE_MATCH. */
export function finalizeScoutTallies(
  tallies: Record<string, ScoutTally>,
  opts: {
    homeScore: number;
    awayScore: number;
    /** Pressão ofensiva acumulada do adversário (0–1). */
    awayPressure01?: number;
  },
): void {
  const cleanSheet = opts.awayScore === 0;
  const highPressure = (opts.awayPressure01 ?? 0) >= 0.6;

  for (const t of Object.values(tallies)) {
    const isDefensive = ['GK', 'CB', 'LB', 'RB', 'SW', 'WB'].includes(t.pos.toUpperCase());
    if (cleanSheet && isDefensive) {
      const mult = highPressure ? PRESSURE_CLEAN_SHEET_MULT : 1.0;
      const pts = SCOUT_POINTS.cleanSheet * mult;
      t.totalPoints += pts;
      t.hasCleanSheet = true;
      t.events.push({ kind: 'cleanSheet', minute: 90, points: pts, wasCrit: false, contextMult: mult });
    }
    // GK: penalidade por gol sofrido já aplicada em tempo real; clean sheet já acima
  }
}

// ─── MVP ─────────────────────────────────────────────────────────────────────

function mvpHeadline(t: ScoutTally): string {
  if (t.penaltiesSaved >= 1) return `${t.penaltiesSaved} pênalti(s) defendido(s)`;
  if (t.goals >= 2)          return `${t.goals} gols`;
  if (t.goals === 1 && t.assists >= 1) return '1 gol + 1 assistência';
  if (t.assists >= 2)        return `${t.assists} assistências`;
  if (t.difficultSaves >= 4) return `${t.difficultSaves} defesas difíceis`;
  if (t.tackles >= 4)        return `${t.tackles} desarmes`;
  if (t.goals === 1)         return '1 gol';
  if (t.assists === 1)       return '1 assistência';
  if (t.hasCleanSheet)       return 'Jogo sem sofrer gol';
  return `${t.totalPoints.toFixed(1)} pontos`;
}

/**
 * Diversidade de MVP: evita premiar atacante com 1 gol e pouco mais
 * se outros jogadores tiveram desempenho tático superior.
 */
function mvpScore(t: ScoutTally): number {
  let score = t.totalPoints;

  // Bônus de variedade — meia com 2 assist > atacante com 1 gol isolado
  if (t.assists >= 2) score += 2.5;

  // Goleiro com 6+ defesas difíceis entra forte
  if (t.difficultSaves >= 6) score += 4.0;

  // Zagueiro com clean sheet + 5+ desarmes
  if (t.hasCleanSheet && t.tackles >= 5) score += 3.5;

  // Penalizar atacante que marcou 1 gol mas ficou invisível o resto
  const totalEvents = t.events.length;
  const onlyGoal = t.goals === 1 && t.assists === 0 && totalEvents <= 3;
  if (onlyGoal) score -= 1.5;

  return score;
}

/** Elege o MVP e o top-3 com critérios de variedade posicional. */
export function computeMatchMvp(tallies: Record<string, ScoutTally>): {
  mvp: ScoutMvpEntry;
  top3: ScoutMvpEntry[];
} {
  const entries = Object.values(tallies);
  if (entries.length === 0) {
    const fallback: ScoutMvpEntry = {
      playerId: '', name: 'Equipa', pos: '—',
      totalPoints: 0, headline: '—',
    };
    return { mvp: fallback, top3: [fallback] };
  }

  const ranked = [...entries].sort((a, b) => mvpScore(b) - mvpScore(a));

  const top3: ScoutMvpEntry[] = ranked.slice(0, 3).map(t => ({
    playerId: t.playerId,
    name: t.name,
    pos: t.pos,
    totalPoints: parseFloat(t.totalPoints.toFixed(2)),
    headline: mvpHeadline(t),
  }));

  return { mvp: top3[0]!, top3 };
}

// ─── Probabilidades de eventos especiais ────────────────────────────────────

export const SPECIAL_EVENT_PROBS = {
  /** Chance de escanteio por ataque perigoso. */
  cornerFromDangerousAttack: { min: 0.18, max: 0.28 },
  /** Chance de cruzamento virar cabeçada. */
  crossToHeader: 0.22,
  /** Dado uma cabeçada, chance de ser de zagueiro em escanteio. */
  headerFromCBCorner: 0.30,
  /** Dado cabeçada de zagueiro em escanteio, chance de gol. */
  headerGoal: 0.18,
  /** Aumento de defesas difíceis geradas em jogo difícil para GK. */
  hardGameGkBoost: 0.35,
  /** Chance de clean sheet bonus reforçado quando adversário pressiona muito. */
  pressureCleanSheetBonus: 0.40,
} as const;

/** Gera probabilidade de escanteio para o tick atual (rng = 0–1). */
export function rollCornerChance(rng: number): boolean {
  const { min, max } = SPECIAL_EVENT_PROBS.cornerFromDangerousAttack;
  const threshold = min + rng * (max - min);
  return Math.random() < threshold;
}

/** Verifica se cruzamento vira cabeçada, e se o gol acontece (retorna evento gerado). */
export function rollHeaderSequence(rng1: number, rng2: number, rng3: number): {
  isHeader: boolean;
  isCBHeader: boolean;
  isGoal: boolean;
} {
  const isHeader = rng1 < SPECIAL_EVENT_PROBS.crossToHeader;
  const isCBHeader = isHeader && rng2 < SPECIAL_EVENT_PROBS.headerFromCBCorner;
  const isGoal = isCBHeader && rng3 < SPECIAL_EVENT_PROBS.headerGoal;
  return { isHeader, isCBHeader, isGoal };
}
