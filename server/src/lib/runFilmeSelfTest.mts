/**
 * PARTIDA VIVA — Fase 7: conferência do filme que vai pro servidor.
 * npm run test:filme
 */
import { avisoDoAdversario, conferirFilme, elencoBate, TETO_DO_FILME } from './filme.js';

let ok = 0, falhas = 0;
function confere(cond: boolean, msg: string) {
  console.log(`  ${cond ? '✅' : '❌'} ${msg}`);
  if (cond) ok++; else falhas++;
}

const dono = '11111111-1111-4111-8111-111111111111';
const rival = '22222222-2222-4222-8222-222222222222';
const fichas = [
  ...Array.from({ length: 11 }, (_, i) => ({ id: `meu-${i}`, lado: 'home' })),
  ...Array.from({ length: 11 }, (_, i) => ({ id: `dele-${i}`, lado: 'away' })),
];
const filme = (extra: Record<string, unknown> = {}) => ({
  v: 1, seed: `OLE-RIV-${rival}-1791605189377`, siglaCasa: 'OLE', siglaFora: 'RIV', nomeCasa: 'Ole FC', nomeFora: 'Rival FC',
  placarCasa: 2, placarFora: 1, fichas, trechos: [{ comEntrada: true, roteiro: [{ p: 0, q: { minuto: 1 } }] }], ...extra,
});

console.log('\n🎬 Filme: formato e tamanho');
confere(conferirFilme({ filme: filme(), adversario: rival }, dono).ok, 'filme bom com adversário da seed passa');
confere(conferirFilme({ filme: filme(), adversario: null }, dono).ok, 'filme sem adversário (bot, liga) passa — só não avisa ninguém');
confere(!conferirFilme(null, dono).ok, 'corpo vazio não passa');
confere(!conferirFilme({ filme: filme({ v: 2 }) }, dono).ok, 'versão desconhecida não passa');
confere(!conferirFilme({ filme: filme({ trechos: [] }) }, dono).ok, 'filme sem trecho não passa');
confere(!conferirFilme({ filme: filme({ placarCasa: -1 }) }, dono).ok, 'placar negativo não passa');
confere(!conferirFilme({ filme: filme({ placarFora: 99 }) }, dono).ok, 'placar absurdo não passa');
const gordo = filme({ trechos: [{ comEntrada: false, roteiro: [{ p: 0, q: { x: 'a'.repeat(TETO_DO_FILME) } }] }] });
confere(!conferirFilme({ filme: gordo }, dono).ok, `filme acima de ${TETO_DO_FILME} bytes não passa`);

console.log('\n🎯 Filme: quem é o adversário');
const outro = '33333333-3333-4333-8333-333333333333';
const r1 = conferirFilme({ filme: filme(), adversario: outro }, dono);
confere(!r1.ok && /desta partida/.test(r1.erro), 'adversário que não está na seed não passa (não dá pra avisar um manager qualquer)');
confere(!conferirFilme({ filme: filme({ seed: `OLE-OLE-${dono}-1` }), adversario: dono }, dono).ok, 'o dono não é adversário de si mesmo');
confere(!conferirFilme({ filme: filme(), adversario: 'bot-ole-fc' }, dono).ok, 'id que não é conta (bot) não passa como adversário');

console.log('\n👥 Filme: o time de fora é o elenco do adversário');
const elenco = Array.from({ length: 18 }, (_, i) => `dele-${i}`);
confere(elencoBate(filme(), elenco), '11 de 11 do elenco dele: bate');
confere(elencoBate(filme(), elenco.slice(3)), '8 de 11 (mudou o elenco depois): ainda bate');
confere(!elencoBate(filme(), elenco.slice(4)), '7 de 11: não bate — não avisa');
confere(!elencoBate(filme(), ['meu-1', 'meu-2']), 'elenco de outro time: não bate');

console.log('\n🔔 Aviso pro adversário (o placar do ponto de vista DELE)');
const a = avisoDoAdversario({ siglaCasa: 'OLE', siglaFora: 'RIV', nomeCasa: 'Ole FC', nomeFora: 'Rival FC', placarCasa: 2, placarFora: 1 });
confere(a.titulo === 'Seu time jogou: RIV 1 × 2 OLE', `título: "${a.titulo}"`);
confere(/perdeu/.test(a.mensagem), `mensagem: "${a.mensagem}"`);

console.log(`\n${falhas ? '🔴' : '🟢'} ${ok} passaram, ${falhas} falharam`);
if (falhas) process.exit(1);
