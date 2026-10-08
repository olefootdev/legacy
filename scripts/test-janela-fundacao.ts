/**
 * Self-test do Ato 4 da Fundação (Fase 2): encaixe no DNA, XI sugerido e as
 * travas da venda pra várzea na Janela da Estreia.
 *
 * Uso: npm run test:janela-fundacao
 */
import { gameReducer } from '../src/game/reducer';
import type { OlefootGameState } from '../src/game/types';
import type { PlayerEntity, PlayerAttributes } from '../src/entities/types';
import { dnaNeutro, dnaEfetivo, type DnaDoClube, type IdentidadeDoClube } from '../src/club/identidade';
import { samePersonKey } from '../src/entities/player';
import { encaixe, escalarPeloEncaixe, sugestaoDoDiretor } from '../src/onboarding/encaixe';
import { JANELA_ELENCO_MINIMO, valorNaVarzea } from '../src/onboarding/janelaEstreia';

let falhas = 0;
const checa = (nome: string, ok: boolean, d = '') => {
  console.log(`${ok ? '  OK  ' : '  FALHA '}${nome}${d ? `  ${d}` : ''}`);
  if (!ok) falhas++;
};

const attrs = (over: Partial<PlayerAttributes> = {}): PlayerAttributes => ({
  passe: 65, marcacao: 65, velocidade: 65, drible: 65, finalizacao: 65, fisico: 65, tatico: 65,
  mentalidade: 65, confianca: 65, fairPlay: 65, cabeceio: 60, bolaParada: 60, penalti: 60, ...over,
});
const jog = (id: string, pos: string, over: Partial<PlayerAttributes> = {}, extra: Partial<PlayerEntity> = {}): PlayerEntity =>
  ({ id, name: id.toUpperCase(), pos, num: 1, attrs: attrs(over), fatigue: 0, injuryRisk: 0, outForMatches: 0, evolutionXp: 0, marketValueExp: 500_000, ...extra }) as unknown as PlayerEntity;

const dnaPosse: DnaDoClube = dnaEfetivo({ ...dnaNeutro(), posse: 0.8, criatividade: 0.7, pressao: 0.3, intensidade: 0.3 });
const dnaPressao: DnaDoClube = dnaEfetivo({ ...dnaNeutro(), pressao: 0.8, intensidade: 0.75, posse: 0.3, criatividade: 0.3 });

console.log('1) Encaixe segue o DNA');
const passador = jog('passador', 'MC', { passe: 88, tatico: 84, drible: 82, fisico: 55, marcacao: 55 });
const motorzinho = jog('motor', 'MC', { fisico: 88, marcacao: 84, mentalidade: 82, passe: 55, drible: 55 });
checa('clube de posse: o passador encaixa mais', encaixe(passador, dnaPosse) > encaixe(motorzinho, dnaPosse), `${encaixe(passador, dnaPosse)} × ${encaixe(motorzinho, dnaPosse)}`);
checa('clube de pressão: o motor encaixa mais', encaixe(motorzinho, dnaPressao) > encaixe(passador, dnaPressao), `${encaixe(motorzinho, dnaPressao)} × ${encaixe(passador, dnaPressao)}`);
checa('encaixe fica em 0–100', [passador, motorzinho].every((p) => encaixe(p, dnaPosse) >= 0 && encaixe(p, dnaPosse) <= 100));

console.log('2) XI pelo encaixe');
const elenco: Record<string, PlayerEntity> = {};
for (const [id, pos] of [['g1', 'GOL'], ['g2', 'GOL'], ['ld', 'LD'], ['le', 'LE'], ['z1', 'ZAG'], ['z2', 'ZAG'], ['vol', 'VOL'], ['m1', 'MC'], ['pe', 'PE'], ['pd', 'PD'], ['ata', 'ATA'], ['ata2', 'ATA']] as const) {
  elenco[id] = jog(id, pos);
}
elenco.passador = passador;
elenco.motor = motorzinho;
elenco.g2 = jog('g2', 'GOL', { tatico: 80, mentalidade: 80 });
const xiPosse = escalarPeloEncaixe(elenco, dnaPosse);
const xiPressao = escalarPeloEncaixe(elenco, dnaPressao);
checa('XI tem 11', Object.keys(xiPosse).length === 11);
checa('ninguém escalado 2×', new Set(Object.values(xiPosse)).size === 11);
checa('goleiro no gol é goleiro', elenco[xiPosse.gol!]!.pos === 'GOL');
checa('goleiro melhor entra', xiPosse.gol === 'g2');
const mcsPosse = [xiPosse.mc1, xiPosse.mc2];
checa('posse escala o passador no meio', mcsPosse.includes('passador'));
checa('pressão escala o motor no meio', [xiPressao.mc1, xiPressao.mc2].includes('motor'));
checa('Diretor nunca sugere titular', !Object.values(xiPosse).includes(sugestaoDoDiretor(elenco, xiPosse, Object.keys(elenco), dnaPosse)?.id ?? 'x'));

const semPonta: Record<string, PlayerEntity> = { ...elenco };
delete semPonta.pe;
semPonta.craque = jog('craque', 'VOL', { passe: 90, tatico: 90, marcacao: 88, fisico: 88, drible: 85, mentalidade: 88 });
const xiSemPonta = escalarPeloEncaixe(semPonta, dnaPosse);
checa('slot sem dono não rouba o craque da posição dele', xiSemPonta.vol === 'craque', `vol=${xiSemPonta.vol} pe=${xiSemPonta.pe}`);
checa('slot sem dono é preenchido por improviso', !!xiSemPonta.pe && semPonta[xiSemPonta.pe]!.pos !== 'GOL');

const gemeos: Record<string, PlayerEntity> = { ...elenco };
gemeos['genesis-GEN-001'] = jog('genesis-GEN-001', 'MC', { passe: 90, tatico: 90 }, { name: 'Adrien Ayo' });
gemeos['genesis-GEN-003'] = jog('genesis-GEN-003', 'MC', { passe: 92, tatico: 92 }, { name: 'Adrien Ayo' });
const xiGemeos = Object.values(escalarPeloEncaixe(gemeos, dnaPosse));
checa('duas raridades da mesma pessoa: só uma titular', xiGemeos.filter((id) => id.startsWith('genesis-GEN-00')).length === 1);
checa('Edição Fundação = mesma pessoa da legacy', samePersonKey({ id: 'fundacao-cocito-revelacao' }) === samePersonKey({ id: 'legacy-cocito-expansao' }));

console.log('3) Venda pra várzea — travas');
const agora = Date.parse('2026-10-07T12:00:00Z');
const ident = { versao: 1, janelaAte: '2026-10-14T12:00:00Z', pacote: [] as string[] } as unknown as IdentidadeDoClube;
const quinze: Record<string, PlayerEntity> = {};
for (let i = 0; i < 14; i++) quinze[`genesis-${i}`] = jog(`genesis-${i}`, 'MC');
quinze['fundacao-pele'] = jog('fundacao-pele', 'ATA', {}, { edicaoFundacao: true });
const estado = (over: Partial<IdentidadeDoClube> = {}, players = quinze): OlefootGameState =>
  ({
    club: { id: 'c', name: 'Ole FC', shortName: 'OLE', identidade: { ...ident, pacote: Object.keys(quinze).filter((k) => k.startsWith('genesis-')), ...over } },
    finance: { ole: 0, broCents: 0, expLifetimeEarned: 0, expHistory: [] },
    players,
    lineup: { mc1: 'genesis-0' },
    manager: {},
  }) as unknown as OlefootGameState;

const s0 = estado();
const v = valorNaVarzea(quinze['genesis-0']!);
checa('várzea paga 80% do valor', v === 400_000, String(v));
const s1 = gameReducer(s0, { type: 'VENDER_PARA_VARZEA', playerId: 'genesis-0', agoraMs: agora });
checa('vende: sai do elenco', !s1.players['genesis-0'] && Object.keys(s1.players).length === 14);
checa('vende: sai do XI', !Object.values(s1.lineup).includes('genesis-0'));
checa('vende: EXP entra', s1.finance.ole === 400_000, String(s1.finance.ole));
checa('vende: sai do pacote', !s1.club.identidade!.pacote!.includes('genesis-0'));
const s2 = gameReducer(s1, { type: 'VENDER_PARA_VARZEA', playerId: 'genesis-1', agoraMs: agora });
checa('2ª venda: elenco em 13', Object.keys(s2.players).length === JANELA_ELENCO_MINIMO);
const s3 = gameReducer(s2, { type: 'VENDER_PARA_VARZEA', playerId: 'genesis-2', agoraMs: agora });
checa('abaixo de 13 não vende', s3 === s2);
checa('Edição Fundação não vende', gameReducer(s0, { type: 'VENDER_PARA_VARZEA', playerId: 'fundacao-pele', agoraMs: agora }) === s0);
checa('fora do pacote não vende', gameReducer(estado({ pacote: [] }), { type: 'VENDER_PARA_VARZEA', playerId: 'genesis-3', agoraMs: agora }).players['genesis-3'] !== undefined);
checa('janela fechada não vende', gameReducer(s0, { type: 'VENDER_PARA_VARZEA', playerId: 'genesis-3', agoraMs: Date.parse('2026-10-15T00:00:00Z') }) === s0);
checa('sem janela não vende', gameReducer(estado({ janelaAte: undefined }), { type: 'VENDER_PARA_VARZEA', playerId: 'genesis-3', agoraMs: agora }).players['genesis-3'] !== undefined);
checa('vender de novo o mesmo não paga 2×', gameReducer(s1, { type: 'VENDER_PARA_VARZEA', playerId: 'genesis-0', agoraMs: agora }) === s1);

console.log();
if (falhas) {
  console.log(`${falhas} falha(s).`);
  process.exit(1);
}
console.log('Janela da Estreia: tudo certo.');
