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
  const campo = 'w-full border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30';

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="ole-eyebrow-poster flex items-center gap-2" style={{ fontSize: '13px' }}>
          <PieChart className="h-4 w-4" /> {L('Sociedade · cotas do clube', 'Partnership · club shares')}
        </h2>
        <button type="button" onClick={() => void carregar()} disabled={carregando}
          className="flex items-center gap-1.5 border border-white/15 px-3 py-1.5 font-display text-[10px] font-black uppercase tracking-wider text-white/70 hover:bg-white/10 disabled:opacity-50">
          <RotateCcw className={cn('h-3.5 w-3.5', carregando && 'animate-spin')} /> {L('Atualizar', 'Refresh')}
        </button>
      </div>

      {erro ? <p className="mb-2 border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{erro}</p> : null}
      {aviso ? <p className="mb-2 border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">{aviso}</p> : null}

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="ole-poster ole-rail p-4">
          <div className="text-[9px] uppercase tracking-widest text-white/40">{L('Meu clube', 'My club')}</div>
          <p className="mt-1 font-impact text-[22px] text-white">{pct(10000 - vendidoBps)} {L('meu', 'mine')}</p>
          <p className="text-[11px] text-white/50">
            {vendidoBps > 0 ? L(`${pct(vendidoBps)} com ${minhas.comoDono.length} sócio(s)`, `${pct(vendidoBps)} with ${minhas.comoDono.length} partner(s)`) : L('Sem sócios — 100% teu.', 'No partners — 100% yours.')}
            {' '}{L('Cotista recebe a fração de toda venda tua no mercado.', 'Shareholders get their cut of every market sale you make.')}
          </p>
          <button type="button" onClick={() => setAbrirOferta(true)}
            className="mt-3 bg-neon-yellow px-3 py-1.5 font-display text-[11px] font-black uppercase text-black hover:bg-white">
            {L('Vender cotas', 'Sell shares')}
          </button>
        </div>

        <div className="ole-poster p-4">
          <div className="text-[9px] uppercase tracking-widest text-white/40">{L('Sou sócio de', 'Partner in')}</div>
          {minhas.comoCotista.length === 0 ? (
            <p className="mt-2 text-[12px] text-white/45">{L('Nenhum clube ainda — compra uma cota abaixo.', 'No clubs yet — buy a share below.')}</p>
          ) : (
            <ul className="mt-2 space-y-1 text-[12px] text-white/75">
              {minhas.comoCotista.map((c) => (
                <li key={c.owner} className="flex justify-between">
                  <span className="font-mono text-[10px] text-white/45">{c.owner.slice(0, 8)}…</span>
                  <span className="font-bold text-neon-yellow">{pct(c.bps)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="ole-poster p-4">
          <div className="text-[9px] uppercase tracking-widest text-white/40">{L('Dividendos recebidos', 'Dividends received')}</div>
          {dividendos.length === 0 ? (
            <p className="mt-2 text-[12px] text-white/45">{L('Nenhum ainda. Eles caem sozinhos quando o clube vende.', 'None yet. They land automatically when the club sells.')}</p>
          ) : (
            <ul className="mt-2 space-y-1 text-[12px]">
              {dividendos.slice(0, 5).map((d, i) => (
                <li key={i} className="flex justify-between text-emerald-200">
                  <span>+{tok(d.olefoot)} OLEFOOT</span>
                  <span className="text-white/40">{new Date(d.at).toLocaleDateString(LOCALE)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {ofertas.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {ofertas.map((o) => (
            <div key={o.id} className="ole-poster flex items-center gap-3 px-3 py-2">
              <span className="font-impact text-[16px] text-neon-yellow">{pct(o.percentBps)}</span>
              <span className="text-[11px] text-white/55">{L('de um clube', 'of a club')} · {tok(o.priceOlefoot)} OLEFOOT</span>
              {o.mine ? (
                <button type="button" onClick={() => void cancelarOfertaDeCotas(o.id).then(() => carregar())}
                  className="border border-rose-500/40 px-2 py-1 font-display text-[10px] font-black uppercase text-rose-200 hover:bg-rose-500/10">
                  {L('Tirar', 'Remove')}
                </button>
              ) : (
                <button type="button" onClick={() => setComprarAlvo(o)}
                  className="bg-neon-yellow px-2 py-1 font-display text-[10px] font-black uppercase text-black hover:bg-white">
                  {L('Comprar', 'Buy')}
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
        accent="#fde100"
      >
        <div className="mt-3 space-y-2 text-sm text-white/75">
          {emIngles() ? (
            <p>
              The buyer becomes a partner and automatically gets their cut of <strong>every sale you make</strong> on
              the squad market. The majority is always yours (49% cap).
            </p>
          ) : (
            <p>
              O comprador vira sócio e recebe a fração dele de <strong>toda venda tua</strong> no
              mercado de elenco, automática. A maioria é sempre tua (teto 49%).
            </p>
          )}
          <label className="block">
            <span className="text-[10px] uppercase text-white/45">{L('Fatia (%)', 'Stake (%)')}</span>
            <input className={campo} value={pctCampo} inputMode="decimal"
              onChange={(e) => setPctCampo(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))} placeholder="10" />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase text-white/45">{L('Preço (OLEFOOT)', 'Price (OLEFOOT)')}</span>
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
        accent="#fde100"
      >
        <p className="mt-3 text-sm text-white/75">
          {L(
            `Tu recebes ${comprarAlvo ? pct(comprarAlvo.percentBps) : ''} de toda venda que esse clube fizer no mercado de elenco — direto na tua carteira, sem depender de ninguém.`,
            `You get ${comprarAlvo ? pct(comprarAlvo.percentBps) : ''} of every sale this club makes on the squad market — straight to your wallet, no middleman.`,
          )}
        </p>
      </ConfirmDialog>
    </section>
  );
}
