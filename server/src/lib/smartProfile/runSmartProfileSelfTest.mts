/**
 * SMART-PROFILE — lógica pura, sem banco.   npm run test:smart-profile
 */
import { overallFromAttributes } from '../../../../src/entities/player.ts';
import { deriveSpecialistAttrs } from '../../../../src/entities/specialistAttrs.ts';
import { ovrDe } from './ovr.js';
import { atributosCompletos, classeDe, origemDe, raridadeDe, temperamentoDe } from './derivar.js';
import { conciliar, hashDaGenese, saiuDoElenco } from './ficha.js';
import { CLASSES } from './classes.js';
import type { Atributos } from './tipos.js';

let ok = 0, falhou = 0;
const check = (nome: string, cond: boolean, extra = '') => {
  if (cond) { ok++; console.log(`  ✅ ${nome}`); } else { falhou++; console.log(`  ❌ ${nome} ${extra}`); }
};

// Gerador determinístico (sem Math.random — o teste dá sempre o mesmo resultado).
let semente = 20261005;
const rnd = () => ((semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648);
const POS = ['GOL', 'ZAG', 'LD', 'LE', 'VOL', 'MC', 'MEI', 'PE', 'PD', 'ATA', 'CA', 'ME', 'XYZ'];
const NUCLEO = ['passe', 'marcacao', 'velocidade', 'drible', 'finalizacao', 'fisico', 'tatico', 'mentalidade', 'confianca', 'fairPlay'];
const aleatorios = (decimais = false) => Object.fromEntries(NUCLEO.map((k) => [k, decimais ? 30 + rnd() * 69 : Math.round(30 + rnd() * 69)]));

console.log('\n⚖️  OVR igual ao do jogo\n');
{
  let divergencias = 0;
  for (let i = 0; i < 5000; i++) {
    const pos = POS[i % POS.length]!;
    const a = atributosCompletos(aleatorios(i % 3 === 0), pos);
    if (ovrDe(a, pos) !== overallFromAttributes(a as never, pos)) divergencias++;
  }
  check('5.000 fichas, todas as posições, com e sem decimais: zero divergência', divergencias === 0, `(${divergencias})`);
}

console.log('\n🎯 especialistas iguais aos do jogo\n');
{
  let divergencias = 0;
  for (let i = 0; i < 2000; i++) {
    const pos = POS[i % POS.length]!;
    const nucleo = aleatorios();
    const a = atributosCompletos(nucleo, pos);
    const j = deriveSpecialistAttrs(nucleo as never, pos);
    if (a.cabeceio !== j.cabeceio || a.bolaParada !== j.bolaParada || a.penalti !== j.penalti) divergencias++;
  }
  check('cabeceio, bola parada e pênalti derivados pela mesma fórmula', divergencias === 0, `(${divergencias})`);
  check('especialista que já existe é respeitado', atributosCompletos({ ...aleatorios(), cabeceio: 91 }, 'ZAG').cabeceio === 91);
}

console.log('\n🧬 classes\n');
{
  const base: Atributos = atributosCompletos(Object.fromEntries(NUCLEO.map((k) => [k, 55])), 'ATA');
  const com = (over: Partial<Atributos>) => ({ ...base, ...over }) as Atributos;
  check('centroavante finalizador → Matador', classeDe('ATA', com({ finalizacao: 92, confianca: 80 })).classe === 'matador');
  check('centroavante forte de cabeça → Pivô', classeDe('ATA', com({ fisico: 90, cabeceio: 92, finalizacao: 70 })).classe === 'pivo');
  check('centroavante que arma → Falso 9', classeDe('ATA', com({ passe: 88, drible: 86, finalizacao: 66 })).classe === 'falso_9');
  check('zagueiro que marca → Xerife', classeDe('ZAG', com({ marcacao: 90, fisico: 85 })).classe === 'xerife');
  check('zagueiro que sai jogando → Zagueiro construtor', classeDe('ZAG', com({ passe: 88, tatico: 86 })).classe === 'zagueiro_construtor');
  check('volante que distribui → Regista', classeDe('VOL', com({ passe: 92, tatico: 88 })).classe === 'regista');
  check('ponta que dribla → Ponta driblador', classeDe('PE', com({ drible: 92 })).classe === 'ponta_driblador');
  check('ponta muito rápido → Velocista', classeDe('PD', com({ velocidade: 96 })).classe === 'velocista');
  check('goleiro que joga com os pés → Goleiro-líbero', classeDe('GOL', com({ passe: 88, velocidade: 80, tatico: 85 })).classe === 'goleiro_libero');
  check('classe sempre válida para a posição', POS.every((p) => {
    const r = classeDe(p, atributosCompletos(aleatorios(), p));
    return CLASSES.some((c) => c.id === r.classe);
  }));
  check('mesmos atributos → mesma classe (determinístico)', classeDe('MC', com({ passe: 80 })).classe === classeDe('MC', com({ passe: 80 })).classe);
  check('afinidade é outra classe', (() => { const r = classeDe('ATA', com({ finalizacao: 90 })); return r.afinidade !== null && r.afinidade !== r.classe; })());
  check('16 classes no catálogo', CLASSES.length === 16);
}

console.log('\n💎 origem e raridade\n');
check('genesis-* é Genesis', origemDe('genesis-abc', {}) === 'genesis');
check('mgr_* é Academia', origemDe('mgr_x', {}) === 'academia');
check('Legacy com lenda real → Lendário', raridadeDe('legacy', 'epico') === 'lendario' && raridadeDe('legacy', 'premium') === 'lendario');
check('Legacy AI+ → Raro; Revelação → Épico', raridadeDe('legacy', 'ai_plus') === 'raro' && raridadeDe('legacy', 'revelacao') === 'epico');
check('Genesis Basic → Comum; Gold → Épico; Legend → Lendário', raridadeDe('genesis', 'Basic') === 'comum' && raridadeDe('genesis', 'Gold') === 'epico' && raridadeDe('genesis', 'Legend') === 'lendario');

console.log('\n🌡️  temperamento\n');
{
  const a = atributosCompletos(Object.fromEntries(NUCLEO.map((k) => [k, 60])), 'MC');
  const of = temperamentoDe('ofensivo', a, 25), de = temperamentoDe('defensivo', a, 25);
  check('ofensivo é mais ousado que defensivo', of.ousadia > de.ousadia);
  check('lealdade nasce em 50', of.lealdade === 50);
  check('tudo entre 1 e 99', Object.values(of).every((v) => v >= 1 && v <= 99));
}

console.log('\n📜 ficha e histórico\n');
{
  const agora = '2026-10-05T12:00:00.000Z';
  const catalogo = { catalogo: 'abc', atributos: { ...aleatorios(), finalizacao: 70 }, rotuloRaridade: 'Gold', ovrNascimento: 66, nacionalidade: 'BR', idade: 22, pe: 'right' };
  const ent = { id: 'genesis-abc', name: 'Caio', pos: 'ATA', behavior: 'ofensivo', attrs: { ...catalogo.atributos, finalizacao: 77 } };
  const r1 = conciliar('dono-1', ent, null, catalogo, agora);
  check('ficha nova nasce com evento "nasceu"', r1.eventos.length === 1 && r1.eventos[0]!.tipo === 'nasceu');
  check('gênese guarda os atributos do CATÁLOGO', r1.ficha.genese.atributos.finalizacao === 70);
  check('corpo guarda os atributos de HOJE', r1.ficha.atributos.finalizacao === 77);
  check('evolução anterior registrada no nascimento', JSON.stringify((r1.eventos[0]!.dados as { evolucao_anterior: unknown }).evolucao_anterior).includes('"finalizacao":[70,77]'));
  check('raridade Gold → Épico, 3 espaços no cérebro', r1.ficha.raridade === 'epico' && r1.ficha.cerebro.espacos === 3);
  check('hash da gênese é estável', hashDaGenese(r1.ficha.genese) === r1.ficha.genese_hash);
  check('mudar a gênese muda o hash', hashDaGenese({ ...r1.ficha.genese, ovr: 99 }) !== r1.ficha.genese_hash);

  const igual = conciliar('dono-1', ent, r1.ficha, catalogo, agora);
  check('sincronizar sem mudança não gera evento', igual.eventos.length === 0 && !igual.mudou);

  const evoluiu = conciliar('dono-1', { ...ent, attrs: { ...ent.attrs, finalizacao: 80 } }, r1.ficha, catalogo, agora);
  check('atributo mudou → evento com antes e depois', evoluiu.eventos[0]?.tipo === 'atributos' && JSON.stringify(evoluiu.eventos[0]!.dados).includes('"finalizacao":[77,80]'));
  check('gênese e classe não mudam com a evolução', evoluiu.ficha.genese_hash === r1.ficha.genese_hash && evoluiu.ficha.classe === r1.ficha.classe);

  const saiu = saiuDoElenco(evoluiu.ficha);
  check('saiu do elenco → inativa + evento', !saiu.ficha.ativo && saiu.eventos[0]!.tipo === 'saiu_do_elenco');
  const voltou = conciliar('dono-1', { ...ent, attrs: { ...ent.attrs, finalizacao: 80 } }, saiu.ficha, catalogo, agora);
  check('voltou → ativa + evento', voltou.ficha.ativo && voltou.eventos.some((e) => e.tipo === 'voltou_ao_elenco'));

  const virouZagueiro = conciliar('dono-1', { ...ent, pos: 'ZAG' }, r1.ficha, catalogo, agora);
  check('posição nova que não aceita a classe → classe recalculada', ['xerife', 'zagueiro_construtor'].includes(virouZagueiro.ficha.classe));

  const outroDono = conciliar('dono-2', ent, null, catalogo, agora);
  check('mesmo jogador em outro elenco = outra ficha, mesma gênese de catálogo', outroDono.ficha.owner_id === 'dono-2' && outroDono.ficha.genese.atributos.finalizacao === 70);
}

console.log(`\n${falhou === 0 ? '🟢' : '🔴'} ${ok} passaram, ${falhou} falharam`);
process.exit(falhou === 0 ? 0 : 1);
