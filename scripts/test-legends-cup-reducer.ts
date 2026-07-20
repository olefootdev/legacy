/**
 * Self-test do CAMINHO DE VOLTA do Legends Cup.
 *
 * A pergunta que este teste responde: quando o manager termina uma Partida
 * Rápida marcada como sendo do Cup, o resultado VOLTA pra campanha? Sem isso a
 * tela é decorativa — foi exatamente o buraco que existia até aqui.
 *
 * Roda o `gameReducer` de verdade com FINALIZE_QUICK_PLAN, igual à partida real.
 *
 * Uso: npm run test:legends-cup-reducer
 */
import { gameReducer } from '../src/game/reducer';
import type { OlefootGameState, GameAction } from '../src/game/types';
import {
  createLegendsCupState, roundOf, isGroupStage,
  GROUP_MATCHES, MANAGER_TEAM_ID, LEGENDS_CUP_ROUNDS,
  type LegendsCupGroupTeam,
} from '../src/match/legendsCup/legendsCupModel';
import type { PlayerEntity } from '../src/entities/types';

let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
  if (ok) console.log(`  ✅ ${label}`);
  else { failures += 1; console.log(`  ❌ ${label} ${detail}`); }
};

function mkPlayer(id: string, ovr: number): PlayerEntity {
  const a = ovr;
  return {
    id, name: id.toUpperCase(), pos: 'ATA', num: 9,
    attrs: { passe: a, marcacao: a, velocidade: a, drible: a, finalizacao: a, fisico: a, tatico: a, mentalidade: a, confianca: a, fairPlay: a },
    fatigue: 30, injuryRisk: 10, outForMatches: 0, evolutionXp: 0,
  } as unknown as PlayerEntity;
}

const ME: LegendsCupGroupTeam = { id: MANAGER_TEAM_ID, name: 'Ole FC', short: 'OLE', overall: 72, isManager: true };
const RIVALS: LegendsCupGroupTeam[] = [
  { id: 'r1', name: 'Rival Um', short: 'RU1', overall: 70 },
  { id: 'r2', name: 'Rival Dois', short: 'RU2', overall: 68 },
  { id: 'r3', name: 'Rival Três', short: 'RU3', overall: 74 },
];

function baseState(): OlefootGameState {
  return {
    club: { id: 'c1', name: 'Ole FC', shortName: 'OLE' },
    finance: { ole: 1000, broCents: 0, expLifetimeEarned: 0, expHistory: [] },
    players: { p1: mkPlayer('p1', 78), p2: mkPlayer('p2', 74) },
    playerHealth: {},
    quickMatchStreak: { current: 0, best: 0, lastMatchWon: false, multiplier: 1 },
    inbox: [],
    results: [],
    form: [],
    nextFixture: { opponent: { id: 'r1', name: 'Rival Um', shortName: 'RU1', strength: 70 }, awayName: 'Rival Um' },
    legendsCup: createLegendsCupState('seed-reducer', ME, RIVALS, 1),
  } as unknown as OlefootGameState;
}

function finalize(homeScore: number, awayScore: number): GameAction {
  return {
    type: 'FINALIZE_QUICK_PLAN',
    homeScore, awayScore,
    reading: { good: 2, total: 4 },
    homeStats: { p1: { passesOk: 20, passesAttempt: 25, tackles: 2, km: 9, rating: 7.2, shotsOn: 2 } },
    homeOnPitch: ['p1', 'p2'],
    agg: { shots: 8, possessionHome: 55, wasLosing: false },
  } as GameAction;
}

/** Marca a Quick como sendo do Cup — é o que o botão JOGAR faz. */
const arm = (s: OlefootGameState): OlefootGameState =>
  gameReducer(s, { type: 'START_LEGENDS_CUP_MATCH', opponentId: 'legendscup-grupo-r1' } as GameAction);

console.log('\n🔁 LEGENDS CUP — caminho de volta (reducer real)\n');

// ── uma partida do grupo ──
let s = arm(baseState());
check('START_LEGENDS_CUP_MATCH marca a partida como do Cup', s.legendsCup?.pendingOpponentId === 'legendscup-grupo-r1');

const expAntes = s.finance.expLifetimeEarned;
s = gameReducer(s, finalize(3, 1));
check('a rodada do grupo andou', s.legendsCup?.groupRoundsPlayed === 1, `=${s.legendsCup?.groupRoundsPlayed}`);
check('o placar entrou na tabela do manager', s.legendsCup?.standings[MANAGER_TEAM_ID]?.points === 3);
check('gols pró/contra registrados', s.legendsCup?.standings[MANAGER_TEAM_ID]?.goalsFor === 3 && s.legendsCup?.standings[MANAGER_TEAM_ID]?.goalsAgainst === 1);
check('o jogo dos rivais também foi resolvido', (s.legendsCup?.groupFixtures.filter((f) => f.round === 0 && f.scoreHome !== undefined).length ?? 0) === 2);
check('a marca de "partida do Cup" foi limpa', !s.legendsCup?.pendingOpponentId);
// A Quick credita o EXP dela normalmente (algumas centenas). O que NÃO pode
// acontecer é sair prêmio de FASE antes do grupo terminar.
check('fase de grupos não paga prêmio de fase por jogo', s.finance.expLifetimeEarned - expAntes < 1_000_000, `+${s.finance.expLifetimeEarned - expAntes}`);

// ── uma Quick avulsa não pode mexer na campanha ──
const avulsa = gameReducer(s, finalize(5, 0));
check('Quick fora do Cup não altera a campanha', avulsa.legendsCup?.groupRoundsPlayed === 1);

// ── grupo inteiro → classifica e paga ──
let g = arm(baseState());
g = gameReducer(g, finalize(2, 0));
for (let i = 1; i < GROUP_MATCHES; i += 1) g = gameReducer(arm(g), finalize(2, 0));
check('3 rodadas disputadas encerram o grupo', !isGroupStage(g.legendsCup?.roundIndex ?? 0), `round=${g.legendsCup?.roundIndex}`);
check('classificou pro Playoff', roundOf(g.legendsCup?.roundIndex ?? 0) === 'Playoff' && g.legendsCup?.status === 'active');
check('classificar pagou os 2,5M do prêmio', g.finance.expLifetimeEarned >= 2_500_000 && g.finance.expLifetimeEarned < 2_600_000, `=${g.finance.expLifetimeEarned}`);
check('o inbox avisou', g.inbox.some((i) => /Legends Cup|Fase de Grupos/i.test(JSON.stringify(i))));

// ── derrota no mata-mata elimina e limpa a campanha ──
const morto = gameReducer(arm(g), finalize(0, 2));
check('derrota no mata-mata encerra a campanha', morto.legendsCup === undefined);
check('o flash de eliminado aparece uma vez', morto.legendsCupResultFlash?.outcome === 'eliminated');
check('o flash guarda até onde chegou', morto.legendsCupResultFlash?.reachedRound === 'Playoff', `=${morto.legendsCupResultFlash?.reachedRound}`);
check('DISMISS limpa o flash', gameReducer(morto, { type: 'DISMISS_LEGENDS_CUP_RESULT' } as GameAction).legendsCupResultFlash === undefined);

// ── campeão ──
let champ = g;
for (let i = 1; i < LEGENDS_CUP_ROUNDS.length; i += 1) champ = gameReducer(arm(champ), finalize(2, 1));
check('vencer todo o mata-mata dá o título', champ.legendsCupResultFlash?.outcome === 'champion', `flash=${JSON.stringify(champ.legendsCupResultFlash)}`);
check('o título é contabilizado', champ.legendsCupTitles === 1, `=${champ.legendsCupTitles}`);
// 2,5M + 5M + 10M + 20M + 40M + 100M = 177,5M em prêmios de fase, mais o
// crédito normal das 8 partidas (algumas milhares).
check(
  'prêmios das 6 fases somam 177,5M',
  champ.finance.expLifetimeEarned >= 177_500_000 && champ.finance.expLifetimeEarned < 177_600_000,
  `=${champ.finance.expLifetimeEarned}`,
);

// ── empate no tempo normal decidido nos pênaltis ──
let pk = arm(baseState());
pk = gameReducer(pk, { ...finalize(1, 1), shootoutWin: 'home' } as GameAction);
check('empate + pênaltis pra casa conta como vitória', pk.legendsCup?.standings[MANAGER_TEAM_ID]?.points === 1 && pk.legendsCup?.groupRoundsPlayed === 1);

console.log(`\n${failures === 0 ? '✅' : '❌'} ${failures} falharam\n`);
process.exit(failures === 0 ? 0 : 1);
