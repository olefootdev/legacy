/**
 * LEGACY LEAGUE — regras puras. npm run test:legacy-league
 */
import { fimDaTemporada, montarTabela, pontosDe, seedDaPartida, temporadaAnterior, temporadaDe, veredito } from './legacyLeague.js';

let ok = 0, falhas = 0;
function confere(cond: boolean, msg: string) {
  console.log(`  ${cond ? '✅' : '❌'} ${msg}`);
  if (cond) ok++; else falhas++;
}

console.log('\n📅 Temporada = semana ISO (segunda a domingo, UTC)');
confere(temporadaDe(new Date('2026-10-10T12:00:00Z')) === '2026-W41', `sábado 10/10/2026 → ${temporadaDe(new Date('2026-10-10T12:00:00Z'))}`);
confere(temporadaDe(new Date('2026-10-05T00:00:00Z')) === '2026-W41', 'segunda 05/10 00:00 já é a mesma semana');
confere(temporadaDe(new Date('2026-10-04T23:59:59Z')) === '2026-W40', 'domingo 04/10 23:59 é a semana anterior');
confere(temporadaDe(new Date('2027-01-01T12:00:00Z')) === '2026-W53', `virada de ano: 01/01/2027 (sexta) → ${temporadaDe(new Date('2027-01-01T12:00:00Z'))}`);
confere(temporadaDe(new Date('2026-01-01T12:00:00Z')) === '2026-W01', '01/01/2026 (quinta) → 2026-W01');
confere(temporadaAnterior(new Date('2026-10-10T12:00:00Z')) === '2026-W40', 'temporada anterior');
confere(fimDaTemporada(new Date('2026-10-10T12:00:00Z')).toISOString() === '2026-10-11T23:59:59.999Z', 'a temporada termina domingo 23:59:59 UTC');

console.log('\n🏆 Tabela');
confere(pontosDe(2, 1) === 3 && pontosDe(1, 1) === 1 && pontosDe(0, 2) === 0, 'vitória 3, empate 1, derrota 0');
const t = montarTabela([
  { dono: 'a', gols_pro: 2, gols_contra: 0, pontos: 3 }, { dono: 'a', gols_pro: 0, gols_contra: 1, pontos: 0 },
  { dono: 'b', gols_pro: 1, gols_contra: 0, pontos: 3 },
  { dono: 'c', gols_pro: 3, gols_contra: 3, pontos: 1 }, { dono: 'c', gols_pro: 1, gols_contra: 1, pontos: 1 }, { dono: 'c', gols_pro: 1, gols_contra: 1, pontos: 1 },
]);
confere(t.map((l) => l.dono).join('') === 'abc', `ordem: pontos, depois saldo, gols, menos jogos (${t.map((l) => `${l.dono}:${l.pontos}/${l.saldo}`).join(' ')})`);
confere(t[0]!.v === 1 && t[0]!.d === 1 && t[0]!.jogos === 2 && t[2]!.e === 3, 'vitórias, derrotas e jogos contados');

console.log('\n⚖️ Veredito (vale só com custódia válida + filme)');
const adv = '22222222-2222-4222-8222-222222222222', pid = '33333333-3333-4333-8333-333333333333';
const seed = `OLE-RIV-${adv}-1791605189377-LL${pid}`;
confere(seedDaPartida(seed, pid, adv), 'a seed carrega a partida e o adversário');
confere(veredito({ seed: `OLE-RIV-${adv}-1`, partidaId: pid, adversario: adv, sombra: null, filme: null }).status === 'invalida', 'seed de outra partida: inválida');
confere(veredito({ seed, partidaId: pid, adversario: adv, sombra: null, filme: null }).status === 'aguardando', 'sem custódia ainda: aguardando');
confere(veredito({ seed, partidaId: pid, adversario: adv, sombra: { custodia: 'valida', resultado: 'win' }, filme: null }).status === 'aguardando', 'sem filme ainda: aguardando');
const s1 = veredito({ seed, partidaId: pid, adversario: adv, sombra: { custodia: 'suspeita', resultado: 'win' }, filme: { placarCasa: 2, placarFora: 0 } });
confere(s1.status === 'invalida', 'custódia suspeita: inválida (0 pontos)');
const v = veredito({ seed, partidaId: pid, adversario: adv, sombra: { custodia: 'valida', resultado: 'win' }, filme: { placarCasa: 2, placarFora: 1 } });
confere(v.status === 'valida' && v.pontos === 3 && v.gols_pro === 2, 'custódia válida + filme 2×1 + vitória: 3 pontos');
confere(veredito({ seed, partidaId: pid, adversario: adv, sombra: { custodia: 'valida', resultado: 'loss' }, filme: { placarCasa: 3, placarFora: 0 } }).status === 'invalida', 'filme diz vitória, custódia diz derrota: inválida');
const pen = veredito({ seed, partidaId: pid, adversario: adv, sombra: { custodia: 'valida', resultado: 'win' }, filme: { placarCasa: 1, placarFora: 1 } });
confere(pen.status === 'valida' && pen.pontos === 1, 'empate que foi aos pênaltis: vale, 1 ponto');

console.log(`\n${falhas ? '🔴' : '🟢'} ${ok} passaram, ${falhas} falharam`);
if (falhas) process.exit(1);
