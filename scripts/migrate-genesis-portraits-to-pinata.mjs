#!/usr/bin/env node
/**
 * Migra retratos Genesis do Supabase Storage → Pinata (IPFS público) e atualiza `genesis_market_players`.
 *
 * Requer em `server/.env` (ou env exportada):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PINATA_JWT
 * Opcional: PINATA_GATEWAY_PREFIX (default https://gateway.pinata.cloud/ipfs/)
 *
 * Uso (na raiz do repo):
 *   node scripts/migrate-genesis-portraits-to-pinata.mjs              # dry-run: só lista
 *   node scripts/migrate-genesis-portraits-to-pinata.mjs --execute   # migra
 *   node scripts/migrate-genesis-portraits-to-pinata.mjs --execute --delete-storage
 *
 * Não apaga Storage por omissão; com --delete-storage remove card+token após upload bem-sucedido.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../server/.env') });

const BUCKET = 'genesis-player-portraits';
const PINATA_URL = 'https://uploads.pinata.cloud/v3/files';
const DEFAULT_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';

const args = new Set(process.argv.slice(2));
const EXECUTE = args.has('--execute');
const DELETE_STORAGE = args.has('--delete-storage');

function gatewayUrl(cid, prefix) {
  const base = (prefix || DEFAULT_GATEWAY).replace(/\/+$/, '');
  return `${base}/${cid}`;
}

async function uploadBufferToPinata({ jwt, buffer, filename, mimeType, gatewayPrefix, keyvalues }) {
  const form = new FormData();
  form.set('file', new Blob([buffer], { type: mimeType }), filename);
  form.set('network', 'public');
  form.set('name', filename);
  if (keyvalues && Object.keys(keyvalues).length) {
    form.set('keyvalues', JSON.stringify({ keyvalues }));
  }
  const res = await fetch(PINATA_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  if (!res.ok) {
    const msg = json?.error?.message || text.slice(0, 200);
    throw new Error(`Pinata HTTP ${res.status}: ${msg}`);
  }
  const d = json?.data;
  if (!d?.cid || !d?.id) throw new Error(`Resposta Pinata inválida: ${text.slice(0, 150)}`);
  const sizeBytes = typeof d.size === 'number' ? d.size : buffer.byteLength;
  const uploadedAt =
    typeof d.created_at === 'string' && d.created_at.trim()
      ? d.created_at.trim()
      : new Date().toISOString();
  return {
    cid: d.cid,
    pinataFileId: d.id,
    publicUrl: gatewayUrl(d.cid, gatewayPrefix),
    originalFileName: typeof d.name === 'string' && d.name.trim() ? d.name : filename,
    mimeType: typeof d.mime_type === 'string' && d.mime_type.trim() ? d.mime_type : mimeType,
    sizeBytes,
    uploadedAt,
  };
}

function publicStorageUrl(supabaseUrl, path) {
  const base = supabaseUrl.replace(/\/$/, '');
  const enc = path
    .replace(/^\//, '')
    .split('/')
    .map((p) => encodeURIComponent(p))
    .join('/');
  return `${base}/storage/v1/object/public/${BUCKET}/${enc}`;
}

async function fetchBytes(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`GET ${url} → ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

function storedVariant(m) {
  return {
    cid: m.cid,
    publicUrl: m.publicUrl,
    originalFileName: m.originalFileName,
    mimeType: m.mimeType,
    sizeBytes: m.sizeBytes,
    uploadedAt: m.uploadedAt,
    pinataFileId: m.pinataFileId,
    status: 'success',
  };
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const pinataJwt = process.env.PINATA_JWT?.trim();
  const gatewayPrefix = (process.env.PINATA_GATEWAY_PREFIX?.trim() || DEFAULT_GATEWAY).replace(/\/?$/, '/');

  if (!supabaseUrl || !serviceKey) {
    console.error('Falta SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY em server/.env');
    process.exit(1);
  }
  if (!pinataJwt) {
    console.error('Falta PINATA_JWT em server/.env');
    process.exit(1);
  }

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rows, error } = await sb
    .from('genesis_market_players')
    .select('id, name, portrait_storage_path, portrait_public_url, portrait_media_refs')
    .not('portrait_storage_path', 'is', null);

  if (error) {
    console.error('Supabase select:', error.message);
    process.exit(1);
  }

  const candidates = (rows ?? []).filter((r) => r.portrait_storage_path?.trim());
  console.log(`Encontrados ${candidates.length} jogadores com portrait_storage_path.`);

  if (!EXECUTE) {
    console.log('\nDry-run. Para migrar de verdade:');
    console.log('  node scripts/migrate-genesis-portraits-to-pinata.mjs --execute');
    if (candidates.length) {
      console.log('\nExemplos:');
      for (const r of candidates.slice(0, 8)) {
        console.log(`  ${r.id}  ${r.name}  →  ${r.portrait_storage_path}`);
      }
    }
    return;
  }

  let ok = 0;
  let fail = 0;

  for (const row of candidates) {
    const cardPath = row.portrait_storage_path.trim();
    const tokenPath = cardPath.replace(/-card\./, '-token.');
    const id = row.id;
    process.stdout.write(`\n${id} (${row.name})… `);

    try {
      const cardUrl = publicStorageUrl(supabaseUrl, cardPath);
      const cardBuf = await fetchBytes(cardUrl);
      const mimeCard = cardPath.endsWith('.webp')
        ? 'image/webp'
        : cardPath.endsWith('.png')
          ? 'image/png'
          : 'image/jpeg';

      let tokenBuf;
      let mimeToken = mimeCard;
      if (tokenPath !== cardPath) {
        const tokenUrl = publicStorageUrl(supabaseUrl, tokenPath);
        tokenBuf = await fetchBytes(tokenUrl);
        if (tokenPath.endsWith('.webp')) mimeToken = 'image/webp';
      } else {
        tokenBuf = cardBuf;
      }

      const cardName = `${id}-card${cardPath.match(/\.[^.]+$/)?.[0] ?? '.webp'}`;
      const tokenName = `${id}-token${tokenPath.match(/\.[^.]+$/)?.[0] ?? '.webp'}`;

      const kv = { olefoot_entity_type: 'genesis_market_player', olefoot_entity_id: id, migration: 'storage_to_pinata' };

      const [cardMeta, tokenMeta] = await Promise.all([
        uploadBufferToPinata({
          jwt: pinataJwt,
          buffer: cardBuf,
          filename: cardName,
          mimeType: mimeCard,
          gatewayPrefix,
          keyvalues: kv,
        }),
        uploadBufferToPinata({
          jwt: pinataJwt,
          buffer: tokenBuf,
          filename: tokenName,
          mimeType: mimeToken,
          gatewayPrefix,
          keyvalues: kv,
        }),
      ]);

      const nowIso = new Date().toISOString();
      const portrait_media_refs = {
        provider: 'pinata',
        entityType: 'genesis_market_player',
        entityId: id,
        uploadedAt: nowIso,
        card: storedVariant(cardMeta),
        token: storedVariant(tokenMeta),
        source: 'supabase_storage_migration',
      };

      const { error: upErr } = await sb
        .from('genesis_market_players')
        .update({
          portrait_public_url: cardMeta.publicUrl,
          portrait_token_public_url: tokenMeta.publicUrl,
          portrait_media_refs,
          portrait_storage_path: null,
          updated_at: nowIso,
        })
        .eq('id', id);

      if (upErr) throw new Error(`DB: ${upErr.message}`);

      if (DELETE_STORAGE) {
        const paths = tokenPath !== cardPath ? [cardPath, tokenPath] : [cardPath];
        const { error: rmErr } = await sb.storage.from(BUCKET).remove(paths);
        if (rmErr) console.warn(`  aviso: Storage remove: ${rmErr.message}`);
      }

      console.log('OK');
      ok++;
      await new Promise((r) => setTimeout(r, 150));
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
