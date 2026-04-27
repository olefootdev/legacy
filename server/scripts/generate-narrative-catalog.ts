/**
 * Gera o catálogo narrativo completo e grava em Supabase.
 *
 * Uso:
 *   cd server
 *   npx tsx scripts/generate-narrative-catalog.ts            # V1 completa (~1500 templates)
 *   npx tsx scripts/generate-narrative-catalog.ts --category goal --count 40
 *
 * Env necessárias (server/.env):
 *   ANTHROPIC_API_KEY=
 *   SUPABASE_URL=
 *   SUPABASE_SERVICE_ROLE_KEY=   # admin_insert_narrative_batch exige is_admin()
 *
 * Custo aprox (Haiku): ~$1.15 pra V1 completa.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { generateCatalog, type CatalogSlot } from '../src/services/anthropic/narrativeCatalog.js';

// ─── Config V1 do catálogo ────────────────────────────────────────────────
// Cada linha = 1 chamada Anthropic. Custo ≈ $0.002 por linha em Haiku.
// Ajuste `count` pra mais variedade (caro) ou menos (barato).

const CATEGORIES: Omit<CatalogSlot, 'personaVibe'>[] = [
  // ── Gol ───────────────────────────────────────────────
  { category: 'goal', intensity: 'normal',      count: 10 },
  { category: 'goal', intensity: 'late',        contextTags: ['last_15_min'], count: 10 },
  { category: 'goal', intensity: 'world_class', count: 10 },
  { category: 'goal', intensity: 'comeback',    contextTags: ['losing','momentum_shift'], count: 10 },
  { category: 'goal', intensity: 'own_goal',    count: 6 },
  // ── Finalização ─────────────────────────────────────────
  { category: 'shot_saved',  intensity: 'routine',     count: 8 },
  { category: 'shot_saved',  intensity: 'good',        count: 10 },
  { category: 'shot_saved',  intensity: 'world_class', count: 6 },
  { category: 'shot_missed', intensity: 'close',       count: 10 },
  { category: 'shot_missed', intensity: 'wild',        count: 6 },
  // ── Faltas e cartões ────────────────────────────────────
  { category: 'foul_yellow', intensity: 'tactical',    count: 8 },
  { category: 'foul_yellow', intensity: 'rash',        count: 6 },
  { category: 'foul_yellow', intensity: 'last_man',    count: 4 },
  { category: 'foul_red',    intensity: 'dangerous',   count: 6 },
  { category: 'foul_red',    intensity: 'second_yellow', count: 4 },
  // ── Substituição ────────────────────────────────────────
  { category: 'substitution', intensity: 'fresh_legs',     count: 6 },
  { category: 'substitution', intensity: 'injury_forced',  count: 4 },
  { category: 'substitution', intensity: 'tactical',       count: 6 },
  // ── Momento / pressão ──────────────────────────────────
  { category: 'momentum_shift',   intensity: 'home_rising', count: 6 },
  { category: 'momentum_shift',   intensity: 'away_rising', count: 6 },
  { category: 'pressure_moment',  intensity: 'last_5_min',   count: 6 },
  { category: 'pressure_moment',  intensity: 'penalty_incoming', count: 4 },
  // ── Tempo de jogo ──────────────────────────────────────
  { category: 'half_time', intensity: 'winning', count: 4 },
  { category: 'half_time', intensity: 'losing',  count: 4 },
  { category: 'half_time', intensity: 'drawing', count: 4 },
  { category: 'full_time', intensity: 'thriller', count: 5 },
  { category: 'full_time', intensity: 'goalless', count: 4 },
  { category: 'full_time', intensity: 'rout',     count: 4 },
];

const PERSONA_VIBES = ['analytical', 'visceral', 'poetic', 'casual'] as const;

// ─── CLI args ─────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2).reduce<[string, string][]>((acc, cur, i, arr) => {
    if (cur.startsWith('--')) {
      const k = cur.slice(2);
      const v = arr[i + 1] && !arr[i + 1]!.startsWith('--') ? arr[i + 1]! : 'true';
      acc.push([k, v]);
    }
    return acc;
  }, []),
);

async function main() {
  console.log('=== Gerador de catálogo narrativo — Anthropic Haiku ===\n');

  // Filtros opcionais por CLI
  const onlyCategory = typeof args.category === 'string' ? args.category : null;
  const countOverride = args.count ? Number(args.count) : null;
  const onlyVibe = typeof args.vibe === 'string' ? args.vibe : null;

  let slots: CatalogSlot[] = [];
  for (const cat of CATEGORIES) {
    if (onlyCategory && cat.category !== onlyCategory) continue;
    for (const vibe of PERSONA_VIBES) {
      if (onlyVibe && vibe !== onlyVibe) continue;
      slots.push({
        ...cat,
        count: countOverride ?? cat.count,
        personaVibe: vibe,
      });
    }
  }

  const totalTargets = slots.reduce((s, x) => s + x.count, 0);
  console.log(`Slots: ${slots.length}`);
  console.log(`Templates alvo: ~${totalTargets}`);
  console.log(`Estimativa Haiku: ~$${(totalTargets * 0.002).toFixed(2)}\n`);

  if (args['dry-run']) {
    console.log('Dry-run — não chama Anthropic nem Supabase. Use sem --dry-run pra rodar.\n');
    slots.slice(0, 5).forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.category}/${s.intensity}/${s.personaVibe} × ${s.count}`);
    });
    return;
  }

  console.log('Gerando…\n');
  const all = await generateCatalog(slots);
  console.log(`\n✓ Total gerado: ${all.length} templates\n`);

  // Insere via Supabase service role
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('✗ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes.');
    console.error('  Templates gerados NÃO foram inseridos. Salvando em /tmp/narrative-catalog.json.');
    const fs = await import('fs');
    fs.writeFileSync('/tmp/narrative-catalog.json', JSON.stringify(all, null, 2));
    return;
  }

  const sb = createClient(supabaseUrl, serviceKey);
  const { data, error } = await sb.rpc('admin_insert_narrative_batch', {
    p_templates: all,
  });
  if (error) {
    console.error('✗ Falha ao inserir batch:', error.message);
    process.exit(1);
  }
  console.log(`✓ Batch inserido: ${data}`);
  console.log('\n=== OK ===');
}

main().catch((err) => {
  console.error('\n✗ Falha:', err);
  process.exit(1);
});
