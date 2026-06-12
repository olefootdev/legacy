/**
 * Remove as fases Revelação e Expansão do Juca do banco.
 * Mantém apenas a fase Consolidação no game.
 *
 * Uso:
 *   npx tsx --env-file=server/.env scripts/delete-juca-extra-phases.ts
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente em server/.env');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const TO_DELETE = ['legacy-juca-revelacao', 'legacy-juca-expansao'];

async function main() {
  console.log('🗑  Deletando fases extras do Juca\n');

  // 1) Tenta limpar lotes filhos primeiro (se a coluna existir)
  for (const id of TO_DELETE) {
    const { error: lotErr, count } = await sb
      .from('legacy_player_lots')
      .delete({ count: 'exact' })
      .eq('legacy_player_id', id);

    if (lotErr) {
      console.warn(`  ⚠️  lots ${id}: ${lotErr.message} (pode não ser crítico)`);
    } else {
      console.log(`  · lots ${id}: ${count ?? 0} removidos`);
    }
  }

  // 2) Deleta as rows principais
  for (const id of TO_DELETE) {
    const { data, error } = await sb
      .from('legacy_players')
      .delete()
      .eq('id', id)
      .select('id, name');

    if (error) {
      console.error(`  ✗ ${id}: ${error.message}`);
      process.exit(1);
    }
    if (!data || data.length === 0) {
      console.log(`  · ${id}: já não existia`);
    } else {
      console.log(`  ✓ ${id} removido (${data[0].name})`);
    }
  }

  // 3) Confirma quem sobrou
  const { data: remaining } = await sb
    .from('legacy_players')
    .select('id, name, listed_on_market, price_bro_cents')
    .like('id', 'legacy-juca-%');

  console.log('\n📋 Jucas restantes:');
  for (const r of remaining ?? []) {
    console.log(`  · ${r.id} — ${r.name} · listed=${r.listed_on_market} · ${r.price_bro_cents?.toLocaleString('pt-BR')} OLE`);
  }
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
