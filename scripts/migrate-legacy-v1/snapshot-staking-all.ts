/**
 * Lê saldo livre + stake + rewards de TODAS as 159 wallets migradas.
 * Gera um JSON com os resultados e SQLs de UPDATE prontos para aplicar via MCP.
 *
 * USO:
 *   npx tsx scripts/migrate-legacy-v1/snapshot-staking-all.ts
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WALLETS_PATH = resolve(HERE, 'data/wallets-from-supabase.json');
const REPORT_PATH = resolve(HERE, 'data/staking-snapshot-full.json');
const SQL_PATH = resolve(HERE, 'data/staking-update.sql');

const RPC_URL = process.env.BSC_RPC_URL ?? 'https://bsc-dataseed.binance.org';
const STAKING_CONTRACT = '0xA8242Bea8a0f6EF27Bc3E190FF65628Cdc141B33';
const OLEFOOT_CONTRACT = '0x605e8943CBD6b43c606b391F15Ef0dc11c731Da9';
const DECIMALS = 18;
const BATCH_SIZE = 3;
const DELAY_MS = 500;

const SEL_BALANCE_OF = '0x70a08231';
const SEL_TOTAL_STAKED_BY_USER = '0x9cfc8b8c';
const SEL_STAKE_COUNT = '0xb02e64a9';
const SEL_USER_STAKES = '0xb5d5b5fa';
const SEL_CALCULATE_REWARDS = '0xbeb8314c';

function pad64(hex: string): string {
  return hex.toLowerCase().replace(/^0x/, '').padStart(64, '0');
}
function encAddr(a: string) { return pad64(a); }
function encUint(n: number) { return n.toString(16).padStart(64, '0'); }

function formatUnits(wei: bigint, dec: number): string {
  if (wei === 0n) return '0';
  const s = wei.toString();
  if (s.length <= dec) {
    const f = s.padStart(dec, '0').replace(/0+$/, '');
    return f ? `0.${f}` : '0';
  }
  const i = s.slice(0, s.length - dec);
  const f = s.slice(s.length - dec).replace(/0+$/, '');
  return f ? `${i}.${f}` : i;
}

async function rpc(method: string, params: unknown[]): Promise<string> {
  const r = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const j = (await r.json()) as { result?: string; error?: { message: string } };
  if (j.error) throw new Error(j.error.message);
  return j.result ?? '0x0';
}

async function call(to: string, data: string) { return rpc('eth_call', [{ to, data }, 'latest']); }

async function walletBalance(w: string) { return BigInt(await call(OLEFOOT_CONTRACT, SEL_BALANCE_OF + encAddr(w))); }
async function totalStaked(w: string) { try { return BigInt(await call(STAKING_CONTRACT, SEL_TOTAL_STAKED_BY_USER + encAddr(w))); } catch { return 0n; } }
async function stakeCount(w: string) { try { return Number(BigInt(await call(STAKING_CONTRACT, SEL_STAKE_COUNT + encAddr(w)))); } catch { return 0; } }

async function isActive(w: string, i: number): Promise<boolean> {
  try {
    const hex = await call(STAKING_CONTRACT, SEL_USER_STAKES + encAddr(w) + encUint(i));
    const raw = hex.replace(/^0x/, '');
    if (raw.length < 7 * 64) return false;
    return BigInt('0x' + raw.slice(6 * 64, 7 * 64)) === 1n;
  } catch { return false; }
}

async function pendingReward(w: string, i: number): Promise<bigint> {
  try { return BigInt(await call(STAKING_CONTRACT, SEL_CALCULATE_REWARDS + encAddr(w) + encUint(i))); }
  catch { return 0n; }
}

async function allRewards(w: string): Promise<bigint> {
  const n = await stakeCount(w);
  let total = 0n;
  for (let i = 0; i < n; i++) {
    if (await isActive(w, i)) total += await pendingReward(w, i);
  }
  return total;
}

interface Row { user_id: string; email: string; wallet_address: string; balance_wei: string; }

async function main() {
  const rows: Row[] = JSON.parse(await readFile(WALLETS_PATH, 'utf8'));
  console.log(`Wallets: ${rows.length}\n`);

  const results: Array<Row & { free: string; staked: string; rewards: string; total: string; total_human: string; changed: boolean }> = [];
  const sqls: string[] = [];

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(async (r) => {
      try {
        const [free, stk, rew] = await Promise.all([
          walletBalance(r.wallet_address),
          totalStaked(r.wallet_address),
          allRewards(r.wallet_address),
        ]);
        const total = free + stk + rew;
        const changed = total > BigInt(r.balance_wei || '0');
        if (changed) {
          console.log(`  + ${r.email.padEnd(42)} ${formatUnits(BigInt(r.balance_wei), DECIMALS).padEnd(20)} → ${formatUnits(total, DECIMALS)} (stake=${formatUnits(stk, DECIMALS)}, rew=${formatUnits(rew, DECIMALS)})`);
          const totalStr = total.toString();
          const humanStr = formatUnits(total, DECIMALS);
          sqls.push(`UPDATE public.legacy_olefoot_credits SET balance_wei = '${totalStr}', balance_human = '${humanStr}', credited_at = NULL, credited_amount = NULL WHERE user_id = '${r.user_id}';`);
        }
        return { ...r, free: free.toString(), staked: stk.toString(), rewards: rew.toString(), total: total.toString(), total_human: formatUnits(total, DECIMALS), changed };
      } catch (e) {
        console.error(`  ✗ ${r.email}: ${(e as Error).message}`);
        return { ...r, free: '0', staked: '0', rewards: '0', total: r.balance_wei, total_human: formatUnits(BigInt(r.balance_wei || '0'), DECIMALS), changed: false };
      }
    }));
    results.push(...batchResults);
    process.stdout.write(`  [${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}]\n`);
    if (i + BATCH_SIZE < rows.length) await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  await writeFile(REPORT_PATH, JSON.stringify(results, null, 2));
  await writeFile(SQL_PATH, sqls.join('\n'));

  const changed = results.filter(r => r.changed);
  const totalFree = results.reduce((s, r) => s + BigInt(r.free), 0n);
  const totalStk = results.reduce((s, r) => s + BigInt(r.staked), 0n);
  const totalRew = results.reduce((s, r) => s + BigInt(r.rewards), 0n);
  const grand = results.reduce((s, r) => s + BigInt(r.total), 0n);

  console.log('\n=== RESULTADO ===');
  console.log(`Processados:  ${results.length}`);
  console.log(`Com mudança:  ${changed.length}`);
  console.log(`Livre total:  ${formatUnits(totalFree, DECIMALS)} OLEFOOT`);
  console.log(`Stake total:  ${formatUnits(totalStk, DECIMALS)} OLEFOOT`);
  console.log(`Rewards total: ${formatUnits(totalRew, DECIMALS)} OLEFOOT`);
  console.log(`GRAND TOTAL:  ${formatUnits(grand, DECIMALS)} OLEFOOT`);
  console.log(`\nSQLs gerados: ${sqls.length}`);
  console.log(`Report: ${REPORT_PATH}`);
  console.log(`SQL:    ${SQL_PATH}`);
}

main().catch(e => { console.error(e); process.exit(1); });
