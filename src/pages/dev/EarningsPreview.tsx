/**
 * Prévia dos blocos de EARNINGS com o fundo ABERTO — só em desenvolvimento
 * (rota /dev/earnings, montada atrás de `import.meta.env.DEV` no App).
 *
 * Existe porque em produção o fundo ainda não foi criado e ninguém tem cota:
 * sem isto não dá pra olhar como a tela fica no dia em que houver posição e
 * colheita. Nada aqui chega à produção nem finge ser dado de alguém.
 *
 * As REGRAS deste exemplo são as mesmas do servidor, repetidas aqui só pra
 * prévia funcionar sem rede. A tela de verdade não tem cópia — ver
 * scripts/valida-earnings-sem-constante.mjs.
 */
import { WalletShell } from '@/pages/wallet/WalletShell';
import { BlocoVault } from '@/pages/wallet/dex/BlocoVault';
import { BlocoProducao } from '@/pages/wallet/dex/BlocoProducao';
import { BlocoStake } from '@/pages/wallet/dex/BlocoStake';
import type { FundoDoVault, MeuVault, RegrasDeEarnings } from '@/wallet/earningsClient';

const REGRAS: RegrasDeEarnings = {
  producao: {
    totalBps: 10_000,
    fatias: [
      { id: 'voce', rotulo: 'Você', papel: 'depositante', bps: 5_000 },
      { id: 'myclub', rotulo: 'MyClub', papel: 'nivel1', bps: 1_000 },
      { id: 'manager', rotulo: 'Manager', papel: 'nivel2', bps: 500 },
      { id: 'captain', rotulo: 'Capitão', papel: 'nivel3', bps: 500 },
      { id: 'pro', rotulo: 'Pro', papel: 'nivel4', bps: 500 },
      { id: 'olefoot', rotulo: 'OLEFOOT', papel: 'casa', bps: 2_500 },
    ],
  },
  vault: {
    slug: 'wsol-usdc', par: 'WSOL / USDC', faixa: 'cheia',
    canario: { nome: 'K1', pisoAprBps: 2_500 },
    backtest: {
      janelaAnosDecimos: 27,
      retornoAoAnoPct: { de: 60, ate: 77 },
      piorQuedaPct: -32,
      segurandoSol: { retornoAoAnoPct: 22, piorQuedaPct: -76 },
    },
    resultadoRealizado: null,
  },
  stake: {
    aberto: false, saidaAntecipada: false,
    prazos: [
      { dias: 30, multiplicadorBps: 10_000 }, { dias: 90, multiplicadorBps: 15_000 },
      { dias: 180, multiplicadorBps: 20_000 }, { dias: 360, multiplicadorBps: 30_000 },
    ],
  },
};

// USDT na Solana tem 6 casas.
const FUNDO: FundoDoVault = {
  ativo: 'USDT', decimais: 6,
  patrimonio: 184_250_430_000n,
  valorDaCota: 1_083_400n,
};

const MEU: MeuVault = {
  posicao: { cotas: 1_250_000_000_000n, valorAgora: 1_354_250_000n },
  fatias: [
    { fatia: 'voce', unidades: 18_420_000n, colheita: 'ex-3' },
    { fatia: 'myclub', unidades: 2_110_000n, colheita: 'ex-3' },
    { fatia: 'voce', unidades: 16_905_000n, colheita: 'ex-2' },
  ],
};

export default function EarningsPreview() {
  return (
    <WalletShell title="Earnings" hashtag="#dex · exemplo" heroVariant="compact" voltar>
      <BlocoVault regra={REGRAS.vault} fundo={FUNDO} meu={MEU} verSplit={() => {}} />
      <BlocoProducao regra={REGRAS.producao} fundo={FUNDO} meu={MEU} />
      <BlocoStake regra={REGRAS.stake} />
    </WalletShell>
  );
}
