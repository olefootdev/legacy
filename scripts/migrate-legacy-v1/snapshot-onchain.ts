/**
 * Olefoot v1 → v11 — Snapshot on-chain do saldo OLEFOOT (token OLEFT) na BSC.
 *
 * Lê `data/legacy-users.json` (gerado por parse-dump.ts), e pra cada wallet_address
 * chama `balanceOf(address)` no contrato OLEFOOT via JSON-RPC público da BSC.
 * Grava `data/onchain-snapshot.json` com `{ legacy_id, email, wallet, balance_wei, balance_human }`.
 *
 * USO:
 *   tsx scripts/migrate-legacy-v1/snapshot-onchain.ts
 *
 * Variáveis de ambiente (todas opcionais):
 *   BSC_RPC_URL   default https://bsc-dataseed.binance.org
 *   BSC_BATCH     tamanho do lote (default 5)
 *   BSC_DELAY_MS  delay entre lotes (default 300ms)
 *
 * Resume-safe: se `onchain-snapshot.json` já existir, pula wallets já consultadas.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const USERS_PATH = resolve(HERE, 'data/legacy-users.json');
const OUT_PATH = resolve(HERE, 'data/onchain-snapshot.json');

const OLEFOOT_CONTRACT = '0x605e8943CBD6b43c606b391F15Ef0dc11C731Da9';
const RPC_URL = process.env.BSC_RPC_URL ?? 'https://bsc-dataseed.binance.org';
const BATCH = Number(process.env.BSC_BATCH ?? 5);
const DELAY_MS = Number(process.env.BSC_DELAY_MS ?? 300);

// ERC-20 function selectors (keccak256[:4])
const SEL_BALANCE_OF = '0x70a08231';
const SEL_DECIMALS = '0x313ce567';
const SEL_SYMBOL = '0x95d89b41';

interface LegacyUser {
  legacy_id: number;
  email: string;
  wallet_address: string | null;
}

interface SnapshotEntry {
  legacy_id: number;
  email: string;
  wallet: string;
  balance_wei: string; // BigInt as string
  balance_human: string;
  snapshot_at: string;
}

function encodeAddress(addr: string): string {
  return addr.toLowerCase().replace(/^0x/, '').padStart(64, '0');
}

async function rpcCall(method: string, params: unknown[]): Promise<string> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { result?: string; error?: { message: string } };
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);
  if (!json.result) throw new Error(`RPC no result`);
  return json.result;
}

async function ethCall(to: string, data: string): Promise<string> {
  return rpcCall('eth_call', [{ to, data }, 'latest']);
}

async function fetchTokenMeta() {
  const decHex = await ethCall(OLEFOOT_CONTRACT, SEL_DECIMALS);
  const decimals = Number(BigInt(decHex));
  let symbol = 'OLEFOOT';
  try {
    const symHex = await ethCall(OLEFOOT_CONTRACT, SEL_SYMBOL);
    // ABI-encoded string: [offset(32)][len(32)][data(padded)]
    const raw = symHex.replace(/^0x/, '');
    if (raw.length >= 192) {
      const lenHex = raw.slice(64, 128);
      const len = Number(BigInt('0x' + lenHex));
      const dataHex = raw.slice(128, 128 + len * 2);
      symbol = Buffer.from(dataHex, 'hex').toString('utf8');
    }
  } catch {
    // alguns tokens retornam bytes32 fixo; ignora e mantém default
  }
  return { decimals, symbol };
}

function formatUnits(wei: bigint, decimals: number): string {
  if (wei === 0n) return '0';
  const s = wei.toString();
  if (decimals === 0) return s;
  if (s.length <= decimals) {
    return '0.' + s.padStart(decimals, '0').replace(/0+$/, '') || '0';
  }
  const intPart = s.slice(0, s.length - decimals);
  const fracPart = s.slice(s.length - decimals).replace(/0+$/, '');
  return fracPart ? `${intPart}.${fracPart}` : intPart;
}

async function main() {
  const usersRaw = await readFile(USERS_PATH, 'utf8');
  const users = JSON.parse(usersRaw) as LegacyUser[];
  const withWallet = users.filter(
    (u): u is LegacyUser & { wallet_address: string } => Boolean(u.wallet_address),
  );
  console.log(`Total users: ${users.length}, com wallet: ${withWallet.length}`);
  console.log(`Contrato: ${OLEFOOT_CONTRACT}`);
  console.log(`RPC: ${RPC_URL}`);

  const meta = await fetchTokenMeta();
  console.log(`Token symbol: ${meta.symbol}, decimals: ${meta.decimals}`);

  // Resume
  let existing: SnapshotEntry[] = [];
  try {
    existing = JSON.parse(await readFile(OUT_PATH, 'utf8')) as SnapshotEntry[];
    console.log(`Snapshot anterior encontrado: ${existing.length} entries — resume`);
  } catch {
    /* primeira execução */
  }
  const done = new Set(existing.map((e) => e.wallet.toLowerCase()));

  const out: SnapshotEntry[] = [...existing];
  const todo = withWallet.filter((u) => !done.has(u.wallet_address.toLowerCase()));
  console.log(`A consultar: ${todo.length}`);

  for (let i = 0; i < todo.length; i += BATCH) {
    const slice = todo.slice(i, i + BATCH);
    const results = await Promise.all(
      slice.map(async (u) => {
        const data = SEL_BALANCE_OF + encodeAddress(u.wallet_address);
        try {
          const hex = await ethCall(OLEFOOT_CONTRACT, data);
          const wei = BigInt(hex);
          const entry: SnapshotEntry = {
            legacy_id: u.legacy_id,
            email: u.email,
            wallet: u.wallet_address,
            balance_wei: wei.toString(),
            balance_human: formatUnits(wei, meta.decimals),
            snapshot_at: new Date().toISOString(),
          };
          return entry;
        } catch (e) {
          console.error(`  ✗ ${u.email} (${u.wallet_address}): ${(e as Error).message}`);
          return null;
        }
      }),
    );
    for (const r of results) if (r) out.push(r);
    console.log(`  ${Math.min(i + BATCH, todo.length)}/${todo.length}`);
    // grava parcial a cada batch
    await writeFile(OUT_PATH, JSON.stringify(out, null, 2));
    if (i + BATCH < todo.length) await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  // Stats
  const nonZero = out.filter((e) => e.balance_wei !== '0');
  const totalWei = out.reduce((acc, e) => acc + BigInt(e.balance_wei), 0n);
  console.log('\n=== STATS ===');
  console.log(`Total snapshots: ${out.length}`);
  console.log(`Com saldo > 0: ${nonZero.length}`);
  console.log(`Soma total (${meta.symbol}): ${formatUnits(totalWei, meta.decimals)}`);
  console.log('\nTop 10 maiores saldos:');
  for (const e of [...nonZero]
    .sort((a, b) => (BigInt(b.balance_wei) > BigInt(a.balance_wei) ? 1 : -1))
    .slice(0, 10)) {
    console.log(`  ${e.email.padEnd(40)} ${e.balance_human}`);
  }
  console.log(`\n✓ Snapshot salvo em: ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
