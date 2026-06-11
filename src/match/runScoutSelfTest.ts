/**
 * Autochecagem da régua de scout compartilhada (sem Vitest).
 * `npm run test:scout`
 */
import assert from 'node:assert/strict';
import type { MatchEventEntry } from '@/engine/types';
import { computeScoutFromEvents, scoutBoardFromLiveTallies, SCOUT_CAPTAIN_MULT } from './scout';
import { SCOUT_POINTS, type ScoutTally } from '@/gamespirit/scoutScoring';

const homeRoster = [
  { id: 'h-gk', name: 'PAREDÃO', pos: 'GOL' },
  { id: 'h-zag', name: 'MURO', pos: 'ZAG' },
  { id: 'h-mc', name: 'MAESTRO', pos: 'MC' },
  { id: 'h-ata', name: 'ARTILHEIRO', pos: 'ATA' },
];
const awayRoster = [
  { id: 'a-gk', name: 'GATO', pos: 'GOL' },
  { id: 'a-zag', name: 'XERIFE', pos: 'ZAG' },
  { id: 'a-ata', name: 'PONTA', pos: 'ATA' },
];

function ev(partial: Partial<MatchEventEntry> & Pick<MatchEventEntry, 'minute' | 'kind'>): MatchEventEntry {
  return { id: `${partial.kind}-${partial.minute}`, text: '', ...partial } as MatchEventEntry;
}

// ── Cenário 1: 2x1 com gol decisivo, cartões e capitão ──────────────────────
// 30' gol casa (h-ata) → 1-0 · 60' gol visita (a-ata) → 1-1 ·
// 80' gol casa (h-ata) com jogo empatado = DECISIVO → 2-1 ·
// 40' amarelo (h-mc) · 75' vermelho (a-zag) · 20' chute fora (h-mc)
const events: MatchEventEntry[] = [
  ev({ minute: 80, kind: 'goal_home', playerId: 'h-ata' }),
  ev({ minute: 30, kind: 'goal_home', playerId: 'h-ata' }),
  ev({ minute: 60, kind: 'goal_away', playerId: 'a-ata' }),
  ev({ minute: 40, kind: 'yellow_home', playerId: 'h-mc' }),
  ev({ minute: 75, kind: 'red_away', playerId: 'a-zag' }),
  ev({ minute: 20, kind: 'shot_home', playerId: 'h-mc' }),
];

const board = computeScoutFromEvents({
  events,
  homeRoster,
  awayRoster,
  homeCaptainId: 'h-ata',
  awayCaptainId: 'a-gk',
  homeScore: 2,
  awayScore: 1,
});

// Artilheiro da casa: gol normal (8) + gol decisivo (8 × 1.25 = 10) = 18 → capitão ×2 = 36
const hAta = board.home.find((r) => r.playerId === 'h-ata')!;
assert.ok(hAta, 'h-ata pontuou');
assert.equal(hAta.goals, 2);
assert.equal(hAta.isCaptain, true);
assert.equal(hAta.points, (SCOUT_POINTS.goal + SCOUT_POINTS.goal * 1.25) * SCOUT_CAPTAIN_MULT);

// Meia: amarelo (-1) + chute fora (0.8) = -0.2
const hMc = board.home.find((r) => r.playerId === 'h-mc')!;
assert.equal(hMc.points, parseFloat((SCOUT_POINTS.yellowCard + SCOUT_POINTS.shotWide).toFixed(2)));

// GK casa sofreu 1 gol (-1); GK visita sofreu 2 (-2)
assert.equal(board.home.find((r) => r.playerId === 'h-gk')!.points, SCOUT_POINTS.goalConceded);
const aGk = board.away.find((r) => r.playerId === 'a-gk')!;
assert.equal(aGk.points, SCOUT_POINTS.goalConceded * 2 * SCOUT_CAPTAIN_MULT); // capitão visita ×2 (negativo dobra também)

// Zagueiro visitante: vermelho -3
assert.equal(board.away.find((r) => r.playerId === 'a-zag')!.points, SCOUT_POINTS.redCard);

// Atacante visitante: 1 gol (60', não decisivo) = 8
const aAta = board.away.find((r) => r.playerId === 'a-ata')!;
assert.equal(aAta.points, SCOUT_POINTS.goal);
assert.equal(aAta.goals, 1);

// Sem clean sheet pra ninguém (2x1)
assert.ok(board.home.every((r) => !r.hasCleanSheet));
assert.ok(board.away.every((r) => !r.hasCleanSheet));

// Craque da partida = capitão artilheiro da casa
assert.equal(board.topScorer?.playerId, 'h-ata');

// Determinismo: mesma entrada → mesmo board (sem crítico aleatório)
const board2 = computeScoutFromEvents({
  events, homeRoster, awayRoster,
  homeCaptainId: 'h-ata', awayCaptainId: 'a-gk',
  homeScore: 2, awayScore: 1,
});
assert.deepEqual(board, board2);

// ── Cenário 2: 1x0 → clean sheet pros defensores da casa ────────────────────
const cleanEvents: MatchEventEntry[] = [ev({ minute: 50, kind: 'goal_home', playerId: 'h-ata' })];
const cleanBoard = computeScoutFromEvents({
  events: cleanEvents,
  homeRoster,
  awayRoster,
  homeScore: 1,
  awayScore: 0,
});
const hGkClean = cleanBoard.home.find((r) => r.playerId === 'h-gk')!;
const hZagClean = cleanBoard.home.find((r) => r.playerId === 'h-zag')!;
assert.equal(hGkClean.hasCleanSheet, true);
assert.equal(hGkClean.points, SCOUT_POINTS.cleanSheet);
assert.equal(hZagClean.points, SCOUT_POINTS.cleanSheet);
// Meio-campista não ganha clean sheet
assert.ok(!cleanBoard.home.find((r) => r.playerId === 'h-mc'));
// Visitante levou 1 gol e não pontuou positivo: GK -1
assert.equal(cleanBoard.away.find((r) => r.playerId === 'a-gk')!.points, SCOUT_POINTS.goalConceded);

// ── Cenário 3: ponte com tally ao vivo (capitão ×2 aplicado) ────────────────
const liveTallies: Record<string, ScoutTally> = {
  'h-ata': {
    playerId: 'h-ata', name: 'ARTILHEIRO', pos: 'ATA',
    totalPoints: 10, events: [], goals: 1, assists: 0,
    difficultSaves: 0, tackles: 0, penaltiesSaved: 0, hasCleanSheet: false,
  },
};
const liveRows = scoutBoardFromLiveTallies(liveTallies, 'h-ata');
assert.equal(liveRows[0]!.points, 10 * SCOUT_CAPTAIN_MULT);
assert.equal(scoutBoardFromLiveTallies(undefined, 'h-ata').length, 0);

console.log('scout self-test OK — régua compartilhada (2 lados + capitão ×2 + clean sheet + determinismo)');
