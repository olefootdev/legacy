/**
 * Olefoot Legend Creator — CLI de importação
 *
 * Lê `legends/<slug>/legend.json`, valida e dispara
 * POST /api/admin/legend-import → cria 3 rows em legacy_players.
 *
 * USO:
 *   npm run legend:import marcelo-goncalves
 *   npm run legend:import marcelo-goncalves --api http://localhost:4000
 *
 * Variáveis de ambiente:
 *   OLEFOOT_API_URL       URL do server Olefoot (default: http://localhost:4000)
 *   OLEFOOT_ADMIN_TOKEN   Token X-Admin-Token (obrigatório)
 *   GLOBAL_LEAGUE_ADMIN_TOKEN | ADMIN_API_TOKEN  (aliases aceitos)
 *
 * O server lê o mesmo token via lib/adminAuth.ts.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

interface CliArgs {
  slug: string;
  api: string;
  token: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);
  const positional = args.filter((a) => !a.startsWith('--'));
  const flags = new Map<string, string>();
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : 'true';
      flags.set(key, val);
    }
  }
  const slug = positional[0];
  if (!slug) {
    console.error('Uso: npm run legend:import <slug> [--api URL]');
    console.error('Ex.:  npm run legend:import marcelo-goncalves');
    process.exit(1);
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    console.error(`✗ slug inválido (use kebab-case): ${slug}`);
    process.exit(1);
  }

  const api =
    flags.get('api') ??
    process.env.OLEFOOT_API_URL?.trim() ??
    'http://localhost:4000';

  const token =
    flags.get('token') ??
    process.env.OLEFOOT_ADMIN_TOKEN?.trim() ??
    process.env.GLOBAL_LEAGUE_ADMIN_TOKEN?.trim() ??
    process.env.ADMIN_API_TOKEN?.trim() ??
    '';

  // Em dev local (localhost) o middleware admin libera passagem se nenhum token
  // estiver configurado no server. Só exigimos token quando apontamos remoto.
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(api);
  if (!token && !isLocal) {
    console.error(
      '✗ ADMIN token não encontrado (API remoto exige). Defina OLEFOOT_ADMIN_TOKEN no env ou passe --token <valor>.',
    );
    process.exit(1);
  }
  if (!token && isLocal) {
    console.log('   (sem ADMIN token — modo dev local)');
  }

  return { slug, api: api.replace(/\/$/, ''), token };
}

async function loadLegendJson(slug: string): Promise<unknown> {
  const path = resolve(process.cwd(), 'legends', slug, 'legend.json');
  try {
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`✗ Falha ao ler ${path}: ${msg}`);
    process.exit(1);
  }
}

async function main() {
  const { slug, api, token } = parseArgs(process.argv);
  console.log(`\n🏟  Olefoot Legend Importer`);
  console.log(`   slug: ${slug}`);
  console.log(`   api:  ${api}`);

  const payload = await loadLegendJson(slug);
  const phases = (payload as { phases?: { phase?: string }[] }).phases ?? [];
  console.log(`   fases: ${phases.map((p) => p.phase).join(', ')}\n`);

  const url = `${api}/api/admin/legend-import`;
  console.log(`→ POST ${url}`);

  // Server csrfGuard exige header Origin. CLI usa origin do dev (localhost:5173)
  // que está em ALLOWED_ORIGINS. Em produção, o operador precisa garantir que
  // a origin do CLI esteja em CORS_ORIGIN do Railway.
  const origin = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(api)
    ? 'http://localhost:5173'
    : api;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': token,
        Origin: origin,
      },
      body: JSON.stringify({ slug, payload }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`\n✗ Falha de rede: ${msg}`);
    console.error(`  Verifica que o server Olefoot está rodando em ${api}.`);
    process.exit(2);
  }

  const txt = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(txt);
  } catch {
    json = { raw: txt };
  }

  if (!res.ok) {
    console.error(`\n✗ HTTP ${res.status}`);
    console.error(JSON.stringify(json, null, 2));
    process.exit(3);
  }

  console.log(`\n✓ Importado com sucesso`);
  const result = json as {
    collectionId?: string;
    inserted?: Array<Record<string, unknown>>;
    lots?: Array<{ legacy_player_id: string; lot_number: number; lot_id: string | null }>;
  };
  console.log(`  collection: ${result.collectionId ?? '(unknown)'}`);
  if (result.inserted) {
    for (const row of result.inserted) {
      const supply = row.card_supply ?? '?';
      const price = row.price_unit_cents ?? '?';
      const ccy = row.currency ?? '?';
      const tier = row.tier ?? '?';
      const code = row.collection_code ?? '—';
      console.log(
        `  · ${row.id}`,
      );
      console.log(
        `      tier=${tier} · ${code} · ${supply} cópias × ${price} cents ${ccy} (mint OVR ${row.mint_overall})`,
      );
    }
  }
  if (result.lots && result.lots.length > 0) {
    console.log(`  lotes iniciais: ${result.lots.length} criados`);
  }
  console.log(`\nProntinho. O jogador aparece no AdminLegacyPanel.`);
}

main().catch((e) => {
  console.error('✗ Erro inesperado:', e);
  process.exit(99);
});
