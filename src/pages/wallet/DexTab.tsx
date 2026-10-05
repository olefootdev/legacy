import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { WalletShell } from './WalletShell';
import { WalletAtalhos } from './WalletAtalhos';
import { SolanaWalletCard } from './SolanaWalletCard';
import { GateDePin, PinCard } from './PinDaCarteira';
import { Earnings } from './dex/Earnings';
import { LinhaDeValor } from './dex/LinhaDeValor';
import { SecaoVolt, Hashtag } from '@/components/ui';
import { ORIGEM_DA_CARTEIRA } from '@/wallet/seed/conexao';
import { lerMinhaPosicao, POSICAO_VAZIA, type PosicaoOlefoot } from '@/supabase/presalePosicao';
import { aoMudarAPosicao } from '@/wallet/eventosDaCarteira';
import { useTrackScreen } from '@/progression/trackEvent';
import { L, LOCALE } from '@/i18n/L';

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

const br = (v: bigint) => v.toLocaleString(LOCALE);

// Dólar escrito como o resto da tela: ponto no milhar, vírgula no centavo.
function dolar(cents: number): string {
  return `$${(cents / 100).toLocaleString(LOCALE, {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2,
  })}`;
}

export function DexTab() {
  useTrackScreen('screen_wallet');
  // O gate vem antes do conteúdo de propósito: trancada, a aba nem busca a
  // posição — número protegido não viaja pra uma tela que não abriu.
  return (
    <GateDePin>
      <DexConteudo />
    </GateDePin>
  );
}

function DexConteudo() {
  const navigate = useNavigate();
  const [posicao, setPosicao] = useState<PosicaoOlefoot | null>(null);

  useEffect(() => {
    let vivo = true;
    const ler = () => { void lerMinhaPosicao().then((p) => { if (vivo) setPosicao(p); }); };
    ler();
    // Quem compra sem sair desta tela vê a posição nova na hora.
    const parar = aoMudarAPosicao(ler);
    return () => { vivo = false; parar(); };
  }, []);

  const p = posicao ?? POSICAO_VAZIA;
  const carregando = posicao === null;

  return (
    <WalletShell
      title={L('Conta DEX', 'DEX account')}
      hashtag="#dex"
      heroVariant="compact"
      heroStats={[
        { label: 'OLEFOOT', value: carregando ? '…' : br(p.tokens), highlight: true },
        { label: L('Comprado', 'Bought'), value: carregando ? '…' : dolar(p.compradoUsdCents) },
      ]}
    >
      <WalletAtalhos />

      {/* ── OLEWALLET: a chave é da pessoa, e fica fora do jogo ───── */}
      <section className="space-y-3">
        <SecaoVolt label="OLEWALLET">
          <Hashtag>{L('#suachave #suacustodia', '#yourkey #yourcustody')}</Hashtag>
        </SecaoVolt>
        <SolanaWalletCard />
        <a
          href={ORIGEM_DA_CARTEIRA}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-[50px] items-center justify-between gap-3 border border-white/30 px-4 text-white transition-colors hover:border-white"
        >
          <span className="ole-num min-w-0 truncate text-[13px] uppercase">{L('Abrir OLEWALLET', 'Open OLEWALLET')}</span>
          <ArrowUpRight className="h-4 w-4 shrink-0" strokeWidth={2.2} />
        </a>
        <PinCard />
      </section>

      {/* ── POSIÇÃO: o que foi comprado e o que ainda está travado ── */}
      <section className="space-y-3">
        <SecaoVolt label={L('Posição OLEFOOT', 'OLEFOOT position')} tone="neutro">
          <Hashtag>{L('#prevenda', '#presale')}</Hashtag>
        </SecaoVolt>
        <div className="border border-white/10 bg-panel">
          <LinhaDeValor rotulo={L('Comprado', 'Bought')} valor={carregando ? '…' : `${br(p.tokens)} OLEFOOT`} forte />
          <LinhaDeValor rotulo={L('Travado', 'Locked')} valor={carregando ? '…' : `${br(p.travado)} OLEFOOT`} />
          <LinhaDeValor rotulo={L('Liberado', 'Unlocked')} valor={carregando ? '…' : `${br(p.liberado)} OLEFOOT`} />
        </div>
        <button
          type="button"
          onClick={() => navigate('/wallet/dex?adicionar=olefoot')}
          className="ole-num inline-flex h-[50px] w-full items-center justify-center whitespace-nowrap bg-neon-yellow text-[13px] uppercase text-black transition-colors hover:bg-white [--corte:12px] [clip-path:var(--clip-corte)]"
        >
          {L('Comprar OLEFOOT no Pix', 'Buy OLEFOOT with Pix')}
        </button>
        {/* Texto de custódia: não é enfeite, é o que a pessoa precisa saber
            antes de achar que tem token na carteira. */}
        <p className="border-l-2 border-cimento bg-card px-3.5 py-3 text-[12px] leading-relaxed text-cimento">
          {L('Este OLEFOOT é seu desde o Pix e está registrado na sua posição. Ele entra travado e libera com o tempo ou com uma nova compra; o que for liberado vai para a carteira Solana vinculada, e a partir dela a custódia é sua.', 'This OLEFOOT is yours from the moment the Pix clears and is recorded in your position. It starts locked and unlocks over time or with a new buy; what unlocks goes to your linked Solana wallet, and from there custody is yours.')}
        </p>
      </section>

      {/* ── EARNINGS: Vault, Produção e Stake ────────────────────── */}
      <Earnings />
    </WalletShell>
  );
}

