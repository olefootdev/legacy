#!/usr/bin/env node
/**
 * Preenche portrait_token_public_url e portrait_media_refs quando só portrait_public_url
 * está definida (URL Pinata com …-card.… → deriva …-token.…).
 *
 * server/.env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 *   node scripts/repair-genesis-pinata-token-from-card-url.mjs
 *   node scripts/repair-genesis-pinata-token-from-card-url.mjs --execute
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../server/.env') });

const EXECUTE = process.argv.includes('--execute');

function repairFromCardUrl(cardUrl) {
  const u = cardUrl.trim();
  if (!u.includes('-card.')) return null;
  const tokenUrl = u.replace(/-card\./, '-token.');
  if (tokenUrl === u) return null;
  const folderCidMatch = u.match(/\/ipfs\/([^/]+)\//);
  const folderCid = folderCidMatch?.[1]?.trim() ?? '';
  const extMatch = u.match(/-card\.([a-z0-9]+)(?:\?|#|$)/i);
  const ext = extMatch?.[1] ?? 'webp';
  const now = new Date().toISOString();
  return {
    tokenUrl,
    mediaRefs: {
      provider: 'pinata',
      source: 'repair_from_card_public_url',
      ...(folderCid ? { folderCid } : {}),
      ext,
      cardPublicUrl: u,
      tokenPublicUrl: tokenUrl,
      recordedAt: now,
    },
  };
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    console.error('Falta SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY em server/.env');
    process.exit(1);
  }

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rows, error } = await sb
    .from('genesis_market_players')
    .select('id, portrait_public_url, portrait_token_public_url, portrait_media_refs')
    .not('portrait_public_url', 'is', null);

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const todo = (rows ?? []).filter((r) => {
    const card = r.portrait_public_url?.trim();
    if (!card) return false;
    return !r.portrait_token_public_url?.trim() || r.portrait_media_refs == null;
  });

  console.log(`Linhas com URL de card mas token ou refs em falta: ${todo.length}`);
  todo.slice(0, 5).forEach((r) => console.log(`  ${r.id}  ${String(r.portrait_public_url).slice(0, 72)}…`));

  if (!EXECUTE) {
    console.log('\nDry-run. Gravar: --execute');
    return;
  }

  let ok = 0;
  let skip = 0;
  for (const r of todo) {
    const rep = repairFromCardUrl(r.portrait_public_url);
    if (!rep) {
      console.warn(`${r.id}: URL sem padrão -card., a saltar.`);
      skip++;
      continue;
    }
    const { error: upErr } = await sb
      .from('genesis_market_players')
      .update({
        portrait_token_public_url: rep.tokenUrl,
        portrait_media_refs: rep.mediaRefs,
        updated_at: new Date().toISOString(),
      })
      .eq('id', r.id);
    if (upErr) console.error(`${r.id}:`, upErr.message);
    else ok++;
  }
  console.log(`\nAtualizados: ${ok}, saltados (URL inválida): ${skip}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
