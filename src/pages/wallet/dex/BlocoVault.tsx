import { emUnidades, emPorcento, type FundoDoVault, type MeuVault, type RegrasDeEarnings } from '@/wallet/earningsClient';
import { LinhaDeValor } from './LinhaDeValor';
import { L, LOCALE } from '@/i18n/L';

/**
 * Vault — a única posição, e a política publicada antes do primeiro depósito.
 *
 * A carteira MOSTRA, não move. Aporte e resgate são operação do admin, com o
 * comprovante na mão (ver server/src/routes/vault.ts): cota não nasce de
 * pedido, nasce de entrada verificada.
 *
 * O backtest vai ROTULADO como backtest, com a queda do mesmo tamanho do
 * ganho, e ao lado do aviso de que o fundo ainda não tem resultado realizado.
 */
const sinal = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

export function BlocoVault({
  regra, fundo, meu, verSplit,
}: {
  regra: RegrasDeEarnings['vault'];
  fundo: FundoDoVault | null;
  meu: MeuVault | null;
  verSplit: () => void;
}) {
  const b = regra.backtest;
  const anos = (b.janelaAnosDecimos / 10).toLocaleString(LOCALE, { maximumFractionDigits: 1 });

  return (
    <div className="min-w-0 space-y-3">
      <div>
        <h3 className="font-impact text-[24px] uppercase leading-[1.1] text-white">{L('Sempre na pool', 'Always in the pool')}</h3>
        <p className="mt-1 text-[12px] text-cimento">{L('Sem timing, sem chamada. O motor é a taxa.', 'No timing, no calls. The fee is the engine.')}</p>
      </div>

      {/* ── estado do fundo ── */}
      {fundo ? (
        <div className="border border-white/10 bg-panel">
          <LinhaDeValor rotulo={L('Sua posição', 'Your position')}
                 valor={`${emUnidades(meu?.posicao.valorAgora ?? 0n, fundo.decimais)} ${fundo.ativo}`} forte />
          <LinhaDeValor rotulo={L('Valor da cota', 'Share value')}
                 valor={fundo.valorDaCota == null ? '—' : `${emUnidades(fundo.valorDaCota, fundo.decimais, 4)} ${fundo.ativo}`} />
          <LinhaDeValor rotulo={L('Patrimônio do fundo', 'Fund AUM')}
                 valor={`${emUnidades(fundo.patrimonio, fundo.decimais)} ${fundo.ativo}`} />
        </div>
      ) : (
        <div className="border-l-2 border-atencao bg-card px-3.5 py-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-atencao">{L('Fundo ainda não abriu', 'Fund not open yet')}</div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-giz">
            {L('A política abaixo é a definitiva, e está publicada antes do primeiro depósito, não depois.', 'The policy below is final, and is published before the first deposit, not after.')}
          </p>
        </div>
      )}

      {/* ── a política ── */}
      <div className="border border-white/10 bg-panel px-4 py-3.5">
        <div className="flex min-w-0 items-baseline justify-between gap-3">
          <span className="ole-num min-w-0 truncate text-[15px] uppercase text-white">{regra.par}</span>
          <span className="shrink-0 font-mono text-[11px] text-cimento">{L('faixa', 'range')} {regra.faixa}</span>
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-white/10 pt-3">
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-poeira">
            {L('Canário', 'Canary')} {regra.canario.nome}
          </span>
          <span className="font-mono text-[11.5px] text-giz">{L(`piso ${emPorcento(regra.canario.pisoAprBps)} ao ano`, `floor ${emPorcento(regra.canario.pisoAprBps)} per year`)}</span>
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-poeira">
          {L('Abaixo do piso o canário acende — ele não vende. Sair da pool é decisão humana, tomada à mão.', 'Below the floor the canary lights up — it doesn\'t sell. Leaving the pool is a human decision, made by hand.')}
        </p>
      </div>

      {/* ── backtest: leitura do passado, rotulada ── */}
      <div className="border border-white/10 bg-panel px-4 py-3.5">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-cimento">
          Backtest · {anos} {L('anos', 'years')}
        </div>
        {/* Uma medida por linha. Em três colunas os números não cabiam em
            320px — e o que cortava era o ganho, ficando só a queda inteira. */}
        <div className="mt-2.5">
          <Medida valor={`${sinal(b.retornoAoAnoPct.de)}–${b.retornoAoAnoPct.ate}%`} rotulo={L('ao ano', 'per year')} tom="text-alta" />
          <Medida valor={`${sinal(b.piorQuedaPct)}%`} rotulo={L('pior queda', 'max drawdown')} tom="text-baixa" />
          <Medida
            valor={`${sinal(b.segurandoSol.retornoAoAnoPct)}% / ${sinal(b.segurandoSol.piorQuedaPct)}%`}
            rotulo={L('segurando SOL', 'holding SOL')}
            tom="text-cimento"
          />
        </div>
        {regra.resultadoRealizado == null && (
          <p className="mt-3 border-t border-white/10 pt-2.5 font-mono text-[10.5px] text-poeira">
            {L('Resultado realizado: nenhum ainda. O fundo não operou com dinheiro.', 'Realized result: none yet. The fund hasn\'t traded real money.')}
          </p>
        )}
      </div>

      <div className="border-l-2 border-atencao bg-card px-3.5 py-3">
        <div className="font-mono text-[10px] uppercase tracking-wider text-atencao">{L('Isto é uma posição em SOL', 'This is a SOL position')}</div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-giz">
          {L('Leituras passadas, não taxa. As cotas andam com o preço do SOL, e um mês ruim aparece aqui igual a um bom.', 'Past readings, not a rate. Shares move with the SOL price, and a bad month shows up here just like a good one.')}
        </p>
      </div>

      <button
        type="button"
        onClick={verSplit}
        className="h-[50px] w-full border border-white/30 text-[13px] font-bold text-white transition-colors hover:border-white"
      >
        {L('COMO A COLHEITA SE DIVIDE', 'HOW THE HARVEST IS SPLIT')}
      </button>
    </div>
  );
}

function Medida({ valor, rotulo, tom }: { valor: string; rotulo: string; tom: string }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 border-t border-white/10 py-2 first:border-t-0">
      <span className="shrink-0 font-mono text-[10.5px] text-poeira">{rotulo}</span>
      <span className={`ole-num whitespace-nowrap text-[15px] leading-tight tabular-nums ${tom}`}>{valor}</span>
    </div>
  );
}
