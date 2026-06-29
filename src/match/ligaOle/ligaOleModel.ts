/**
 * ligaOleModel.ts — Liga Ole: mata-mata de 32 times REAIS de managers.
 *
 * Visão (doc de engagement / jornada Elifoot): o manager cria uma liga, o sistema
 * sorteia 32 clubes de managers reais (elencos reais, nunca externos), monta o
 * chaveamento e o manager joga rodada a rodada até ser campeão. Perdeu, acabou —
 * salva até onde chegou. Cada confronto SEMPRE tem vencedor (empate → pênaltis).
 *
 * Este módulo é PURO e DETERMINÍSTICO (seed) — sem React, sem Date/Math.random —
 * pra ser testável (scripts/test-liga-ole.ts) e dar replay coerente. A partida DO
 * MANAGER é jogada no Quick engajado (resultado real entra via advanceLigaOle);
 * os outros confrontos do chaveamento são resolvidos aqui por força + sorte.
 */

export interface LigaOleTeam {
  id: string;
  name: string;
  short: string;
  /** Força do clube (OVR efetivo, já considerando fadiga/disponíveis no manager). */
  overall: number;
  isManager?: boolean;
  /** auth.users.id do manager dono do clube — usado pra notificar o derrotado (nêmesis). */
  managerId?: string;
}

export const LIGA_OLE_ROUNDS = ['Fase de 32', 'Oitavas', 'Quartas', 'Semifinal', 'Final'] as const;
export type LigaOleRound = (typeof LIGA_OLE_ROUNDS)[number];
export const LIGA_OLE_SIZE = 32;

/**
 * Premiação por VITÓRIA em cada fase (índice = rodada vencida). Tudo creditado no
 * saldo de jogo (`finance.ole`, exibido como EXP). A Semifinal soma o bônus de
 * "ir para a final" (500k + 250k). Vencer a Final (campeão) é o grande prêmio.
 *   0 Fase de 32 → 50k · 1 Oitavas → 100k · 2 Quartas → 250k ·
 *   3 Semifinal → 750k (500k + 250k ida à final) · 4 Final/CAMPEÃO → 1.000.000
 */
export const LIGA_OLE_ROUND_REWARDS = [50_000, 100_000, 250_000, 750_000, 1_000_000] as const;

/** Recompensa por vencer a rodada `roundIndex` (0..4). isChampion na Final. */
export function ligaOleRoundReward(roundIndex: number): { amount: number; isChampion: boolean; round: LigaOleRound } {
  const i = Math.max(0, Math.min(LIGA_OLE_ROUNDS.length - 1, roundIndex));
  return {
    amount: LIGA_OLE_ROUND_REWARDS[i] ?? 0,
    isChampion: i >= LIGA_OLE_ROUNDS.length - 1,
    round: LIGA_OLE_ROUNDS[i]!,
  };
}

/**
 * DINASTIA: cada título já conquistado aumenta o prêmio das próximas campanhas.
 * +12% por título, teto de 2× (5 títulos). O 1º título joga com multiplicador 1×.
 */
export function dinastiaMultiplier(titles: number): number {
  const t = Math.max(0, Math.floor(titles || 0));
  return Math.min(2, 1 + t * 0.12);
}

/** Etiqueta de dinastia pelo nº de títulos (Bicampeão, Tricampeão, …). */
export function dinastiaLabel(titles: number): string | null {
  const t = Math.max(0, Math.floor(titles || 0));
  if (t <= 0) return null;
  const names = ['', 'Campeão', 'Bicampeão', 'Tricampeão', 'Tetracampeão', 'Pentacampeão'];
  return names[t] ?? `${t}× Campeão`;
}

export interface LigaOleMatchResult {
  winner: string; // team id
  scoreA: number;
  scoreB: number;
  shootout: boolean;
}

export interface LigaOleState {
  seed: string;
  teams: Record<string, LigaOleTeam>;
  managerTeamId: string;
  /** Rodada atual (0 = Fase de 32 … 4 = Final). */
  roundIndex: number;
  /** Participantes por rodada (ids em ordem de chave). participants[0] = 32 ids. */
  participants: string[][];
  /** Resultados das partidas já resolvidas, por chave "round:slotPar". */
  results: Record<string, LigaOleMatchResult>;
  status: 'active' | 'champion' | 'eliminated';
  /** Até onde o manager chegou (preenchido na eliminação ou no título). */
  reachedRound: LigaOleRound;
}

// ─── RNG determinístico local (mulberry32) ───────────────────────────────────

function hashStr(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i += 1) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function rngFor(seed: string): () => number {
  let a = hashStr(seed) >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Chaveamento (seeding padrão por força) ──────────────────────────────────

/** Ordem de seeds num bracket de n (1 vs n, 2 vs n-1 …) — fortes só se cruzam tarde. */
function seedSlots(n: number): number[] {
  let pls = [1, 2];
  while (pls.length < n) {
    const sum = pls.length * 2 + 1;
    const next: number[] = [];
    for (const p of pls) { next.push(p); next.push(sum - p); }
    pls = next;
  }
  return pls;
}

/** Resolve UM confronto por força + sorte. Nunca empata (empate real → pênaltis). */
export function resolveAutoMatch(a: LigaOleTeam, b: LigaOleTeam, seed: string): LigaOleMatchResult {
  const rng = rngFor(`${seed}|auto|${a.id}|${b.id}`);
  // Probabilidade do A vencer pela diferença de força (logística suave).
  const pA = 1 / (1 + Math.exp(-(a.overall - b.overall) / 8));
  const aWins = rng() < pA;
  // Placar plausível coerente com o vencedor; margem 0 → decidido nos pênaltis.
  const loserGoals = Math.floor(rng() * 3);          // 0..2
  const margin = Math.floor(rng() * 3);              // 0..2
  const shootout = margin === 0;
  const winnerGoals = loserGoals + margin;
  if (aWins) {
    return shootout
      ? { winner: a.id, scoreA: loserGoals, scoreB: loserGoals, shootout: true }
      : { winner: a.id, scoreA: winnerGoals, scoreB: loserGoals, shootout: false };
  }
  return shootout
    ? { winner: b.id, scoreA: loserGoals, scoreB: loserGoals, shootout: true }
    : { winner: b.id, scoreA: loserGoals, scoreB: winnerGoals, shootout: false };
}

/**
 * Cria a Liga Ole: 32 times (o manager + 31 reais), semeados por FORÇA (seed 1 =
 * mais forte), de modo que clubes fortes só se cruzem nas fases finais — recompensa
 * quem tem time melhor. O manager entra semeado pelo próprio OVR efetivo.
 */
export function createLigaOle(args: {
  teams: LigaOleTeam[];      // exatamente 32 (inclui o do manager)
  managerTeamId: string;
  seed: string;
}): LigaOleState {
  const { managerTeamId, seed } = args;
  const teams = args.teams.slice(0, LIGA_OLE_SIZE);
  if (teams.length !== LIGA_OLE_SIZE) {
    throw new Error(`Liga Ole exige ${LIGA_OLE_SIZE} times, recebeu ${teams.length}`);
  }
  // Seed por força (desempate estável pelo id pra ser determinístico).
  const byStrength = [...teams].sort((x, y) => (y.overall - x.overall) || (x.id < y.id ? -1 : 1));
  const slots = seedSlots(LIGA_OLE_SIZE); // ex.: [1,32,16,17,...] (1-based)
  const ordered: string[] = slots.map((s) => byStrength[s - 1]!.id);
  const teamsById: Record<string, LigaOleTeam> = {};
  for (const t of teams) teamsById[t.id] = t;
  return {
    seed,
    teams: teamsById,
    managerTeamId,
    roundIndex: 0,
    participants: [ordered],
    results: {},
    status: 'active',
    reachedRound: LIGA_OLE_ROUNDS[0],
  };
}

/** O adversário do manager na rodada atual (ou null se já acabou). */
export function managerOpponent(state: LigaOleState): LigaOleTeam | null {
  if (state.status !== 'active') return null;
  const round = state.participants[state.roundIndex];
  if (!round) return null;
  const idx = round.indexOf(state.managerTeamId);
  if (idx < 0) return null;
  const oppId = idx % 2 === 0 ? round[idx + 1] : round[idx - 1];
  return oppId ? state.teams[oppId] ?? null : null;
}

/**
 * Avança a rodada: aplica o resultado REAL da partida do manager + resolve todos
 * os outros confrontos por força. Monta a próxima rodada. Se o manager perdeu →
 * eliminado (salva a fase). Se venceu a Final → campeão.
 */
export function advanceLigaOle(state: LigaOleState, managerResult: {
  won: boolean; scoreManager: number; scoreOpp: number; shootout: boolean;
}): LigaOleState {
  if (state.status !== 'active') return state;
  const r = state.roundIndex;
  const round = state.participants[r];
  if (!round) return state;
  const mIdx = round.indexOf(state.managerTeamId);
  if (mIdx < 0) return state;

  const results = { ...state.results };
  const winners: string[] = [];
  for (let pair = 0; pair < round.length; pair += 2) {
    const aId = round[pair]!;
    const bId = round[pair + 1]!;
    const key = `${r}:${pair / 2}`;
    const isManagerPair = aId === state.managerTeamId || bId === state.managerTeamId;
    if (isManagerPair) {
      const managerIsA = aId === state.managerTeamId;
      const won = managerResult.won;
      const winner = won ? state.managerTeamId : (managerIsA ? bId : aId);
      results[key] = {
        winner,
        scoreA: managerIsA ? managerResult.scoreManager : managerResult.scoreOpp,
        scoreB: managerIsA ? managerResult.scoreOpp : managerResult.scoreManager,
        shootout: managerResult.shootout,
      };
      winners.push(winner);
    } else {
      const res = resolveAutoMatch(state.teams[aId]!, state.teams[bId]!, `${state.seed}|r${r}`);
      results[key] = res;
      winners.push(res.winner);
    }
  }

  const roundName = LIGA_OLE_ROUNDS[r]!;

  // Manager perdeu → eliminado (salva até esta fase).
  if (!managerResult.won) {
    return { ...state, results, status: 'eliminated', reachedRound: roundName };
  }
  // Venceu a Final → campeão.
  if (r >= LIGA_OLE_ROUNDS.length - 1) {
    return { ...state, results, status: 'champion', reachedRound: LIGA_OLE_ROUNDS[LIGA_OLE_ROUNDS.length - 1]! };
  }
  // Avança pra próxima fase.
  const participants = [...state.participants, winners];
  return {
    ...state,
    results,
    participants,
    roundIndex: r + 1,
    reachedRound: LIGA_OLE_ROUNDS[r + 1]!,
  };
}

export interface LigaOleRoundMatch {
  pairIndex: number;
  a: LigaOleTeam;
  b: LigaOleTeam;
  /** Presente quando o confronto já foi resolvido (rodadas passadas). */
  result?: LigaOleMatchResult;
  isManager: boolean;
}

/** Confrontos de uma rodada (pra desenhar o chaveamento). Rodadas passadas têm
 *  `result`; a rodada atual traz só os pares (resolve quando o manager joga). */
export function roundMatches(state: LigaOleState, roundIndex: number): LigaOleRoundMatch[] {
  const round = state.participants[roundIndex];
  if (!round) return [];
  const out: LigaOleRoundMatch[] = [];
  for (let pair = 0; pair < round.length; pair += 2) {
    const aId = round[pair]!;
    const bId = round[pair + 1]!;
    const a = state.teams[aId];
    const b = state.teams[bId];
    if (!a || !b) continue;
    out.push({
      pairIndex: pair / 2,
      a, b,
      result: state.results[`${roundIndex}:${pair / 2}`],
      isManager: aId === state.managerTeamId || bId === state.managerTeamId,
    });
  }
  return out;
}

/** Rodadas já existentes no chaveamento (0..atual) — pras abas do bracket. */
export function availableRoundCount(state: LigaOleState): number {
  return state.participants.length;
}
