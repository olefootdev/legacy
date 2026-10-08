/**
 * Self-test do Ato 5 da Fundação (Fase 3): fantasma do time histórico, montagem
 * do Jogo da Fundação e Relatório de Identidade — com o motor Python de verdade
 * (análise pareada com e sem DNA).
 *
 * Uso: npm run test:jogo-fundacao
 */
import { spawnSync } from 'node:child_process';
import type { PlayerEntity, PlayerAttributes } from '../src/entities/types';
import { dnaEfetivo, dnaDoClubeParaMotor, dnaNeutro, identidadeSugerida, TIMES_HISTORICOS, type IdentidadeDoClube } from '../src/club/identidade';
import {
  fantasmaDe,
  montarJogoDaFundacao,
  relatorioDeIdentidade,
  seedDaFundacao,
  vestirFantasma,
  type AnaliseDoMotor,
} from '../src/onboarding/jogoDaFundacao';

let falhas = 0;
const checa = (nome: string, ok: boolean, d = '') => {
  console.log(`${ok ? '  OK  ' : '  FALHA '}${nome}${d ? `  ${d}` : ''}`);
  if (!ok) falhas++;
};
const L = (pt: string) => pt;

console.log('1) Fantasma');
const barca = fantasmaDe({ historico: { time: 'barcelona', temporada: '2010–11' } });
checa('Barcelona 2010–11: sigla BAR', barca.sigla === 'BAR', barca.sigla);
checa('"O 9 da Holanda" (artigo certo)', montarNome('holanda').includes('da Holanda'));
checa('fantasma do Barça pede posse', barca.dna.posse > 0.5 && barca.dna.posse > barca.dna.solidez, `posse ${barca.dna.posse}`);
const atl = fantasmaDe({ historico: { time: 'atletico', temporada: '2013–14' } });
checa('fantasma do Atlético pede solidez e abre mão da posse', atl.dna.solidez > 0.5 && atl.dna.posse < 0.5);
const padrao = fantasmaDe({ historico: null });
checa('sem time histórico: Seleção 1970', padrao.time === 'selecao' && padrao.temporada === '1970' && !!padrao.dna);
checa('temporada inexistente cai no padrão', fantasmaDe({ historico: { time: 'barcelona', temporada: '1900' } }).time === 'selecao');
checa('seed é fixa por clube', seedDaFundacao('c1', '2026-10-07') === seedDaFundacao('c1', '2026-10-07'));

function montarNome(time: string): string {
  const f = fantasmaDe({ historico: { time, temporada: Object.keys(TIMES_HISTORICOS[time]!.temporadas)[0]! } });
  return vestirFantasma([{ id: 'x', name: 'x', pos: 'ATA', role: 'attack', finalizacao: 50, passe: 50, marcacao: 50, velocidade: 50, fisico: 50, confianca: 50, fatigue: 0 }], f)[0]!.name;
}

console.log('2) Montagem do jogo');
const attrs = (b: number): PlayerAttributes => ({
  passe: b, marcacao: b, velocidade: b, drible: b, finalizacao: b, fisico: b, tatico: b,
  mentalidade: b, confianca: b, fairPlay: b, cabeceio: b, bolaParada: b, penalti: b,
});
const players: Record<string, PlayerEntity> = {};
const lineup: Record<string, string> = {};
const slots = [['gol', 'GOL'], ['ld', 'LD'], ['zag1', 'ZAG'], ['zag2', 'ZAG'], ['le', 'LE'], ['vol', 'VOL'], ['mc1', 'MC'], ['mc2', 'MC'], ['pe', 'PE'], ['pd', 'PD'], ['ata', 'ATA']] as const;
slots.forEach(([slot, pos], i) => {
  const id = `genesis-${i}`;
  players[id] = { id, name: `Jogador ${i}`, pos, num: i + 1, attrs: attrs(36 + (i % 5)), fatigue: 0, injuryRisk: 0, outForMatches: 0, evolutionXp: 0 } as unknown as PlayerEntity;
  lineup[slot] = id;
});
const identidade: IdentidadeDoClube = {
  versao: 1,
  ...identidadeSugerida('Barcelona'),
  formacao: '4-3-3',
  disponibilidade: 'diario',
  camisa: { padrao: 'listras', primaria: '#B3121B', secundaria: '#0D0D0C', calcao: '#EEE9DF' },
  frase: 'Teste',
  pais: 'Brasil',
  estado: 'SP',
  fundadoEm: '2026-10-07T00:00:00.000Z',
  historico: { time: 'atletico', temporada: '2013–14' },
};
const { input, fantasma } = montarJogoDaFundacao({ players, playerHealth: {}, lineup, clubId: 'c1', clubShort: 'OLE', formacao: '4-3-3', identidade });
checa('fantasma = time histórico do clube', fantasma.time === 'atletico');
checa('espelho: força do fantasma = força da casa', input.awayStrength === input.homeStrength, `${input.homeStrength}`);
checa('11 de cada lado', input.homeLineup.length === 11 && input.awayLineup.length === 11);
checa('fantasma sem nome de jogador real ("O 9 do …")', input.awayLineup.every((p) => p.name.startsWith('O ') && p.id.startsWith('fantasma-')));
checa('ids do fantasma únicos', new Set(input.awayLineup.map((p) => p.id)).size === 11);
checa('casa leva o DNA do clube; fantasma o dele', !!input.homeDna && !!input.fantasma?.dna);

console.log('3) Relatório (veredito)');
const pedido = dnaEfetivo(dnaDoClubeParaMotor(identidade)!);
const eixo = (metrica: string, sinal: 1 | -1, com: number, sem: number) => ({ metrica, sinal, com, sem, pareadas_pro_alto: 0.5 }) as AnaliseDoMotor['eixos']['posse'];
const falsa: AnaliseDoMotor = {
  n: 100,
  eixos: {
    posse: eixo('possession_pct', 1, 55, 50),
    pressao: eixo('high_recoveries', 1, 6, 6),
    vertical: eixo('shots', 1, 4, 5),
    criatividade: eixo('xg_per_shot', 1, 0.2, 0.18),
    solidez: eixo('conceded_shots', -1, 3, 4),
    disciplina: eixo('fouls', -1, 4, 3),
    intensidade: eixo('momentum', 1, 55, 55),
  },
  vitorias_pct: { com: 0.4, sem: 0.35 },
};
const r = relatorioDeIdentidade(falsa, pedido, L);
checa('3 eixos, os mais longe do neutro', r.linhas.length === 3);
const linhaPosse = r.linhas.find((l) => l.eixo === 'posse');
checa('pediu posse e veio +10% = apareceu', !linhaPosse || linhaPosse.veredito === 'apareceu');
const so = relatorioDeIdentidade(falsa, { ...dnaNeutro(), solidez: 0.85 }, L, 1).linhas[0]!;
checa('solidez: MENOS chute sofrido conta como apareceu', so.eixo === 'solidez' && so.veredito === 'apareceu');
const di = relatorioDeIdentidade(falsa, { ...dnaNeutro(), disciplina: 0.88 }, L, 1).linhas[0]!;
checa('disciplina pedida e MAIS falta = foi contra', di.eixo === 'disciplina' && di.veredito === 'contra');
const pr = relatorioDeIdentidade(falsa, { ...dnaNeutro(), pressao: 0.88 }, L, 1).linhas[0]!;
checa('variação zero = discreto', pr.eixo === 'pressao' && pr.veredito === 'discreto');

console.log('4) Motor de verdade (análise pareada no Python)');
const corpo = {
  seed: input.seed, home_short: input.homeShort, away_short: input.awayShort,
  home_team: { strength: input.homeStrength, intensity: 'balanced', lineup: input.homeLineup, dna: input.homeDna },
  away_team: { strength: input.awayStrength, lineup: input.awayLineup, dna: input.fantasma!.dna },
  fantasma: true, analise_identidade: 150,
};
const py = spawnSync('python3', ['smartfield/match_simulator.py'], { input: JSON.stringify(corpo), encoding: 'utf8', timeout: 30_000 });
if (py.status !== 0) {
  checa('python rodou', false, py.stderr.slice(0, 300));
} else {
  const { analise } = JSON.parse(py.stdout) as { analise: AnaliseDoMotor & { dna_applied: Record<string, number> } };
  checa('motor analisou 150 pares', analise.n === 150);
  checa('motor aplicou o DNA do clube', !!analise.dna_applied);
  const rel = relatorioDeIdentidade(analise, pedido, L);
  for (const l of rel.linhas) console.log(`        ${l.eixo.padEnd(12)} ${l.direcao > 0 ? '↑' : '↓'} ${l.veredito.padEnd(9)} ${(l.variacao * 100).toFixed(1)}%  ${l.prova}`);
  checa('nenhum eixo pedido vai CONTRA no motor', rel.linhas.every((l) => l.veredito !== 'contra'));
  checa('pelo menos um eixo pedido aparece', rel.linhas.some((l) => l.veredito === 'apareceu'), `fidelidade ${rel.fidelidade}%`);
}

console.log();
if (falhas) {
  console.log(`${falhas} falha(s).`);
  process.exit(1);
}
console.log('Jogo da Fundação: tudo certo.');
