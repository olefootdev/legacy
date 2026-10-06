/**
 * Evolução por partida: o servidor faz a MESMA conta que o celular?
 *   npm run test:evolucao
 */
import { applyMatchPerformanceEvolution, clampPlayerToEvolutionCap, ensureMintOverall } from '../../../../src/entities/playerEvolution.ts';
import { styleAttrWeights } from '../../../../src/tactics/styleAttrWeights.ts';
import { STYLE_PRESETS } from '../../../../src/tactics/playingStyle.ts';
import { evoluirPorPartida, pesosValidos, type Resultado } from './evolucao.js';
import { atributosCompletos } from './derivar.js';
import { compararPartida, lerRelato, limitarLinha, resultadoDe } from './sombra.js';
import { ovrDe } from './ovr.js';

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

console.log('\n🏛️  FASE 2C — a conta do servidor VALE e parte da ficha\n');
{
  const ATTRS = { passe: 60, marcacao: 60, velocidade: 60, drible: 60, finalizacao: 60,
    fisico: 60, tatico: 60, mentalidade: 60, confianca: 60, fairPlay: 60 };
  const linha = { rating: 8.5, passesOk: 0, passesAttempt: 0, tackles: 0, km: 0 };
  const jogador = (attrsAntes: Record<string, number>) => ({
    id: 'p1', pos: 'ATA',
    antes: { attrs: attrsAntes, xp: 0, ovrNascimento: null, taxa: 1, criadoPeloManager: false },
    linha, gols: 1, chutes: 2,
    depois: { attrs: attrsAntes, xp: 0 },
  });
  const relato = (attrsAntes: Record<string, number>) => ({
    seed: 's1', placar: [2, 1] as [number, number], penaltis: null, leitura: 0, estilo: undefined,
    planos: [], jogadores: [jogador(attrsAntes)],
  });

  // O CELULAR MENTE: diz que o jogador tinha 95 em tudo. O servidor tem ficha de 60.
  const mentira = { passe: 95, marcacao: 95, velocidade: 95, drible: 95, finalizacao: 95,
    fisico: 95, tatico: 95, mentalidade: 95, confianca: 95, fairPlay: 95 };
  const fichaHonesta = new Map([['p1', { atributos: atributosCompletos(ATTRS, 'ATA') }]]);
  const r = compararPartida(relato(mentira), fichaHonesta);
  const c = r.credito[0]!;
  check('a base é a FICHA, não o "antes" do celular',
    ovrDe(c.atributos, 'ATA') < 70, `ovr creditado ${ovrDe(c.atributos, 'ATA')}`);
  check('a mentira é registrada em antes_diferente', r.antes_diferente === 1);
  check('o crédito vem marcado como vindo da ficha', c.daFicha === true);

  // SEM ficha o servidor não finge autoridade.
  const semFicha = compararPartida(relato(ATTRS), new Map());
  check('sem ficha → daFicha false (o chamador não grava como verdade)', semFicha.credito[0]!.daFicha === false);

  // Honesto: a conta do servidor sobe o jogador de verdade.
  const honesto = compararPartida(relato(ATTRS), fichaHonesta);
  const antesOvr = ovrDe(atributosCompletos(ATTRS, 'ATA'), 'ATA');
  check('nota 8.5 + vitória faz o jogador subir', honesto.credito[0]!.swing > 0
    && ovrDe(honesto.credito[0]!.atributos, 'ATA') >= antesOvr);
  check('XP é creditado', honesto.credito[0]!.xp > 0);
  check('um crédito por jogador relatado', honesto.credito.length === 1);
}

console.log('\n✂️  teto na linha da partida (o swing não é do cliente)\n');
{
  const absurdo = { rating: 99, passesOk: 500, passesAttempt: 400, tackles: 99, km: 999 };
  const { linha, cortou } = limitarLinha(absurdo);
  check('nota tem teto 10', linha!.rating === 10);
  check('km tem teto 14', linha!.km === 14);
  check('desarmes têm teto 15', linha!.tackles === 15);
  check('passes certos nunca passam das tentativas', linha!.passesOk <= linha!.passesAttempt);
  check('o corte é sinalizado', cortou === true);
  const honesta = { rating: 7.2, passesOk: 0, passesAttempt: 0, tackles: 0, km: 0 };
  const r2 = limitarLinha(honesta);
  // Campo a campo: `limitarLinha` reconstrói o objeto, então a ORDEM das chaves
  // muda e um JSON.stringify compararia a ordem, não os números.
  check('a linha que o jogo manda de verdade passa intacta',
    !r2.cortou && r2.linha!.rating === 7.2 && r2.linha!.km === 0 && r2.linha!.tackles === 0
    && r2.linha!.passesOk === 0 && r2.linha!.passesAttempt === 0,
    JSON.stringify(r2));
  check('sem linha → sem linha (não inventa)', limitarLinha(undefined).linha === undefined);
}

console.log(`\n${falhou === 0 ? '🟢' : '🔴'} ${ok} passaram, ${falhou} falharam`);
process.exit(falhou === 0 ? 0 : 1);
