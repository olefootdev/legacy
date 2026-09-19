/**
 * Self-test da tabela da divisão da Home (A VIRADA · V4).
 *
 * Garante que a "zona de acesso" da Home é a MESMA de quem sobe de verdade
 * (applyPromotionRelegation): ordem por pontos > vitórias > saldo > gols pró, e
 * ceil(n × 10%) primeiros sobem, exceto na Elite.
 * Roda: npm run test:division-standings
 */
import { buildDivisionView, sortStandings, type StandingsTeam } from './divisionStandings.js';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${detail}`); }
}

function team(id: string, points: number, division: number, extra: Partial<StandingsTeam> = {}): StandingsTeam {
  return { id, managerId: `${id}@x.com`, clubName: id.toUpperCase(), division, points, wins: 0, goalDifference: 0, goalsFor: 0, ...extra };
}

console.log('\n🏆 divisionStandings — a zona de acesso da Home é a real\n');

// 19 clubes na divisão 3 → ceil(1,9) = 2 sobem
const div3 = Array.from({ length: 19 }, (_, i) => team(`t${i + 1}`, 60 - i * 2, 3));
const others = [team('elite1', 99, 1), team('vz1', 80, 4)];

const v = buildDivisionView({ teams: [...div3, ...others], managerId: 't5@x.com', myClubId: 'nada', promotionPercentage: 0.1 })!;
check('acha a divisão do manager', v.division === 3 && v.size === 19);
check('sobem ceil(19 × 10%) = 2', v.promotionCount === 2, `veio ${v.promotionCount}`);
check('manager em 5º', v.me.pos === 5 && v.me.isMe);
check('janela de 5 em volta dele (3º a 7º)', v.window.map((r) => r.pos).join(',') === '3,4,5,6,7', v.window.map((r) => r.pos).join(','));
check('linha da zona fora da janela quando o corte (2º|3º) não aparece', v.zoneAfterPos === null);
check('faltam 6 pontos (58 do 2º − 52 dele)', v.pointsToZone === 6 && v.zoneTargetPoints === 58, `veio ${v.pointsToZone}/${v.zoneTargetPoints}`);

const v2 = buildDivisionView({ teams: div3, managerId: 't3@x.com', myClubId: 'nada', promotionPercentage: 0.1 })!;
check('com o manager em 3º, a linha entra depois do 2º', v2.zoneAfterPos === 2, `veio ${v2.zoneAfterPos}`);
check('janela no topo não passa de 1º', v2.window[0]!.pos === 1 && v2.window.length === 5);

const v3 = buildDivisionView({ teams: div3, managerId: 't1@x.com', myClubId: 'nada', promotionPercentage: 0.1 })!;
check('dentro da zona: pointsToZone = null', v3.pointsToZone === null);

const vElite = buildDivisionView({ teams: others, managerId: 'elite1@x.com', myClubId: 'nada', promotionPercentage: 0.1 })!;
check('Elite não tem zona de acesso', vElite.promotionCount === 0 && vElite.zoneAfterPos === null && vElite.pointsToZone === null);

// desempate: mesmos pontos, mais vitórias na frente
const tie = sortStandings([team('a', 10, 3, { wins: 2 }), team('b', 10, 3, { wins: 3 })]);
check('empate em pontos: mais vitórias primeiro', tie[0]!.id === 'b');
const tie2 = sortStandings([team('a', 10, 3, { wins: 3, goalDifference: 1 }), team('b', 10, 3, { wins: 3, goalDifference: 4 })]);
check('empate em vitórias: saldo decide', tie2[0]!.id === 'b');

check('manager sem divisão → null', buildDivisionView({ teams: [team('x', 1, 3, { division: undefined })], managerId: 'x@x.com', myClubId: '', promotionPercentage: 0.1 }) === null);
check('identidade pelo id do clube também funciona', buildDivisionView({ teams: div3, managerId: null, myClubId: 't7', promotionPercentage: 0.1 })?.me.pos === 7);

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);
