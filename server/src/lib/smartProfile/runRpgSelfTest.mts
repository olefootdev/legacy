/**
 * RPG do jogador (Fase 4).   npm run test:rpg
 *
 * O teste que importa mais está no fim: o traço CHEGA ao motor. Se esse cair, o
 * resto é enfeite — que é exatamente o que esta fase existe para não ser.
 */
import {
  NIVEL_MAXIMO, TETO_POR_ATRIBUTO, TETO_TOTAL, TRACOS, carreiraDe, catalogoDeTracos,
  efeitoDosTracos, faltaParaOProximo, nivelPorXp, tracosDaFicha, tracosGanhos, xpParaNivel,
} from './rpg.js';
import { aplicarTracos, type FichaDoMotor } from './plano.js';
import { atributosCompletos } from './derivar.js';
import type { ClasseId } from './tipos.js';

let ok = 0, falhou = 0;
const check = (nome: string, cond: boolean, extra = '') => {
  if (cond) { ok++; console.log(`  ✅ ${nome}`); } else { falhou++; console.log(`  ❌ ${nome} ${extra}`); }
};

console.log('\n📈 curva de XP e nível\n');
{
  check('começa no nível 1 com 0 de XP', nivelPorXp(0) === 1);
  check('XP negativo ou lixo não quebra', nivelPorXp(-500) === 1 && nivelPorXp(NaN) === 1);
  check('nível 1 não exige XP', xpParaNivel(1) === 0);
  check('o nível 2 vem com 12 de XP', xpParaNivel(2) === 12 && nivelPorXp(12) === 2 && nivelPorXp(11) === 1);
  check('capa no nível 50', nivelPorXp(10_000_000) === NIVEL_MAXIMO);

  // Monotonicidade: mais XP nunca dá nível menor, e cada nível exige mais que o anterior.
  let monotona = true, crescente = true, anterior = 1;
  for (let xp = 0; xp <= 5000; xp += 7) {
    const n = nivelPorXp(xp);
    if (n < anterior) monotona = false;
    anterior = n;
  }
  for (let n = 2; n <= NIVEL_MAXIMO; n++) if (xpParaNivel(n) <= xpParaNivel(n - 1)) crescente = false;
  check('mais XP nunca rebaixa', monotona);
  check('cada nível custa mais que o anterior', crescente);
  check('o nível bate com a curva em todo nível', Array.from({ length: NIVEL_MAXIMO }, (_, i) => i + 1)
    .every((n) => nivelPorXp(xpParaNivel(n)) === n));

  const f = faltaParaOProximo(50);
  check('a barra de progresso fecha a conta', f.nivel === nivelPorXp(50) && f.falta === f.doProximo - 50);
  check('no nível máximo não falta nada', faltaParaOProximo(999_999).falta === 0);
}

console.log('\n🏅 carreira e concessão de traços\n');
{
  check('carreira de ficha nova é zero', JSON.stringify(carreiraDe({ noElencoDesde: 'x' })) === JSON.stringify({ partidas: 0, gols: 0, vitorias: 0 }));
  check('carreira ignora lixo', JSON.stringify(carreiraDe({ partidas: -5, gols: 'muitos', vitorias: 3.7 })) === JSON.stringify({ partidas: 0, gols: 0, vitorias: 3 }));
  check('vinculo nulo não quebra', carreiraDe(null).partidas === 0);

  const atacante: ClasseId = 'matador';
  const zagueiro: ClasseId = 'xerife';
  const zerado = { partidas: 0, gols: 0, vitorias: 0 };

  check('ninguém nasce com traço', tracosGanhos({ nivel: 1, carreira: zerado, classe: atacante, tracos: [] }).length === 0);
  check('10 gols de atacante → Matador',
    tracosGanhos({ nivel: 1, carreira: { ...zerado, gols: 10 }, classe: atacante, tracos: [] }).includes('matador'));
  check('9 gols ainda não dá',
    !tracosGanhos({ nivel: 1, carreira: { ...zerado, gols: 9 }, classe: atacante, tracos: [] }).includes('matador'));
  check('zagueiro com 10 gols NÃO vira Matador (o traço é da posição)',
    !tracosGanhos({ nivel: 1, carreira: { ...zerado, gols: 10 }, classe: zagueiro, tracos: [] }).includes('matador'));
  check('25 partidas na defesa → Xerifão',
    tracosGanhos({ nivel: 1, carreira: { ...zerado, partidas: 25 }, classe: zagueiro, tracos: [] }).includes('xerifao'));
  check('nível 10 → Maestro', tracosGanhos({ nivel: 10, carreira: zerado, classe: atacante, tracos: [] }).includes('maestro'));
  check('nível 20 → Incansável também', tracosGanhos({ nivel: 20, carreira: zerado, classe: atacante, tracos: [] }).includes('incansavel'));
  check('50 partidas → Veterano, em qualquer posição',
    tracosGanhos({ nivel: 1, carreira: { ...zerado, partidas: 50 }, classe: zagueiro, tracos: [] }).includes('veterano'));
  check('traço que já tem não é concedido de novo',
    tracosGanhos({ nivel: 10, carreira: zerado, classe: atacante, tracos: ['maestro'] }).length === 0);
  check('traço inválido na ficha é ignorado', tracosDaFicha(['maestro', 'inventado', null, 42]).join() === 'maestro');
  check('traço em formato de objeto também é lido', tracosDaFicha([{ id: 'veterano' }]).join() === 'veterano');
  check('o catálogo não tem id repetido', new Set(TRACOS.map((t) => t.id)).size === TRACOS.length);
  check('o catálogo para o cliente não expõe as funções',
    catalogoDeTracos().every((t) => !('ganhou' in t)) && catalogoDeTracos().length === TRACOS.length);
}

console.log('\n⚖️  o efeito é tempero, não segunda carreira\n');
{
  check('sem traço, sem efeito', Object.keys(efeitoDosTracos([])).length === 0 && Object.keys(efeitoDosTracos(null)).length === 0);
  check('Maestro dá +3 de passe', efeitoDosTracos(['maestro']).passe === 3);
  const tudo = efeitoDosTracos(TRACOS.map((t) => t.id));
  const total = Object.values(tudo).reduce((s, v) => s + (v ?? 0), 0);
  check(`todos os traços juntos não passam do teto total (+${TETO_TOTAL})`, total <= TETO_TOTAL, `deu ${total}`);
  check(`nenhum atributo passa de +${TETO_POR_ATRIBUTO}`, Object.values(tudo).every((v) => (v ?? 0) <= TETO_POR_ATRIBUTO));
  check('o corte mantém o traço forte e apara o fraco', (tudo.finalizacao ?? 0) >= (tudo.fisico ?? 0));
}

console.log('\n🎯 O QUE IMPEDE O TRAÇO DE SER ENFEITE: ele chega ao motor\n');
{
  const ATTRS = { passe: 60, marcacao: 60, velocidade: 60, drible: 60, finalizacao: 60,
    fisico: 60, tatico: 60, mentalidade: 60, confianca: 60, fairPlay: 60 };
  const atributos = atributosCompletos(ATTRS, 'ATA');
  const comTraco = new Map<string, FichaDoMotor>([['p1', { atributos, ovr: 60, tracos: ['maestro'] }]]);
  const semTraco = new Map<string, FichaDoMotor>([['p1', { atributos, ovr: 60, tracos: [] }]]);
  const payload = [{ id: 'p1', passe: 60, finalizacao: 60, fatigue: 0 }];

  const r = aplicarTracos(payload, comTraco);
  check('o passe que vai ao Python sobe de 60 para 63',
    (r.escalacao[0] as { passe: number }).passe === 63, JSON.stringify(r.escalacao[0]));
  check('só o atributo do traço muda', (r.escalacao[0] as { finalizacao: number }).finalizacao === 60);
  check('o plano registra quem levou o bônus',
    r.aplicados.jogadores === 1 && r.aplicados.pontos === 3 && r.aplicados.exemplos.p1?.passe === 3);

  const r2 = aplicarTracos(payload, semTraco);
  check('sem traço a escalação passa intacta',
    r2.aplicados.jogadores === 0 && r2.escalacao[0] === payload[0]);

  const r3 = aplicarTracos([{ id: 'sem-ficha', passe: 60 }], comTraco);
  check('jogador sem ficha não leva traço de ninguém', r3.aplicados.jogadores === 0);

  // Teto 99: o traço não estoura a escala do motor.
  const noTeto = new Map<string, FichaDoMotor>([['p1', { atributos, ovr: 99, tracos: ['maestro'] }]]);
  const r4 = aplicarTracos([{ id: 'p1', passe: 99 }], noTeto);
  check('traço não passa de 99', (r4.escalacao[0] as { passe: number }).passe === 99);
  check('e quando não muda nada, não conta como aplicado', r4.aplicados.jogadores === 0);

  // Campo ausente: não inventa valor.
  const r5 = aplicarTracos([{ id: 'p1', finalizacao: 60 }], comTraco);
  check('campo ausente não é inventado pelo traço', !('passe' in (r5.escalacao[0] as object)));
}

console.log(`\n${falhou === 0 ? '🟢' : '🔴'} ${ok} passaram, ${falhou} falharam`);
process.exit(falhou === 0 ? 0 : 1);
