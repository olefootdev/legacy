/**
 * CRIA O $OLEFOOT NA SOLANA — Token-2022, a régua é docs/TOKENOMICS.md (Rev 6).
 *
 *   Devnet (prova, chave descartável gerada na hora):
 *     npx tsx scripts/token/criar-olefoot-mint.mts --rede devnet
 *
 *   Mainnet (OPERAÇÃO DO FUNDADOR — ver docs/TOKEN-LAUNCH-RUNBOOK.md):
 *     npx tsx scripts/token/criar-olefoot-mint.mts --rede mainnet \
 *       --pagador ~/.config/solana/olefoot-deployer.json --travar-supply
 *
 * O que o script faz, na ordem:
 *   1. cria o mint Token-2022 com DUAS extensões:
 *      · TransferFeeConfig — 5% (500 bps) SEM teto, pra carteira do pagador
 *        (a decisão do fundador de 2026-09-28; mover autoridades pro multisig
 *        é passo do runbook);
 *      · MetadataPointer + metadata NO PRÓPRIO mint (nome/símbolo/URI) —
 *        carteiras e explorers leem direto, sem programa externo;
 *   2. cunha o SUPPLY INTEIRO (5.000.000.000 × 10⁹) na ATA da tesouraria
 *      (default: o pagador). Os baldes saem DEPOIS, por transferência — a
 *      distribuição é outra operação (runbook §3);
 *   3. com --travar-supply, REVOGA a mint authority: supply fixo pra sempre,
 *      verificável por qualquer um. Freeze authority já nasce nula (ninguém
 *      congela conta de ninguém).
 *   4. relê TUDO da chain e confere (fee bps, supply, metadata) antes de
 *      declarar sucesso. Endereços ficam em scripts/token/mint.out.<rede>.json.
 *
 * 🔒 Este script NUNCA inventa chave pra mainnet: sem --pagador, mainnet
 * aborta. Na devnet ele gera uma descartável e pede airdrop.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction, clusterApiUrl,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  AuthorityType, ExtensionType, TOKEN_2022_PROGRAM_ID, TYPE_SIZE, LENGTH_SIZE,
  createAssociatedTokenAccountIdempotentInstruction, createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction, createInitializeTransferFeeConfigInstruction,
  createMintToInstruction, createSetAuthorityInstruction, getAssociatedTokenAddressSync,
  getMint, getMintLen, getTokenMetadata, getTransferFeeConfig,
} from '@solana/spl-token';
import { createInitializeInstruction, pack, type TokenMetadata } from '@solana/spl-token-metadata';

// ─── a régua (TOKENOMICS.md Rev 6 — número daqui não muda sem mudar o doc) ──
const SUPPLY_TOKENS = 5_000_000_000n;
const DECIMAIS = 9;
const UNIDADE = 10n ** BigInt(DECIMAIS);
const TAXA_BPS = 500; // 5%, sem teto por transferência
const SEM_TETO_DE_TAXA = 2n ** 64n - 1n; // u64::MAX = "5% literal em qualquer tamanho"

const args = process.argv.slice(2);
const flag = (nome: string): string | null => {
  const i = args.indexOf(nome);
  return i >= 0 ? (args[i + 1] ?? null) : null;
};
const rede = (flag('--rede') ?? 'devnet') as 'devnet' | 'mainnet';
const travarSupply = args.includes('--travar-supply');
const pagadorPath = flag('--pagador');
const tesourariaArg = flag('--tesouraria');

if (rede !== 'devnet' && rede !== 'mainnet') {
  console.error('--rede devnet|mainnet');
  process.exit(1);
}
if (rede === 'mainnet' && !pagadorPath) {
  console.error('🔒 mainnet exige --pagador <keypair.json> (a chave é do FUNDADOR; este script não gera).');
  process.exit(1);
}

const rpc = process.env.SOLANA_RPC?.trim()
  || (rede === 'mainnet' ? clusterApiUrl('mainnet-beta') : clusterApiUrl('devnet'));
const conn = new Connection(rpc, 'confirmed');

// ─── pagador ────────────────────────────────────────────────────────────────
let pagador: Keypair;
if (pagadorPath) {
  pagador = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(pagadorPath.replace('~', process.env.HOME ?? ''), 'utf8'))));
} else {
  pagador = Keypair.generate();
  console.log(`[devnet] chave descartável: ${pagador.publicKey.toBase58()}`);
  console.log('[devnet] pedindo airdrop de 2 SOL…');
  let ok = false;
  for (let i = 0; i < 4 && !ok; i++) {
    try {
      const sig = await conn.requestAirdrop(pagador.publicKey, 2_000_000_000);
      await conn.confirmTransaction(sig, 'confirmed');
      ok = true;
    } catch (e) {
      console.log(`  tentativa ${i + 1} falhou (${e instanceof Error ? e.message.slice(0, 80) : e}); aguardando…`);
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
  if (!ok) {
    console.error('Airdrop da devnet indisponível agora. Alternativa: https://faucet.solana.com → mandar SOL pra chave acima, salvar com --pagador.');
    process.exit(1);
  }
}
const tesouraria = tesourariaArg ? new PublicKey(tesourariaArg) : pagador.publicKey;

// ─── metadata (pinada/servida antes; ver scripts/token/metadata.out.json) ──
const metaCfg = JSON.parse(readFileSync('scripts/token/metadata.out.json', 'utf8')) as { name: string; symbol: string; uri: string };
const mint = Keypair.generate();
const metadata: TokenMetadata = {
  mint: mint.publicKey,
  name: metaCfg.name,
  symbol: metaCfg.symbol,
  uri: metaCfg.uri,
  additionalMetadata: [],
};

// ─── tx 1: conta do mint + extensões + metadata ─────────────────────────────
const extensoes = [ExtensionType.TransferFeeConfig, ExtensionType.MetadataPointer];
const mintLen = getMintLen(extensoes);
const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
const lamports = await conn.getMinimumBalanceForRentExemption(mintLen + metadataLen);

const tx1 = new Transaction().add(
  SystemProgram.createAccount({
    fromPubkey: pagador.publicKey,
    newAccountPubkey: mint.publicKey,
    space: mintLen,
    lamports,
    programId: TOKEN_2022_PROGRAM_ID,
  }),
  // Ordem importa: extensões ANTES do initializeMint.
  createInitializeTransferFeeConfigInstruction(
    mint.publicKey,
    pagador.publicKey,            // autoridade pra MUDAR a taxa (runbook: multisig)
    pagador.publicKey,            // autoridade pra SACAR o retido (runbook: multisig)
    TAXA_BPS,
    SEM_TETO_DE_TAXA,
    TOKEN_2022_PROGRAM_ID,
  ),
  createInitializeMetadataPointerInstruction(
    mint.publicKey, pagador.publicKey, mint.publicKey, TOKEN_2022_PROGRAM_ID,
  ),
  createInitializeMintInstruction(
    mint.publicKey, DECIMAIS, pagador.publicKey, null /* freeze: NINGUÉM congela */, TOKEN_2022_PROGRAM_ID,
  ),
  createInitializeInstruction({
    programId: TOKEN_2022_PROGRAM_ID,
    mint: mint.publicKey,
    metadata: mint.publicKey,
    name: metadata.name,
    symbol: metadata.symbol,
    uri: metadata.uri,
    mintAuthority: pagador.publicKey,
    updateAuthority: pagador.publicKey,
  }),
);
const sig1 = await sendAndConfirmTransaction(conn, tx1, [pagador, mint]);
console.log(`✅ mint criado: ${mint.publicKey.toBase58()}`);
console.log(`   tx: ${sig1}`);

// ─── tx 2: supply inteiro na tesouraria (e trava, se pedida) ────────────────
const ata = getAssociatedTokenAddressSync(mint.publicKey, tesouraria, false, TOKEN_2022_PROGRAM_ID);
const tx2 = new Transaction().add(
  createAssociatedTokenAccountIdempotentInstruction(
    pagador.publicKey, ata, tesouraria, mint.publicKey, TOKEN_2022_PROGRAM_ID,
  ),
  createMintToInstruction(
    mint.publicKey, ata, pagador.publicKey, SUPPLY_TOKENS * UNIDADE, [], TOKEN_2022_PROGRAM_ID,
  ),
);
if (travarSupply) {
  tx2.add(createSetAuthorityInstruction(
    mint.publicKey, pagador.publicKey, AuthorityType.MintTokens, null, [], TOKEN_2022_PROGRAM_ID,
  ));
}
const sig2 = await sendAndConfirmTransaction(conn, tx2, [pagador]);
console.log(`✅ supply cunhado na tesouraria ${tesouraria.toBase58()}`);
console.log(`   ata: ${ata.toBase58()}`);
console.log(`   tx: ${sig2}${travarSupply ? ' (mint authority REVOGADA — supply fixo)' : ''}`);

// ─── releitura: a chain é a prova, não o nosso código ───────────────────────
const m = await getMint(conn, mint.publicKey, 'confirmed', TOKEN_2022_PROGRAM_ID);
const fee = getTransferFeeConfig(m);
const meta = await getTokenMetadata(conn, mint.publicKey, 'confirmed', TOKEN_2022_PROGRAM_ID);
const problemas: string[] = [];
if (m.decimals !== DECIMAIS) problemas.push(`decimais ${m.decimals} ≠ ${DECIMAIS}`);
if (m.supply !== SUPPLY_TOKENS * UNIDADE) problemas.push(`supply ${m.supply} ≠ ${SUPPLY_TOKENS * UNIDADE}`);
if (m.freezeAuthority !== null) problemas.push('freeze authority devia ser nula');
if (travarSupply && m.mintAuthority !== null) problemas.push('mint authority devia estar revogada');
if (!fee || fee.newerTransferFee.transferFeeBasisPoints !== TAXA_BPS) {
  problemas.push(`taxa ${fee?.newerTransferFee.transferFeeBasisPoints} bps ≠ ${TAXA_BPS}`);
}
if (!meta || meta.symbol !== metaCfg.symbol || meta.uri !== metaCfg.uri) problemas.push('metadata não bate');
if (problemas.length > 0) {
  console.error('🔴 RELEITURA FALHOU:', problemas.join(' · '));
  process.exit(1);
}
console.log(`✅ releitura on-chain confere: ${SUPPLY_TOKENS.toLocaleString('pt-BR')} OLEFOOT · ${DECIMAIS} casas · taxa ${TAXA_BPS} bps sem teto · freeze nula${travarSupply ? ' · supply TRAVADO' : ''}`);
console.log(`   metadata: ${meta!.name} (${meta!.symbol}) → ${meta!.uri}`);

writeFileSync(`scripts/token/mint.out.${rede}.json`, JSON.stringify({
  rede, mint: mint.publicKey.toBase58(), tesouraria: tesouraria.toBase58(), ata: ata.toBase58(),
  supply: SUPPLY_TOKENS.toString(), decimais: DECIMAIS, taxaBps: TAXA_BPS,
  mintAuthorityRevogada: travarSupply, txCriacao: sig1, txSupply: sig2,
  rpc, criadoEm: new Date().toISOString(),
}, null, 2) + '\n');
console.log(`→ scripts/token/mint.out.${rede}.json gravado.`);
if (rede === 'mainnet') {
  console.log('\nPRÓXIMOS PASSOS (runbook): VITE_OLEFOOT_MINT no deploy do front · mover autoridades da taxa pro multisig · distribuir baldes.');
}
