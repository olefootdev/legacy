/**
 * Self-test da trava da pré-venda. `npm run test:presale-travas`
 *
 * Prova: que a fórmula do fundador vale no preço de lançamento, que ela NÃO
 * vira arbitragem se o preço subir, que o teto de 85% segura, e que os 15%
 * finais dependem do tempo mesmo pra quem esgotou a porta de compra.
 */
import {
  TETO_LIBERACAO_POR_COMPRA_BPS, NO_LANCAMENTO_BPS, CARENCIA_DIAS, LINEAR_DIAS,
  tetoPorCompra, liberarPorCompra, fracaoPorTempoBps, liberadoPorTempoEm,
  disponivel, diasPara100, emTokens, type Posicao,
} from './travas.js';
import { UNIDADE } from './packs.js';

let pass = 0, fail = 0;
const check = (n: string, ok: boolean) => {
  if (ok) { pass++; console.log(`  ✅ ${n}`); } else { fail++; console.log(`  ❌ ${n}`); }
};
const br = (n: bigint | number) => n.toLocaleString('pt-BR');

// A posição do exemplo do fundador: $1.000 na pré-venda = 8.000.000 tokens.
const base: Posicao = {
  compraOriginalUsdCents: 100_000,
  tokensTotais: 8_000_000n * UNIDADE,
  liberadoPorCompra: 0n, liberadoPorTempo: 0n, sacado: 0n,
};

console.log('\n🔒 trava da pré-venda — o exemplo do fundador, ao pé da letra\n');

check(`teto da porta de compra é ${TETO_LIBERACAO_POR_COMPRA_BPS / 100}%`,
  TETO_LIBERACAO_POR_COMPRA_BPS === 8_500);
check('85% de 8.000.000 = 6.800.000', emTokens(tetoPorCompra(base)) === 6_800_000n);

// $250 sobre $1.000 = 25%. No preço de lançamento $250 compra 2.000.000.
{
  const r = liberarPorCompra(base, 25_000, 2_000_000n * UNIDADE);
  check('🔑 "comprou $1.000, compra $250, libera 25%" → 2.000.000',
    emTokens(r.libera) === 2_000_000n);
  check('   e as duas portas empatam no preço de lançamento (m = 1 exato)',
    r.limitadoPor === 'razao_usd');
}

console.log('\n🐞 o furo da razão de dólar, e a trava que o fecha\n');

// Preço DOBROU: $250 agora compra só 1.000.000. A razão de dólar continuaria
// liberando 2.000.000 — pagar $250 e soltar $500. Arbitragem.
{
  const r = liberarPorCompra(base, 25_000, 1_000_000n * UNIDADE);
  check('🔴 preço dobrado: paridade em token segura em 1.000.000 (não 2.000.000)',
    emTokens(r.libera) === 1_000_000n && r.limitadoPor === 'paridade_token');
}
// Preço CAIU pela metade: $250 compra 4.000.000. Agora a razão de dólar é que
// segura — senão $250 soltaria metade da posição.
{
  const r = liberarPorCompra(base, 25_000, 4_000_000n * UNIDADE);
  check('🔴 preço pela metade: razão de dólar segura em 2.000.000 (não 4.000.000)',
    emTokens(r.libera) === 2_000_000n && r.limitadoPor === 'razao_usd');
}
check('a liberação é sempre o MENOR dos dois, nos dois sentidos',
  emTokens(liberarPorCompra(base, 25_000, 1_000_000n * UNIDADE).libera) === 1_000_000n
  && emTokens(liberarPorCompra(base, 25_000, 9_000_000n * UNIDADE).libera) === 2_000_000n);

// A compra que destrava não precisa ser de TOKEN: card, lenda e pack do jogo
// também são entrada nova. A régua é a mesma — o que aquele dinheiro VALERIA em
// token no preço atual — então produto não abre brecha que token não abre.
{
  const r = liberarPorCompra(base, 25_000, 2_000_000n * UNIDADE);
  check('🔑 compra de PRODUTO ($250 em card) libera igual a $250 em token',
    emTokens(r.libera) === 2_000_000n);
  const caro = liberarPorCompra(base, 25_000, 1_000_000n * UNIDADE);
  check('   e com o preço dobrado ela também é segurada pela paridade',
    emTokens(caro.libera) === 1_000_000n);
}

console.log('\n🚧 o teto de 85%\n');

// Quem já destravou 80% só consegue mais 5%, mesmo comprando o dobro.
{
  const p: Posicao = { ...base, liberadoPorCompra: 6_400_000n * UNIDADE }; // 80%
  const r = liberarPorCompra(p, 100_000, 8_000_000n * UNIDADE);
  check('🔴 quem está em 80% só destrava mais 5%, mesmo comprando $1.000',
    emTokens(r.libera) === 400_000n && r.limitadoPor === 'teto_85');
}
{
  const p: Posicao = { ...base, liberadoPorCompra: tetoPorCompra(base) };
  const r = liberarPorCompra(p, 100_000, 8_000_000n * UNIDADE);
  check('🔴 no teto, comprar mais não libera NADA por essa porta', r.libera === 0n);
}
check('compra nova zero ou negativa estoura',
  (() => { try { liberarPorCompra(base, 0, 1n); return false; } catch { return true; } })());

console.log('\n⏳ a porta do tempo — e os 15% que só ela abre\n');

check(`no lançamento libera ${NO_LANCAMENTO_BPS / 100}%`, fracaoPorTempoBps(0) === 1_000);
check('durante a carência não anda', fracaoPorTempoBps(CARENCIA_DIAS - 1) === 1_000);
check('no fim do cronograma dá 100%',
  fracaoPorTempoBps(CARENCIA_DIAS + LINEAR_DIAS) === 10_000);
check('e não passa de 100% depois disso',
  fracaoPorTempoBps(CARENCIA_DIAS + LINEAR_DIAS + 999) === 10_000);
check('é monotônico (nunca volta atrás)', (() => {
  let ant = -1;
  for (let d = 0; d <= 400; d++) { const v = fracaoPorTempoBps(d); if (v < ant) return false; ant = v; }
  return true;
})());
check('dias negativo estoura',
  (() => { try { fracaoPorTempoBps(-1); return false; } catch { return true; } })());

// 🔑 A consequência do 85%: quem esgota a porta de compra fica em 85% na hora,
// e os 15% finais esperam o tempo.
{
  const p: Posicao = { ...base, liberadoPorCompra: tetoPorCompra(base) };
  check('🔑 no teto de compra, disponível no dia 0 é 85% + 10% do tempo = 95%',
    emTokens(disponivel(p, 0)) === 7_600_000n);
  const d = diasPara100(p);
  check(`🔑 e chega a 100% no dia ${d} — os 15% finais dependem do tempo`,
    d > 0 && emTokens(disponivel(p, d)) === 8_000_000n);
  check('antes desse dia ainda não está 100%',
    emTokens(disponivel(p, d - 1)) < 8_000_000n);
}
// Sem compra nenhuma, só o tempo.
check('sem comprar nada, no dia 0 só os 10% do lançamento',
  emTokens(disponivel(base, 0)) === 800_000n);
check('sem comprar nada, no fim do cronograma fica 100%',
  emTokens(disponivel(base, CARENCIA_DIAS + LINEAR_DIAS)) === 8_000_000n);

// As duas portas somam, com teto na posição — nunca libera mais que 100%.
{
  const p: Posicao = { ...base, liberadoPorCompra: tetoPorCompra(base) };
  check('🔴 as duas portas somadas NUNCA passam de 100% da posição',
    disponivel(p, 9_999) === p.tokensTotais);
}
check('o que já foi sacado não conta de novo',
  disponivel({ ...base, sacado: 800_000n * UNIDADE }, 0) === 0n);
check('posição inconsistente estoura em vez de liberar errado',
  (() => { try { disponivel({ ...base, liberadoPorCompra: 9_000_000n * UNIDADE }, 0); return false; } catch { return true; } })());

console.log(`\n${fail === 0 ? '🟢' : '🔴'} ${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);
