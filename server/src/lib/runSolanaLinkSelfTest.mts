/**
 * Self-test da prova de posse de carteira Solana (A VIRADA · C1).
 *
 * Guarda a porta do vínculo: esse endereço é onde o airdrop da v1 cai e é a
 * ponte com olefoot.com/wallet. Antes, `link_my_solana_wallet` aceitava
 * qualquer endereço bem formado, sem assinatura.
 *
 * Gera chaves ed25519 reais (as mesmas de uma carteira Solana), assina como a
 * carteira assinaria e tenta todos os jeitos de enganar a verificação.
 * Roda: npm run test:solana-link
 */
import { generateKeyPairSync, sign } from 'node:crypto';
import {
  base58Decode,
  base58Encode,
  buildSolanaLinkMessage as serverMessage,
  solanaAddressToPublicKey,
  verifySolanaLinkProof,
} from './solanaLinkProof.js';
import { buildSolanaLinkMessage as clientMessage } from '../../../src/wallet/solanaLinkMessage.js';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${detail}`); }
}

function newWallet() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const jwk = publicKey.export({ format: 'jwk' }) as { x: string };
  const raw = Buffer.from(jwk.x, 'base64url');
  return { address: base58Encode(raw), privateKey };
}

function signB64(privateKey: ReturnType<typeof newWallet>['privateKey'], bytes: Uint8Array): string {
  return sign(null, bytes, privateKey).toString('base64');
}

console.log('\n🔐 solanaLinkProof — o vínculo só entra com assinatura\n');

const UID = '43d30ab1-b0ed-439f-a238-e64de7357b52';
const OTHER_UID = '11111111-2222-3333-4444-555555555555';
const now = Date.parse('2026-09-19T12:00:00.000Z');
const issuedAt = new Date(now - 30_000).toISOString();

// ── formato ───────────────────────────────────────────────────────────────
check('cliente e servidor geram a MESMA mensagem',
  clientMessage(UID, 'abc', issuedAt) === serverMessage(UID, 'abc', issuedAt));

const w = newWallet();
check('base58 ida e volta devolve os 32 bytes da chave',
  solanaAddressToPublicKey(w.address)?.length === 32
  && base58Encode(base58Decode(w.address)!) === w.address);
check('endereço conhecido da rede (System Program) decodifica',
  base58Decode('11111111111111111111111111111111')?.length === 32);
check('endereço com caractere fora do base58 é recusado',
  solanaAddressToPublicKey('0OIl' + w.address.slice(4)) === null);

// ── caminho feliz ─────────────────────────────────────────────────────────
const msg = new TextEncoder().encode(serverMessage(UID, w.address, issuedAt));
const good = verifySolanaLinkProof({ uid: UID, address: w.address, issuedAt, signatureB64: signB64(w.privateKey, msg), now });
check('assinatura certa da própria carteira passa', good.ok, JSON.stringify(good));

const prefixed = new Uint8Array([...new TextEncoder().encode('\xffsolana offchain'), ...msg]);
const withPrefix = verifySolanaLinkProof({
  uid: UID, address: w.address, issuedAt,
  signatureB64: signB64(w.privateKey, prefixed),
  signedMessageB64: Buffer.from(prefixed).toString('base64'), now,
});
check('carteira que prefixa a mensagem (off-chain header) passa', withPrefix.ok, JSON.stringify(withPrefix));

// ── tentativas de enganar ─────────────────────────────────────────────────
const intruder = newWallet();
const stolen = verifySolanaLinkProof({
  uid: UID, address: w.address, issuedAt,
  signatureB64: signB64(intruder.privateKey, msg), now,
});
check('assinar com OUTRA carteira o endereço da vítima é recusado', !stolen.ok);

const otherAccount = verifySolanaLinkProof({
  uid: OTHER_UID, address: w.address, issuedAt,
  signatureB64: signB64(w.privateKey, msg), now,
});
check('reusar a assinatura em OUTRA conta é recusado', !otherAccount.ok);

const old = new Date(now - 6 * 60_000).toISOString();
const expired = verifySolanaLinkProof({
  uid: UID, address: w.address, issuedAt: old,
  signatureB64: signB64(w.privateKey, new TextEncoder().encode(serverMessage(UID, w.address, old))), now,
});
check('assinatura de mais de 5 minutos é recusada', !expired.ok);

const future = new Date(now + 10 * 60_000).toISOString();
const fromFuture = verifySolanaLinkProof({
  uid: UID, address: w.address, issuedAt: future,
  signatureB64: signB64(w.privateKey, new TextEncoder().encode(serverMessage(UID, w.address, future))), now,
});
check('data de emissão no futuro é recusada', !fromFuture.ok);

const otherText = new TextEncoder().encode('Transferir tudo para mim\n' + serverMessage(UID, w.address, issuedAt).slice(0, 10));
const tampered = verifySolanaLinkProof({
  uid: UID, address: w.address, issuedAt,
  signatureB64: signB64(w.privateKey, otherText),
  signedMessageB64: Buffer.from(otherText).toString('base64'), now,
});
check('mensagem assinada diferente da esperada é recusada', !tampered.ok);

const longPrefix = new Uint8Array([...new Uint8Array(200).fill(65), ...msg]);
const bigPrefix = verifySolanaLinkProof({
  uid: UID, address: w.address, issuedAt,
  signatureB64: signB64(w.privateKey, longPrefix),
  signedMessageB64: Buffer.from(longPrefix).toString('base64'), now,
});
check('prefixo maior que 64 bytes é recusado', !bigPrefix.ok);

const garbage = verifySolanaLinkProof({ uid: UID, address: w.address, issuedAt, signatureB64: 'AAAA', now });
check('assinatura com tamanho errado é recusada', !garbage.ok);

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);
