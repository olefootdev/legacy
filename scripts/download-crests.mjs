#!/usr/bin/env node
/**
 * Baixa os brasões dos clubes (e seleções) do API-Sports para `public/crests/`.
 *
 * Os IDs são extraídos diretamente de `src/settings/worldClubs.ts` e
 * `src/settings/brazilianClubs.ts`, então adicionar um time novo nesses
 * arquivos e rodar `npm run crests:download` é suficiente.
 *
 * Uso:
 *   node scripts/download-crests.mjs           # baixa só os que faltam
 *   node scripts/download-crests.mjs --force   # baixa tudo de novo
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..');
const OUT_DIR = resolve(ROOT, 'public/crests');
const SOURCES = [
  resolve(ROOT, 'src/settings/worldClubs.ts'),
  resolve(ROOT, 'src/settings/brazilianClubs.ts'),
];

const FORCE = process.argv.includes('--force');

function collectIds() {
  const ids = new Set();
  for (const path of SOURCES) {
    if (!existsSync(path)) continue;
    const src = readFileSync(path, 'utf8');
    // Match `team(127, 'Flamengo')`, `team(6, 'Seleção Brasil')`, etc.
    for (const m of src.matchAll(/team\(\s*(\d+)\s*,/g)) {
      ids.add(parseInt(m[1], 10));
    }
    // Match `{ id: 127, name: 'Flamengo', logo: '...' }` no brazilianClubs.ts
    for (const m of src.matchAll(/\bid:\s*(\d+)\b/g)) {
      ids.add(parseInt(m[1], 10));
    }
  }
  return [...ids].sort((a, b) => a - b);
}

async function download(id) {
  const dest = resolve(OUT_DIR, `${id}.png`);
  if (!FORCE && existsSync(dest) && statSync(dest).size > 0) {
    return { id, status: 'skip' };
  }
  const url = `https://media.api-sports.io/football/teams/${id}.png`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; olefoot-crest-fetcher/1.0)',
        Accept: 'image/png,image/*;q=0.9,*/*;q=0.5',
      },
    });
    if (!res.ok) return { id, status: 'fail', code: res.status };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 200) return { id, status: 'fail', code: 'tiny' };
    writeFileSync(dest, buf);
    return { id, status: 'ok', bytes: buf.length };
  } catch (err) {
    return { id, status: 'fail', code: err?.message ?? 'error' };
  }
}

async function run() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const ids = collectIds();
  if (ids.length === 0) {
    console.error('Nenhum ID encontrado em', SOURCES.join(', '));
    process.exit(1);
  }
  console.log(`Encontrados ${ids.length} clubes. Baixando para ${OUT_DIR}...`);
  let ok = 0, skip = 0, fail = 0;
  // 6 downloads em paralelo, suave o suficiente pro CDN.
  const queue = [...ids];
  const workers = Array.from({ length: 6 }, async () => {
    while (queue.length > 0) {
      const id = queue.shift();
      const r = await download(id);
      if (r.status === 'ok') { ok++; console.log(`  ok    ${id} (${r.bytes}B)`); }
      else if (r.status === 'skip') { skip++; }
      else { fail++; console.warn(`  fail  ${id} -> ${r.code}`); }
    }
  });
  await Promise.all(workers);
  console.log(`\nResumo: ${ok} baixados, ${skip} pulados (já existiam), ${fail} falharam.`);
  if (fail > 0) {
    console.log('Tente novamente; o CDN pode estar instável. IDs falhos serão re-tentados na próxima execução.');
    process.exit(2);
  }
}

run();
