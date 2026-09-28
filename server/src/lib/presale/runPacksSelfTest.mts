/**
 * Self-test dos packs da pré-venda. `npm run test:presale-packs`
 *
 * O que este arquivo existe pra provar: que a conversão dólar → OLEFOOT → real
 * fecha na unidade, que a taxa de 5% aparece nos dois números, e que nada aqui
 * aceita valor vindo do cliente sem conferir.
 */
import {
  PACKS_USD_CENTS, TOKENS_POR_CENTAVO_USD, ALOCACAO_PRESALE, MINIMO_USD_CENTS,
  UNIDADE, orcar, usdCentsDeBrlCents, metaDaPresaleUsdCents, custoBrutoDaPresale,
  type Cotacao, type Limites,
} from './packs.js';

let pass = 0, fail = 0;
const check = (nome: string, ok: boolean) => {
  if (ok) { pass++; console.log(`  ✅ ${nome}`); }
  else { fail++; console.log(`  ❌ ${nome}`); }
};
const br = (n: bigint | number) => n.toLocaleString('pt-BR');

console.log('\n💵 packs da pré-venda — dólar → OLEFOOT → real\n');

const cot: Cotacao = { brlPorUsdMicro: 5_420_000n, lidaEm: '2026-09-28T12:00:00Z' };
const livre: Limites = { tetoPorContaUsdCents: null, jaCompradoUsdCents: 0, restamTokens: ALOCACAO_PRESALE };

// A propriedade que faz a conversão ser exata em vez de aproximada.
check('a $0,000125 cada centavo de dólar compra exatamente 80 tokens',
  TOKENS_POR_CENTAVO_USD === 80n);
check('a alocação inteira vale exatamente $31.250',
  metaDaPresaleUsdCents() === 3_125_000);

console.log('\n  pack      →   RECEBE (anunciado)   tesouraria debita          Pix');
for (const p of PACKS_USD_CENTS) {
  const r = orcar(p, cot, livre);
  if (!r.ok) { check(`pack $${p / 100} orça`, false); continue; }
  const o = r.orcamento;
  console.log(`  $${String(p / 100).padStart(6)}  →  ${br(o.tokensEntregues).padStart(18)}  ${br(o.brutoNaMenorUnidade / UNIDADE).padStart(17)}  R$ ${br(Number(o.brlCents) / 100).padStart(10)}`);
}

// Os cinco packs, conferidos um por um contra a conta na mão.
// O anunciado é o ENTREGUE. O bruto é 5,26% maior e sai de Liquidez.
const esperado: Array<[number, bigint, bigint]> = [
  //  usdCents, tokens ENTREGUES (o anunciado), brlCents a 5,42
  [1_000, 80_000n, 5_420n],
  [5_000, 400_000n, 27_100n],
  [25_000, 2_000_000n, 135_500n],
  [50_000, 4_000_000n, 271_000n],
  [125_000, 10_000_000n, 677_500n],
];
for (const [cents, tok, brl] of esperado) {
  const r = orcar(cents, cot, livre);
  const o = r.ok ? r.orcamento : null;
  check(`$${cents / 100}: entrega ${br(tok)} (o anunciado), cobra R$${Number(brl) / 100}`,
    !!o && o.tokensEntregues === tok
      && o.liquidoNaMenorUnidade === tok * UNIDADE
      && o.brlCents === brl);
}

// 🔴 A taxa de 5% tem que aparecer, e fechar.
{
  const o = (orcar(1_000, cot, livre) as { ok: true; orcamento: any }).orcamento;
  check('🔴 bruto = líquido + taxa (a conta fecha na menor unidade)',
    o.brutoNaMenorUnidade === o.liquidoNaMenorUnidade + o.taxaNaMenorUnidade);
  check('✅ quem compra $10 RECEBE 80.000 — o anunciado é o entregue',
    o.liquidoNaMenorUnidade / UNIDADE === 80_000n);
  // Valor exato em lamports, não arredondado: 80.000 líquidos exigem
  // 84.210,526316 tokens de bruto, e a taxa retida é 4.210,526316.
  check('✅ e a tesouraria debita exatamente 84.210,526315790 tokens',
    o.brutoNaMenorUnidade === 84_210_526_315_790n);
  check('   com taxa de 4.210,526315790 — e o net bate em 80.000 redondos',
    o.taxaNaMenorUnidade === 4_210_526_315_790n
    && o.brutoNaMenorUnidade - o.taxaNaMenorUnidade === 80_000n * UNIDADE);
  check('🔴 preço efetivo = $0,000125 EXATO (o anunciado é o verdadeiro)',
    o.precoEfetivoMicroCents === 12_500n);
  check('a taxa é sempre ~5,26% do líquido, coberta pela casa',
    (o.brutoNaMenorUnidade * 10_000n) / o.liquidoNaMenorUnidade === 10_526n);
}

// O preço efetivo tem que ser 12.500 em TODOS os packs, não só no de $10.
check('🔴 preço efetivo é $0,000125 em todos os 5 packs',
  PACKS_USD_CENTS.every((p) => {
    const r = orcar(p, cot, livre);
    return r.ok && r.orcamento.precoEfetivoMicroCents === 12_500n;
  }));

// O custo da decisão, para o documento e para o balde de Liquidez.
{
  const c = custoBrutoDaPresale();
  check('a pré-venda inteira entrega 250.000.000', c.entregue === 250_000_000n * UNIDADE);
  check('e custa exatamente 263.157.894.736.842.106 lamports à tesouraria',
    c.bruto === 263_157_894_736_842_106n);
  check('🔑 Liquidez cobre 13.157.894.736.842.106 = 0,263% do supply',
    c.cobertoPelaCasa === 13_157_894_736_842_106n
    && (c.cobertoPelaCasa * 100_000n) / (5_000_000_000n * UNIDADE) === 263n);
}

console.log('\n🧮 arredondamento — cada direção é decisão\n');

// 1001 centavos x 5,423456 = 5.428,879456 centavos -> teto 5.429.
// (eu errei esta conta na primeira vez e o teste pegou; fica escrita.)
check('reais arredondam pra CIMA no centavo (a casa nunca cobra menos)',
  (orcar(1_001, { brlPorUsdMicro: 5_423_456n, lidaEm: 'x' }, livre) as any).orcamento.brlCents === 5_429n);
check('e uma fração acima do centavo já sobe o centavo inteiro',
  (orcar(1_000, { brlPorUsdMicro: 5_420_001n, lidaEm: 'x' }, livre) as any).orcamento.brlCents === 5_421n);
check('cotação a 1,00 devolve o mesmo número de centavos',
  (orcar(1_000, { brlPorUsdMicro: 1_000_000n, lidaEm: 'x' }, livre) as any).orcamento.brlCents === 1_000n);

// "Outro" digitado em reais — o caminho brasileiro.
check('R$54,20 a 5,42 volta como $10,00',
  usdCentsDeBrlCents(5_420n, cot) === 1_000);
check('fração de centavo de dólar fica de fora, nunca cobrada a mais',
  usdCentsDeBrlCents(5_425n, cot) === 1_000);
check('cotação zero estoura em vez de dividir por zero',
  (() => { try { usdCentsDeBrlCents(100n, { brlPorUsdMicro: 0n, lidaEm: 'x' }); return false; } catch { return true; } })());

console.log('\n🚧 recusas — nada entra sem conferir\n');

check(`abaixo de $${MINIMO_USD_CENTS / 100} recusa`,
  (orcar(999, cot, livre) as any).motivo === 'abaixo_do_minimo');
check('valor não inteiro recusa (centavo fracionado vindo do cliente)',
  (orcar(1_000.5, cot, livre) as any).motivo === 'nao_inteiro');
check('cotação inválida recusa em vez de cobrar errado',
  (orcar(1_000, { brlPorUsdMicro: 0n, lidaEm: 'x' }, livre) as any).motivo === 'cotacao_invalida');
check('🔴 teto por conta barra quem soma além do limite',
  (orcar(50_000, cot, { tetoPorContaUsdCents: 125_000, jaCompradoUsdCents: 100_000, restamTokens: ALOCACAO_PRESALE }) as any)
    .motivo === 'acima_do_teto_por_conta');
check('dentro do teto passa',
  orcar(25_000, cot, { tetoPorContaUsdCents: 125_000, jaCompradoUsdCents: 100_000, restamTokens: ALOCACAO_PRESALE }).ok);
check('🔴 alocação insuficiente recusa (não vende token que não existe)',
  (orcar(125_000, cot, { ...livre, restamTokens: 1_000n }) as any).motivo === 'alocacao_insuficiente');
check('comprar exatamente o que resta passa',
  orcar(1_000, cot, { ...livre, restamTokens: 80_000n }).ok);

// A soma de todos os packs não pode estourar a alocação por erro de unidade.
{
  const total = PACKS_USD_CENTS.reduce((s, p) => s + BigInt(p) * TOKENS_POR_CENTAVO_USD, 0n);
  check(`os 5 packs somados são ${br(total)} tokens, cabem na alocação`,
    total < ALOCACAO_PRESALE);
  check('o maior pack é 4% da pré-venda (25 compradores esgotam)',
    (125_000n * TOKENS_POR_CENTAVO_USD * 100n) / ALOCACAO_PRESALE === 4n);
}

console.log(`\n${fail === 0 ? '🟢' : '🔴'} ${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);
