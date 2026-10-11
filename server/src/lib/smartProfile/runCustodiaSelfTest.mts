/**
 * Custódia do plano — UMA VERDADE SÓ (Fase 0).   npm run test:custodia
 *
 * O placar e os números de cada titular têm de ser EXATAMENTE o que os planos
 * emitidos decidiram dadas as escolhas relatadas.
 */
import { estadoNoMinuto, lancesDaPartida, notaDaPartida, resumirPlano, validarRelato, type JogadorRelatado } from './custodia.js';
import { contarPartida, costurar, escolhaAutomatica, escolhasVazias, golDoLance, lanceDoEvento } from '../partida/placar.js';
import { matchRating } from '../../../../src/match/QuickPlanPlayer.tsx';
import { ovrDe } from './ovr.js';
import { atributosCompletos } from './derivar.js';

let ok = 0, falhou = 0;
const check = (nome: string, cond: boolean, extra = '') => {
  if (cond) { ok++; console.log(`  ✅ ${nome}`); } else { falhou++; console.log(`  ❌ ${nome} ${extra}`); }
};

const ev = (kind: string, minute: number, actor?: string, extra: Record<string, unknown> = {}) => ({ kind, minute, actor_id: actor, ...extra });
const decisivo = (opcoes: Record<string, boolean>, por_opcao: Record<string, [number, number]>, melhor = 'chutar') =>
  ({ intent: 'attack', contexto: 'sobrou_limpa', melhor, rival: 'goleiro', duelo: { nosso: { id: 'ata', nome: 'A' }, deles: { id: 'x1', nome: 'G' }, por_opcao }, opcoes });

const plano1 = {
  mode: 'full', start_minute: 1,
  momentum_curve: Array.from({ length: 90 }, (_, i) => 50 + (i % 10)),
  events: [
    ev('buildup_home', 3, 'mc'), ev('shot_home', 12, 'ata'),
    // Gol com momento decisivo: chutar faz, driblar perde, tocar faz.
    ev('goal_home', 20, 'ata', { decisivo: decisivo({ chutar: true, driblar: false, tocar: true }, { chutar: [80, 60], driblar: [72, 60], tocar: [70, 60] }) }),
    ev('yellow_home', 30, 'zag'),
    // Gol deles: cercar segura, carrinho não, combate segura.
    ev('goal_away', 38, 'x9', { decisivo: { intent: 'defend', contexto: 'protege_a_bola', melhor: 'cercar', rival: 'zagueiro', duelo: { nosso: { id: 'zag', nome: 'Z' }, deles: { id: 'x9', nome: 'X' }, por_opcao: { cercar: [60, 72], carrinho: [75, 75], combate: [70, 60] } }, opcoes: { cercar: false, carrinho: true, combate: false } } }),
    ev('chance_home', 41, 'pe'),
    // Gol sem bloco (plano antigo): vale direto.
    ev('goal_home', 60, 'ata'),
    // Pênalti da casa: o sugerido (ata) perde; o zagueiro converte.
    ev('penalty_home', 70, 'ata', { penalti: { batedor: 'ata', por_batedor: { ata: false, zag: true, mc: false, pe: true, pd: false, banco1: true } } }),
    ev('save_away', 80, 'x9'), ev('corner_home', 85, 'pd'),
    // Pênalti deles: o motor decidiu gol.
    ev('penalty_away', 88, 'x9', { penalti: { batedor: 'x9', gol: true } }),
  ],
};
const escalacao = ['gol', 'zag', 'mc', 'pe', 'pd', 'ata'];
const resumo = resumirPlano(plano1, escalacao, { banco: ['banco1'] });
const attrs = { passe: 70, marcacao: 60, velocidade: 75, drible: 72, finalizacao: 80, fisico: 70, tatico: 60, mentalidade: 65, confianca: 70, fairPlay: 70 };
const notaHonesta = (pos: string, g: number, c: number) => notaDaPartida(ovrDe(atributosCompletos(attrs, pos), pos), g, c);
const honesto = (id: string, g: number, c: number, pos = 'ATA'): JogadorRelatado => ({ id, pos, attrsAntes: attrs, gols: g, chutes: c, nota: notaHonesta(pos, g, c) });
const esc = (decisivos: Record<string, string>, penaltis: Record<string, string> = {}) => ({ decisivos, penaltis });

console.log('\n📋 resumo do plano\n');
check('guarda os lances que contam (gol, pênalti, chute, chance, trave, defesa, cartão) com o que decide', resumo.lances.length === 9
  && resumo.lances.find((l) => l.m === 20)?.decisivo?.opcoes.driblar === false
  && resumo.lances.find((l) => l.m === 70)?.penalti?.por_batedor?.zag === true
  && resumo.lances.find((l) => l.m === 88)?.penalti?.gol === true);
check('guarda a escalação e o banco', resumo.escalacao.join(',') === escalacao.join(',') && resumo.banco?.[0] === 'banco1');
check('guarda a curva de momento', resumo.momentum?.length === 90 && resumo.momentum[44] === 54);
check('nota do servidor = nota do celular (matchRating)', [[60, 0, 0], [83, 2, 5], [41, 0, 1], [99, 4, 9]].every(([o, g, c]) => notaDaPartida(o!, g!, c!) === matchRating(o!, { goals: g!, shots: c! })));

console.log('\n⚽ o placar é função das escolhas\n');
{
  const { lances } = costurar([resumo]);
  const conta = (d: Record<string, string>, p: Record<string, string> = {}) => contarPartida(lances, esc(d, p)).placar.join('x');
  check('leitura certa no 20\' + cercar no 38\' + batedor sugerido: 2x1', conta({ '20': 'chutar', '38': 'cercar' }) === '2x1');
  check('driblar no 20\' perde o gol: 1x1', conta({ '20': 'driblar', '38': 'cercar' }) === '1x1');
  check('carrinho no 38\' sofre o gol: 2x2', conta({ '20': 'chutar', '38': 'carrinho' }) === '2x2');
  check('zagueiro bate o pênalti e converte: 3x1', conta({ '20': 'chutar', '38': 'cercar' }, { '70': 'zag' }) === '3x1');
  check('reserva do banco bate e converte: 3x1', conta({ '20': 'chutar', '38': 'cercar' }, { '70': 'banco1' }) === '3x1');
  check('batedor fora da tabela → vale o sugerido (perde): 2x1', conta({ '20': 'chutar', '38': 'cercar' }, { '70': 'ninguem' }) === '2x1');
  check('sem escolha → a automática (maior vantagem): chutar 80×60 faz; combate 70×60 segura → 2x1', conta({}) === '2x1'
    && escolhaAutomatica(lances.find((l) => l.m === 20)!.decisivo!) === 'chutar' && escolhaAutomatica(lances.find((l) => l.m === 38)!.decisivo!) === 'combate');
  const c = contarPartida(lances, esc({ '20': 'chutar', '38': 'cercar' }, { '70': 'zag' }));
  check('gols e finalizações por jogador (ata: 2 gols, 3 finalizações; zag: 1 e 1; pe: 0 e 1)', c.gols.ata === 2 && c.chutes.ata === 3 && c.gols.zag === 1 && c.chutes.zag === 1 && !c.gols.pe && c.chutes.pe === 1);
  check('cartões e expulsos contados', c.cartoes.home === 1 && c.expulsos.home === 0);
  check('golDoLance de lance que não é gol é falso', golDoLance(lanceDoEvento(ev('shot_home', 12, 'ata'))!, escolhasVazias()) === false);
}

console.log('\n⏱️  dois tempos e replans de comando\n');
{
  const segundo = resumirPlano({ mode: 'second_half', start_minute: 46, momentum_curve: Array(45).fill(60), events: [ev('goal_home', 50, 'pd'), ev('shot_away', 70, 'x9')] }, escalacao);
  const juntos = lancesDaPartida([resumo, segundo]);
  check('1º tempo do plano original + 2º tempo do replano', juntos.length === 7 && juntos.some((l) => l.a === 'pd' && l.m === 50) && !juntos.some((l) => l.m === 60));
  const cmd1 = resumirPlano({ mode: 'from_minute', start_minute: 23, events: [ev('goal_home', 30, 'pd'), ev('shot_home', 60, 'ata')] }, escalacao, { escolhasDeclaradas: esc({ '20': 'chutar' }), estadoFonte: 'custodia' });
  const intervalo = resumirPlano({ mode: 'second_half', start_minute: 46, events: [ev('shot_home', 50, 'mc'), ev('goal_home', 75, 'mc')] }, escalacao, { escolhasDeclaradas: esc({ '20': 'chutar' }) });
  const cmd2 = resumirPlano({ mode: 'from_minute', start_minute: 67, events: [ev('goal_home', 80, 'ata')] }, escalacao, { escolhasDeclaradas: esc({ '20': 'chutar' }) });
  check('replan de comando é arquivado como from_minute, com as escolhas declaradas', cmd1.modo === 'from_minute' && cmd1.minutoInicial === 23 && cmd1.escolhas_declaradas?.decisivos['20'] === 'chutar');
  const costura = lancesDaPartida([resumo, cmd1, intervalo, cmd2]);
  check('cada replan manda do minuto dele em diante',
    !costura.some((l) => l.m >= 23 && l.m < 46 && !cmd1.lances.includes(l))
    && !costura.some((l) => l.m === 60) && !costura.some((l) => l.m === 75) && costura.some((l) => l.m === 80 && l.a === 'ata'));
  const v = validarRelato({ placar: [3, 0], escolhas: esc({ '20': 'chutar' }), jogadores: [honesto('pd', 1, 1, 'PD'), honesto('ata', 2, 3)] }, [resumo, cmd1, intervalo, cmd2]);
  check('placar honesto costurado de 4 planos → válida', v.custodia === 'valida' && v.placar.join('x') === '3x0', v.motivos.join('; '));
  const v2 = validarRelato({ placar: [2, 0], escolhas: esc({ '20': 'driblar' }), jogadores: [honesto('pd', 1, 1, 'PD'), honesto('ata', 1, 3)] }, [resumo, cmd1, intervalo, cmd2]);
  check('escolha do relato diferente da declarada no replan → suspeita', v2.custodia === 'suspeita' && v2.motivos.some((m) => m.includes('declarou')));
}

console.log('\n🧭 estado do replan derivado da custódia\n');
{
  const e46 = estadoNoMinuto([resumo], esc({ '20': 'chutar', '38': 'carrinho' }), 'second_half', 46);
  check('no intervalo: 1x1, 1 amarelo da casa, momento do 45\'', e46.home_score === 1 && e46.away_score === 1 && e46.cards_home === 1 && e46.momentum_end === 54);
  const e73 = estadoNoMinuto([resumo], esc({ '20': 'chutar', '38': 'cercar' }, { '70': 'zag' }), 'from_minute', 73);
  check('no 73\' (comando no 70\'): 3x0, momento do 70\'', e73.home_score === 3 && e73.away_score === 0 && e73.momentum_end === 59);
  const e40 = estadoNoMinuto([resumo], esc({ '20': 'chutar' }), 'from_minute', 40);
  check('no 40\': o gol deles do 38\' ainda não tem escolha → automática (combate segura): 1x0', e40.home_score === 1 && e40.away_score === 0);
}

console.log('\n✅ relato honesto\n');
{
  const v = validarRelato({ placar: [3, 1], escolhas: esc({ '20': 'chutar', '38': 'cercar' }, { '70': 'zag' }), jogadores: [honesto('ata', 2, 3), honesto('zag', 1, 1, 'ZAG'), honesto('mc', 0, 0, 'MC')] }, [resumo]);
  check('placar, gols, finalizações e notas exatos → válida', v.custodia === 'valida', v.motivos.join('; '));
  const vb = validarRelato({ placar: [3, 1], escolhas: esc({ '20': 'chutar', '38': 'cercar' }, { '70': 'banco1' }), jogadores: [honesto('ata', 2, 3), honesto('banco1', 1, 1)] }, [resumo]);
  check('reserva do banco que entrou e converteu o pênalti → válida', vb.custodia === 'valida', vb.motivos.join('; '));
}

console.log('\n🚨 relato forjado\n');
{
  const escolhas = esc({ '20': 'chutar', '38': 'cercar' });
  const v1 = validarRelato({ placar: [9, 0], escolhas, jogadores: [honesto('ata', 2, 3)] }, [resumo]);
  check('placar diferente do recalculado → suspeita', v1.custodia === 'suspeita' && v1.motivos.some((m) => m.includes('placar relatado')));
  const v2 = validarRelato({ placar: [2, 1], escolhas, jogadores: [honesto('gol', 2, 2, 'GOL')] }, [resumo]);
  check('gol creditado a quem não marcou → suspeita', v2.custodia === 'suspeita' && v2.motivos.some((m) => m.includes('gol(s) relatado')));
  const v3 = validarRelato({ placar: [2, 1], escolhas, jogadores: [{ ...honesto('ata', 2, 3), nota: 9.9 }] }, [resumo]);
  check('nota inflada → suspeita', v3.custodia === 'suspeita' && v3.motivos.some((m) => m.includes('nota')));
  const v4 = validarRelato({ placar: [2, 1], escolhas, jogadores: [honesto('craque-de-fora', 0, 0)] }, [resumo]);
  check('jogador fora da escalação enviada ao motor → suspeita', v4.custodia === 'suspeita');
  const v5 = validarRelato({ placar: [2, 1], escolhas: esc({ '20': 'voadora', '38': 'cercar' }), jogadores: [honesto('ata', 2, 4)] }, [resumo]);
  check('escolha que o lance não oferecia → suspeita', v5.custodia === 'suspeita' && v5.motivos.some((m) => m.includes('não existia')));
  const v6 = validarRelato({ placar: [2, 1], escolhas, jogadores: [honesto('ata', 2, 2)] }, [resumo]);
  check('finalizações a menos → suspeita', v6.custodia === 'suspeita' && v6.motivos.some((m) => m.includes('finalização')));
  // O gol "salvo" no momento decisivo não pode voltar: 2x1 com driblar seria 1x1.
  const v7 = validarRelato({ placar: [2, 1], escolhas: esc({ '20': 'driblar', '38': 'cercar' }), jogadores: [honesto('ata', 2, 3)] }, [resumo]);
  check('gol perdido no momento decisivo não volta pelo relato → suspeita', v7.custodia === 'suspeita');
}

console.log(`\n${falhou === 0 ? '🟢' : '🔴'} ${ok} passaram, ${falhou} falharam`);
process.exit(falhou === 0 ? 0 : 1);
