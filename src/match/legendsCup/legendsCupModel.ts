/**
 * LEGENDS CUP — o manager enfrenta os times das lendas da OLEFOOT.
 *
 * FORMATO
 *   Fase de grupos: 4 times (o manager + 3 clubes de MANAGERS REAIS), turno
 *   único — 3 rodadas, todos contra todos. Os 2 primeiros avançam.
 *   Mata-mata: 5 fases, cada uma contra um time montado com os cards REAIS de
 *   lenda que estão no mercado. A cada degrau entra mais lenda.
 *
 * REUSO: roda no motor da Partida Rápida e espelha a Liga Ole (fases nomeadas,
 * prêmio por fase, estado ativo/campeão/eliminado). O que muda é o adversário —
 * no mata-mata não é manager real, é elenco de lenda.
 *
 * REGRA DO CARD (decisão do fundador): o card que entra no time adversário é
 * sempre o MELHOR das 3 fases de cada lenda. Ver LEGENDS_CUP_SQUADS.
 *
 * DETERMINISMO: tudo que é sorteado (adversários do grupo, resultados dos jogos
 * que o manager não disputa) sai da `seed` da campanha. Sem isso o manager
 * recarrega a página até cair uma chave fácil.
 */

export const LEGENDS_CUP_ROUNDS = [
  'Fase de Grupos',
  'Playoff',
  'Oitavas',
  'Quartas',
  'Semifinal',
  'Final',
] as const;

export type LegendsCupRound = (typeof LEGENDS_CUP_ROUNDS)[number];

/** 4 times no grupo, turno único: cada um joga 3. Os 2 primeiros avançam. */
export const GROUP_SIZE = 4;
export const GROUP_MATCHES = GROUP_SIZE - 1;
export const GROUP_QUALIFIERS = 2;

/** Id fixo do manager dentro do grupo (espelha o `'manager'` da Liga Ole). */
export const MANAGER_TEAM_ID = 'manager';

/**
 * GOLEIRO FIXO das lendas: Jiva (AI+, OVR 80, especialista em pênalti).
 *
 * Entra do Playoff em diante — NÃO na fase de grupos, que é entre managers.
 * Sem ele, o gol dos times de lenda ficava com um Genesis 57 atrás do
 * Palhinha 95.
 */
export const LEGENDS_CUP_KEEPER = 'ai-jiva-2026';

/**
 * Elenco de lenda por fase, por `collection_id` — não por id de card. O modelo
 * resolve o MELHOR card de cada coleção em runtime, então quando o fundador
 * lançar uma fase nova de alguém, o time do Cup acompanha sozinho.
 *
 * `null` na fase de grupos = adversários são managers reais, sem lenda. O
 * goleiro Jiva é somado a todas as fases de mata-mata pelo `legendsCupSquad`.
 */
export const LEGENDS_CUP_SQUADS: Record<LegendsCupRound, string[] | null> = {
  'Fase de Grupos': null,
  'Playoff': [
    'mem-juca-1970',
    'mem-nando-2026',
    'mem-johnson-macaba-2026',
    'mem-breno-liborge-2026',
  ],
  'Oitavas': [
    'mem-adauto-2026',
    'mem-willian-xavier-2026',
    'mem-nando-2026',
    'mem-johnson-macaba-2026',
    'mem-breno-liborge-2026',
  ],
  'Quartas': [
    'mem-adauto-2026',
    'mem-willian-xavier-2026',
    'mem-breno-liborge-2026',
    'mem-nem-lima-2026',
    'mem-cocito-2026',
  ],
  'Semifinal': [
    'mem-adauto-2026',
    'mem-willian-xavier-2026',
    'mem-nem-lima-2026',
    'mem-cocito-2026',
    'mem-breno-liborge-2026',
    'mem-nando-2026',
    'mem-marcelo-goncalves-2026',
  ],
  'Final': [
    'mem-adauto-2026',
    'mem-willian-xavier-2026',
    'mem-nem-lima-2026',
    'mem-cocito-2026',
    'mem-breno-liborge-2026',
    'mem-nando-2026',
    'mem-marcelo-goncalves-2026',
    'mem-palhinha-2026',
  ],
};

/**
 * Nome do time adversário de cada fase do mata-mata. É o que o manager vê antes
 * de entrar — a fase tem que soar como um degrau, não como "adversário 4".
 */
export const LEGENDS_CUP_OPPONENT_NAME: Record<LegendsCupRound, string> = {
  'Fase de Grupos': 'Grupo A',
  'Playoff': 'Os Convocados',
  'Oitavas': 'Os Artilheiros',
  'Quartas': 'A Muralha',
  'Semifinal': 'Os Campeões',
  'Final': 'Os Imortais',
};

/**
 * Um time tem 11. As lendas cobrem as posições delas; o resto é preenchido com
 * Genesis. Sem isto, o Playoff entraria em campo com 2 atacantes, 1 meia e 1
 * lateral — sem goleiro e sem zaga.
 */
export const SQUAD_SIZE = 11;

// ---------------------------------------------------------------------------
// Fase de grupos
// ---------------------------------------------------------------------------

export interface LegendsCupGroupTeam {
  id: string;
  name: string;
  short: string;
  overall: number;
  /** true no time do próprio manager. */
  isManager?: boolean;
  /** Quando o rival é um manager real (para futura notificação cross-user). */
  managerId?: string;
}

export interface LegendsCupStanding {
  teamId: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface LegendsCupGroupMatch {
  round: number; // 0..2
  homeId: string;
  awayId: string;
  scoreHome?: number;
  scoreAway?: number;
  /** true no jogo que o próprio manager disputa. */
  isManager: boolean;
}

export function emptyStanding(teamId: string): LegendsCupStanding {
  return { teamId, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
}

/**
 * Tabela de turno único pra 4 times. O manager (índice 0) joga uma vez por
 * rodada, sempre; as outras duplas preenchem o resto.
 */
export function buildGroupFixtures(teamIds: string[]): LegendsCupGroupMatch[] {
  const [m, a, b, c] = teamIds;
  if (!m || !a || !b || !c) return [];
  const pair = (round: number, homeId: string, awayId: string, isManager: boolean) =>
    ({ round, homeId, awayId, isManager }) as LegendsCupGroupMatch;
  return [
    pair(0, m, a, true), pair(0, b, c, false),
    pair(1, b, m, true), pair(1, c, a, false),
    pair(2, m, c, true), pair(2, a, b, false),
  ];
}

/** Aplica um placar na tabela. 3 pontos por vitória, 1 por empate. */
export function applyToStandings(
  table: Record<string, LegendsCupStanding>,
  homeId: string,
  awayId: string,
  scoreHome: number,
  scoreAway: number,
): Record<string, LegendsCupStanding> {
  const home = { ...(table[homeId] ?? emptyStanding(homeId)) };
  const away = { ...(table[awayId] ?? emptyStanding(awayId)) };
  home.played += 1; away.played += 1;
  home.goalsFor += scoreHome; home.goalsAgainst += scoreAway;
  away.goalsFor += scoreAway; away.goalsAgainst += scoreHome;
  if (scoreHome > scoreAway) { home.wins += 1; home.points += 3; away.losses += 1; }
  else if (scoreHome < scoreAway) { away.wins += 1; away.points += 3; home.losses += 1; }
  else { home.draws += 1; home.points += 1; away.draws += 1; away.points += 1; }
  return { ...table, [homeId]: home, [awayId]: away };
}

export function goalDiff(s: LegendsCupStanding): number {
  return s.goalsFor - s.goalsAgainst;
}

/** Classificação: pontos → saldo → gols pró. */
export function sortStandings(rows: LegendsCupStanding[]): LegendsCupStanding[] {
  return [...rows].sort(
    (x, y) => y.points - x.points || goalDiff(y) - goalDiff(x) || y.goalsFor - x.goalsFor,
  );
}

/** RNG determinístico por seed — mesma campanha, mesmos resultados. */
export function rngFor(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Simula um jogo entre dois times de IA. A diferença de overall inclina o
 * placar, mas nunca o decide sozinho — zebra tem que existir, senão a tabela
 * do grupo é só os overalls ordenados e não vale a pena olhar.
 */
export function simGroupMatch(
  rnd: () => number,
  overallHome: number,
  overallAway: number,
): { scoreHome: number; scoreAway: number } {
  const edge = Math.max(-12, Math.min(12, overallHome + 3 - overallAway)) / 12; // +3 = mando
  const goals = (bias: number) => {
    const lambda = Math.max(0.25, 1.35 + bias * 0.85);
    let n = 0;
    for (let i = 0; i < 5; i += 1) if (rnd() < lambda / (i + 2.1)) n += 1;
    return n;
  };
  return { scoreHome: goals(edge), scoreAway: goals(-edge) };
}

// ---------------------------------------------------------------------------
// Prêmios
// ---------------------------------------------------------------------------

/**
 * EXP por VENCER cada fase (índice = fase vencida). Cresce forte no mata-mata
 * porque é lá que entram as lendas — o degrau tem que se pagar.
 */
export const LEGENDS_CUP_PHASE_EXP: number[] = [
  2_500_000,   // Fase de Grupos (classificou)
  5_000_000,   // Playoff
  10_000_000,  // Oitavas
  20_000_000,  // Quartas
  40_000_000,  // Semifinal
  100_000_000, // Final — título
];

/**
 * Multiplicador por campanha repetida. Dobra a cada campanha, mas COM TETO —
 * sem isso, 100M viram 800M em três rodadas e o Cup imprime mais EXP que todas
 * as outras fontes do jogo somadas.
 */
export const EXP_MULTIPLIER_CAP = 4;

export function expMultiplier(runNumber: number): number {
  const n = Math.max(1, Math.floor(runNumber));
  return Math.min(EXP_MULTIPLIER_CAP, 2 ** (n - 1));
}

export function legendsCupPhaseExp(roundIndex: number, runNumber: number): number {
  const base = LEGENDS_CUP_PHASE_EXP[Math.max(0, Math.min(LEGENDS_CUP_PHASE_EXP.length - 1, roundIndex))] ?? 0;
  return Math.round(base * expMultiplier(runNumber));
}

// ---------------------------------------------------------------------------
// Estado da campanha
// ---------------------------------------------------------------------------

export interface LegendsCupState {
  seed: string;
  /** 0 = Fase de Grupos … 5 = Final. */
  roundIndex: number;
  /** Os 4 times do grupo — o do manager é `isManager`. */
  groupTeams: LegendsCupGroupTeam[];
  /** Tabela do grupo por teamId. */
  standings: Record<string, LegendsCupStanding>;
  /** Todos os jogos do grupo, com placar quando já disputados. */
  groupFixtures: LegendsCupGroupMatch[];
  /** Quantas rodadas do grupo já saíram (0..3). */
  groupRoundsPlayed: number;
  status: 'active' | 'champion' | 'eliminated';
  /** Até onde chegou — preenchido na eliminação ou no título. */
  reachedRound: LegendsCupRound;
  /**
   * Nº da campanha deste manager (1 = primeira). Define o multiplicador de EXP:
   * o card exclusivo só sai na PRIMEIRA vez que a fase é vencida; da segunda
   * campanha em diante o prêmio é só EXP, dobrado.
   */
  runNumber: number;
}

export function roundOf(index: number): LegendsCupRound {
  const i = Math.max(0, Math.min(LEGENDS_CUP_ROUNDS.length - 1, index));
  return LEGENDS_CUP_ROUNDS[i]!;
}

export function isFinalRound(index: number): boolean {
  return index >= LEGENDS_CUP_ROUNDS.length - 1;
}

export function isGroupStage(index: number): boolean {
  return index === 0;
}

/** Estado inicial. `rivals` são os 3 clubes de managers reais já sorteados. */
export function createLegendsCupState(
  seed: string,
  managerTeam: LegendsCupGroupTeam,
  rivals: LegendsCupGroupTeam[],
  runNumber = 1,
): LegendsCupState {
  const groupTeams = [{ ...managerTeam, isManager: true }, ...rivals.slice(0, GROUP_SIZE - 1)];
  const ids = groupTeams.map((t) => t.id);
  return {
    seed,
    roundIndex: 0,
    groupTeams,
    standings: Object.fromEntries(ids.map((id) => [id, emptyStanding(id)])),
    groupFixtures: buildGroupFixtures(ids),
    groupRoundsPlayed: 0,
    status: 'active',
    reachedRound: 'Fase de Grupos',
    runNumber: Math.max(1, Math.floor(runNumber)),
  };
}

/** O jogo do manager na rodada atual do grupo. */
export function currentGroupMatch(s: LegendsCupState): LegendsCupGroupMatch | undefined {
  return s.groupFixtures.find((f) => f.isManager && f.round === s.groupRoundsPlayed);
}

/** O adversário do manager na rodada atual do grupo. */
export function currentGroupOpponent(s: LegendsCupState): LegendsCupGroupTeam | undefined {
  const fx = currentGroupMatch(s);
  if (!fx) return undefined;
  const oppId = fx.homeId === MANAGER_TEAM_ID ? fx.awayId : fx.homeId;
  return s.groupTeams.find((t) => t.id === oppId);
}

/** Posição do manager na tabela (1-based). */
export function managerGroupPosition(s: LegendsCupState): number {
  const sorted = sortStandings(Object.values(s.standings));
  return sorted.findIndex((r) => r.teamId === MANAGER_TEAM_ID) + 1;
}

/**
 * Aplica o resultado de uma partida e devolve o estado novo.
 *
 * Fase de grupos: grava o placar do manager E simula o outro jogo da rodada,
 * senão a tabela mostraria só o manager pontuando. Ao fim das 3 rodadas, os 2
 * primeiros avançam. Mata-mata: derrota elimina na hora.
 */
export function applyMatchResult(
  state: LegendsCupState,
  won: boolean,
  scoreManager = won ? 1 : 0,
  scoreOpp = won ? 0 : 1,
): LegendsCupState {
  if (state.status !== 'active') return state;
  const s = { ...state };

  if (isGroupStage(s.roundIndex)) {
    const round = s.groupRoundsPlayed;
    const rnd = rngFor(`${s.seed}:grupo:${round}`);
    let standings = { ...s.standings };

    const fixtures = s.groupFixtures.map((f) => {
      if (f.round !== round || f.scoreHome !== undefined) return f;
      if (f.isManager) {
        const managerIsHome = f.homeId === MANAGER_TEAM_ID;
        const scoreHome = managerIsHome ? scoreManager : scoreOpp;
        const scoreAway = managerIsHome ? scoreOpp : scoreManager;
        standings = applyToStandings(standings, f.homeId, f.awayId, scoreHome, scoreAway);
        return { ...f, scoreHome, scoreAway };
      }
      const ovr = (id: string) => s.groupTeams.find((t) => t.id === id)?.overall ?? 70;
      const sim = simGroupMatch(rnd, ovr(f.homeId), ovr(f.awayId));
      standings = applyToStandings(standings, f.homeId, f.awayId, sim.scoreHome, sim.scoreAway);
      return { ...f, ...sim };
    });

    s.groupFixtures = fixtures;
    s.standings = standings;
    s.groupRoundsPlayed = round + 1;

    if (s.groupRoundsPlayed >= GROUP_MATCHES) {
      const pos = managerGroupPosition({ ...s });
      if (pos > 0 && pos <= GROUP_QUALIFIERS) {
        s.roundIndex = 1;
        s.reachedRound = roundOf(1);
      } else {
        s.status = 'eliminated';
      }
    }
    return s;
  }

  if (!won) {
    s.status = 'eliminated';
    return s;
  }
  if (isFinalRound(s.roundIndex)) {
    s.status = 'champion';
    s.reachedRound = 'Final';
    return s;
  }
  s.roundIndex += 1;
  s.reachedRound = roundOf(s.roundIndex);
  return s;
}
