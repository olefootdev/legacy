/**
 * A frase de 12 palavras (A VIRADA · V1).
 *
 * É o BIP-39 EXATAMENTE, com a lista da OLEFOOT no lugar da lista em inglês
 * padrão. Isso é de propósito, e a escolha tem os dois lados:
 *
 *   — o lado ruim: a frase NÃO abre na Phantom nem na Solflare, porque elas só
 *     conhecem a lista padrão. A tela de seed avisa isso em letra grande.
 *   — o lado bom: como o algoritmo é o padrão e a lista está publicada em
 *     `wordlist/olefoot-wordlist-en.txt` num repo público, qualquer
 *     desenvolvedor reconstrói esta carteira sem depender da OLEFOOT existir.
 *     Se a gente sumir, o dinheiro não some junto. É isso que justifica a
 *     lista própria; sem a publicação, seria só aprisionamento.
 *
 * Nada aqui guarda, envia ou registra a frase. Entra e sai como valor.
 */
import { sha256 } from '@noble/hashes/sha2.js';
import { INDICE_DA_PALAVRA, WORDLIST } from './wordlist.generated.js';

export const PALAVRAS_NA_FRASE = 12;
export const BITS_DE_ENTROPIA = 128;
const BYTES_DE_ENTROPIA = BITS_DE_ENTROPIA / 8;          // 16
const BITS_DE_CHECKSUM = BITS_DE_ENTROPIA / 32;          // 4
const BITS_POR_PALAVRA = 11;                             // 2^11 = 2048

/**
 * Aleatoriedade do sistema, e SÓ dela.
 *
 * Se `crypto.getRandomValues` não existir, isto estoura em vez de cair pra
 * `Math.random()`. Um fallback silencioso aqui geraria carteiras adivinháveis
 * que funcionam perfeitamente — o pior tipo de defeito, porque não aparece em
 * teste nenhum: a carteira abre, recebe, envia, e alguém esvazia depois.
 */
function sortearBytes(n: number): Uint8Array {
  const c = globalThis.crypto;
  if (!c?.getRandomValues) {
    throw new Error('sem crypto.getRandomValues — recuso gerar frase com aleatoriedade fraca');
  }
  return c.getRandomValues(new Uint8Array(n));
}

function paraBits(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += b.toString(2).padStart(8, '0');
  return s;
}

/** Os primeiros ENT/32 bits do sha256 da entropia. */
function checksumEmBits(entropia: Uint8Array): string {
  return paraBits(sha256(entropia)).slice(0, BITS_DE_CHECKSUM);
}

/** Entropia (16 bytes) → as 12 palavras. */
export function entropiaParaFrase(entropia: Uint8Array): string[] {
  if (entropia.length !== BYTES_DE_ENTROPIA) {
    throw new RangeError(`entropia tem que ter ${BYTES_DE_ENTROPIA} bytes, veio ${entropia.length}`);
  }
  const bits = paraBits(entropia) + checksumEmBits(entropia);
  const palavras: string[] = [];
  for (let i = 0; i < bits.length; i += BITS_POR_PALAVRA) {
    palavras.push(WORDLIST[parseInt(bits.slice(i, i + BITS_POR_PALAVRA), 2)] as string);
  }
  return palavras;
}

/** Uma frase nova, do gerador do sistema. */
export function gerarFrase(): string[] {
  return entropiaParaFrase(sortearBytes(BYTES_DE_ENTROPIA));
}

/**
 * Arruma o que a pessoa digitou: minúsculas, sem acento, espaço colapsado.
 * Não valida — só normaliza, pra `fraseParaEntropia` julgar o conteúdo e não a
 * digitação.
 */
export function normalizarFrase(texto: string): string[] {
  return texto
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export class FraseInvalida extends Error {
  constructor(public readonly motivo: string, public readonly posicao?: number) {
    super(motivo);
    this.name = 'FraseInvalida';
  }
}

/**
 * Frase → entropia, conferindo o checksum.
 *
 * O checksum é o que separa "12 palavras da lista" de "uma frase de verdade":
 * sem ele, um erro de digitação que troque uma palavra por outra da lista abre
 * uma carteira VAZIA e diferente, e a pessoa acha que perdeu o dinheiro.
 * Com ele, 15 de cada 16 erros são pegos na hora.
 */
export function fraseParaEntropia(palavras: readonly string[]): Uint8Array {
  if (palavras.length !== PALAVRAS_NA_FRASE) {
    throw new FraseInvalida(`a frase tem ${palavras.length} palavras, precisa de ${PALAVRAS_NA_FRASE}`);
  }

  let bits = '';
  palavras.forEach((p, i) => {
    const idx = INDICE_DA_PALAVRA.get(p);
    if (idx === undefined) throw new FraseInvalida(`"${p}" não está na lista da OLEFOOT`, i + 1);
    bits += idx.toString(2).padStart(BITS_POR_PALAVRA, '0');
  });

  const entropia = new Uint8Array(BYTES_DE_ENTROPIA);
  for (let i = 0; i < BYTES_DE_ENTROPIA; i++) {
    entropia[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }

  if (bits.slice(BITS_DE_ENTROPIA) !== checksumEmBits(entropia)) {
    throw new FraseInvalida('a frase não fecha — confira as palavras e a ordem');
  }
  return entropia;
}

export function fraseValida(palavras: readonly string[]): boolean {
  try { fraseParaEntropia(palavras); return true; } catch { return false; }
}
