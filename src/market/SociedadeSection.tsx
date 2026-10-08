/**
 * SOCIEDADE — cotas de clube (RPG-PRICE-LIVE nº 6).
 *
 * O dono vende até 49% do clube em OLEFOOT; os cotistas recebem a fração de
 * TODA venda do clube no mercado, paga pelo banco dentro da liquidação. Aqui:
 * ofertar/cancelar as minhas cotas, comprar cotas de outros clubes, e o
 * extrato de dividendos.
 */
import { useCallback, useEffect, useState } from 'react';
import { PieChart, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  cancelarOfertaDeCotas,
  comprarCotas,
  lerDividendos,
  lerMinhasCotas,
  lerOfertasDeCotas,
  ofertarCotas,
  type OfertaDeCota,
} from '@/market/marketLiveClient';
import { L, LOCALE, emIngles } from '@/i18n/L';

const tok = (v: string | number) => Math.round(Number(v)).toLocaleString(LOCALE);
const pct = (bps: number) => `${(bps / 100).toLocaleString(LOCALE, { maximumFractionDigits: 2 })}%`;

const MOTIVO: Record<string, string> = {
  passa_de_49: L('Entre vendidas e ofertadas, passaria de 49% — o clube é teu, a maioria fica contigo.', 'Sold plus offered would exceed 49% — the club is yours, the majority stays with you.'),
  bps_invalido: L('A fatia vai de 1% a 49%.', 'The stake goes from 1% to 49%.'),
  preco_invalido: L('Preço em OLEFOOT inteiro.', 'Price in whole OLEFOOT.'),
  indisponivel: L('Esta oferta não está mais disponível.', 'This offer is no longer available.'),
  propria_oferta: L('Não dá pra comprar a própria cota.', "You can't buy your own share."),
  saldo_insuficiente: L('Saldo OLEFOOT insuficiente.', 'Insufficient OLEFOOT balance.'),
  erro: L('Não foi possível concluir.', 'Could not complete.'),
};

export function SociedadeSection() {
  const [ofertas, setOfertas] = useState<OfertaDeCota[]>([]);
  const [minhas, setMinhas] = useState<{ comoDono: { holder: string; bps: number }[]; comoCotista: { owner: string; bps: number }[] }>({ comoDono: [], comoCotista: [] });
  const [dividendos, setDividendos] = useState<{ olefoot: string; at: string; souHolder: boolean }[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [abrirOferta, setAbrirOferta] = useState(false);
  const [pctCampo, setPctCampo] = useState('10');
  const [precoCampo, setPrecoCampo] = useState('');
  const [comprarAlvo, setComprarAlvo] = useState<OfertaDeCota | null>(null);
  const [agindo, setAgindo] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [o, m, d] = await Promise.all([lerOfertasDeCotas(), lerMinhasCotas(), lerDividendos()]);
      setOfertas(o);
      setMinhas(m);
      setDividendos(d.filter((x) => x.souHolder));
    } finally {
      setCarregando(false);
    }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const ofertar = async () => {
    if (agindo) return;
    setAgindo(true);
    setErro(null);
    try {
      const r = await ofertarCotas(Math.round(Number(pctCampo) * 100), Number(precoCampo.replace(/\./g, '')));
      if (!r.ok) { setErro(MOTIVO[r.motivo ?? 'erro'] ?? r.motivo ?? L('Falha.', 'Failed.')); return; }
      setAbrirOferta(false);
      setAviso(L(`${pctCampo}% do clube à venda por ${tok(precoCampo.replace(/\./g, ''))} OLEFOOT.`, `${pctCampo}% of the club for sale at ${tok(precoCampo.replace(/\./g, ''))} OLEFOOT.`));
      await carregar();
    } finally {
      setAgindo(false);
    }
  };

  const comprar = async () => {
    if (!comprarAlvo || agindo) return;
    setAgindo(true);
    setErro(null);
    try {
      const r = await comprarCotas(comprarAlvo.id);
      if (!r.ok) { setErro(MOTIVO[r.motivo ?? 'erro'] ?? r.motivo ?? L('Falha.', 'Failed.')); return; }
      setComprarAlvo(null);
      setAviso(L(`Agora és sócio: ${pct(r.percentBps ?? 0)} do clube. Dividendo cai a cada venda dele no mercado.`, `You're now a partner: ${pct(r.percentBps ?? 0)} of the club. Dividends land on each of its market sales.`));
      await carregar();
    } finally {
      setAgindo(false);
    }
  };

  const vendidoBps = minhas.comoDono.reduce((s, x) => s + x.bps, 0);
  const campo = 'w-full border-2 border-linha bg-concreto px-3 py-2.5 font-prova text-[14px] text-papel placeholder:text-mudo focus:border-rua focus:outline-none';
  const rotuloCampo = 'font-prova text-[10px] font-bold uppercase tracking-[0.14em] text-mudo';
  const rotulo = 'font-prova text-[11px] font-bold uppercase tracking-[0.18em] text-mudo';

  // DS 2027: a fatia do clube é valor que já existe — o "meu clube" mora no
  // degrau RESPEITO (fio de ouro); ofertas e extrato em concreto.
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 font-prova text-[12px] font-bold uppercase tracking-[0.22em] text-mudo">
          <PieChart className="h-4 w-4 shrink-0" /> <span className="min-w-0 truncate">— {L('Sociedade · cotas do clube', 'Partnership · club shares')}</span>
        </h2>
        <button type="button" onClick={() => void carregar()} disabled={carregando}
          className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 border-2 border-linha px-3 font-prova text-[11px] font-bold uppercase tracking-[0.1em] text-suave hover:border-papel hover:text-papel disabled:opacity-50">
          <RotateCcw className={cn('h-3.5 w-3.5', carregando && 'animate-spin')} /> {L('Atualizar', 'Refresh')}
        </button>
      </div>

      {erro ? <p role="alert" className="border-l-[3px] border-baixa bg-concreto px-3 py-2.5 text-[13px] text-papel">{erro}</p> : null}
      {aviso ? <p role="status" className="border-l-[3px] border-rua bg-concreto px-3 py-2.5 text-[13px] text-papel">{aviso}</p> : null}

      <div className="grid min-w-0 gap-3 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-2 border-[3px] border-ouro-27 bg-asfalto-27 p-4">
          <div className={rotulo}>{L('Meu clube', 'My club')}</div>
          <p className="font-spray text-[40px] font-black leading-none text-ouro-27">
            {pct(10000 - vendidoBps)} <span className="font-prova text-[12px] font-bold uppercase text-papel">{L('meu', 'mine')}</span>
          </p>
          <p className="text-[13px] leading-relaxed text-suave">
            {vendidoBps > 0 ? L(`${pct(vendidoBps)} com ${minhas.comoDono.length} sócio(s).`, `${pct(vendidoBps)} with ${minhas.comoDono.length} partner(s).`) : L('Sem sócios — 100% teu.', 'No partners — 100% yours.')}
            {' '}{L('Cotista recebe a fração de toda venda tua no mercado.', 'Shareholders get their cut of every market sale you make.')}
          </p>
          <button type="button" onClick={() => setAbrirOferta(true)}
            className="mt-1 inline-flex min-h-[44px] items-center gap-1.5 self-start border-2 border-papel px-4 font-impact text-[16px] uppercase leading-none text-papel hover:bg-papel hover:text-asfalto-27">
            {L('Vender cotas', 'Sell shares')} <span aria-hidden>→</span>
          </button>
        </div>

        <div className="flex min-w-0 flex-col gap-2 bg-concreto p-4">
          <div className={rotulo}>{L('Sou sócio de', 'Partner in')}</div>
          {minhas.comoCotista.length === 0 ? (
            <p className="border-2 border-dashed border-fio p-3 font-voz text-[19px] leading-tight text-suave">{L('Nenhum clube ainda — compra uma cota abaixo.', 'No clubs yet — buy a share below.')}</p>
          ) : (
            <ul className="flex flex-col">
              {minhas.comoCotista.map((c) => (
                <li key={c.owner} className="flex justify-between border-b border-linha py-1.5 last:border-b-0">
                  <span className="font-prova text-[11px] text-mudo">{c.owner.slice(0, 8)}…</span>
                  <span className="font-impact text-[17px] text-papel">{pct(c.bps)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-2 bg-concreto p-4">
          <div className={rotulo}>{L('Dividendos recebidos', 'Dividends received')}</div>
          {dividendos.length === 0 ? (
            <p className="border-2 border-dashed border-fio p-3 font-voz text-[19px] leading-tight text-suave">{L('Nenhum ainda. Eles caem sozinhos quando o clube vende.', 'None yet. They land automatically when the club sells.')}</p>
          ) : (
            <ul className="flex flex-col">
              {dividendos.slice(0, 5).map((d, i) => (
                <li key={i} className="flex justify-between border-b border-linha py-1.5 last:border-b-0">
                  <span className="font-impact text-[17px] text-alta">+{tok(d.olefoot)} <span className="font-prova text-[10px] text-mudo">OLEFOOT</span></span>
                  <span className="font-prova text-[11px] text-mudo">{new Date(d.at).toLocaleDateString(LOCALE)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {ofertas.length > 0 ? (
        <div className="flex min-w-0 flex-wrap gap-2">
          {ofertas.map((o) => (
            <div key={o.id} className="flex min-w-0 flex-wrap items-center gap-3 bg-concreto px-3 py-2">
              <span className="font-impact text-[20px] leading-none text-papel">{pct(o.percentBps)}</span>
              <span className="font-prova text-[11px] text-mudo">{L('de um clube', 'of a club')} · {tok(o.priceOlefoot)} OLEFOOT</span>
              {o.mine ? (
                <button type="button" onClick={() => void cancelarOfertaDeCotas(o.id).then(() => carregar())}
                  className="inline-flex min-h-[36px] items-center border-2 border-dashed border-fio px-2.5 font-prova text-[11px] font-bold uppercase text-suave hover:border-baixa hover:text-papel">
                  {L('Tirar', 'Remove')}
                </button>
              ) : (
                <button type="button" onClick={() => setComprarAlvo(o)}
                  className="inline-flex min-h-[36px] items-center gap-1 bg-rua px-3 font-impact text-[15px] uppercase leading-none text-asfalto-27 shadow-[3px_3px_0_var(--color-papel)]">
                  {L('Comprar', 'Buy')} <span aria-hidden>→</span>
                </button>
              )}
            </div>
          ))}
        </div>
      ) : null}

      <ConfirmDialog
        open={abrirOferta}
        onClose={() => (agindo ? null : setAbrirOferta(false))}
        onConfirm={() => void ofertar()}
        eyebrow={L('Sociedade', 'Partnership')}
        title={L('Vender cotas do clube?', 'Sell club shares?')}
        confirmLabel={agindo ? L('Anunciando…', 'Listing…') : L('Anunciar cotas', 'List shares')}
        confirmDisabled={agindo || !Number(pctCampo) || !Number(precoCampo.replace(/\./g, ''))}
        accent="var(--color-rua)"
      >
        <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-suave">
          {emIngles() ? (
            <p>
              The buyer becomes a partner and automatically gets their cut of <strong className="text-papel">every sale you make</strong> on
              the squad market. The majority is always yours (49% cap).
            </p>
          ) : (
            <p>
              O comprador vira sócio e recebe a fração dele de <strong className="text-papel">toda venda tua</strong> no
              mercado de elenco, automática. A maioria é sempre tua (teto 49%).
            </p>
          )}
          <label className="flex flex-col gap-1">
            <span className={rotuloCampo}>{L('Fatia (%)', 'Stake (%)')}</span>
            <input className={campo} value={pctCampo} inputMode="decimal"
              onChange={(e) => setPctCampo(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))} placeholder="10" />
          </label>
          <label className="flex flex-col gap-1">
            <span className={rotuloCampo}>{L('Preço (OLEFOOT)', 'Price (OLEFOOT)')}</span>
            <input className={campo} value={precoCampo} inputMode="numeric"
              onChange={(e) => setPrecoCampo(e.target.value.replace(/[^\d]/g, ''))} placeholder={L('ex.: 50000', 'e.g. 50000')} />
          </label>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={comprarAlvo != null}
        onClose={() => (agindo ? null : setComprarAlvo(null))}
        onConfirm={() => void comprar()}
        eyebrow={L('Sociedade', 'Partnership')}
        title={L(`Comprar ${comprarAlvo ? pct(comprarAlvo.percentBps) : ''} de um clube?`, `Buy ${comprarAlvo ? pct(comprarAlvo.percentBps) : ''} of a club?`)}
        confirmLabel={agindo ? L('Comprando…', 'Buying…') : L(`Pagar ${tok(comprarAlvo?.priceOlefoot ?? 0)} OLEFOOT`, `Pay ${tok(comprarAlvo?.priceOlefoot ?? 0)} OLEFOOT`)}
        confirmDisabled={agindo}
        accent="var(--color-rua)"
      >
        <p className="mt-3 text-[14px] leading-relaxed text-suave">
          {L(
            `Tu recebes ${comprarAlvo ? pct(comprarAlvo.percentBps) : ''} de toda venda que esse clube fizer no mercado de elenco — direto na tua carteira, sem depender de ninguém.`,
            `You get ${comprarAlvo ? pct(comprarAlvo.percentBps) : ''} of every sale this club makes on the squad market — straight to your wallet, no middleman.`,
          )}
        </p>
      </ConfirmDialog>
    </section>
  );
}
