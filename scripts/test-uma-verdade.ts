/**
 * UMA VERDADE SÓ (Partida Viva, Fase 0) — o portão.   npm run test:uma-verdade
 *
 * (a) 0 gols nascidos no aparelho: varre `src/` e prova que nenhuma das viradas
 *     de resultado existe mais, que o placar só sobe por `marcarGol` (uma única
 *     porta, atrás de `golDoLance`) e que nada do momento decisivo/pênalti sorteia.
 * (b) 200 partidas reais do motor, com escolhas ALEATÓRIAS (momento decisivo,
 *     batedor), intervalo e replans de comando: o placar e os números por
 *     jogador que o aparelho mostra são EXATAMENTE os que a custódia recalcula
 *     dos planos emitidos + escolhas; o estado que o servidor deriva pra cada
 *     replan é o estado do aparelho; e um relato adulterado cai em `suspeita`.
 *
 * O aparelho é reproduzido aqui por um replayer PURO que usa as mesmas funções
 * do QuickPlanPlayer (`lanceDe`, `golDoLance`, `emendarEventos`) na mesma
 * ordem: a custódia é o servidor de verdade (`resumirPlano`, `estadoNoMinuto`,
 * `validarRelato`). O motor roda residente (scripts/fase0/motor-residente.py).
 */
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { emendarEventos, estadoAte, golDoLance, lanceDe, escolhasVazias, type Escolhas } from '../src/match/placarAoVivo';
import type { MatchPlan, MatchPlanEvent } from '../src/match/quickPlanTypes';
import { estadoNoMinuto, notaDaPartida, resumirPlano, validarRelato, type ResumoDoPlano } from '../server/src/lib/smartProfile/custodia';
import { ovrDe } from '../server/src/lib/smartProfile/ovr';
import { atributosCompletos } from '../server/src/lib/smartProfile/derivar';

let falhas = 0;
let oks = 0;
function confere(cond: boolean, msg: string) {
  if (cond) oks++; else falhas++;
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
}

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── (a) varredura do código ──────────────────────────────────────────────────
function arquivos(dir: string, out: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = path.join(dir, nome);
    if (statSync(p).isDirectory()) { if (nome !== 'node_modules') arquivos(p, out); }
    else if (/\.(ts|tsx)$/.test(nome)) out.push(p);
  }
  return out;
}
{
  const fontes = arquivos(path.join(RAIZ, 'src'));
  const proibidos = ['resolveStyleOnEvent', 'resolveLegacyBoost', 'resolveFormationOnEvent', 'applyManDownPenalty', 'applySubNudge',
    'applyDecisionToRemainingEvents', 'resolveClutch(', 'buildClutch(', 'sprinkleDisciplineEvents', 'rollDecisionCrit', '}:penA:', '}:penH:', '}:clutch:', '}:livestyle:', '}:legacy:', '}:formation:', '}:mandown', '}:sub:', '}:discipline'];
  const achados: string[] = [];
  const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/[^\n'"`]*$/gm, '');
  for (const f of fontes) {
    const s = semComentarios(readFileSync(f, 'utf8'));
    for (const p of proibidos) if (s.includes(p)) achados.push(`${path.relative(RAIZ, f)}: ${p}`);
  }
  confere(achados.length === 0, `nenhuma virada de resultado sobrou em src/ (${fontes.length} arquivos)${achados.length ? ': ' + achados.join(', ') : ''}`);

  const player = readFileSync(path.join(RAIZ, 'src/match/QuickPlanPlayer.tsx'), 'utf8');
  const conta = (re: RegExp) => (player.match(re) ?? []).length;
  confere(conta(/scoreRef\.current\.home \+= 1/g) === 1 && conta(/scoreRef\.current\.away \+= 1/g) === 1
    && conta(/setHomeScore\(\(v\) => v \+ 1\)/g) === 1 && conta(/setAwayScore\(\(v\) => v \+ 1\)/g) === 1,
    'o placar do aparelho só sobe em um lugar (marcarGol)');
  const marcar = player.indexOf('const marcarGol = ');
  const chamadas = [...player.matchAll(/marcarGol\(/g)].map((m) => m.index!).filter((i) => i !== marcar + 'const '.length);
  const protegidas = chamadas.filter((i) => /golDoLance\(/.test(player.slice(Math.max(0, i - 1200), i)));
  confere(chamadas.length >= 4 && protegidas.length === chamadas.length, `toda chamada de marcarGol vem depois de golDoLance (${protegidas.length}/${chamadas.length})`);
  confere(conta(/new SpiritRng\(/g) === 1 && /legend:/.test(player), 'o único sorteio local da tela é a moldura da "Frase Lendária" (apresentação)');
  for (const f of ['src/match/quickClutch.ts', 'src/match/placarAoVivo.ts', 'src/match/quickTacticalLive.ts', 'server/src/lib/partida/placar.ts']) {
    const s = readFileSync(path.join(RAIZ, f), 'utf8');
    confere(!/SpiritRng|Math\.random|hashSeed/.test(s), `${f} não sorteia nada`);
  }
  const cliente = readFileSync(path.join(RAIZ, 'src/match/placarAoVivo.ts'), 'utf8');
  confere(/server\/src\/lib\/partida\/placar/.test(cliente), 'o aparelho importa a MESMA função de placar que a custódia');
}

// ── o motor residente ───────────────────────────────────────────────────────
class Motor {
  private proc = spawn('python3', [path.join(RAIZ, 'scripts/fase0/motor-residente.py')], { stdio: ['pipe', 'pipe', 'inherit'] });
  private fila: Array<(linha: string) => void> = [];
  private resto = '';
  constructor() {
    this.proc.stdout.on('data', (chunk: Buffer) => {
      this.resto += chunk.toString();
      let i: number;
      while ((i = this.resto.indexOf('\n')) >= 0) {
        const linha = this.resto.slice(0, i);
        this.resto = this.resto.slice(i + 1);
        this.fila.shift()?.(linha);
      }
    });
  }
  pedir<T>(corpo: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      this.fila.push((linha) => {
        const r = JSON.parse(linha) as T & { error?: string };
        if (r && (r as { error?: string }).error) reject(new Error((r as { error?: string }).error)); else resolve(r);
      });
      this.proc.stdin.write(JSON.stringify(corpo) + '\n');
    });
  }
  fechar() { this.proc.stdin.end(); }
}

// ── (b) o replayer do aparelho ──────────────────────────────────────────────
type Jogador = { id: string; pos: string; finalizacao: number };
type Entrada = { seed: string; home_team: { lineup: Jogador[]; banco?: Jogador[] }; away_team: { lineup: Jogador[] } } & Record<string, unknown>;

/** Gerador determinístico simples pras escolhas aleatórias (mulberry32). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const ATTRS = { passe: 70, marcacao: 60, velocidade: 75, drible: 72, finalizacao: 80, fisico: 70, tatico: 60, mentalidade: 65, confianca: 70, fairPlay: 70 };
const ESTILOS = ['defend', 'counter', 'possession', 'press', 'attack'] as const;

interface Jogo {
  placar: [number, number];
  stats: Record<string, { goals: number; shots: number }>;
  cartoes: { home: number; away: number };
  expulsos: { home: number; away: number };
  escolhas: Escolhas;
  resumos: ResumoDoPlano[];
  replans: number;
  estadosConferidos: number;
  estadosDivergentes: string[];
}

async function jogar(motor: Motor, i: number): Promise<Jogo> {
  const sorteio = rng(1000 + i);
  const entrada = await motor.pedir<Entrada>({ entrada: i });
  // Banco sintético (quem entra do banco também pode bater o pênalti).
  entrada.home_team.banco = Array.from({ length: 5 }, (_, k) => ({ id: `banco-${k}`, name: `Banco ${k}`, pos: 'ATA', role: 'attack', finalizacao: 60 + k * 6, passe: 60, marcacao: 50, velocidade: 65, fisico: 65, confianca: 60 })) as Jogador[];
  delete entrada.mode; delete entrada.first_half;
  const titulares = entrada.home_team.lineup.map((p) => p.id);
  const banco = entrada.home_team.banco.map((p) => p.id);

  const full = await motor.pedir<MatchPlan>(entrada);
  const jogo: Jogo = { placar: [0, 0], stats: {}, cartoes: { home: 0, away: 0 }, expulsos: { home: 0, away: 0 }, escolhas: escolhasVazias(), resumos: [], replans: 0, estadosConferidos: 0, estadosDivergentes: [] };
  jogo.resumos.push(resumirPlano(full, titulares, { banco }));

  let events: MatchPlanEvent[] = [...full.events];
  let momentum = [...full.momentum_curve];
  let idx = 0;
  const comandos: Array<Record<string, unknown>> = [];
  // Comandos de estilo em minutos sorteados (um no 1º tempo, um no 2º) → replan from_minute.
  const minutosDeComando = new Set([5 + Math.floor(sorteio() * 35), 50 + Math.floor(sorteio() * 30)]);
  const tally = (id: string | undefined, campo: 'goals' | 'shots') => { if (!id) return; const s = (jogo.stats[id] ??= { goals: 0, shots: 0 }); s[campo] += 1; };
  const marcarGol = (lado: 'home' | 'away', autor: string | undefined) => { jogo.placar[lado === 'home' ? 0 : 1] += 1; tally(autor, 'goals'); tally(autor, 'shots'); };
  // O estado no COMEÇO do plano novo (`estadoAte`, a mesma função do QuickPlanPlayer):
  // os lances entre o comando e o início ainda vão acontecer, do plano antigo.
  const estadoDoAparelho = (m: number, inicio: number) => {
    const e = estadoAte(events, jogo.escolhas, inicio);
    return { home_score: e.home_score, away_score: e.away_score, momentum_end: momentum[Math.max(0, m - 1)] ?? 50,
      cards_home: e.cards_home, cards_away: e.cards_away, sent_off_home: e.sent_off_home, sent_off_away: e.sent_off_away };
  };
  const escolhasAgora = (): Escolhas => ({ decisivos: { ...jogo.escolhas.decisivos }, penaltis: { ...jogo.escolhas.penaltis } });

  for (let m = 1; m <= 90; m++) {
    // Os lances do minuto, na ordem — como o tick do QuickPlanPlayer.
    while (idx < events.length && events[idx]!.minute === m) {
      const e = events[idx]!; idx++;
      const base = e.kind.replace(/_(home|away)$/, '');
      const lance = lanceDe(e);
      if (base === 'goal') {
        if (e.decisivo) {
          const opcoes = Object.keys(e.decisivo.opcoes);
          // 70% escolhe; 30% deixa o prazo estourar (escolha automática — a custódia conhece a regra).
          if (sorteio() < 0.7) jogo.escolhas.decisivos[String(e.minute)] = opcoes[Math.floor(sorteio() * opcoes.length)]!;
        }
        if (lance && golDoLance(lance, jogo.escolhas)) marcarGol(e.actor_side, e.actor_id);
      } else if (base === 'penalty') {
        if (e.actor_side === 'home') {
          const tabela = e.penalti?.por_batedor ?? {};
          const candidatos = [...titulares, ...banco].filter((id) => id in tabela);
          if (candidatos.length && sorteio() < 0.8) jogo.escolhas.penaltis[String(e.minute)] = candidatos[Math.floor(sorteio() * candidatos.length)]!;
          const batedor = jogo.escolhas.penaltis[String(e.minute)] ?? e.penalti?.batedor ?? e.actor_id;
          if (lance && golDoLance(lance, jogo.escolhas)) marcarGol('home', batedor);
        } else if (lance && golDoLance(lance, jogo.escolhas)) marcarGol('away', e.actor_id);
      } else if (base === 'shot' || base === 'chance' || base === 'woodwork') {
        tally(e.actor_id, 'shots');
      } else if (base === 'yellow') {
        jogo.cartoes[e.actor_side] += 1;
      } else if (base === 'red') {
        jogo.expulsos[e.actor_side] += 1;
      }
    }
    // Comando de estilo → replan a partir de m+3 (no 1º tempo, nunca depois do 45').
    if (minutosDeComando.has(m)) {
      const inicio = m + 3;
      if (!((m <= 45 && inicio > 45) || inicio > 90)) {
        comandos.push({ minuto: m, tipo: 'estilo', estilo: ESTILOS[Math.floor(sorteio() * ESTILOS.length)] });
        const declaradas = escolhasAgora();
        // O servidor deriva o estado da custódia e confere com o do aparelho.
        const doServidor = estadoNoMinuto(jogo.resumos, declaradas, 'from_minute', inicio);
        const doAparelho = estadoDoAparelho(m, inicio);
        jogo.estadosConferidos++;
        if (JSON.stringify(doServidor) !== JSON.stringify(doAparelho)) jogo.estadosDivergentes.push(`${m}': servidor ${JSON.stringify(doServidor)} ≠ aparelho ${JSON.stringify(doAparelho)}`);
        const novo = await motor.pedir<MatchPlan>({ ...entrada, mode: 'from_minute', from_minute: inicio, estado: doServidor, comandos });
        jogo.resumos.push(resumirPlano(novo, titulares, { banco, escolhasDeclaradas: declaradas, estadoFonte: 'custodia' }));
        const emenda = emendarEventos(events, idx, m, novo);
        if (!emenda) throw new Error(`replan do ${inicio}' não emendou`);
        events = emenda.events;
        momentum = [...momentum.slice(0, inicio - 1), ...novo.momentum_curve];
        jogo.replans++;
      }
    }
    // Intervalo → replan do 2º tempo (sempre, como na Rápida).
    if (m === 45) {
      const declaradas = escolhasAgora();
      const doServidor = estadoNoMinuto(jogo.resumos, declaradas, 'second_half', 46);
      const doAparelho = estadoDoAparelho(45, 46);
      jogo.estadosConferidos++;
      if (JSON.stringify(doServidor) !== JSON.stringify(doAparelho)) jogo.estadosDivergentes.push(`45': servidor ${JSON.stringify(doServidor)} ≠ aparelho ${JSON.stringify(doAparelho)}`);
      const h2 = await motor.pedir<MatchPlan>({ ...entrada, mode: 'second_half', first_half: doServidor, comandos });
      jogo.resumos.push(resumirPlano(h2, titulares, { banco, escolhasDeclaradas: declaradas, estadoFonte: 'custodia' }));
      const emenda = emendarEventos(events, idx, 45, h2);
      if (!emenda) throw new Error('replan do intervalo não emendou');
      events = emenda.events;
      momentum = [...momentum.slice(0, 45), ...h2.momentum_curve];
      jogo.replans++;
    }
  }
  return jogo;
}

async function main() {
  const motor = new Motor();
  const N = Number(process.env.N ?? 200);
  let validas = 0, suspeitasForjadas = 0, estados = 0, divergentes: string[] = [], replans = 0, gols = 0, decisivos = 0, penaltis = 0;
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const j = await jogar(motor, i);
    replans += j.replans; estados += j.estadosConferidos; divergentes.push(...j.estadosDivergentes.map((d) => `partida ${i} ${d}`));
    gols += j.placar[0] + j.placar[1]; decisivos += Object.keys(j.escolhas.decisivos).length; penaltis += Object.keys(j.escolhas.penaltis).length;
    const ovr = ovrDe(atributosCompletos(ATTRS, 'ATA'), 'ATA');
    const jogadores = Object.entries(j.stats).filter(([id]) => !id.startsWith('away-')).map(([id, s]) => ({ id, pos: 'ATA', attrsAntes: ATTRS, gols: s.goals, chutes: s.shots, nota: notaDaPartida(ovr, s.goals, s.shots) }));
    const v = validarRelato({ placar: j.placar, escolhas: j.escolhas, jogadores }, j.resumos);
    if (v.custodia === 'valida' && v.placar[0] === j.placar[0] && v.placar[1] === j.placar[1]) validas++;
    else if (validas + 3 > i) console.log(`  partida ${i}: ${v.custodia} ${v.placar.join('x')} vs aparelho ${j.placar.join('x')} — ${v.motivos.join('; ')}`);
    // Forjado: um gol a mais pra casa.
    const forjado = validarRelato({ placar: [j.placar[0] + 1, j.placar[1]], escolhas: j.escolhas, jogadores }, j.resumos);
    if (forjado.custodia === 'suspeita') suspeitasForjadas++;
  }
  motor.fechar();
  console.log(`\n${N} partidas em ${((Date.now() - t0) / 1000).toFixed(1)} s · ${gols} gols · ${decisivos} momentos decisivos escolhidos · ${penaltis} batedores escolhidos · ${replans} replans`);
  confere(validas === N, `placar e números por jogador do aparelho == recalculados pela custódia em ${validas}/${N} partidas`);
  confere(divergentes.length === 0, `estado derivado pelo servidor == estado do aparelho em ${estados - divergentes.length}/${estados} replans${divergentes.length ? '\n    ' + divergentes.slice(0, 3).join('\n    ') : ''}`);
  confere(suspeitasForjadas === N, `placar forjado (um gol a mais) cai em suspeita em ${suspeitasForjadas}/${N}`);
  console.log(`\n${falhas ? '🔴' : '🟢'} ${oks} passaram, ${falhas} falharam`);
  process.exit(falhas ? 1 : 0);
}

void main();
