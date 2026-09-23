/**
 * Base58 (alfabeto do Bitcoin/Solana), lado cliente.
 *
 * O servidor tem a sua cópia em `server/src/lib/solanaLinkProof.ts`, e ela é
 * quem valida a prova de posse. As duas TÊM que concordar: se divergirem, o
 * endereço que a carteira mostra não é o endereço que o vínculo grava, e o
 * airdrop cai em outro lugar. O self-test compara as duas com bytes sorteados.
 */
const ALFABETO = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function base58Encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  const digitos = [0];
  for (const b of bytes) {
    let carry = b;
    for (let i = 0; i < digitos.length; i++) {
      carry += (digitos[i] as number) << 8;
      digitos[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) { digitos.push(carry % 58); carry = (carry / 58) | 0; }
  }
  // Cada 0x00 da frente vira um '1' — é o que preserva o tamanho do endereço.
  let saida = '';
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) saida += '1';
  for (let i = digitos.length - 1; i >= 0; i--) saida += ALFABETO[digitos[i] as number];
  return saida;
}

export function base58Decode(s: string): Uint8Array | null {
  if (s.length === 0) return new Uint8Array(0);
  const bytes = [0];
  for (const ch of s) {
    const v = ALFABETO.indexOf(ch);
    if (v < 0) return null;
    let carry = v;
    for (let i = 0; i < bytes.length; i++) {
      carry += (bytes[i] as number) * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) { bytes.push(carry & 0xff); carry >>= 8; }
  }
  let zeros = 0;
  for (let i = 0; i < s.length && s[i] === '1'; i++) zeros++;
  return new Uint8Array([...new Array(zeros).fill(0), ...bytes.reverse()]);
}
