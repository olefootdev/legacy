/**
 * $OLEFOOT — a página PÚBLICA do token (game.olefoot.ai/token).
 *
 * "Quero que suba site, logo, tudo bonito e correto" (fundador, 2026-10-01).
 * Correto = os números são os do docs/TOKENOMICS.md Rev 6 e NADA aqui promete
 * o que não existe: antes do TGE o endereço diz "em criação"; antes da
 * liquidez a página diz com todas as letras que o token ainda não tem preço
 * de mercado — a pool entra quando a pré-venda cruzar $10k (decisão do
 * fundador). Honestidade É o marketing aqui.
 */
import { useEffect, useState } from 'react';
import { FitaRua } from '@/components/ui';
import { Link } from 'react-router-dom';
import { Check, Copy } from 'lucide-react';
import { olefootMintAddress } from '@/token/olefootMint';
import { L, emIngles } from '@/i18n/L';

const BALDES: { nome: string; pct: string; tokens: string; liberacao: string }[] = [
  { nome: L('Expansão (bônus de equiparação)', 'Expansion (matching bonus)'), pct: L('25,00%', '25.00%'), tokens: L('1.250.000.000', '1,250,000,000'), liberacao: L('tranche limitada pela receita · teto de 1%/dia no claim', 'revenue-capped tranche · 1%/day claim cap') },
  { nome: L('Ecossistema / recompensas in-game', 'Ecosystem / in-game rewards'), pct: L('20,00%', '20.00%'), tokens: L('1.000.000.000', '1,000,000,000'), liberacao: L('emissão por jogo, 5 anos, atrelada a sink', 'per-match emission, 5 years, tied to sinks') },
  { nome: 'Claim holders v1', pct: L('12,78%', '12.78%'), tokens: L('639.037.272', '639,037,272'), liberacao: L('razão 1:1 com o snapshot, em degraus', '1:1 with the snapshot, in steps') },
  { nome: L('Tesouraria / reserva', 'Treasury / reserve'), pct: L('12,00%', '12.00%'), tokens: L('600.000.000', '600,000,000'), liberacao: L('travado · governança · 6 meses de aviso', 'locked · governance · 6 months notice') },
  { nome: L('Equipe / fundadores', 'Team / founders'), pct: L('12,00%', '12.00%'), tokens: L('600.000.000', '600,000,000'), liberacao: L('12 meses de carência · linear 36 meses', '12-month cliff · 36-month linear') },
  { nome: L('Liquidez DEX', 'DEX liquidity'), pct: L('11,22%', '11.22%'), tokens: L('560.962.728', '560,962,728'), liberacao: L('250M na pool no esgotamento da pré-venda', '250M into the pool when the presale sells out') },
  { nome: L('Pré-venda', 'Presale'), pct: L('5,00%', '5.00%'), tokens: L('250.000.000', '250,000,000'), liberacao: L('10% no lançamento · linear 12 meses', '10% at launch · 12-month linear') },
  { nome: L('Marketing / parcerias', 'Marketing / partnerships'), pct: L('2,00%', '2.00%'), tokens: L('100.000.000', '100,000,000'), liberacao: L('5% no lançamento · linear 24 meses', '5% at launch · 24-month linear') },
];

export function TokenPage() {
  const mint = olefootMintAddress();
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    document.title = L('$OLEFOOT — o token do jogo', '$OLEFOOT — the game token');
  }, []);

  const copiar = async () => {
    if (!mint) return;
    try {
      await navigator.clipboard.writeText(mint);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch { /* o endereço continua selecionável */ }
  };

  return (
    <div className="rua-grao min-h-screen w-full bg-asfalto-27 text-papel">
      <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:py-16">
        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <section className="flex flex-col items-start gap-8 sm:flex-row sm:items-center">
          <img
            src="/token/olefoot-token.svg"
            alt={L('Logo do token OLEFOOT', 'OLEFOOT token logo')}
            className="h-36 w-36 shrink-0 sm:h-44 sm:w-44"
          />
          <div className="min-w-0">
            <p className="font-prova text-[11.5px] font-bold uppercase tracking-[0.24em] text-ouro-27">
              Solana · Token-2022
            </p>
            <h1 className="mt-1 font-impact uppercase leading-[0.85]" style={{ fontSize: 'clamp(56px, 13vw, 110px)' }}>
              $OLEFOOT
            </h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-suave">
              {emIngles() ? <>
              The token of the football manager where your squad is a <strong className="text-papel">living asset</strong>:
              players gain value through performance and training, and the whole market — sales, loans,
              wages, club shares — settles in OLEFOOT.
              </> : <>
              O token do football manager onde o elenco é um <strong className="text-papel">ativo vivo</strong>:
              jogadores valorizam com performance e treino, e o mercado inteiro — venda, aluguel,
              salário, cotas de clube — liquida em OLEFOOT.
              </>}
            </p>
          </div>
        </section>

        {/* ── OS NÚMEROS ───────────────────────────────────────────────── */}
        <FitaRua inclinacao={-2} className="-mx-5 mt-10 py-2" />

        <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { k: L('Supply total (fixo)', 'Total supply (fixed)'), v: L('5 bilhões', '5 billion') },
            { k: L('Decimais', 'Decimals'), v: '9' },
            { k: L('Taxa de transferência', 'Transfer fee'), v: '5%' },
            { k: L('Preço da pré-venda', 'Presale price'), v: L('$0,000125', '$0.000125') },
          ].map((x) => (
            <div key={x.k} className="min-w-0 bg-concreto p-4">
              <p className="font-prova text-[10.5px] font-bold uppercase tracking-[0.18em] text-mudo">{x.k}</p>
              <p className="mt-1 truncate font-spray text-[28px] font-black leading-none text-papel">{x.v}</p>
            </div>
          ))}
        </section>

        {/* ── CONTRATO ─────────────────────────────────────────────────── */}
        <section className="mt-4 border-[3px] border-ouro-27 bg-asfalto-27 p-4">
          <p className="font-prova text-[10.5px] font-bold uppercase tracking-[0.18em] text-ouro-27">— {L('Endereço do contrato (mint)', 'Contract address (mint)')}</p>
          {mint ? (
            <button type="button" onClick={() => void copiar()}
              className="mt-1 flex max-w-full items-center gap-2 font-prova text-[13px] text-papel hover:text-rua">
              <span className="truncate">{mint}</span>
              {copiado ? <Check className="h-4 w-4 shrink-0 text-rua" /> : <Copy className="h-4 w-4 shrink-0" />}
            </button>
          ) : (
            <p className="mt-1 font-prova text-[13px] text-suave">
              {L('em criação — será publicado aqui no dia do TGE', 'being created — published here on TGE day')}
            </p>
          )}
          <p className="mt-2 text-[11.5px] leading-relaxed text-mudo">
            {emIngles() ? <>
            Supply minted once and <strong className="text-papel">mint authority revoked</strong> (no one
            can mint more, ever). Freeze authority <strong className="text-papel">null</strong> (no one can freeze
            your wallet). The 5% fee is native Token-2022, verifiable on the explorer.
            </> : <>
            Supply cunhado de uma vez e <strong className="text-papel">mint authority revogada</strong> (ninguém
            cria mais token, nunca). Freeze authority <strong className="text-papel">nula</strong> (ninguém congela
            a tua carteira). A taxa de 5% é do próprio Token-2022, verificável no explorer.
            </>}
          </p>
        </section>

        {/* ── A VERDADE SOBRE O PREÇO ──────────────────────────────────── */}
        <section className="mt-4 border-l-[5px] border-rua bg-concreto p-4">
          <p className="font-prova text-[11.5px] font-bold uppercase tracking-[0.2em] text-rua">
            {L('Como o valor chega', 'How value arrives')}
          </p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-papel">
            {emIngles() ? <>
            OLEFOOT already circulates inside the game and wallets <strong className="text-papel">receive the token
            from day one</strong>. The DEX liquidity pool goes live when the presale crosses
            <strong className="text-papel"> $10,000</strong> — at that moment, whatever is already in wallets gets
            a market price automatically. Before that, there is no market price, and we don&apos;t pretend
            there is.
            </> : <>
            O OLEFOOT já circula dentro do jogo e as carteiras <strong className="text-papel">recebem o token
            desde o primeiro dia</strong>. A pool de liquidez no DEX entra quando a pré-venda cruzar
            <strong className="text-papel"> $10.000</strong> — nesse momento, o que já estiver nas carteiras passa a
            ter preço de mercado automaticamente. Antes disso, não existe preço de mercado, e não fingimos
            que existe.
            </>}
          </p>
        </section>

        {/* ── BALDES ───────────────────────────────────────────────────── */}
        <section className="mt-10">
          <h2 className="font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">
            {L('Distribuição dos 5 bilhões', 'Distribution of the 5 billion')}
          </h2>
          <div className="mt-3 overflow-x-auto border border-linha">
            <table className="w-full min-w-[640px] text-left text-[12.5px]">
              <thead>
                <tr className="border-b-2 border-linha font-prova text-[10px] uppercase tracking-[0.14em] text-mudo">
                  <th className="px-3 py-2.5">{L('Alocação', 'Allocation')}</th>
                  <th className="px-3 py-2.5">%</th>
                  <th className="px-3 py-2.5">Tokens</th>
                  <th className="px-3 py-2.5">{L('Liberação', 'Vesting')}</th>
                </tr>
              </thead>
              <tbody>
                {BALDES.map((b) => (
                  <tr key={b.nome} className="border-b border-linha">
                    <td className="px-3 py-2 font-bold text-papel">{b.nome}</td>
                    <td className="px-3 py-2 font-prova text-rua tabular-nums">{b.pct}</td>
                    <td className="px-3 py-2 font-prova text-papel tabular-nums">{b.tokens}</td>
                    <td className="px-3 py-2 text-suave">{b.liberacao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-mudo">
            {L('A régua completa, com as travas de cada balde, vive no TOKENOMICS do projeto — número daqui não muda sem mudar lá.', 'The full rulebook, with each bucket\'s locks, lives in the project TOKENOMICS — numbers here only change if they change there.')}
          </p>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        <section className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            to="/wallet?adicionar=olefoot&pack=1000"
            className="inline-flex min-h-[52px] items-center bg-rua px-6 font-impact text-[19px] uppercase leading-none text-asfalto-27 shadow-[5px_5px_0_var(--color-papel)] transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_var(--color-papel)]"
          >
            {L('Entrar na pré-venda', 'Join the presale')}
          </Link>
          <Link
            to="/mercado/vivo"
            className="inline-flex min-h-[52px] items-center border-2 border-papel px-6 font-impact text-[19px] uppercase leading-none text-papel hover:bg-papel hover:text-asfalto-27"
          >
            {L('Ver o mercado ao vivo', 'See the Live Market')}
          </Link>
          <a
            href="https://olefoot.ai"
            className="px-2 py-3.5 font-prova text-[12px] font-bold uppercase tracking-[0.18em] text-mudo hover:text-papel"
          >
            olefoot.ai →
          </a>
        </section>

        <p className="mt-12 border-t border-linha pt-4 text-[10.5px] leading-relaxed text-fio">
          {L('OLEFOOT é um token de utilidade do ecossistema Olefoot. Nada nesta página é recomendação de investimento. A pré-venda entrega posições com liberação programada (10% no TGE, linear em 12 meses), ao preço fixo de $0,000125 por token.', 'OLEFOOT is a utility token of the Olefoot ecosystem. Nothing on this page is investment advice. The presale delivers positions with scheduled vesting (10% at TGE, linear over 12 months), at a fixed price of $0.000125 per token.')}
        </p>
      </div>
    </div>
  );
}
