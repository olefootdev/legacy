/**
 * Self-test da QUARTA DIVISÃO.
 *
 * POR QUE ELE EXISTE: a mudança de 3 pra 4 divisões mexe numa liga com 75
 * clubes ativos. O `test:global-league` cobre o CICLO (rodada, eventos, lock),
 * não a topologia — passaria igual com a constante em 3, em 4 ou em 40.
 *
 * O que este arquivo prova, sem tocar no banco:
 *   1. a distribuição usa a constante e não perde ninguém;
 *   2. a divisão de entrada é a ÚLTIMA — o erro que faria a Várzea nascer vazia;
 *   3. promoção e rebaixamento atravessam as quatro, sem vazar pelas pontas.
 *
 * Rodar: npm run test:quatro-divisoes
 */
import {
  GLOBAL_LEAGUE_MVP_CONSTANTS as C,
  applyPromotionRelegation,
  createGlobalTeam,
  distributeIntoDivisions,
  globalDivisionName,
  registerTeam,
  type GlobalLeagueMVPState,
  type GlobalTeam,
} from '../src/match/globalLeagueMVP';

let falhas = 0;

function ok(condicao: boolean, titulo: string, detalhe?: string) {
  if (condicao) {
    console.log(`  PASS  ${titulo}`);
  } else {
    falhas++;
    console.log(`  FAIL  ${titulo}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}

/** 75 clubes, que é o tamanho real da liga hoje. */
function times(n: number): GlobalTeam[] {
  return Array.from({ length: n }, (_, i) =>
    createGlobalTeam(`m${i}`, `Clube ${i}`, `C${i}`, 60 + (i % 30)),
  );
}

console.log('\n=== 1. A constante manda ===');
ok(C.DIVISIONS === 4, `constante em 4 (está em ${C.DIVISIONS})`);

console.log('\n=== 2. Distribuição não perde ninguém ===');
const distribuidos = distributeIntoDivisions(times(75));
const porDivisao = new Map<number, number>();
for (const t of distribuidos) porDivisao.set(t.division!, (porDivisao.get(t.division!) ?? 0) + 1);

ok(distribuidos.length === 75, `75 entram, 75 saem (saíram ${distribuidos.length})`);
ok(porDivisao.size === C.DIVISIONS, `${C.DIVISIONS} divisões ocupadas (foram ${porDivisao.size})`);
ok(
  [...porDivisao.keys()].every((d) => d >= 1 && d <= C.DIVISIONS),
  'nenhuma divisão fora de 1..4',
  [...porDivisao.keys()].join(','),
);
ok(
  [...porDivisao.values()].every((n) => n > 0),
  'nenhuma divisão vazia',
);
console.log(
  '  INFO  ' +
    [...porDivisao.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([d, n]) => `${globalDivisionName(d)}: ${n}`)
      .join(' · '),
);

console.log('\n=== 3. Clube novo entra pela ÚLTIMA divisão ===');
// O bug que esta asserção existe pra pegar: com o `3` cravado, a liga vira 4
// divisões e todo mundo continua nascendo na Acesso — a Várzea nasce vazia.
let liga: GlobalLeagueMVPState = {
  id: 'teste',
  status: 'active',
  teams: [],
  minTeamsRequired: C.MIN_TEAMS,
  playoffRounds: [],
  leagueRounds: [],
  teamsPerDivision: 11,
  promotionPercentage: C.PROMOTION_PERCENTAGE,
  relegationPercentage: C.RELEGATION_PERCENTAGE,
  currentRound: 0,
  season: 'teste',
  lastUpdated: Date.now(),
} as unknown as GlobalLeagueMVPState;

liga = registerTeam(liga, 'novato', 'Novato FC', 'NOV', 62);
const novato = liga.teams[0];
ok(
  novato?.division === C.DIVISIONS,
  `entra na divisão ${C.DIVISIONS} (${globalDivisionName(C.DIVISIONS)})`,
  `entrou na ${novato?.division}`,
);

console.log('\n=== 4. Promoção e rebaixamento nas quatro ===');
const comPontos = distribuidos.map((t, i) => ({
  ...t,
  points: 100 - i, // ordem determinística dentro de cada divisão
  wins: 0,
  goalDifference: 0,
  goalsFor: 0,
}));
const depois = applyPromotionRelegation({
  ...liga,
  teams: comPontos,
} as GlobalLeagueMVPState);

const divsDepois = new Set(depois.teams.map((t) => t.division));
ok(depois.teams.length === 75, `ninguém sumiu (${depois.teams.length})`);
ok(
  [...divsDepois].every((d) => d! >= 1 && d! <= C.DIVISIONS),
  'ninguém vazou pelas pontas (divisão 0 ou 5)',
  [...divsDepois].join(','),
);

const subiu = depois.teams.filter((t) => {
  const antes = comPontos.find((x) => x.id === t.id);
  return antes && t.division! < antes.division!;
}).length;
const desceu = depois.teams.filter((t) => {
  const antes = comPontos.find((x) => x.id === t.id);
  return antes && t.division! > antes.division!;
}).length;
ok(subiu > 0 && desceu > 0, `houve movimento (${subiu} subiram, ${desceu} desceram)`);

console.log('\n=== 5. O nome da quarta ===');
ok(globalDivisionName(4) === 'Várzea', `divisão 4 = Várzea (é "${globalDivisionName(4)}")`);
ok(globalDivisionName(9) === 'Divisão 9', 'divisão desconhecida cai em "Divisão N"');

console.log(
  falhas === 0
    ? '\nPASSOU — quatro divisões consistentes.\n'
    : `\nFALHOU — ${falhas} problema(s).\n`,
);
process.exit(falhas === 0 ? 0 : 1);
