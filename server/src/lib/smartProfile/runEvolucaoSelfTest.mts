/**
 * Evolução por partida: o servidor faz a MESMA conta que o celular?
 *   npm run test:evolucao
 */
import { applyMatchPerformanceEvolution, clampPlayerToEvolutionCap, ensureMintOverall } from '../../../../src/entities/playerEvolution.ts';
import { styleAttrWeights } from '../../../../src/tactics/styleAttrWeights.ts';
import { STYLE_PRESETS } from '../../../../src/tactics/playingStyle.ts';
import { evoluirPorPartida, pesosValidos, type Resultado } from './evolucao.js';
import { atributosCompletos } from './derivar.js';
import { compararPartida, lerRelato, resultadoDe } from './sombra.js';

let ok = 0, falhou = 0;
const check = (nome: string, cond: boolean, extra = '') => {
  if (cond) { ok++; console.log(`  ✅ ${nome}`); } else { falhou++; console.log(`  ❌ ${nome} ${extra}`); }
};

let semente = 777;
const rnd = () => ((semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648);
const escolher = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!;
const POS = ['GOL', 'ZAG', 'LD', 'LE', 'VOL', 'MC', 'MEI', 'PE', 'PD', 'ATA', 'CA'];
const NUCLEO = ['passe', 'marcacao', 'velocidade', 'drible', 'finalizacao', 'fisico', 'tatico', 'mentalidade', 'confianca', 'fairPlay'];
const PRESETS = Object.values(STYLE_PRESETS);

console.log('\n⚽ evolução por partida: servidor × celular\n');
let divergeAttrs = 0, divergeXp = 0;
const exemplos: string[] = [];
const N = 20000;
for (let i = 0; i < N; i++) {
  const pos = escolher(POS);
  const attrs = Object.fromEntries(NUCLEO.map((k) => [k, Math.round(36 + rnd() * 62)]));
  const comMint = rnd() < 0.7;
  const criado = rnd() < 0.1;
  const taxa = rnd() < 0.3 ? null : 0.25 + rnd() * 2.75;
  const player: any = ensureMintOverall({
    id: `p${i}`, num: 1, name: 'X', pos, archetype: 'profissional', zone: 'meio', behavior: 'equilibrado',
    attrs, fatigue: 0, injuryRisk: 0, evolutionXp: Math.round(rnd() * 400), outForMatches: 0,
    ...(comMint ? { mintOverall: 45 + Math.round(rnd() * 40) } : {}),
    ...(criado ? { managerCreated: true } : {}),
    ...(taxa != null ? { evolutionRate: taxa } : {}),
  } as any);
  if (!comMint) delete player.mintOverall; // simula save legado sem OVR de nascimento
  const linha = rnd() < 0.05 ? undefined : {
    rating: 5 + rnd() * 4.9,
    passesOk: rnd() < 0.8 ? 0 : Math.round(rnd() * 30),
    passesAttempt: rnd() < 0.8 ? 0 : Math.round(rnd() * 40),
    tackles: rnd() < 0.8 ? 0 : Math.round(rnd() * 8),
    km: rnd() < 0.8 ? 0 : rnd() * 13,
  };
  if (linha && linha.passesOk > linha.passesAttempt) linha.passesOk = linha.passesAttempt;
  const resultado = escolher(['win', 'draw', 'loss'] as Resultado[]);
  const estilo = rnd() < 0.15 ? undefined : styleAttrWeights(escolher(PRESETS));
  const leitura = rnd() < 0.5 ? 0 : Math.round(rnd() * 3) * 3;

  // Celular: a mesma sequência de creditQuickPlan.
  let cel: any = applyMatchPerformanceEvolution(player, linha, resultado, false, estilo);
  cel = { ...cel, evolutionXp: (cel.evolutionXp ?? 0) + leitura };
  cel = clampPlayerToEvolutionCap(ensureMintOverall(cel));

  const srv = evoluirPorPartida(
    { posicao: pos, atributos: atributosCompletos(player.attrs, pos), xp: player.evolutionXp ?? 0,
      taxaEvolucao: player.evolutionRate ?? null, ovrNascimento: player.mintOverall ?? null, criadoPeloManager: !!player.managerCreated },
    linha, resultado, pesosValidos(estilo), leitura,
  );
  const difere = NUCLEO.concat(['cabeceio', 'bolaParada', 'penalti']).filter((k) => (srv.atributos as any)[k] !== cel.attrs[k]);
  if (difere.length) { divergeAttrs++; if (exemplos.length < 3) exemplos.push(`${pos} ${difere.map((k) => `${k} srv ${(srv.atributos as any)[k]} cel ${cel.attrs[k]}`).join(', ')}`); }
  if (srv.xp !== cel.evolutionXp) divergeXp++;
}
check(`${N.toLocaleString('pt-BR')} partidas sorteadas: atributos idênticos`, divergeAttrs === 0, `(${divergeAttrs}; ${exemplos.join(' | ')})`);
check('XP idêntico', divergeXp === 0, `(${divergeXp})`);

console.log('\n🛡️  pesos do estilo vindos do celular\n');
check('peso negativo, >1, NaN ou texto é descartado', JSON.stringify(pesosValidos({ passe: -1, drible: 2, tatico: NaN, fisico: 'x', marcacao: 0.4 })) === '{"marcacao":0.4}');
check('sem pesos = sem estilo', pesosValidos(null) === undefined);

console.log('\n🌗 modo sombra\n');
{
  check('placar maior vence; empate vai aos pênaltis', resultadoDe([2, 1], null) === 'win' && resultadoDe([1, 1], 'home') === 'win' && resultadoDe([1, 1], 'away') === 'loss' && resultadoDe([0, 0], null) === 'draw');
  // Relato honesto: o "depois" é exatamente o que o celular calcularia.
  const attrs = Object.fromEntries(NUCLEO.map((k) => [k, 70]));
  const pl: any = ensureMintOverall({ id: 'genesis-x', num: 9, name: 'X', pos: 'ATA', archetype: 'profissional', zone: 'ataque', behavior: 'equilibrado', attrs, fatigue: 0, injuryRisk: 0, evolutionXp: 10, outForMatches: 0, mintOverall: 70 } as any);
  const linha = { rating: 8.4, passesOk: 0, passesAttempt: 0, tackles: 0, km: 0 };
  const estilo = styleAttrWeights(PRESETS[0]);
  let cel: any = applyMatchPerformanceEvolution(pl, linha, 'win', false, estilo);
  cel = clampPlayerToEvolutionCap(ensureMintOverall({ ...cel, evolutionXp: cel.evolutionXp + 6 }));
  const corpo = { seed: 's1', placar: [2, 0], penaltis: null, leitura: 2, estilo,
    jogadores: [{ id: 'genesis-x', pos: 'ATA', antes: { attrs: pl.attrs, xp: 10, ovrNascimento: 70, taxa: 1, criadoPeloManager: false }, linha, depois: { attrs: cel.attrs, xp: cel.evolutionXp } }] };
  const honesto = compararPartida(lerRelato(corpo)!, new Map([['genesis-x', { atributos: atributosCompletos(pl.attrs, 'ATA') }]]));
  check('relato honesto: zero divergência', honesto.divergencias === 0 && honesto.antes_diferente === 0, JSON.stringify(honesto.detalhes));
  const inflado = JSON.parse(JSON.stringify(corpo)); inflado.jogadores[0].depois.attrs.finalizacao += 5;
  check('celular que infla um atributo é pego', compararPartida(lerRelato(inflado)!, new Map()).divergencias === 1);
  const outraBase = compararPartida(lerRelato(corpo)!, new Map([['genesis-x', { atributos: { ...atributosCompletos(pl.attrs, 'ATA'), passe: 50 } }]]));
  check('"antes" diferente da ficha do servidor é marcado', outraBase.antes_diferente === 1);
  check('relato fora do formato é recusado', lerRelato({ seed: 'x', placar: [1], jogadores: [] }) === null && lerRelato({ ...corpo, placar: [-1, 0] }) === null);
}

console.log(`\n${falhou === 0 ? '🟢' : '🔴'} ${ok} passaram, ${falhou} falharam`);
process.exit(falhou === 0 ? 0 : 1);
