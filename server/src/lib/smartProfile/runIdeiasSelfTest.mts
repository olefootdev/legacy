/**
 * MANAGER-IDEAS (Fase 5).   npm run test:ideias
 *
 * O último bloco é a prova da chave de ouro: a cadeia das cinco fases num só
 * caminho — ficha → nível → traço → ideia → número que entra no Python.
 */
import {
  IDEIAS, TETO_POSITIVO_POR_ATRIBUTO, TETO_POSITIVO_TOTAL, catalogoDeIdeias, efeitoDasIdeias,
  ideiasDoCerebro, podeAprender, setorDaClasse, type ContextoDaPartida,
} from './ideias.js';
import { aplicarTracos, conferirEscalacao, forcaDaEscalacao, type FichaDoMotor } from './plano.js';
import { nivelPorXp, tracosGanhos, xpParaNivel } from './rpg.js';
import { atributosCompletos, espacosDoCerebro } from './derivar.js';
import { ovrDe } from './ovr.js';
import type { ClasseId, Temperamento } from './tipos.js';

let ok = 0, falhou = 0;
const check = (nome: string, cond: boolean, extra = '') => {
  if (cond) { ok++; console.log(`  ✅ ${nome}`); } else { falhou++; console.log(`  ❌ ${nome} ${extra}`); }
};

const TEMP = (p: Partial<Temperamento> = {}): Temperamento =>
  ({ ousadia: 70, frieza: 70, ambicao: 70, lealdade: 70, ...p });

const fichaDe = (p: Partial<{ nivel: number; classe: ClasseId; temperamento: Temperamento; espacos: number; ideias: string[] }> = {}) => ({
  nivel: p.nivel ?? 20,
  classe: p.classe ?? ('xerife' as ClasseId),
  temperamento: p.temperamento ?? TEMP(),
  cerebro: { espacos: p.espacos ?? 3, ideias: p.ideias ?? [] },
});

const CTX = (p: Partial<ContextoDaPartida> = {}): ContextoDaPartida =>
  ({ minhaForca: 70, forcaAdversario: 70, derby: false, intensidade: 'balanced', segundoTempo: false, ...p });

console.log('\n🚪 as quatro portas do aprendizado vêm das fases anteriores\n');
{
  check('jogador pronto aprende', podeAprender(fichaDe(), 'mata_leao').pode);
  check('ideia que não existe é recusada', podeAprender(fichaDe(), 'teletransporte').motivo === 'ideia-desconhecida');
  check('não aprende duas vezes', podeAprender(fichaDe({ ideias: ['mata_leao'] }), 'mata_leao').motivo === 'ja-sabe');

  // Espaço — Fase 1 (a raridade define quantos).
  const comum = fichaDe({ espacos: espacosDoCerebro('comum'), ideias: ['mata_leao'] });
  check('comum tem 1 espaço e enche com uma ideia', comum.cerebro.espacos === 1
    && podeAprender(comum, 'segura_o_jogo').motivo === 'sem-espaco');
  check('lendário tem 3 espaços', espacosDoCerebro('lendario') === 3);

  // Nível — Fase 4.
  check('nível baixo recusa', podeAprender(fichaDe({ nivel: 4 }), 'mata_leao').motivo === 'nivel-baixo');
  check('o detalhe da recusa diz quanto falta', podeAprender(fichaDe({ nivel: 4 }), 'mata_leao').detalhe === '4/5');

  // Setor da classe — Fase 1.
  check('atacante não aprende ideia de defesa',
    podeAprender(fichaDe({ classe: 'matador' }), 'mata_leao').motivo === 'fora-do-setor');
  check('e o setor sai da classe', setorDaClasse('matador') === 'ataque' && setorDaClasse('xerife') === 'defesa');
  check('zagueiro não aprende ideia de ataque',
    podeAprender(fichaDe({ classe: 'xerife' }), 'chave_do_jogo').motivo === 'fora-do-setor');

  // Temperamento — Fase 1. É o que dá personalidade ao plantel.
  check('sem frieza o jogador NÃO TOPA segurar o jogo',
    podeAprender(fichaDe({ temperamento: TEMP({ frieza: 40 }) }), 'segura_o_jogo').motivo === 'nao-topa');
  check('a recusa diz qual eixo e quanto faltou',
    podeAprender(fichaDe({ temperamento: TEMP({ frieza: 40 }) }), 'segura_o_jogo').detalhe === 'frieza 40/60');
  check('sem ambição ninguém é dono do clássico',
    podeAprender(fichaDe({ temperamento: TEMP({ ambicao: 30 }) }), 'dono_do_classico').motivo === 'nao-topa');
  check('cérebro com lixo não conta como ideia', ideiasDoCerebro(['mata_leao', 'xpto', null, 7]).join() === 'mata_leao');
  check('o catálogo do cliente não leva as funções',
    catalogoDeIdeias().every((i) => !('quando' in i)) && catalogoDeIdeias().length === IDEIAS.length);
}

console.log('\n⏰ a ideia só acorda quando a partida pede\n');
{
  const cerebro = { ideias: ['mata_leao'] };
  const azarao = efeitoDasIdeias(cerebro, CTX({ minhaForca: 60, forcaAdversario: 70 }));
  check('contra time mais forte, Mata-leão acorda', azarao.acionadas.includes('mata_leao') && azarao.deltas.marcacao === 3);
  check('e cobra o preço: finaliza menos', azarao.deltas.finalizacao === -2);

  const parelho = efeitoDasIdeias(cerebro, CTX({ minhaForca: 70, forcaAdversario: 70 }));
  check('contra time parelho ela dorme', parelho.acionadas.length === 0 && parelho.dormindo.includes('mata_leao'));
  check('dormindo não mexe em nada', Object.keys(parelho.deltas).length === 0);

  const semForca = efeitoDasIdeias(cerebro, CTX({ minhaForca: null, forcaAdversario: 99 }));
  check('sem força própria confiável, não aciona comparação', semForca.acionadas.length === 0);

  check('clássico acorda o Dono do clássico',
    efeitoDasIdeias({ ideias: ['dono_do_classico'] }, CTX({ derby: true })).acionadas.length === 1);
  check('postura ofensiva acorda a Chave do jogo',
    efeitoDasIdeias({ ideias: ['chave_do_jogo'] }, CTX({ intensidade: 'offensive' })).acionadas.length === 1);
  check('2º tempo acorda o Segura o jogo',
    efeitoDasIdeias({ ideias: ['segura_o_jogo'] }, CTX({ segundoTempo: true })).acionadas.length === 1);
  check('favorito acorda o Não relaxa',
    efeitoDasIdeias({ ideias: ['favorito_nao_relaxa'] }, CTX({ minhaForca: 80, forcaAdversario: 70 })).acionadas.length === 1);
  check('cérebro vazio não faz nada', efeitoDasIdeias({ ideias: [] }, CTX()).acionadas.length === 0);
}

console.log('\n⚖️  o bônus tem teto; a contrapartida não\n');
{
  // Três ideias que acordam juntas na mesma partida.
  const tres = { ideias: ['mata_leao', 'segura_o_jogo', 'dono_do_classico'] };
  const e = efeitoDasIdeias(tres, CTX({ minhaForca: 60, forcaAdversario: 70, derby: true, intensidade: 'defensive' }));
  check('as três acordam', e.acionadas.length === 3);
  const positivo = Object.values(e.deltas).reduce((s, v) => s + Math.max(0, v ?? 0), 0);
  check(`o lado positivo não passa de +${TETO_POSITIVO_TOTAL}`, positivo <= TETO_POSITIVO_TOTAL, `deu +${positivo}`);
  check(`nenhum atributo passa de +${TETO_POSITIVO_POR_ATRIBUTO}`,
    Object.values(e.deltas).every((v) => (v ?? 0) <= TETO_POSITIVO_POR_ATRIBUTO));
  check('o negativo passa inteiro: é o preço da escolha',
    (e.deltas.finalizacao ?? 0) === -2 && (e.deltas.velocidade ?? 0) === -2);
}

console.log('\n🔑 A CHAVE DE OURO — as cinco fases numa cadeia só\n');
{
  // FASE 1: a ficha. Gênese, classe, temperamento e espaços de cérebro.
  const ATTRS = { passe: 62, marcacao: 66, velocidade: 60, drible: 55, finalizacao: 50,
    fisico: 68, tatico: 64, mentalidade: 60, confianca: 61, fairPlay: 70 };
  const atributos = atributosCompletos(ATTRS, 'ZAG');
  const classe: ClasseId = 'xerife';
  const espacos = espacosDoCerebro('epico');

  // FASE 4: o XP virou nível, e o nível deu traço.
  const xp = xpParaNivel(26);
  const nivel = nivelPorXp(xp);
  check('1+4 · o XP creditado pelo servidor virou nível 26', nivel === 26);
  const carreira = { partidas: 30, gols: 1, vitorias: 18 };
  const ganhos = tracosGanhos({ nivel, carreira, classe, tracos: [] });
  check('4 · 30 partidas na defesa + nível 26 deram Xerifão, Maestro e Incansável',
    ['xerifao', 'maestro', 'incansavel'].every((t) => ganhos.includes(t)), ganhos.join());

  // FASE 5: o manager ensina — e as portas das fases 1 e 4 decidem.
  const ficha = { nivel, classe, temperamento: TEMP({ frieza: 65 }), cerebro: { espacos, ideias: [] as string[] } };
  check('5 · com nível 26 e frieza 65, ele topa o Mata-leão', podeAprender(ficha, 'mata_leao').pode);
  ficha.cerebro.ideias.push('mata_leao');
  check('5 · e recusa a ideia de ataque, porque a CLASSE dele é defesa',
    podeAprender(ficha, 'chave_do_jogo').motivo === 'fora-do-setor');

  // FASE 3: o servidor é dono da entrada do motor — e é por isso que o efeito chega.
  const fichaDoMotor: FichaDoMotor = { atributos, ovr: ovrDe(atributos, 'ZAG'), tracos: ganhos, cerebro: ficha.cerebro };
  const fichas = new Map<string, FichaDoMotor>([['zag1', fichaDoMotor]]);

  // O celular manda o payload honesto (e tenta inflar a marcação de brinde).
  const doCelular = [{ id: 'zag1', marcacao: 99, passe: 62, finalizacao: 50, fisico: 68, tatico: 64, mentalidade: 60,
    velocidade: 60, drible: 55, confianca: 61, fair_play: 70, fatigue: 0 }];

  // FASE 3: a conferência corta a mentira contra a ficha.
  const conferido = conferirEscalacao(doCelular, fichas);
  const marcacaoConferida = (conferido.escalacao[0] as { marcacao: number }).marcacao;
  check('3 · a marcação inflada a 99 foi cortada contra a ficha',
    conferido.conferencia.corrigidos === 1 && marcacaoConferida < 80, `ficou ${marcacaoConferida}`);

  // FASE 3B: a força do time sai da ficha, e é ela que aciona a ideia.
  const minhaForca = forcaDaEscalacao(conferido.escalacao, fichas);
  check('3B · a força do time saiu da ficha', minhaForca === ovrDe(atributos, 'ZAG'));

  // FASES 4+5: traço (sempre) e ideia (porque o adversário é mais forte).
  const ctx = CTX({ minhaForca, forcaAdversario: (minhaForca ?? 70) + 8 });
  const final = aplicarTracos(conferido.escalacao, fichas, ctx);
  const linha = final.escalacao[0] as Record<string, number>;

  check('4+5 · a ideia acordou porque o adversário é mais forte',
    final.aplicados.ideias?.zag1?.includes('mata_leao') === true, JSON.stringify(final.aplicados));
  check('4+5 · a marcação final = conferida + traço (+3) + ideia (+3)',
    linha.marcacao === Math.min(99, marcacaoConferida + 6), `${marcacaoConferida} → ${linha.marcacao}`);
  check('4+5 · o passe subiu pelo Maestro (+3)', linha.passe === 65);
  check('5 · e a finalização CAIU, porque a ideia cobra o preço', linha.finalizacao === 48);
  // O teto de +6 por jogador COMEU o bônus do Incansável: três traços somavam
  // +8 (marcação 3 + passe 3 + físico 2) e o corte apara o menor primeiro. É o
  // teto funcionando — traço é tempero, não segunda carreira.
  check('4 · o teto de +6 aparou o traço mais fraco: o físico ficou onde estava',
    linha.fisico === 68, `físico ${linha.fisico}`);
  check('nada disso veio do celular: ele pediu 99 de marcação e levou o que a ficha permite',
    linha.marcacao !== 99);
}

console.log(`\n${falhou === 0 ? '🟢' : '🔴'} ${ok} passaram, ${falhou} falharam`);
process.exit(falhou === 0 ? 0 : 1);
