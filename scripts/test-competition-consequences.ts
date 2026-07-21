/**
 * Self-test das CONSEQUÊNCIAS DE COMPETIÇÃO no motor Quick.
 *
 * A pergunta que este teste responde: partida OFICIAL (Liga Ole / Legends Cup)
 * jogada pelo pipeline Quick consome contrato, gera cartão/suspensão e lesão?
 * E o amistoso Quick continua SEM consequências?
 *
 * Roda o `gameReducer` real com FINALIZE_QUICK_PLAN + o produtor determinístico
 * `quickPlanToConsequenceEvents` isolado (seed fixo → mesmo resultado).
 *
 * Uso: npm run test:competition-consequences
 */
import { gameReducer } from '../src/game/reducer';
import type { OlefootGameState, GameAction } from '../src/game/types';
import {
  createLegendsCupState, MANAGER_TEAM_ID,
  type LegendsCupGroupTeam,
} from '../src/match/legendsCup/legendsCupModel';
import { quickPlanToConsequenceEvents } from '../src/systems/playerHealth/fromQuickPlan';
import { applyMatchConsequences, emptyHealth } from '../src/systems/playerHealth/reducer';
import type { PlayerEntity } from '../src/entities/types';

let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
  if (ok) console.log(`  ✅ ${label}`);
  else { failures += 1; console.log(`  ❌ ${label} ${detail}`); }
};

function mkPlayer(id: string, ovr: number, contractGames: number | null): PlayerEntity {
  const a = ovr;
  return {
    id, name: id.toUpperCase(), pos: 'ATA', num: 9,
    attrs: { passe: a, marcacao: a, velocidade: a, drible: a, finalizacao: a, fisico: a, tatico: a, mentalidade: a, confianca: a, fairPlay: a },
    fatigue: 30, injuryRisk: 10, outForMatches: 0, evolutionXp: 0,
    ...(contractGames != null
      ? { contractMatchesRemaining: contractGames, contractMatchesIncluded: 50, contractIsLifetime: false, contractExpired: false }
      : {}),
  } as unknown as PlayerEntity;
}

const ME: LegendsCupGroupTeam = { id: MANAGER_TEAM_ID, name: 'Ole FC', short: 'OLE', overall: 72, isManager: true };
const RIVALS: LegendsCupGroupTeam[] = [
  { id: 'r1', name: 'Rival Um', short: 'RU1', overall: 70 },
  { id: 'r2', name: 'Rival Dois', short: 'RU2', overall: 68 },
  { id: 'r3', name: 'Rival Três', short: 'RU3', overall: 74 },
];

function baseState(withCup: boolean): OlefootGameState {
  return {
    club: { id: 'c1', name: 'Ole FC', shortName: 'OLE' },
    finance: { ole: 1000, broCents: 0, expLifetimeEarned: 0, expHistory: [] },
    players: {
      p1: mkPlayer('p1', 78, 2),
      p2: mkPlayer('p2', 74, 1),
      p3: mkPlayer('p3', 70, null), // sem contrato definido — não decrementa
    },
    playerHealth: {},
    quickMatchStreak: { current: 0, best: 0, lastMatchWon: false, multiplier: 1 },
    inbox: [],
    results: [],
    form: [],
    nextFixture: { opponent: { id: 'r1', name: 'Rival Um', shortName: 'RU1', strength: 70 }, awayName: 'Rival Um' },
    ...(withCup ? { legendsCup: createLegendsCupState('seed-cons', ME, RIVALS, 1) } : {}),
  } as unknown as OlefootGameState;
}

function finalize(): GameAction {
  return {
    type: 'FINALIZE_QUICK_PLAN',
    homeScore: 2, awayScore: 1,
    reading: { good: 2, total: 4 },
    homeStats: {
      p1: { passesOk: 20, passesAttempt: 25, tackles: 2, km: 9, rating: 7.2, shotsOn: 2 },
      p2: { passesOk: 10, passesAttempt: 14, tackles: 5, km: 10, rating: 6.8 },
    },
    homeOnPitch: ['p1', 'p2'],
    agg: { shots: 8, possessionHome: 55, wasLosing: false },
  } as GameAction;
}

const armCup = (s: OlefootGameState): OlefootGameState =>
  gameReducer(s, { type: 'START_LEGENDS_CUP_MATCH', opponentId: 'legendscup-grupo-r1' } as GameAction);

console.log('\n⚖️  CONSEQUÊNCIAS DE COMPETIÇÃO — Quick oficial vs amistoso\n');

// ── 1) Partida OFICIAL (Legends Cup): contrato decrementa ──
{
  let s = armCup(baseState(true));
  s = gameReducer(s, finalize());
  check('contrato de quem jogou decrementa (p1: 2→1)', s.players.p1?.contractMatchesRemaining === 1,
    `got ${s.players.p1?.contractMatchesRemaining}`);
  check('contrato que chega a 0 marca contractExpired (p2: 1→0)',
    s.players.p2?.contractMatchesRemaining === 0 && s.players.p2?.contractExpired === true,
    `rem=${s.players.p2?.contractMatchesRemaining} expired=${s.players.p2?.contractExpired}`);
  check('jogador sem contrato definido não é tocado (p3)', s.players.p3?.contractMatchesRemaining == null);
  check('inbox avisa contrato expirado',
    s.inbox.some((i) => /contrato/i.test(i.title ?? '') && /expirou/i.test(i.title ?? '')));
}

// ── 2) Amistoso Quick (sem competição armada): NADA de consequência ──
{
  let s = baseState(false);
  s = gameReducer(s, finalize());
  check('amistoso NÃO decrementa contrato (p1 segue 2)', s.players.p1?.contractMatchesRemaining === 2,
    `got ${s.players.p1?.contractMatchesRemaining}`);
  check('amistoso NÃO gera suspensão', Object.values(s.playerHealth).every((h) => h.suspendedMatches === 0));
}

// ── 3) Produtor determinístico: mesmo seed → mesmos eventos ──
{
  const homeStats = {
    p1: { tackles: 2, km: 9, rating: 7.2 },
    p2: { tackles: 5, km: 10, rating: 6.8 },
  };
  const health = { p1: emptyHealth('p1'), p2: { ...emptyHealth('p2'), injuryRisk: 60, fatigue: 85 } };
  const mk = (seed: number) => quickPlanToConsequenceEvents({
    matchId: 'm1', leagueId: 'legends-cup', homeStats, playerHealth: health, seed, shots: 8, now: 1000,
  });
  const a = mk(42);
  const b = mk(42);
  check('mesmo seed → eventos idênticos', JSON.stringify(a) === JSON.stringify(b));

  // Frequências em 2000 partidas simuladas de 11 jogadores (3 desarmes médios):
  const stats11 = Object.fromEntries(
    Array.from({ length: 11 }, (_, i) => [`j${i}`, { tackles: 3, km: 9, rating: 6.9 }]),
  );
  const health11 = Object.fromEntries(
    Array.from({ length: 11 }, (_, i) => [`j${i}`, { ...emptyHealth(`j${i}`), injuryRisk: 25, fatigue: 50 }]),
  );
  let yellows = 0; let reds = 0; let injuries = 0;
  const N = 2000;
  for (let seed = 1; seed <= N; seed++) {
    for (const ev of quickPlanToConsequenceEvents({
      matchId: 'mm', leagueId: 'liga-ole', homeStats: stats11, playerHealth: health11, seed, shots: 10, now: 1000,
    })) {
      if (ev.type === 'yellow_card') yellows++;
      else if (ev.type === 'red_card') reds++;
      else if (ev.type === 'injury') injuries++;
    }
  }
  const yPerMatch = yellows / N;
  const rPerMatch = reds / N;
  const iPerMatch = injuries / N;
  check(`amarelos/partida realista (1.0–2.4): ${yPerMatch.toFixed(2)}`, yPerMatch >= 1.0 && yPerMatch <= 2.4);
  check(`vermelhos/partida raro (0.1–0.4): ${rPerMatch.toFixed(2)}`, rPerMatch >= 0.1 && rPerMatch <= 0.4);
  check(`lesões/partida contida (0.2–0.9): ${iPerMatch.toFixed(2)}`, iPerMatch >= 0.2 && iPerMatch <= 0.9);
}

// ── 4) Suspensão de verdade: 3 amarelos na MESMA competição suspendem ──
{
  const homeStats = { p9: { tackles: 3, km: 9, rating: 6.5 } };
  // acha um seed que gera amarelo pro p9
  const yellowSeed = (() => {
    for (let seed = 1; seed < 5000; seed++) {
      const evs = quickPlanToConsequenceEvents({
        matchId: 'm', leagueId: 'liga-ole', homeStats, playerHealth: { p9: emptyHealth('p9') }, seed, shots: 8, now: 1,
      });
      if (evs.some((e) => e.type === 'yellow_card')) return seed;
    }
    return -1;
  })();
  check('existe seed que produz amarelo', yellowSeed > 0);
  if (yellowSeed > 0) {
    // aplica 3 amarelos via reducer de saúde real (mesma liga) — 3º suspende
    const ev = quickPlanToConsequenceEvents({
      matchId: 'm', leagueId: 'liga-ole', homeStats, playerHealth: { p9: emptyHealth('p9') }, seed: yellowSeed, shots: 8, now: 1,
    }).filter((e) => e.type === 'yellow_card');
    let h: Record<string, import('../src/systems/playerHealth/types').PlayerHealth> = { p9: emptyHealth('p9') };
    for (let i = 0; i < 3; i++) h = applyMatchConsequences(h, ev).next;
    check('3º amarelo na mesma liga suspende 1 jogo', h.p9!.suspendedMatches === 1, `got ${h.p9!.suspendedMatches}`);
    check('contador de amarelos zera após suspensão', (h.p9!.yellowCardsByLeague['liga-ole'] ?? 0) === 0);
  }
}

console.log(failures === 0 ? '\n✅ CONSEQUÊNCIAS DE COMPETIÇÃO — tudo passou\n' : `\n❌ ${failures} falha(s)\n`);
if (failures > 0) process.exit(1);
