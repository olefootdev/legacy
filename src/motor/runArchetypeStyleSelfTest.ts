/**
 * Cada arquétipo faz o que promete?
 * npm run test:arquetipos
 *
 * É o teste que dá lastro à proposta das lendas. Se o estilo declarado não
 * mudar o comportamento, os 54 arquétipos são etiqueta cosmética — que foi
 * exatamente o que sempre foram no motor antigo, onde nunca executaram uma
 * linha em nenhuma partida.
 *
 * ── Método ───────────────────────────────────────────────────────────────────
 * Troca UM arquétipo por vez, mantendo todo o resto — inclusive os atributos —
 * rigorosamente idêntico, e cobra a medida que AQUELE arquétipo declara mudar.
 *
 * Comparar "time de posse" contra "time direto" não serve: um time inteiro
 * trocado move dez coisas ao mesmo tempo e não se sabe qual causou o quê. Foi
 * assim que a primeira versão deste teste produziu resultados contra a
 * intuição — um time de armadores joga MAIS vertical, não menos, porque
 * armador é justamente quem procura o passe que quebra linha.
 */
import { MotorEngine, defaultAttrs, type MotorPlayerInput } from './MotorEngine';
import { defaultArchetypeForSlot } from './archetypeWeights';

const SEEDS = [404_413, 777_001, 190_277];

const SLOTS: Array<[string, MotorPlayerInput['role']]> = [
  ['gol', 'gk'], ['zag1', 'def'], ['zag2', 'def'], ['le', 'def'], ['ld', 'def'],
  ['vol', 'mid'], ['mc1', 'mid'], ['mc2', 'mid'],
  ['pe', 'attack'], ['ata', 'attack'], ['pd', 'attack'],
];

function team(side: 'home' | 'away', trocas: Record<string, string>): MotorPlayerInput[] {
  return SLOTS.map(([slot, role], i) => ({
    id: `${side}-${slot}`,
    side,
    slotId: slot,
    role,
    shirtNumber: i + 1,
    attrs: defaultAttrs(),
    tacticalArchetypeId: trocas[slot] ?? defaultArchetypeForSlot(slot),
  }));
}

interface Medida {
  nome: string;
  /** Arquétipos do time A e do time B, e em quais slots. */
  a: Record<string, string>;
  b: Record<string, string>;
  /** O que aquele arquétipo declara mudar. */
  metrica: string;
  /**
   * Como ler. `equipe` usa as estatísticas agregadas do lado; `jogador` amostra
   * a POSIÇÃO do próprio jogador ao longo da partida.
   *
   * A distinção não é detalhe: medir o avanço médio dos toques DO TIME para
   * julgar um centroavante deu resultado invertido, porque um time com camisa 9
   * de área segura a bola mais à frente — o time avança mais justamente por
   * causa do arquétipo que NÃO avança.
   */
  escopo: 'equipe' | 'jogador' | 'passesDoJogador';
  /** Slots amostrados quando o escopo é `jogador`. */
  slots?: string[];
  ler: (s: any) => number;
  /** Quanto A tem que superar B. */
  minimo: number;
  unidade: string;
}

const MEDIDAS: Medida[] = [
  {
    nome: 'ponta de linha × ponta que corta',
    a: { pe: 'WINGER_CLASSIC', pd: 'WINGER_CLASSIC' },
    b: { pe: 'WINGER_INVERTED', pd: 'WINGER_INVERTED' },
    metrica: 'distância média do meio (o próprio ponta)',
    escopo: 'jogador',
    slots: ['pe', 'pd'],
    ler: (s) => s.lateral,
    minimo: 1.0,
    unidade: 'm',
  },
  {
    nome: 'centroavante de profundidade × de área',
    a: { ata: 'ST_FINISHER' },
    b: { ata: 'ST_TARGET' },
    metrica: 'avanço médio (o próprio centroavante)',
    escopo: 'jogador',
    slots: ['ata'],
    ler: (s) => s.avanco,
    minimo: 0.8,
    unidade: 'm',
  },
  {
    nome: 'volante armador × volante de contenção',
    a: { vol: 'DM_PLAYMAKER' },
    b: { vol: 'DM_ANCHOR' },
    metrica: 'passes verticais DO PRÓPRIO volante',
    escopo: 'passesDoJogador',
    slots: ['vol'],
    ler: (s) => (s.passesForward / Math.max(1, s.passes)) * 100,
    minimo: 0.5,
    unidade: 'p.p.',
  },
  {
    nome: 'zagueiro que sai jogando × zagueiro de marcação',
    a: { zag1: 'CB_BALL_PLAYING', zag2: 'CB_BALL_PLAYING' },
    b: { zag1: 'CB_DEFENDER', zag2: 'CB_DEFENDER' },
    metrica: 'passes verticais DOS PRÓPRIOS zagueiros',
    escopo: 'passesDoJogador',
    slots: ['zag1', 'zag2'],
    ler: (s) => (s.passesForward / Math.max(1, s.passes)) * 100,
    minimo: 1.0,
    unidade: 'p.p.',
  },
];

/** Amostra a posição dos slots pedidos ao longo da partida. */
interface Amostra { avanco: number; lateral: number; }
function amostrar(engine: MotorEngine, side: 'home' | 'away', slots: string[]): Amostra {
  const snap = engine.snapshot();
  const ids = slots.map((s) => `${side}-${s}`);
  const ps = snap.players.filter((p) => ids.includes(p.id));
  if (ps.length === 0) return { avanco: 0, lateral: 0 };
  const ownGoalX = side === 'home' ? 0 : 105;
  return {
    avanco: ps.reduce((s, p) => s + Math.abs(p.x - ownGoalX), 0) / ps.length,
    lateral: ps.reduce((s, p) => s + Math.abs(p.z - 34), 0) / ps.length,
  };
}

function rodar(m: Medida): { a: number; b: number } {
  let somaA = 0;
  let somaB = 0;
  for (let i = 0; i < SEEDS.length; i++) {
    // Alterna os lados para a vantagem de mandante não contaminar.
    const aEmCasa = i % 2 === 0;
    const engine = new MotorEngine(
      team('home', aEmCasa ? m.a : m.b),
      team('away', aEmCasa ? m.b : m.a),
      { seed: SEEDS[i]! },
    );
    const ladoA = aEmCasa ? 'home' : 'away';
    const ladoB = aEmCasa ? 'away' : 'home';
    if (m.escopo === 'jogador') {
      let accA = { avanco: 0, lateral: 0 };
      let accB = { avanco: 0, lateral: 0 };
      let n = 0;
      let k = 0;
      while (!engine.finished) {
        engine.step();
        // Só com a bola rolando: parada empilha jogador em posição de reinício.
        if (k++ % 20 !== 0 || engine.phase !== 'live') continue;
        const a = amostrar(engine, ladoA, m.slots ?? []);
        const b = amostrar(engine, ladoB, m.slots ?? []);
        accA = { avanco: accA.avanco + a.avanco, lateral: accA.lateral + a.lateral };
        accB = { avanco: accB.avanco + b.avanco, lateral: accB.lateral + b.lateral };
        n++;
      }
      const div = Math.max(1, n);
      somaA += m.ler({ avanco: accA.avanco / div, lateral: accA.lateral / div });
      somaB += m.ler({ avanco: accB.avanco / div, lateral: accB.lateral / div });
      continue;
    }
    while (!engine.finished) engine.step();
    if (m.escopo === 'passesDoJogador') {
      const junta = (lado: 'home' | 'away') => {
        const acc = { passes: 0, passesForward: 0 };
        for (const slot of m.slots ?? []) {
          const e = engine.byPlayer.get(`${lado}-${slot}`);
          if (!e) continue;
          acc.passes += e.passes;
          acc.passesForward += e.passesForward;
        }
        return acc;
      };
      somaA += m.ler(junta(ladoA));
      somaB += m.ler(junta(ladoB));
      continue;
    }
    somaA += m.ler(engine.bySide[ladoA]);
    somaB += m.ler(engine.bySide[ladoB]);
  }
  return { a: somaA / SEEDS.length, b: somaB / SEEDS.length };
}

function main(): void {
  console.log(
    `Um arquétipo trocado por vez · ${SEEDS.length} partidas cada · ` +
    `atributos idênticos, lados alternados\n`,
  );
  let falhas = 0;
  for (const m of MEDIDAS) {
    const { a, b } = rodar(m);
    const d = a - b;
    const ok = d >= m.minimo;
    if (!ok) falhas++;
    console.log(`  ${ok ? '✓' : '✗'} ${m.nome}`);
    console.log(
      `      ${m.metrica}: ${a.toFixed(1)} contra ${b.toFixed(1)} · ` +
      `diferença ${d > 0 ? '+' : ''}${d.toFixed(1)} ${m.unidade} (mín. ${m.minimo})\n`,
    );
  }

  if (falhas > 0) {
    console.error(
      `arquetipos: FALHOU — ${falhas} de ${MEDIDAS.length} arquétipos não fazem o que declaram.\n` +
      'Enquanto isso for verdade, "lendas de todas as épocas" não tem no que se\n' +
      'apoiar: a época se expressa por comportamento, não por rótulo.',
    );
    process.exit(1);
  }
  console.log('arquetipos: ok — estilo declarado vira comportamento medido.');
}

main();
