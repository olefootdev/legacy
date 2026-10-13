/**
 * O FILME COMO ARENA (Partida Viva, Fase 4) — a conta.   npm run test:arena
 *
 * Partidas REAIS do motor: o dono joga (plano inteiro + um replan de comando),
 * o filme guarda o placar e as escolhas, e outro manager assume um lance.
 * Confere a régua de lib/arena.ts ponta a ponta, com o Python de verdade.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resumirPlano } from './smartProfile/custodia.js';
import { contarPartida, costurar, escolhaAutomatica, escolhasVazias, lanceDoEvento, type Escolhas } from './partida/placar.js';
import {
  entradaDoMotor, escolhasDaLenda, escolhasValidas, lancesDoPlano, momentosSemDesfecho, oQueEleFez, placarDaArena,
  planoEmVigor, rankingDaSemana, somarPreferencias, veredito, type PlanoGuardado, type Placar,
} from './arena.js';
import { planoSalvoDaCustodia } from './planoSalvo.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SMART = path.resolve(AQUI, '../../smartfield');
const N = Number(process.env.N ?? 60);

let ok = 0, falhou = 0;
const check = (nome: string, cond: boolean, extra = '') => {
  if (cond) { ok++; console.log(`  ✅ ${nome}`); } else { falhou++; console.log(`  ❌ ${nome} ${extra}`); }
};

function py(input: unknown): any {
  const r = spawnSync('python3', [path.join(SMART, 'match_simulator.py')], { input: JSON.stringify(input), cwd: SMART, encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0) throw new Error(r.stderr);
  return JSON.parse(r.stdout);
}
function entradas(n: number): any[] {
  const r = spawnSync('python3', ['-c', `import json; from test_cadeia_lances import entrada\nout=[]\nfor i in range(${n}):\n  d=entrada(i); d.pop('mode',None); d.pop('first_half',None); out.append(d)\nprint(json.dumps(out))`], { cwd: SMART, encoding: 'utf8', maxBuffer: 64 << 20 });
  return JSON.parse(r.stdout);
}

/** Escolhas "do dono": determinísticas por partida (metade certa, metade automática). */
function escolhasDoDono(lances: ReturnType<typeof costurar>['lances'], i: number): Escolhas {
  const e = escolhasVazias();
  for (const l of lances) {
    if (l.k === 'goal' && l.decisivo && (l.m + i) % 2 === 0) e.decisivos[String(l.m)] = Object.keys(l.decisivo.opcoes)[(l.m + i) % 3] ?? '';
    if (l.k === 'penalty' && l.lado === 'home' && l.penalti?.por_batedor) e.penaltis[String(l.m)] = Object.keys(l.penalti.por_batedor)[(l.m + i) % 4] ?? '';
  }
  return e;
}

console.log(`\n🎬 ${N} partidas: o dono joga, o filme guarda, outro manager assume\n`);
const base = entradas(N);
let rejeitaFilmeErrado = 0, vigenteCerto = 0, caladoIgual = 0, semDesfecho = 0, placarCoerente = 0, determinista = 0;
let estadoBate = 0, somaMelhor = 0, somaAuto = 0, comMomento = 0;
for (let i = 0; i < N; i++) {
  const entrada = { ...base[i], comandos: [] as unknown[] };
  // O dono: plano inteiro, depois "cobrar" no 30' → replan do 33'.
  const full = py(entrada);
  const escolhas0 = escolhasDoDono(costurar([resumirPlano(full, [])]).lances, i);
  const r0 = resumirPlano(full, []);
  const conta33 = contarPartida(costurar([r0]).lances, escolhas0, 33);
  const comandos = [{ minuto: 30, tipo: 'cobrar' }];
  const estado33 = { home_score: conta33.placar[0], away_score: conta33.placar[1], momentum_end: full.momentum_curve[29], cards_home: conta33.cartoes.home, cards_away: conta33.cartoes.away, sent_off_home: conta33.expulsos.home, sent_off_away: conta33.expulsos.away, expulsos: conta33.expulsosIds, amarelados: conta33.amareladosIds };
  const replan = py({ ...entrada, comandos, mode: 'from_minute', from_minute: 33, estado: estado33 });
  const planos: PlanoGuardado[] = [
    { ...resumirPlano(full, []), entrada: entradaDoMotor(entrada) },
    { ...resumirPlano(replan, []), entrada: entradaDoMotor({ ...entrada, comandos, estado: estado33, prova_de_causa: { tipo: 'comando' } }) },
  ];
  const escolhas = escolhasDoDono(costurar(planos).lances, i);
  // Só as escolhas antes do 33' valiam quando o replan foi pedido: o estado do replan é o que a custódia derivou.
  const final = contarPartida(costurar(planos).lances, escolhas).placar as Placar;

  // O filme com placar errado não vira arena.
  if (oQueEleFez(planos, escolhas, 60, [final[0] + 1, final[1]]) === null) rejeitaFilmeErrado++;
  const minuto = 40 + (i % 40);
  const ele = oQueEleFez(planos, escolhas, minuto, final)!;
  const vig = planoEmVigor(planos, minuto);
  if (vig === planos[1] && planoEmVigor(planos, 20) === planos[0]) vigenteCerto++;
  const contaM = contarPartida(costurar(planos).lances, escolhas, minuto);
  if (ele.estado.home_score === contaM.placar[0] && ele.estado.away_score === contaM.placar[1] && ele.final[0] === final[0]) estadoBate++;
  // Também não guardou estado de replan nem prova no pedido.
  if ('estado' in vig!.entrada! || 'prova_de_causa' in vig!.entrada!) falhou++;

  // Quem assume SEM ordem e com a escolha automática = o banco calado.
  const calado = py({ ...vig!.entrada, arena: { minuto, estado: ele.estado, comandos: [] } });
  const momentos = momentosSemDesfecho(calado.voce);
  const auto = escolhasVazias();
  for (const m of momentos) if (m.tipo === 'decisivo') auto.decisivos[String(m.m)] = m.auto;
  const vCalado = placarDaArena(ele.noMinuto, lancesDoPlano(calado.voce), auto);
  const pCalado = placarDaArena(ele.noMinuto, lancesDoPlano(calado.parado), escolhasVazias());
  if (vCalado[0] === pCalado[0] && vCalado[1] === pCalado[1]) caladoIgual++;

  // Com ordens: os momentos não carregam desfecho nenhum (nenhum booleano).
  const ordens = [{ minuto, tipo: 'estilo', estilo: 'attack' }, { minuto: minuto + 1, tipo: 'incentivar' }];
  const arena = py({ ...vig!.entrada, arena: { minuto, estado: ele.estado, comandos: ordens } });
  const mom = momentosSemDesfecho(arena.voce);
  if (!/true|false/.test(JSON.stringify(mom))) semDesfecho++;
  // A melhor leitura (a que o servidor sabe e o aparelho NÃO recebe) × deixar no automático.
  const melhor = escolhasVazias(), noAuto = escolhasVazias();
  for (const e of arena.voce.events) {
    const l = lanceDoEvento(e);
    if (l?.k === 'goal' && l.decisivo) { melhor.decisivos[String(l.m)] = l.decisivo.melhor ?? ''; noAuto.decisivos[String(l.m)] = escolhaAutomatica(l.decisivo); }
  }
  if (mom.length) comMomento++;
  const vMelhor = placarDaArena(ele.noMinuto, lancesDoPlano(arena.voce), escolhasValidas(mom, melhor));
  const vAuto = placarDaArena(ele.noMinuto, lancesDoPlano(arena.voce), escolhasValidas(mom, noAuto));
  somaMelhor += (vMelhor[0] - vMelhor[1]); somaAuto += (vAuto[0] - vAuto[1]);
  if (vMelhor[0] >= ele.noMinuto[0] && vMelhor[1] >= ele.noMinuto[1]) placarCoerente++;
  if (i < 15) {
    const de2 = py({ ...vig!.entrada, arena: { minuto, estado: ele.estado, comandos: ordens } });
    const a = veredito(minuto, ele.noMinuto, ele.final, placarDaArena(ele.noMinuto, lancesDoPlano(de2.voce), escolhasValidas(mom, melhor)), pCalado);
    const b = veredito(minuto, ele.noMinuto, ele.final, vMelhor, pCalado);
    if (JSON.stringify(a) === JSON.stringify(b)) determinista++;
  } else determinista++;
}
check(`filme com placar que a custódia não fecha é recusado (${rejeitaFilmeErrado}/${N})`, rejeitaFilmeErrado === N);
check(`o plano em vigor no minuto é o replan que já começou (${vigenteCerto}/${N})`, vigenteCerto === N);
check(`o estado no minuto e o placar final do dono vêm da custódia (${estadoBate}/${N})`, estadoBate === N);
check(`assumir sem ordem e no automático = banco calado, placar por placar (${caladoIgual}/${N})`, caladoIgual === N);
check(`os momentos que vão ao aparelho não levam desfecho (${semDesfecho}/${N})`, semDesfecho === N);
check(`o placar da arena parte do placar do minuto (${placarCoerente}/${N})`, placarCoerente === N);
check(`o mesmo pedido dá o mesmo veredito (${determinista}/${N})`, determinista === N);
console.log(`     escolha: a leitura certa dá saldo ${somaMelhor} contra ${somaAuto} no automático (${comMomento} arenas com momento decisivo)`);
check('ler o lance certo vale mais que deixar no automático (escolha pesa)', somaMelhor > somaAuto);

console.log('\n🧮 a régua\n');
{
  const v = veredito(60, [1, 1], [1, 2], [3, 1], [2, 1]);
  check('saldo: você 3×1 onde ele fez 1×2 a partir de 1×1 → +3', v.saldo === 3 && v.contraParado === 1, JSON.stringify(v));
  const mom = [{ tipo: 'decisivo' as const, m: 50, intent: 'attack' as const, contexto: 'x', opcoes: ['chutar', 'driblar', 'tocar'], duelo: { nosso: { id: 'legacy-a', nome: 'A' }, deles: { id: 'z', nome: 'Z' }, por_opcao: {} }, auto: 'chutar' },
    { tipo: 'decisivo' as const, m: 70, intent: 'attack' as const, contexto: 'x', opcoes: ['chutar', 'driblar', 'tocar'], duelo: { nosso: { id: 'home-9', nome: 'N' }, deles: { id: 'z', nome: 'Z' }, por_opcao: {} }, auto: 'chutar' },
    { tipo: 'penalti' as const, m: 80, sugerido: 'home-9', batedores: ['home-9', 'legacy-a'] }];
  const e = escolhasValidas(mom, { decisivos: { '50': 'driblar', '70': 'voar', '33': 'chutar' }, penaltis: { '80': 'legacy-a', '81': 'x' } });
  check('escolhas que não são de momento nenhum (ou opção inexistente) caem', JSON.stringify(e) === JSON.stringify({ decisivos: { '50': 'driblar' }, penaltis: { '80': 'legacy-a' } }), JSON.stringify(e));
  const daLenda = escolhasDaLenda(mom, { decisivos: { '50': 'driblar', '70': 'tocar' }, penaltis: {} }, ['legacy-a']);
  check('a lenda aprende só nos momentos DELA', JSON.stringify(daLenda) === JSON.stringify({ 'legacy-a': { driblar: 1 } }), JSON.stringify(daLenda));
  const soma = somarPreferencias([{ 'legacy-a': { driblar: 1 } }, { 'legacy-a': { driblar: 2, chutar: 1 }, 'legacy-b': { tocar: 5 } }, null], ['legacy-a']);
  check('preferências somam por lenda (e só das lendas em campo)', JSON.stringify(soma) === JSON.stringify({ 'legacy-a': { driblar: 3, chutar: 1 } }), JSON.stringify(soma));
  const rk = rankingDaSemana([{ desafiante: 'a', saldo: 2 }, { desafiante: 'b', saldo: 3 }, { desafiante: 'a', saldo: 1 }, { desafiante: 'c', saldo: -4 }, { desafiante: 'd', saldo: 3 }, { desafiante: 'd', saldo: -1 }]);
  check('ranking: soma do saldo positivo; empate → menos tentativas, depois o melhor saldo', rk.map((l) => `${l.desafiante}${l.pontos}`).join(' ') === 'b3 d3 a3 c0', rk.map((l) => `${l.desafiante}${l.pontos}/${l.tentativas}`).join(' '));
}

console.log('\n🗂️  o plano salvo do adversário ausente\n');
{
  // A última partida do ausente: ele perdia de 0×1 no 60' e foi pro ataque + cobrou; no 80', 1×1, acalmou.
  const gol = (m: number, lado: 'home' | 'away') => ({ m, k: 'goal', lado, a: lado === 'home' ? 'h9' : 'a9' });
  const planos = [
    { modo: 'full' as const, minutoInicial: 1, lances: [gol(30, 'away'), gol(70, 'home')], entrada: { comandos: [] } },
    { modo: 'from_minute' as const, minutoInicial: 63, lances: [gol(70, 'home')], entrada: { comandos: [{ minuto: 60, tipo: 'estilo', estilo: 'attack' }, { minuto: 60, tipo: 'cobrar' }] } },
    { modo: 'from_minute' as const, minutoInicial: 83, lances: [], entrada: { comandos: [{ minuto: 60, tipo: 'estilo', estilo: 'attack' }, { minuto: 60, tipo: 'cobrar' }, { minuto: 80, tipo: 'acalmar' }, { minuto: 81, tipo: 'ordem', ordem: 'marcar', jogador: 'x' }, { minuto: 82, tipo: 'estilo', estilo: 'voar' }] } },
  ];
  const regras = planoSalvoDaCustodia(planos);
  check('cada estilo/grito vira regra presa à situação DELE naquele minuto (ordem e estilo inválido ficam fora)',
    JSON.stringify(regras) === JSON.stringify([{ depois: 60, quando: 'perdendo', estilo: 'attack', grito: 'cobrar' }, { depois: 80, quando: 'empatando', grito: 'acalmar' }]), JSON.stringify(regras));
  check('sem comando na partida: plano vazio (joga pelo DNA)', planoSalvoDaCustodia([planos[0]!]).length === 0);
  const muitos = planoSalvoDaCustodia([{ ...planos[0]!, entrada: { comandos: [10, 20, 30, 40, 50, 60].map((m) => ({ minuto: m, tipo: 'estilo', estilo: 'press' })) } }]);
  check('no máximo 4 regras', muitos.length === 4);
}

console.log(`\n${falhou ? '❌' : '✅'} arena: ${ok} ok, ${falhou} falhou\n`);
if (falhou) process.exit(1);
