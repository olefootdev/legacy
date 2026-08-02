/**
 * Self-test: o jogo não gera mais BRO para o manager.
 *
 * Diretriz do fundador (2026-08-01): sem lucro em BRO. BRO é dinheiro com
 * valor real — o jogo pode receber (depósito) e custodiar (escrow de desafio),
 * mas não pode EMITIR.
 *
 * Duas torneiras foram fechadas:
 *   1. Campanha da Megaloja — convertia 540 EXP em R$ 75 de BRO, sem cooldown
 *      nem teto. Em loop, imprimia dinheiro.
 *   2. Troféus memoráveis — pagavam R$ 50 / 25 / 15 por título.
 *
 *   npm run test:no-bro-profit
 */
import { memorableTrophyFinanceReward } from '../trophies/memorablePrizes';
import { CITY_QUICK_STORE_COST_EXP } from './cityQuickConstants';

let falhas = 0;

function checa(nome: string, ok: boolean, detalhe = '') {
  if (!ok) falhas++;
  console.log(`${ok ? '✓' : '✗'} ${nome}${detalhe ? ' — ' + detalhe : ''}`);
}

// ── 1. Nenhum troféu memorável paga BRO ────────────────────────────────────
for (const id of ['mem_liga_ole', 'mem_copa_ole', 'mem_supercopa_ole']) {
  const r = memorableTrophyFinanceReward(id);
  checa(`troféu ${id} não paga BRO`, r.broCents === 0, `broCents=${r.broCents}`);
  checa(`troféu ${id} continua pagando EXP`, r.exp > 0, `exp=${r.exp}`);
}

// ── 2. A campanha da Megaloja continua CUSTANDO EXP ────────────────────────
// (a mecânica sobrevive; o que saiu foi o pagamento em dinheiro real)
checa(
  'campanha da Megaloja ainda custa EXP',
  CITY_QUICK_STORE_COST_EXP > 0,
  `${CITY_QUICK_STORE_COST_EXP} EXP`,
);

// ── 3. A constante de ganho em BRO não existe mais ─────────────────────────
const constantes = await import('./cityQuickConstants');
checa(
  'CITY_QUICK_STORE_BRO_GAIN_CENTS foi removida',
  !('CITY_QUICK_STORE_BRO_GAIN_CENTS' in constantes),
);

console.log(falhas === 0 ? '\n✅ o jogo não emite BRO' : `\n❌ ${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
