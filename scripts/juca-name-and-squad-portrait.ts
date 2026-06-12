/**
 * Renomeia o Juca pra "Juca" curto no banco.
 * (A foto do plantel é resolvida via convenção em src/lib/playerPortrait.ts:
 *  `juca-olefoot.png` no card → `juca-profile.png` no plantel.)
 *
 * Uso:
 *   npx tsx --env-file=server/.env scripts/juca-name-and-squad-portrait.ts
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente em server/.env');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function main() {
  console.log('🛠  Renomeando Juca pra "Juca" curto no plantel/market\n');

  const { data, error } = await sb
    .from('legacy_players')
    .update({
      name: 'Juca',
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'legacy-juca-consolidacao')
    .select('id, name, portrait_public_url, listed_on_market, price_bro_cents')
    .single();

  if (error) {
    console.error('  ✗ Update falhou:', error.message);
    process.exit(1);
  }

  console.log('✅ Juca atualizado:');
  console.log(`   id:           ${data.id}`);
  console.log(`   nome:         ${data.name}`);
  console.log(`   card market:  ${data.portrait_public_url}`);
  console.log(`   preço:        ${data.price_bro_cents?.toLocaleString('pt-BR')} OLE · listed=${data.listed_on_market}`);
  console.log('\n   Foto plantel resolvida via convenção: juca-olefoot.png → juca-profile.png');
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
