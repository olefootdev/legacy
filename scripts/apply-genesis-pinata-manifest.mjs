#!/usr/bin/env node
/**
 * Aplica URLs públicas (já hospedadas no Pinata / gateway) em `genesis_market_players`,
 * limpa `portrait_storage_path` e preenche `portrait_media_refs` mínimo.
 *
 * Ficheiro JSON — um destes formatos:
 *   { "GEN-001": { "card": "https://…", "token": "https://…" }, … }
 *   [ { "id": "GEN-001", "card": "https://…", "token": "https://…" }, … ]
 *
 * Uso (na raiz):
 *   node scripts/apply-genesis-pinata-manifest.mjs path/para/manifest.json
 *   node scripts/apply-genesis-pinata-manifest.mjs path/para/manifest.json --execute
 *
 * Sem --execute só valida e lista entradas. Requer SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (Pinata JWT não é usado).
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../server/.env') });

const EXECUTE = process.argv.includes('--execute');

function parseManifest(data) {
  const entries = [];
  const push = (id, card, token) => {
    const idTrim = String(id).trim();
    if (!idTrim || typeof card !== 'string' || typeof token !== 'string') return;
    const c = card.trim();
    const t = token.trim();
    if (!c || !t) return;
    try {
      const uc = new URL(c);
      const ut = new URL(t);
      if (!['http:', 'https:'].includes(uc.protocol) || !['http:', 'https:'].includes(ut.protocol)) return;
    } catch {
      return;
    }
    entries.push({ id: idTrim, card: c, token: t });
  };

  if (Array.isArray(data)) {
    for (const row of data) {
      if (!row || typeof row !== 'object') continue;
      if (typeof row.id !== 'string') continue;
      push(row.id, row.card, row.token);
    }
  } else if (data && typeof data === 'object') {
    for (const [id, v] of Object.entries(data)) {
      if (!v || typeof v !== 'object') continue;
      push(id, v.card, v.token);
    }
  }
  return entries;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--execute');
  const filePath = args[0];
  if (!filePath) {
    console.error('Uso: node scripts/apply-genesis-pinata-manifest.mjs <manifest.json> [--execute]');
    process.exit(1);
  }

  const raw = readFileSync(filePath, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error('JSON inválido:', e.message);
    process.exit(1);
  }

  const entries = parseManifest(data);
  console.log(`Entradas válidas: ${entries.length}`);
  if (!entries.length) {
    process.exit(1);
  }
  entries.slice(0, 5).forEach((e) => console.log(`  ${e.id} card=${e.card.slice(0, 48)}…`));

  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error('Falta SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY em server/.env');
    process.exit(1);
  }

  if (!EXECUTE) {
    console.log('\nDry-run. Para gravar: acrescenta --execute');
    return;
  }

  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const nowIso = new Date().toISOString();
  let ok = 0;
  for (const e of entries) {
    const refs = {
      provider: 'pinata',
      source: 'manual_gateway_urls',
      recordedAt: nowIso,
      cardPublicUrl: e.card,
      tokenPublicUrl: e.token,
    };
    const { error } = await sb
      .from('genesis_market_players')
      .update({
        portrait_public_url: e.card,
        portrait_token_public_url: e.token,
        portrait_storage_path: null,
        portrait_media_refs: refs,
        updated_at: nowIso,
      })
      .eq('id', e.id);
    if (error) console.error(`${e.id}:`, error.message);
    else ok++;
  }
  console.log(`\nAtualizados: ${ok}/${entries.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
