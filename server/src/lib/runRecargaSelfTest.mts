/**
 * Self-test da conversão do depósito. `npm run test:recarga`
 *
 * O que este arquivo existe pra provar: que R$ 100 não viram 100 BRO, que a
 * conta fecha em inteiro, e que o arredondamento nunca credita o que não foi
 * pago.
 */
import { converterRecarga, cotacaoEmMicro } from './recarga.js';
import { applyOlefootMarkup, OLEFOOT_BRL_MARKUP } from './usdBrlQuote.js';

let pass = 0, fail = 0;
const check = (nome: string, ok: boolean) => {
  if (ok) { pass++; console.log(`  ✅ ${nome}`); }
  else { fail++; console.log(`  ❌ ${nome}`); }
};

console.log('\n💵 depósito — reais → BRO (1 BRO = 1 dólar)\n');

check('🔑 a margem é 2,5%', OLEFOOT_BRL_MARKUP === 0.025);
check('dólar a R$ 5,40 sai por R$ 5,535 com a margem', applyOlefootMarkup(5.4) === 5.535);

const cot = cotacaoEmMicro(applyOlefootMarkup(5.4));
check('a cotação vira micro inteiro: 5.535.000', cot === 5_535_000n);

const bro = (brlCents: number, c = cot) => {
  const r = converterRecarga(brlCents, c);
  return r.ok ? r.recarga.broCents : null;
};

check('🔴 R$ 100 NÃO viram 100 BRO', bro(10_000) !== 10_000n);
check('🔑 R$ 100 viram 18,06 BRO', bro(10_000) === 1_806n);
check('R$ 5 (o mínimo) viram 0,90 BRO', bro(500) === 90n);
check('R$ 500 viram 90,33 BRO', bro(50_000) === 9_033n);
check('R$ 5,535 compram exatamente 1,00 BRO', bro(554) === 100n && bro(553) === 99n);

// Arredonda pra baixo: o que volta convertido em reais nunca passa do pago.
{
  let nuncaPassa = true;
  for (const brl of [500, 501, 999, 1_234, 10_000, 12_345, 99_999, 1_000_000]) {
    const b = bro(brl);
    if (b === null || (b * cot) / 1_000_000n > BigInt(brl)) nuncaPassa = false;
  }
  check('🔒 o BRO creditado nunca vale mais que os reais pagos', nuncaPassa);
}
{
  let perdeMenosQueUm = true;
  for (const brl of [500, 501, 999, 1_234, 10_000, 12_345, 99_999, 1_000_000]) {
    const b = bro(brl) as bigint;
    // o centavo de BRO seguinte já custaria mais do que foi pago
    if (((b + 1n) * cot) / 1_000_000n < BigInt(brl)) perdeMenosQueUm = false;
  }
  check('   e a casa fica com menos de 1 centavo de BRO por depósito', perdeMenosQueUm);
}

check('dólar mais caro compra menos BRO', (bro(10_000, 6_000_000n) as bigint) < (bro(10_000) as bigint));

const recusa = (brlCents: number, c: bigint) => {
  const r = converterRecarga(brlCents, c);
  return r.ok ? null : r.motivo;
};
check('🔒 valor zero é recusado', recusa(0, cot) === 'valor_invalido');
check('🔒 valor negativo é recusado', recusa(-100, cot) === 'valor_invalido');
check('🔒 valor quebrado é recusado', recusa(10.5, cot) === 'valor_invalido');
check('🔒 cotação zero é recusada', recusa(10_000, 0n) === 'cotacao_invalida');
check('🔒 cotação inválida vira zero e é recusada',
  cotacaoEmMicro(Number.NaN) === 0n && cotacaoEmMicro(-5) === 0n);
check('🔒 valor que não compra 1 centavo de BRO é recusado', recusa(5, cot) === 'nao_compra_um_centavo');

console.log(`\n${fail === 0 ? '🟢' : '🔴'} ${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);
