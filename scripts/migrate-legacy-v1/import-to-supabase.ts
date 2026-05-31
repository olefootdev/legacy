/**
 * Olefoot v1 → v11 — Import dos 168 usuários no Supabase.
 *
 * Lê `data/legacy-users.json` (parser) + `data/onchain-snapshot.json` (RPC BSC)
 * e chama a função `public.admin_import_legacy_v1_user(...)` (criada na
 * migration 20260531000000_legacy_v1_olefoot_credits.sql) pra cada user.
 *
 * USO:
 *   tsx --env-file=server/.env scripts/migrate-legacy-v1/import-to-supabase.ts
 *   tsx --env-file=server/.env scripts/migrate-legacy-v1/import-to-supabase.ts --dry-run
 *
 * Env:
 *   SUPABASE_URL (ou VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY  (obrigatória — chave service_role)
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const HERE = dirname(fileURLToPath(import.meta.url));
const USERS_PATH = resolve(HERE, 'data/legacy-users.json');
const SNAPSHOT_PATH = resolve(HERE, 'data/onchain-snapshot.json');
const REPORT_PATH = resolve(HERE, 'data/import-report.json');

const DRY_RUN = process.argv.includes('--dry-run');

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!DRY_RUN && (!SUPABASE_URL || !SUPABASE_KEY)) {
  console.error(
    'SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias (use --dry-run pra simular).',
  );
  process.exit(1);
}

interface LegacyUser {
  legacy_id: number;
  email: string;
  name: string;
  bcrypt_hash: string;
  bcrypt_valid: boolean;
  wallet_address: string | null;
  status: string;
}

interface SnapshotEntry {
  legacy_id: number;
  wallet: string;
  balance_wei: string;
  balance_human: string;
  snapshot_at: string;
}

interface ImportRow {
  legacy_id: number;
  email: string;
  ok: boolean;
  action?: string;
  user_id?: string;
  error?: string;
  balance_wei: string;
  balance_human: string;
}

async function main() {
  const users = JSON.parse(await readFile(USERS_PATH, 'utf8')) as LegacyUser[];
  const snapshots = JSON.parse(await readFile(SNAPSHOT_PATH, 'utf8')) as SnapshotEntry[];
  const byLegacy = new Map(snapshots.map((s) => [s.legacy_id, s]));

  console.log(`Users: ${users.length}, Snapshots: ${snapshots.length}, Dry-run: ${DRY_RUN}`);

  const invalid = users.filter((u) => !u.bcrypt_valid || !u.email);
  if (invalid.length) {
    console.warn(`⚠ ${invalid.length} users com bcrypt/email inválido serão pulados.`);
  }

  const sb = DRY_RUN
    ? null
    : createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

  const report: ImportRow[] = [];
  let createdNew = 0;
  let reusedExisting = 0;
  let failed = 0;

  for (const u of users) {
    if (!u.bcrypt_valid || !u.email) continue;
    const snap = u.wallet_address ? byLegacy.get(u.legacy_id) : undefined;
    const wallet = snap?.wallet ?? u.wallet_address ?? '0x0000000000000000000000000000000000000000';
    const balance_wei = snap?.balance_wei ?? '0';
    const balance_human = snap?.balance_human ?? '0';
    const snapshot_at = snap?.snapshot_at ?? new Date().toISOString();

    if (DRY_RUN) {
      report.push({
        legacy_id: u.legacy_id,
        email: u.email,
        ok: true,
        action: 'dry-run',
        balance_wei,
        balance_human,
      });
      continue;
    }

    const { data, error } = await sb!.rpc('admin_import_legacy_v1_user', {
      p_email: u.email,
      p_bcrypt_hash: u.bcrypt_hash,
      p_legacy_id: u.legacy_id,
      p_name: u.name,
      p_wallet: wallet,
      p_balance_wei: balance_wei,
      p_balance_human: balance_human,
      p_snapshot_at: snapshot_at,
    });

    if (error) {
      failed++;
      console.error(`  ✗ [${u.legacy_id}] ${u.email}: ${error.message}`);
      report.push({
        legacy_id: u.legacy_id,
        email: u.email,
        ok: false,
        error: error.message,
        balance_wei,
        balance_human,
      });
      continue;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const action = row?.action ?? 'unknown';
    if (action === 'created_new') createdNew++;
    if (action === 'reused_existing') reusedExisting++;
    report.push({
      legacy_id: u.legacy_id,
      email: u.email,
      ok: true,
      action,
      user_id: row?.out_user_id,
      balance_wei,
      balance_human,
    });
  }

  await writeFile(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log('\n=== IMPORT REPORT ===');
  console.log(`Total processados: ${report.length}`);
  console.log(`  Criados novos:     ${createdNew}`);
  console.log(`  Reusados (v11 já): ${reusedExisting}`);
  console.log(`  Falharam:          ${failed}`);
  console.log(`  Inválidos pulados: ${invalid.length}`);
  console.log(`\n✓ Relatório em: ${REPORT_PATH}`);
  if (DRY_RUN) console.log('\n(dry-run — nada foi escrito no Supabase)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
