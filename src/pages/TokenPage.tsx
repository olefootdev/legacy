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
import { Link } from 'react-router-dom';
import { Check, Copy } from 'lucide-react';
import { olefootMintAddress } from '@/token/olefootMint';

const BALDES: { nome: string; pct: string; tokens: string; liberacao: string }[] = [
  { nome: 'Expansão (bônus de equiparação)', pct: '25,00%', tokens: '1.250.000.000', liberacao: 'tranche limitada pela receita · teto de 1%/dia no claim' },
  { nome: 'Ecossistema / recompensas in-game', pct: '20,00%', tokens: '1.000.000.000', liberacao: 'emissão por jogo, 5 anos, atrelada a sink' },
  { nome: 'Claim holders v1', pct: '12,78%', tokens: '639.037.272', liberacao: 'razão 1:1 com o snapshot, em degraus' },
  { nome: 'Tesouraria / reserva', pct: '12,00%', tokens: '600.000.000', liberacao: 'travado · governança · 6 meses de aviso' },
  { nome: 'Equipe / fundadores', pct: '12,00%', tokens: '600.000.000', liberacao: '12 meses de carência · linear 36 meses' },
  { nome: 'Liquidez DEX', pct: '11,22%', tokens: '560.962.728', liberacao: '250M na pool no esgotamento da pré-venda' },
  { nome: 'Pré-venda', pct: '5,00%', tokens: '250.000.000', liberacao: '10% no lançamento · linear 12 meses' },
  { nome: 'Marketing / parcerias', pct: '2,00%', tokens: '100.000.000', liberacao: '5% no lançamento · linear 24 meses' },
];

export function TokenPage() {
  const mint = olefootMintAddress();
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    document.title = '$OLEFOOT — o token do jogo';
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
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:py-16">
        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <section className="flex flex-col items-start gap-8 sm:flex-row sm:items-center">
          <img
            src="/token/olefoot-token.svg"
            alt="Logo do token OLEFOOT"
            className="h-36 w-36 shrink-0 sm:h-44 sm:w-44"
          />
          <div className="min-w-0">
            <p className="font-display text-[11px] font-black uppercase tracking-[0.3em] text-neon-yellow">
              Solana · Token-2022
            </p>
            <h1 className="mt-1 font-impact uppercase leading-[0.85]" style={{ fontSize: 'clamp(56px, 13vw, 110px)' }}>
              $OLEFOOT
            </h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/65">
              O token do football manager onde o elenco é um <strong className="text-white">ativo vivo</strong>:
              jogadores valorizam com performance e treino, e o mercado inteiro — venda, aluguel,
              salário, cotas de clube — liquida em OLEFOOT.
            </p>
          </div>
        </section>

        {/* ── OS NÚMEROS ───────────────────────────────────────────────── */}
        <section className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { k: 'Supply total (fixo)', v: '5 bilhões' },
            { k: 'Decimais', v: '9' },
            { k: 'Taxa de transferência', v: '5%' },
            { k: 'Preço da pré-venda', v: '$0,000125' },
          ].map((x) => (
            <div key={x.k} className="border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[9px] uppercase tracking-widest text-white/40">{x.k}</p>
              <p className="mt-1 font-impact text-[24px] text-neon-yellow">{x.v}</p>
            </div>
          ))}
        </section>

        {/* ── CONTRATO ─────────────────────────────────────────────────── */}
        <section className="mt-4 border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[9px] uppercase tracking-widest text-white/40">Endereço do contrato (mint)</p>
          {mint ? (
            <button type="button" onClick={() => void copiar()}
              className="mt-1 flex max-w-full items-center gap-2 font-mono text-[13px] text-white hover:text-neon-yellow">
              <span className="truncate">{mint}</span>
              {copiado ? <Check className="h-4 w-4 shrink-0 text-emerald-300" /> : <Copy className="h-4 w-4 shrink-0" />}
            </button>
          ) : (
            <p className="mt-1 font-mono text-[13px] text-white/50">
              em criação — será publicado aqui no dia do TGE
            </p>
          )}
          <p className="mt-2 text-[11.5px] leading-relaxed text-white/45">
            Supply cunhado de uma vez e <strong className="text-white/70">mint authority revogada</strong> (ninguém
            cria mais token, nunca). Freeze authority <strong className="text-white/70">nula</strong> (ninguém congela
            a tua carteira). A taxa de 5% é do próprio Token-2022, verificável no explorer.
          </p>
        </section>

        {/* ── A VERDADE SOBRE O PREÇO ──────────────────────────────────── */}
        <section className="mt-4 border border-neon-yellow/40 bg-neon-yellow/5 p-4">
          <p className="font-display text-[11px] font-black uppercase tracking-widest text-neon-yellow">
            Como o valor chega
          </p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/75">
            O OLEFOOT já circula dentro do jogo e as carteiras <strong className="text-white">recebem o token
            desde o primeiro dia</strong>. A pool de liquidez no DEX entra quando a pré-venda cruzar
            <strong className="text-white"> $10.000</strong> — nesse momento, o que já estiver nas carteiras passa a
            ter preço de mercado automaticamente. Antes disso, não existe preço de mercado, e não fingimos
            que existe.
          </p>
        </section>

        {/* ── BALDES ───────────────────────────────────────────────────── */}
        <section className="mt-10">
          <h2 className="font-display text-[12px] font-black uppercase tracking-[0.25em] text-white/55">
            Distribuição dos 5 bilhões
          </h2>
          <div className="mt-3 overflow-x-auto border border-white/10">
            <table className="w-full min-w-[640px] text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-white/10 text-[9px] uppercase tracking-wider text-white/40">
                  <th className="px-3 py-2.5">Alocação</th>
                  <th className="px-3 py-2.5">%</th>
                  <th className="px-3 py-2.5">Tokens</th>
                  <th className="px-3 py-2.5">Liberação</th>
                </tr>
              </thead>
              <tbody>
                {BALDES.map((b) => (
                  <tr key={b.nome} className="border-b border-white/5">
                    <td className="px-3 py-2 font-bold text-white">{b.nome}</td>
                    <td className="px-3 py-2 font-mono text-neon-yellow tabular-nums">{b.pct}</td>
                    <td className="px-3 py-2 font-mono text-white/70 tabular-nums">{b.tokens}</td>
                    <td className="px-3 py-2 text-white/50">{b.liberacao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-white/40">
            A régua completa, com as travas de cada balde, vive no TOKENOMICS do projeto — número daqui
            não muda sem mudar lá.
          </p>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        <section className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            to="/wallet?adicionar=olefoot&pack=1000"
            className="bg-neon-yellow px-7 py-3.5 font-display text-[13px] font-black uppercase tracking-[0.18em] text-black hover:bg-white"
          >
            Entrar na pré-venda
          </Link>
          <Link
            to="/mercado/vivo"
            className="border border-white/25 px-7 py-3.5 font-display text-[13px] font-black uppercase tracking-[0.18em] text-white hover:border-neon-yellow hover:text-neon-yellow"
          >
            Ver o mercado ao vivo
          </Link>
          <a
            href="https://olefoot.ai"
            className="px-2 py-3.5 font-display text-[12px] font-bold uppercase tracking-[0.18em] text-white/45 hover:text-white"
          >
            olefoot.ai →
          </a>
        </section>

        <p className="mt-12 border-t border-white/10 pt-4 text-[10.5px] leading-relaxed text-white/35">
          OLEFOOT é um token de utilidade do ecossistema Olefoot. Nada nesta página é recomendação de
          investimento. A pré-venda entrega posições com liberação programada (10% no TGE, linear em 12
          meses), ao preço fixo de $0,000125 por token.
        </p>
      </div>
    </div>
  );
}
