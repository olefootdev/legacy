/**
 * test-penalty-shootout.ts — valida o modelo de disputa de pênaltis.
 *
 * Roda: npm run test:penalty-shootout
 *
 * Garante: nunca empata · melhor batedor converte mais · goleiro especialista
 * defende mais · fadiga derruba · morte súbita resolve · determinístico.
 */

import {
  simulateShootout,
  resolveKick,
  kickerRating,
  keeperPenaltyRating,
  goalProbability,
  rankKickers,
  type ShootoutKicker,
  type ShootoutKeeper,
} from '../src/match/quickEngaged/penaltyShootout';

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) console.log(`  ✓ ${label}`);
  else { failures += 1; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
}

function kicker(id: string, fin: number, fis: number, con: number, fat = 0): ShootoutKicker {
  return { id, name: id, pos: 'ATA', finalizacao: fin, fisico: fis, confianca: con, fatigue: fat };
}
function keeper(id: string, mar: number, con = 60, fis = 65, fat = 0): ShootoutKeeper {
  return { id, name: id, marcacao: mar, confianca: con, fisico: fis, fatigue: fat };
}

/** Ordem completa de 11 batedores genéricos com um OVR central. */
function order(prefix: string, center: number): ShootoutKicker[] {
  return Array.from({ length: 11 }, (_, i) =>
    kicker(`${prefix}${i}`, center + (i % 3) - 1, center + (i % 2), center - (i % 4)));
}

function main() {
  console.log('— Disputa de Pênaltis: modelo —\n');

  // [1] Determinismo
  console.log('[1] Determinismo');
  const A = simulateShootout({
    homeOrder: order('h', 72), awayOrder: order('a', 72),
    homeKeeper: keeper('gkh', 70), awayKeeper: keeper('gka', 70), seed: 'det-1',
  });
  const B = simulateShootout({
    homeOrder: order('h', 72), awayOrder: order('a', 72),
    homeKeeper: keeper('gkh', 70), awayKeeper: keeper('gka', 70), seed: 'det-1',
  });
  check('mesma seed → resultado idêntico',
    JSON.stringify(A) === JSON.stringify(B));

  // [2] Nunca empata (1000 seeds)
  console.log('\n[2] Nenhum jogo empata');
  let homeWins = 0, awayWins = 0, bad = 0;
  for (let i = 0; i < 1000; i += 1) {
    const r = simulateShootout({
      homeOrder: order('h', 70), awayOrder: order('a', 70),
      homeKeeper: keeper('gkh', 68), awayKeeper: keeper('gka', 68), seed: `draw-${i}`,
    });
    if (r.winner !== 'home' && r.winner !== 'away') bad += 1;
    if (r.homeTally === r.awayTally) bad += 1;
    if (r.winner === 'home') homeWins += 1; else awayWins += 1;
  }
  check('1000 disputas, 0 empates e sempre há vencedor', bad === 0, `${bad} ruins`);
  check('times iguais → equilíbrio ~50/50', Math.abs(homeWins - awayWins) < 140,
    `home ${homeWins} × ${awayWins} away`);

  // [3] Melhor batedor converte mais
  console.log('\n[3] Técnica × físico importam');
  const elite = kicker('elite', 92, 85, 88);
  const fraco = kicker('fraco', 50, 48, 45);
  const gk = keeper('gk', 65);
  let eliteGoals = 0, fracoGoals = 0;
  for (let i = 0; i < 2000; i += 1) {
    if (resolveKick(elite, gk, `t3-${i}`, 'home', 1).scored) eliteGoals += 1;
    if (resolveKick(fraco, gk, `t3-${i}`, 'home', 1).scored) fracoGoals += 1;
  }
  check('batedor elite converte mais que o fraco', eliteGoals > fracoGoals,
    `${(eliteGoals / 2000 * 100).toFixed(0)}% vs ${(fracoGoals / 2000 * 100).toFixed(0)}%`);
  check('rating reflete técnica+físico', kickerRating(elite) > kickerRating(fraco));
  console.log(`     elite ${(eliteGoals / 20).toFixed(0)}% · fraco ${(fracoGoals / 20).toFixed(0)}%`);

  // [4] Goleiro especialista defende mais
  console.log('\n[4] Goleiro: atributos + especialista');
  const muralha = keeper('muralha', 90, 85, 80);
  const peneira = keeper('peneira', 48, 45, 55);
  const shooter = kicker('s', 72, 70, 70);
  let vsMuralha = 0, vsPeneira = 0;
  for (let i = 0; i < 2000; i += 1) {
    if (resolveKick(shooter, muralha, `t4-${i}`, 'home', 1).scored) vsMuralha += 1;
    if (resolveKick(shooter, peneira, `t4-${i}`, 'home', 1).scored) vsPeneira += 1;
  }
  check('converte menos contra goleirão', vsMuralha < vsPeneira,
    `${(vsMuralha / 20).toFixed(0)}% vs ${(vsPeneira / 20).toFixed(0)}%`);
  check('keeperPenaltyRating: muralha > peneira',
    keeperPenaltyRating(muralha, 's') > keeperPenaltyRating(peneira, 's'));
  // Traço oculto: existe variação de especialista entre goleiros de mesmo atributo
  const ratings = Array.from({ length: 20 }, (_, i) => keeperPenaltyRating(keeper(`g${i}`, 70), 'spec'));
  const spread = Math.max(...ratings) - Math.min(...ratings);
  check('especialista: goleiros de mesmo atributo variam (traço oculto)', spread > 6,
    `spread ${spread.toFixed(1)}`);

  // [5] Fadiga derruba a cobrança
  console.log('\n[5] Fadiga');
  const inteiro = kicker('inteiro', 78, 75, 72, 0);
  const exausto = kicker('exausto', 78, 75, 72, 95);
  check('mesmo jogador exausto tem rating menor', kickerRating(exausto) < kickerRating(inteiro),
    `${kickerRating(exausto).toFixed(0)} < ${kickerRating(inteiro).toFixed(0)}`);
  let goalsInteiro = 0, goalsExausto = 0;
  for (let i = 0; i < 2000; i += 1) {
    if (resolveKick(inteiro, gk, `t5-${i}`, 'home', 1).scored) goalsInteiro += 1;
    if (resolveKick(exausto, gk, `t5-${i}`, 'home', 1).scored) goalsExausto += 1;
  }
  check('exausto converte menos', goalsExausto < goalsInteiro,
    `${(goalsExausto / 20).toFixed(0)}% vs ${(goalsInteiro / 20).toFixed(0)}%`);

  // [6] Conversão média de pênalti é realista (~70-80%)
  console.log('\n[6] Conversão realista');
  let total = 0;
  const mid = kicker('mid', 70, 68, 68);
  for (let i = 0; i < 5000; i += 1) {
    if (resolveKick(mid, keeper('g', 62), `t6-${i}`, 'home', 1).scored) total += 1;
  }
  const rate = total / 5000;
  check('conversão média entre 65% e 85%', rate > 0.65 && rate < 0.85, `${(rate * 100).toFixed(0)}%`);

  // [7] Morte súbita: empate em 5 leva a sudden death e resolve
  console.log('\n[7] Morte súbita');
  let suddenCount = 0, suddenResolved = 0;
  for (let i = 0; i < 500; i += 1) {
    const r = simulateShootout({
      homeOrder: order('h', 71), awayOrder: order('a', 71),
      homeKeeper: keeper('gkh', 69), awayKeeper: keeper('gka', 69), seed: `sd-${i}`,
    });
    if (r.suddenDeath) {
      suddenCount += 1;
      if (r.homeTally !== r.awayTally) suddenResolved += 1;
      // na morte súbita, o último round tem os dois lados batendo
      const sudden = r.kicks.filter((k) => k.suddenDeath);
      const lastRound = Math.max(...sudden.map((k) => k.round));
      const inLast = sudden.filter((k) => k.round === lastRound);
      if (inLast.length !== 2) { failures += 1; console.error('  ✗ round de morte súbita não-alternado'); }
    }
  }
  check('morte súbita acontece em parte dos jogos', suddenCount > 0, `${suddenCount}/500`);
  check('toda morte súbita resolve (sem empate)', suddenCount === suddenResolved,
    `${suddenResolved}/${suddenCount}`);

  // [8] Parada antecipada: melhor de 5 não bate cobranças inúteis
  console.log('\n[8] Parada antecipada (melhor de 5)');
  let earlyStops = 0;
  for (let i = 0; i < 500; i += 1) {
    const r = simulateShootout({
      homeOrder: order('h', 80), awayOrder: order('a', 55), // home muito superior
      homeKeeper: keeper('gkh', 80), awayKeeper: keeper('gka', 50), seed: `es-${i}`,
    });
    const regular = r.kicks.filter((k) => !k.suddenDeath);
    if (regular.length < 10) earlyStops += 1;
  }
  check('disputas decididas antes das 10 cobranças acontecem', earlyStops > 0, `${earlyStops}/500`);

  // [9] rankKickers ordena por qualidade
  console.log('\n[9] Ranking de batedores');
  const pool = [kicker('c', 60, 60, 60), kicker('a', 90, 85, 85), kicker('b', 75, 70, 70, 50)];
  const ranked = rankKickers(pool);
  check('rankKickers: melhor primeiro', ranked[0]!.id === 'a' && ranked[2]!.id === 'c',
    ranked.map((k) => k.id).join(','));

  // [10] goalProbability dentro dos limites
  console.log('\n[10] Limites de probabilidade');
  const pHi = goalProbability(kicker('x', 99, 99, 99), keeper('y', 20), 's');
  const pLo = goalProbability(kicker('x', 30, 30, 30, 90), keeper('y', 95, 90, 85), 's');
  check('prob de gol clampada em [0.40, 0.96]', pHi <= 0.96 && pLo >= 0.40 && pHi > pLo,
    `hi ${pHi.toFixed(2)} lo ${pLo.toFixed(2)}`);

  console.log(failures === 0
    ? '\n✅ OK — disputa de pênaltis validada'
    : `\n❌ ${failures} check(s) falharam`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
