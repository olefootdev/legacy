/**
 * Publica a fase Consolidação do Juca no mercado:
 *   - price_bro_cents = 1.000.000 (= 1.000.000 OLE exibido)
 *   - listed_on_market = true
 *   - portrait_public_url = /newplayers-olefoot/juca-olefoot.png (card BRASIL 1970)
 *
 * Uso:
 *   npx tsx --env-file=server/.env scripts/publish-juca-to-market.ts
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente em server/.env');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const updates = [
  {
    id: 'legacy-juca-consolidacao',
    portrait_public_url: '/newplayers-olefoot/juca-olefoot.png',
  },
];

const PRICE_OLE = 1_000_000;

async function main() {
  console.log('🏟  Publicando Juca no mercado (1.000.000 OLE — só Consolidação)\n');

  for (const u of updates) {
    const { data, error } = await sb
      .from('legacy_players')
      .update({
        price_bro_cents: PRICE_OLE,
        listed_on_market: true,
        portrait_public_url: u.portrait_public_url,
        portrait_storage_path: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', u.id)
      .select('id, name, price_bro_cents, listed_on_market, portrait_public_url')
      .single();

    if (error) {
      console.error(`  ✗ ${u.id}: ${error.message}`);
      process.exit(1);
    }
    console.log(`  ✓ ${data.id}`);
    console.log(`      ${data.name}`);
    console.log(`      preço: ${data.price_bro_cents.toLocaleString('pt-BR')} OLE · listed=${data.listed_on_market}`);
    console.log(`      portrait: ${data.portrait_public_url}`);
  }

  console.log('\n✅ Juca Consolidação listado. Aparece em /transfer → aba Legacies.');
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
