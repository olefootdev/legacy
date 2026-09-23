/**
 * Self-test do livro do Vault e do rateio da colheita (A VIRADA · V1).
 *
 * Guarda duas portas por onde dinheiro de terceiro some:
 *   1. o arredondamento das cotas — se ele cair a favor de quem mexe em vez de
 *      quem fica, dá pra raspar a pool depositando e sacando em looping;
 *   2. a fatia sem dono — com a árvore de indicação de hoje (profundidade 1),
 *      15% a 25% de cada colheita não tem endereço, e o jeito silencioso de
 *      "resolver" isso é deixar cair na casa.
 *
 * Roda: npm run test:vault-book
 */
import {
  LIVRO_VAZIO,
  MICRO_POR_COTA,
  depositar,
  marcar,
  navPorCota,
  reinvestir,
  resgatar,
  type Livro,
} from './vaultBook.js';
import {
  BPS_TOTAL,
  FATIAS,
  POLITICA_VAGA_PADRAO,
  ratear,
  type Rede,
} from './harvestSplit.js';

let pass = 0;
let fail = 0;
function check(nome: string, cond: boolean, detalhe = ''): void {
  if (cond) { pass++; console.log(`  ✅ ${nome}`); }
  else { fail++; console.log(`  ❌ ${nome} ${detalhe}`); }
}
function recusa(nome: string, fn: () => unknown): void {
  try { fn(); check(nome, false, '(não recusou)'); }
  catch { check(nome, true); }
}

const SOL = 1_000_000_000n; // 1 SOL em lamports

console.log('\n📒 vaultBook — a cota não pode vazar\n');

// 1 — a primeira cota nasce ao par, como no selftest da casa.
{
  const { livro, cotasEmitidas } = depositar(LIVRO_VAZIO, 250n * SOL);
  check('1º depósito: NAV = 1', cotasEmitidas === 250n * SOL * MICRO_POR_COTA && navPorCota(livro) === 1n);
}

// 2 e 3 — valorizar sobe o NAV sem emitir cota, e é de quem já estava dentro.
{
  const a = depositar(LIVRO_VAZIO, 100n * SOL);
  const valorizado = marcar(a.livro, 120n * SOL);
  check('marcar a mercado não emite cota', valorizado.cotasEmitidas === a.livro.cotasEmitidas);
  const saida = resgatar(valorizado, a.cotasEmitidas);
  check('quem estava dentro leva a valorização', saida.unidadesPagas === 120n * SOL);
}

// 4 — quem entra depois NÃO leva a valorização passada.
{
  const a = depositar(LIVRO_VAZIO, 100n * SOL);
  const valorizado = marcar(a.livro, 200n * SOL); // NAV dobrou
  const b = depositar(valorizado, 100n * SOL);
  check('entrar depois não dilui quem já estava', b.cotasEmitidas === a.cotasEmitidas / 2n);
  const saidaB = resgatar(b.livro, b.cotasEmitidas);
  check('quem entrou depois tira o que pôs', saidaB.unidadesPagas === 100n * SOL);
}

// 5 — a porta principal: ida e volta imediata nunca devolve mais do que entrou.
{
  let pior = 0n;
  for (const entrada of [1n, 7n, 999n, 12_345n, 3n * SOL + 7n]) {
    for (const patrimonio of [1n * SOL + 1n, 77n * SOL + 13n, 1_000n * SOL - 1n]) {
      const base = marcar(depositar(LIVRO_VAZIO, 500n * SOL).livro, patrimonio);
      const dep = depositar(base, entrada);
      const volta = resgatar(dep.livro, dep.cotasEmitidas);
      const lucro = volta.unidadesPagas - entrada;
      if (lucro > pior) pior = lucro;
    }
  }
  check('ida e volta imediata nunca lucra (anti-raspagem)', pior <= 0n, `melhor caso do atacante: ${pior}`);
}

// 6 — e o looping também não.
{
  const base = marcar(depositar(LIVRO_VAZIO, 500n * SOL).livro, 731n * SOL + 17n);
  let livro: Livro = base;
  let carteira = 10n * SOL;
  for (let i = 0; i < 500; i++) {
    const d = depositar(livro, carteira);
    carteira = 0n;
    const r = resgatar(d.livro, d.cotasEmitidas);
    livro = r.livro;
    carteira = r.unidadesPagas;
  }
  check('500 voltas não criam unidade', carteira <= 10n * SOL, `saiu com ${carteira} de 10 SOL`);
  check('e o que sobrou ficou com a pool', livro.patrimonio >= base.patrimonio);
}

// 7 — reinvestir sobe patrimônio sem emitir cota (é o destino da fatia sem dono).
{
  const a = depositar(LIVRO_VAZIO, 100n * SOL);
  const depois = reinvestir(a.livro, 5n * SOL);
  check('reinvestir sobe o NAV de todos', depois.cotasEmitidas === a.livro.cotasEmitidas && depois.patrimonio === 105n * SOL);
  check('e o cotista único colhe tudo', resgatar(depois, a.cotasEmitidas).unidadesPagas === 105n * SOL);
}

// 8 a 10 — recusas.
recusa('resgate acima do emitido é recusado', () => resgatar(depositar(LIVRO_VAZIO, SOL).livro, 999n * SOL * MICRO_POR_COTA));
recusa('depósito negativo é recusado', () => depositar(LIVRO_VAZIO, -1n));
recusa('livro com cota e patrimônio zero é recusado', () => depositar({ cotasEmitidas: 10n, patrimonio: 0n }, SOL));

console.log('\n🧮 harvestSplit — fatia sem dono é decisão, não sobra\n');

const CASA = 'tesouraria-olefoot';
const EU = 'manager-eu';
const redeCompleta: Rede = { depositante: EU, casa: CASA, ancestrais: ['n1', 'n2', 'n3', 'n4'] };
const redeDeHoje: Rede = { depositante: EU, casa: CASA, ancestrais: ['n1'] };          // 11 dos 78
const redeSemRede: Rede = { depositante: EU, casa: CASA, ancestrais: [] };             // 67 dos 78

check('as fatias somam 100%', FATIAS.reduce((s, f) => s + f.bps, 0) === BPS_TOTAL);

// 11 — rede completa fecha exato e paga cada papel.
{
  const r = ratear(100n * SOL, redeCompleta);
  const soma = r.pagamentos.reduce((s, p) => s + p.unidades, 0n) + r.reinvestido;
  check('rede completa: soma bate na unidade', soma === 100n * SOL);
  check('rede completa: ninguém fica vago', r.vagas.length === 0 && r.reinvestido === 0n);
  const eu = r.pagamentos.find((p) => p.papel === 'depositante');
  check('depositante leva 50%', eu?.unidades === 50n * SOL);
}

// 12 — números feios também fecham.
{
  for (const colheita of [0n, 1n, 3n, 7n, 9_999n, 1_000_000_007n, 123_456_789_013n]) {
    const r = ratear(colheita, redeCompleta);
    const soma = r.pagamentos.reduce((s, p) => s + p.unidades, 0n) + r.reinvestido;
    if (soma !== colheita) { check(`colheita ${colheita} fecha`, false, `somou ${soma}`); break; }
  }
  check('colheitas indivisíveis fecham na unidade (0, 1, 3, 7, 9999, primos)', true);
}

// 13 — a árvore de HOJE: manager, capitão e pro ficam vagos.
{
  const r = ratear(100n * SOL, redeDeHoje);
  const vagos = r.vagas.map((v) => v.fatia).sort().join(',');
  check('árvore de hoje (profundidade 1) deixa manager, captain e pro vagos', vagos === 'captain,manager,pro', vagos);
  check('e isso são 15% reinvestidos', r.reinvestido === 15n * SOL);
  check('as vagas aparecem no extrato com valor', r.vagas.every((v) => v.unidades > 0n && v.motivo.length > 0));
}

// 14 — sem nenhum indicador (o caso de 67 dos 78 managers).
{
  const r = ratear(100n * SOL, redeSemRede);
  check('sem indicador nenhum: 25% sem dono (myclub + manager + captain + pro)', r.reinvestido === 25n * SOL);
}

// 15 — A TRAVA: a casa nunca cresce por omissão.
{
  const casaEm = (rede: Rede) =>
    ratear(100n * SOL, rede, POLITICA_VAGA_PADRAO).pagamentos.find((p) => p.papel === 'casa')?.unidades;
  check('casa leva 25% com rede cheia', casaEm(redeCompleta) === 25n * SOL);
  check('casa leva 25% com rede de hoje', casaEm(redeDeHoje) === 25n * SOL);
  check('casa leva 25% sem rede nenhuma', casaEm(redeSemRede) === 25n * SOL);
}

// 16 — a política 'depositante' devolve pra quem depositou, não pra casa.
{
  const r = ratear(100n * SOL, redeSemRede, 'depositante');
  const eu = r.pagamentos.find((p) => p.papel === 'depositante');
  const casa = r.pagamentos.find((p) => p.papel === 'casa');
  check("política 'depositante': você leva 75%", eu?.unidades === 75n * SOL);
  check("política 'depositante': casa continua em 25%", casa?.unidades === 25n * SOL);
  check("política 'depositante': nada fica reinvestido", r.reinvestido === 0n);
}

// 17 — a política 'casa' é possível, mas fica registrada linha a linha.
{
  const r = ratear(100n * SOL, redeSemRede, 'casa');
  const casa = r.pagamentos.find((p) => p.papel === 'casa');
  check("política 'casa': casa leva 50%", casa?.unidades === 50n * SOL);
  check("política 'casa': as 4 vagas continuam visíveis no extrato", r.vagas.length === 4);
}

// 18 — o Pro é o 4º nível: resolve sozinho pela árvore, e some quando não há.
{
  const comQuatro = ratear(100n * SOL, redeCompleta).pagamentos.find((p) => p.fatia === 'pro');
  check('Pro paga o 4º ancestral quando existe', comQuatro?.destino === 'n4' && comQuatro.unidades === 5n * SOL);

  const soTres = ratear(100n * SOL, { depositante: EU, casa: CASA, ancestrais: ['n1', 'n2', 'n3'] });
  const vaga = soTres.vagas.find((v) => v.fatia === 'pro');
  check('sem 4º ancestral, Pro vira vaga nomeada', vaga?.motivo === 'sem ancestral de nível 4');
  check('e a casa continua em 25% mesmo assim', soTres.pagamentos.find((p) => p.papel === 'casa')?.unidades === 25n * SOL);
}

// 19 — recusas do rateio.
recusa('rateio sem depositante é recusado', () => ratear(SOL, { ...redeCompleta, depositante: '' }));
recusa('rateio sem tesouraria é recusado', () => ratear(SOL, { ...redeCompleta, casa: '' }));
recusa('colheita negativa é recusada', () => ratear(-1n, redeCompleta));

console.log(`\n${fail === 0 ? '🟢' : '🔴'} ${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);
