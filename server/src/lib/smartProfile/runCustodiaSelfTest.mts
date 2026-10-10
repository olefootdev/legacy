/**
 * Custódia do plano (Fase 2B).   npm run test:custodia
 */
import { lancesDaPartida, notaDaPartida, resumirPlano, validarRelato, type JogadorRelatado } from './custodia.js';
import { matchRating } from '../../../../src/match/QuickPlanPlayer.tsx';
import { ovrDe } from './ovr.js';
import { atributosCompletos } from './derivar.js';

let ok = 0, falhou = 0;
const check = (nome: string, cond: boolean, extra = '') => {
  if (cond) { ok++; console.log(`  ✅ ${nome}`); } else { falhou++; console.log(`  ❌ ${nome} ${extra}`); }
};

const ev = (kind: string, minute: number, actor?: string, extra: Record<string, unknown> = {}) => ({ kind, minute, actor_id: actor, ...extra });
const plano1 = {
  mode: 'full', start_minute: 0,
  events: [
    ev('buildup_home', 3, 'mc'), ev('shot_home', 12, 'ata'), ev('goal_home', 20, 'ata'), ev('yellow_home', 30, 'zag'),
    ev('goal_away', 38, 'x9'), ev('chance_home', 41, 'pe'), ev('goal_home', 60, 'ata'), ev('penalty_home', 70),
    ev('save_away', 80, 'x9'), ev('corner_home', 85, 'pd'),
  ],
};
const escalacao = ['gol', 'zag', 'mc', 'pe', 'pd', 'ata'];
const resumo = resumirPlano(plano1, escalacao);
const attrs = { passe: 70, marcacao: 60, velocidade: 75, drible: 72, finalizacao: 80, fisico: 70, tatico: 60, mentalidade: 65, confianca: 70, fairPlay: 70 };
// Nota honesta = a fórmula aplicada ao OVR real dos atributos.
const notaHonesta = (pos: string, g: number, c: number) => notaDaPartida(ovrDe(atributosCompletos(attrs, pos), pos), g, c);
const honesto = (id: string, g: number, c: number, pos = 'ATA'): JogadorRelatado => ({ id, pos, attrsAntes: attrs, gols: g, chutes: c, nota: notaHonesta(pos, g, c) });

console.log('\n📋 resumo do plano\n');
check('guarda só lances de ataque e pênaltis (cartão fica de fora)', resumo.lances.length === 9 && !resumo.lances.some((l) => l.k === 'yellow'));
check('guarda a escalação que foi ao motor', resumo.escalacao.join(',') === escalacao.join(','));
check('nota do servidor = nota do celular (matchRating)', [[60, 0, 0], [83, 2, 5], [41, 0, 1], [99, 4, 9]].every(([o, g, c]) => notaDaPartida(o!, g!, c!) === matchRating(o!, { goals: g!, shots: c! })));

console.log('\n⏱️  dois tempos\n');
{
  const segundo = resumirPlano({ mode: 'second_half', start_minute: 46, events: [ev('goal_home', 50, 'pd'), ev('shot_away', 70, 'x9')] }, escalacao);
  const juntos = lancesDaPartida([resumo, segundo]);
  check('1º tempo do plano original + 2º tempo do replano', juntos.length === 7 && juntos.some((l) => l.a === 'pd' && l.m === 50) && !juntos.some((l) => l.m === 60));
}

console.log('\n📣 LEGACY: replans de comando (Fase 4b)\n');
{
  // inteira → comando no 20' (replan do 23') → intervalo (46') → comando no 64' (replan do 67')
  const cmd1 = resumirPlano({ mode: 'from_minute', start_minute: 23, events: [ev('goal_home', 30, 'pd'), ev('shot_home', 60, 'ata')] }, escalacao);
  const intervalo = resumirPlano({ mode: 'second_half', start_minute: 46, events: [ev('shot_home', 50, 'mc'), ev('goal_home', 75, 'mc')] }, escalacao);
  const cmd2 = resumirPlano({ mode: 'from_minute', start_minute: 67, events: [ev('goal_home', 80, 'ata')] }, escalacao);
  check('replan de comando é arquivado como from_minute', cmd1.modo === 'from_minute' && cmd1.minutoInicial === 23);
  const costura = lancesDaPartida([resumo, cmd1, intervalo, cmd2]);
  check('cada replan manda do minuto dele em diante',
    !costura.some((l) => l.m >= 23 && l.m < 46 && !cmd1.lances.includes(l))
    && !costura.some((l) => l.m === 60)              // o 60' do replan do 23' foi atropelado pelo intervalo
    && !costura.some((l) => l.m === 75)              // o 75' do intervalo foi atropelado pelo replan do 67'
    && costura.some((l) => l.m === 80 && l.a === 'ata'));
  const v = validarRelato({ placar: [2, 0], jogadores: [honesto('pd', 1, 1, 'PD'), honesto('ata', 1, 1)] },
    [resumo, cmd1, intervalo, cmd2]);
  check('placar honesto costurado de 4 planos → válida', v.custodia === 'valida', v.motivos.join('; '));
}

console.log('\n✅ relato honesto\n');
{
  const v = validarRelato({ placar: [3, 1], jogadores: [honesto('ata', 2, 3), honesto('mc', 1, 1, 'MC'), honesto('zag', 0, 0, 'ZAG')] }, [resumo]);
  check('placar e gols dentro do plano, nota certa → válida', v.custodia === 'valida', v.motivos.join('; '));
  check('pênalti pode ser batido por qualquer titular', validarRelato({ placar: [1, 0], jogadores: [honesto('zag', 1, 1, 'ZAG')] }, [resumo]).custodia === 'valida');
}

console.log('\n🚨 relato forjado\n');
{
  const v1 = validarRelato({ placar: [9, 0], jogadores: [honesto('ata', 2, 3)] }, [resumo]);
  check('placar acima dos lances do plano → suspeita', v1.custodia === 'suspeita' && v1.motivos.some((m) => m.includes('placar da casa')));
  const v2 = validarRelato({ placar: [3, 0], jogadores: [honesto('gol', 3, 3, 'GOL')] }, [resumo]);
  check('jogador sem chance no plano marcando 3 → suspeita', v2.custodia === 'suspeita' && v2.motivos.some((m) => m.includes('chance')));
  const v3 = validarRelato({ placar: [2, 1], jogadores: [{ ...honesto('ata', 2, 3), nota: 9.9 }] }, [resumo]);
  check('nota inflada → suspeita', v3.custodia === 'suspeita' && v3.motivos.some((m) => m.includes('nota')));
  const v4 = validarRelato({ placar: [1, 1], jogadores: [honesto('craque-de-fora', 0, 0)] }, [resumo]);
  check('jogador fora da escalação enviada ao motor → suspeita', v4.custodia === 'suspeita');
  const v5 = validarRelato({ placar: [1, 1], jogadores: [honesto('ata', 2, 2)] }, [resumo]);
  check('titulares com mais gols que o placar → suspeita', v5.custodia === 'suspeita');
  const v6 = validarRelato({ placar: [1, 4], jogadores: [honesto('ata', 1, 1)] }, [resumo]);
  check('adversário com mais gols do que lances → suspeita', v6.custodia === 'suspeita');
}

console.log(`\n${falhou === 0 ? '🟢' : '🔴'} ${ok} passaram, ${falhou} falharam`);
process.exit(falhou === 0 ? 0 : 1);
