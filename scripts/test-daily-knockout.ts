/**
 * test-daily-knockout.ts
 *
 * Self-test da lógica PURA do Mata-Mata Diário (Coroa do Dia) — sem Supabase.
 * Valida seeding, tamanho de bracket, pênaltis (nunca empatam), convergência
 * do bracket a 1 campeão, e o fuso BRT.
 *
 * Uso:  npx tsx scripts/test-daily-knockout.ts   (ou: npm run test:daily-knockout)
 */

import {
  BRT_OFFSET_MS,
  brtDayString,
  brtHour,
  isDayRollover,
  shouldOpenKnockout,
  largestPowerOfTwoAtMost,
  dailyBracketSize,
  rankDailyTeams,
  selectDailyQualifiers,
  standardSeedOrder,
  pairAdjacent,
  seedFirstRound,
  roundNameFromSize,
  phaseTagFromSize,
  simulateShootout,
  simulateKnockoutMatch,
  winnerSideFromScores,
  runFullBracket,
  type QualifierTeam,
} from '../server/src/services/globalLeague/dailyKnockout.js';

let failures = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (cond) { console.log('  PASS  ' + msg); }
  else { console.error('  FAIL  ' + msg); failures++; }
}
function section(t: string) { console.log('\n=== ' + t + ' ==='); }

// RNG determinístico (mulberry32) para testes reproduzíveis.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mkTeam(id: string, overall: number, daily: Partial<QualifierTeam> = {}): QualifierTeam {
  return {
    id,
    club_name: id,
    overall,
    daily_points: daily.daily_points ?? 0,
    daily_goal_difference: daily.daily_goal_difference ?? 0,
    daily_goals_for: daily.daily_goals_for ?? 0,
    daily_matches_played: daily.daily_matches_played ?? 1,
  };
}

// ── 1. largestPowerOfTwoAtMost ─────────────────────────────────────────────
section('1. largestPowerOfTwoAtMost');
ok(largestPowerOfTwoAtMost(1) === 0, '1 → 0 (sem bracket)');
ok(largestPowerOfTwoAtMost(2) === 2, '2 → 2');
ok(largestPowerOfTwoAtMost(3) === 2, '3 → 2');
ok(largestPowerOfTwoAtMost(5) === 4, '5 → 4');
ok(largestPowerOfTwoAtMost(31) === 16, '31 → 16');
ok(largestPowerOfTwoAtMost(32) === 32, '32 → 32');
ok(largestPowerOfTwoAtMost(33) === 32, '33 → 32');
ok(largestPowerOfTwoAtMost(100) === 64, '100 → 64');

// ── 2. dailyBracketSize (teto 32) ──────────────────────────────────────────
section('2. dailyBracketSize (teto 32)');
ok(dailyBracketSize(100) === 32, '100 qualificados → 32 (teto)');
ok(dailyBracketSize(40) === 32, '40 → 32');
ok(dailyBracketSize(33) === 32, '33 → 32');
ok(dailyBracketSize(32) === 32, '32 → 32');
ok(dailyBracketSize(20) === 16, '20 → 16');
ok(dailyBracketSize(8) === 8, '8 → 8');
ok(dailyBracketSize(7) === 4, '7 → 4');
ok(dailyBracketSize(1) === 0, '1 → 0 (sem mata-mata)');
ok(dailyBracketSize(50, 16) === 16, 'teto custom 16 respeitado');

// ── 3. rankDailyTeams + selectDailyQualifiers ──────────────────────────────
section('3. ranking e seleção de qualificados');
const pool = [
  mkTeam('A', 70, { daily_points: 9, daily_goal_difference: 5, daily_goals_for: 8, daily_matches_played: 3 }),
  mkTeam('B', 80, { daily_points: 9, daily_goal_difference: 7, daily_goals_for: 9, daily_matches_played: 3 }),
  mkTeam('C', 75, { daily_points: 6, daily_goal_difference: 2, daily_goals_for: 5, daily_matches_played: 3 }),
  mkTeam('D', 60, { daily_points: 3, daily_goal_difference: -1, daily_goals_for: 3, daily_matches_played: 2 }),
  mkTeam('E', 90, { daily_points: 0, daily_goal_difference: 0, daily_goals_for: 0, daily_matches_played: 0 }), // não jogou
];
const ranked = rankDailyTeams(pool);
ok(ranked[0].id === 'B', 'B lidera (mesmos pontos que A, saldo melhor)');
ok(ranked[1].id === 'A', 'A em 2º (desempate por saldo)');
ok(ranked[2].id === 'C', 'C em 3º');
const sel = selectDailyQualifiers(pool);
ok(sel.size === 4, '4 qualificados de bracket (5 com jogo, mas E não jogou → 4)');
ok(!sel.qualifiers.find((t) => t.id === 'E'), 'E (0 jogos) fica de fora');
ok(sel.qualifiers[0].id === 'B', 'seed 1 = B');

// ── 4. standardSeedOrder (canônico) ────────────────────────────────────────
section('4. seeding canônico de eliminatória');
ok(JSON.stringify(standardSeedOrder(2)) === JSON.stringify([1, 2]), 'n=2 → [1,2]');
ok(JSON.stringify(standardSeedOrder(4)) === JSON.stringify([1, 4, 2, 3]), 'n=4 → [1,4,2,3]');
ok(JSON.stringify(standardSeedOrder(8)) === JSON.stringify([1, 8, 4, 5, 2, 7, 3, 6]), 'n=8 → [1,8,4,5,2,7,3,6]');
ok(standardSeedOrder(32).length === 32, 'n=32 → 32 posições');
ok(new Set(standardSeedOrder(32)).size === 32, 'n=32 sem seeds repetidos');

// ── 5. seedFirstRound: melhor vs pior ──────────────────────────────────────
section('5. confrontos da primeira rodada');
const q8 = Array.from({ length: 8 }, (_, i) => mkTeam(`S${i + 1}`, 90 - i, { daily_points: 100 - i, daily_matches_played: 1 }));
const rankedQ8 = rankDailyTeams(q8); // S1..S8 já em ordem
const r1 = seedFirstRound(rankedQ8);
ok(r1.length === 4, '8 times → 4 jogos na 1ª fase');
ok(r1[0][0].id === 'S1' && r1[0][1].id === 'S8', 'jogo 1: seed1 (S1) vs seed8 (S8)');
ok(r1[1][0].id === 'S4' && r1[1][1].id === 'S5', 'jogo 2: S4 vs S5');
// S1 (top half) e S2 (bottom half) não podem se cruzar antes da final:
const topHalfIds = [r1[0], r1[1]].flat().map((t) => t.id);
const bottomHalfIds = [r1[2], r1[3]].flat().map((t) => t.id);
ok(topHalfIds.includes('S1') && bottomHalfIds.includes('S2'), 'S1 e S2 em metades opostas do bracket');

// ── 6. pairAdjacent ────────────────────────────────────────────────────────
section('6. pairAdjacent');
ok(JSON.stringify(pairAdjacent([1, 2, 3, 4])) === JSON.stringify([[1, 2], [3, 4]]), '[1,2,3,4] → [[1,2],[3,4]]');

// ── 7. Pênaltis NUNCA empatam ──────────────────────────────────────────────
section('7. disputa de pênaltis nunca empata');
{
  const rng = mulberry32(12345);
  let tied = 0;
  let homeWins = 0;
  for (let i = 0; i < 5000; i++) {
    const s = simulateShootout(72, 72, rng);
    if (s.home === s.away) tied++;
    if (s.home > s.away) homeWins++;
  }
  ok(tied === 0, '5000 disputas, 0 empates');
  ok(homeWins > 1500 && homeWins < 3500, `equilíbrio entre forças iguais (home venceu ${homeWins}/5000)`);
  // Time muito mais forte converte mais
  const rng2 = mulberry32(999);
  let strongWins = 0;
  for (let i = 0; i < 2000; i++) {
    const s = simulateShootout(90, 50, rng2);
    if (s.home > s.away) strongWins++;
  }
  ok(strongWins > 1100, `time 90 OVR vence o 50 OVR na maioria (${strongWins}/2000)`);
}

// ── 8. simulateKnockoutMatch sempre tem vencedor ───────────────────────────
section('8. partida de mata-mata sempre define vencedor');
{
  const rng = mulberry32(42);
  let noWinner = 0;
  let pensWhenDraw = 0;
  let pensWhenNotDraw = 0;
  for (let i = 0; i < 5000; i++) {
    const m = simulateKnockoutMatch(70, 68, rng);
    if (m.winner !== 'home' && m.winner !== 'away') noWinner++;
    if (m.scoreHome === m.scoreAway && !m.wentToPens) pensWhenDraw++;
    if (m.scoreHome !== m.scoreAway && m.wentToPens) pensWhenNotDraw++;
  }
  ok(noWinner === 0, '5000 partidas, todas com vencedor');
  ok(pensWhenDraw === 0, 'todo empate no tempo normal foi aos pênaltis');
  ok(pensWhenNotDraw === 0, 'nenhum jogo decidido no tempo foi aos pênaltis');
}

// ── 9. runFullBracket converge a 1 campeão ─────────────────────────────────
section('9. bracket completo → 1 campeão');
for (const size of [2, 4, 8, 16, 32]) {
  const rng = mulberry32(7 * size + 1);
  const q = rankDailyTeams(
    Array.from({ length: size }, (_, i) => mkTeam(`T${i + 1}`, 85 - (i % 30), { daily_points: 1000 - i, daily_matches_played: 1 })),
  );
  const res = runFullBracket(q, rng);
  ok(res !== null, `bracket de ${size} produziu resultado`);
  if (res) {
    const expectedRounds = Math.log2(size);
    ok(res.rounds.length === expectedRounds, `bracket de ${size} teve ${expectedRounds} rodadas`);
    ok(q.some((t) => t.id === res.champion.id), `campeão (${res.champion.id}) é um dos qualificados`);
    ok(res.champion.id !== res.runnerUp.id, 'campeão ≠ vice');
    ok(res.rounds[res.rounds.length - 1].size === 2, 'última rodada é a final (2 times)');
    ok(res.rounds[0].size === size, `primeira rodada tem ${size} times`);
  }
}
ok(runFullBracket(rankDailyTeams([mkTeam('solo', 70)]), mulberry32(1)) === null, '1 time só → sem bracket (null)');

// ── 10. Favoritismo estatístico: melhor seed vence mais ────────────────────
section('10. melhor seed vence o torneio com mais frequência (estatístico)');
{
  let seed1Titles = 0;
  const trials = 600;
  for (let i = 0; i < trials; i++) {
    const rng = mulberry32(100 + i);
    // 8 times com OVRs decrescentes nítidos (90,86,...) → seed1 é favorito
    const q = rankDailyTeams(
      Array.from({ length: 8 }, (_, k) => mkTeam(`F${k + 1}`, 90 - k * 4, { daily_points: 1000 - k, daily_matches_played: 1 })),
    );
    const res = runFullBracket(q, rng);
    if (res && res.champion.id === 'F1') seed1Titles++;
  }
  // Aleatório seria ~12.5% (1/8). Favorito deve superar bem isso.
  ok(seed1Titles / trials > 0.25, `seed 1 venceu ${(100 * seed1Titles / trials).toFixed(1)}% (> 25%, aleatório seria 12.5%)`);
}

// ── 11. Fuso BRT ───────────────────────────────────────────────────────────
section('11. fuso BRT (UTC-3)');
ok(BRT_OFFSET_MS === 3 * 3600 * 1000, 'offset = 3h');
{
  // 2026-05-31T22:30:00Z = 19:30 BRT do dia 31
  const ms = Date.UTC(2026, 4, 31, 22, 30, 0);
  ok(brtDayString(ms) === '2026-05-31', '22:30Z → dia BRT 2026-05-31');
  ok(brtHour(ms) === 19, '22:30Z → 19h BRT (hora do corte)');
  // 2026-06-01T01:00:00Z = 22:00 BRT do dia 31 (ainda dia anterior em BRT)
  const ms2 = Date.UTC(2026, 5, 1, 1, 0, 0);
  ok(brtDayString(ms2) === '2026-05-31', '01:00Z do dia 1 → ainda 2026-05-31 em BRT');
  ok(brtHour(ms2) === 22, '01:00Z → 22h BRT');
  // 2026-06-01T03:30:00Z = 00:30 BRT do dia 1 → virada do dia
  const ms3 = Date.UTC(2026, 5, 1, 3, 30, 0);
  ok(brtDayString(ms3) === '2026-06-01', '03:30Z → virou 2026-06-01 em BRT (reset diário)');
}

// ── 11b. State machine diária (rollover + abertura do mata-mata) ───────────
section('11b. predicados da state machine diária');
{
  const cut = Date.UTC(2026, 4, 31, 22, 0, 0);   // 19:00 BRT do dia 31
  const before = Date.UTC(2026, 4, 31, 20, 0, 0); // 17:00 BRT
  const nextDay = Date.UTC(2026, 5, 1, 4, 0, 0);  // 01:00 BRT do dia 1
  // rollover
  ok(isDayRollover('2026-05-30', cut) === true, 'daily_date de ontem → rollover true');
  ok(isDayRollover('2026-05-31', cut) === false, 'daily_date de hoje → rollover false');
  ok(isDayRollover(null, cut) === true, 'daily_date null → rollover true (primeira vez)');
  ok(isDayRollover('2026-05-31', nextDay) === true, 'daily_date 31 mas já é dia 1 BRT → rollover true');
  // abertura do mata-mata
  ok(shouldOpenKnockout('qualifying', 19, cut) === true, 'qualifying + 19h BRT → abre');
  ok(shouldOpenKnockout('qualifying', 19, before) === false, 'qualifying + 17h BRT → não abre');
  ok(shouldOpenKnockout('knockout', 19, cut) === false, 'já em knockout → não reabre');
  ok(shouldOpenKnockout('crowned', 19, cut) === false, 'já crowned → não reabre');
  ok(shouldOpenKnockout('qualifying', 20, cut) === false, 'corte às 20h, são 19h → ainda não abre');
}

// ── 11c. winnerSideFromScores (derivação sem re-simular) ───────────────────
section('11c. vencedor a partir do placar finalizado');
ok(winnerSideFromScores(2, 1, null, null, false) === 'home', '2x1 → home');
ok(winnerSideFromScores(0, 3, null, null, false) === 'away', '0x3 → away');
ok(winnerSideFromScores(1, 1, 4, 2, true) === 'home', '1x1 (4x2 pen) → home');
ok(winnerSideFromScores(2, 2, 3, 5, true) === 'away', '2x2 (3x5 pen) → away');
ok(winnerSideFromScores(1, 1, null, null, false) === null, 'empate sem pênaltis → null (indecidido)');

// ── 12. Labels de fase ─────────────────────────────────────────────────────
section('12. labels de fase');
ok(roundNameFromSize(2) === 'Final', 'size 2 → Final');
ok(roundNameFromSize(4) === 'Semifinal', 'size 4 → Semifinal');
ok(roundNameFromSize(8) === 'Quartas de final', 'size 8 → Quartas');
ok(roundNameFromSize(16) === 'Oitavas de final', 'size 16 → Oitavas');
ok(phaseTagFromSize(8) === 'ko_8', 'phase tag ko_8');

// ── Resumo ─────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(50));
console.log(`${checks - failures}/${checks} checks passaram.`);
if (failures > 0) {
  console.error(`\nFALHOU — ${failures} erro(s).`);
  process.exit(1);
} else {
  console.log('\nPASSOU — lógica do mata-mata diário validada.');
}
