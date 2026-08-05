/**
 * CORREÇÃO PONTUAL — o preço do Juca. `npm run fix:juca-price`
 *
 * ── POR QUE ISTO É SCRIPT E NÃO MIGRATION ───────────────────────────────────
 * Corrigir UMA linha específica não é mudança de estrutura. Num ambiente novo,
 * `update legacy_players where id = 'legacy-juca-consolidacao'` não acha nada e
 * não faz nada — e o histórico de schema fica poluído de correção pontual.
 *
 * Dado se conserta por aqui: roda pela service role (PostgREST resolve UPDATE
 * sem precisar de DDL), é IDEMPOTENTE, mostra antes/depois, e não muda nada se
 * já estiver certo.
 *
 * ── O QUE ESTAVA ERRADO ─────────────────────────────────────────────────────
 *   legacy-juca-consolidacao · OVR 80 · USDT · US$ 2,00 · 1.000.000 OLEFOOT
 *
 * Dois problemas na mesma linha:
 *  1. O 1.000.000 sobrando vira preço de venda se alguém trocar a moeda no
 *     painel. (A migration 20260806280000 mata essa classe com um trigger.)
 *  2. US$ 2,00 num OVR 80 — se listar como está, sai por ~R$ 10, enquanto as
 *     outras consolidações vão de US$ 5 a US$ 15 e o Palhinha OVR 95 sai por
 *     R$ 77.
 *
 * ── A ESCOLHA ───────────────────────────────────────────────────────────────
 * O registro do projeto diz **JUCA = 1M OLE**, então a linha fica coerente com
 * isso: OLEFOOT, 1.000.000, dólar zerado. Se a intenção era PIX, troque
 * `ALVO` abaixo — o card segue FORA DE VENDA nos dois casos, então nada muda
 * pra comprador nenhum hoje.
 */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ID = 'legacy-juca-consolidacao';

/** O estado correto. Trocar aqui se a decisão de moeda mudar. */
const ALVO = {
  currency: 'OLEFOOT',
  price_bro_cents: 1_000_000, // OLEFOOT inteiros — buy-legacy compara como inteiro
  price_unit_cents: 0,
} as const;

async function main() {
  if (!URL || !KEY) {
    console.error('Faltam SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Rode: npm run fix:juca-price');
    process.exit(2);
  }
  const sb = createClient(URL, KEY, { auth: { persistSession: false } });

  const { data: antes, error: e1 } = await sb
    .from('legacy_players')
    .select('id, name, currency, price_unit_cents, price_bro_cents, listed_on_market')
    .eq('id', ID)
    .maybeSingle();

  if (e1) {
    console.error('Falha ao ler:', e1.message);
    process.exit(2);
  }
  if (!antes) {
    console.log(`\nℹ️  ${ID} não existe neste banco — nada a fazer.\n`);
    return;
  }

  const a = antes as Record<string, unknown>;
  console.log(`\n💳 ${ID}`);
  console.log(`   antes : ${a.currency} · US$ ${(Number(a.price_unit_cents ?? 0) / 100).toFixed(2)} · ${Number(a.price_bro_cents ?? 0).toLocaleString('pt-BR')} OLEFOOT · ${a.listed_on_market ? 'À VENDA' : 'fora de venda'}`);

  const jaCerto =
    a.currency === ALVO.currency &&
    Number(a.price_bro_cents ?? 0) === ALVO.price_bro_cents &&
    Number(a.price_unit_cents ?? 0) === ALVO.price_unit_cents;

  if (jaCerto) {
    console.log('   → já está correto, nada mudou.\n');
    return;
  }

  const { error: e2 } = await sb.from('legacy_players').update(ALVO).eq('id', ID);
  if (e2) {
    console.error('   ✗ falha ao gravar:', e2.message);
    process.exit(1);
  }

  const { data: depois } = await sb
    .from('legacy_players')
    .select('currency, price_unit_cents, price_bro_cents, listed_on_market')
    .eq('id', ID)
    .maybeSingle();

  const d = (depois ?? {}) as Record<string, unknown>;
  console.log(`   depois: ${d.currency} · US$ ${(Number(d.price_unit_cents ?? 0) / 100).toFixed(2)} · ${Number(d.price_bro_cents ?? 0).toLocaleString('pt-BR')} OLEFOOT · ${d.listed_on_market ? 'À VENDA' : 'fora de venda'}`);
  console.log('\n✅ Corrigido. Confira com: npm run audit:card-prices\n');
}

void main();
