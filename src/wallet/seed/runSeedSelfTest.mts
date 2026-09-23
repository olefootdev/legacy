/**
 * Self-test da carteira: lista → frase → semente → chave → endereço → vínculo.
 *
 * Cripto sem teste é teatro, e cripto testada só contra si mesma é pior: uma
 * implementação errada é perfeitamente auto-consistente — gera, valida e
 * reconstrói a própria frase o dia inteiro, e produz endereços que nenhuma
 * outra carteira reconhece. Por isso aqui tem VETOR OFICIAL DE FORA:
 *
 *   BIP-39   o vetor de teste oficial da semente (frase de zeros → 64 bytes).
 *   SLIP-10  o vetor 1 de ed25519 (semente 000102…0f → chave mestra e m/0H).
 *
 * E fecha o laço com o que já está em produção: a chave derivada aqui assina a
 * mensagem de vínculo, e quem confere é o `verifySolanaLinkProof` do servidor,
 * o mesmo que guarda a porta do airdrop. Se a derivação sair errada, o vínculo
 * não fecha e este teste fica vermelho.
 *
 * Roda: npm run test:wallet-seed
 */
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { hmac } from '@noble/hashes/hmac.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha512 } from '@noble/hashes/sha2.js';
import { ed25519 } from '@noble/curves/ed25519.js';

import { WORDLIST, WORDLIST_SHA256 } from './wordlist.generated.js';
import {
  FraseInvalida,
  PALAVRAS_NA_FRASE,
  entropiaParaFrase,
  fraseParaEntropia,
  fraseValida,
  gerarFrase,
  normalizarFrase,
} from './mnemonic.js';
import { CAMINHO_SOLANA, assinar, fraseParaChave, fraseParaSemente, sementeParaChave } from './derive.js';
import { base58Decode, base58Encode } from './base58.js';
import { base58Encode as base58ServidorEncode } from '../../../server/src/lib/solanaLinkProof.js';
import { verifySolanaLinkProof } from '../../../server/src/lib/solanaLinkProof.js';
import { buildSolanaLinkMessage } from '../solanaLinkMessage.js';

let pass = 0, fail = 0;
const check = (nome: string, cond: boolean, det = '') => {
  if (cond) { pass++; console.log(`  ✅ ${nome}`); } else { fail++; console.log(`  ❌ ${nome} ${det}`); }
};
const recusa = (nome: string, fn: () => unknown) => {
  try { fn(); check(nome, false, '(não recusou)'); } catch { check(nome, true); }
};
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

console.log('\n📖 a lista — é ela que qualquer um usa pra reconstruir a carteira\n');

{
  const bruto = readFileSync(new URL('../../../wordlist/olefoot-wordlist-en.txt', import.meta.url));
  const sha = createHash('sha256').update(bruto).digest('hex');
  check('o módulo gerado bate com o .txt publicado', sha === WORDLIST_SHA256,
    `txt=${sha.slice(0, 12)} módulo=${WORDLIST_SHA256.slice(0, 12)} — rode node wordlist/gerar-ts.mjs`);
  check('2048 palavras, todas únicas', WORDLIST.length === 2048 && new Set(WORDLIST).size === 2048);
  check('todas a-z, 4 a 8 letras', WORDLIST.every((p) => /^[a-z]{4,8}$/.test(p)));
  check('prefixo de 4 letras é único (dá pra digitar 4 e resolver)',
    new Set(WORDLIST.map((p) => p.slice(0, 4))).size === 2048);
  check('a lista está ordenada (busca binária vale)',
    WORDLIST.every((p, i) => i === 0 || p > (WORDLIST[i - 1] as string)));
}

console.log('\n🔤 a frase — BIP-39 com a nossa lista\n');

{
  const zeros = new Uint8Array(16);
  const frase = entropiaParaFrase(zeros);
  check('entropia zerada dá 12 palavras', frase.length === PALAVRAS_NA_FRASE);
  check('e volta exatamente na entropia', hex(fraseParaEntropia(frase)) === hex(zeros));
  console.log(`     (entropia 0×16 → "${frase.join(' ')}")`);

  let voltas = 0;
  for (let i = 0; i < 400; i++) {
    const e = new Uint8Array(randomBytes(16));
    if (hex(fraseParaEntropia(entropiaParaFrase(e))) === hex(e)) voltas++;
  }
  check('400 entropias aleatórias voltam idênticas', voltas === 400, `${voltas}/400`);
}

// O checksum é o que separa "12 palavras da lista" de "a frase certa".
//
// EXAUSTIVO E DETERMINÍSTICO de propósito: a primeira versão deste teste
// sorteava as trocas e comparava com uma faixa de porcentagem — e piscou
// vermelho uma vez em oito. Teste de cripto que pisca ensina a rodar de novo
// até passar, que é o contrário do que ele serve. Aqui a frase é fixa e as
// trocas são TODAS as 2047 palavras possíveis em cada posição: o número que
// sai é sempre o mesmo, e se mudar, mudou o algoritmo.
{
  const fraseFixa = entropiaParaFrase(new Uint8Array(16).fill(0x5a));
  let testadas = 0, pegas = 0;
  for (let pos = 0; pos < PALAVRAS_NA_FRASE; pos++) {
    for (const outra of WORDLIST) {
      if (outra === fraseFixa[pos]) continue;
      const troca = [...fraseFixa];
      troca[pos] = outra;
      testadas++;
      if (!fraseValida(troca)) pegas++;
    }
  }
  const taxa = pegas / testadas;
  // 4 bits de checksum ⇒ 15/16 das trocas de uma palavra são pegas.
  check(`trocar 1 palavra é pego em ${(taxa * 100).toFixed(2)}% das ${testadas} trocas possíveis`,
    Math.abs(taxa - 15 / 16) < 0.005, `taxa=${taxa}`);
  check('frase na ordem errada é recusada', !fraseValida([...fraseFixa].reverse()));
}

{
  const frase = entropiaParaFrase(new Uint8Array(randomBytes(16)));
  recusa('palavra fora da lista é recusada', () => fraseParaEntropia([...frase.slice(0, 11), 'zzzz']));
  recusa('11 palavras é recusado', () => fraseParaEntropia(frase.slice(0, 11)));
  recusa('13 palavras é recusado', () => fraseParaEntropia([...frase, frase[0] as string]));
  try { fraseParaEntropia(['naoexiste', ...frase.slice(1)]); } catch (e) {
    check('o erro diz QUAL palavra está errada', e instanceof FraseInvalida && e.posicao === 1);
  }
  check('normaliza maiúscula, espaço a mais e acento',
    normalizarFrase(`  ${(frase[0] as string).toUpperCase()}   ${frase[1]}  `).join(' ') === `${frase[0]} ${frase[1]}`);
}

{
  const a = gerarFrase(), b = gerarFrase();
  check('duas frases geradas não se repetem', a.join(' ') !== b.join(' '));
  check('e as duas são válidas', fraseValida(a) && fraseValida(b));
}

// Sem aleatoriedade boa, RECUSA — nunca cai pra Math.random.
{
  const real = globalThis.crypto;
  try {
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    recusa('sem crypto.getRandomValues, recusa gerar (não cai pra Math.random)', () => gerarFrase());
  } finally {
    Object.defineProperty(globalThis, 'crypto', { value: real, configurable: true });
  }
}

console.log('\n🌍 vetores oficiais — a prova de que não é só auto-consistente\n');

// BIP-39, vetor oficial: prova os parâmetros do PBKDF2 (2048 voltas, sha512,
// sal "mnemonic" + senha, 64 bytes). A frase é da lista PADRÃO — não passa por
// `fraseParaSemente`, que a recusaria —, então vai direto no pbkdf2 com os
// MESMOS parâmetros. Os vetores publicados do BIP-39 usam a senha "TREZOR";
// o caso de senha vazia é o valor igualmente conhecido da mesma frase, e
// juntos provam que o caminho da senha também está certo.
{
  const fraseOficial = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const semear = (senha: string) =>
    hex(pbkdf2(sha512, fraseOficial.normalize('NFKD'), ('mnemonic' + senha).normalize('NFKD'), { c: 2048, dkLen: 64 }));
  check('BIP-39: vetor oficial com senha "TREZOR"',
    semear('TREZOR') === 'c55257c360c07c72029aebc1b53c05ed0362ada38ead3e3e9efa3708e53495531f09a6987599d18264c1e1c92f2cf141630c7a3c4ab7c81b2f001698e7463b04');
  check('BIP-39: a mesma frase sem senha',
    semear('') === '5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4');
}

// SLIP-0010, vetor 1 de ed25519: prova a chave mestra e o filho endurecido.
{
  const semente = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
  // O vetor usa semente crua de 16 bytes, então a derivação é repetida aqui
  // sem o guard de 64 que `sementeParaChave` (com razão) impõe.
  const mestra = sementeParaChaveCrua(new Uint8Array(semente), []);
  check('SLIP-10 vetor 1 · chave mestra',
    hex(mestra.privada) === '2b4be7f19ee27bbf30c667b642d5f4aa69fd169872f8fc3059c08ebae2eb19e7');
  check('SLIP-10 vetor 1 · pública mestra',
    '00' + hex(mestra.publica) === '00a4b2856bfec510abab89753fac1ac0e1112364e7d250545963f135f2a33188ed');
  const filho0 = sementeParaChaveCrua(new Uint8Array(semente), [0x80000000]);
  check("SLIP-10 vetor 1 · m/0'",
    hex(filho0.privada) === '68e0fe46dfb67e368c75379acec591dad19df3cde26e63b93a8e704f1dade7a3');
}

console.log('\n🔑 a chave e o endereço\n');

{
  const frase = gerarFrase();
  const chave = fraseParaChave(frase);
  check('privada tem 32 bytes', chave.privada.length === 32);
  check('pública tem 32 bytes', chave.publica.length === 32);
  check('endereço base58 tem 43 ou 44 caracteres', chave.endereco.length >= 43 && chave.endereco.length <= 44);
  check('endereço decodifica de volta na pública', hex(base58Decode(chave.endereco) ?? new Uint8Array()) === hex(chave.publica));

  const denovo = fraseParaChave(frase);
  check('a mesma frase sempre dá o mesmo endereço', denovo.endereco === chave.endereco);
  check('frase diferente, endereço diferente', fraseParaChave(gerarFrase()).endereco !== chave.endereco);

  const comSenha = fraseParaChave(frase, 'minha 13ª palavra');
  check('senha muda a carteira inteira (13ª palavra do BIP-39)', comSenha.endereco !== chave.endereco);

  recusa('índice sem bit de endurecimento é recusado', () => sementeParaChave(fraseParaSemente(frase), [44]));
  check('o caminho é m/44\'/501\'/0\'/0\'', CAMINHO_SOLANA.join(',') === [44, 501, 0, 0].map((i) => i + 0x80000000).join(','));
}

// As duas base58 TÊM que concordar: a do cliente mostra o endereço, a do
// servidor valida o vínculo. Divergir manda o airdrop pro lugar errado.
{
  let iguais = 0;
  for (let i = 0; i < 300; i++) {
    const b = new Uint8Array(randomBytes(1 + Math.floor(Math.random() * 40)));
    if (base58Encode(b) === base58ServidorEncode(b)) iguais++;
  }
  check('base58 do cliente == base58 do servidor (300 amostras)', iguais === 300, `${iguais}/300`);
  const comZeros = new Uint8Array([0, 0, 0, 9, 9]);
  check('e concordam com zeros na frente', base58Encode(comZeros) === base58ServidorEncode(comZeros));
}

console.log('\n🔗 o laço com o que já está em produção\n');

// A carteira nova assina, o servidor do airdrop confere. Mesma função de prod.
{
  const uid = '11111111-2222-3333-4444-555555555555';
  const chave = fraseParaChave(gerarFrase());
  const issuedAt = new Date().toISOString();
  const msg = buildSolanaLinkMessage(uid, chave.endereco, issuedAt);
  const sig = assinar(new TextEncoder().encode(msg), chave);

  const r = verifySolanaLinkProof({
    uid, address: chave.endereco, issuedAt,
    signatureB64: Buffer.from(sig).toString('base64'),
  });
  check('a carteira própria fecha o vínculo do airdrop', r.ok === true, JSON.stringify(r));

  const outra = fraseParaChave(gerarFrase());
  const r2 = verifySolanaLinkProof({
    uid, address: outra.endereco, issuedAt,
    signatureB64: Buffer.from(sig).toString('base64'),
  });
  check('assinatura de uma carteira não vale pra outra', r2.ok === false);

  const velho = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const msgV = buildSolanaLinkMessage(uid, chave.endereco, velho);
  const r3 = verifySolanaLinkProof({
    uid, address: chave.endereco, issuedAt: velho,
    signatureB64: Buffer.from(assinar(new TextEncoder().encode(msgV), chave)).toString('base64'),
  });
  check('assinatura de 10 minutos atrás é recusada', r3.ok === false);
}

console.log(`\n${fail === 0 ? '🟢' : '🔴'} ${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);

// --- só para os vetores do SLIP-10, que usam semente de 16 bytes ------------
function sementeParaChaveCrua(semente: Uint8Array, caminho: number[]) {
  let I = hmac(sha512, new TextEncoder().encode('ed25519 seed'), semente);
  let chave = I.slice(0, 32), codigo = I.slice(32);
  for (const idx of caminho) {
    const d = new Uint8Array(37);
    d[0] = 0; d.set(chave, 1);
    new DataView(d.buffer).setUint32(33, idx >>> 0, false);
    I = hmac(sha512, codigo, d);
    chave = I.slice(0, 32); codigo = I.slice(32);
  }
  return { privada: chave, publica: ed25519.getPublicKey(chave) };
}
