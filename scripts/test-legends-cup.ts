/** Self-test do LEGENDS CUP: fase de grupos, mata-mata, prêmios e treinador.
 *  Roda: npm run test:legends-cup */
import {
  createLegendsCupState, applyMatchResult, roundOf, isFinalRound, isGroupStage,
  currentGroupOpponent, managerGroupPosition, sortStandings, goalDiff,
  buildGroupFixtures, applyToStandings, emptyStanding, simGroupMatch, rngFor,
  legendsCupPhaseExp, expMultiplier, EXP_MULTIPLIER_CAP,
  LEGENDS_CUP_ROUNDS, LEGENDS_CUP_SQUADS, LEGENDS_CUP_PHASE_EXP,
  GROUP_MATCHES, GROUP_SIZE, GROUP_QUALIFIERS, MANAGER_TEAM_ID,
  type LegendsCupGroupTeam, type LegendsCupState,
} from '../src/match/legendsCup/legendsCupModel';
import { aggressionFromSquad, coachTicks, canSub, MAX_BOT_SUBS } from '../src/match/legendsCup/legendsCupCoach';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => {
  if (c) { pass++; console.log(`  ✅ ${n}`); } else { fail++; console.log(`  ❌ ${n} ${d}`); }
};

const ME: LegendsCupGroupTeam = { id: MANAGER_TEAM_ID, name: 'Ole FC', short: 'OLE', overall: 72, isManager: true };
const RIVALS: LegendsCupGroupTeam[] = [
  { id: 'r1', name: 'Rival Um', short: 'RU1', overall: 70 },
  { id: 'r2', name: 'Rival Dois', short: 'RU2', overall: 68 },
  { id: 'r3', name: 'Rival Três', short: 'RU3', overall: 74 },
];
const novo = (seed: string, run = 1) => createLegendsCupState(seed, ME, RIVALS, run);
/** Joga as 3 rodadas do grupo com o mesmo placar. */
const jogarGrupo = (s: LegendsCupState, gf: number, ga: number) => {
  for (let i = 0; i < GROUP_MATCHES; i += 1) s = applyMatchResult(s, gf > ga, gf, ga);
  return s;
};

console.log('\n🏆 LEGENDS CUP — estrutura\n');

// ── fase de grupos ──
console.log('  fase de grupos:');
let s = novo('seed-1');
check('campanha começa na Fase de Grupos', roundOf(s.roundIndex) === 'Fase de Grupos' && isGroupStage(s.roundIndex));
check(`grupo tem ${GROUP_SIZE} times`, s.groupTeams.length === GROUP_SIZE);
check('o manager está no grupo', s.groupTeams.some((t) => t.isManager && t.id === MANAGER_TEAM_ID));
check(`tabela de turno único = ${GROUP_SIZE * GROUP_MATCHES / 2} jogos`, s.groupFixtures.length === (GROUP_SIZE * GROUP_MATCHES) / 2);
check(`o manager joga ${GROUP_MATCHES} vezes`, s.groupFixtures.filter((f) => f.isManager).length === GROUP_MATCHES);
check('cada time joga 1× por rodada', [0, 1, 2].every((r) => {
  const ids = s.groupFixtures.filter((f) => f.round === r).flatMap((f) => [f.homeId, f.awayId]);
  return new Set(ids).size === GROUP_SIZE;
}));
check('todos enfrentam todos exatamente 1×', (() => {
  const pares = s.groupFixtures.map((f) => [f.homeId, f.awayId].sort().join('|'));
  return new Set(pares).size === pares.length && pares.length === 6;
})());
check('adversário da 1ª rodada existe', !!currentGroupOpponent(s));

// vencendo tudo, classifica
let venc = jogarGrupo(novo('seed-2'), 3, 0);
check('3 vitórias classificam pro Playoff', roundOf(venc.roundIndex) === 'Playoff' && venc.status === 'active');
check('tabela registrou os 3 jogos do manager', venc.standings[MANAGER_TEAM_ID]!.played === GROUP_MATCHES);
check('9 pontos com 3 vitórias', venc.standings[MANAGER_TEAM_ID]!.points === 9);
check('saldo de gols +9', goalDiff(venc.standings[MANAGER_TEAM_ID]!) === 9);

// perdendo tudo, elimina
const perd = jogarGrupo(novo('seed-3'), 0, 3);
check('3 derrotas eliminam no grupo', perd.status === 'eliminated');
check('0 pontos com 3 derrotas', perd.standings[MANAGER_TEAM_ID]!.points === 0);

// derrota no grupo NÃO elimina na hora (diferente do mata-mata)
let umaDerrota = applyMatchResult(novo('seed-4'), false, 0, 2);
check('derrota na 1ª rodada NÃO elimina (quem decide é a tabela)', umaDerrota.status === 'active' && isGroupStage(umaDerrota.roundIndex));
umaDerrota = applyMatchResult(umaDerrota, true, 3, 0);
umaDerrota = applyMatchResult(umaDerrota, true, 3, 0);
check('perder a 1ª e vencer as 2 seguintes ainda classifica', roundOf(umaDerrota.roundIndex) === 'Playoff', `pos=${managerGroupPosition(umaDerrota)}`);

// os OUTROS jogos do grupo também são resolvidos
const rodada1 = applyMatchResult(novo('seed-5'), true, 2, 1);
check('o jogo dos rivais também é simulado', rodada1.groupFixtures.filter((f) => f.round === 0 && f.scoreHome !== undefined).length === 2);
check('a tabela toda anda, não só o manager', Object.values(rodada1.standings).filter((r) => r.played > 0).length === GROUP_SIZE);
check('empate dá 1 ponto pra cada', (() => {
  const emp = applyMatchResult(novo('seed-6'), false, 1, 1);
  const me = emp.standings[MANAGER_TEAM_ID]!;
  return me.points === 1 && me.draws === 1;
})());

// determinismo: mesma seed, mesma tabela
check('mesma seed → mesmos resultados (sem reroll)', (() => {
  const a = jogarGrupo(novo('seed-fixa'), 2, 1);
  const b = jogarGrupo(novo('seed-fixa'), 2, 1);
  return JSON.stringify(a.standings) === JSON.stringify(b.standings);
})());
check('seeds diferentes → tabelas diferentes', (() => {
  const a = jogarGrupo(novo('seed-A'), 2, 1);
  const b = jogarGrupo(novo('seed-B'), 2, 1);
  return JSON.stringify(a.standings) !== JSON.stringify(b.standings);
})());

// classificação
check('classificação ordena por pontos → saldo → gols pró', (() => {
  const rows = [
    { ...emptyStanding('a'), points: 3, goalsFor: 1, goalsAgainst: 0 },
    { ...emptyStanding('b'), points: 9, goalsFor: 5, goalsAgainst: 1 },
    { ...emptyStanding('c'), points: 3, goalsFor: 4, goalsAgainst: 0 },
  ];
  return sortStandings(rows).map((r) => r.teamId).join('') === 'bca';
})());
check(`só os ${GROUP_QUALIFIERS} primeiros passam`, (() => {
  // manager empata os 3 jogos (3 pts) — depende da tabela, mas o estado tem que ser coerente
  const emp = jogarGrupo(novo('seed-emp'), 1, 1);
  const pos = managerGroupPosition(emp);
  const passou = emp.status === 'active' && !isGroupStage(emp.roundIndex);
  return passou === (pos <= GROUP_QUALIFIERS);
})(), 'posição x classificação inconsistentes');

check('applyToStandings: vitória 3, derrota 0', (() => {
  const t = applyToStandings({ x: emptyStanding('x'), y: emptyStanding('y') }, 'x', 'y', 2, 0);
  return t.x!.points === 3 && t.x!.wins === 1 && t.y!.points === 0 && t.y!.losses === 1;
})());
check('buildGroupFixtures com time faltando devolve vazio', buildGroupFixtures(['a', 'b']).length === 0);
check('simGroupMatch nunca devolve gol negativo', (() => {
  const rnd = rngFor('sim');
  for (let i = 0; i < 200; i += 1) {
    const r = simGroupMatch(rnd, 40 + i % 50, 90 - i % 50);
    if (r.scoreHome < 0 || r.scoreAway < 0) return false;
  }
  return true;
})());

// ── mata-mata ──
console.log('\n  mata-mata:');
let k = jogarGrupo(novo('seed-k'), 3, 0);
const antes = k.roundIndex;
k = applyMatchResult(k, false, 0, 1);
check('derrota no mata-mata elimina na hora', k.status === 'eliminated' && k.roundIndex === antes);

let champ = jogarGrupo(novo('seed-c'), 3, 0);
for (let i = 0; i < LEGENDS_CUP_ROUNDS.length - 1; i++) champ = applyMatchResult(champ, true, 2, 0);
check('vencer todas torna CAMPEÃO', champ.status === 'champion', `status=${champ.status} round=${champ.roundIndex}`);
check('campeão fica registrado na Final', champ.reachedRound === 'Final');
check('campanha encerrada ignora novos resultados', applyMatchResult(champ, false).status === 'champion');

// ── elencos ──
console.log('\n  elencos por fase:');
for (const r of LEGENDS_CUP_ROUNDS) {
  const sq = LEGENDS_CUP_SQUADS[r];
  console.log(`    ${r.padEnd(16)} ${sq ? sq.length + ' lendas' : 'managers reais'}`);
}
const cresce = LEGENDS_CUP_ROUNDS.slice(1).map((r) => LEGENDS_CUP_SQUADS[r]!.length);
check('nº de lendas nunca diminui de fase pra fase', cresce.every((n, i) => i === 0 || n >= cresce[i - 1]!), cresce.join('→'));
check('Final tem o maior elenco', LEGENDS_CUP_SQUADS['Final']!.length === Math.max(...cresce));
check('Final inclui o Palhinha', LEGENDS_CUP_SQUADS['Final']!.includes('mem-palhinha-2026'));
check('Fase de Grupos não tem lenda', LEGENDS_CUP_SQUADS['Fase de Grupos'] === null);
check('isFinalRound só na última', isFinalRound(LEGENDS_CUP_ROUNDS.length - 1) && !isFinalRound(0));

// ── prêmios ──
console.log('\n  prêmios:');
check('há prêmio pra cada uma das 6 fases', LEGENDS_CUP_PHASE_EXP.length === LEGENDS_CUP_ROUNDS.length);
check('prêmio cresce a cada fase', LEGENDS_CUP_PHASE_EXP.every((v, i) => i === 0 || v > LEGENDS_CUP_PHASE_EXP[i - 1]!));
check('multiplicador dobra por título', expMultiplier(1) === 1 && expMultiplier(2) === 2 && expMultiplier(3) === 4);
check(`multiplicador tem teto ${EXP_MULTIPLIER_CAP}×`, expMultiplier(9) === EXP_MULTIPLIER_CAP);
check('título paga 100M na 1ª campanha', legendsCupPhaseExp(LEGENDS_CUP_ROUNDS.length - 1, 1) === 100_000_000);
check('índice fora da faixa não quebra o prêmio', legendsCupPhaseExp(99, 1) > 0 && legendsCupPhaseExp(-5, 1) > 0);

// ── treinador máquina ──
console.log('\n  treinador máquina:');
const ticks = coachTicks(90);
check(`reavalia ${ticks.length}× por partida`, ticks.length >= 4);
check(`limite de ${MAX_BOT_SUBS} substituições respeitado`, canSub(0) && canSub(1) && !canSub(2));

const conservador = [{ agentProfile: { riskProfile: { baseRisk: 40 } } }] as never[];
const ousado = [{ agentProfile: { riskProfile: { baseRisk: 76 } } }] as never[];
const semPerfil = [{}] as never[];
check('elenco conservador → agressividade negativa', aggressionFromSquad(conservador) < 0);
check('elenco ousado → agressividade positiva', aggressionFromSquad(ousado) > 0);
check('elenco sem agentProfile → neutro', aggressionFromSquad(semPerfil) === 0);

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);
