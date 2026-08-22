/**
 * Os atributos mentais decidem partidas?
 * npm run test:mental
 *
 * Coloca dois elencos FISICAMENTE E TECNICAMENTE IDÊNTICOS um contra o outro,
 * mudando só Decisão, Visão de Jogo, Antecipação e Posicionamento. Se o time
 * que lê melhor o jogo não vencer de forma consistente, os atributos mentais
 * são decoração — e a promessa de "lendas com estilos históricos" não se
 * sustenta, porque é justamente aí que ela vive.
 *
 * Tese do gênero, que este teste cobra: um jogador tecnicamente mediano com
 * Decisão e Antecipação altas supera um mais talentoso mal empregado.
 */
import { MotorEngine, defaultAttrs, type MotorPlayerInput, type MotorAttrs } from './MotorEngine';
import { defaultArchetypeForSlot } from './archetypeWeights';

const SEEDS = [404_413, 777_001, 190_277, 515_099, 888_123, 246_810];

const SLOTS: Array<[string, MotorPlayerInput['role']]> = [
  ['gol', 'gk'], ['zag1', 'def'], ['zag2', 'def'], ['le', 'def'], ['ld', 'def'],
  ['vol', 'mid'], ['mc1', 'mid'], ['mc2', 'mid'],
  ['pe', 'attack'], ['ata', 'attack'], ['pd', 'attack'],
];

/** Mentais altos e baixos — todo o resto rigorosamente igual. */
const MENTE_ALTA: Partial<MotorAttrs> = {
  decisao: 88, visaoDeJogo: 88, antecipacao: 88, posicionamento: 88,
};
const MENTE_BAIXA: Partial<MotorAttrs> = {
  decisao: 42, visaoDeJogo: 42, antecipacao: 42, posicionamento: 42,
};

function team(side: 'home' | 'away', mente: Partial<MotorAttrs>): MotorPlayerInput[] {
  return SLOTS.map(([slot, role], i) => ({
    id: `${side}-${slot}`,
    side,
    slotId: slot,
    role,
    shirtNumber: i + 1,
    attrs: defaultAttrs(mente),
    tacticalArchetypeId: defaultArchetypeForSlot(slot),
  }));
}

interface Acc {
  passes: number; passesOk: number; shots: number; xg: number; posse: number; gols: number;
}
const zero = (): Acc => ({ passes: 0, passesOk: 0, shots: 0, xg: 0, posse: 0, gols: 0 });

function main(): void {
  const alta = zero();
  const baixa = zero();

  for (let i = 0; i < SEEDS.length; i++) {
    const seed = SEEDS[i]!;
    // Alterna os lados para a vantagem de mandante não contaminar o resultado.
    const altaEmCasa = i % 2 === 0;
    const engine = new MotorEngine(
      team('home', altaEmCasa ? MENTE_ALTA : MENTE_BAIXA),
      team('away', altaEmCasa ? MENTE_BAIXA : MENTE_ALTA),
      { seed },
    );
    while (!engine.finished) engine.step();

    const A = altaEmCasa ? engine.bySide.home : engine.bySide.away;
    const B = altaEmCasa ? engine.bySide.away : engine.bySide.home;
    const golsA = altaEmCasa ? engine.homeScore : engine.awayScore;
    const golsB = altaEmCasa ? engine.awayScore : engine.homeScore;
    for (const [dst, src, g] of [[alta, A, golsA], [baixa, B, golsB]] as const) {
      dst.passes += src.passes; dst.passesOk += src.passesOk;
      dst.shots += src.shots; dst.xg += src.xg; dst.posse += src.possessionS;
      dst.gols += g as number;
    }
    console.log(
      `seed ${seed}: ${golsA}×${golsB} · passes certos ` +
      `${(A.passesOk / Math.max(1, A.passes) * 100).toFixed(1)}% vs ` +
      `${(B.passesOk / Math.max(1, B.passes) * 100).toFixed(1)}% · ` +
      `xG ${A.xg.toFixed(1)} vs ${B.xg.toFixed(1)}`,
    );
  }

  const pct = (a: Acc) => (a.passesOk / Math.max(1, a.passes)) * 100;
  const posse = (a: Acc, b: Acc) => (a.posse / Math.max(1, a.posse + b.posse)) * 100;

  console.log(`\n${SEEDS.length} partidas · elencos idênticos exceto pelos 4 mentais\n`);
  const linha = (rot: string, a: Acc, b: Acc) => {
    console.log(`  ${rot.padEnd(22)} ${pct(a).toFixed(1)}% certos · ` +
      `${posse(a, b).toFixed(1)}% posse · xG ${a.xg.toFixed(1)} · ` +
      `${a.shots} chutes · ${a.gols} gols`);
  };
  linha('mente alta (88)', alta, baixa);
  linha('mente baixa (42)', baixa, alta);

  // O que se cobra são medidas com CENTENAS de eventos por partida. Gol tem
  // variância alta demais: 6 partidas de ~5 gols não distinguem efeito de sorte.
  const dPasses = pct(alta) - pct(baixa);
  const dPosse = posse(alta, baixa) - 50;
  const dXg = alta.xg - baixa.xg;

  // Os três são portão. Houve um momento em que o acerto de passe aparecia
  // invertido (-18 p.p.) e a explicação plausível — "acerto de passe premia
  // recuo, não qualidade" — quase virou motivo para tirá-lo do critério. Era
  // bug de contagem: companheiro que cortava a bola antes do ponto exato de
  // chegada era contabilizado como passe perdido. Fica o registro, porque
  // afrouxar um critério para o teste passar é o pior erro possível numa
  // régua.
  const okPasses = dPasses > 1.5;
  const okPosse = dPosse > 1.0;
  const okXg = dXg > 3;

  console.log(`\n  ${okPasses ? '✓' : '✗'} acerto de passe    ${dPasses > 0 ? '+' : ''}${dPasses.toFixed(1)} p.p.  (> 1,5)`);
  console.log(`  ${okPosse ? '✓' : '✗'} posse de bola      ${dPosse > 0 ? '+' : ''}${dPosse.toFixed(1)} p.p.  (> 1,0)`);
  console.log(`  ${okXg ? '✓' : '✗'} xG acumulado       ${dXg > 0 ? '+' : ''}${dXg.toFixed(1)}       (> 3)`);
  console.log(`  · gols ${alta.gols} × ${baixa.gols} — informativo, variância alta demais para servir de critério`);

  if (!okPasses || !okPosse || !okXg) {
    console.error(
      '\nmental-impact: FALHOU — os atributos mentais não estão decidindo partidas.\n' +
      'Enquanto isso for verdade, "lendas com estilos históricos" é promessa sem lastro:\n' +
      'é exatamente por Decisão, Visão, Antecipação e Posicionamento que um estilo se expressa.',
    );
    process.exit(1);
  }
  console.log('\nmental-impact: ok — ler o jogo melhor domina a partida.');
}

main();
