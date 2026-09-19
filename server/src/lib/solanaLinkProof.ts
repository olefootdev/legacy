/**
 * Prova de posse de carteira Solana (A VIRADA · C1).
 *
 * O manager assina, na própria carteira, uma mensagem que amarra o endereço à
 * conta do jogo e a um instante. O servidor reconstrói a MESMA mensagem a partir
 * do token da sessão (uid), do endereço e do instante, e confere a assinatura
 * ed25519 contra a chave pública — que na Solana É o endereço (base58).
 *
 * Sem estado no servidor: não há nonce guardado. Replay não serve pra nada — a
 * mensagem carrega o uid, e o servidor só aceita quando o uid da mensagem é o
 * da sessão que chama; dentro da janela de 5 min, repetir só revincula a mesma
 * carteira à mesma conta.
 *
 * ⚠️ `buildSolanaLinkMessage` tem uma cópia em src/supabase/solanaWallet.ts.
 * As duas precisam gerar os MESMOS bytes — mudou uma, muda a outra
 * (o self-test `npm run test:solana-link` confere o formato).
 */
import { createPublicKey, verify } from 'node:crypto';

export const LINK_WINDOW_MS = 5 * 60 * 1000;
const FUTURE_SKEW_MS = 60 * 1000;
/** Carteiras podem prefixar a mensagem (ex.: cabeçalho de off-chain message). */
const MAX_WALLET_PREFIX_BYTES = 64;

export function buildSolanaLinkMessage(uid: string, address: string, issuedAt: string): string {
  return [
    'OLEFOOT · vincular carteira',
    '',
    'Esta assinatura prova que a carteira é sua. Não move fundos e não custa taxa.',
    '',
    `Conta: ${uid}`,
    `Carteira: ${address}`,
    `Emitido em: ${issuedAt}`,
  ].join('\n');
}

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function base58Decode(s: string): Uint8Array | null {
  const bytes: number[] = [];
  for (const ch of s) {
    const v = B58.indexOf(ch);
    if (v < 0) return null;
    let carry = v;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const ch of s) {
    if (ch !== '1') break;
    bytes.push(0);
  }
  return Uint8Array.from(bytes.reverse());
}

export function base58Encode(bytes: Uint8Array): string {
  const digits: number[] = [];
  for (const b of bytes) {
    let carry = b;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = '';
  for (const b of bytes) {
    if (b !== 0) break;
    out += '1';
  }
  for (let i = digits.length - 1; i >= 0; i--) out += B58[digits[i]];
  return out;
}

/** Endereço Solana = chave pública ed25519 de 32 bytes em base58. */
export function solanaAddressToPublicKey(address: string): Uint8Array | null {
  if (typeof address !== 'string' || address.length < 32 || address.length > 44) return null;
  const raw = base58Decode(address);
  return raw && raw.length === 32 ? raw : null;
}

function endsWith(haystack: Uint8Array, needle: Uint8Array): boolean {
  if (needle.length > haystack.length) return false;
  const off = haystack.length - needle.length;
  for (let i = 0; i < needle.length; i++) if (haystack[off + i] !== needle[i]) return false;
  return true;
}

export type LinkProofResult =
  | { ok: true; message: string }
  | { ok: false; reason: string };

/**
 * Confere a prova. `signedMessageB64` é o que a carteira diz ter assinado (o
 * padrão da Solana permite que ela prefixe); se vier vazio, usa a mensagem
 * reconstruída. A mensagem reconstruída tem que estar INTEIRA no fim do que foi
 * assinado — prefixo curto é tolerado, qualquer outra diferença não.
 */
export function verifySolanaLinkProof(input: {
  uid: string;
  address: string;
  issuedAt: string;
  signatureB64: string;
  signedMessageB64?: string | null;
  now?: number;
}): LinkProofResult {
  const pub = solanaAddressToPublicKey(input.address);
  if (!pub) return { ok: false, reason: 'endereço Solana inválido' };

  const issued = Date.parse(input.issuedAt);
  if (!Number.isFinite(issued)) return { ok: false, reason: 'data de emissão inválida' };
  const now = input.now ?? Date.now();
  if (issued > now + FUTURE_SKEW_MS || now - issued > LINK_WINDOW_MS) {
    return { ok: false, reason: 'assinatura expirada — tente de novo' };
  }

  let sig: Buffer;
  try {
    sig = Buffer.from(input.signatureB64, 'base64');
  } catch {
    return { ok: false, reason: 'assinatura malformada' };
  }
  if (sig.length !== 64) return { ok: false, reason: 'assinatura malformada' };

  const message = buildSolanaLinkMessage(input.uid, input.address, input.issuedAt);
  const expected = new TextEncoder().encode(message);
  let signed: Uint8Array = expected;
  if (input.signedMessageB64) {
    signed = Buffer.from(input.signedMessageB64, 'base64');
    if (!endsWith(signed, expected) || signed.length - expected.length > MAX_WALLET_PREFIX_BYTES) {
      return { ok: false, reason: 'a carteira assinou uma mensagem diferente' };
    }
  }

  try {
    const key = createPublicKey({
      key: { kty: 'OKP', crv: 'Ed25519', x: Buffer.from(pub).toString('base64url') },
      format: 'jwk',
    });
    if (!verify(null, signed, key, sig)) return { ok: false, reason: 'assinatura não confere com a carteira' };
  } catch {
    return { ok: false, reason: 'assinatura não confere com a carteira' };
  }
  return { ok: true, message };
}
