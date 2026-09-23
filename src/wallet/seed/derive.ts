/**
 * Frase → semente → chave da Solana (A VIRADA · V1).
 *
 * Dois padrões, os dois seguidos à risca pra a carteira ser reconstruível por
 * quem não tem o nosso código:
 *
 *   BIP-39  frase + senha → semente de 64 bytes, via PBKDF2-HMAC-SHA512,
 *           2048 voltas, sal "mnemonic" + senha.
 *   SLIP-10 semente → chave ed25519, caminho m/44'/501'/0'/0' (o caminho que
 *           Phantom, Solflare e Backpack usam pra primeira conta Solana).
 *
 * Em ed25519 TODA derivação é endurecida — não existe derivação pública, e é
 * por isso que não tem chave estendida pública aqui. Índice sem o bit de
 * endurecimento é recusado em vez de "consertado" em silêncio.
 *
 * ⚠️ A chave privada nasce e morre nesta função e em quem a chamar. Nada aqui
 * escreve em disco, em localStorage ou em rede — e nada aqui deve passar a
 * escrever. O modelo inteiro da carteira depende disso.
 */
import { ed25519 } from '@noble/curves/ed25519.js';
import { hmac } from '@noble/hashes/hmac.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha512 } from '@noble/hashes/sha2.js';
import { base58Encode } from './base58.js';
import { PALAVRAS_NA_FRASE, fraseParaEntropia } from './mnemonic.js';

const ENDURECIDO = 0x8000_0000;
/** m/44'/501'/0'/0' — a primeira conta Solana, igual às carteiras conhecidas. */
export const CAMINHO_SOLANA = [44, 501, 0, 0].map((i) => i + ENDURECIDO);

/**
 * BIP-39: frase → semente de 64 bytes.
 *
 * A frase é validada ANTES: sem isso, uma frase com erro de digitação geraria
 * uma semente perfeitamente válida de uma carteira vazia, e a pessoa concluiria
 * que perdeu o dinheiro. O checksum existe pra transformar isso em erro.
 *
 * A `senha` é a 13ª palavra do BIP-39: muda a carteira inteira e não é
 * recuperável. Quem não usar, deixa vazio.
 */
export function fraseParaSemente(palavras: readonly string[], senha = ''): Uint8Array {
  fraseParaEntropia(palavras);
  const frase = palavras.join(' ').normalize('NFKD');
  const sal = ('mnemonic' + senha).normalize('NFKD');
  return pbkdf2(sha512, frase, sal, { c: 2048, dkLen: 64 });
}

interface No { chave: Uint8Array; codigo: Uint8Array }

function noMestre(semente: Uint8Array): No {
  const I = hmac(sha512, new TextEncoder().encode('ed25519 seed'), semente);
  return { chave: I.slice(0, 32), codigo: I.slice(32) };
}

function filho(pai: No, indice: number): No {
  if ((indice & ENDURECIDO) === 0) {
    throw new RangeError(`ed25519 só deriva endurecido; índice ${indice} não tem o bit`);
  }
  const dados = new Uint8Array(1 + 32 + 4);
  dados[0] = 0x00;
  dados.set(pai.chave, 1);
  new DataView(dados.buffer).setUint32(33, indice >>> 0, false);
  const I = hmac(sha512, pai.codigo, dados);
  return { chave: I.slice(0, 32), codigo: I.slice(32) };
}

export interface ChaveSolana {
  /** 32 bytes. É o segredo: não logar, não persistir, não mandar pra lugar nenhum. */
  readonly privada: Uint8Array;
  readonly publica: Uint8Array;
  /** O endereço em base58 — o que se mostra, compartilha e vincula. */
  readonly endereco: string;
}

/** SLIP-10 ed25519 no caminho dado (por padrão, a primeira conta Solana). */
export function sementeParaChave(semente: Uint8Array, caminho: readonly number[] = CAMINHO_SOLANA): ChaveSolana {
  if (semente.length !== 64) throw new RangeError(`semente tem que ter 64 bytes, veio ${semente.length}`);
  let no = noMestre(semente);
  for (const i of caminho) no = filho(no, i);
  const publica = ed25519.getPublicKey(no.chave);
  return { privada: no.chave, publica, endereco: base58Encode(publica) };
}

/** O caminho inteiro, do que a pessoa escreveu ao endereço. */
export function fraseParaChave(palavras: readonly string[], senha = ''): ChaveSolana {
  return sementeParaChave(fraseParaSemente(palavras, senha));
}

/** Assina com a chave derivada — é o que prova a posse no vínculo do airdrop. */
export function assinar(mensagem: Uint8Array, chave: ChaveSolana): Uint8Array {
  return ed25519.sign(mensagem, chave.privada);
}

export { PALAVRAS_NA_FRASE };
