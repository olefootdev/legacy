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

const tok = (v: string | number) => Math.round(Number(v)).toLocaleString('pt-BR');
const pct = (bps: number) => `${(bps / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

const MOTIVO: Record<string, string> = {
  passa_de_49: 'Entre vendidas e ofertadas, passaria de 49% — o clube é teu, a maioria fica contigo.',
  bps_invalido: 'A fatia vai de 1% a 49%.',
  preco_invalido: 'Preço em OLEFOOT inteiro.',
  indisponivel: 'Esta oferta não está mais disponível.',
  propria_oferta: 'Não dá pra comprar a própria cota.',
  saldo_insuficiente: 'Saldo OLEFOOT insuficiente.',
  erro: 'Não foi possível concluir.',
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
      if (!r.ok) { setErro(MOTIVO[r.motivo ?? 'erro'] ?? r.motivo ?? 'Falha.'); return; }
      setAbrirOferta(false);
      setAviso(`${pctCampo}% do clube à venda por ${tok(precoCampo.replace(/\./g, ''))} OLEFOOT.`);
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
      if (!r.ok) { setErro(MOTIVO[r.motivo ?? 'erro'] ?? r.motivo ?? 'Falha.'); return; }
      setComprarAlvo(null);
      setAviso(`Agora és sócio: ${pct(r.percentBps ?? 0)} do clube. Dividendo cai a cada venda dele no mercado.`);
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
          <PieChart className="h-4 w-4" /> Sociedade · cotas do clube
        </h2>
        <button type="button" onClick={() => void carregar()} disabled={carregando}
          className="flex items-center gap-1.5 border border-white/15 px-3 py-1.5 font-display text-[10px] font-black uppercase tracking-wider text-white/70 hover:bg-white/10 disabled:opacity-50">
          <RotateCcw className={cn('h-3.5 w-3.5', carregando && 'animate-spin')} /> Atualizar
        </button>
      </div>

      {erro ? <p className="mb-2 border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{erro}</p> : null}
      {aviso ? <p className="mb-2 border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">{aviso}</p> : null}

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="ole-poster ole-rail p-4">
          <div className="text-[9px] uppercase tracking-widest text-white/40">Meu clube</div>
          <p className="mt-1 font-impact text-[22px] text-white">{pct(10000 - vendidoBps)} meu</p>
          <p className="text-[11px] text-white/50">
            {vendidoBps > 0 ? `${pct(vendidoBps)} com ${minhas.comoDono.length} sócio(s)` : 'Sem sócios — 100% teu.'}
            {' '}Cotista recebe a fração de toda venda tua no mercado.
          </p>
          <button type="button" onClick={() => setAbrirOferta(true)}
            className="mt-3 bg-neon-yellow px-3 py-1.5 font-display text-[11px] font-black uppercase text-black hover:bg-white">
            Vender cotas
          </button>
        </div>

        <div className="ole-poster p-4">
          <div className="text-[9px] uppercase tracking-widest text-white/40">Sou sócio de</div>
          {minhas.comoCotista.length === 0 ? (
            <p className="mt-2 text-[12px] text-white/45">Nenhum clube ainda — compra uma cota abaixo.</p>
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
          <div className="text-[9px] uppercase tracking-widest text-white/40">Dividendos recebidos</div>
          {dividendos.length === 0 ? (
            <p className="mt-2 text-[12px] text-white/45">Nenhum ainda. Eles caem sozinhos quando o clube vende.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-[12px]">
              {dividendos.slice(0, 5).map((d, i) => (
                <li key={i} className="flex justify-between text-emerald-200">
                  <span>+{tok(d.olefoot)} OLEFOOT</span>
                  <span className="text-white/40">{new Date(d.at).toLocaleDateString('pt-BR')}</span>
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
              <span className="text-[11px] text-white/55">de um clube · {tok(o.priceOlefoot)} OLEFOOT</span>
              {o.mine ? (
                <button type="button" onClick={() => void cancelarOfertaDeCotas(o.id).then(() => carregar())}
                  className="border border-rose-500/40 px-2 py-1 font-display text-[10px] font-black uppercase text-rose-200 hover:bg-rose-500/10">
                  Tirar
                </button>
              ) : (
                <button type="button" onClick={() => setComprarAlvo(o)}
                  className="bg-neon-yellow px-2 py-1 font-display text-[10px] font-black uppercase text-black hover:bg-white">
                  Comprar
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
        eyebrow="Sociedade"
        title="Vender cotas do clube?"
        confirmLabel={agindo ? 'Anunciando…' : 'Anunciar cotas'}
        confirmDisabled={agindo || !Number(pctCampo) || !Number(precoCampo.replace(/\./g, ''))}
        accent="#fde100"
      >
        <div className="mt-3 space-y-2 text-sm text-white/75">
          <p>
            O comprador vira sócio e recebe a fração dele de <strong>toda venda tua</strong> no
            mercado de elenco, automática. A maioria é sempre tua (teto 49%).
          </p>
          <label className="block">
            <span className="text-[10px] uppercase text-white/45">Fatia (%)</span>
            <input className={campo} value={pctCampo} inputMode="decimal"
              onChange={(e) => setPctCampo(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))} placeholder="10" />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase text-white/45">Preço (OLEFOOT)</span>
            <input className={campo} value={precoCampo} inputMode="numeric"
              onChange={(e) => setPrecoCampo(e.target.value.replace(/[^\d]/g, ''))} placeholder="ex.: 50000" />
          </label>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={comprarAlvo != null}
        onClose={() => (agindo ? null : setComprarAlvo(null))}
        onConfirm={() => void comprar()}
        eyebrow="Sociedade"
        title={`Comprar ${comprarAlvo ? pct(comprarAlvo.percentBps) : ''} de um clube?`}
        confirmLabel={agindo ? 'Comprando…' : `Pagar ${tok(comprarAlvo?.priceOlefoot ?? 0)} OLEFOOT`}
        confirmDisabled={agindo}
        accent="#fde100"
      >
        <p className="mt-3 text-sm text-white/75">
          Tu recebes {comprarAlvo ? pct(comprarAlvo.percentBps) : ''} de toda venda que esse clube
          fizer no mercado de elenco — direto na tua carteira, sem depender de ninguém.
        </p>
      </ConfirmDialog>
    </section>
  );
}
