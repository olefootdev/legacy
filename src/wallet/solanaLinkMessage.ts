/**
 * Mensagem que o manager assina pra provar que a carteira Solana é dele
 * (A VIRADA · C1). Fica neste módulo sem dependência pra poder ser comparada
 * byte a byte com a cópia do servidor pelo self-test.
 *
 * ⚠️ Cópia de `buildSolanaLinkMessage` em server/src/lib/solanaLinkProof.ts.
 * Mudou uma, muda a outra — `npm run test:solana-link` quebra se divergirem.
 */
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
