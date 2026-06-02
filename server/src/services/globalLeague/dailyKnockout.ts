// ═══════════════════════════════════════════════════════════════════════════
// OLEFOOT — Liga Global: lógica PURA do Mata-Mata Diário (Coroa do Dia)
//
// Sem I/O, sem Supabase, sem Math.random direto: todo o estocástico recebe
// um `rng: () => number` injetável para ser 100% determinístico em teste.
// Este módulo é a ÚNICA fonte de verdade da lógica de bracket e é espelhado
// na Edge Function `global-league-tick` (Deno) — manter os dois em sincronia.
//
// Fluxo do dia (BRT, UTC-3):
//   qualifying → (19h) selectDailyQualifiers + seedFirstRound → knockout
//   knockout   → cada round resolve com simulateKnockoutMatch (pênaltis no
//                empate); pairAdjacent(winners) gera o próximo round
//   1 vencedor → Coroa do Dia (crowned)
// ═══════════════════════════════════════════════════════════════════════════

export const BRT_OFFSET_MS = 3 * 60 * 60 * 1000; // horário de Brasília (UTC-3)

/** Data do Dia Olefoot ('YYYY-MM-DD') no fuso BRT para um instante UTC em ms. */
export function brtDayString(nowMs: number): string {
  return new Date(nowMs - BRT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Hora cheia (0–23) no fuso BRT. */
export function brtHour(nowMs: number): number {
  return new Date(nowMs - BRT_OFFSET_MS).getUTCHours();
}

/**
 * Virou o Dia Olefoot? Compara a data BRT atual com a registrada no state.
 * Quando true, o motor deve zerar daily_* e voltar à fase 'qualifying'.
 */
export function isDayRollover(dailyDate: string | null | undefined, nowMs: number): boolean {
  return brtDayString(nowMs) !== (dailyDate ?? '');
}

/**
 * Hora de abrir o mata-mata? Só na fase 'qualifying' e a partir da hora de
 * corte BRT (default 19h). Pressupõe que o rollover do dia já foi tratado no
 * mesmo tick (daily_date == hoje), então não revalida a data aqui.
 */
export function shouldOpenKnockout(phase: string, qualifyHour: number, nowMs: number): boolean {
  return phase === 'qualifying' && brtHour(nowMs) >= qualifyHour;
}

/** Maior potência de 2 ≤ n (0 se n < 2). Ex: 31→16, 32→32, 33→32. */
export function largestPowerOfTwoAtMost(n: number): number {
  if (n < 2) return 0;
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return p;
}

/** Tamanho do bracket: maior potência de 2 ≤ min(qualificados, teto). */
export function dailyBracketSize(qualifiersCount: number, maxSize = 32): number {
  return largestPowerOfTwoAtMost(Math.min(qualifiersCount, maxSize));
}

export interface QualifierTeam {
  id: string;
  club_name: string;
  club_short?: string;
  overall: number;
  daily_points: number;
  daily_goal_difference: number;
  daily_goals_for: number;
  daily_matches_played: number;
}

/** Ordena times pela corrida do dia: pontos → saldo → gols pró → overall → nome. */
export function rankDailyTeams<T extends QualifierTeam>(teams: T[]): T[] {
  return [...teams].sort((a, b) => {
    if (b.daily_points !== a.daily_points) return b.daily_points - a.daily_points;
    if (b.daily_goal_difference !== a.daily_goal_difference) return b.daily_goal_difference - a.daily_goal_difference;
    if (b.daily_goals_for !== a.daily_goals_for) return b.daily_goals_for - a.daily_goals_for;
    if (b.overall !== a.overall) return b.overall - a.overall;
    return a.club_name.localeCompare(b.club_name);
  });
}

/**
 * Seleciona os qualificados ao mata-mata do dia: só times que jogaram ao menos
 * 1 partida hoje, ranqueados, truncados ao maior bracket potência-de-2 possível.
 */
export function selectDailyQualifiers<T extends QualifierTeam>(
  teams: T[],
  maxSize = 32,
): { size: number; qualifiers: T[] } {
  const played = teams.filter((t) => (t.daily_matches_played ?? 0) > 0);
  const ranked = rankDailyTeams(played);
  const size = dailyBracketSize(ranked.length, maxSize);
  return { size, qualifiers: ranked.slice(0, size) };
}

/**
 * Ordem canônica de seeds (1-indexed) de uma eliminatória de tamanho n
 * (potência de 2). Garante que seed 1 e seed 2 só se cruzem na final.
 * Ex: n=4 → [1,4,2,3]; n=8 → [1,8,4,5,2,7,3,6].
 */
export function standardSeedOrder(n: number): number[] {
  if (n < 2) return n === 1 ? [1] : [];
  let seeds = [1, 2];
  while (seeds.length < n) {
    const sum = seeds.length * 2 + 1;
    const next: number[] = [];
    for (const s of seeds) {
      next.push(s);
      next.push(sum - s);
    }
    seeds = next;
  }
  return seeds;
}

/** Emparelha itens adjacentes: [a,b,c,d] → [[a,b],[c,d]]. */
export function pairAdjacent<T>(items: T[]): Array<[T, T]> {
  const pairs: Array<[T, T]> = [];
  for (let i = 0; i + 1 < items.length; i += 2) pairs.push([items[i], items[i + 1]]);
  return pairs;
}

/**
 * Confrontos da PRIMEIRA rodada: aplica o seeding canônico aos qualificados já
 * ranqueados (índice 0 = melhor) e emparelha — melhor seed contra pior seed.
 */
export function seedFirstRound<T>(rankedQualifiers: T[]): Array<[T, T]> {
  const order = standardSeedOrder(rankedQualifiers.length);
  const arranged = order.map((seed) => rankedQualifiers[seed - 1]);
  return pairAdjacent(arranged);
}

/** Nome humano da fase a partir do nº de times ainda no bracket. */
export function roundNameFromSize(size: number): string {
  switch (size) {
    case 2: return 'Final';
    case 4: return 'Semifinal';
    case 8: return 'Quartas de final';
    case 16: return 'Oitavas de final';
    case 32: return 'Fase de 32';
    default: return `Fase de ${size}`;
  }
}

/** Tag de fase persistida em `global_league_rounds.phase`. Ex: 'ko_8'. */
export function phaseTagFromSize(size: number): string {
  return `ko_${size}`;
}

// ── Estocástico (rng injetável) ────────────────────────────────────────────

function poisson(expected: number, rng: () => number): number {
  const L = Math.exp(-expected);
  let k = 0;
  let p = 1;
  do { k++; p *= rng(); } while (p > L && k < 8);
  return k - 1;
}

/** Probabilidade de conversão de pênalti por overall: 50→0.50, 90→0.80 (clamp). */
function penaltyConversion(ovr: number): number {
  return Math.min(0.92, Math.max(0.4, 0.5 + (ovr - 50) * 0.0075));
}

/**
 * Disputa de pênaltis: 5 cobranças + morte súbita. NUNCA empata — sempre
 * retorna um vencedor (home != away garantido).
 */
export function simulateShootout(
  effHome: number,
  effAway: number,
  rng: () => number,
): { home: number; away: number } {
  const pHome = penaltyConversion(effHome);
  const pAway = penaltyConversion(effAway);
  let h = 0;
  let a = 0;
  for (let i = 0; i < 5; i++) {
    if (rng() < pHome) h++;
    if (rng() < pAway) a++;
  }
  let guard = 0;
  while (h === a && guard < 100) {
    if (rng() < pHome) h++;
    if (rng() < pAway) a++;
    guard++;
  }
  // Fallback teórico (rng degenerado): garante vencedor para o bracket avançar.
  if (h === a) h++;
  return { home: h, away: a };
}

export interface KnockoutMatchResult {
  scoreHome: number;
  scoreAway: number;
  penHome: number | null;
  penAway: number | null;
  wentToPens: boolean;
  winner: 'home' | 'away';
}

/**
 * Resolve uma partida de mata-mata: gols por Poisson (mesma curva da liga);
 * em caso de empate, pênaltis decidem. Sempre define um vencedor.
 */
export function simulateKnockoutMatch(
  effHome: number,
  effAway: number,
  rng: () => number,
): KnockoutMatchResult {
  const diff = (effHome + 3) - effAway; // +3 = vantagem de "mando"
  const scoreHome = poisson(Math.max(0.2, 1.4 + diff / 22), rng);
  const scoreAway = poisson(Math.max(0.2, 1.4 - diff / 22), rng);
  if (scoreHome !== scoreAway) {
    return {
      scoreHome, scoreAway,
      penHome: null, penAway: null,
      wentToPens: false,
      winner: scoreHome > scoreAway ? 'home' : 'away',
    };
  }
  const pens = simulateShootout(effHome, effAway, rng);
  return {
    scoreHome, scoreAway,
    penHome: pens.home, penAway: pens.away,
    wentToPens: true,
    winner: pens.home > pens.away ? 'home' : 'away',
  };
}

/**
 * Vencedor de um confronto JÁ FINALIZADO, a partir dos placares persistidos
 * (gols e, no empate, pênaltis). Usado para derivar o bracket tanto no
 * processamento normal quanto na recuperação de rounds travados — sem
 * re-simular. Retorna null se a partida não está decidida.
 */
export function winnerSideFromScores(
  scoreHome: number,
  scoreAway: number,
  penHome: number | null | undefined,
  penAway: number | null | undefined,
  wentToPens: boolean | undefined,
): 'home' | 'away' | null {
  if (scoreHome !== scoreAway) return scoreHome > scoreAway ? 'home' : 'away';
  if (wentToPens && penHome != null && penAway != null) {
    return penHome > penAway ? 'home' : 'away';
  }
  return null;
}

export interface BracketTeamLike {
  id: string;
  overall: number;
}

export interface BracketRound<T> {
  size: number;
  phase: string;
  name: string;
  matches: Array<{ home: T; away: T; result: KnockoutMatchResult }>;
}

/**
 * Roda um bracket completo a partir dos qualificados já ranqueados e retorna o
 * campeão, o vice e o log de rounds. Usado pelos self-tests e como referência
 * canônica do comportamento que os motores (edge + server) devem replicar
 * round-a-round.
 */
export function runFullBracket<T extends BracketTeamLike>(
  rankedQualifiers: T[],
  rng: () => number,
): { champion: T; runnerUp: T; rounds: Array<BracketRound<T>> } | null {
  if (rankedQualifiers.length < 2) return null;
  let pairs = seedFirstRound(rankedQualifiers);
  const rounds: Array<BracketRound<T>> = [];
  let champion: T | null = null;
  let runnerUp: T | null = null;

  while (pairs.length >= 1) {
    const size = pairs.length * 2;
    const matches = pairs.map(([home, away]) => ({
      home,
      away,
      result: simulateKnockoutMatch(home.overall, away.overall, rng),
    }));
    rounds.push({ size, phase: phaseTagFromSize(size), name: roundNameFromSize(size), matches });

    const winners = matches.map((m) => (m.result.winner === 'home' ? m.home : m.away));
    if (winners.length === 1) {
      champion = winners[0];
      const finalMatch = matches[0];
      runnerUp = finalMatch.result.winner === 'home' ? finalMatch.away : finalMatch.home;
      break;
    }
    pairs = pairAdjacent(winners);
  }

  if (!champion || !runnerUp) return null;
  return { champion, runnerUp, rounds };
}
