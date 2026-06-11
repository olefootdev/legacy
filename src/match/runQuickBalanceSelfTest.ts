/**
 * runQuickBalanceSelfTest
 * -----------------------
 * Mede o balance de resultados da Partida Rápida (motor real: runMatchMinute +
 * GameSpirit) em 3 cenários, e garante que "time da casa sempre ganha" não volta:
 *
 *   1. Forças IGUAIS (home ~70 vs opponentStrength 70):
 *      casa pode ter leve vantagem de mando, mas derrota e empate têm que
 *      existir de verdade (doc: quick-match-revolution.md §12, Ponto 2).
 *   2. Casa FORTE (home ~70 vs 55): casa vence com folga (sanidade — o fix
 *      não pode matar a identidade de força).
 *   3. Visitante FORTE (home ~70 vs 88): casa NÃO pode ser maioria de vitórias.
 *
 * Replica a cadeia real do reducer: contextModifiers (homeAdvantage 1.04) +
 * awayRoster sintético resolvido via synthesizeAwayPitchPlayers.
 *
 * npm run test:quick-balance
 */
import assert from 'node:assert/strict';
import type { LiveMatchSnapshot, PitchPlayerState, MatchEventEntry } from '@/engine/types';
import type { PlayerEntity } from '@/entities/types';
import type { MatchPlayerAttributes } from '@/match/playerInMatch';
import { defaultSlotOrder } from '@/formation/layout433';
import { runMatchMinute } from '@/engine/runMatchMinute';
import { computeMatchContextModifiers } from '@/match/contextFactors';

const baseAttrs: MatchPlayerAttributes = {
  passeCurto: 72,
  passeLongo: 68,
  cruzamento: 62,
  marcacao: 70,
  velocidade: 74,
  fairPlay: 68,
  drible: 70,
  finalizacao: 72,
  fisico: 72,
  tatico: 70,
  mentalidade: 70,
  confianca: 70,
};

function makePitchPlayer(slotId: string, i: number): PitchPlayerState {
  const role =
    slotId === 'gol'
      ? 'gk'
      : ['zag1', 'zag2', 'le', 'ld', 'vol'].includes(slotId)
        ? 'def'
        : slotId.startsWith('mc')
          ? 'mid'
          : 'attack';
  return {
    playerId: `home-${slotId}`,
    slotId,
    name: slotId.toUpperCase(),
    num: i + 1,
    pos: slotId,
    x: 50,
    y: 48,
    fatigue: 14,
    role,
    attributes: { ...baseAttrs },
  } as PitchPlayerState;
}

function makePlayerEntity(slotId: string, i: number): PlayerEntity {
  return {
    id: `home-${slotId}`,
    name: slotId.toUpperCase(),
    num: i + 1,
    pos: slotId,
    attrs: { ...baseAttrs },
    fatigue: 14,
    outForMatches: 0,
    nivel: 50,
    moral: 50,
    forma: 50,
  } as unknown as PlayerEntity;
}

function makeLive(): { snapshot: LiveMatchSnapshot; roster: PlayerEntity[]; allPlayers: Record<string, PlayerEntity> } {
  const order = defaultSlotOrder();
  const matchLineupBySlot: Record<string, string> = {};
  const homePlayers: PitchPlayerState[] = order.map((slotId, i) => {
    matchLineupBySlot[slotId] = `home-${slotId}`;
    return makePitchPlayer(slotId, i);
  });
  const roster: PlayerEntity[] = order.map((slotId, i) => makePlayerEntity(slotId, i));
  const allPlayers: Record<string, PlayerEntity> = {};
  for (const p of roster) allPlayers[p.id] = p;

  const awayRoster = [
    { id: 'away-1', num: 1, name: 'GK', pos: 'GOL' },
    { id: 'away-2', num: 2, name: 'LD', pos: 'LD' },
    { id: 'away-3', num: 3, name: 'LE', pos: 'LE' },
    { id: 'away-4', num: 4, name: 'ZAG1', pos: 'ZAG' },
    { id: 'away-5', num: 5, name: 'ZAG2', pos: 'ZAG' },
    { id: 'away-6', num: 6, name: 'VOL', pos: 'VOL' },
    { id: 'away-7', num: 7, name: 'MC1', pos: 'MC' },
    { id: 'away-8', num: 8, name: 'MC2', pos: 'MC' },
    { id: 'away-9', num: 9, name: 'PE', pos: 'PE' },
    { id: 'away-10', num: 10, name: 'PD', pos: 'PD' },
    { id: 'away-11', num: 11, name: 'ATA', pos: 'ATA' },
  ];

  const initialEvent: MatchEventEntry = {
    id: 'init-whistle',
    minute: 0,
    text: "0' — Bola rolando.",
    kind: 'whistle',
  };

  const snapshot: LiveMatchSnapshot = {
    mode: 'quick',
    phase: 'playing',
    minute: 0,
    homeScore: 0,
    awayScore: 0,
    homeShort: 'HOM',
    awayShort: 'AWY',
    possession: 'home',
    ball: { x: 52, y: 48 },
    homeFormationScheme: '4-3-3',
    awayFormationScheme: '4-3-3',
    homePlayers,
    events: [initialEvent],
    homeStats: {},
    matchLineupBySlot,
    substitutionsUsed: 0,
    awaySubstitutionsUsed: 0,
    travelKm: 0,
    engineSimPhase: 'LIVE',
    causalLog: { nextSeq: 1, entries: [] },
    homeImpactLedger: [],
    homeCaptainPlayerId: homePlayers[0]?.playerId,
    footballElapsedSec: 0,
    spiritPhase: 'open_play',
    spiritOverlay: null,
    penalty: null,
    spiritBuildupGkTicksRemaining: 0,
    spiritMomentumClamp01: null,
    preGoalHint: null,
    isCompetitive: false,
    opponentType: 'bot',
    awayRoster,
    awayRosterAtKickoff: awayRoster.map((p) => ({ ...p })),
  } as unknown as LiveMatchSnapshot;

  return { snapshot, roster, allPlayers };
}

interface MatchResult {
  homeScore: number;
  awayScore: number;
  outcome: 'home' | 'draw' | 'away';
  shotsHome: number;
  shotsAway: number;
}

function simulateOne(opponentStrength: number): MatchResult {
  const { snapshot: initial, roster, allPlayers } = makeLive();
  let lm: LiveMatchSnapshot = initial;
  const contextModifiers = computeMatchContextModifiers({ isHome: true });

  const MAX_STEPS = 400;
  let awayPossTicks = 0;
  let awayAttTicks = 0;
  let totalTicks = 0;
  for (let i = 1; i <= MAX_STEPS; i++) {
    if (lm.phase !== 'playing' || lm.minute >= 90) break;
    // Auto-resolve modais (espelha o clock self-test): só queremos o placar.
    if (lm.penalty || lm.activeInteractiveMoment || lm.quickInjurySub) {
      lm = { ...lm, penalty: null, activeInteractiveMoment: null, quickInjurySub: null, spiritOverlay: null };
      continue;
    }
    // Espelha o DISMISS_SPIRIT_OVERLAY da UI (reducer.ts): sem isso a partida
    // congela em 'celebration_goal' após o 1º gol e o placar nunca evolui.
    if (lm.spiritOverlay || lm.spiritPhase === 'celebration_goal') {
      lm = {
        ...lm,
        spiritOverlay: null,
        spiritPhase: lm.spiritPhase === 'celebration_goal' ? 'open_play' : lm.spiritPhase,
        spiritMomentumClamp01: 0.5,
        preGoalHint: null,
      };
    }
    totalTicks++;
    if (lm.possession === 'away') {
      awayPossTicks++;
      if (lm.ball.x <= 34) awayAttTicks++;
    }
    const out = runMatchMinute({
      snapshot: lm,
      homeRoster: roster,
      allPlayers,
      crowdSupport: 50,
      tacticalMentality: 75,
      tacticalStyle: undefined as never,
      opponentStrength,
      awayShort: 'AWY',
      contextModifiers,
    });
    lm = out.snapshot;
  }

  const outcome = lm.homeScore > lm.awayScore ? 'home' : lm.homeScore < lm.awayScore ? 'away' : 'draw';
  const shotsHome = lm.events.filter((e) => e.kind === 'shot_home' || e.kind === 'goal_home').length;
  const shotsAway = lm.events.filter((e) => e.kind === 'shot_away' || e.kind === 'goal_away').length;
  if (process.env.QUICK_BALANCE_DEBUG) {
    console.log(`    poss away ${((awayPossTicks / Math.max(1, totalTicks)) * 100).toFixed(0)}% · att ${((awayAttTicks / Math.max(1, totalTicks)) * 100).toFixed(0)}% · ticks ${totalTicks}`);
  }
  return { homeScore: lm.homeScore, awayScore: lm.awayScore, outcome, shotsHome, shotsAway };
}

interface ScenarioStats {
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  avgHomeGoals: number;
  avgAwayGoals: number;
}

function runScenario(label: string, opponentStrength: number, runs: number): ScenarioStats {
  let home = 0;
  let draw = 0;
  let away = 0;
  let hGoals = 0;
  let aGoals = 0;
  let hShots = 0;
  let aShots = 0;
  for (let r = 0; r < runs; r++) {
    const res = simulateOne(opponentStrength);
    if (res.outcome === 'home') home++;
    else if (res.outcome === 'away') away++;
    else draw++;
    hGoals += res.homeScore;
    aGoals += res.awayScore;
    hShots += res.shotsHome;
    aShots += res.shotsAway;
  }
  const stats: ScenarioStats = {
    homeWinPct: home / runs,
    drawPct: draw / runs,
    awayWinPct: away / runs,
    avgHomeGoals: hGoals / runs,
    avgAwayGoals: aGoals / runs,
  };
  console.log(
    `  ${label}: V ${(stats.homeWinPct * 100).toFixed(0)}% · E ${(stats.drawPct * 100).toFixed(0)}% · D ${(stats.awayWinPct * 100).toFixed(0)}% — gols ${stats.avgHomeGoals.toFixed(2)} x ${stats.avgAwayGoals.toFixed(2)} · finalizações ${(hShots / runs).toFixed(1)} x ${(aShots / runs).toFixed(1)} (${runs} partidas)`,
  );
  return stats;
}

function main() {
  console.log('▶ Quick Match Balance Self-Test\n');
  const RUNS = 120;

  const equal = runScenario('Forças iguais (70 vs 70)', 70, RUNS);
  const strongHome = runScenario('Casa forte    (70 vs 55)', 55, RUNS);
  const strongAway = runScenario('Visita forte  (70 vs 88)', 88, RUNS);

  console.log('');

  // ── Cenário 1: forças iguais — mando ajuda, mas derrota/empate existem ──
  assert.ok(
    equal.homeWinPct <= 0.65,
    `forças iguais: casa venceu ${(equal.homeWinPct * 100).toFixed(0)}% (> 65%) — viés de mando excessivo`,
  );
  assert.ok(
    equal.awayWinPct >= 0.15,
    `forças iguais: visitante venceu só ${(equal.awayWinPct * 100).toFixed(0)}% (< 15%) — derrota da casa quase não existe`,
  );
  assert.ok(
    equal.drawPct >= 0.08,
    `forças iguais: só ${(equal.drawPct * 100).toFixed(0)}% de empates (< 8%)`,
  );
  assert.ok(
    equal.avgAwayGoals >= 0.7,
    `forças iguais: visitante marca só ${equal.avgAwayGoals.toFixed(2)} gols/jogo (< 0.7) — ataque away apagado`,
  );

  // ── Cenário 2: casa forte — identidade de força preservada ──
  assert.ok(
    strongHome.homeWinPct >= 0.55,
    `casa forte: venceu só ${(strongHome.homeWinPct * 100).toFixed(0)}% (< 55%) — força do elenco deixou de pesar`,
  );
  assert.ok(
    strongHome.homeWinPct > equal.homeWinPct,
    `casa forte (${(strongHome.homeWinPct * 100).toFixed(0)}%) deveria vencer mais que em forças iguais (${(equal.homeWinPct * 100).toFixed(0)}%)`,
  );

  // ── Cenário 3: visitante forte — casa não pode ser maioria ──
  assert.ok(
    strongAway.homeWinPct <= 0.45,
    `visitante forte: casa venceu ${(strongAway.homeWinPct * 100).toFixed(0)}% (> 45%) — OVR do adversário não está pesando`,
  );
  assert.ok(
    strongAway.awayWinPct > strongAway.homeWinPct,
    `visitante forte deveria vencer mais que a casa (away ${(strongAway.awayWinPct * 100).toFixed(0)}% vs home ${(strongAway.homeWinPct * 100).toFixed(0)}%)`,
  );

  console.log('▶ quick balance self-test OK');
}

main();
