/**
 * Olefoot v1 → v11 — Atualiza legacy_olefoot_credits com saldo de staking.
 *
 * Para cada wallet em legacy_olefoot_credits:
 *   1. Lê totalStakedByUser(address) no contrato de staking BSC
 *   2. Lê calculateRewards(address, i) para cada stake ativo
 *   3. Soma: saldo livre original (balanceOf) + stake + rewards pendentes
 *   4. Atualiza balance_wei e balance_human no Supabase com o total
 *
 * USO:
 *   npx tsx --env-file=.env scripts/migrate-legacy-v1/update-staking-balances.ts
 *   npx tsx --env-file=.env scripts/migrate-legacy-v1/update-staking-balances.ts --dry-run
 *
 * Env:
 *   VITE_SUPABASE_URL (ou SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   BSC_RPC_URL (opcional, default: https://bsc-dataseed.binance.org)
 */

import { createClient } from '@supabase/supabase-js';
import { writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPORT_PATH = resolve(HERE, 'data/staking-update-report.json');

const DRY_RUN = process.argv.includes('--dry-run');

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const RPC_URL = process.env.BSC_RPC_URL ?? 'https://bsc-dataseed.binance.org';

const STAKING_CONTRACT = '0xA8242Bea8a0f6EF27Bc3E190FF65628Cdc141B33';
const OLEFOOT_CONTRACT = '0x605e8943CBD6b43c606b391F15Ef0dc11c731Da9';
const DECIMALS = 18;

const BATCH_SIZE = 5;
const DELAY_MS = 350;

// ERC-20 / Staking selectors
const SEL_BALANCE_OF = '0x70a08231';          // balanceOf(address)
const SEL_TOTAL_STAKED_BY_USER = '0x9cfc8b8c'; // totalStakedByUser(address)
const SEL_STAKE_COUNT = '0xb02e64a9';          // stakeCount(address)
const SEL_USER_STAKES = '0xb5d5b5fa';          // userStakes(address,uint256)
const SEL_CALCULATE_REWARDS = '0xbeb8314c';     // calculateRewards(address,uint256)

if (!DRY_RUN && (!SUPABASE_URL || !SUPABASE_KEY)) {
  console.error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias (use --dry-run pra simular).');
  process.exit(1);
}

function pad32(hex: string): string {
  return hex.toLowerCase().replace(/^0x/, '').padStart(64, '0');
}

function encodeAddress(addr: string): string {
  return pad32(addr);
}

function encodeUint256(n: number): string {
  return n.toString(16).padStart(64, '0');
}

function formatUnits(wei: bigint, decimals: number): string {
  if (wei === 0n) return '0';
  const s = wei.toString();
  if (decimals === 0) return s;
  if (s.length <= decimals) {
    const frac = s.padStart(decimals, '0').replace(/0+$/, '');
    return frac ? `0.${frac}` : '0';
  }
  const intPart = s.slice(0, s.length - decimals);
  const fracPart = s.slice(s.length - decimals).replace(/0+$/, '');
  return fracPart ? `${intPart}.${fracPart}` : intPart;
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
  if (!json.result) throw new Error('RPC no result');
  return json.result;
}

async function ethCall(to: string, data: string): Promise<string> {
  return rpcCall('eth_call', [{ to, data }, 'latest']);
}

async function readWalletBalance(wallet: string): Promise<bigint> {
  const data = SEL_BALANCE_OF + encodeAddress(wallet);
  const hex = await ethCall(OLEFOOT_CONTRACT, data);
  return BigInt(hex);
}

async function readTotalStaked(wallet: string): Promise<bigint> {
  const data = SEL_TOTAL_STAKED_BY_USER + encodeAddress(wallet);
  try {
    const hex = await ethCall(STAKING_CONTRACT, data);
    return BigInt(hex);
  } catch {
    return 0n;
  }
}

async function readStakeCount(wallet: string): Promise<number> {
  const data = SEL_STAKE_COUNT + encodeAddress(wallet);
  try {
    const hex = await ethCall(STAKING_CONTRACT, data);
    return Number(BigInt(hex));
  } catch {
    return 0;
  }
}

async function isStakeActive(wallet: string, index: number): Promise<boolean> {
  const data = SEL_USER_STAKES + encodeAddress(wallet) + encodeUint256(index);
  try {
    const hex = await ethCall(STAKING_CONTRACT, data);
    const raw = hex.replace(/^0x/, '');
    // 7 words of 64 hex chars each; field[6] = active (bool)
    if (raw.length < 7 * 64) return false;
    const activeWord = raw.slice(6 * 64, 7 * 64);
    return BigInt('0x' + activeWord) === 1n;
  } catch {
    return false;
  }
}

async function readPendingRewards(wallet: string, index: number): Promise<bigint> {
  const data = SEL_CALCULATE_REWARDS + encodeAddress(wallet) + encodeUint256(index);
  try {
    const hex = await ethCall(STAKING_CONTRACT, data);
    return BigInt(hex);
  } catch {
    return 0n;
  }
}

async function readTotalRewardsForWallet(wallet: string): Promise<bigint> {
  const count = await readStakeCount(wallet);
  if (count === 0) return 0n;

  let total = 0n;
  for (let i = 0; i < count; i++) {
    const active = await isStakeActive(wallet, i);
    if (!active) continue;
    const rewards = await readPendingRewards(wallet, i);
    total += rewards;
  }
  return total;
}

interface WalletReport {
  email: string;
  wallet: string;
  old_balance_human: string;
  free_wei: string;
  staked_wei: string;
  rewards_wei: string;
  total_wei: string;
  total_human: string;
  changed: boolean;
  updated: boolean;
  error?: string;
}

async function main() {
  console.log('=== Olefoot Staking Balance Updater ===');
  console.log(`Staking contract: ${STAKING_CONTRACT}`);
  console.log(`Token contract:   ${OLEFOOT_CONTRACT}`);
  console.log(`RPC:              ${RPC_URL}`);
  console.log(`Dry run:          ${DRY_RUN}\n`);

  const sb = DRY_RUN
    ? null
    : createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

  // Fetch all legacy credits from Supabase
  let rows: Array<{
    user_id: string;
    email: string;
    wallet_address: string;
    balance_wei: string;
    balance_human: string;
  }>;

  if (sb) {
    const { data, error } = await sb
      .from('legacy_olefoot_credits')
      .select('user_id, email, wallet_address, balance_wei, balance_human')
      .neq('wallet_address', '0x0000000000000000000000000000000000000000')
      .order('email');
    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    rows = data ?? [];
  } else {
    // Dry-run: use a test wallet
    rows = [{
      user_id: 'dry-run',
      email: 'trader4.tfxpro@gmail.com',
      wallet_address: '0x3CE87f388380BB981C8D198a9b642098030A9FBf',
      balance_wei: '0',
      balance_human: '0',
    }];
  }

  console.log(`Wallets a processar: ${rows.length}\n`);

  const report: WalletReport[] = [];
  let updatedCount = 0;
  let unchangedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    const results = await Promise.all(batch.map(async (row) => {
      const entry: WalletReport = {
        email: row.email,
        wallet: row.wallet_address,
        old_balance_human: row.balance_human,
        free_wei: '0',
        staked_wei: '0',
        rewards_wei: '0',
        total_wei: '0',
        total_human: '0',
        changed: false,
        updated: false,
      };

      try {
        const [free, staked, rewards] = await Promise.all([
          readWalletBalance(row.wallet_address),
          readTotalStaked(row.wallet_address),
          readTotalRewardsForWallet(row.wallet_address),
        ]);

        const total = free + staked + rewards;

        entry.free_wei = free.toString();
        entry.staked_wei = staked.toString();
        entry.rewards_wei = rewards.toString();
        entry.total_wei = total.toString();
        entry.total_human = formatUnits(total, DECIMALS);

        const oldWei = BigInt(row.balance_wei || '0');
        entry.changed = total > oldWei;

        if (entry.changed && sb && !DRY_RUN) {
          const { error } = await sb
            .from('legacy_olefoot_credits')
            .update({
              balance_wei: total.toString(),
              balance_human: entry.total_human,
              // Reset credited_at so the user sees the updated toast
              credited_at: null,
              credited_amount: null,
            })
            .eq('user_id', row.user_id);

          if (error) {
            entry.error = error.message;
          } else {
            entry.updated = true;
          }
        }
      } catch (e) {
        entry.error = (e as Error).message;
      }

      return entry;
    }));

    for (const r of results) {
      report.push(r);
      if (r.error) {
        errorCount++;
        console.error(`  ✗ ${r.email}: ${r.error}`);
      } else if (r.changed) {
        updatedCount++;
        console.log(`  ✓ ${r.email.padEnd(40)} ${r.old_balance_human} → ${r.total_human} (stake: ${formatUnits(BigInt(r.staked_wei), DECIMALS)}, rewards: ${formatUnits(BigInt(r.rewards_wei), DECIMALS)})`);
      } else {
        unchangedCount++;
      }
    }

    console.log(`  [${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}]`);

    if (i + BATCH_SIZE < rows.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  await writeFile(REPORT_PATH, JSON.stringify(report, null, 2));

  // Stats
  const totalOldWei = report.reduce((sum, r) => sum + BigInt(r.free_wei), 0n);
  const totalStakedWei = report.reduce((sum, r) => sum + BigInt(r.staked_wei), 0n);
  const totalRewardsWei = report.reduce((sum, r) => sum + BigInt(r.rewards_wei), 0n);
  const grandTotalWei = report.reduce((sum, r) => sum + BigInt(r.total_wei), 0n);

  console.log('\n=== RELATÓRIO FINAL ===');
  console.log(`Processados:        ${report.length}`);
  console.log(`Atualizados:        ${updatedCount}`);
  console.log(`Sem mudança:        ${unchangedCount}`);
  console.log(`Erros:              ${errorCount}`);
  console.log('');
  console.log(`Saldo livre total:  ${formatUnits(totalOldWei, DECIMALS)} OLEFOOT`);
  console.log(`Stake total:        ${formatUnits(totalStakedWei, DECIMALS)} OLEFOOT`);
  console.log(`Rewards total:      ${formatUnits(totalRewardsWei, DECIMALS)} OLEFOOT`);
  console.log(`GRAND TOTAL:        ${formatUnits(grandTotalWei, DECIMALS)} OLEFOOT`);
  console.log('');
  if (DRY_RUN) console.log('(dry-run — nada foi alterado no Supabase)');
  console.log(`\n✓ Relatório salvo em: ${REPORT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
