#!/usr/bin/env node
/**
 * Lê imagens locais em `public/players-photos/` (estrutura Genesis), envia para Pinata e atualiza `genesis_market_players`.
 *
 * Convenção de ficheiros (qualquer uma das pastas; `genesis/` tem prioridade sobre a raiz):
 *   public/players-photos/genesis/GEN-001-card.webp
 *   public/players-photos/genesis/GEN-001-token.webp
 * ou na raiz `public/players-photos/GEN-001-card.webp`
 *
 * Formatos: .webp, .png, .jpg, .jpeg
 *
 * Env (server/.env):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PINATA_JWT
 * Opcional: PINATA_GATEWAY_PREFIX
 *
 * Uso na raiz do repo:
 *   node scripts/import-local-players-photos-to-pinata.mjs                    # lista o que encontrou
 *   node scripts/import-local-players-photos-to-pinata.mjs --execute          # envia + grava Supabase
 *   node scripts/import-local-players-photos-to-pinata.mjs --execute --dir public/outras-fotos/genesis
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
dotenv.config({ path: join(ROOT, 'server/.env') });

const PINATA_URL = 'https://uploads.pinata.cloud/v3/files';
const DEFAULT_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';
const FILE_RE = /^(GEN-\d+)-(card|token)\.(webp|png|jpe?g)$/i;

const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');
const dirIdx = args.indexOf('--dir');
const CUSTOM_DIR =
  dirIdx >= 0 && args[dirIdx + 1] && !args[dirIdx + 1].startsWith('--')
    ? join(ROOT, args[dirIdx + 1])
    : null;

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

function mimeFromPath(p) {
  const low = p.toLowerCase();
  if (low.endsWith('.webp')) return 'image/webp';
  if (low.endsWith('.png')) return 'image/png';
  if (low.endsWith('.jpg') || low.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
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

/** Primeira pasta listada ganha (genesis/ antes da raiz players-photos). */
function collectLocalFiles() {
  const dirs = CUSTOM_DIR
    ? [CUSTOM_DIR]
    : [join(ROOT, 'public/players-photos/genesis'), join(ROOT, 'public/players-photos')];
  const byKey = new Map();
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      if (!name.isFile()) continue;
      const m = name.name.match(FILE_RE);
      if (!m) continue;
      const id = m[1].toUpperCase();
      const variant = m[2].toLowerCase();
      const key = `${id}-${variant}`;
      if (byKey.has(key)) continue;
      byKey.set(key, join(dir, name.name));
    }
  }
  return byKey;
}

function listPlayerIds(byKey) {
  const ids = new Set();
  for (const k of byKey.keys()) {
    ids.add(k.replace(/-(card|token)$/, ''));
  }
  return [...ids].sort();
}

async function main() {
  const byKey = collectLocalFiles();
  const ids = listPlayerIds(byKey);
  const pinataJwt = process.env.PINATA_JWT?.trim();
  const gatewayPrefix = (process.env.PINATA_GATEWAY_PREFIX?.trim() || DEFAULT_GATEWAY).replace(/\/?$/, '/');
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  console.log(`Pastas: ${CUSTOM_DIR || join(ROOT, 'public/players-photos/genesis')} (+ raiz opcional)`);
  console.log(`Pares card/token encontrados (ids): ${ids.length}`);
  if (!ids.length) {
    console.error('Nenhum ficheiro GEN-xxx-card|token.(webp|png|jpg). Verifica public/players-photos/');
    process.exit(1);
  }
  console.log('Exemplos:', ids.slice(0, 5).join(', '), '…');

  const missing = [];
  for (const id of ids) {
    if (!byKey.has(`${id}-card`)) missing.push(`${id} (sem card)`);
    else if (!byKey.has(`${id}-token`)) missing.push(`${id} (sem token — em execução usa-se o card duas vezes)`);
  }
  if (missing.length) console.log('Notas:', missing.slice(0, 8).join('; '), missing.length > 8 ? '…' : '');

  if (!EXECUTE) {
    console.log('\nDry-run. Para enviar ao Pinata e gravar no Supabase:');
    console.log('  node scripts/import-local-players-photos-to-pinata.mjs --execute');
    return;
  }

  if (!pinataJwt) {
    console.error('Falta PINATA_JWT em server/.env');
    process.exit(1);
  }
  if (!supabaseUrl || !serviceKey) {
    console.error('Falta SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY em server/.env');
    process.exit(1);
  }

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let ok = 0;
  let fail = 0;

  for (const id of ids) {
    const cardPath = byKey.get(`${id}-card`);
    if (!cardPath) {
      console.error(`\n${id}: sem ficheiro card, a saltar.`);
      fail++;
      continue;
    }
    const tokenPath = byKey.get(`${id}-token`) || cardPath;
    process.stdout.write(`\n${id}… `);
    try {
      const cardBuf = readFileSync(cardPath);
      const tokenBuf = readFileSync(tokenPath);
      const extCard = cardPath.match(/\.[^.]+$/)?.[0] ?? '.webp';
      const extTok = tokenPath.match(/\.[^.]+$/)?.[0] ?? extCard;
      const mimeCard = mimeFromPath(cardPath);
      const mimeTok = mimeFromPath(tokenPath);
      const kv = {
        olefoot_entity_type: 'genesis_market_player',
        olefoot_entity_id: id,
        source: 'public_players_photos_folder',
      };

      const [cardMeta, tokenMeta] = await Promise.all([
        uploadBufferToPinata({
          jwt: pinataJwt,
          buffer: cardBuf,
          filename: `${id}-card${extCard}`,
          mimeType: mimeCard,
          gatewayPrefix,
          keyvalues: kv,
        }),
        uploadBufferToPinata({
          jwt: pinataJwt,
          buffer: tokenBuf,
          filename: `${id}-token${extTok}`,
          mimeType: mimeTok,
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
        source: 'local_public_players_photos',
      };

      const { error } = await sb
        .from('genesis_market_players')
        .update({
          portrait_public_url: cardMeta.publicUrl,
          portrait_token_public_url: tokenMeta.publicUrl,
          portrait_media_refs,
          portrait_storage_path: null,
          updated_at: nowIso,
        })
        .eq('id', id);

      if (error) throw new Error(error.message);
      console.log('OK');
      ok++;
      await new Promise((r) => setTimeout(r, 180));
    } catch (e) {
      console.log('FALHOU', e instanceof Error ? e.message : e);
      fail++;
    }
  }

  console.log(`\nResumo: ${ok} jogadores OK, ${fail} falhas.`);
  if (fail) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
