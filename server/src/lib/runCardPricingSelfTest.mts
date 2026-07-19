/**
 * Self-test do preço/entrega autoritativos do card no PIX (cardPricing.ts).
 *
 * Guarda um caminho de DINHEIRO: antes desta camada, `amount_cents` e
 * `metadata.player` vinham do cliente, e `confirm_payment_intent` credita o split
 * sobre o primeiro e entrega o segundo direto no plantel — dava pra pagar R$1 num
 * card de US$5 e receber um jogador com atributos inflados.
 *
 * Supabase é stub; a cotação é a real (a API pública é parte do caminho).
 * Roda: npm run test:card-pricing
 */
import { resolveCardCheckout } from './cardPricing.js';

type Row = Record<string, unknown>;

function stubSb(row: Row | null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }),
      }),
    }),
  } as never;
}

/** Fase 3 do Adauto — US$5,00, listada. */
const CARD: Row = {
  id: 'mem-adauto-2026-expansao',
  name: 'Adauto Evandro da Silva',
  pos: 'ATA',
  attributes: {
    passe: 84, marcacao: 70, velocidade: 82, drible: 86, finalizacao: 89,
    fisico: 82, tatico: 90, mentalidade: 96, confianca: 95, fairPlay: 96,
  },
  taught_attributes: ['mentalidade', 'fairPlay', 'finalizacao'],
  team_booster: { morale: 7, attack_pct: 4, defense_pct: 2 },
  price_unit_cents: 500,
  currency: 'USDT',
  listed_on_market: true,
  country: 'Brasil',
  bio: 'bio',
};

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${detail}`); }
}

console.log('\n🔐 cardPricing — preço e entrega autoritativos\n');

// 1) Preço sai do banco × cotação, nunca do cliente.
const ok = await resolveCardCheckout({ sb: stubSb(CARD), productRef: 'x', clientPlayer: {} });
if (ok.ok) {
  const brl = ok.checkout.amountCents / 100;
  console.log(`  → US$5,00 = R$ ${brl.toFixed(2)} (cotação da hora)`);
  check('valor plausível p/ US$5 (R$20–R$40)', brl > 20 && brl < 40, `veio R$${brl.toFixed(2)}`);
} else {
  check('card válido deveria resolver', false, JSON.stringify(ok));
}

// 2) Injeção de player: cliente manda outro id + atributos 99.
const attack = await resolveCardCheckout({
  sb: stubSb(CARD),
  productRef: 'x',
  clientPlayer: {
    id: 'legacy-outro-card', name: 'Hacker FC', pos: 'GOL', mintOverall: 99,
    attrs: {
      passe: 99, marcacao: 99, velocidade: 99, drible: 99, finalizacao: 99,
      fisico: 99, tatico: 99, mentalidade: 99, confianca: 99, fairPlay: 99,
    },
    portraitUrl: 'https://exemplo/retrato.png', num: 10,
  },
});
if (attack.ok) {
  const p = attack.checkout.player as Record<string, any>;
  check('id fixado no card pago', p.id === 'legacy-mem-adauto-2026-expansao', `veio ${p.id}`);
  check('nome fixado no banco', p.name === 'Adauto Evandro da Silva', `veio ${p.name}`);
  check('pos fixada no banco', p.pos === 'ATA', `veio ${p.pos}`);
  check('attrs fixados no banco', p.attrs.finalizacao === 89 && p.attrs.passe === 84, JSON.stringify(p.attrs));
  // 86 → 88: o OVR passou a ser ponderado POR POSIÇÃO. Este card é ATA, e pra
  // atacante a finalização (89) pesa 0.30 em vez de 0.12. Ver ovrWeights.ts.
  check('mintOverall recalculado dos attrs', p.mintOverall === 88, `veio ${p.mintOverall}`);
  check('cosmético do cliente preservado', p.portraitUrl === 'https://exemplo/retrato.png' && p.num === 10);

  // TRAVA DA CORREÇÃO POSICIONAL: os MESMOS atributos têm que dar OVR diferente
  // em posições diferentes. Se estes dois empatarem, o peso por posição voltou
  // a ser único — que era o bug (volante excelente punido por não fazer gol).
  const zagCard = { ...CARD, pos: 'ZAG' };
  const asZag = await resolveCardCheckout({ sb: stubSb(zagCard), productRef: 'x', clientPlayer: {} });
  if (asZag.ok) {
    const z = (asZag.checkout.player as Record<string, any>).mintOverall;
    check('mesma ficha vale diferente por posição (ATA≠ZAG)', z !== p.mintOverall, `ATA=${p.mintOverall} ZAG=${z}`);
  }
} else {
  check('card válido deveria resolver', false, JSON.stringify(attack));
}

// 3) Guardas.
const olefoot = await resolveCardCheckout({ sb: stubSb({ ...CARD, currency: 'OLEFOOT' }), productRef: 'x', clientPlayer: {} });
check('card OLEFOOT rejeitado no PIX', !olefoot.ok && olefoot.status === 409);

const unlisted = await resolveCardCheckout({ sb: stubSb({ ...CARD, listed_on_market: false }), productRef: 'x', clientPlayer: {} });
check('card não listado rejeitado', !unlisted.ok && unlisted.status === 409);

const zero = await resolveCardCheckout({ sb: stubSb({ ...CARD, price_unit_cents: 0 }), productRef: 'x', clientPlayer: {} });
check('preço 0 rejeitado (não vira R$1)', !zero.ok && zero.status === 409);

const missing = await resolveCardCheckout({ sb: stubSb(null), productRef: 'x', clientPlayer: {} });
check('card inexistente → 404', !missing.ok && missing.status === 404);

const noRef = await resolveCardCheckout({ sb: stubSb(CARD), productRef: '', clientPlayer: {} });
check('sem product_ref → 400', !noRef.ok && noRef.status === 400);

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);
