/**
 * O FILME COMO ARENA (Partida Viva, Fase 4) — o filme da arena no campo.   npm run test:arena-filme
 *
 * O plano que o servidor devolve ao fechar a arena + as escolhas de quem
 * assumiu viram um ROTEIRO (src/partidaViva/arena.ts) que o palco do LEGACY
 * toca. Com arenas REAIS do motor (server/smartfield/arena.py):
 *
 *   1. O placar que o filme mostra no fim = o placar que o servidor conta
 *      (lib/arena.ts `placarDaArena`) — em 100% das arenas, com escolhas variadas.
 *   2. Cada gol do roteiro passa por `golDoLance` (a mesma porta): gols no
 *      roteiro = gols contados.
 *   3. O roteiro começa no minuto assumido e o relógio só anda pra frente.
 *   4. Tocado num coreógrafo novo, nos passos gravados (como o palco toca o
 *      filme): nada de NaN, a bola não fica parada no mesmo ponto por 20 s.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { Coreografo } from '../src/partidaViva/coreografo';
import { montarFichas } from '../src/partidaViva/escalacao';
import { roteiroDaArena, type Placar } from '../src/partidaViva/arena';
import { entregarQuadro } from '../src/partidaViva/gravacao';
import { escolhasVazias, type Escolhas } from '../src/match/placarAoVivo';
import type { MatchPlan } from '../src/match/quickPlanTypes';
import { escolhasValidas, lancesDoPlano, momentosSemDesfecho, placarDaArena } from '../server/src/lib/arena';

const SMART = path.resolve(import.meta.dirname, '../server/smartfield');
const N = Number(process.env.N ?? 40);
const script = `
import json, copy, sys
from test_cadeia_lances import entrada
from match_simulator import simulate
from arena import assumir
from test_prova_de_causa import estado_em
out = []
for i in range(${N}):
    d = entrada(i); d.pop('mode', None); d.pop('first_half', None)
    full = simulate(copy.deepcopy(d))
    m = 20 + (i * 7) % 60
    ordens = [{'minuto': m, 'tipo': 'estilo', 'estilo': ['attack', 'press', 'defend', 'counter'][i % 4]}, {'minuto': m + 2, 'tipo': 'cobrar'}]
    r = assumir({**d, 'arena': {'minuto': m, 'estado': estado_em(full, m), 'comandos': ordens}})
    out.append({'plan': r['voce'], 'minuto': m, 'estado': estado_em(full, m),
                'home': [{'id': p['id'], 'pos': p['pos']} for p in d['home_team']['lineup']],
                'away': [{'id': p['id'], 'pos': p['pos']} for p in d['away_team']['lineup']]})
print(json.dumps(out))
`;
const r = spawnSync('python3', ['-c', script], { cwd: SMART, encoding: 'utf8', maxBuffer: 256 << 20 });
if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
const arenas = JSON.parse(r.stdout) as { plan: MatchPlan; minuto: number; estado: { home_score: number; away_score: number }; home: { id: string; pos: string }[]; away: { id: string; pos: string }[] }[];

let ok = 0, falhou = 0;
const check = (nome: string, cond: boolean, extra = '') => {
  if (cond) { ok++; console.log(`  ✅ ${nome}`); } else { falhou++; console.log(`  ❌ ${nome} ${extra}`); }
};

let placarBate = 0, golsBatem = 0, relogioCerto = 0, semNaN = 0, bolaViva = 0, comGol = 0;
const problemas: string[] = [];
for (const [i, a] of arenas.entries()) {
  const fichas = [
    ...montarFichas('home', a.home.map((p, k) => ({ id: p.id, nome: `Casa${k}`, pos: p.pos, fadiga: 20 }))),
    ...montarFichas('away', a.away.map((p, k) => ({ id: p.id, nome: `Fora${k}`, pos: p.pos, fadiga: 20 }))),
  ];
  // Escolhas variadas: cada momento numa opção diferente (e pênalti num batedor do meio da lista).
  const momentos = momentosSemDesfecho(a.plan as never);
  const pedidas: Escolhas = escolhasVazias();
  for (const [k, m] of momentos.entries()) {
    if (m.tipo === 'decisivo') pedidas.decisivos[String(m.m)] = m.opcoes[(i + k) % m.opcoes.length]!;
    else pedidas.penaltis[String(m.m)] = m.batedores[(i + k) % m.batedores.length]!;
  }
  const escolhas = escolhasValidas(momentos, pedidas);
  const noMinuto: Placar = [a.estado.home_score, a.estado.away_score];
  const servidor = placarDaArena(noMinuto, lancesDoPlano(a.plan as never), escolhas);
  const { roteiro, placar } = roteiroDaArena(a.plan, fichas, [], '4-3-3', '4-3-3', escolhas, noMinuto, a.home.map((p) => p.id), (id) => id ?? '');
  const ultimo = roteiro[roteiro.length - 1]!.q;
  if (placar[0] === servidor[0] && placar[1] === servidor[1] && ultimo.placarCasa === servidor[0] && ultimo.placarFora === servidor[1]) placarBate++;
  else problemas.push(`arena ${i}: filme ${placar.join('×')} (último quadro ${ultimo.placarCasa}×${ultimo.placarFora}) · servidor ${servidor.join('×')}`);
  const golsNoRoteiro = new Set(roteiro.filter((e) => e.q.gol).map((e) => e.q.gol!.chave)).size;
  if (golsNoRoteiro === (servidor[0] - noMinuto[0]) + (servidor[1] - noMinuto[1])) golsBatem++;
  if (golsNoRoteiro) comGol++;
  const minutos = roteiro.map((e) => e.q.minuto);
  const passos = roteiro.map((e) => e.p);
  if (minutos[0] === a.minuto && minutos.every((m, k) => k === 0 || m >= minutos[k - 1]!) && passos.every((p, k) => k === 0 || p >= passos[k - 1]!)) relogioCerto++;

  // Tocar como o palco: um coreógrafo novo recebe cada quadro no passo gravado.
  const co = new Coreografo(fichas, '4-3-3', '4-3-3', `${a.plan.seed}|arena|${a.minuto}`);
  let prox = 0, nan = false, parada = 0, pior = 0, ult = { x: -1, z: -1 };
  const fim = roteiro[roteiro.length - 1]!.p + 40;
  while (co.passos < fim) {
    while (prox < roteiro.length && roteiro[prox]!.p <= co.passos) entregarQuadro(co, roteiro[prox++]!.q, []);
    co.passo();
    const b = co.bola;
    if (!Number.isFinite(b.x + b.z) || co.corpos.some((c) => !Number.isFinite(c.x + c.z))) nan = true;
    if (Math.hypot(b.x - ult.x, b.z - ult.z) < 0.05 && !co.festa && co.posicionados.size === 0) parada++; else parada = 0;
    pior = Math.max(pior, parada);
    ult = { x: b.x, z: b.z };
  }
  if (!nan) semNaN++;
  if (pior * 0.1 < 20) bolaViva++; else problemas.push(`arena ${i}: bola parada ${(pior * 0.1).toFixed(0)} s`);
}
console.log(`\n🎬 ${arenas.length} arenas reais (${comGol} com gol) → roteiro → campo\n`);
check(`placar do filme = placar do servidor (${placarBate}/${arenas.length})`, placarBate === arenas.length, problemas.slice(0, 3).join(' | '));
check(`gols no roteiro = gols contados pela mesma porta (${golsBatem}/${arenas.length})`, golsBatem === arenas.length);
check(`começa no minuto assumido; relógio e passos só andam pra frente (${relogioCerto}/${arenas.length})`, relogioCerto === arenas.length);
check(`tocado no coreógrafo: sem NaN (${semNaN}/${arenas.length})`, semNaN === arenas.length);
check(`a bola nunca fica 20 s parada fora de festa/bola parada (${bolaViva}/${arenas.length})`, bolaViva === arenas.length, problemas.filter((p) => p.includes('parada')).slice(0, 3).join(' | '));
console.log(`\n${falhou ? '❌' : '✅'} filme da arena: ${ok} ok, ${falhou} falhou\n`);
if (falhou) process.exit(1);
