#!/usr/bin/env node
/**
 * Liga retratos Genesis ao IPFS usando só o CID da pasta no Pinata (ficheiros já lá).
 * URLs: {gateway}/{folderCid}/{GEN-001-card.webp} e …-token.webp
 *
 * server/.env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 *   node scripts/apply-genesis-from-pinata-folder-cid.mjs --cid bafybei…
 *   node scripts/apply-genesis-from-pinata-folder-cid.mjs --cid bafybei… --execute
 *   node scripts/apply-genesis-from-pinata-folder-cid.mjs --cid bafybei… --execute --verify
 *
 * Opções:
 *   --gateway https://gateway.pinata.cloud/ipfs   (default)
 *   --ext webp | png | jpg
 *   --verify   faz GET a cada URL antes de gravar (recomendado)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
dotenv.config({ path: join(ROOT, 'server/.env') });

const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');
const VERIFY = args.includes('--verify');
const cidIdx = args.indexOf('--cid');
const folderCid = cidIdx >= 0 && args[cidIdx + 1] && !args[cidIdx + 1].startsWith('--') ? args[cidIdx + 1].trim() : '';
const gwIdx = args.indexOf('--gateway');
const gateway =
  gwIdx >= 0 && args[gwIdx + 1] && !args[gwIdx + 1].startsWith('--')
    ? args[gwIdx + 1].trim().replace(/\/+$/, '')
    : 'https://gateway.pinata.cloud/ipfs';
const extIdx = args.indexOf('--ext');
const ext =
  extIdx >= 0 && args[extIdx + 1] && !args[extIdx + 1].startsWith('--')
    ? args[extIdx + 1].replace(/^\./, '')
    : 'webp';

function urls(folderCid, playerId) {
  return {
    card: `${gateway}/${folderCid}/${playerId}-card.${ext}`,
    token: `${gateway}/${folderCid}/${playerId}-token.${ext}`,
  };
}

async function urlOk(url) {
  try {
    const r = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-1023' } });
    return r.ok || r.status === 206;
  } catch {
    return false;
  }
}

async function main() {
  if (!folderCid) {
    console.error('Uso: node scripts/apply-genesis-from-pinata-folder-cid.mjs --cid <CID_DA_PASTA> [--execute] [--verify] [--gateway URL] [--ext webp]');
    process.exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    console.error('Falta SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY em server/.env');
    process.exit(1);
  }

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rows, error } = await sb.from('genesis_market_players').select('id').order('kit_number', { ascending: true });
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  const ids = (rows ?? []).map((r) => r.id);
  console.log(`CID pasta: ${folderCid}`);
  console.log(`Gateway: ${gateway}`);
  console.log(`Extensão: .${ext}`);
  console.log(`Jogadores na base: ${ids.length}`);
  if (ids[0]) {
    const u = urls(folderCid, ids[0]);
    console.log('Exemplo:', u.card);
  }

  if (!EXECUTE) {
    console.log('\nDry-run. Gravar: acrescenta --execute (e --verify para testar URLs).');
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const id of ids) {
    const { card, token } = urls(folderCid, id);
    process.stdout.write(`${id}… `);
    try {
      if (VERIFY) {
        const [cOk, tOk] = await Promise.all([urlOk(card), urlOk(token)]);
        if (!cOk) throw new Error(`card inacessível: ${card}`);
        if (!tOk) throw new Error(`token inacessível: ${token}`);
      }
      const nowIso = new Date().toISOString();
      const portrait_media_refs = {
        provider: 'pinata',
        source: 'pinata_folder_cid',
        folderCid,
        ext,
        gatewayBase: gateway,
        cardPublicUrl: card,
        tokenPublicUrl: token,
        recordedAt: nowIso,
      };
      const { error: upErr } = await sb
        .from('genesis_market_players')
        .update({
          portrait_public_url: card,
          portrait_token_public_url: token,
          portrait_storage_path: null,
          portrait_media_refs,
          updated_at: nowIso,
        })
        .eq('id', id);
      if (upErr) throw new Error(upErr.message);
      console.log('OK');
      ok++;
    } catch (e) {
      console.log('FALHOU', e instanceof Error ? e.message : e);
      fail++;
    }
  }
  console.log(`\nResumo: ${ok} OK, ${fail} falhas.`);
  if (fail) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
