/**
 * Teste do motor por setor da Liga Global (globalSectorModel).
 *
 * Trava a exigência do fundador: gol de TODO O CAMPO, por tipo de lance —
 * zagueiro cabeceia, batedor bate falta, cobrador bate pênalti, defensor marca.
 * E a matemática de setor: ataque forte × defesa fraca => mais gol esperado.
 *
 * rng SEMEADO (mulberry32) pra ser determinístico — nada de Math.random.
 */
import {
  computeSectors,
  sectorsToLambda,
  pickScorer,
  drawScorers,
  type SnapshotPlayer,
} from '../src/match/globalSectorModel';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let failed = 0;
function check(name: string, cond: boolean, detail = '') {
  console.log(`  ${cond ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failed++;
}

function mk(over: Partial<SnapshotPlayer> & { name: string; pos: string }): SnapshotPlayer {
  return {
    id: over.name.toLowerCase(),
    finalizacao: 60,
    drible: 60,
    velocidade: 60,
    passe: 60,
    marcacao: 60,
    fisico: 60,
    cabeceio: 60,
    bolaParada: 60,
    penalti: 60,
    confianca: 60,
    ...over,
  };
}

// XI com especialistas nítidos.
const zagCabeca = mk({ name: 'ZagCabeca', pos: 'ZAG', marcacao: 82, fisico: 84, cabeceio: 92 });
const batedor = mk({ name: 'Batedor', pos: 'MEI', passe: 84, finalizacao: 78, bolaParada: 94 });
const cobrador = mk({ name: 'Cobrador', pos: 'ATA', finalizacao: 86, penalti: 95, confianca: 88 });
const XI: SnapshotPlayer[] = [
  mk({ name: 'GK', pos: 'GOL', marcacao: 40 }),
  zagCabeca,
  mk({ name: 'Zag2', pos: 'ZAG', marcacao: 78, fisico: 80, cabeceio: 62 }),
  mk({ name: 'LatE', pos: 'LE', velocidade: 78 }),
  mk({ name: 'LatD', pos: 'LD', velocidade: 78 }),
  mk({ name: 'Volante', pos: 'VOL', marcacao: 76, passe: 70 }),
  batedor,
  mk({ name: 'Meia', pos: 'MC', passe: 80 }),
  mk({ name: 'PontaE', pos: 'PE', velocidade: 85, drible: 82, finalizacao: 70 }),
  mk({ name: 'PontaD', pos: 'PD', velocidade: 85, drible: 82, finalizacao: 70 }),
  cobrador,
];

const N = 40000;

console.log('\n[1] Cabeça no escanteio → o zagueiro que cabeceia domina');
{
  const tally: Record<string, number> = {};
  const rng = mulberry32(1);
  for (let i = 0; i < N; i++) {
    const s = pickScorer(XI, 'header', rng);
    if (s) tally[s.name] = (tally[s.name] ?? 0) + 1;
  }
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]!;
  check('ZagCabeca lidera os gols de cabeça', top[0] === 'ZagCabeca', `líder=${top[0]} (${((top[1] / N) * 100).toFixed(0)}%)`);
  check('goleiro não faz gol de cabeça', (tally['GK'] ?? 0) === 0);
}

console.log('\n[2] Falta direta → o batedor especialista concentra');
{
  const tally: Record<string, number> = {};
  const rng = mulberry32(2);
  for (let i = 0; i < N; i++) {
    const s = pickScorer(XI, 'free_kick', rng);
    if (s) tally[s.name] = (tally[s.name] ?? 0) + 1;
  }
  const share = (tally['Batedor'] ?? 0) / N;
  check('Batedor bate a maioria das faltas', share > 0.5, `${(share * 100).toFixed(0)}%`);
}

console.log('\n[3] Pênalti → o cobrador designado');
{
  const tally: Record<string, number> = {};
  const rng = mulberry32(3);
  for (let i = 0; i < N; i++) {
    const s = pickScorer(XI, 'penalty', rng);
    if (s) tally[s.name] = (tally[s.name] ?? 0) + 1;
  }
  const share = (tally['Cobrador'] ?? 0) / N;
  check('Cobrador converte a maioria dos pênaltis', share > 0.5, `${(share * 100).toFixed(0)}%`);
}

console.log('\n[4] Jogada aberta → espalha, mas defensor TAMBÉM marca');
{
  const tally: Record<string, number> = {};
  const rng = mulberry32(4);
  for (let i = 0; i < N; i++) {
    const s = pickScorer(XI, 'open', rng);
    if (s) tally[s.name] = (tally[s.name] ?? 0) + 1;
  }
  const atacantes = (tally['Cobrador'] ?? 0) + (tally['PontaE'] ?? 0) + (tally['PontaD'] ?? 0);
  const defensores = (tally['ZagCabeca'] ?? 0) + (tally['Zag2'] ?? 0) + (tally['LatE'] ?? 0) + (tally['LatD'] ?? 0);
  check('ataque faz mais que defesa na jogada aberta', atacantes > defensores, `atk=${atacantes} def=${defensores}`);
  check('defensores marcam de vez em quando (não é zero)', defensores > 0, `${defensores} gols`);
}

console.log('\n[5] Setor: ataque forte × defesa fraca => mais gol esperado');
{
  const forte = computeSectors(XI);
  const fraco: SnapshotPlayer[] = XI.map((p) => mk({ ...p, name: p.name + '_w', finalizacao: 45, marcacao: 45, fisico: 45, drible: 45, passe: 45, velocidade: 45 }));
  const secFraco = computeSectors(fraco);
  const l = sectorsToLambda({ home: forte, away: secFraco });
  const lRev = sectorsToLambda({ home: secFraco, away: forte });
  check('time forte tem λ maior que o fraco no mesmo jogo', l.home > l.away, `forte=${l.home.toFixed(2)} fraco=${l.away.toFixed(2)}`);
  check('mando de campo dá vantagem (forte em casa > forte fora)', l.home > lRev.away, `casa=${l.home.toFixed(2)} fora=${lRev.away.toFixed(2)}`);
  check('λ fica em faixa sã (0.2–5)', l.home <= 5 && l.away >= 0.2);
}

console.log('\n[6] drawScorers respeita o número de gols');
{
  const rng = mulberry32(6);
  const scorers = drawScorers(XI, 3, rng);
  check('3 gols => 3 marcadores', scorers.length === 3, `${scorers.length}`);
  check('todo marcador tem nome e tipo', scorers.every((s) => s.name && s.type));
}

console.log(failed === 0 ? '\n✅ MOTOR POR SETOR — tudo passou\n' : `\n❌ ${failed} falхарам\n`);
process.exit(failed === 0 ? 0 : 1);
