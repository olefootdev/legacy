/**
 * Self-test das regras de earning. `npm run test:earnings`
 *
 * O que este arquivo existe pra provar: que o que a tela vai ler fecha em 100%,
 * é o MESMO split que o rateio usa pra pagar, e que nada ali se apresenta como
 * rendimento realizado.
 */
import { FATIAS, ratear } from './harvestSplit.js';
import { regrasDeEarnings, splitPublicado, STAKE_PRAZOS, VAULT_POLITICA } from './earningsRegras.js';

let pass = 0, fail = 0;
const check = (nome: string, ok: boolean) => {
  if (ok) { pass++; console.log(`  ✅ ${nome}`); }
  else { fail++; console.log(`  ❌ ${nome}`); }
};

console.log('\n🌾 earnings — o que a carteira lê do servidor\n');

const r = regrasDeEarnings();

// ── produção ────────────────────────────────────────────────────────────────
check('🔑 o split publicado soma 100%', r.producao.fatias.reduce((s, f) => s + f.bps, 0) === 10_000);
check('e declara o total que soma', r.producao.totalBps === 10_000);
check('🔑 é o MESMO split do rateio, fatia por fatia',
  splitPublicado().length === FATIAS.length
  && splitPublicado().every((f, i) => f.id === FATIAS[i]!.id && f.bps === FATIAS[i]!.bps));
check('quem depositou fica com 50% e a casa com 25%',
  r.producao.fatias.find((f) => f.id === 'voce')?.bps === 5_000
  && r.producao.fatias.find((f) => f.id === 'olefoot')?.bps === 2_500);
check('fatia sem dono é reinvestida, não vai pra casa', r.producao.fatiaSemDono === 'reinvestir');

// O publicado tem que pagar o que promete: rateia 1.000.000 e confere.
{
  const rat = ratear(1_000_000n, {
    depositante: 'dep', casa: 'casa', ancestrais: ['n1', 'n2', 'n3', 'n4'],
  });
  const pago = (id: string) => rat.pagamentos.find((p) => p.fatia === id)?.unidades ?? 0n;
  check('🔒 o rateio paga exatamente o percentual publicado',
    r.producao.fatias.every((f) => pago(f.id) === (1_000_000n * BigInt(f.bps)) / 10_000n));
}

// ── vault ───────────────────────────────────────────────────────────────────
check('o vault publica UM fundo, com slug', r.vault.slug === 'wsol-usdc' && r.vault.par === 'WSOL / USDC');
check('faixa cheia, saída humana', r.vault.faixa === 'cheia' && r.vault.saida === 'humana');
check('canário K1 com piso de 25% ao ano', r.vault.canario.pisoAprBps === 2_500);
check('🔴 resultado realizado é NULL, não zero — o fundo nunca operou',
  VAULT_POLITICA.resultadoRealizado === null);
check('o backtest mostra a queda junto do ganho',
  r.vault.backtest.piorQuedaPct < 0 && r.vault.backtest.retornoAoAnoPct.ate > 0);
check('e a comparação com segurar SOL traz a queda dela também',
  r.vault.backtest.segurandoSol.piorQuedaPct < r.vault.backtest.piorQuedaPct);

// ── stake ───────────────────────────────────────────────────────────────────
check('🔴 o stake está FECHADO até o token existir', r.stake.aberto === false);
check('travado é travado: sem saída antecipada', r.stake.saidaAntecipada === false);
check('quatro prazos: 30, 90, 180 e 360 dias',
  STAKE_PRAZOS.map((p) => p.dias).join(',') === '30,90,180,360');
check('prazo maior nunca multiplica menos',
  STAKE_PRAZOS.every((p, i) => i === 0 || p.multiplicadorBps >= STAKE_PRAZOS[i - 1]!.multiplicadorBps));
check('o prazo mais curto é 1,0× — não há bônus por travar o mínimo',
  STAKE_PRAZOS[0]!.multiplicadorBps === 10_000);

// ── o que vai pela rede ─────────────────────────────────────────────────────
check('tudo serializa em JSON (nada de bigint solto)', (() => {
  try { return JSON.parse(JSON.stringify(r)).producao.fatias.length === 6; } catch { return false; }
})());

console.log(`\n${fail === 0 ? '🟢' : '🔴'} ${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);
