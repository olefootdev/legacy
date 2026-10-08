/**
 * Self-test da identidade do clube (Fase 0 da "Fundação do Clube").
 * Rodar: npm run test:identidade
 */
import { readDna } from '../supabase/functions/global-league-tick/_dnaModel';
import {
  centrarDna,
  dnaEfetivo,
  identidadeSugerida,
  falaDoCoach,
  conflitoDeEscolhas,
  dnaDaIdentidade,
  dnaDoClubeParaMotor,
  EIXOS_DNA,
  pontosValidos,
  type IdentidadeDoClube,
} from '../src/club/identidade';

let falhas = 0;
function checa(nome: string, ok: boolean, detalhe = '') {
  console.log(`${ok ? '  OK  ' : '  FALHA '}${nome}${detalhe ? `  ${detalhe}` : ''}`);
  if (!ok) falhas++;
}

const base: IdentidadeDoClube = {
  versao: 1,
  pontos: { tatico: 20, fairplay: 10, criativo: 20, ataque: 20, defesa: 15, mentalidade: 15 },
  formacao: '4-3-3',
  estilo: 'posse',
  tecnico: 'guardiola',
  historico: { time: 'barcelona', temporada: '2010–11' },
  treino: 'flexivel',
  disponibilidade: 'diario',
  camisa: { padrao: 'listras', primaria: '#B3121B', secundaria: '#0D0D0C', calcao: '#EEE9DF' },
  frase: 'Ninguém desce o morro de graça.',
  pais: 'Brasil',
  estado: 'SP',
  fundadoEm: '2026-10-07T00:00:00.000Z',
};

console.log('1) 100 pontos');
checa('soma 100 de 5 em 5 é válida', pontosValidos(base.pontos));
checa('soma 95 é inválida', !pontosValidos({ ...base.pontos, tatico: 15 }));
checa('passo fora de 5 é inválido', !pontosValidos({ ...base.pontos, tatico: 22, fairplay: 8 }));
checa('negativo é inválido', !pontosValidos({ ...base.pontos, tatico: -5, fairplay: 35 }));

console.log('2) DNA é orçamento');
const d = dnaDaIdentidade(base);
const media = EIXOS_DNA.reduce((s, k) => s + d[k], 0) / EIXOS_DNA.length;
checa('média dos eixos ≈ 0.5', Math.abs(media - 0.5) < 0.03, media.toFixed(3));
checa('todo eixo entre 0.12 e 0.88', EIXOS_DNA.every((k) => d[k] >= 0.12 && d[k] <= 0.88));
const tudoAlto = centrarDna({ posse: 0.9, pressao: 0.9, vertical: 0.9, criatividade: 0.9, solidez: 0.9, disciplina: 0.9, intensidade: 0.9 });
checa('tudo em 0.9 vira neutro', EIXOS_DNA.every((k) => Math.abs(tudoAlto[k] - 0.5) < 1e-9));

console.log('3) As escolhas mexem no DNA');
const posse = dnaDaIdentidade({ ...base, estilo: 'posse', tecnico: 'guardiola' });
const reativo = dnaDaIdentidade({ ...base, estilo: 'reativo', tecnico: 'mourinho', historico: { time: 'atletico', temporada: '2013–14' } });
checa('posse/Guardiola tem mais posse que reativo/Mourinho', posse.posse > reativo.posse, `${posse.posse.toFixed(2)} × ${reativo.posse.toFixed(2)}`);
checa('reativo/Mourinho tem mais solidez', reativo.solidez > posse.solidez, `${reativo.solidez.toFixed(2)} × ${posse.solidez.toFixed(2)}`);
const fair = dnaDaIdentidade({ ...base, pontos: { tatico: 15, fairplay: 35, criativo: 15, ataque: 15, defesa: 10, mentalidade: 10 } });
checa('35 em fair play sobe a disciplina', fair.disciplina > d.disciplina, `${fair.disciplina.toFixed(2)} × ${d.disciplina.toFixed(2)}`);
const rigido = dnaDaIdentidade({ ...base, treino: 'rigido' });
checa('treino rígido sobe a disciplina', rigido.disciplina > d.disciplina);

console.log('4) Payload do motor');
checa('clube sem fundação = null (neutro)', dnaDoClubeParaMotor(undefined) === null);
checa('pontos inválidos = null (não manda lixo)', dnaDoClubeParaMotor({ ...base, pontos: { ...base.pontos, tatico: 15 } }) === null);
const m = dnaDoClubeParaMotor(base);
checa('payload tem os 7 eixos com 3 casas', !!m && EIXOS_DNA.every((k) => Math.round(m[k] * 1000) === m[k] * 1000));

console.log('5) Conflito explicado');
checa('Mourinho + posse avisa', !!conflitoDeEscolhas({ ...base, estilo: 'posse', tecnico: 'mourinho' }));
checa('Guardiola + posse não avisa', conflitoDeEscolhas(base) === null);

console.log('6) A Prancheta mostra o que o motor joga');
for (const coracao of ['Flamengo', 'Corinthians', 'Santos', 'Barcelona', 'Time qualquer']) {
  const sug = identidadeSugerida(coracao);
  const payload = dnaDoClubeParaMotor({ ...base, ...sug })!;
  const prancheta = dnaEfetivo(payload);
  const motor = readDna(payload)!;
  const igual = EIXOS_DNA.every((k) => Math.abs(prancheta[k] - motor[k]) < 1e-9);
  checa(`"Monta pra mim" ${coracao}: pontos válidos e Prancheta = motor`, pontosValidos(sug.pontos) && igual);
}
const fala = falaDoCoach(base, (pt) => pt);
checa('Coach fala uma frase', fala.texto.length > 10 && !fala.alerta, fala.texto);

console.log();
if (falhas) {
  console.log(`${falhas} falha(s).`);
  process.exit(1);
}
console.log('Identidade do clube: tudo certo.');
