/**
 * Self-test do bônus de equiparação.
 *
 * Roda: npm run test:expansao
 */
import { ELEGIBILIDADE_PADRAO, olexpDaCompra, podeEquiparar } from './unidade.js';
import { arvoreVazia, creditar, equipeMenor, inserir, inserirRaiz, volumeDaPerna, type Pernas } from './arvore.js';
import { DEGRAUS, carreiraDe } from './carreira.js';
import { MICRO, bonusContabil, equiparar, fecharCiclo, olefootAPagar, poolDoCiclo } from './equiparacao.js';
import { trancheLiberavel, abaixoDoPiso, PISO_DO_BALDE_BPS } from './equiparacao.js';
import { CARENCIA_TROCA_WALLET_HORAS, auditarCiclo, auditarClaim, type FatosDoClaim } from './auditoria.js';
import { raizInteira, raizInteiraTeto, tetoDiarioDeClaim, impactoEmBps, restanteHoje, IMPACTO_MAX_BPS_PADRAO } from './tetoDeClaim.js';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log(`  ✅ ${n}`); } else { fail++; console.log(`  ❌ ${n} ${d}`); } };
const recusa = (n: string, fn: () => unknown) => { try { fn(); check(n, false, '(não recusou)'); } catch { check(n, true); } };

console.log('\n🌳 árvore binária — Time 1 e Time 2\n');

let a = inserirRaiz(arvoreVazia(), 'raiz');
a = inserir(a, 'a1', 'raiz', 1);
a = inserir(a, 'a2', 'raiz', 2);
check('patrocinador escolhe o lado', a.nos.get('a1')?.lado === 1 && a.nos.get('a2')?.lado === 2);

// Vaga direta ocupada → transborda DENTRO da perna escolhida.
a = inserir(a, 'b1', 'raiz', 1);
check('transborda pra dentro da perna 1', a.nos.get('b1')?.paiId === 'a1');
a = inserir(a, 'b2', 'raiz', 1);
check('e ocupa o outro lado do mesmo nó antes de descer', a.nos.get('b2')?.paiId === 'a1' && a.nos.get('b2')?.lado === 2);
a = inserir(a, 'c1', 'raiz', 1);
check('só então desce um nível (busca em largura)', a.nos.get('c1')?.paiId === 'b1');

check('quem entrou pela perna 1 NUNCA cai na perna 2',
  ['a1', 'b1', 'b2', 'c1'].every((u) => {
    let n = a.nos.get(u);
    while (n?.paiId && n.paiId !== 'raiz') n = a.nos.get(n.paiId);
    return n?.lado === 1;
  }));

recusa('ninguém patrocina a si mesmo', () => inserir(a, 'x', 'x', 1));
recusa('não entra duas vezes', () => inserir(a, 'a1', 'raiz', 2));

console.log('\n📊 volume de perna — sobe, não desce\n');

let p: Pernas = new Map();
p = creditar(a, p, 'c1', 1000n);
check('crédito no fundo soma na perna certa da raiz', volumeDaPerna(p, 'raiz', 1) === 1000n);
check('e não vaza pra outra perna', volumeDaPerna(p, 'raiz', 2) === 0n);
check('e soma em TODO ancestral no caminho',
  volumeDaPerna(p, 'a1', 1) === 1000n && volumeDaPerna(p, 'b1', 1) === 1000n);

// ⭐ A trava contra o atalho mais óbvio do binário.
p = creditar(a, p, 'a2', 500n);
check('a compra da própria pessoa NÃO conta pra perna dela',
  volumeDaPerna(p, 'a2', 1) === 0n && volumeDaPerna(p, 'a2', 2) === 0n);
check('ela conta pro patrocinador', volumeDaPerna(p, 'raiz', 2) === 500n);
check('equipe menor é o MIN dos dois lados', equipeMenor(p, 'raiz') === 500n);

console.log('\n🏆 carreira\n');

check('abaixo de 10k não graduou', carreiraDe(9_999n).atual === null);
check('10k vira CAMPEÃO', carreiraDe(10_000n).atual?.id === 'CAMPEAO');
check('270k é TETRA (o exemplo da spec)', carreiraDe(270_000n).atual?.id === 'TETRA');
check('e a próxima é PENTA, faltando 230k',
  carreiraDe(270_000n).proxima?.id === 'PENTA' && carreiraDe(270_000n).falta === 230_000n);
check('500k é PENTA e não tem próxima',
  carreiraDe(500_000n).atual?.id === 'PENTA' && carreiraDe(500_000n).proxima === null);
check('progresso é 0–100', DEGRAUS.every((d) => { const c = carreiraDe(d.exige); return c.progresso >= 0 && c.progresso <= 100; }));
check('graduação não cai: mais volume nunca rebaixa',
  DEGRAUS.every((d) => (carreiraDe(d.exige + 1n).atual?.exige ?? 0n) >= d.exige));

console.log('\n⚖️ equiparação — consome os dois lados\n');

{
  const r = equiparar({ time1: 10_000n, time2: 5_000n });
  check('equipara o MIN (o exemplo da spec)', r.equiparado === 5_000n);
  check('debita dos DOIS lados', r.sobra.time1 === 5_000n && r.sobra.time2 === 0n);
  check('e diz qual perna zerou', r.pernaZerada === 2);
}
{
  // Carry-over: a sobra da hora anterior equipara na hora seguinte.
  const h14 = equiparar({ time1: 10_000n, time2: 5_000n });
  const h15 = equiparar({ time1: h14.sobra.time1, time2: h14.sobra.time2 + 3_000n });
  check('carry-over: a sobra equipara no ciclo seguinte', h15.equiparado === 3_000n);
  check('e sobram 2.000 do lado maior', h15.sobra.time1 === 2_000n);
}
check('perna zerada não equipara nada', equiparar({ time1: 9_000n, time2: 0n }).equiparado === 0n);

console.log('\n💰 pool e liquidação — o valor não existe antes do pool\n');

check('pool é percentual da receita', poolDoCiclo(100_000_00n, { percentualBps: 2500 }) === 25_000_00n);
check('percentual é configurável, não cravado', poolDoCiclo(100_000_00n, { percentualBps: 1000 }) === 10_000_00n);
recusa('percentual acima de 100% é recusado', () => poolDoCiclo(100n, { percentualBps: 10_001 }));

{
  // O exemplo da spec: pool R$ 10.000, 50.000 OLEXP → R$ 0,20 por OLEXP.
  //
  // ⚠️ A unidade contábil é a MENOR da moeda (centavo), e MICRO são 1e6
  // subdivisões dela. Então R$ 0,20 = 20 centavos = 20 × MICRO micro-centavos.
  // Eu mesmo errei isto na primeira versão do teste, escrevendo como se a
  // unidade fosse o real — por isso a conta está explícita aqui.
  const l = fecharCiclo(10_000_00n, 50_000n);            // pool: 1.000.000 centavos
  check('valor de liquidação sai da divisão', l.status === 'READY' && l.valorPorOlexpMicro === 20n * MICRO);
  check('R$ 0,20 por OLEXP no exemplo da spec', bonusContabil(50_000n, l.valorPorOlexpMicro as bigint) === 10_000_00n);
}
{
  // Outro ciclo, outro valor — é esse o ponto do desenho.
  const a1 = fecharCiclo(10_000_00n, 50_000n).valorPorOlexpMicro as bigint;
  const a2 = fecharCiclo(4_000_00n, 50_000n).valorPorOlexpMicro as bigint;
  check('ciclos diferentes dão valores diferentes', a1 !== a2 && a2 * 5n === a1 * 2n);
}

// ⭐ A trava financeira: hora sem receita não debita ninguém.
{
  const l = fecharCiclo(0n, 5_000n);
  check('ciclo SEM POOL fica retido, não liquida', l.status === 'HELD');
  check('e o valor é INDEFINIDO, não zero', l.valorPorOlexpMicro === null);
  check('com motivo escrito', (l.motivo ?? '').includes('retida'));
}
check('ciclo sem nada a equiparar também fica retido', fecharCiclo(10_000_00n, 0n).status === 'HELD');

{
  // US$ 500 a US$ 0,05 = 10.000 OLEFOOT (o exemplo da spec).
  // US$ 500 = 50.000 centavos · US$ 0,05 = 5 centavos = 5 × MICRO.
  check('bônus contábil vira OLEFOOT ao preço do momento',
    olefootAPagar(500_00n, 5n * MICRO) === 10_000n);
  recusa('preço zero é recusado (divisão por zero disfarçada)', () => olefootAPagar(100n, 0n));
}

console.log('\n🔐 elegibilidade — nem todo OLEXP vira dinheiro\n');

check('compra de OLEFOOT gera equiparação', podeEquiparar('compra_olefoot'));
check('campanha e evento NÃO geram', !podeEquiparar('campanha') && !podeEquiparar('evento'));
check('ajuste manual de admin NUNCA gera, nem se configurarem',
  !podeEquiparar('ajuste_admin', { ...ELEGIBILIDADE_PADRAO, ajuste_admin: { qualificacao: true, equiparacao: true } }));
check('1 OLEFOOT comprada = 1 OLEXP', olexpDaCompra(1_000n) === 1_000n);

console.log('\n🛡️ auditoria do ciclo\n');

const cicloOk = {
  creditadoNoCiclo: 10_000n, debitadoNoCiclo: 5_000n,
  equiparadoSomado: 5_000n, equiparadoDeclarado: 5_000n,
  refsCreditados: ['pix-1', 'pix-2'], creditosSemOrigem: 0, pool: 25_000_00n,
};
check('ciclo íntegro passa', auditarCiclo(cicloOk).liberado);
check('soma que não bate BARRA', !auditarCiclo({ ...cicloOk, equiparadoSomado: 6_000n }).liberado);
check('a mesma compra contada duas vezes BARRA',
  !auditarCiclo({ ...cicloOk, refsCreditados: ['pix-1', 'pix-1'] }).liberado);
check('crédito sem origem BARRA', !auditarCiclo({ ...cicloOk, creditosSemOrigem: 1 }).liberado);
check('débito acima do crédito só AVISA (é carry-over legítimo)',
  auditarCiclo({ ...cicloOk, debitadoNoCiclo: 99_000n }).liberado);

console.log('\n🪣 tranche do balde — a receita é o chão, o degrau é o teto\n');

// Os números exatos do docs/TOKENOMICS.md, com a aritmética escrita porque eu
// já errei esta unidade duas vezes:
//   moeda contábil = CENTAVO de dólar
//   preço de $0,000125/token = 0,0125 centavo = 12.500 MICRO-centavos
//   $31.250 de receita        = 3.125.000 centavos
//   pool 25%                  =   781.250 centavos
//   781.250 ÷ 0,0125          = 62.500.000 tokens  ✓ os 5% do balde
// Balde e tranche aqui estão em TOKEN INTEIRO (mesma unidade dos dois lados).
const BALDE = 1_250_000_000n;                // 1,25B tokens
const PRECO = 12_500n;                       // micro-centavos por token
const base = { baldeTotal: BALDE, degrauBps: 500, percentualBps: 2500, precoMicro: PRECO, jaLiberado: 0n };

{
  const r = trancheLiberavel({ ...base, receitaAcumulada: 3_125_000n });
  check('pré-venda de $31.250: degrau e receita empatam em 62,5M',
    r.tranche === 62_500_000n);
}

// 🔴 O caso real: levantando $10.000, a regra fixa liberaria 3,1x demais.
{
  const r = trancheLiberavel({ ...base, receitaAcumulada: 1_000_000n });
  check('🔴 receita de $10.000 limita a tranche a 20M (não 62,5M)',
    r.tranche === 20_000_000n && r.limitadoPor === 'receita');
  check('   e o degrau fixo seria 3,1x maior',
    (62_500_000n * 10n) / r.tranche === 31n);
}

check('sem receita não libera nada',
  trancheLiberavel({ ...base, receitaAcumulada: 0n }).tranche === 0n);
check('balde quase vazio limita, mesmo com receita de sobra',
  trancheLiberavel({ ...base, receitaAcumulada: 10n ** 12n, jaLiberado: BALDE - 7n }).limitadoPor === 'balde');
check('balde estourado devolve zero, nunca negativo',
  trancheLiberavel({ ...base, receitaAcumulada: 10n ** 12n, jaLiberado: BALDE * 2n }).tranche === 0n);
check('preço zero estoura',
  (() => { try { trancheLiberavel({ ...base, receitaAcumulada: 1n, precoMicro: 0n }); return false; } catch { return true; } })());

// Piso: abaixo dele a liquidação troca de régua e a espiral não acontece.
const tranche = 20_000_000n;
check(`piso de ${PISO_DO_BALDE_BPS / 100}% detecta balde afundado`,
  abaixoDoPiso(tranche / 10n, tranche));
check('balde folgado não está abaixo do piso', !abaixoDoPiso(tranche / 2n, tranche));
check('exatamente no piso não está abaixo',
  !abaixoDoPiso((tranche * BigInt(PISO_DO_BALDE_BPS)) / 10_000n, tranche));

console.log('\n🔐 auditoria do CLAIM — o segundo portão\n');

const claimOk: FatosDoClaim = {
  userId: 'u1', saldoDeclarado: 1_000n, saldoRecomputado: 1_000n,
  walletPedida: 'WALLET_A', walletVinculada: 'WALLET_A', walletVerificada: true,
  horasDesdeTrocaDeWallet: null, contasComAMesmaWallet: 0,
  comprasNaoLiquidadas: 0, refJaPago: false, contaSinalizada: false, origensNasDuasPernas: 0,
  olefootPedido: 1_000n, reservaDaPool: 80_000_000_000_000_000n, olefootJaPagoHoje: 0n,
  impactoMaxBps: IMPACTO_MAX_BPS_PADRAO,
  precoDoCicloMicro: 125n, precoUsadoNoClaimMicro: 125n,
};
check('claim limpo libera', auditarClaim(claimOk).liberado);

check('🔴 wallet diferente da vinculada BARRA (conta invadida)',
  !auditarClaim({ ...claimOk, walletPedida: 'WALLET_DO_ATACANTE' }).liberado);
check('wallet sem prova de posse BARRA', !auditarClaim({ ...claimOk, walletVerificada: false }).liberado);
check('sem wallet nenhuma BARRA', !auditarClaim({ ...claimOk, walletVinculada: null }).liberado);
check(`wallet trocada há menos de ${CARENCIA_TROCA_WALLET_HORAS}h BARRA`,
  !auditarClaim({ ...claimOk, horasDesdeTrocaDeWallet: 2 }).liberado);
check('passada a carência, libera',
  auditarClaim({ ...claimOk, horasDesdeTrocaDeWallet: CARENCIA_TROCA_WALLET_HORAS + 1 }).liberado);
check('🔴 várias contas na mesma wallet BARRA', !auditarClaim({ ...claimOk, contasComAMesmaWallet: 4 }).liberado);
check('🔴 compra ainda estornável BARRA (comprar, sacar, estornar)',
  !auditarClaim({ ...claimOk, comprasNaoLiquidadas: 1 }).liberado);
check('🔴 saldo que não bate com o ledger BARRA',
  !auditarClaim({ ...claimOk, saldoDeclarado: 9_999n }).liberado);
check('🔴 ref já pago BARRA (retry não paga duas vezes)',
  !auditarClaim({ ...claimOk, refJaPago: true }).liberado);
check('conta sinalizada BARRA', !auditarClaim({ ...claimOk, contaSinalizada: true }).liberado);
check('saldo zero BARRA', !auditarClaim({ ...claimOk, saldoDeclarado: 0n, saldoRecomputado: 0n }).liberado);
check('mesma origem nas duas pernas AVISA, não barra (casal, sócio)',
  auditarClaim({ ...claimOk, origensNasDuasPernas: 2 }).liberado
  && auditarClaim({ ...claimOk, origensNasDuasPernas: 2 }).achados.length === 1);

console.log('\n📉 teto diário de claim — a pool não afunda num dia\n');

// Raiz inteira: sem isso a fórmula do teto precisaria de float.
check('raiz inteira exata em quadrado perfeito', raizInteira(144n) === 12n);
check('raiz inteira trunca pra baixo', raizInteira(143n) === 11n);
check('raiz de 0 e 1', raizInteira(0n) === 0n && raizInteira(1n) === 1n);
check('raiz de negativo estoura', (() => { try { raizInteira(-1n); return false; } catch { return true; } })());
check('raiz inteira aguenta número grande',
  raizInteira(10n ** 40n) === 10n ** 20n);
check('raiz por cima arredonda pra cima', raizInteiraTeto(143n) === 12n);
check('raiz por cima não mexe em quadrado perfeito', raizInteiraTeto(144n) === 12n);

// A conta de referência do docs/TOKENOMICS.md: pool de 80M tokens (9 casas),
// teto de 1% => ~403.025 tokens/dia. Confere a ordem de grandeza e o sinal.
const POOL_80M = 80_000_000_000_000_000n; // 80M tokens com 9 decimais
const teto1pct = tetoDiarioDeClaim(POOL_80M, 100);
check('teto de 1% na pool de 80M bate com a planilha (~403.025 tokens)',
  teto1pct / 1_000_000_000n === 403_025n);
check('teto maior libera mais', tetoDiarioDeClaim(POOL_80M, 200) > teto1pct);
check('pool mais profunda libera mais', tetoDiarioDeClaim(POOL_80M * 2n, 100) > teto1pct);
check('teto é linear na reserva',
  tetoDiarioDeClaim(POOL_80M * 2n, 100) === teto1pct * 2n);

// 🔴 O padrão seguro: sem pool, não sai nada.
check('🔴 reserva zero devolve teto zero', tetoDiarioDeClaim(0n, 100) === 0n);
check('reserva negativa estoura',
  (() => { try { tetoDiarioDeClaim(-1n, 100); return false; } catch { return true; } })());
check('bps fora de faixa estoura', (() => {
  for (const b of [0, 10_000, 10_001, -1, 1.5]) {
    try { tetoDiarioDeClaim(POOL_80M, b); return false; } catch { /* esperado */ }
  }
  return true;
})());

// O teto tem que ser CONSERVADOR: o impacto real do teto não pode passar do
// alvo. Se truncasse pra cima, cada dia estouraria um pouco a régua.
for (const bps of [50, 100, 200, 500, 1000]) {
  const v = tetoDiarioDeClaim(POOL_80M, bps);
  check(`teto de ${bps}bps não estoura o próprio alvo (real ${impactoEmBps(POOL_80M, v)}bps)`,
    impactoEmBps(POOL_80M, v) <= bps);
}

check('restanteHoje desconta o que já saiu',
  restanteHoje({ reservaPool: POOL_80M, impactoMaxBps: 100, jaPagoHoje: teto1pct / 2n }) === teto1pct - teto1pct / 2n);
check('restanteHoje nunca fica negativo',
  restanteHoje({ reservaPool: POOL_80M, impactoMaxBps: 100, jaPagoHoje: teto1pct * 3n }) === 0n);

// As regras no portão do claim.
check('🔴 claim acima do teto do dia BARRA',
  !auditarClaim({ ...claimOk, olefootPedido: teto1pct + 1n }).liberado);
check('claim no limite exato do teto passa',
  auditarClaim({ ...claimOk, olefootPedido: teto1pct }).liberado);
// 🐞 a primeira versão deste teste usava teto/2 + 1 e quebrava quando o teto
// era ímpar (a divisão inteira comia o +1). O certo é perguntar ao próprio
// restanteHoje quanto cabe e pedir um a mais.
{
  const jaPago = teto1pct / 3n;
  const cabe = restanteHoje({ reservaPool: POOL_80M, impactoMaxBps: 100, jaPagoHoje: jaPago });
  check('🔴 teto considera o que já foi pago hoje',
    !auditarClaim({ ...claimOk, olefootPedido: cabe + 1n, olefootJaPagoHoje: jaPago }).liberado);
  check('e libera exatamente o que ainda cabe',
    auditarClaim({ ...claimOk, olefootPedido: cabe, olefootJaPagoHoje: jaPago }).liberado);
}
check('🔴 pool desconhecida RETÉM o claim (padrão seguro)',
  !auditarClaim({ ...claimOk, reservaDaPool: 0n }).liberado);
check('pedido negativo BARRA', !auditarClaim({ ...claimOk, olefootPedido: -1n }).liberado);

// A conversão é pelo preço do CICLO, não pelo preço do momento do claim.
check('🔴 conversão num preço diferente do ciclo BARRA (sentar no claim esperando dip)',
  !auditarClaim({ ...claimOk, precoUsadoNoClaimMicro: 60n }).liberado);
check('🔴 claim sem o preço do ciclo BARRA (não conferível)',
  !auditarClaim({ ...claimOk, precoDoCicloMicro: null }).liberado);
check('preço igual ao do ciclo passa',
  auditarClaim({ ...claimOk, precoDoCicloMicro: 999n, precoUsadoNoClaimMicro: 999n }).liberado);

console.log(`\n${fail === 0 ? '🟢' : '🔴'} ${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);
