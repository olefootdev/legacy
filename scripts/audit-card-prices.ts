/**
 * AUDITORIA DE PREÇO DOS CARDS — `npm run audit:card-prices`
 *
 * ── POR QUE ELA EXISTE ──────────────────────────────────────────────────────
 * Em julho um card de US$5 foi vendido por 1 OLEFOOT. A causa não estava no
 * código do checkout: estava no DADO. O import só espelhava o preço quando a
 * moeda era OLEFOOT, então card em USDT nascia com `price_bro_cents = 0` — e o
 * caminho de compra por OLEFOOT, sem a guarda de moeda, caía num piso de 1.
 *
 * O código foi consertado (guarda em `/api/market/buy-legacy` e em
 * `resolveCardCheckout`). `npm run test:card-pricing` cobre o lado PIX. O que
 * NÃO tinha cobertura era o dado em si — e é o dado que muda toda semana, sem
 * passar por revisão de código, quando alguém edita um card no painel.
 *
 * Este script lê a produção e confere cada linha contra os DOIS contratos reais:
 *
 *   PIX      (resolveCardCheckout, server/src/lib/cardPricing.ts)
 *     currency = 'USDT' · price_unit_cents > 0 · valor final ≥ R$ 1,00
 *
 *   OLEFOOT  (/api/market/buy-legacy, server/src/routes/market.ts)
 *     currency = 'OLEFOOT' · price_bro_cents > 0  ← comparado como INTEIRO,
 *     não centavo: 250000 ali são 250.000 OLEFOOT
 *
 * ── E A BOMBA ARMADA ────────────────────────────────────────────────────────
 * Card carregando o preço da OUTRA moeda não quebra hoje — a guarda de moeda
 * barra. Mas vira o preço de venda no dia em que alguém trocar a moeda daquele
 * card no painel. Era o caso do `legacy-juca-consolidacao`: USDT com 1.000.000
 * em `price_bro_cents`.
 *
 * Desde 20260806280000 um trigger normaliza isso em toda escrita. Então achar
 * um aqui virou FALHA, não aviso: significa que alguém escreveu por fora do
 * caminho normal (restore, cópia de tabela, migration mal feita) e a rede de
 * proteção não pegou.
 *
 * Sai com código 1 se achar qualquer FALHA — dá pra pendurar em CI.
 */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Piso de sanidade em OLEFOOT. Abaixo disso é preço de engano, não de card. */
const PISO_OLEFOOT = 1_000;
/** O checkout PIX recusa abaixo de R$ 1,00 — refletido aqui. */
const PISO_BRL_CENTS = 100;

interface Card {
  id: string;
  name: string | null;
  currency: string | null;
  price_unit_cents: number | null;
  price_bro_cents: number | null;
  listed_on_market: boolean | null;
}

async function cotacaoUsdBrl(): Promise<number> {
  try {
    const r = await fetch('https://br.dolarapi.com/v1/cotacoes');
    const d = (await r.json()) as Array<{ moeda?: string; venda?: number }>;
    const usd = (Array.isArray(d) ? d : []).find((x) => String(x.moeda).toUpperCase() === 'USD');
    if (usd?.venda && usd.venda > 0) return usd.venda;
  } catch {
    /* sem cotação: usa um piso conservador só pra checar a ordem de grandeza */
  }
  return 5;
}

async function main() {
  if (!URL || !KEY) {
    console.error('Faltam SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
    console.error('Rode com: npm run audit:card-prices');
    process.exit(2);
  }

  const sb = createClient(URL, KEY, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from('legacy_players')
    .select('id, name, currency, price_unit_cents, price_bro_cents, listed_on_market')
    .order('id');

  if (error) {
    console.error('Falha ao ler legacy_players:', error.message);
    process.exit(2);
  }

  const cards = (data ?? []) as Card[];
  const venda = await cotacaoUsdBrl();
  const falhas: string[] = [];
  const avisos: string[] = [];

  for (const c of cards) {
    const moeda = c.currency ?? '(null)';
    const usd = Number(c.price_unit_cents ?? 0);
    const ole = Number(c.price_bro_cents ?? 0);
    const listado = Boolean(c.listed_on_market);

    // Moeda ausente cai em 'OLEFOOT' nos dois guardas — nunca é o que se quis.
    if (c.currency == null) {
      (listado ? falhas : avisos).push(`${c.id}: currency NULL (os guardas assumem OLEFOOT)`);
    }

    if (listado && moeda === 'USDT') {
      if (usd <= 0) falhas.push(`${c.id}: à venda por PIX sem price_unit_cents`);
      else if (Math.round(usd * venda) < PISO_BRL_CENTS) {
        falhas.push(`${c.id}: PIX daria R$ ${(usd * venda) / 100} — abaixo do piso de R$ 1,00`);
      }
    }

    // Preço muito abaixo dos pares. O Juca estava em US$2 com OVR 80 enquanto
    // as outras consolidações iam de US$5 a US$15 — não é bug de código, é
    // placeholder esquecido, e só se vê comparando.
    if (listado && moeda === 'USDT' && usd > 0 && usd < 300) {
      avisos.push(`${c.id}: US$ ${(usd / 100).toFixed(2)} — abaixo do card mais barato do catálogo (US$ 3)`);
    }

    if (listado && moeda === 'OLEFOOT') {
      if (ole <= 0) falhas.push(`${c.id}: à venda em OLEFOOT sem preço (buy-legacy recusa)`);
      else if (ole < PISO_OLEFOOT) {
        falhas.push(`${c.id}: ${ole} OLEFOOT — é o formato do bug de julho (card por ~1)`);
      }
    }

    // Bombas armadas: preço da OUTRA moeda sobrando na linha.
    //
    // Desde 20260806280000 um trigger normaliza isso em toda escrita, então
    // achar um aqui significa que ALGUÉM ESCREVEU POR FORA do banco normal —
    // restore, cópia de tabela, migration mal feita. Por isso virou FALHA, não
    // aviso: se a rede de proteção falhou, quero saber alto.
    if (moeda === 'USDT' && ole > 0) {
      falhas.push(`${c.id}: USDT carregando ${ole} em price_bro_cents (o trigger devia ter zerado)`);
    }
    if (moeda === 'OLEFOOT' && usd > 0) {
      falhas.push(`${c.id}: OLEFOOT carregando ${usd} em price_unit_cents (o trigger devia ter zerado)`);
    }
  }

  const aVenda = cards.filter((c) => c.listed_on_market);
  console.log(`\n💳 Auditoria de preço — ${cards.length} cards, ${aVenda.length} à venda`);
  console.log(`   cotação USD/BRL usada: ${venda}\n`);

  for (const c of aVenda) {
    const moeda = c.currency ?? '(null)';
    const preco =
      moeda === 'USDT'
        ? `US$ ${(Number(c.price_unit_cents ?? 0) / 100).toFixed(2)} ≈ R$ ${((Number(c.price_unit_cents ?? 0) * venda) / 100).toFixed(2)}`
        : `${Number(c.price_bro_cents ?? 0).toLocaleString('pt-BR')} OLEFOOT`;
    console.log(`   ${c.id.padEnd(38)} ${moeda.padEnd(8)} ${preco}`);
  }

  if (avisos.length) {
    console.log('\n⚠️  AVISOS (não quebram hoje, quebram se a moeda mudar):');
    for (const a of avisos) console.log(`   · ${a}`);
  }

  if (falhas.length) {
    console.log('\n❌ FALHAS:');
    for (const f of falhas) console.log(`   · ${f}`);
    console.log('');
    process.exit(1);
  }

  console.log('\n✅ Nenhum card vendável por preço de engano.\n');
}

void main();
