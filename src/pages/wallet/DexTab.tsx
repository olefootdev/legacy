import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { WalletShell } from './WalletShell';
import { WalletAtalhos } from './WalletAtalhos';
import { SolanaWalletCard } from './SolanaWalletCard';
import { SecaoVolt, Hashtag } from '@/components/ui';
import { ORIGEM_DA_CARTEIRA } from '@/wallet/seed/conexao';
import { lerMinhaPosicao, POSICAO_VAZIA, type PosicaoOlefoot } from '@/supabase/presalePosicao';
import { useTrackScreen } from '@/progression/trackEvent';

/**
 * Wallet → DEX. O lado que vive (ou vai viver) na Solana.
 *
 * 🔑 A DEX mora DENTRO da carteira do jogo, e a chave mora FORA. Esta tela
 * mostra posição e endereço, que dependem da sessão da conta; criar carteira,
 * assinar e ver a frase continuam em `dex.olefoot.ai`, que é outra origem de
 * propósito — o jogo não consegue ler o cofre de lá (ver conexao.ts).
 *
 * Antes eram dois endereços disputando a mesma função: o fundador percorreu
 * "jogo → DEX → abrir carteira" e a DEX não estava lá. Agora a porta é uma só.
 *
 * VOLT2: sem ouro e sem SeloRede aqui. OLEFOOT comprado na pré-venda ainda é
 * posição em tabela — ouro é só pra ativo que já está na cadeia.
 */

const br = (v: bigint) => v.toLocaleString('pt-BR');

function dolar(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

export function DexTab() {
  useTrackScreen('screen_wallet');
  const [posicao, setPosicao] = useState<PosicaoOlefoot | null>(null);

  useEffect(() => {
    let vivo = true;
    void lerMinhaPosicao().then((p) => { if (vivo) setPosicao(p); });
    return () => { vivo = false; };
  }, []);

  const p = posicao ?? POSICAO_VAZIA;
  const carregando = posicao === null;

  return (
    <WalletShell
      title="Conta DEX"
      hashtag="#dex"
      heroVariant="compact"
      heroStats={[
        { label: 'OLEFOOT', value: carregando ? '…' : br(p.tokens), highlight: true },
        { label: 'Comprado', value: carregando ? '…' : dolar(p.compradoUsdCents) },
      ]}
    >
      <WalletAtalhos />

      {/* ── OLEWALLET: a chave é da pessoa, e fica fora do jogo ───── */}
      <section className="space-y-3">
        <SecaoVolt label="OLEWALLET">
          <Hashtag>#suachave #suacustodia</Hashtag>
        </SecaoVolt>
        <SolanaWalletCard />
        <a
          href={ORIGEM_DA_CARTEIRA}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-[50px] items-center justify-between gap-3 border border-white/30 px-4 text-white transition-colors hover:border-white"
        >
          <span className="ole-num min-w-0 truncate text-[13px] uppercase">Abrir OLEWALLET</span>
          <ArrowUpRight className="h-4 w-4 shrink-0" strokeWidth={2.2} />
        </a>
      </section>

      {/* ── POSIÇÃO: o que foi comprado e o que ainda está travado ── */}
      <section className="space-y-3">
        <SecaoVolt label="Posição OLEFOOT" tone="neutro">
          <Hashtag>#prevenda</Hashtag>
        </SecaoVolt>
        <div className="border border-white/10 bg-panel">
          <Linha rotulo="Comprado" valor={carregando ? '…' : `${br(p.tokens)} OLEFOOT`} forte />
          <Linha rotulo="Travado" valor={carregando ? '…' : `${br(p.travado)} OLEFOOT`} />
          <Linha rotulo="Liberado" valor={carregando ? '…' : `${br(p.liberado)} OLEFOOT`} />
        </div>
        {/* Texto de custódia: não é enfeite, é o que a pessoa precisa saber
            antes de achar que tem token na carteira. */}
        <p className="border-l-2 border-cimento bg-card px-3.5 py-3 text-[12px] leading-relaxed text-cimento">
          O token ainda não foi lançado na Solana. Até lá este número é a sua posição
          registrada. A entrega vai para a carteira vinculada, e a partir dela a
          custódia é sua.
        </p>
      </section>
    </WalletShell>
  );
}

function Linha({ rotulo, valor, forte }: { rotulo: string; valor: string; forte?: boolean }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 border-b border-white/10 px-4 py-3.5 last:border-b-0">
      <span className="shrink-0 font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-poeira">
        {rotulo}
      </span>
      <span
        className={`ole-num min-w-0 truncate tabular-nums ${forte ? 'text-[18px] text-white' : 'text-[14px] text-giz'}`}
      >
        {valor}
      </span>
    </div>
  );
}
