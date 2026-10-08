import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WalletShell } from './WalletShell';
import { WalletAtalhos } from './WalletAtalhos';
import { SolanaWalletCard } from './SolanaWalletCard';
import { GateDePin, PinCard } from './PinDaCarteira';
import { Earnings } from './dex/Earnings';
import { LinhaDeValor } from './dex/LinhaDeValor';
import { BotaoRua, SecaoRua } from '@/components/ui/Rua';
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
 * DS 2027: a posição é valor que já existe — degrau RESPEITO (asfalto + fio de
 * ouro). Ouro chapado (LENDA) NÃO entra: OLEFOOT da pré-venda ainda é posição
 * em tabela, não ativo na cadeia. O texto de custódia vira lambe colado: é o
 * momento "rua" da tela, e é o que a pessoa precisa ler.
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
      <section className="space-y-4">
        <SecaoRua label="OLEWALLET" aside={L('#suachave #suacustodia', '#yourkey #yourcustody')} />
        <SolanaWalletCard />
        <a
          href={ORIGEM_DA_CARTEIRA}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[52px] items-center justify-between gap-3 border-2 border-papel px-4 font-impact text-[20px] uppercase leading-none text-papel transition-colors hover:bg-papel hover:text-asfalto-27"
        >
          <span className="min-w-0 truncate">{L('Abrir OLEWALLET', 'Open OLEWALLET')}</span>
          <span aria-hidden className="shrink-0">↗</span>
        </a>
        <PinCard />
      </section>

      {/* ── POSIÇÃO: o que foi comprado e o que ainda está travado ── */}
      <section className="space-y-4">
        <SecaoRua label={L('Posição OLEFOOT', 'OLEFOOT position')} aside={L('#prevenda', '#presale')} />
        <div className="border-[3px] border-ouro-27 bg-asfalto-27">
          <LinhaDeValor rotulo={L('Comprado', 'Bought')} valor={carregando ? '…' : `${br(p.tokens)} OLEFOOT`} forte />
          <LinhaDeValor rotulo={L('Travado', 'Locked')} valor={carregando ? '…' : `${br(p.travado)} OLEFOOT`} />
          <LinhaDeValor rotulo={L('Liberado', 'Unlocked')} valor={carregando ? '…' : `${br(p.liberado)} OLEFOOT`} />
        </div>
        <BotaoRua onClick={() => navigate('/wallet/dex?adicionar=olefoot')} className="w-full">
          {L('Comprar OLEFOOT no Pix', 'Buy OLEFOOT with Pix')} <span aria-hidden>→</span>
        </BotaoRua>
        {/* Texto de custódia: não é enfeite, é o que a pessoa precisa saber
            antes de achar que tem token na carteira. Lambe de papel colado
            torto — o momento "rua" da DEX. */}
        <div className="pt-2">
          <div className="-rotate-1 bg-cal px-4 py-3.5 text-asfalto-27 shadow-[5px_5px_0_rgba(0,0,0,0.55)]">
            <p className="font-prova text-[11px] font-bold uppercase tracking-[0.2em]">— {L('Leia antes', 'Read first')}</p>
            <p className="mt-1.5 text-[13px] font-medium leading-relaxed">
              {L('Este OLEFOOT é seu desde o Pix e está registrado na sua posição. Ele entra travado e libera com o tempo ou com uma nova compra; o que for liberado vai para a carteira Solana vinculada, e a partir dela a custódia é sua.', 'This OLEFOOT is yours from the moment the Pix clears and is recorded in your position. It starts locked and unlocks over time or with a new buy; what unlocks goes to your linked Solana wallet, and from there custody is yours.')}
            </p>
          </div>
        </div>
      </section>

      {/* ── EARNINGS: Vault, Produção e Stake ────────────────────── */}
      <Earnings />
    </WalletShell>
  );
}

